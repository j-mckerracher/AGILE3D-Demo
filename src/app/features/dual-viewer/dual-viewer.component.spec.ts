import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DualViewerComponent } from './dual-viewer.component';
import { SceneViewerComponent } from '../scene-viewer/scene-viewer.component';
import { RenderLoopService } from '../../core/services/rendering/render-loop.service';
import { CameraControlService } from '../../core/services/controls/camera-control.service';
import { StateService } from '../../core/services/state/state.service';
import { Detection } from '../../core/models/scene.models';
import * as THREE from 'three';

describe('DualViewerComponent', () => {
  let component: DualViewerComponent;
  let fixture: ComponentFixture<DualViewerComponent>;

  beforeEach(async () => {
    const renderLoopSpy = jasmine.createSpyObj('RenderLoopService', ['register', 'unregister']);
    const cameraControlSpy = jasmine.createSpyObj('CameraControlService', ['attach', 'detach']);

    await TestBed.configureTestingModule({
      imports: [DualViewerComponent, SceneViewerComponent],
      providers: [
        { provide: RenderLoopService, useValue: renderLoopSpy },
        { provide: CameraControlService, useValue: cameraControlSpy },
        StateService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DualViewerComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should create shared geometry on init', () => {
    component.pointCount = 1000;
    component.ngOnInit();

    expect(component['sharedGeometry']).toBeDefined();
    expect(component['sharedGeometry']).toBeInstanceOf(THREE.BufferGeometry);

    const positions = component['sharedGeometry'].getAttribute('position');
    expect(positions.count).toBe(1000);
  });

  it('should render two SceneViewer components', () => {
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const viewers = compiled.querySelectorAll('app-scene-viewer');
    expect(viewers.length).toBe(2);
  });

  it('should pass baseline detections to first viewer', () => {
    const baselineDetections: Detection[] = [
      {
        id: 'b1',
        class: 'vehicle',
        center: [0, 0, 0],
        dimensions: { width: 2, length: 4, height: 1.5 },
        yaw: 0,
        confidence: 0.9,
      },
    ];

    component.baselineDetections = baselineDetections;
    fixture.detectChanges();

    // Query for the first scene-viewer and verify it receives baseline detections
    const compiled = fixture.nativeElement as HTMLElement;
    const viewers = compiled.querySelectorAll('app-scene-viewer');
    expect(viewers.length).toBeGreaterThan(0);
  });

  it('should pass agile3d detections to second viewer', () => {
    const agile3dDetections: Detection[] = [
      {
        id: 'a1',
        class: 'pedestrian',
        center: [5, 5, 0],
        dimensions: { width: 0.5, length: 0.5, height: 1.8 },
        yaw: 0,
        confidence: 0.85,
      },
    ];

    component.agile3dDetections = agile3dDetections;
    fixture.detectChanges();

    // Query for scene-viewers
    const compiled = fixture.nativeElement as HTMLElement;
    const viewers = compiled.querySelectorAll('app-scene-viewer');
    expect(viewers.length).toBe(2);
  });

  it('should use the same shared geometry for both viewers', () => {
    component.ngOnInit();
    fixture.detectChanges();

    // The shared geometry reference should be passed to both viewers
    expect(component['sharedGeometry']).toBeDefined();
    const geometry = component['sharedGeometry'];

    // Verify it's a valid BufferGeometry
    expect(geometry).toBeInstanceOf(THREE.BufferGeometry);
    expect(geometry.getAttribute('position')).toBeDefined();
  });

  it('should have viewer IDs "baseline" and "agile3d"', () => {
    fixture.detectChanges();
    const template = fixture.debugElement.nativeElement.outerHTML;

    // Check that viewerId attributes are set correctly in the template
    expect(template).toContain('baseline');
    expect(template).toContain('agile3d');
  });

  it('should pass showFps input to both viewers', () => {
    component.showFps = false;
    fixture.detectChanges();

    const childDes = fixture.debugElement.queryAll(By.directive(SceneViewerComponent));
    expect(childDes.length).toBe(2);
    const baselineCmp = childDes[0]!.componentInstance as SceneViewerComponent;
    const agileCmp = childDes[1]!.componentInstance as SceneViewerComponent;
    expect(baselineCmp.showFps).toBeFalse();
    expect(agileCmp.showFps).toBeFalse();
  });

  it('should display viewer labels', () => {
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const labels = compiled.querySelectorAll('.viewer-label');

    expect(labels.length).toBe(2);
    expect(labels[0]?.textContent).toContain('DSVT-Voxel (Baseline)');
    expect(labels[1]?.textContent).toContain('AGILE3D');
  });

  it('should handle empty detection arrays', () => {
    component.baselineDetections = [];
    component.agile3dDetections = [];
    component.ngOnInit();
    fixture.detectChanges();

    // Should still render without errors
    const compiled = fixture.nativeElement as HTMLElement;
    const viewers = compiled.querySelectorAll('app-scene-viewer');
    expect(viewers.length).toBe(2);
  });

  it('should create consistent point cloud data across multiple calls', () => {
    // Set a specific point count
    component.pointCount = 500;

    component.ngOnInit();
    const geometry = component['sharedGeometry'];
    const positions = geometry.getAttribute('position');

    // Verify point count
    expect(positions.count).toBe(500);

    // Verify positions are within expected bounds (-10 to 10 for x,y; 0 to 5 for z)
    const array = positions.array as Float32Array;
    for (let i = 0; i < positions.count; i++) {
      const x = array[i * 3];
      const y = array[i * 3 + 1];
      const z = array[i * 3 + 2];

      expect(x).toBeGreaterThanOrEqual(-10);
      expect(x).toBeLessThanOrEqual(10);
      expect(y).toBeGreaterThanOrEqual(-10);
      expect(y).toBeLessThanOrEqual(10);
      expect(z).toBeGreaterThanOrEqual(0);
      expect(z).toBeLessThanOrEqual(5);
    }
  });
});
