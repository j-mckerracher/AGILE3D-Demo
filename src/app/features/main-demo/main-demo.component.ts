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
import { Subject } from 'rxjs';
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

  private readonly destroy$ = new Subject<void>();
  private currentMetadata?: SceneMetadata;

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

    // Subscribe to scene changes for reactive scene switching
    this.stateService.scene$
      .pipe(takeUntil(this.destroy$))
      .subscribe((sceneId) => {
        console.log('[MainDemo] Scene changed:', sceneId);
        this.loadScene(sceneId);
      });

    // Subscribe to branch changes for reactive detection updates
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

    // Load initial scene with instrumentation (WP-2.3.2, NFR-1.8)
    // Note: This will be triggered by the scene$ subscription above
    // but we need to ensure it happens after subscriptions are set up
    await this.loadScene(this.stateService.currentScene$.value);
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

      // Load baseline detections (always DSVT_Voxel)
      this.baselineDetections = metadata.predictions['DSVT_Voxel'] ?? metadata.ground_truth ?? [];

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
   * Helper to update AGILE3D detections from metadata for a given branch.
   */
  private updateAgileDetectionsFromMetadata(branchId: string, metadata: SceneMetadata): void {
    // Map branch ID to metadata prediction key
    // SimulationService uses IDs like "CP_Pillar_032"
    // Metadata uses keys like "AGILE3D_CP_Pillar_032"
    const predictionKey = this.mapBranchIdToPredictionKey(branchId, metadata);

    let agileDetections = metadata.predictions[predictionKey];

    // Fallback: if not found, try without AGILE3D_ prefix
    if (!agileDetections) {
      agileDetections = metadata.predictions[branchId];
    }

    // Fallback: use optimal branch from metadata
    if (!agileDetections && metadata.metadata?.optimalBranch) {
      agileDetections = metadata.predictions[metadata.metadata.optimalBranch];
    }

    // Fallback: use first non-DSVT prediction
    if (!agileDetections) {
      const firstOther = Object.entries(metadata.predictions).find(([k]) => k !== 'DSVT_Voxel');
      agileDetections = firstOther?.[1];
    }

    this.agile3dDetections = agileDetections ?? [];
    console.log('[MainDemo] AGILE3D detections updated', {
      branchId,
      predictionKey,
      count: this.agile3dDetections.length,
    });
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
