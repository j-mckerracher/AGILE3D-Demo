import { Injectable, inject, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import * as THREE from 'three';
import { FrameData } from '../frame-stream/frame-stream.service';
import { SceneMetadata, SceneRegistry, WorkerParseMessage, WorkerParseResponse } from '../../models/scene.models';

export interface FilterConfig { scoreThreshold: number; labelMask: Set<string>; }
export interface GeometryState { pointCount: number; maxCapacity: number; needsRealloc: boolean; }
export interface DetectionData { id: string; label: string; score: number; bbox: { x: number; y: number; z: number; l: number; w: number; h: number; yaw: number }; }

@Injectable({ providedIn: 'root' })
export class SceneDataService implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly pointsCache = new Map<string, Float32Array>();
  private readonly pointsObjectCache = new Map<string, THREE.Points>();
  private readonly metadataCache = new Map<string, SceneMetadata>();
  private worker: Worker | null = null;
  private readonly WORKER_TIMEOUT_MS = 10_000;
  // Frame streaming
  private frameGeometry: THREE.BufferGeometry | null = null;
  private positionAttribute: THREE.BufferAttribute | null = null;
  private filterConfig: FilterConfig = { scoreThreshold: 0.7, labelMask: new Set(['vehicle', 'pedestrian', 'cyclist']) };
  private frameState: GeometryState = { pointCount: 0, maxCapacity: 0, needsRealloc: false };
  private geometrySubject = new BehaviorSubject<THREE.BufferGeometry | null>(null);
  private detectionsSubject = new BehaviorSubject<DetectionData[]>([]);
  private stateSubject = new BehaviorSubject<GeometryState>(this.frameState);

  async loadMetadata(sceneId: string): Promise<SceneMetadata> {
    if (this.metadataCache.has(sceneId)) return this.metadataCache.get(sceneId)!;
    const metadata = await firstValueFrom(this.http.get<SceneMetadata>(`assets/scenes/${sceneId}/metadata.json`));
    this.validateMetadata(metadata);
    this.metadataCache.set(sceneId, metadata);
    return metadata;
  }

  async loadRegistry(): Promise<SceneRegistry> {
    return firstValueFrom(this.http.get<SceneRegistry>('assets/scenes/registry.json'));
  }

  async loadPoints(binPath: string, cacheKey: string, stride = 3): Promise<Float32Array> {
    if (this.pointsCache.has(cacheKey)) return this.pointsCache.get(cacheKey)!;
    const arrayBuffer = await firstValueFrom(this.http.get(binPath, { responseType: 'arraybuffer' }));
    let positions: Float32Array;
    try {
      positions = await this.parseInWorker(arrayBuffer.slice(0), stride);
    } catch {
      positions = new Float32Array(arrayBuffer);
      if (positions.length % stride !== 0) throw new Error(`Misaligned length ${positions.length} for stride ${stride}`);
    }
    this.pointsCache.set(cacheKey, positions);
    return positions;
  }

  createPointsFromPositions(positions: Float32Array, cacheKey: string, stride = 3): THREE.Points {
    if (this.pointsObjectCache.has(cacheKey)) return this.pointsObjectCache.get(cacheKey)!;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, stride));
    const material = new THREE.PointsMaterial({ color: 0x888888, size: 0.05 });
    const points = new THREE.Points(geometry, material);
    this.pointsObjectCache.set(cacheKey, points);
    return points;
  }

  async loadPointsObject(binPath: string, cacheKey: string, stride = 3): Promise<THREE.Points> {
    if (this.pointsObjectCache.has(cacheKey)) return this.pointsObjectCache.get(cacheKey)!;
    const positions = await this.loadPoints(binPath, cacheKey, stride);
    return this.createPointsFromPositions(positions, cacheKey, stride);
  }

  async parseInWorker(arrayBuffer: ArrayBuffer, stride = 3): Promise<Float32Array> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        try {
          this.worker = new Worker('/assets/workers/point-cloud-worker.js');
        } catch (error) {
          reject(new Error(`Failed to create worker: ${error instanceof Error ? error.message : 'Unknown'}`));
          return;
        }
      }
      const timeoutId = setTimeout(() => { this.terminateWorker(); reject(new Error(`Worker timeout after ${this.WORKER_TIMEOUT_MS}ms`)); }, this.WORKER_TIMEOUT_MS);
      const handler = (event: MessageEvent<WorkerParseResponse | { ready?: boolean }>) => {
        if ('ready' in event.data && event.data.ready) return;
        clearTimeout(timeoutId);
        const data = event.data as WorkerParseResponse;
        if (data.ok && data.positions) resolve(data.positions);
        else reject(new Error('error' in data ? data.error : 'Unknown parsing error'));
        this.worker?.removeEventListener('message', handler);
      };
      this.worker.addEventListener('message', handler);
      const message: WorkerParseMessage = { arrayBuffer, stride };
      this.worker.postMessage(message, [arrayBuffer]);
    });
  }

  terminateWorker(): void { if (this.worker) { this.worker.terminate(); this.worker = null; } }
  clearCache(): void { this.pointsCache.clear(); this.pointsObjectCache.forEach(p => { if (p.geometry) p.geometry.dispose(); if (p.material) (Array.isArray(p.material) ? p.material.forEach(m => m.dispose()) : p.material.dispose()); }); this.pointsObjectCache.clear(); this.metadataCache.clear(); }

  // Frame streaming API
  setActiveBranch(branchId: string): void { }
  setScoreThreshold(score: number): void { this.filterConfig.scoreThreshold = score; }
  setLabelMask(labels: string[]): void { this.filterConfig.labelMask = new Set(labels); }

  applyFrame(frameData: FrameData, quantHeader?: Record<string, unknown>): void {
    const parsed = this.parsePoints(frameData.pointsBuffer || new ArrayBuffer(0), quantHeader);
    this.updateGeometry(parsed.positions, parsed.pointCount);
    const dets = this.filterDetections(frameData.detections as Record<string, unknown>, this.filterConfig);
    this.geometrySubject.next(this.frameGeometry);
    this.detectionsSubject.next(dets);
    this.stateSubject.next(this.frameState);
  }

  geometry$(): Observable<THREE.BufferGeometry | null> { return this.geometrySubject.asObservable(); }
  detections$(): Observable<DetectionData[]> { return this.detectionsSubject.asObservable(); }
  state$(): Observable<GeometryState> { return this.stateSubject.asObservable(); }

  private parsePoints(buffer: ArrayBuffer, quantHeader?: Record<string, unknown>): { positions: Float32Array; pointCount: number } {
    const positions = new Float32Array(buffer);
    return { positions, pointCount: positions.length / 3 };
  }

  private updateGeometry(positions: Float32Array, pointCount: number): void {
    const needsRealloc = this.shouldReallocate(pointCount);
    if (needsRealloc) this.reallocateGeometry(Math.ceil(pointCount * 1.2));
    if (!this.frameGeometry) this.frameGeometry = new THREE.BufferGeometry();
    if (this.positionAttribute) {
      const posArray = this.positionAttribute.array as Float32Array;
      posArray.set(positions.subarray(0, Math.min(positions.length, posArray.length)));
      this.positionAttribute.needsUpdate = true;
    } else {
      this.positionAttribute = new THREE.BufferAttribute(positions, 3);
      this.frameGeometry.setAttribute('position', this.positionAttribute);
    }
    this.frameState = { pointCount, maxCapacity: this.frameState.maxCapacity, needsRealloc };
  }

  private shouldReallocate(pointCount: number): boolean {
    const { maxCapacity } = this.frameState;
    if (maxCapacity === 0) return true;
    if (pointCount > maxCapacity) return true;
    if (pointCount < maxCapacity * 0.5) return true;
    return false;
  }

  private reallocateGeometry(newCapacity: number): void {
    if (!this.frameGeometry) this.frameGeometry = new THREE.BufferGeometry();
    const newPositions = new Float32Array(newCapacity * 3);
    if (this.positionAttribute) {
      const oldArray = this.positionAttribute.array as Float32Array;
      newPositions.set(oldArray.subarray(0, Math.min(oldArray.length, newPositions.length)));
    }
    this.positionAttribute = new THREE.BufferAttribute(newPositions, 3);
    this.frameGeometry.setAttribute('position', this.positionAttribute);
    this.frameState = { ...this.frameState, maxCapacity: newCapacity };
  }

  private filterDetections(detections: Record<string, unknown>, filterConfig: FilterConfig): DetectionData[] {
    const dets = (detections as unknown as Record<string, unknown>[]) || [];
    return dets.filter((det: Record<string, unknown>) => {
      const score = (det['score'] as number) || 0;
      const label = (det['label'] as string) || '';
      return score >= filterConfig.scoreThreshold && filterConfig.labelMask.has(label);
    }) as unknown as DetectionData[];
  }

  clear(): void { if (this.frameGeometry) { this.frameGeometry.dispose(); this.frameGeometry = null; } this.positionAttribute = null; this.frameState = { pointCount: 0, maxCapacity: 0, needsRealloc: false }; }

  ngOnDestroy(): void { this.terminateWorker(); this.clearCache(); }

  private validateMetadata(metadata: SceneMetadata): void {
    const required = ['scene_id', 'name', 'pointsBin', 'pointCount', 'pointStride', 'bounds', 'ground_truth', 'predictions', 'metadata'];
    for (const field of required) if (!(field in metadata)) throw new Error(`Missing required field: ${field}`);
    if (!metadata.bounds.min || !metadata.bounds.max) throw new Error('Invalid bounds');
    if (!Array.isArray(metadata.bounds.min) || metadata.bounds.min.length !== 3) throw new Error('Invalid bounds.min');
    if (!Array.isArray(metadata.bounds.max) || metadata.bounds.max.length !== 3) throw new Error('Invalid bounds.max');
  }

  getCacheStats(): { pointsCacheSize: number; pointsObjectCacheSize: number; metadataCacheSize: number; } {
    return { pointsCacheSize: this.pointsCache.size, pointsObjectCacheSize: this.pointsObjectCache.size, metadataCacheSize: this.metadataCache.size };
  }
}
