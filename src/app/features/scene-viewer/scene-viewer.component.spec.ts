import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SceneViewerComponent } from './scene-viewer.component';
import { RenderLoopService } from '../../core/services/rendering/render-loop.service';
import { CameraControlService } from '../../core/services/controls/camera-control.service';
import { StateService } from '../../core/services/state/state.service';
import { Detection } from '../../core/models/scene.models';
import * as THREE from 'three';

describe('SceneViewerComponent', () => {
  let component: SceneViewerComponent;
  let fixture: ComponentFixture<SceneViewerComponent>;
  let renderLoopService: jasmine.SpyObj<RenderLoopService>;

  beforeEach(async () => {
    const renderLoopSpy = jasmine.createSpyObj('RenderLoopService', [
      'register',
      'unregister',
    ]);
    const cameraControlSpy = jasmine.createSpyObj('CameraControlService', [
      'attach',
      'detach',
    ]);

    await TestBed.configureTestingModule({
      imports: [SceneViewerComponent],
      providers: [
        { provide: RenderLoopService, useValue: renderLoopSpy },
        { provide: CameraControlService, useValue: cameraControlSpy },
        StateService,
      ],
    }).compileComponents();

    renderLoopService = TestBed.inject(RenderLoopService) as jasmine.SpyObj<RenderLoopService>;

    fixture = TestBed.createComponent(SceneViewerComponent);
    component = fixture.componentInstance;
    component.viewerId = 'test-viewer';
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should throw if viewerId is not provided', () => {
    component.viewerId = '';
    expect(() => component.ngOnInit()).toThrowError(/viewerId is required/);
  });

  it('should register with RenderLoopService on init', () => {
    component.ngOnInit();
    expect(renderLoopService.register).toHaveBeenCalledWith(
      'test-viewer',
      jasmine.any(Function)
    );
  });

  it('should unregister from RenderLoopService on destroy', () => {
    component.ngOnInit();
    component.ngOnDestroy();
    expect(renderLoopService.unregister).toHaveBeenCalledWith('test-viewer');
  });

  it('should create synthetic point cloud if no geometry provided', () => {
    component.pointCount = 1000;
    component.ngOnInit();
    fixture.detectChanges(); // Trigger AfterViewInit

    const geometry = component['pointCloud']?.geometry;
    expect(geometry).toBeDefined();
    expect(geometry).toBeInstanceOf(THREE.BufferGeometry);

    const positions = geometry!.getAttribute('position');
    expect(positions.count).toBe(1000);
  });

  it('should use provided shared geometry instead of creating new one', () => {
    const sharedGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array([0, 0, 0, 1, 1, 1]);
    sharedGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    component.sharedPointGeometry = sharedGeometry;
    component.ngOnInit();
    fixture.detectChanges(); // Trigger AfterViewInit

    expect(component['pointCloud']?.geometry).toBe(sharedGeometry);
  });

  it('should create instanced mesh for detections with class-based colors', () => {
    const detections: Detection[] = [
      {
        id: 'det-1',
        class: 'vehicle',
        center: [1, 2, 3],
        dimensions: { width: 2, length: 4, height: 1.5 },
        yaw: 0,
        confidence: 0.95,
      },
      {
        id: 'det-2',
        class: 'pedestrian',
        center: [5, 6, 7],
        dimensions: { width: 0.5, length: 0.5, height: 1.8 },
        yaw: Math.PI / 4,
        confidence: 0.88,
      },
    ];

    component.detections = detections;
    component.ngOnInit();
    fixture.detectChanges(); // Trigger AfterViewInit

    const mesh = component['instancedMesh'];
    expect(mesh).toBeDefined();
    expect(mesh).toBeInstanceOf(THREE.InstancedMesh);
    expect(mesh?.count).toBe(2);
  });

  it('should dispose Three.js resources on destroy', () => {
    component.pointCount = 100;
    component.ngOnInit();
    fixture.detectChanges(); // Trigger AfterViewInit

    const geometry = component['pointCloud']?.geometry;
    const disposeSpy = spyOn(geometry!, 'dispose');

    component.ngOnDestroy();

    expect(disposeSpy).toHaveBeenCalled();
  });

  it('should clamp DPR to 1.75 for performance', () => {
    // Mock window.devicePixelRatio
    const originalDpr = window.devicePixelRatio;
    Object.defineProperty(window, 'devicePixelRatio', {
      writable: true,
      configurable: true,
      value: 3.0,
    });

    // Create new component with high DPR
    const newFixture = TestBed.createComponent(SceneViewerComponent);
    const newComponent = newFixture.componentInstance;
    newComponent.viewerId = 'test-dpr';
    newComponent.ngOnInit();
    newFixture.detectChanges(); // Trigger AfterViewInit

    // Verify renderer uses clamped DPR
    expect(newComponent['renderer']?.getPixelRatio()).toBe(1.75);

    // Restore original DPR
    Object.defineProperty(window, 'devicePixelRatio', {
      writable: true,
      configurable: true,
      value: originalDpr,
    });

    newFixture.destroy();
  });

  it('should update FPS counter on render frames', () => {
    component.ngOnInit();

    // Simulate render callback
    const renderCallback = renderLoopService.register.calls.argsFor(0)[1];

    // Simulate 60fps (16.67ms per frame)
    for (let i = 0; i < 10; i++) {
      renderCallback(16.67, performance.now());
    }

    const fps = component['currentFps']();
    expect(fps).toBeGreaterThan(50);
    expect(fps).toBeLessThanOrEqual(60);
  });

  it('should handle multiple detections with different classes', () => {
    const detections: Detection[] = [
      {
        id: 'v1',
        class: 'vehicle',
        center: [0, 0, 0],
        dimensions: { width: 2, length: 4, height: 1.5 },
        yaw: 0,
        confidence: 0.9,
      },
      {
        id: 'p1',
        class: 'pedestrian',
        center: [5, 5, 0],
        dimensions: { width: 0.5, length: 0.5, height: 1.8 },
        yaw: 0,
        confidence: 0.85,
      },
      {
        id: 'c1',
        class: 'cyclist',
        center: [10, 10, 0],
        dimensions: { width: 0.6, length: 1.8, height: 1.2 },
        yaw: 0,
        confidence: 0.8,
      },
    ];

    component.detections = detections;
    component.ngOnInit();
    fixture.detectChanges(); // Trigger AfterViewInit

    const mesh = component['instancedMesh'];
    expect(mesh).toBeDefined();
    expect(mesh?.count).toBe(3);
  });
});
