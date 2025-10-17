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
      <!-- Baseline Viewer Region (NFR-3.3, NFR-3.4) -->
      <section class="viewer-panel" role="region" aria-labelledby="baseline-viewer-label">
        <h2 id="baseline-viewer-label" class="viewer-label">DSVT-Voxel (Baseline)</h2>
        <app-scene-viewer
          viewerId="baseline"
          [sharedPointGeometry]="inputGeometry || sharedGeometry"
          [detections]="baselineDetections"
          [showFps]="showFps"
        />
      </section>
      <!-- AGILE3D Viewer Region (NFR-3.3, NFR-3.4) -->
      <section class="viewer-panel" role="region" aria-labelledby="agile3d-viewer-label">
        <h2 id="agile3d-viewer-label" class="viewer-label">AGILE3D</h2>
        <app-scene-viewer
          viewerId="agile3d"
          [sharedPointGeometry]="inputGeometry || sharedGeometry"
          [detections]="agile3dDetections"
          [showFps]="showFps"
        />
      </section>
    </div>
  `,
  styles: [
    `
      :host {
        display: flex;
        width: 90%;
        height: 100%;
        margin: 0 auto;
        box-sizing: border-box;
      }

      .dual-viewer-container {
        display: flex;
        width: 100%;
        height: 100%;
        gap: 1%;
        background: #1a1a1a;
      }

      .viewer-panel {
        flex: 1;
        display: flex;
        flex-direction: column;
        position: relative;
        min-width: 0;
        max-width: 49.5%;
      }

      .viewer-label {
        position: absolute;
        top: 40px;
        left: 10px;
        background: rgba(0, 0, 0, 0.8);
        color: #fff;
        padding: 6px 12px;
        margin: 0; /* Reset h2 default margin */
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

      /* Responsive breakpoints */
      /* Tablet breakpoint - Stack viewers at 1024x768 per PRD UI §8.1.2 */
      @media (max-width: 1024px) {
        :host {
          width: 95%;
        }

        .dual-viewer-container {
          flex-direction: column;
          gap: 12px;
        }

        .viewer-panel {
          max-width: 100%;
          height: 350px; /* Adjusted for ~768px tall displays */
        }
      }

      /* Mobile optimization */
      @media (max-width: 768px) {
        :host {
          width: 100%;
        }

        .viewer-panel {
          height: 400px;
        }
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

  /** Optional externally provided shared point geometry (from SceneDataService) */
  @Input() public inputGeometry?: THREE.BufferGeometry;

  /** Show FPS overlay on both viewers */
  @Input() public showFps = true;

  /** Shared point cloud geometry for both viewers (created on init) */
  protected sharedGeometry!: THREE.BufferGeometry;

  public ngOnInit(): void {
    // Use externally provided geometry if available; otherwise create synthetic
    this.sharedGeometry = this.inputGeometry ?? this.createSharedPointCloud(this.pointCount);
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
