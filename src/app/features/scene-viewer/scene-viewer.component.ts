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
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RenderLoopService } from '../../core/services/rendering/render-loop.service';
import { CameraControlService } from '../../core/services/controls/camera-control.service';
import { ViewerStyleAdapterService, ViewerColorConfig } from '../../core/theme/viewer-style-adapter.service';
import { Detection } from '../../core/models/scene.models';
import { Subscription } from 'rxjs';

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

  /** Unique identifier for this viewer instance (required for RenderLoopService and CameraControlService) */
  @Input({ required: true }) public viewerId!: string;

  /** Optional: shared point cloud geometry for efficiency across multiple viewers */
  @Input() public sharedPointGeometry?: THREE.BufferGeometry;

  /** Optional: detections to render as instanced bounding boxes */
  @Input() public detections: Detection[] = [];

  /** Number of synthetic points to generate if no sharedPointGeometry provided (default 50k) */
  @Input() public pointCount = 50_000;

  /** Show FPS overlay */
  @Input() public showFps = true;

  // Canvas element
  @ViewChild('canvas', { static: true }) private canvasRef!: ElementRef<HTMLCanvasElement>;

  // Three.js scene objects
  private scene?: THREE.Scene;
  private camera?: THREE.PerspectiveCamera;
  private renderer?: THREE.WebGLRenderer;
  private controls?: OrbitControls;
  private pointCloud?: THREE.Points;
  private instancedMesh?: THREE.InstancedMesh;

  // Performance tracking
  protected currentFps: WritableSignal<number> = signal(60);
  private fpsHistory: number[] = [];
  private readonly fpsHistorySize = 60;

  // Theme colors
  private viewerColors?: ViewerColorConfig;
  private colorSubscription?: Subscription;

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

    // Register render callback early so tests observing ngOnInit see the registration
    this.renderLoop.register(this.viewerId, (deltaMs) => this.onRenderFrame(deltaMs));
  }

  public ngAfterViewInit(): void {
    this.initThreeJS();
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['sharedPointGeometry'] && this.pointCloud && this.sharedPointGeometry) {
      const oldGeom = this.pointCloud.geometry as THREE.BufferGeometry;
      // Dispose old geometry only if we created it locally (tracked in disposables)
      if (this.disposables.includes(oldGeom)) {
        oldGeom.dispose();
        // Remove from disposables list
        const idx = this.disposables.indexOf(oldGeom);
        if (idx >= 0) this.disposables.splice(idx, 1);
      }
      this.pointCloud.geometry = this.sharedPointGeometry;
    }
  }

  public ngOnDestroy(): void {
    // Unregister from services
    this.renderLoop.unregister(this.viewerId);
    if (this.controls) {
      this.cameraControl.detach(this.viewerId);
    }

    // Unsubscribe from color updates
    if (this.colorSubscription) {
      this.colorSubscription.unsubscribe();
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
    this.camera.position.set(0, 0, 10);

    // Renderer with DPR clamping
    const clampedDpr = Math.min(window.devicePixelRatio, 1.75);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    this.renderer.setPixelRatio(clampedDpr);
    this.renderer.setSize(width, height);

    // Orbit Controls
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;

    // Attach controls to CameraControlService
    this.cameraControl.attach(this.viewerId, this.controls);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    // Point cloud
    this.addPointCloud();

    // Bounding boxes
    if (this.detections.length > 0) {
      this.addBoundingBoxes();
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
      geometry = this.sharedPointGeometry;
    } else {
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
   * Add bounding boxes as instanced mesh to the scene.
   */
  private addBoundingBoxes(): void {
    const mesh = this.createInstancedBoundingBoxes(this.detections);
    this.instancedMesh = mesh;
    this.scene?.add(mesh);

    this.disposables.push(mesh.geometry);
    if (Array.isArray(mesh.material)) {
      this.disposables.push(...mesh.material);
    } else {
      this.disposables.push(mesh.material);
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

    // Update point cloud color if it exists
    if (this.pointCloud && this.pointCloud.material instanceof THREE.PointsMaterial) {
      // For now, keep points as neutral gray (could be enhanced to use theme color)
      // this.pointCloud.material.color = colors.grid;
    }

    // Update bounding box colors if they exist
    if (this.instancedMesh) {
      const classColors: Record<string, THREE.Color> = {
        vehicle: colors.vehicle,
        pedestrian: colors.pedestrian,
        cyclist: colors.cyclist,
      };

      const color = new THREE.Color();
      this.detections.forEach((det, i) => {
        const detColor = classColors[det.class] ?? new THREE.Color(0xffffff);
        color.copy(detColor);
        this.instancedMesh?.setColorAt(i, color);
      });

      if (this.instancedMesh.instanceColor) {
        this.instancedMesh.instanceColor.needsUpdate = true;
      }
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
   * Create InstancedMesh of bounding boxes with class-based coloring.
   * Colors sourced from design tokens via ViewerStyleAdapterService (NFR-3.5, UI 8.2).
   */
  private createInstancedBoundingBoxes(detections: Detection[]): THREE.InstancedMesh {
    const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ wireframe: true });

    const mesh = new THREE.InstancedMesh(boxGeometry, material, detections.length);

    // Get colors from theme system - PRD §8.2.1
    const classColors: Record<string, THREE.Color> = {
      vehicle: this.viewerColors?.vehicle ?? new THREE.Color(0x3b82f6),
      pedestrian: this.viewerColors?.pedestrian ?? new THREE.Color(0xef4444),
      cyclist: this.viewerColors?.cyclist ?? new THREE.Color(0xf97316),
    };

    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();

    detections.forEach((det, i) => {
      const { center, dimensions, yaw } = det;
      matrix.makeRotationZ(yaw);
      matrix.setPosition(center[0], center[1], center[2]);
      matrix.scale(new THREE.Vector3(dimensions.width, dimensions.length, dimensions.height));
      mesh.setMatrixAt(i, matrix);

      const detColor = classColors[det.class] ?? new THREE.Color(0xffffff);
      color.copy(detColor);
      mesh.setColorAt(i, color);
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }

    return mesh;
  }
}
