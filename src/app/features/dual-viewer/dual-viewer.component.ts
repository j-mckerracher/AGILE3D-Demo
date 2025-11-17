import { Component, Input, OnInit, OnChanges, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SceneViewerComponent } from '../scene-viewer/scene-viewer.component';
import { Detection } from '../../core/models/scene.models';
import { DiffMode } from '../../core/services/visualization/bbox-instancing';
import * as THREE from 'three';

/**
 * DualViewer displays two synchronized SceneViewer instances side-by-side.
 *
 * UI Restructuring: Playback controls moved to DemoHeaderComponent
 * Legend moved to sidebar. This component now focuses on dual viewer display.
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
  imports: [CommonModule, SceneViewerComponent],
  templateUrl: './dual-viewer.component.html',
  styleUrls: ['./dual-viewer.component.scss'],
})
export class DualViewerComponent implements OnInit, OnChanges {
  /** Detections to display in the baseline viewer */
  @Input() public baselineDetections: Detection[] = [];

  /** Detections to display in the AGILE3D viewer */
  @Input() public agile3dDetections: Detection[] = [];

  /** Diff mode for visual encoding (TP/FP/FN highlighting) */
  @Input() public diffMode: DiffMode = 'all';

  /** Effective diff mode used internally and toggleable */
  protected effectiveDiffMode: DiffMode = 'all';

  /** Optional: diff classification map (detection ID -> 'tp'|'fp'|'fn') */
  @Input() public baselineDiffClassification?: Map<string, 'tp' | 'fp' | 'fn'>;

  /** Optional: diff classification map for AGILE3D viewer */
  @Input() public agile3dDiffClassification?: Map<string, 'tp' | 'fp' | 'fn'>;

  /** Panel titles */
  @Input() public leftTitle: string = 'Baseline';
  @Input() public rightTitle: string = 'AGILE3D';

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
    this.effectiveDiffMode = this.diffMode;
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

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['diffMode'] && changes['diffMode'].currentValue) {
      this.effectiveDiffMode = changes['diffMode'].currentValue;
    }
    if (changes['inputPoints'] && this.inputPoints) {
      // Switch to external shared Points geometry when it becomes available
      console.log('[DualViewer] switching to external Points geometry', {
        uuid: this.inputPoints.geometry.uuid,
        vertices: this.inputPoints.geometry.getAttribute('position')?.count ?? 0,
      });
      this.sharedGeometry = this.inputPoints.geometry as THREE.BufferGeometry;
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
