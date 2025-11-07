import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { SequenceManifest, FrameRef, Detection } from '../../models/sequence.models';
import { SequenceDataService, DET_SCORE_THRESH } from '../data/sequence-data.service';
import { SceneDataService } from '../data/scene-data.service';
import { classifyDetectionsFast, cacheGTCorners } from './bev-iou.util';

export interface DetectionSet {
  det: Detection[];
  cls: boolean[];  // true = TP, false = FP
  delay?: number;
}

export interface StreamedFrame {
  index: number;
  frame: FrameRef;
  points: Float32Array;  // Changed from ArrayBuffer to Float32Array
  gt: Detection[];
  gtCorners?: any[];  // cached corners for perf
  agile?: DetectionSet;
  baseline?: DetectionSet;
  det?: Detection[];  // legacy: populated for backward compat
}

export type StreamStatus = 'stopped' | 'playing' | 'paused' | 'error';

interface PrefetchEntry {
  index: number;
  controller: AbortController;
  promise: Promise<StreamedFrame>;
}

@Injectable({
  providedIn: 'root'
})
export class FrameStreamService {
  private readonly sequenceData = inject(SequenceDataService);
  private readonly sceneData = inject(SceneDataService);
  
  private manifest: SequenceManifest | null = null;
  private currentIndex = 0;
  private intervalId: any = null;
  private prefetchQueue: PrefetchEntry[] = [];
  private consecutiveMisses = 0;
  private readonly MAX_MISSES = 3;
  private readonly TIMEOUT_MS = 3000;
  private readonly RETRY_DELAYS = [250, 750];
  private loop = false;
  
  // Detection configuration
  activeBranch = 'CP_Pillar_032';
  baselineBranch = 'DSVT_Pillar_030';  // Fallback if _038 not available
  simulateDelay = false;
  detScoreThresh = DET_SCORE_THRESH;
  iouThresh = 0.5;
  
  // Progressive delay simulation
  private delayInitial = 2;
  private delayGrowth = 0.2;
  private delayMax = 10;

  private currentFrameSubject = new BehaviorSubject<StreamedFrame | null>(null);
  private statusSubject = new BehaviorSubject<StreamStatus>('stopped');
  private errorsSubject = new BehaviorSubject<string | null>(null);

  currentFrame$: Observable<StreamedFrame | null> = this.currentFrameSubject.asObservable();
  status$: Observable<StreamStatus> = this.statusSubject.asObservable();
  errors$: Observable<string | null> = this.errorsSubject.asObservable();

  start(manifest: SequenceManifest, opts?: { fps?: number; prefetch?: number; loop?: boolean }): void {
    this.stop();
    this.manifest = manifest;
    this.currentIndex = 0;
    this.consecutiveMisses = 0;
    this.loop = opts?.loop ?? this.loop ?? false;
    
    const fps = opts?.fps ?? manifest.fps ?? 10;
    const prefetchCount = opts?.prefetch ?? 2;
    const intervalMs = 1000 / fps;

    this.statusSubject.next('playing');
    
    // Start prefetching
    this.schedulePrefetch(prefetchCount);
    
    this.intervalId = setInterval(() => {
      this.tick(prefetchCount);
    }, intervalMs);
  }

  pause(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.statusSubject.next('paused');
    }
  }

  resume(): void {
    if (!this.manifest || this.intervalId) return;
    
    const fps = this.manifest.fps ?? 10;
    const intervalMs = 1000 / fps;
    
    this.statusSubject.next('playing');
    this.consecutiveMisses = 0;
    this.errorsSubject.next(null);
    
    this.intervalId = setInterval(() => {
      this.tick(2);
    }, intervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    // Cancel all pending fetches
    this.prefetchQueue.forEach(entry => entry.controller.abort());
    this.prefetchQueue = [];
    
    this.statusSubject.next('stopped');
    this.currentFrameSubject.next(null);
    this.errorsSubject.next(null);
    this.manifest = null;
    this.currentIndex = 0;
    this.consecutiveMisses = 0;
  }

  seek(index: number): void {
    if (!this.manifest) return;
    
    // Cancel stale fetches
    this.prefetchQueue.forEach(entry => entry.controller.abort());
    this.prefetchQueue = [];
    
    this.currentIndex = Math.max(0, Math.min(index, this.manifest.frames.length - 1));
    this.consecutiveMisses = 0;
    this.errorsSubject.next(null);
    
    // Restart prefetch
    this.schedulePrefetch(2);
  }

  private async tick(prefetchCount: number): Promise<void> {
    if (!this.manifest) return;
    
    if (this.currentIndex >= this.manifest.frames.length) {
      if (this.loop) {
        // Wrap to start and reset prefetch queue
        this.currentIndex = 0;
        this.prefetchQueue.forEach(entry => entry.controller.abort());
        this.prefetchQueue = [];
        this.consecutiveMisses = 0;
        this.errorsSubject.next(null);
      } else {
        this.stop();
        return;
      }
    }
    
    // Check if frame is prefetched
    const prefetched = this.prefetchQueue.find(e => e.index === this.currentIndex);
    
    if (prefetched) {
      try {
        const frame = await prefetched.promise;
        this.currentFrameSubject.next(frame);
        this.consecutiveMisses = 0;
        this.errorsSubject.next(null);
        
        // Remove from queue
        this.prefetchQueue = this.prefetchQueue.filter(e => e.index !== this.currentIndex);
      } catch (error) {
        this.handleFrameMiss(error);
      }
    } else {
      // Frame not ready - fetch now
      try {
        const frame = await this.fetchFrameWithRetry(this.currentIndex);
        this.currentFrameSubject.next(frame);
        this.consecutiveMisses = 0;
        this.errorsSubject.next(null);
      } catch (error) {
        this.handleFrameMiss(error);
      }
    }
    
    this.currentIndex++;
    this.schedulePrefetch(prefetchCount);
  }

  private schedulePrefetch(prefetchCount: number): void {
    if (!this.manifest) return;
    const len = this.manifest.frames.length;

    if (!this.loop) {
      // Remove fetches that are too old
      const minIndex = this.currentIndex;
      this.prefetchQueue = this.prefetchQueue.filter(e => e.index >= minIndex);
    } else {
      // Keep only entries that fall within the next window when looping
      const window = new Set<number>();
      for (let i = 1; i <= prefetchCount; i++) {
        window.add((this.currentIndex + i) % len);
      }
      this.prefetchQueue = this.prefetchQueue.filter(e => window.has(e.index));
    }
    
    // Add new prefetches
    for (let i = 0; i < prefetchCount; i++) {
      const targetIndex = this.loop ? (this.currentIndex + i + 1) % len : this.currentIndex + i + 1;
      
      if (!this.loop && targetIndex >= len) break;
      if (this.prefetchQueue.some(e => e.index === targetIndex)) continue;
      
      const controller = new AbortController();
      const promise = this.fetchFrame(targetIndex, controller.signal);
      
      this.prefetchQueue.push({ index: targetIndex, controller, promise });
    }
  }

  private debugLoggedOnce = false;

  private async fetchFrame(index: number, signal?: AbortSignal): Promise<StreamedFrame> {
    if (!this.manifest) throw new Error('No manifest loaded');
    
    const frame = this.manifest.frames[index];
    if (!frame) throw new Error(`Frame ${index} not found in manifest`);
    
    const seqId = this.manifest.sequenceId;
    
    // Fetch points and GT in parallel
    const [pointsBuffer, gtFile] = await Promise.all([
      this.sequenceData.fetchPoints(seqId, frame.urls.points),
      frame.urls.gt ? this.sequenceData.fetchGT(seqId, frame.urls.gt) : Promise.resolve({ boxes: [] })
    ]);
    
    // Fetch detections in parallel if URLs exist
    let agileDetFile: any = null;
    let baselineDetFile: any = null;
    
    const detFetches: Promise<any>[] = [];
    
    // Try to fetch active branch detections
    const agileUrl = frame.urls.det?.[this.activeBranch];
    if (agileUrl) {
      detFetches.push(
        this.sequenceData.fetchDet(seqId, agileUrl)
          .then(f => { agileDetFile = f; })
          .catch(() => { /* silently skip */ })
      );
    }
    
    // Try baseline, with fallback
    const baselineUrl = frame.urls.det?.[this.baselineBranch] ||
                       frame.urls.det?.['DSVT_Voxel_038'] ||
                       frame.urls.det?.['DSVT_Pillar_038'];
    if (baselineUrl) {
      detFetches.push(
        this.sequenceData.fetchDet(seqId, baselineUrl)
          .then(f => { baselineDetFile = f; })
          .catch(() => { /* silently skip */ })
      );
    }
    
    if (detFetches.length > 0) {
      await Promise.all(detFetches);
    }
    
    if (signal?.aborted) {
      throw new Error('Aborted');
    }
    
    // Parse points in worker here, before creating the StreamedFrame
    // This ensures parsing happens once and avoids ArrayBuffer detachment issues
    let parsed = await this.sceneData.parseInWorker(pointsBuffer, 3);

    // Determine actual stride from manifest pointCount if available
    const pointCount = frame.pointCount ?? Math.floor(parsed.length / 4);
    const detectedStride = pointCount > 0 ? Math.round(parsed.length / pointCount) : 3;

    // Heuristic: if X-range is ~0 but Y/Z have range, reorder (y,z,x) -> (x,y,z)
    let points: Float32Array;
    {
      let minX = Infinity, minY = Infinity, minZ = Infinity;
      let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
      for (let i = 0; i < parsed.length; i += 3) {
        const x = parsed[i]!; const y = parsed[i + 1]!; const z = parsed[i + 2]!;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
      }
      const rx = maxX - minX, ry = maxY - minY, rz = maxZ - minZ;
      if (rx < 1e-6 && ry > 1 && rz > 1) {
        const out = new Float32Array(parsed.length);
        for (let i = 0; i < parsed.length; i += 3) {
          // Assume incoming order is (dummy/yaw?, y, z); remap to (y, z, 0)
          out[i] = parsed[i + 1]!;     // x <- y
          out[i + 1] = parsed[i + 2]!; // y <- z
          out[i + 2] = parsed[i]!;     // z <- x (likely 0)
        }
        parsed = out;
      }
    }

    // If stride > 3 (e.g., XYZ + intensity), repack to XYZ only
    if (detectedStride !== 3 && pointCount > 0 && parsed.length % pointCount === 0) {
      const stride = detectedStride;
      const out = new Float32Array(pointCount * 3);
      for (let i = 0, j = 0; i < pointCount; i++) {
        const base = i * stride;
        out[j++] = parsed[base]!;     // x
        out[j++] = parsed[base + 1]!; // y
        out[j++] = parsed[base + 2]!; // z
      }
      points = out;
      parsed = out;
    } else {
      points = parsed;
    }

    // One-time debug line
    if (this.debugLoggedOnce === false) {
      const first6 = [parsed[0], parsed[1], parsed[2], parsed[3], parsed[4], parsed[5]]
        .map((n) => (Number.isFinite(n!) ? (n as number).toFixed(3) : String(n)));
      const sample = parsed;
      let minX = Infinity, minY = Infinity, minZ = Infinity;
      let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
      for (let i = 0; i < Math.min(sample.length, 300000); i += 3) {
        const x = sample[i]!; const y = sample[i+1]!; const z = sample[i+2]!;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
      }
      const firstDet = gtFile.boxes?.[0];
      console.log('[FrameStream] parsed frame sample', {
        id: frame.id,
        floats: parsed.length,
        pointCount,
        detectedStride,
        first6,
        bounds: { minX, maxX, minY, maxY, minZ, maxZ },
        firstGT: firstDet ? {
          center: [firstDet.x, firstDet.y, firstDet.z],
          d: [firstDet.dx, firstDet.dy, firstDet.dz],
          yaw: firstDet.heading,
        } : null,
      });
      this.debugLoggedOnce = true;
    }
    
    const gt = this.sequenceData.mapGTToDetections(frame.id, gtFile.boxes);
    
    // Convert detections to Box2D format for IoU computation
    const gtCorners = cacheGTCorners(gt.map(d => ({
      x: d.center[0],
      y: d.center[1],
      dx: d.dimensions.length,
      dy: d.dimensions.width,
      heading: d.yaw
    })));
    
    // Process detection sets
    let agile: DetectionSet | undefined;
    let baseline: DetectionSet | undefined;
    
    if (agileDetFile) {
      const agileDetections = this.sequenceData.mapDetToDetections(
        this.activeBranch,
        agileDetFile.boxes,
        this.detScoreThresh
      );
      const agileCls = classifyDetectionsFast(
        agileDetections.map(d => ({
          x: d.center[0],
          y: d.center[1],
          dx: d.dimensions.length,
          dy: d.dimensions.width,
          heading: d.yaw
        })),
        gtCorners,
        this.iouThresh
      );
      agile = { det: agileDetections, cls: agileCls };
    }
    
    if (baselineDetFile) {
      // Compute delayed index for baseline
      let delayedIndex = index;
      let currentDelay = 0;
      
      if (this.simulateDelay) {
        currentDelay = Math.min(
          this.delayMax,
          this.delayInitial + index * this.delayGrowth
        );
        delayedIndex = Math.max(0, Math.floor(index - currentDelay));
      }
      
      const baselineDetections = this.sequenceData.mapDetToDetections(
        this.baselineBranch,
        baselineDetFile.boxes,
        this.detScoreThresh
      );
      const baselineCls = classifyDetectionsFast(
        baselineDetections.map(d => ({
          x: d.center[0],
          y: d.center[1],
          dx: d.dimensions.length,
          dy: d.dimensions.width,
          heading: d.yaw
        })),
        gtCorners,
        this.iouThresh
      );
      baseline = { det: baselineDetections, cls: baselineCls, delay: currentDelay };
    }
    
    return {
      index,
      frame,
      points,
      gt,
      gtCorners,
      agile,
      baseline,
      det: agile?.det  // legacy support
    };
  }

  private async fetchFrameWithRetry(index: number): Promise<StreamedFrame> {
    let lastError: any;
    
    // Initial attempt
    try {
      return await this.withTimeout(this.fetchFrame(index), this.TIMEOUT_MS);
    } catch (error) {
      lastError = error;
    }
    
    // Retry attempts
    for (const delay of this.RETRY_DELAYS) {
      await this.sleep(delay);
      
      try {
        return await this.withTimeout(this.fetchFrame(index), this.TIMEOUT_MS);
      } catch (error) {
        lastError = error;
      }
    }
    
    throw lastError;
  }

  private async withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), ms)
      )
    ]);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private handleFrameMiss(error: any): void {
    console.warn('Frame miss:', error);
    this.consecutiveMisses++;
    
    if (this.consecutiveMisses >= this.MAX_MISSES) {
      this.pause();
      this.statusSubject.next('error');
      this.errorsSubject.next(`Failed to load ${this.MAX_MISSES} consecutive frames. Network issue?`);
    }
  }
}
