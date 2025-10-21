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

import { Component, ChangeDetectionStrategy, OnInit, inject, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DualViewerComponent } from '../dual-viewer/dual-viewer.component';
import { ControlPanelComponent } from '../control-panel/control-panel.component';
import { MetricsDashboardComponent } from '../metrics-dashboard/metrics-dashboard.component';
import { ErrorBannerComponent } from '../../shared/components/error-banner/error-banner.component';
import * as THREE from 'three';
import { SceneDataService } from '../../core/services/data/scene-data.service';
import { SceneTierManagerService } from '../../core/services/data/scene-tier-manager.service';
import { DebugService } from '../../core/services/runtime/debug.service';
import { CapabilityService } from '../../core/services/runtime/capability.service';
import { InstrumentationService, SceneToken } from '../../core/services/runtime/instrumentation.service';
import { Detection, SceneMetadata } from '../../core/models/scene.models';

@Component({
  selector: 'app-main-demo',
  standalone: true,
  imports: [CommonModule, DualViewerComponent, ControlPanelComponent, MetricsDashboardComponent, ErrorBannerComponent],
  templateUrl: './main-demo.component.html',
  styleUrls: ['./main-demo.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainDemoComponent implements OnInit {
  private readonly sceneData = inject(SceneDataService);
  private readonly tierManager = inject(SceneTierManagerService);
  private readonly debug = inject(DebugService);
  private readonly capability = inject(CapabilityService);
  private readonly instrument = inject(InstrumentationService);
  private readonly cdr = inject(ChangeDetectorRef);

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

    // Load initial scene with instrumentation (WP-2.3.2, NFR-1.8)
    await this.loadInitialScene();
  }

  private async loadInitialScene(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    this.showError.set(false);

    // Begin instrumentation (WP-2.3.2, NFR-1.8)
    const token: SceneToken = this.instrument.beginSceneSwitch('initial');

    try {
      // Choose a scene: prefer registry first entry; fallback to 'test_scene_01'
      let sceneId = 'test_scene_01';
      try {
        const registry = await this.sceneData.loadRegistry();
        console.log('[MainDemo] registry loaded; scenes=', registry.scenes.length);
        if (registry.scenes.length > 0) {
          sceneId = registry.scenes[0]!.scene_id;
        }
      } catch (e) {
        console.warn('[MainDemo] loadRegistry failed; falling back to default id', e);
      }

      console.log('[MainDemo] loading metadata for', sceneId);
      const metadata = await this.sceneData.loadMetadata(sceneId);

      // Mark data loaded for instrumentation
      this.instrument.markDataLoaded(token);

      await this.loadSceneFromMetadata(metadata);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error loading scene data';
      console.error('[MainDemo] loadInitialScene error', msg);
      this.loadError.set(msg);
      this.showError.set(true);
    } finally {
      this.loading.set(false);
      // End instrumentation (WP-2.3.2, NFR-1.8)
      this.instrument.endSceneSwitch(token);
      this.cdr.markForCheck();
    }
  }

  private async loadSceneFromMetadata(meta: SceneMetadata): Promise<void> {
    console.log('[MainDemo] metadata', {
      scene_id: meta.scene_id,
      pointsBin: meta.pointsBin,
      stride: meta.pointStride,
    });

    // Resolve tier-aware path and cache key
    const binPath = this.tierManager.getTierPath(meta.pointsBin);
    const cacheKey = this.tierManager.getCacheKey(meta.scene_id);
    console.log('[MainDemo] resolved bin', { binPath, cacheKey });

    // Load THREE.Points instance from SceneDataService (WP-2.1.1)
    // This ensures a single shared Points instance across all viewers
    this.sharedPoints = await this.sceneData.loadPointsObject(binPath, cacheKey, meta.pointStride);
    console.log('[MainDemo] sharedPoints loaded', {
      geometry: this.sharedPoints.geometry.uuid,
      vertices: this.sharedPoints.geometry.getAttribute('position')?.count ?? 0,
    });

    // Select detections: baseline from DSVT_Voxel if present, else ground truth.
    const baseline = meta.predictions['DSVT_Voxel'] ?? meta.ground_truth ?? [];

    // AGILE3D detections: use optimalBranch if available, else first predictions entry not DSVT_Voxel
    const agBranch = meta.metadata?.optimalBranch;
    let agile: Detection[] | undefined = agBranch ? meta.predictions[agBranch] : undefined;
    if (!agile) {
      const firstOther = Object.entries(meta.predictions).find(([k]) => k !== 'DSVT_Voxel');
      agile = firstOther?.[1] ?? [];
    }

    this.baselineDetections = baseline;
    this.agile3dDetections = agile;
    console.log('[MainDemo] detections', {
      baseline: this.baselineDetections.length,
      agile3d: this.agile3dDetections.length,
    });

    // Notify OnPush change detection
    this.cdr.markForCheck();
  }
}
