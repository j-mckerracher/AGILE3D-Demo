import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, combineLatest, Observable } from 'rxjs';
import { debounceTime, distinctUntilChanged, map, shareReplay } from 'rxjs/operators';
import { AdvancedKnobs, SceneId, SystemParams, VoxelSize } from '../../models/config-and-metrics';
import { Vec3, DetectionClass } from '../../models/scene.models';
import { DiffMode } from '../visualization/bbox-instancing';
import { DET_SCORE_THRESH } from '../data/sequence-data.service';

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
  private readonly sceneSubject = new BehaviorSubject<SceneId>('pedestrian-heavy');
  private readonly voxelSizeSubject = new BehaviorSubject<VoxelSize>(0.32);
  private readonly contentionSubject = new BehaviorSubject<number>(38);
  private readonly sloMsSubject = new BehaviorSubject<number>(350);
  private readonly activeBranchSubject = new BehaviorSubject<string>('CP_Pillar_032');
  private readonly baselineBranchSubject = new BehaviorSubject<string>('DSVT_Voxel_020');
  private readonly availableBranchesSubject = new BehaviorSubject<string[]>([]);
  private readonly scoreThresholdSubject = new BehaviorSubject<number>(DET_SCORE_THRESH);
  private readonly labelMaskSubject = new BehaviorSubject<DetectionClass[] | null>(null);
  private readonly diffModeSubject = new BehaviorSubject<DiffMode>('all');
  private readonly delaySimulationSubject = new BehaviorSubject<{
    enabled: boolean;
    initial: number;
    growth: number;
    max: number;
  }>({
    enabled: false,
    initial: 2,
    growth: 0.2,
    max: 10,
  });
  private readonly playbackSpeedSubject = new BehaviorSubject<number>(1.0);

  // Camera synchronization (private subjects)
  // Bird's eye view: camera positioned behind (-Y) and above the scene center
  private readonly cameraPosSubject = new BehaviorSubject<Vec3>([-111.62, -3.48, 37.96]);
  private readonly cameraTargetSubject = new BehaviorSubject<Vec3>([0, 0, 0]);
  private readonly independentCameraSubject = new BehaviorSubject<boolean>(false);

  // Advanced control knobs (FR-2.7–2.9, WP-2.2.2)
  private readonly advancedKnobsSubject = new BehaviorSubject<AdvancedKnobs>({
    encodingFormat: 'pillar',
    detectionHead: 'center',
    featureExtractor: '2d_cnn',
  });

  // Public observables for configuration controls
  public readonly scene$: Observable<SceneId> = this.sceneSubject.asObservable();
  public readonly voxelSize$: Observable<VoxelSize> = this.voxelSizeSubject.asObservable();
  public readonly contention$: Observable<number> = this.contentionSubject.pipe(
    debounceTime(80),
    distinctUntilChanged(),
    shareReplay(1)
  );
  public readonly sloMs$: Observable<number> = this.sloMsSubject.pipe(
    debounceTime(80),
    distinctUntilChanged(),
    shareReplay(1)
  );

  // Public observables for other state
  public readonly activeBranch$: Observable<string> = this.activeBranchSubject.asObservable();
  public readonly baselineBranch$: Observable<string> = this.baselineBranchSubject.asObservable();
  public readonly availableBranches$: Observable<string[]> = this.availableBranchesSubject.asObservable();
  public readonly scoreThreshold$: Observable<number> = this.scoreThresholdSubject.asObservable();
  public readonly labelMask$: Observable<DetectionClass[] | null> = this.labelMaskSubject.asObservable();
  public readonly diffMode$: Observable<DiffMode> = this.diffModeSubject.asObservable();
  public readonly delaySimulation$: Observable<{
    enabled: boolean;
    initial: number;
    growth: number;
    max: number;
  }> = this.delaySimulationSubject.asObservable();
  public readonly playbackSpeed$: Observable<number> = this.playbackSpeedSubject.asObservable();
  public readonly detectionFilters$: Observable<{
    scoreThreshold: number;
    labelMask: DetectionClass[] | null;
  }> = combineLatest([this.scoreThresholdSubject, this.labelMaskSubject]).pipe(
    map(([scoreThreshold, labelMask]) => ({ scoreThreshold, labelMask })),
    distinctUntilChanged(
      (a, b) =>
        a.scoreThreshold === b.scoreThreshold &&
        arraysEqual(a.labelMask ?? [], b.labelMask ?? [])
    ),
    shareReplay(1)
  );
  public readonly cameraPos$ = this.cameraPosSubject;
  public readonly cameraTarget$ = this.cameraTargetSubject;
  public readonly independentCamera$: Observable<boolean> =
    this.independentCameraSubject.asObservable();

  /**
   * Advanced control knobs for AGILE3D branch selection.
   * Provides fine-grained control over encoding format, detection head, and feature extractor.
   * Uses distinctUntilChanged with deep equality to prevent redundant emissions.
   *
   * @see PRD FR-2.8 (Advanced control options)
   * @see WP-2.2.2 (Advanced Controls implementation)
   */
  public readonly advancedKnobs$: Observable<AdvancedKnobs> = this.advancedKnobsSubject.pipe(
    distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
    shareReplay(1)
  );

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

  /** Update latency SLO in milliseconds (1-500), clamped (UI enforces 100+). */
  public setSlo(ms: number): void {
    const clamped = clamp(ms, 1, 500);
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

  /** Update baseline branch selection. */
  public setBaselineBranch(value: string): void {
    if (this.baselineBranchSubject.value !== value) this.baselineBranchSubject.next(value);
  }

  /** Update available branches and reconcile current selections. */
  public setAvailableBranches(
    branches: string[],
    defaults?: { baseline?: string; active?: string }
  ): void {
    console.log('[StateService] setAvailableBranches called with:', { branches, defaults });
    const normalized = uniqueOrdered(branches);
    const current = this.availableBranchesSubject.value;
    if (!arraysEqual(current, normalized)) {
      this.availableBranchesSubject.next(normalized);
    }

    if (normalized.length === 0) {
      return;
    }

    const desiredActive = this.pickActiveBranch(normalized, defaults?.active);
    if (desiredActive && this.activeBranchSubject.value !== desiredActive) {
      this.activeBranchSubject.next(desiredActive);
    } else if (!normalized.includes(this.activeBranchSubject.value)) {
      const fallbackActive = normalized[0];
      if (fallbackActive) {
        this.activeBranchSubject.next(fallbackActive);
      }
    }

    const desiredBaseline = this.pickBaselineBranch(normalized, defaults?.baseline);
    console.log('[StateService] desiredBaseline from pickBaselineBranch:', desiredBaseline);
    console.log('[StateService] current baselineBranchSubject.value:', this.baselineBranchSubject.value);

    // Special handling: Keep DSVT_Voxel_020 as baseline even if not in sequence manifest
    // (it's used for metrics/display, frame detections will gracefully fall back)
    const isPreferredVoxel020 = defaults?.baseline === 'DSVT_Voxel_020';
    const currentIsVoxel020 = this.baselineBranchSubject.value === 'DSVT_Voxel_020';

    if (isPreferredVoxel020 || currentIsVoxel020) {
      console.log('[StateService] Keeping DSVT_Voxel_020 as baseline (preferred for metrics)');
      if (this.baselineBranchSubject.value !== 'DSVT_Voxel_020') {
        this.baselineBranchSubject.next('DSVT_Voxel_020');
      }
    } else if (desiredBaseline && this.baselineBranchSubject.value !== desiredBaseline) {
      console.log('[StateService] Setting baseline to desiredBaseline:', desiredBaseline);
      this.baselineBranchSubject.next(desiredBaseline);
    } else if (!normalized.includes(this.baselineBranchSubject.value)) {
      const fallbackBaseline = normalized[0];
      console.log('[StateService] Current baseline not in list, using fallback:', fallbackBaseline);
      if (fallbackBaseline) {
        this.baselineBranchSubject.next(fallbackBaseline);
      }
    } else {
      console.log('[StateService] Keeping current baseline:', this.baselineBranchSubject.value);
    }
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
   * Set independent camera mode.
   * When true, each viewer controls its camera independently.
   * When false (default), cameras are synchronized across viewers.
   */
  public setIndependentCamera(value: boolean): void {
    if (this.independentCameraSubject.value !== value) this.independentCameraSubject.next(value);
  }

  public setScoreThreshold(value: number): void {
    if (this.scoreThresholdSubject.value !== value) {
      this.scoreThresholdSubject.next(value);
    }
  }

  public setLabelMask(mask: DetectionClass[] | null): void {
    if (mask === null) {
      if (this.labelMaskSubject.value !== null) {
        this.labelMaskSubject.next(null);
      }
      return;
    }
    const normalized = uniqueOrdered(mask) as DetectionClass[];
    if (!arraysEqual(this.labelMaskSubject.value ?? [], normalized)) {
      this.labelMaskSubject.next(normalized);
    }
  }

  public setDetectionFilters(config: {
    scoreThreshold?: number;
    labelMask?: DetectionClass[] | null;
  }): void {
    if (typeof config.scoreThreshold === 'number') {
      this.setScoreThreshold(config.scoreThreshold);
    }
    if (config.labelMask !== undefined) {
      this.setLabelMask(config.labelMask);
    }
  }

  public setDiffMode(mode: DiffMode): void {
    if (this.diffModeSubject.value !== mode) {
      this.diffModeSubject.next(mode);
    }
  }

  public setDelaySimulation(config: {
    enabled: boolean;
    initial?: number;
    growth?: number;
    max?: number;
  }): void {
    const current = this.delaySimulationSubject.value;
    const next = {
      enabled: config.enabled,
      initial: config.initial ?? current.initial,
      growth: config.growth ?? current.growth,
      max: config.max ?? current.max,
    };
    if (
      current.enabled !== next.enabled ||
      current.initial !== next.initial ||
      current.growth !== next.growth ||
      current.max !== next.max
    ) {
      this.delaySimulationSubject.next(next);
    }
  }

  public setPlaybackSpeed(speed: number): void {
    const clamped = clamp(speed, 0.25, 4.0);
    if (this.playbackSpeedSubject.value !== clamped) {
      this.playbackSpeedSubject.next(clamped);
    }
  }

  private pickActiveBranch(branches: string[], preferred?: string): string | undefined {
    if (preferred && branches.includes(preferred)) {
      return preferred;
    }
    const agileCandidate = branches.find((branch) => branch.startsWith('CP_'));
    return agileCandidate ?? branches[0];
  }

  private pickBaselineBranch(branches: string[], preferred?: string): string | undefined {
    console.log('[StateService] pickBaselineBranch - available branches:', branches);
    console.log('[StateService] pickBaselineBranch - preferred baseline:', preferred);

    // 1. If preferred baseline exists in branches, use it
    if (preferred && branches.includes(preferred)) {
      console.log('[StateService] pickBaselineBranch - using preferred:', preferred);
      return preferred;
    }

    // 2. If preferred is DSVT_Voxel_020 but not in list, try generic DSVT_Voxel
    if (preferred === 'DSVT_Voxel_020') {
      const voxelGeneric = branches.find((branch) => branch === 'DSVT_Voxel');
      if (voxelGeneric) {
        console.log('[StateService] pickBaselineBranch - using DSVT_Voxel fallback:', voxelGeneric);
        return voxelGeneric;
      }
      console.log('[StateService] pickBaselineBranch - DSVT_Voxel not found, using first DSVT');
    }

    // 3. Fall back to first DSVT branch
    const baselineCandidate = branches.find((branch) => branch.startsWith('DSVT'));
    const selected = baselineCandidate ?? branches[0];
    console.log('[StateService] pickBaselineBranch - selected baseline:', selected);
    return selected;
  }

  /**
   * Update advanced control knobs.
   * Uses deep equality comparison to prevent redundant state emissions.
   * Only emits if the new knobs differ from the current state.
   *
   * @param knobs - New advanced knobs configuration
   * @see PRD FR-2.8 (Advanced control options)
   * @see WP-2.2.2 (Advanced Controls implementation)
   */
  public setAdvancedKnobs(knobs: AdvancedKnobs): void {
    const current = this.advancedKnobsSubject.value;
    const changed =
      current.encodingFormat !== knobs.encodingFormat ||
      current.detectionHead !== knobs.detectionHead ||
      current.featureExtractor !== knobs.featureExtractor;

    if (changed) {
      this.advancedKnobsSubject.next(knobs);
    }
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
    this.baselineBranchSubject.complete();
    this.availableBranchesSubject.complete();
    this.cameraPosSubject.complete();
    this.cameraTargetSubject.complete();
    this.independentCameraSubject.complete();
    this.advancedKnobsSubject.complete();
    this.scoreThresholdSubject.complete();
    this.labelMaskSubject.complete();
    this.diffModeSubject.complete();
    this.delaySimulationSubject.complete();
    this.playbackSpeedSubject.complete();
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function vec3Equal(a: Vec3, b: Vec3): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

function uniqueOrdered(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  values.forEach((value) => {
    if (!seen.has(value)) {
      seen.add(value);
      result.push(value);
    }
  });
  return result;
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
