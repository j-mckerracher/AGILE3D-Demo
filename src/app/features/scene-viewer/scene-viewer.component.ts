import {
  Component,
  Input,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  inject,
  signal,
  WritableSignal,
  AfterViewInit,
  OnChanges,
  SimpleChanges,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RenderLoopService } from '../../core/services/rendering/render-loop.service';
import { CameraControlService } from '../../core/services/controls/camera-control.service';
import { ViewerStyleAdapterService, ViewerColorConfig, ViewerMotionConfig } from '../../core/theme/viewer-style-adapter.service';
import { ReducedMotionService } from '../../core/services/reduced-motion.service';
import { Detection, DetectionClass } from '../../core/models/scene.models';
import { Subscription } from 'rxjs';
import {
  buildClassBatches,
  disposeClassBatches,
  getInstanceMetadata,
  ClassBatches,
  DiffMode,
  ClassColors,
  InstanceMetadata,
} from '../../core/services/visualization/bbox-instancing';

/**
 * SceneViewer renders a Three.js scene using direct Three.js APIs.
 * Features:
 * - Synthetic point cloud (50k-100k points) with shared BufferGeometry for efficiency
 * - InstancedMesh bounding boxes with class-based coloring
 * - Performance optimizations: DPR clamping, single shared rAF loop via RenderLoopService
 * - FPS overlay with moving average
 * - Two-way camera sync via CameraControlService
 *
 * @example
 * <app-scene-viewer
 *   viewerId="baseline"
 *   [sharedPointGeometry]="sharedGeometry"
 *   [detections]="detections"
 * />
 */
@Component({
  selector: 'app-scene-viewer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="scene-viewer-container">
      <!-- FPS Overlay -->
      <div class="fps-overlay" *ngIf="showFps">FPS: {{ currentFps() }}</div>

      <!-- Detection Tooltip -->
      <div
        class="detection-tooltip"
        *ngIf="tooltipVisible()"
        [style.left.px]="tooltipPosition().x + 10"
        [style.top.px]="tooltipPosition().y + 10"
        role="tooltip"
        aria-live="polite"
      >
        <div class="tooltip-row">
          <span class="tooltip-label">Class:</span>
          <span class="tooltip-value">{{ tooltipContent().class }}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Confidence:</span>
          <span class="tooltip-value">{{ (tooltipContent().confidence * 100).toFixed(1) }}%</span>
        </div>
        <div class="tooltip-row" *ngIf="tooltipContent().matchesGt">
          <span class="tooltip-label">Matches GT:</span>
          <span class="tooltip-value">{{ tooltipContent().matchesGt }}</span>
        </div>
      </div>

      <!-- Three.js Canvas -->
      <canvas #canvas></canvas>
    </div>
  `,
  styles: [
    `
      .scene-viewer-container {
        position: relative;
        width: 100%;
        height: 100%;
      }

      .fps-overlay {
        position: absolute;
        top: 10px;
        left: 10px;
        background: rgba(0, 0, 0, 0.7);
        color: #0f0;
        padding: 4px 8px;
        font-family: monospace;
        font-size: 12px;
        z-index: 1000;
        border-radius: 3px;
      }

      .detection-tooltip {
        position: fixed;
        background: rgba(0, 0, 0, 0.9);
        color: #fff;
        padding: 8px 12px;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: 12px;
        z-index: 1001;
        border-radius: 4px;
        pointer-events: none;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        min-width: 150px;
      }

      .tooltip-row {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        margin: 2px 0;
      }

      .tooltip-label {
        font-weight: 600;
        opacity: 0.8;
      }

      .tooltip-value {
        font-weight: 400;
        text-align: right;
      }

      canvas {
        width: 100%;
        height: 100%;
        display: block;
      }
    `,
  ],
})
export class SceneViewerComponent implements OnInit, AfterViewInit, OnDestroy, OnChanges {
  private readonly renderLoop = inject(RenderLoopService);
  private readonly cameraControl = inject(CameraControlService);
  private readonly viewerStyleAdapter = inject(ViewerStyleAdapterService);
  private readonly reducedMotion = inject(ReducedMotionService);

  /** Unique identifier for this viewer instance (required for RenderLoopService and CameraControlService) */
  @Input({ required: true }) public viewerId!: string;

  /** Optional: shared point cloud geometry for efficiency across multiple viewers */
  @Input() public sharedPointGeometry?: THREE.BufferGeometry;

  /** Optional: detections to render as instanced bounding boxes */
  @Input() public detections: Detection[] = [];

  /** Diff mode for visual encoding (TP/FP/FN highlighting) */
  @Input() public diffMode: DiffMode = 'off';

  /** Optional: diff classification map (detection ID -> 'tp'|'fp'|'fn') */
  @Input() public diffClassification?: Map<string, 'tp' | 'fp' | 'fn'>;

  /** Number of synthetic points to generate if no sharedPointGeometry provided (default 50k) */
  @Input() public pointCount = 50_000;

  /** Show FPS overlay (WP-2.3.2: default false, enabled via debug mode) */
  @Input() public showFps = false;

  // Canvas element
  @ViewChild('canvas', { static: true }) private canvasRef!: ElementRef<HTMLCanvasElement>;

  // Three.js scene objects
  private scene?: THREE.Scene;
  private camera?: THREE.PerspectiveCamera;
  private renderer?: THREE.WebGLRenderer;
  private controls?: OrbitControls;
  private pointCloud?: THREE.Points;
  private classBatches?: ClassBatches;

  // Raycaster for hover interactions
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private hoveredInstance?: InstanceMetadata;

  // Tooltip state
  protected tooltipVisible = signal(false);
  protected tooltipContent = signal<{ class: string; confidence: number; matchesGt?: string }>({
    class: '',
    confidence: 0,
  });
  protected tooltipPosition = signal({ x: 0, y: 0 });

  // Performance tracking
  protected currentFps: WritableSignal<number> = signal(60);
  private fpsHistory: number[] = [];
  private readonly fpsHistorySize = 60;

  // Theme colors and motion config
  private viewerColors?: ViewerColorConfig;
  private viewerMotion?: ViewerMotionConfig;
  private colorSubscription?: Subscription;
  private motionSubscription?: Subscription;

  // Cleanup references
  private readonly disposables: (THREE.BufferGeometry | THREE.Material)[] = [];

  public ngOnInit(): void {
    if (!this.viewerId) {
      throw new Error('SceneViewer: viewerId is required');
    }

    // Subscribe to viewer colors
    this.colorSubscription = this.viewerStyleAdapter.viewerColors$.subscribe((colors) => {
      this.viewerColors = colors;
      // Update scene colors if already initialized
      if (this.scene) {
        this.updateSceneColors(colors);
      }
    });

    // Subscribe to viewer motion config
    this.motionSubscription = this.viewerStyleAdapter.viewerMotion$.subscribe((motion) => {
      this.viewerMotion = motion;
    });

    // Register render callback early so tests observing ngOnInit see the registration
    this.renderLoop.register(this.viewerId, (deltaMs) => this.onRenderFrame(deltaMs));
  }

  public ngAfterViewInit(): void {
    this.initThreeJS();
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['sharedPointGeometry']) {
      if (this.pointCloud && this.sharedPointGeometry) {
        console.log('[SceneViewer]', this.viewerId, 'swapping to external geometry');
        const oldGeom = this.pointCloud.geometry as THREE.BufferGeometry;
        if (this.disposables.includes(oldGeom)) {
          oldGeom.dispose();
          const idx = this.disposables.indexOf(oldGeom);
          if (idx >= 0) this.disposables.splice(idx, 1);
        }
        this.pointCloud.geometry = this.sharedPointGeometry;
      } else {
        console.log('[SceneViewer]', this.viewerId, 'sharedPointGeometry changed but pointCloud not ready');
      }
    }

    // Update bounding boxes if detections, diffMode, or diffClassification changes
    if ((changes['detections'] || changes['diffMode'] || changes['diffClassification']) && this.scene) {
      console.log('[SceneViewer]', this.viewerId, 'updating detections/diffMode', {
        detections: this.detections?.length ?? 0,
        diffMode: this.diffMode,
      });
      this.updateBoundingBoxes();
    }
  }

  public ngOnDestroy(): void {
    // Unregister from services
    this.renderLoop.unregister(this.viewerId);
    if (this.controls) {
      this.cameraControl.detach(this.viewerId);
    }

    // Unsubscribe from updates
    if (this.colorSubscription) {
      this.colorSubscription.unsubscribe();
    }
    if (this.motionSubscription) {
      this.motionSubscription.unsubscribe();
    }

    // Dispose class batches
    if (this.classBatches) {
      disposeClassBatches(this.classBatches);
    }

    // Dispose Three.js resources
    this.disposables.forEach((obj) => {
      if ('dispose' in obj) obj.dispose();
    });

    if (this.renderer) {
      this.renderer.dispose();
    }
  }

  /**
   * Initialize Three.js scene, camera, renderer, and controls.
   */
  private initThreeJS(): void {
    const canvas = this.canvasRef.nativeElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    // Scene
    this.scene = new THREE.Scene();
    // Use theme background color (NFR-3.5, UI 8.2)
    const bgColor = this.viewerColors?.background ?? new THREE.Color(0x1a1a1a);
    this.scene.background = bgColor;

    // Camera
    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    this.camera.position.set(25, 25, 25);

    // Renderer with DPR clamping
    const clampedDpr = Math.min(window.devicePixelRatio, 1.75);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    this.renderer.setPixelRatio(clampedDpr);
    this.renderer.setSize(width, height);

    // Orbit Controls
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.target.set(0, 0, 2.5); // Look at center of point cloud (z: 0-5)

    // Attach controls to CameraControlService
    this.cameraControl.attach(this.viewerId, this.controls);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    // Point cloud
    this.addPointCloud();

    // Bounding boxes
    if (this.detections.length > 0) {
      this.updateBoundingBoxes();
    }

    // Handle window resize
    window.addEventListener('resize', () => this.onWindowResize());
  }

  /**
   * Add point cloud to the scene.
   */
  private addPointCloud(): void {
    let geometry: THREE.BufferGeometry;

    if (this.sharedPointGeometry) {
      console.log('[SceneViewer]', this.viewerId, 'using shared geometry');
      geometry = this.sharedPointGeometry;
    } else {
      console.log('[SceneViewer]', this.viewerId, 'creating synthetic geometry');
      geometry = this.createSyntheticPointCloud(this.pointCount);
      this.disposables.push(geometry);
    }

    // Use neutral color for points (NFR-3.5, UI 8.2)
    const pointColor = new THREE.Color(0x888888); // Default gray
    const material = new THREE.PointsMaterial({ color: pointColor, size: 0.05 });
    this.disposables.push(material);

    this.pointCloud = new THREE.Points(geometry, material);
    this.scene?.add(this.pointCloud);
  }

  /**
   * Update bounding boxes in the scene with current detections and diff mode.
   * Disposes old batches and creates new ones.
   */
  private updateBoundingBoxes(): void {
    // Remove and dispose existing batches
    if (this.classBatches && this.scene) {
      for (const classType of ['vehicle', 'pedestrian', 'cyclist'] as DetectionClass[]) {
        const mesh = this.classBatches[classType];
        if (mesh) {
          this.scene.remove(mesh);
        }
      }
      disposeClassBatches(this.classBatches);
      this.classBatches = undefined;
    }

    // Create new batches if detections exist
    if (this.detections.length > 0 && this.viewerColors) {
      const colors: ClassColors = {
        vehicle: this.viewerColors.vehicle,
        pedestrian: this.viewerColors.pedestrian,
        cyclist: this.viewerColors.cyclist,
      };

      this.classBatches = buildClassBatches(
        this.detections,
        colors,
        this.diffMode,
        this.diffClassification
      );

      // Add batches to scene
      if (this.scene) {
        for (const classType of ['vehicle', 'pedestrian', 'cyclist'] as DetectionClass[]) {
          const mesh = this.classBatches[classType];
          if (mesh) {
            this.scene.add(mesh);
          }
        }
      }
    }
  }

  /**
   * Called each frame by RenderLoopService. Renders scene and updates FPS.
   */
  private onRenderFrame(deltaMs: number): void {
    if (!this.scene || !this.camera || !this.renderer) return;

    // Update controls
    this.controls?.update();

    // Render scene
    this.renderer.render(this.scene, this.camera);

    // Calculate FPS
    if (deltaMs > 0) {
      const fps = Math.round(1000 / deltaMs);
      this.fpsHistory.push(fps);
      if (this.fpsHistory.length > this.fpsHistorySize) {
        this.fpsHistory.shift();
      }

      const avg = Math.round(
        this.fpsHistory.reduce((sum, v) => sum + v, 0) / this.fpsHistory.length
      );
      this.currentFps.set(avg);
    }
  }

  /**
   * Handle window resize.
   */
  private onWindowResize(): void {
    if (!this.camera || !this.renderer || !this.canvasRef) return;

    const canvas = this.canvasRef.nativeElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  /**
   * Update scene colors when theme changes (NFR-3.5, UI 8.2).
   */
  private updateSceneColors(colors: ViewerColorConfig): void {
    if (this.scene) {
      this.scene.background = colors.background;
    }

    // Update bounding box colors - rebuild batches with new colors
    if (this.classBatches && this.detections.length > 0) {
      this.updateBoundingBoxes();
    }
  }

  /**
   * Create synthetic point cloud with random positions.
   */
  private createSyntheticPointCloud(count: number): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * 20;
      positions[i3 + 1] = (Math.random() - 0.5) * 20;
      positions[i3 + 2] = Math.random() * 5;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geometry;
  }

  /**
   * Handle mouse move for raycasting and hover detection.
   */
  @HostListener('mousemove', ['$event'])
  public onMouseMove(event: MouseEvent): void {
    if (!this.canvasRef || !this.camera || !this.classBatches) return;

    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();

    // Normalize mouse coordinates to [-1, 1]
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.performRaycast(event.clientX, event.clientY);
  }

  /**
   * Perform raycasting to detect hovered detection.
   */
  private performRaycast(clientX: number, clientY: number): void {
    if (!this.camera || !this.classBatches) return;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Collect all meshes for raycasting
    const meshes: THREE.InstancedMesh[] = [];
    for (const classType of ['vehicle', 'pedestrian', 'cyclist'] as DetectionClass[]) {
      const mesh = this.classBatches[classType];
      if (mesh) {
        meshes.push(mesh);
      }
    }

    const intersects = this.raycaster.intersectObjects(meshes, false);

    if (intersects.length > 0) {
      const intersection = intersects[0];
      if (!intersection) return;

      const metadata = getInstanceMetadata(intersection);

      if (metadata) {
        this.hoveredInstance = metadata;
        this.showTooltip(metadata, clientX, clientY);
      } else {
        this.hideTooltip();
      }
    } else {
      this.hideTooltip();
    }
  }

  /**
   * Show tooltip with detection information.
   */
  private showTooltip(metadata: InstanceMetadata, x: number, y: number): void {
    this.tooltipContent.set({
      class: metadata.detection.class,
      confidence: metadata.detection.confidence,
      matchesGt: metadata.detection.matches_gt,
    });
    this.tooltipPosition.set({ x, y });
    this.tooltipVisible.set(true);
  }

  /**
   * Hide tooltip.
   */
  private hideTooltip(): void {
    this.tooltipVisible.set(false);
    this.hoveredInstance = undefined;
  }
}
