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

import { Component, ChangeDetectionStrategy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DualViewerComponent } from '../dual-viewer/dual-viewer.component';
import * as THREE from 'three';
import { SceneDataService } from '../../core/services/data/scene-data.service';
import { SceneTierManagerService } from '../../core/services/data/scene-tier-manager.service';
import { Detection, SceneMetadata } from '../../core/models/scene.models';

@Component({
  selector: 'app-main-demo',
  standalone: true,
  imports: [CommonModule, DualViewerComponent],
  templateUrl: './main-demo.component.html',
  styleUrls: ['./main-demo.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainDemoComponent implements OnInit {
  private readonly sceneData = inject(SceneDataService);
  private readonly tierManager = inject(SceneTierManagerService);

  protected sharedGeometry?: THREE.BufferGeometry;
  protected baselineDetections: Detection[] = [];
  protected agile3dDetections: Detection[] = [];

  protected readonly loading = signal<boolean>(true);
  protected readonly loadError = signal<string | null>(null);

  public async ngOnInit(): Promise<void> {
    await this.loadInitialScene();
  }

  private async loadInitialScene(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);

    try {
      // Choose a scene: prefer registry first entry; fallback to 'test_scene_01'
      let sceneId = 'test_scene_01';
      try {
        const registry = await this.sceneData.loadRegistry();
        if (registry.scenes.length > 0) {
          sceneId = registry.scenes[0]!.scene_id;
        }
      } catch {
        // Registry optional; proceed with default
      }

      const metadata = await this.sceneData.loadMetadata(sceneId);
      await this.loadSceneFromMetadata(metadata);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      this.loadError.set(msg);
    } finally {
      this.loading.set(false);
    }
  }

  private async loadSceneFromMetadata(meta: SceneMetadata): Promise<void> {
    // Resolve tier-aware path and cache key
    const binPath = this.tierManager.getTierPath(meta.pointsBin);
    const cacheKey = this.tierManager.getCacheKey(meta.scene_id);

    const positions = await this.sceneData.loadPoints(binPath, cacheKey, meta.pointStride);

    // Build THREE.BufferGeometry
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, meta.pointStride));
    this.sharedGeometry = geometry;

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
  }
}
