/**
 * Main Demo Component
 *
 * Main container component that orchestrates the dual viewer, control panel,
 * and metrics dashboard sections. Implements responsive layout with CSS Grid.
 *
 * PRD References:
 * - UI §8.1: Layout Structure
 * - NFR-3.3: Clear visual hierarchy
 * - NFR-3.4: Keyboard navigation support
 */

import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  OnDestroy,
  inject,
  signal,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, firstValueFrom } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { DualViewerComponent } from '../dual-viewer/dual-viewer.component';
import { ControlPanelComponent } from '../control-panel/control-panel.component';
import { MetricsDashboardComponent } from '../metrics-dashboard/metrics-dashboard.component';
import { ErrorBannerComponent } from '../../shared/components/error-banner/error-banner.component';
import * as THREE from 'three';
import { SceneDataService } from '../../core/services/data/scene-data.service';
import { SceneTierManagerService } from '../../core/services/data/scene-tier-manager.service';
import { DebugService } from '../../core/services/runtime/debug.service';
import { CapabilityService } from '../../core/services/runtime/capability.service';
import {
  InstrumentationService,
  SceneToken,
} from '../../core/services/runtime/instrumentation.service';
import { Detection, SceneMetadata } from '../../core/models/scene.models';
import { SimulationService } from '../../core/services/simulation/simulation.service';
import { StateService } from '../../core/services/state/state.service';
import { SceneId } from '../../core/models/config-and-metrics';
import { SyntheticDetectionVariationService } from '../../core/services/simulation/synthetic-detection-variation.service';
import { PaperDataService } from '../../core/services/data/paper-data.service';

@Component({
  selector: 'app-main-demo',
  standalone: true,
  imports: [
    CommonModule,
    DualViewerComponent,
    ControlPanelComponent,
    MetricsDashboardComponent,
    ErrorBannerComponent,
  ],
  templateUrl: './main-demo.component.html',
  styleUrls: ['./main-demo.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainDemoComponent implements OnInit, OnDestroy {
  private readonly sceneData = inject(SceneDataService);
  private readonly tierManager = inject(SceneTierManagerService);
  private readonly debug = inject(DebugService);
  private readonly capability = inject(CapabilityService);
  private readonly instrument = inject(InstrumentationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly simulationService = inject(SimulationService);
  private readonly stateService = inject(StateService);
  private readonly detectionVariation = inject(SyntheticDetectionVariationService);
  private readonly paperData = inject(PaperDataService);

  private readonly destroy$ = new Subject<void>();
  private currentMetadata?: SceneMetadata;
  private branchConfigs: Map<string, any> = new Map(); // Cache for branch configs
  private rawBaselineDetections: Detection[] = []; // Store raw baseline for reprocessing
  private currentContentionPct: number = 38; // Track current contention for baseline updates

  protected sharedPoints?: THREE.Points;
  protected baselineDetections: Detection[] = [];
  protected agile3dDetections: Detection[] = [];

  protected readonly loading = signal<boolean>(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly showError = signal<boolean>(false);
  protected showFps = false;

  public async ngOnInit(): Promise<void> {
    // Check debug mode for FPS overlay (WP-2.3.2)
    this.showFps = this.debug.isDebugEnabled();

    // Check WebGL2 support (WP-2.3.2, NFR-2.5)
    if (!this.capability.checkWebGL2Support()) {
      this.loadError.set('WebGL 2.0 is required but not available in your browser.');
      this.showError.set(true);
      this.loading.set(false);
      this.cdr.markForCheck();
      return;
    }

    // Handle tier QA hook (WP-2.3.2)
    const tierParam = this.debug.getQueryParam('tier');
    if (tierParam === 'fallback') {
      console.log('[MainDemo] QA Hook: tier=fallback - disabling auto tier');
      this.tierManager.setAutoTierEnabled(false);
      this.tierManager.setTier('fallback');
    }

    // Load branch configurations for synthetic detection variations
    // This is needed because scene metadata only has one AGILE3D prediction set
    await this.loadBranchConfigs();

    // Subscribe to scene changes for reactive scene switching
    this.stateService.scene$
      .pipe(takeUntil(this.destroy$))
      .subscribe((sceneId) => {
        console.log('[MainDemo] Scene changed:', sceneId);
        this.loadScene(sceneId);
      });

    // Subscribe to branch changes for reactive AGILE3D detection updates
    this.simulationService.activeBranch$
      .pipe(
        debounceTime(100),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe((branchId) => {
        console.log('[MainDemo] Branch changed:', branchId);
        this.updateAgileDetections(branchId);
      });

    // Subscribe to system parameter changes for reactive BASELINE detection updates
    // Baseline performance varies with voxel size and contention even though it's a fixed algorithm
    this.stateService.currentParams$
      .pipe(
        debounceTime(100),
        distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
        takeUntil(this.destroy$)
      )
      .subscribe((params) => {
        console.log('[MainDemo] System params changed:', params);
        this.currentContentionPct = params.contentionPct; // Store for use in variations
        this.updateBaselineDetectionsFromParams(params.voxelSize, params.contentionPct);
      });

    // Load initial scene with instrumentation (WP-2.3.2, NFR-1.8)
    // Note: This will be triggered by the scene$ subscription above
    // but we need to ensure it happens after subscriptions are set up
    await this.loadScene(this.stateService.currentScene$.value);
  }

  /**
   * Load branch configurations from PaperDataService for synthetic variations.
   * Cache them in a Map for fast lookup during detection updates.
   */
  private async loadBranchConfigs(): Promise<void> {
    try {
      const branches = await firstValueFrom(this.paperData.getBranches());
      if (branches) {
        branches.forEach((branch) => {
          this.branchConfigs.set(branch.branch_id, branch);
        });
        console.log('[MainDemo] Loaded branch configs:', this.branchConfigs.size);
      }
    } catch (err) {
      console.warn('[MainDemo] Failed to load branch configs:', err);
    }
  }

  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Load a scene by its SceneId.
   * Maps SceneId to actual file ID, loads metadata and point cloud,
   * and updates detections for both baseline and AGILE3D.
   */
  private async loadScene(sceneId: SceneId): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    this.showError.set(false);

    // Begin instrumentation (WP-2.3.2, NFR-1.8)
    const token: SceneToken = this.instrument.beginSceneSwitch(sceneId);

    try {
      // Map SceneId to actual scene file ID
      const fileId = this.mapSceneIdToFileId(sceneId);
      console.log('[MainDemo] Loading scene:', sceneId, '→', fileId);

      // Load scene metadata
      const metadata = await this.sceneData.loadMetadata(fileId);
      this.currentMetadata = metadata;

      // Mark data loaded for instrumentation
      this.instrument.markDataLoaded(token);

      console.log('[MainDemo] metadata', {
        scene_id: metadata.scene_id,
        pointsBin: metadata.pointsBin,
        stride: metadata.pointStride,
      });

      // Resolve tier-aware path and cache key
      const binPath = this.tierManager.getTierPath(metadata.pointsBin);
      const cacheKey = this.tierManager.getCacheKey(metadata.scene_id);
      console.log('[MainDemo] resolved bin', { binPath, cacheKey });

      // Load THREE.Points instance from SceneDataService (WP-2.1.1)
      // This ensures a single shared Points instance across all viewers
      this.sharedPoints = await this.sceneData.loadPointsObject(
        binPath,
        cacheKey,
        metadata.pointStride
      );
      console.log('[MainDemo] sharedPoints loaded', {
        geometry: this.sharedPoints.geometry.uuid,
        vertices: this.sharedPoints.geometry.getAttribute('position')?.count ?? 0,
      });

      // Load baseline detections (DSVT_Voxel) and apply variations based on current system parameters
      // Even though baseline is a fixed algorithm, its performance varies with voxel size/contention
      const baseDetections = metadata.predictions['DSVT_Voxel'] ?? metadata.ground_truth ?? [];

      // Get current voxel size from state (use scene default if not yet set)
      const currentVoxelSize = 0.32; // Default voxel size, will be updated by params$ subscription
      this.updateBaselineDetections(baseDetections, currentVoxelSize);

      // Load AGILE3D detections - use optimal branch from metadata as initial value
      // The activeBranch$ subscription will update this to the correct branch
      const initialBranch = metadata.metadata?.optimalBranch ?? 'CP_Pillar_032';
      this.updateAgileDetectionsFromMetadata(initialBranch, metadata);

      console.log('[MainDemo] detections loaded', {
        baseline: this.baselineDetections.length,
        agile3d: this.agile3dDetections.length,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error loading scene data';
      console.error('[MainDemo] loadScene error', msg);
      this.loadError.set(msg);
      this.showError.set(true);
    } finally {
      this.loading.set(false);
      // End instrumentation (WP-2.3.2, NFR-1.8)
      this.instrument.endSceneSwitch(token);
      this.cdr.markForCheck();
    }
  }

  /**
   * Update AGILE3D detections when active branch changes.
   * Uses the current scene metadata to look up branch-specific detections.
   */
  private updateAgileDetections(branchId: string): void {
    if (!this.currentMetadata) {
      console.warn('[MainDemo] Cannot update detections: no metadata loaded');
      return;
    }

    this.updateAgileDetectionsFromMetadata(branchId, this.currentMetadata);
    this.cdr.markForCheck();
  }

  /**
   * Update baseline detections from raw detections stored during scene load.
   * Called initially when scene loads.
   */
  private updateBaselineDetections(rawDetections: Detection[], voxelSize: number): void {
    this.rawBaselineDetections = rawDetections;

    // Apply variations using specified voxel size and current contention
    this.updateBaselineDetectionsFromParams(voxelSize, this.currentContentionPct);
  }

  /**
   * Update baseline detections when system parameters change.
   * Applies synthetic variations to raw baseline detections using a synthetic
   * DSVT-Voxel configuration at the specified voxel size and contention.
   *
   * WHY: Even though DSVT-Voxel is a "fixed" baseline algorithm, its performance
   * and detection characteristics vary when run at different voxel sizes and
   * under different GPU resource contention levels.
   *
   * - Voxel size: Affects spatial resolution (larger voxels = coarser detection)
   * - Contention: Affects reliability (higher contention = missed detections, lower confidence)
   *
   * This makes the demo more realistic: both algorithms degrade with worse conditions,
   * but AGILE3D adapts better to maintain performance.
   */
  private updateBaselineDetectionsFromParams(voxelSize: number, contentionPct: number): void {
    if (!this.rawBaselineDetections || this.rawBaselineDetections.length === 0) {
      return;
    }

    // Create a synthetic DSVT-Voxel branch config at the current voxel size
    // DSVT-Voxel characteristics: voxel encoding, transformer extractor, anchor-based head
    const syntheticBaselineConfig: any = {
      branch_id: 'DSVT_Voxel_Synthetic',
      name: 'DSVT-Voxel (Baseline)',
      modelFamily: 'DSVT',
      controlKnobs: {
        encodingFormat: 'voxel' as const,
        spatialResolution: voxelSize, // Use current slider value
        spatialEncoding: 'HV' as const,
        featureExtractor: 'transformer' as const,
        detectionHead: 'anchor' as const,
      },
      performance: {
        // Performance data not needed for synthetic variations
        memoryFootprint: 0,
        latency: {} as any,
        accuracy: {} as any,
      },
    };

    // Apply synthetic variations including contention effects
    this.baselineDetections = this.detectionVariation.applyBranchVariations(
      this.rawBaselineDetections,
      syntheticBaselineConfig,
      contentionPct // Pass contention to show reliability degradation
    );

    console.log('[MainDemo] Baseline detections updated with synthetic variations', {
      voxelSize,
      contentionPct,
      baseCount: this.rawBaselineDetections.length,
      variedCount: this.baselineDetections.length,
    });

    this.cdr.markForCheck();
  }

  /**
   * Helper to update AGILE3D detections from metadata for a given branch.
   *
   * IMPORTANT: This method applies SYNTHETIC VARIATIONS to create branch-specific detections.
   *
   * WHY: Scene metadata files only contain ONE set of AGILE3D predictions (typically
   * AGILE3D_CP_Pillar_032). When users adjust voxel size or contention, the SimulationService
   * correctly selects different branches (e.g., CP_Pillar_064), but we need to generate
   * realistic detection variations for those branches to make parameter changes visually
   * perceivable.
   *
   * HOW: We use SyntheticDetectionVariationService to apply deterministic transformations
   * based on branch characteristics (voxel size, encoding format, feature extractor).
   * These transformations simulate realistic differences that would occur in actual
   * 3D object detection pipelines.
   *
   * See synthetic-detection-variation.service.ts for detailed documentation on the
   * variation algorithms and their realistic basis.
   */
  private updateAgileDetectionsFromMetadata(branchId: string, metadata: SceneMetadata): void {
    // Step 1: Get base detections from metadata
    // ==========================================
    // Scene metadata typically only has one AGILE3D prediction set.
    // We'll use this as the base and apply branch-specific variations.

    const predictionKey = this.mapBranchIdToPredictionKey(branchId, metadata);

    let baseDetections = metadata.predictions[predictionKey];

    // Fallback chain if specific branch predictions not found
    if (!baseDetections) {
      baseDetections = metadata.predictions[branchId];
    }

    if (!baseDetections && metadata.metadata?.optimalBranch) {
      baseDetections = metadata.predictions[metadata.metadata.optimalBranch];
    }

    if (!baseDetections) {
      const firstOther = Object.entries(metadata.predictions).find(([k]) => k !== 'DSVT_Voxel');
      baseDetections = firstOther?.[1];
    }

    if (!baseDetections || baseDetections.length === 0) {
      console.warn('[MainDemo] No base detections found for branch', branchId);
      this.agile3dDetections = [];
      return;
    }

    // Step 2: Get branch configuration
    // =================================
    // Need the branch config to apply realistic variations based on:
    // - voxelSize: affects detection capability and precision
    // - encodingFormat: affects vertical (Z-axis) precision
    // - featureExtractor: affects confidence scores
    // - detectionHead: affects bounding box fitting

    const branchConfig = this.branchConfigs.get(branchId);

    if (!branchConfig) {
      // If no config found, use base detections without variations
      console.warn('[MainDemo] No branch config found for', branchId, '- using base detections');
      this.agile3dDetections = baseDetections;
    } else {
      // Step 3: Apply synthetic variations
      // ===================================
      // This creates a new array with modified detections that simulate
      // how this branch configuration would affect detection results.
      // Includes contention effects to show AGILE3D's resilience under pressure.

      this.agile3dDetections = this.detectionVariation.applyBranchVariations(
        baseDetections,
        branchConfig,
        this.currentContentionPct // Pass contention to show reliability
      );

      console.log('[MainDemo] AGILE3D detections with synthetic variations', {
        branchId,
        predictionKey,
        baseCount: baseDetections.length,
        variedCount: this.agile3dDetections.length,
        voxelSize: branchConfig.controlKnobs.spatialResolution,
        encoding: branchConfig.controlKnobs.encodingFormat,
        contentionPct: this.currentContentionPct,
      });
    }
  }

  /**
   * Map SceneId to actual scene file ID.
   */
  private mapSceneIdToFileId(sceneId: SceneId): string {
    const mapping: Record<SceneId, string> = {
      'vehicle-heavy': 'vehicle_heavy_01',
      'pedestrian-heavy': 'pedestrian_heavy_01',
      mixed: 'mixed_urban_01',
    };

    return mapping[sceneId] ?? 'mixed_urban_01';
  }

  /**
   * Map branch ID to prediction key in metadata.
   * Tries to intelligently match branch ID to available predictions.
   */
  private mapBranchIdToPredictionKey(branchId: string, metadata: SceneMetadata): string {
    // First try: AGILE3D_ prefix
    const withPrefix = `AGILE3D_${branchId}`;
    if (metadata.predictions[withPrefix]) {
      return withPrefix;
    }

    // Second try: exact match
    if (metadata.predictions[branchId]) {
      return branchId;
    }

    // Third try: find closest match by substring
    const predictionKeys = Object.keys(metadata.predictions);
    const match = predictionKeys.find(
      (key) => key.includes(branchId) || branchId.includes(key.replace('AGILE3D_', ''))
    );

    return match ?? branchId;
  }
}
