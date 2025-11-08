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
import { SequenceDataService } from '../../core/services/data/sequence-data.service';
import { FrameStreamService } from '../../core/services/frame-stream/frame-stream.service';

/**
 * Mapping from SceneId to sequence identifiers.
 * Used for dynamic scene switching via control panel.
 */
const SCENE_TO_SEQUENCE: Record<SceneId, string> = {
  'vehicle-heavy': 'v_1784_1828',
  'pedestrian-heavy': 'p_7513_7557',
  'mixed': 'c_7910_7954',
};

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
  private readonly sequenceData = inject(SequenceDataService);
  private readonly frameStream = inject(FrameStreamService);

  private readonly destroy$ = new Subject<void>();
  private currentMetadata?: SceneMetadata;
  private branchConfigs: Map<string, any> = new Map(); // Cache for branch configs
  private rawBaselineDetections: Detection[] = []; // Store raw baseline for reprocessing
  private currentContentionPct: number = 38; // Track current contention for baseline updates
  private isSequenceMode = false; // Track if we're in sequence playback mode
  private firstFrameLogged = false; // Track if we've logged first frame bounds
  private currentSequenceId: string = ''; // Track active sequence for scene switching

  protected sharedPoints?: THREE.Points;
  protected baselineDetections: Detection[] = [];
  protected agile3dDetections: Detection[] = [];
  protected baselineDiffClassification?: Map<string, 'tp' | 'fp' | 'fn'>; // TP/FP map for baseline
  protected agile3dDiffClassification?: Map<string, 'tp' | 'fp' | 'fn'>;
  protected leftTitle: string = 'Baseline';
  protected rightTitle: string = 'AGILE3D';

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

    // Sequence mode is now the default
    // Use query param to select initial sequence, default to v_1784_1828
    const seqId = this.debug.getQueryParam('sequence') || 'v_1784_1828';
    console.log('[MainDemo] Sequence mode enabled:', seqId);
    this.isSequenceMode = true;
    await this.loadSequence(seqId);

    // Subscribe to scene changes for dynamic sequence switching
    this.stateService.scene$
      .pipe(
        distinctUntilChanged(),
        debounceTime(100), // Debounce rapid clicks
        takeUntil(this.destroy$)
      )
      .subscribe((sceneId) => {
        const newSeqId = SCENE_TO_SEQUENCE[sceneId];
        if (newSeqId && newSeqId !== this.currentSequenceId) {
          console.log('[MainDemo] Scene changed:', sceneId, '→', newSeqId);
          this.loadSequence(newSeqId);
        }
      });
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
    
    if (this.isSequenceMode) {
      this.frameStream.stop();
    }
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

  /**
   * Load and start playback of a sequence.
   * Handles both initial load and dynamic scene switching.
   * Stops current playback, loads new manifest, and restarts streaming.
   */
  private async loadSequence(seqId: string): Promise<void> {
    // Stop current playback if switching sequences
    if (this.currentSequenceId && this.currentSequenceId !== seqId) {
      console.log('[MainDemo] Stopping current sequence:', this.currentSequenceId);
      this.frameStream.stop();
      this.firstFrameLogged = false; // Reset for new sequence
    }

    this.currentSequenceId = seqId;
    this.loading.set(true);
    this.loadError.set(null);
    this.showError.set(false);

    try {
      console.log('[MainDemo] Loading sequence manifest:', seqId);
      const manifest = await this.sequenceData.loadManifest(seqId);

      console.log('[MainDemo] Manifest loaded', {
        sequenceId: manifest.sequenceId,
        frameCount: manifest.frames.length,
        fps: manifest.fps,
      });

      // Compute max point count from manifest
      const maxPts = Math.max(...manifest.frames.map(f => f.pointCount || 0)) || 200000;
      console.log('[MainDemo] Max points:', maxPts);

      // Create shared Points instance for patch-in-place updates
      this.sharedPoints = this.sceneData.ensureSharedPoints(maxPts, 3);
      console.log('[MainDemo] Shared Points created for sequence playback');

      // Subscribe to frame stream
      this.frameStream.currentFrame$
        .pipe(takeUntil(this.destroy$))
        .subscribe((streamedFrame) => {
          if (!streamedFrame) return;

          try {
            // Points are already parsed as Float32Array from frame stream
            const positions = streamedFrame.points;
            
            if (!this.firstFrameLogged) {
              // Compute bounds safely without spreading huge arrays
              let minX = Infinity, minY = Infinity, minZ = Infinity;
              let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
              for (let i = 0; i < positions.length; i += 3) {
                const x = positions[i]!;
                const y = positions[i + 1]!;
                const z = positions[i + 2]!;
                if (x < minX) minX = x; if (x > maxX) maxX = x;
                if (y < minY) minY = y; if (y > maxY) maxY = y;
                if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
              }

              // Log detailed bounds for first frame only
              console.log('[MainDemo] First frame received', {
                frameId: streamedFrame.frame.id,
                pointCount: positions.length / 3,
                gtDetections: streamedFrame.gt.length,
                firstPoint: [positions[0], positions[1], positions[2]],
                bounds: { minX, maxX, minY, maxY, minZ, maxZ }
              });
              this.firstFrameLogged = true;
            }
            
            // Update shared Points geometry
            if (this.sharedPoints) {
              this.sceneData.updatePointsAttribute(this.sharedPoints, positions);
            }

            // Update detections for viewers - both use predictions with TP/FP classification
            // Left pane: Baseline (DSVT) predictions
            if (streamedFrame.baseline?.det) {
              this.baselineDetections = streamedFrame.baseline.det;
              // Build classification map for baseline (TP/FP)
              const baselineFlags = streamedFrame.baseline.cls;
              const baselineDets = streamedFrame.baseline.det;
              const baselineMap = new Map<string, 'tp' | 'fp'>();
              for (let i = 0; i < baselineDets.length; i++) {
                const det = baselineDets[i];
                if (!det) continue;
                const isTP = baselineFlags?.[i] === true;
                baselineMap.set(det.id, isTP ? 'tp' : 'fp');
              }
              this.baselineDiffClassification = baselineMap;
            } else {
              // Fallback to GT if baseline not available (shouldn't happen)
              this.baselineDetections = streamedFrame.gt;
              this.baselineDiffClassification = undefined;
            }

            // Right pane: AGILE3D predictions
            if (streamedFrame.agile?.det) {
              this.agile3dDetections = streamedFrame.agile.det;
              // Build classification map for AGILE3D (TP/FP)
              const flags = streamedFrame.agile.cls;
              const dets = streamedFrame.agile.det;
              const map = new Map<string, 'tp' | 'fp'>();
              for (let i = 0; i < dets.length; i++) {
                const det = dets[i];
                if (!det) continue;
                const isTP = flags?.[i] === true;
                map.set(det.id, isTP ? 'tp' : 'fp');
              }
              this.agile3dDiffClassification = map;
            } else {
              this.agile3dDetections = streamedFrame.det ?? streamedFrame.gt;
              this.agile3dDiffClassification = undefined;
            }

            // Update viewer titles with branch names
            this.leftTitle = `Baseline (${this.frameStream.baselineBranch})`;
            this.rightTitle = `AGILE3D (${this.frameStream.activeBranch})`;

            this.cdr.markForCheck();
          } catch (err) {
            console.error('[MainDemo] Frame processing error:', err);
          }
        });

      // Subscribe to stream errors
      this.frameStream.errors$
        .pipe(takeUntil(this.destroy$))
        .subscribe((error) => {
          if (error) {
            this.loadError.set(error);
            this.showError.set(true);
            this.cdr.markForCheck();
          }
        });

      // Start streaming
      this.frameStream.start(manifest, {
        fps: manifest.fps || 10,
        prefetch: 2,
        loop: true,
      });

      console.log('[MainDemo] Frame stream started');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error loading sequence';
      console.error('[MainDemo] initSequenceMode error:', msg);
      this.loadError.set(msg);
      this.showError.set(true);
    } finally {
      this.loading.set(false);
      this.cdr.markForCheck();
    }
  }
}
