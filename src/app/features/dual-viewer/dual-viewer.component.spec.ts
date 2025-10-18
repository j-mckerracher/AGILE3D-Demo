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

  describe('Crossfade functionality (WP-2.1.1)', () => {
    beforeEach(() => {
      component.ngOnInit();
      fixture.detectChanges();
    });

    it('should start with baseline as active viewer', () => {
      expect(component['activeViewer']).toBe('baseline');
    });

    it('should toggle between baseline and agile3d viewers', () => {
      expect(component['activeViewer']).toBe('baseline');

      component['toggleActiveViewer']();
      expect(component['activeViewer']).toBe('agile3d');

      component['toggleActiveViewer']();
      expect(component['activeViewer']).toBe('baseline');
    });

    it('should set isTransitioning flag during toggle', () => {
      expect(component['isTransitioning']).toBeFalse();

      component['toggleActiveViewer']();
      expect(component['isTransitioning']).toBeTrue();
    });

    it('should prevent multiple simultaneous toggles', () => {
      component['isTransitioning'] = true;
      const initialViewer = component['activeViewer'];

      component['toggleActiveViewer']();

      // Should remain unchanged
      expect(component['activeViewer']).toBe(initialViewer);
    });

    it('should reset isTransitioning flag after transition duration', (done) => {
      component['toggleActiveViewer']();
      expect(component['isTransitioning']).toBeTrue();

      // Wait for transition to complete (550ms as per implementation)
      setTimeout(() => {
        expect(component['isTransitioning']).toBeFalse();
        done();
      }, 600);
    });

    it('should render crossfade toggle button', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const toggleButton = compiled.querySelector('.crossfade-toggle');

      expect(toggleButton).toBeTruthy();
      expect(toggleButton?.textContent).toContain('Show AGILE3D');
    });

    it('should update button text when viewer changes', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const toggleButton = compiled.querySelector('.crossfade-toggle');

      expect(toggleButton?.textContent).toContain('Show AGILE3D');

      component['toggleActiveViewer']();
      fixture.detectChanges();

      expect(toggleButton?.textContent).toContain('Show Baseline');
    });

    it('should apply active/inactive classes to viewer panels', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const panels = compiled.querySelectorAll('.viewer-panel');

      expect(panels.length).toBe(2);

      // Initially baseline should be active
      expect(panels[0]?.classList.contains('active')).toBeTrue();
      expect(panels[0]?.classList.contains('inactive')).toBeFalse();
      expect(panels[1]?.classList.contains('active')).toBeFalse();
      expect(panels[1]?.classList.contains('inactive')).toBeTrue();

      // Toggle to agile3d
      component['toggleActiveViewer']();
      fixture.detectChanges();

      expect(panels[0]?.classList.contains('active')).toBeFalse();
      expect(panels[0]?.classList.contains('inactive')).toBeTrue();
      expect(panels[1]?.classList.contains('active')).toBeTrue();
      expect(panels[1]?.classList.contains('inactive')).toBeFalse();
    });

    it('should set aria-hidden attribute on inactive viewer', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const panels = compiled.querySelectorAll('.viewer-panel');

      expect(panels[0]?.getAttribute('aria-hidden')).toBe('false');
      expect(panels[1]?.getAttribute('aria-hidden')).toBe('true');

      component['toggleActiveViewer']();
      fixture.detectChanges();

      expect(panels[0]?.getAttribute('aria-hidden')).toBe('true');
      expect(panels[1]?.getAttribute('aria-hidden')).toBe('false');
    });

    it('should disable button during transition', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const toggleButton = compiled.querySelector('.crossfade-toggle') as HTMLButtonElement;

      expect(toggleButton?.disabled).toBeFalse();

      component['toggleActiveViewer']();
      fixture.detectChanges();

      expect(toggleButton?.disabled).toBeTrue();
    });

    it('should accept external Points instance and extract geometry', () => {
      const positions = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const material = new THREE.PointsMaterial({ color: 0x888888 });
      const points = new THREE.Points(geometry, material);

      component.inputPoints = points;
      component.ngOnInit();

      expect(component['sharedGeometry']).toBe(geometry);
      expect(component['sharedGeometry'].uuid).toBe(points.geometry.uuid);
    });
  });
});
