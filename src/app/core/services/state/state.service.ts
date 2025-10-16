import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, combineLatest, Observable } from 'rxjs';
import { debounceTime, distinctUntilChanged, map, shareReplay } from 'rxjs/operators';
import { SceneId, SystemParams, VoxelSize } from '../../models/config-and-metrics';
import { Vec3 } from '../../models/scene.models';

/**
 * Aggregated comparison input values derived from primary state knobs.
 */
export interface ComparisonData {
  scene: SceneId;
  contention: number;
  latencySlo: number;
  voxelSize: number;
}

/**
 * Global reactive state for the demo. Provides BehaviorSubjects for primary
 * controls and camera sync, plus derived state for comparison calculations.
 */
@Injectable({ providedIn: 'root' })
export class StateService implements OnDestroy {
  // Private state subjects
  private readonly sceneSubject = new BehaviorSubject<SceneId>('mixed');
  private readonly voxelSizeSubject = new BehaviorSubject<VoxelSize>(0.32);
  private readonly contentionSubject = new BehaviorSubject<number>(38);
  private readonly sloMsSubject = new BehaviorSubject<number>(350);
  private readonly activeBranchSubject = new BehaviorSubject<string>('CP_Pillar_032');

  // Camera synchronization (private subjects)
  private readonly cameraPosSubject = new BehaviorSubject<Vec3>([0, 0, 10]);
  private readonly cameraTargetSubject = new BehaviorSubject<Vec3>([0, 0, 0]);

  // Public observables for configuration controls
  public readonly scene$: Observable<SceneId> = this.sceneSubject.asObservable();
  public readonly voxelSize$: Observable<VoxelSize> = this.voxelSizeSubject.asObservable();
  public readonly contention$: Observable<number> = this.contentionSubject.pipe(
    debounceTime(100),
    distinctUntilChanged(),
    shareReplay(1)
  );
  public readonly sloMs$: Observable<number> = this.sloMsSubject.pipe(
    debounceTime(100),
    distinctUntilChanged(),
    shareReplay(1)
  );

  // Public observables for other state
  public readonly activeBranch$: Observable<string> = this.activeBranchSubject.asObservable();
  public readonly cameraPos$: Observable<Vec3> = this.cameraPosSubject.asObservable();
  public readonly cameraTarget$: Observable<Vec3> = this.cameraTargetSubject.asObservable();

  // Backwards compatibility: expose raw subjects for existing consumers
  /** @deprecated Use scene$ observable instead */
  public readonly currentScene$ = this.sceneSubject;

  /**
   * Derived stream combining configuration inputs into SystemParams.
   * Uses debounced contention$/sloMs$ streams for stable updates.
   */
  public readonly currentParams$: Observable<SystemParams> = combineLatest([
    this.scene$,
    this.voxelSize$,
    this.contention$,
    this.sloMs$,
  ]).pipe(
    map(
      ([scene, voxelSize, contentionPct, sloMs]) =>
        ({ scene, voxelSize, contentionPct, sloMs }) satisfies SystemParams
    ),
    distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
    shareReplay(1)
  );

  /**
   * @deprecated Use currentParams$ instead. Kept for backwards compatibility during transition.
   */
  public readonly comparisonData$: Observable<ComparisonData> = combineLatest([
    this.sceneSubject,
    this.contentionSubject,
    this.sloMsSubject,
    this.voxelSizeSubject,
  ]).pipe(
    map(([scene, contention, latencySlo, voxelSize]) => ({
      scene,
      contention,
      latencySlo,
      voxelSize,
    })),
    distinctUntilChanged(
      (a, b) =>
        a.scene === b.scene &&
        a.contention === b.contention &&
        a.latencySlo === b.latencySlo &&
        a.voxelSize === b.voxelSize
    ),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  /** Update current scene if changed. */
  public setScene(value: SceneId): void {
    if (this.sceneSubject.value !== value) this.sceneSubject.next(value);
  }

  /** Update voxel size. Accepts VoxelSize union type. */
  public setVoxelSize(value: VoxelSize): void {
    if (this.voxelSizeSubject.value !== value) this.voxelSizeSubject.next(value);
  }

  /** Update GPU contention percentage (0-100), clamped. */
  public setContention(pct: number): void {
    const clamped = clamp(pct, 0, 100);
    if (this.contentionSubject.value !== clamped) this.contentionSubject.next(clamped);
  }

  /** Update latency SLO in milliseconds (100-500), clamped. */
  public setSlo(ms: number): void {
    const clamped = clamp(ms, 100, 500);
    if (this.sloMsSubject.value !== clamped) this.sloMsSubject.next(clamped);
  }

  /** @deprecated Use setScene instead */
  public setCurrentScene(value: SceneId): void {
    this.setScene(value);
  }

  /** @deprecated Use setSlo instead */
  public setLatencySlo(value: number): void {
    this.setSlo(value);
  }

  /** Update active AGILE3D branch. */
  public setActiveBranch(value: string): void {
    if (this.activeBranchSubject.value !== value) this.activeBranchSubject.next(value);
  }

  /** Update camera position if changed. */
  public setCameraPos(value: Vec3): void {
    if (!vec3Equal(this.cameraPosSubject.value, value)) this.cameraPosSubject.next(value);
  }

  /** Update camera target if changed. */
  public setCameraTarget(value: Vec3): void {
    if (!vec3Equal(this.cameraTargetSubject.value, value)) this.cameraTargetSubject.next(value);
  }

  /**
   * Cleanup lifecycle hook. Completes all BehaviorSubjects to prevent potential
   * memory leaks if service scoping changes in the future.
   */
  public ngOnDestroy(): void {
    this.sceneSubject.complete();
    this.voxelSizeSubject.complete();
    this.contentionSubject.complete();
    this.sloMsSubject.complete();
    this.activeBranchSubject.complete();
    this.cameraPosSubject.complete();
    this.cameraTargetSubject.complete();
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function vec3Equal(a: Vec3, b: Vec3): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}
