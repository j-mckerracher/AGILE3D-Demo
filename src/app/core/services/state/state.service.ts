import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest, Observable } from 'rxjs';
import { distinctUntilChanged, map, shareReplay } from 'rxjs/operators';
import { Vec3 } from '../../models/scene.models';

/**
 * Aggregated comparison input values derived from primary state knobs.
 */
export interface ComparisonData {
  scene: string;
  contention: number;
  latencySlo: number;
  voxelSize: number;
}

/**
 * Global reactive state for the demo. Provides BehaviorSubjects for primary
 * controls and camera sync, plus derived state for comparison calculations.
 */
@Injectable({ providedIn: 'root' })
export class StateService {
  // Primary state subjects
  readonly currentScene$ = new BehaviorSubject<string>('vehicle-heavy');
  readonly contention$ = new BehaviorSubject<number>(0);
  readonly latencySlo$ = new BehaviorSubject<number>(350);
  readonly voxelSize$ = new BehaviorSubject<number>(0.32);
  readonly activeBranch$ = new BehaviorSubject<string>('CP_Pillar_032');

  // Camera synchronization
  readonly cameraPos$ = new BehaviorSubject<Vec3>([0, 0, 10]);
  readonly cameraTarget$ = new BehaviorSubject<Vec3>([0, 0, 0]);

  // Derived state for comparison/metrics pipelines
  readonly comparisonData$: Observable<ComparisonData> = combineLatest([
    this.currentScene$,
    this.contention$,
    this.latencySlo$,
    this.voxelSize$,
  ]).pipe(
    map(([scene, contention, latencySlo, voxelSize]) => ({ scene, contention, latencySlo, voxelSize })),
    distinctUntilChanged((a, b) =>
      a.scene === b.scene &&
      a.contention === b.contention &&
      a.latencySlo === b.latencySlo &&
      a.voxelSize === b.voxelSize
    ),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  /** Update current scene if changed. */
  setCurrentScene(value: string): void {
    if (this.currentScene$.value !== value) this.currentScene$.next(value);
  }

  /** Update contention (0..100), clamped. */
  setContention(value: number): void {
    const v = clamp(value, 0, 100);
    if (this.contention$.value !== v) this.contention$.next(v);
  }

  /** Update latency SLO in ms (100..500), clamped. */
  setLatencySlo(value: number): void {
    const v = clamp(value, 100, 500);
    if (this.latencySlo$.value !== v) this.latencySlo$.next(v);
  }

  /** Update voxel size in meters (0.16..0.64), clamped. */
  setVoxelSize(value: number): void {
    const v = clamp(value, 0.16, 0.64);
    if (this.voxelSize$.value !== v) this.voxelSize$.next(v);
  }

  /** Update active AGILE3D branch. */
  setActiveBranch(value: string): void {
    if (this.activeBranch$.value !== value) this.activeBranch$.next(value);
  }

  /** Update camera position if changed. */
  setCameraPos(value: Vec3): void {
    if (!vec3Equal(this.cameraPos$.value, value)) this.cameraPos$.next(value);
  }

  /** Update camera target if changed. */
  setCameraTarget(value: Vec3): void {
    if (!vec3Equal(this.cameraTarget$.value, value)) this.cameraTarget$.next(value);
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function vec3Equal(a: Vec3, b: Vec3): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}
