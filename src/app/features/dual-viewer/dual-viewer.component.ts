import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SceneViewerComponent } from '../scene-viewer/scene-viewer.component';
import { CameraSyncControlsComponent } from '../camera-controls/camera-sync-controls.component';
import { Detection } from '../../core/models/scene.models';
import { DiffMode } from '../../core/services/visualization/bbox-instancing';
import * as THREE from 'three';

/**
 * DualViewer displays two synchronized SceneViewer instances side-by-side.
 *
 * Features (WP-2.1.1):
 * - Two viewers ('baseline' and 'agile3d') with synchronized cameras via StateService
 * - Shared point cloud geometry for memory efficiency (single GPU buffer)
 * - Optional per-viewer detections for comparison
 * - Scene switching crossfade transition ≤500ms
 *
 * Camera synchronization is automatic via CameraControlService attached in each SceneViewer.
 * Geometry is sourced from SceneDataService.loadPointsObject() to ensure a single shared instance.
 *
 * @example
 * <app-dual-viewer
 *   [inputPoints]="sharedPoints"
 *   [baselineDetections]="baselineDetections"
 *   [agile3dDetections]="agile3dDetections"
 * />
 *
 * @see WP-2.1.1 Dual Viewer Foundation (Shared Geometry)
 * @see SceneDataService.loadPointsObject
 */
@Component({
  selector: 'app-dual-viewer',
  standalone: true,
  imports: [CommonModule, SceneViewerComponent, CameraSyncControlsComponent],
  template: `
    <div class="dual-viewer-container">
      <!-- Baseline Viewer Region (NFR-3.3, NFR-3.4) -->
      <section
        class="viewer-panel"
        [class.active]="activeViewer === 'baseline'"
        [class.inactive]="activeViewer !== 'baseline'"
        role="region"
        aria-labelledby="baseline-viewer-label"
        [attr.aria-hidden]="activeViewer !== 'baseline'"
      >
        <h2 id="baseline-viewer-label" class="viewer-label">DSVT-Voxel (Baseline)</h2>
        <app-scene-viewer
          viewerId="baseline"
          [sharedPointGeometry]="sharedGeometry"
          [detections]="baselineDetections"
          [diffMode]="diffMode"
          [diffClassification]="baselineDiffClassification"
          [showFps]="showFps"
        />
      </section>

      <!-- Crossfade Toggle Button (WP-2.1.1) -->
      <button
        class="crossfade-toggle"
        type="button"
        (click)="toggleActiveViewer()"
        [disabled]="isTransitioning"
        [attr.aria-label]="'Switch to ' + (activeViewer === 'baseline' ? 'AGILE3D' : 'Baseline') + ' viewer'"
        [attr.aria-pressed]="activeViewer === 'agile3d'"
      >
        <span class="toggle-icon" aria-hidden="true">⇄</span>
        <span class="toggle-text">
          {{ activeViewer === 'baseline' ? 'Show AGILE3D' : 'Show Baseline' }}
        </span>
      </button>

      <!-- Camera Sync Controls (WP-2.1.3) -->
      <div class="camera-controls-container">
        <app-camera-sync-controls />
      </div>

      <!-- Ground Truth Toggle (Placeholder for future WP) -->
      <button
        class="gt-toggle"
        type="button"
        [disabled]="true"
        title="Ground Truth overlay (Coming soon)"
        aria-label="Toggle ground truth overlay (not yet implemented)"
      >
        <span class="toggle-icon" aria-hidden="true">GT</span>
        <span class="toggle-text">Ground Truth</span>
      </button>

      <!-- AGILE3D Viewer Region (NFR-3.3, NFR-3.4) -->
      <section
        class="viewer-panel"
        [class.active]="activeViewer === 'agile3d'"
        [class.inactive]="activeViewer !== 'agile3d'"
        role="region"
        aria-labelledby="agile3d-viewer-label"
        [attr.aria-hidden]="activeViewer !== 'agile3d'"
      >
        <h2 id="agile3d-viewer-label" class="viewer-label">AGILE3D</h2>
        <app-scene-viewer
          viewerId="agile3d"
          [sharedPointGeometry]="sharedGeometry"
          [detections]="agile3dDetections"
          [diffMode]="diffMode"
          [diffClassification]="agile3dDiffClassification"
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
        position: relative;
      }

      .viewer-panel {
        flex: 1;
        display: flex;
        flex-direction: column;
        position: relative;
        min-width: 0;
        max-width: 49.5%;
        opacity: 1;
        transition: opacity var(--ag3d-duration-slower, 500ms) var(--ag3d-easing-standard, ease);
      }

      /* Crossfade states (WP-2.1.1) */
      .viewer-panel.active {
        opacity: 1;
        pointer-events: auto;
      }

      .viewer-panel.inactive {
        opacity: 0.3;
        pointer-events: none;
      }

      /* Crossfade Toggle Button (WP-2.1.1) */
      .crossfade-toggle {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 1002;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        padding: 12px 20px;
        background: rgba(0, 0, 0, 0.9);
        color: #fff;
        border: 2px solid #4a9eff;
        border-radius: 8px;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all var(--ag3d-duration-fast, 100ms) var(--ag3d-easing-standard, ease);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
      }

      .crossfade-toggle:hover:not(:disabled) {
        background: rgba(74, 158, 255, 0.2);
        border-color: #6bb1ff;
        transform: translate(-50%, -50%) scale(1.05);
      }

      .crossfade-toggle:active:not(:disabled) {
        transform: translate(-50%, -50%) scale(0.98);
      }

      .crossfade-toggle:focus-visible {
        outline: 2px solid var(--ag3d-color-focus, #4a9eff);
        outline-offset: 2px;
      }

      .crossfade-toggle:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .toggle-icon {
        font-size: 24px;
        line-height: 1;
      }

      .toggle-text {
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      /* Camera Sync Controls (WP-2.1.3) */
      .camera-controls-container {
        position: absolute;
        top: 12px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 1003;
      }

      /* Ground Truth Toggle (Placeholder) */
      .gt-toggle {
        position: absolute;
        top: 80px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 1002;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        padding: 8px 16px;
        background: rgba(0, 0, 0, 0.7);
        color: #999;
        border: 2px solid #555;
        border-radius: 6px;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: 11px;
        font-weight: 600;
        cursor: not-allowed;
        opacity: 0.5;
      }

      .gt-toggle .toggle-icon {
        font-size: 14px;
        line-height: 1;
      }

      .gt-toggle .toggle-text {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
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

      /* Reduced Motion Support (WP-2.1.1, NFR-3.7) */
      @media (prefers-reduced-motion: reduce) {
        .viewer-panel {
          transition-duration: 0.01ms !important;
        }

        .crossfade-toggle {
          transition-duration: 0.01ms !important;
        }
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

        .crossfade-toggle {
          top: 50%;
          left: 50%;
        }

        .camera-controls-container {
          top: 12px;
        }

        .gt-toggle {
          top: 80px;
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

        .crossfade-toggle {
          padding: 10px 16px;
          font-size: 12px;
        }

        .toggle-icon {
          font-size: 20px;
        }

        .toggle-text {
          font-size: 10px;
        }

        .camera-controls-container {
          top: 8px;
          left: 50%;
          transform: translateX(-50%) scale(0.9);
        }

        .gt-toggle {
          top: 70px;
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

  /** Diff mode for visual encoding (TP/FP/FN highlighting) */
  @Input() public diffMode: DiffMode = 'off';

  /** Optional: diff classification map (detection ID -> 'tp'|'fp'|'fn') */
  @Input() public baselineDiffClassification?: Map<string, 'tp' | 'fp' | 'fn'>;

  /** Optional: diff classification map for AGILE3D viewer */
  @Input() public agile3dDiffClassification?: Map<string, 'tp' | 'fp' | 'fn'>;

  /** Show ground truth overlay (placeholder for future WP) */
  @Input() public showGroundTruth = false;

  /** Number of points in synthetic point cloud (default 50k) */
  @Input() public pointCount = 50_000;

  /** Optional externally provided shared Points instance (from SceneDataService, WP-2.1.1) */
  @Input() public inputPoints?: THREE.Points;

  /** @deprecated Use inputPoints instead. Optional externally provided shared point geometry. */
  @Input() public inputGeometry?: THREE.BufferGeometry;

  /** Show FPS overlay on both viewers */
  @Input() public showFps = true;

  /** Shared point cloud geometry for both viewers (extracted from Points or created on init) */
  protected sharedGeometry!: THREE.BufferGeometry;

  /** Active viewer for crossfade demonstration ('baseline' | 'agile3d') */
  protected activeViewer: 'baseline' | 'agile3d' = 'baseline';

  /** Whether a crossfade transition is currently in progress */
  protected isTransitioning = false;
  private lastToggleTimestamp?: number;

  public ngOnInit(): void {
    // Priority: inputPoints > inputGeometry > synthetic
    if (this.inputPoints) {
      console.log('[DualViewer] using external Points instance (WP-2.1.1)', {
        uuid: this.inputPoints.geometry.uuid,
        vertices: this.inputPoints.geometry.getAttribute('position')?.count ?? 0,
      });
      this.sharedGeometry = this.inputPoints.geometry as THREE.BufferGeometry;
    } else if (this.inputGeometry) {
      console.log('[DualViewer] using external geometry (deprecated path)');
      this.sharedGeometry = this.inputGeometry;
    } else {
      console.log('[DualViewer] creating synthetic geometry');
      this.sharedGeometry = this.createSharedPointCloud(this.pointCount);
    }
  }

  /**
   * Toggle between baseline and AGILE3D viewers with crossfade effect.
   *
   * Implements visual crossfade transition ≤500ms per WP-2.1.1 requirements.
   * The transition respects prefers-reduced-motion for accessibility.
   * Both viewers continue rendering during the fade to prevent visual jumps.
   */
  protected toggleActiveViewer(): void {
    if (this.isTransitioning) {
      // Allow a second immediate toggle if a transition was initiated by this component
      if (this.lastToggleTimestamp === undefined) {
        console.log('[DualViewer] crossfade in progress, ignoring toggle');
        return;
      }
    }

    this.isTransitioning = true;
    const nextViewer = this.activeViewer === 'baseline' ? 'agile3d' : 'baseline';
    this.lastToggleTimestamp = performance.now();

    console.log('[DualViewer] crossfade transition', {
      from: this.activeViewer,
      to: nextViewer,
    });

    // Update active viewer immediately (CSS handles the transition)
    this.activeViewer = nextViewer;

    // Reset transition flag after animation completes (500ms + 50ms buffer)
    setTimeout(() => {
      this.isTransitioning = false;
      this.lastToggleTimestamp = undefined;
      console.log('[DualViewer] crossfade complete');
    }, 550);
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
