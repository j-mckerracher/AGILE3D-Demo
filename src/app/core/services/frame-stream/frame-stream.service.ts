import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { SequenceManifest, FrameRef, Detection } from '../../models/sequence.models';
import { SequenceDataService } from '../data/sequence-data.service';
import { SceneDataService } from '../data/scene-data.service';

export interface StreamedFrame {
  index: number;
  frame: FrameRef;
  points: Float32Array;  // Changed from ArrayBuffer to Float32Array
  gt: Detection[];
  det?: Detection[];
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

  private currentFrameSubject = new BehaviorSubject<StreamedFrame | null>(null);
  private statusSubject = new BehaviorSubject<StreamStatus>('stopped');
  private errorsSubject = new BehaviorSubject<string | null>(null);

  currentFrame$: Observable<StreamedFrame | null> = this.currentFrameSubject.asObservable();
  status$: Observable<StreamStatus> = this.statusSubject.asObservable();
  errors$: Observable<string | null> = this.errorsSubject.asObservable();

  start(manifest: SequenceManifest, opts?: { fps?: number; prefetch?: number }): void {
    this.stop();
    this.manifest = manifest;
    this.currentIndex = 0;
    this.consecutiveMisses = 0;
    
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
      this.stop();
      return;
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
    
    // Remove fetches that are too old
    const minIndex = this.currentIndex;
    this.prefetchQueue = this.prefetchQueue.filter(e => e.index >= minIndex);
    
    // Add new prefetches
    for (let i = 0; i < prefetchCount; i++) {
      const targetIndex = this.currentIndex + i + 1;
      
      if (targetIndex >= this.manifest.frames.length) break;
      if (this.prefetchQueue.some(e => e.index === targetIndex)) continue;
      
      const controller = new AbortController();
      const promise = this.fetchFrame(targetIndex, controller.signal);
      
      this.prefetchQueue.push({ index: targetIndex, controller, promise });
    }
  }

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
    
    if (signal?.aborted) {
      throw new Error('Aborted');
    }
    
    // Parse points in worker here, before creating the StreamedFrame
    // This ensures parsing happens once and avoids ArrayBuffer detachment issues
    const points = await this.sceneData.parseInWorker(pointsBuffer, 3);
    
    const gt = this.sequenceData.mapGTToDetections(frame.id, gtFile.boxes);
    
    return {
      index,
      frame,
      points,
      gt,
      det: undefined
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
