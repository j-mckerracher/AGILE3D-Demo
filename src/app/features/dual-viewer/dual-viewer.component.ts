import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SceneViewerComponent } from '../scene-viewer/scene-viewer.component';
import { Detection } from '../../core/models/scene.models';
import * as THREE from 'three';

/**
 * DualViewer displays two synchronized SceneViewer instances side-by-side.
 * Features:
 * - Two viewers ('baseline' and 'agile3d') with synchronized cameras via StateService
 * - Shared point cloud geometry for memory efficiency
 * - Optional per-viewer detections for comparison
 *
 * Camera synchronization is automatic via CameraControlService attached in each SceneViewer.
 *
 * @example
 * <app-dual-viewer
 *   [baselineDetections]="baselineDetections"
 *   [agile3dDetections]="agile3dDetections"
 * />
 */
@Component({
  selector: 'app-dual-viewer',
  standalone: true,
  imports: [CommonModule, SceneViewerComponent],
  template: `
    <div class="dual-viewer-container">
      <div class="viewer-panel">
        <div class="viewer-label">DSVT-Voxel (Baseline)</div>
        <app-scene-viewer
          viewerId="baseline"
          [sharedPointGeometry]="sharedGeometry"
          [detections]="baselineDetections"
          [showFps]="showFps"
        />
      </div>
      <div class="viewer-panel">
        <div class="viewer-label">AGILE3D</div>
        <app-scene-viewer
          viewerId="agile3d"
          [sharedPointGeometry]="sharedGeometry"
          [detections]="agile3dDetections"
          [showFps]="showFps"
        />
      </div>
    </div>
  `,
  styles: [
    `
      .dual-viewer-container {
        display: flex;
        width: 100%;
        height: 100%;
        gap: 2px;
        background: #1a1a1a;
      }

      .viewer-panel {
        flex: 1;
        display: flex;
        flex-direction: column;
        position: relative;
        min-width: 0;
      }

      .viewer-label {
        position: absolute;
        top: 40px;
        left: 10px;
        background: rgba(0, 0, 0, 0.8);
        color: #fff;
        padding: 6px 12px;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: 14px;
        font-weight: 600;
        z-index: 1001;
        border-radius: 3px;
        border-left: 3px solid #4a9eff;
      }

      app-scene-viewer {
        flex: 1;
        display: block;
      }
    `,
  ],
})
export class DualViewerComponent implements OnInit {
  /** Detections to display in the baseline viewer */
  @Input() public baselineDetections: Detection[] = [];

  /** Detections to display in the AGILE3D viewer */
  @Input() public agile3dDetections: Detection[] = [];

  /** Number of points in synthetic point cloud (default 50k) */
  @Input() public pointCount = 50_000;

  /** Show FPS overlay on both viewers */
  @Input() public showFps = true;

  /** Shared point cloud geometry for both viewers (created on init) */
  protected sharedGeometry!: THREE.BufferGeometry;

  public ngOnInit(): void {
    // Create shared synthetic point cloud for both viewers
    this.sharedGeometry = this.createSharedPointCloud(this.pointCount);
  }

  /**
   * Create a single shared BufferGeometry for both viewers.
   * This ensures memory efficiency and consistent point cloud across views.
   */
  private createSharedPointCloud(count: number): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);

    // Generate random points in a 20x20x5 volume
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * 20; // x: -10 to 10
      positions[i3 + 1] = (Math.random() - 0.5) * 20; // y: -10 to 10
      positions[i3 + 2] = Math.random() * 5; // z: 0 to 5
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geometry;
  }
}
