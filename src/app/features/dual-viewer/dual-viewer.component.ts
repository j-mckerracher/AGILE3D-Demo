import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as THREE from 'three';
import { FrameStreamService } from '../../core/services/frame-stream/frame-stream.service';
import { SceneDataService } from '../../core/services/data/scene-data.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

/**
 * DualViewerComponent renders synchronized Three.js views for baseline and active branches.
 * Both panes display the same frame with shared geometry but independent bounding boxes.
 *
 * Features:
 * - Synchronized frame updates via FrameStreamService
 * - Shared point cloud geometry from SceneDataService
 * - Per-branch bounding box rendering
 * - Responsive design with DPR clamping for Safari (≤1.5)
 * - ≥55 fps performance target
 */
@Component({
  selector: 'app-dual-viewer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dual-viewer.component.html',
  styleUrls: ['./dual-viewer.component.scss'],
})
export class DualViewerComponent implements OnInit, OnDestroy {
  @ViewChild('baselineCanvas', { static: true }) baselineCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('activeCanvas', { static: true }) activeCanvas!: ElementRef<HTMLCanvasElement>;

  private baselineRenderer!: THREE.WebGLRenderer;
  private activeRenderer!: THREE.WebGLRenderer;
  private baselineScene!: THREE.Scene;
  private activeScene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private destroy$ = new Subject<void>();

  currentFrameId = '';
  isLoading = true;
  errorMessage = '';

  constructor(
    private frameStreamService: FrameStreamService,
    private sceneDataService: SceneDataService
  ) {}

  ngOnInit(): void {
    this.initializeRenderers();
    this.subscribeToFrameStream();
  }

  private initializeRenderers(): void {
    const width = this.baselineCanvas.nativeElement.clientWidth;
    const height = this.baselineCanvas.nativeElement.clientHeight;
    const dpr = Math.min(window.devicePixelRatio, 1.5); // Clamp to 1.5 for Safari

    // Baseline renderer
    this.baselineRenderer = new THREE.WebGLRenderer({
      canvas: this.baselineCanvas.nativeElement,
      antialias: true,
      alpha: false,
    });
    this.baselineRenderer.setPixelRatio(dpr);
    this.baselineRenderer.setSize(width, height);
    this.baselineRenderer.setClearColor(0x1a1a1a);

    // Active renderer
    this.activeRenderer = new THREE.WebGLRenderer({
      canvas: this.activeCanvas.nativeElement,
      antialias: true,
      alpha: false,
    });
    this.activeRenderer.setPixelRatio(dpr);
    this.activeRenderer.setSize(width, height);
    this.activeRenderer.setClearColor(0x1a1a1a);

    // Shared camera (synchronized between both views)
    const aspect = width / height;
    this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    this.camera.position.set(0, 0, 30);
    this.camera.lookAt(0, 0, 0);

    // Create scenes
    this.baselineScene = new THREE.Scene();
    this.baselineScene.background = new THREE.Color(0x1a1a1a);
    this.activeScene = new THREE.Scene();
    this.activeScene.background = new THREE.Color(0x1a1a1a);

    // Add lighting to both scenes
    this.addLighting(this.baselineScene);
    this.addLighting(this.activeScene);

    // Start animation loop
    this.animate();
  }

  private addLighting(scene: THREE.Scene): void {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    scene.add(directionalLight);
  }

  private subscribeToFrameStream(): void {
    this.frameStreamService.currentFrame$
      .pipe(takeUntil(this.destroy$))
      .subscribe((frameData) => {
        if (!frameData) return;

        this.currentFrameId = frameData.id;
        this.isLoading = false;

        // Apply frame data to update geometry and detections
        this.sceneDataService.applyFrame(frameData);

        // Update bounding boxes for both branches
        this.updateBoundingBoxes(this.baselineScene, 'baseline');
        this.updateBoundingBoxes(this.activeScene, 'active');
      });
  }

  private updateBoundingBoxes(scene: THREE.Scene, branch: string): void {
    // Subscribe to detections to render bounding boxes
    this.sceneDataService.detections$()
      .pipe(takeUntil(this.destroy$))
      .subscribe((detections) => {
        // Clear previous bboxes (keep geometry and lights)
        const objectsToRemove = scene.children.filter(
          (obj) => obj instanceof THREE.LineSegments || obj instanceof THREE.Mesh
        );
        objectsToRemove.forEach((obj) => {
          if ('geometry' in obj) (obj as THREE.Mesh).geometry.dispose();
          if ('material' in obj) {
            const mat = (obj as THREE.Mesh).material;
            if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
            else mat.dispose();
          }
          scene.remove(obj);
        });

        // Render detections as wireframe boxes
        detections.forEach((det) => {
          const bbox = det.bbox;
          const color = branch === 'baseline' ? 0xff0000 : 0x00ff00;
          const box = new THREE.BoxHelper(
            new THREE.Mesh(new THREE.BoxGeometry(bbox.l, bbox.w, bbox.h)),
            color
          );
          box.position.set(bbox.x, bbox.y, bbox.z);
          scene.add(box);
        });
      });
  }

  private animate = (): void => {
    requestAnimationFrame(this.animate);

    // Subscribe to geometry once it's ready
    this.sceneDataService.geometry$()
      .pipe(takeUntil(this.destroy$))
      .subscribe((geometry) => {
        if (!geometry) return;

        // Remove old geometry from scenes
        const toRemove = this.baselineScene.children.filter((obj) => obj instanceof THREE.Points);
        toRemove.forEach((obj) => this.baselineScene.remove(obj));

        const toRemoveActive = this.activeScene.children.filter(
          (obj) => obj instanceof THREE.Points
        );
        toRemoveActive.forEach((obj) => this.activeScene.remove(obj));

        // Add points to both scenes (shared geometry)
        const material = new THREE.PointsMaterial({ color: 0x888888, size: 0.05 });
        const baselinePoints = new THREE.Points(geometry, material);
        const activePoints = new THREE.Points(geometry, material.clone());

        this.baselineScene.add(baselinePoints);
        this.activeScene.add(activePoints);
      });

    // Render both scenes
    this.baselineRenderer.render(this.baselineScene, this.camera);
    this.activeRenderer.render(this.activeScene, this.camera);
  };

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.baselineRenderer?.dispose();
    this.activeRenderer?.dispose();
  }
}
