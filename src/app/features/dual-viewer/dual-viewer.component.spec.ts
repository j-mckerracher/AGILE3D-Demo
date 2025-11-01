import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DualViewerComponent } from './dual-viewer.component';
import { FrameStreamService } from '../../core/services/frame-stream/frame-stream.service';
import { SceneDataService } from '../../core/services/data/scene-data.service';
import { BehaviorSubject } from 'rxjs';

describe('DualViewerComponent', () => {
  let component: DualViewerComponent;
  let fixture: ComponentFixture<DualViewerComponent>;
  let frameStreamServiceSpy: jasmine.SpyObj<FrameStreamService>;
  let sceneDataServiceSpy: jasmine.SpyObj<SceneDataService>;

  beforeEach(async () => {
    // Create mock services
    frameStreamServiceSpy = jasmine.createSpyObj('FrameStreamService', ['applyFrame'], {
      currentFrame$: new BehaviorSubject({
        id: 'frame_001',
        index: 0,
        pointsUrl: 'test.bin',
        pointsBuffer: new ArrayBuffer(0),
        detections: {},
        branch: 'baseline',
      }),
    });

    sceneDataServiceSpy = jasmine.createSpyObj(
      'SceneDataService',
      ['applyFrame', 'geometry$', 'detections$', 'state$'],
      {
        geometry$: () => new BehaviorSubject(null),
        detections$: () => new BehaviorSubject([]),
        state$: () => new BehaviorSubject({ pointCount: 0, maxCapacity: 0, needsRealloc: false }),
      }
    );

    await TestBed.configureTestingModule({
      imports: [DualViewerComponent],
      providers: [
        { provide: FrameStreamService, useValue: frameStreamServiceSpy },
        { provide: SceneDataService, useValue: sceneDataServiceSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DualViewerComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('should create component', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize renderers with correct dimensions', () => {
    fixture.detectChanges();

    expect(component['baselineRenderer']).toBeDefined();
    expect(component['activeRenderer']).toBeDefined();
    expect(component['baselineScene']).toBeDefined();
    expect(component['activeScene']).toBeDefined();
  });

  it('should clamp DPR to 1.5 for Safari', () => {
    const originalDPR = window.devicePixelRatio;
    Object.defineProperty(window, 'devicePixelRatio', {
      writable: true,
      value: 2.0,
    });

    fixture.detectChanges();

    // Should clamp to 1.5
    expect(component['baselineRenderer'].getPixelRatio()).toBeLessThanOrEqual(1.5);

    // Restore
    Object.defineProperty(window, 'devicePixelRatio', {
      writable: true,
      value: originalDPR,
    });
  });

  it('should subscribe to frame stream updates', (done) => {
    fixture.detectChanges();

    const frameSubject = frameStreamServiceSpy.currentFrame$ as BehaviorSubject<any>;
    frameSubject.next({
      id: 'frame_002',
      index: 1,
      pointsUrl: 'test2.bin',
      branch: 'baseline',
    });

    fixture.detectChanges();
    fixture.whenStable().then(() => {
      expect(component.currentFrameId).toBe('frame_002');
      done();
    });
  });

  it('should sync frame id across both panes', (done) => {
    fixture.detectChanges();

    const frameSubject = frameStreamServiceSpy.currentFrame$ as BehaviorSubject<any>;
    frameSubject.next({
      id: 'frame_test_123',
      index: 0,
      pointsUrl: 'test.bin',
    });

    fixture.detectChanges();
    fixture.whenStable().then(() => {
      expect(component.currentFrameId).toBe('frame_test_123');
      done();
    });
  });

  it('should apply frame data to scene data service', (done) => {
    fixture.detectChanges();

    const frameSubject = frameStreamServiceSpy.currentFrame$ as BehaviorSubject<any>;
    const testFrame = {
      id: 'frame_apply_test',
      index: 0,
      pointsUrl: 'test.bin',
    };

    frameSubject.next(testFrame);

    fixture.detectChanges();
    fixture.whenStable().then(() => {
      expect(sceneDataServiceSpy.applyFrame).toHaveBeenCalledWith(testFrame);
      done();
    });
  });

  it('should set loading state to false after frame received', (done) => {
    expect(component.isLoading).toBeTruthy();

    fixture.detectChanges();

    const frameSubject = frameStreamServiceSpy.currentFrame$ as BehaviorSubject<any>;
    frameSubject.next({
      id: 'frame_001',
      index: 0,
      pointsUrl: 'test.bin',
    });

    fixture.detectChanges();
    fixture.whenStable().then(() => {
      expect(component.isLoading).toBeFalsy();
      done();
    });
  });

  it('should render both canvas elements', () => {
    fixture.detectChanges();

    const canvases = fixture.nativeElement.querySelectorAll('.viewer-canvas');
    expect(canvases.length).toBe(2);
  });

  it('should have responsive layout with divider', () => {
    fixture.detectChanges();

    const divider = fixture.nativeElement.querySelector('.divider');
    expect(divider).toBeTruthy();
  });

  it('should display frame info in both panes', (done) => {
    fixture.detectChanges();

    const frameSubject = frameStreamServiceSpy.currentFrame$ as BehaviorSubject<any>;
    frameSubject.next({
      id: 'frame_info_test',
      index: 0,
      pointsUrl: 'test.bin',
    });

    fixture.detectChanges();
    fixture.whenStable().then(() => {
      const frameInfos = fixture.nativeElement.querySelectorAll('.frame-info');
      expect(frameInfos.length).toBe(2);
      frameInfos.forEach((info: HTMLElement) => {
        expect(info.textContent).toContain('frame_info_test');
      });
      done();
    });
  });

  it('should have baseline and active pane labels', () => {
    fixture.detectChanges();

    const labels = fixture.nativeElement.querySelectorAll('.viewer-label');
    expect(labels.length).toBe(2);
    expect(labels[0].textContent).toContain('Baseline');
    expect(labels[1].textContent).toContain('Active');
  });

  it('should dispose resources on destroy', () => {
    fixture.detectChanges();

    spyOn(component['baselineRenderer'], 'dispose');
    spyOn(component['activeRenderer'], 'dispose');

    component.ngOnDestroy();

    expect(component['baselineRenderer'].dispose).toHaveBeenCalled();
    expect(component['activeRenderer'].dispose).toHaveBeenCalled();
  });

  it('should have accessibility attributes', () => {
    fixture.detectChanges();

    const container = fixture.nativeElement.querySelector('.dual-viewer-container');
    expect(container.getAttribute('role')).toBe('region');

    const canvas1 = fixture.nativeElement.querySelector('.baseline-pane .viewer-canvas');
    expect(canvas1.getAttribute('aria-label')).toBeTruthy();

    const canvas2 = fixture.nativeElement.querySelector('.active-pane .viewer-canvas');
    expect(canvas2.getAttribute('aria-label')).toBeTruthy();
  });
});
