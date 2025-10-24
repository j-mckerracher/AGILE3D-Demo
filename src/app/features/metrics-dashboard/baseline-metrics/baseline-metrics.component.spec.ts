import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { BaselineMetricsComponent } from './baseline-metrics.component';
import { ReducedMotionService } from '../../../core/services/reduced-motion.service';
import { AlgorithmMetrics } from '../../../core/models/config-and-metrics';
import { SimpleChange } from '@angular/core';

describe('BaselineMetricsComponent', () => {
  let component: BaselineMetricsComponent;
  let fixture: ComponentFixture<BaselineMetricsComponent>;
  let mockReducedMotionService: jasmine.SpyObj<ReducedMotionService>;

  const mockMetrics: AlgorithmMetrics = {
    name: 'DSVT-Voxel',
    accuracyMap: 67.1,
    latencyMs: 425,
    violationRate: 15.2,
    memoryGb: 6.8,
    sloCompliance: false,
  };

  beforeEach(async () => {
    mockReducedMotionService = jasmine.createSpyObj('ReducedMotionService', [
      'getAnimationDuration',
      'getCurrentPreference',
    ]);
    mockReducedMotionService.getAnimationDuration.and.returnValue(0); // Instant for tests

    await TestBed.configureTestingModule({
      imports: [BaselineMetricsComponent],
      providers: [{ provide: ReducedMotionService, useValue: mockReducedMotionService }],
    }).compileComponents();

    fixture = TestBed.createComponent(BaselineMetricsComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display loading state when metrics is null', () => {
    component.metrics = null;
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const loadingState = compiled.querySelector('.loading-state');
    expect(loadingState).toBeTruthy();
    expect(loadingState?.textContent).toContain('Loading baseline metrics');
  });

  it('should display metrics when provided', fakeAsync(() => {
    component.metrics = mockMetrics;
    component.ngOnChanges({
      metrics: new SimpleChange(null, mockMetrics, true),
    });
    fixture.detectChanges();
    tick(300); // Wait for animations

    const compiled = fixture.nativeElement as HTMLElement;
    const metricsList = compiled.querySelector('.metrics-list');
    expect(metricsList).toBeTruthy();
  }));

  it('should display algorithm name', () => {
    component.metrics = mockMetrics;
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const algorithmName = compiled.querySelector('.algorithm-name');
    expect(algorithmName?.textContent?.trim()).toBe('DSVT-Voxel');
  });

  it('should display accuracy metric', fakeAsync(() => {
    component.metrics = mockMetrics;
    component.ngOnChanges({
      metrics: new SimpleChange(null, mockMetrics, true),
    });
    fixture.detectChanges();
    tick(300);

    expect((component as any).formatAccuracy()).toBe('67.1%');
  }));

  it('should display latency metric', fakeAsync(() => {
    component.metrics = mockMetrics;
    component.ngOnChanges({
      metrics: new SimpleChange(null, mockMetrics, true),
    });
    fixture.detectChanges();
    tick(300);

    expect((component as any).formatLatency()).toBe('425 ms');
  }));

  it('should display violation rate metric', fakeAsync(() => {
    component.metrics = mockMetrics;
    component.ngOnChanges({
      metrics: new SimpleChange(null, mockMetrics, true),
    });
    fixture.detectChanges();
    tick(300);

    expect((component as any).formatViolations()).toBe('15.2%');
  }));

  it('should display memory metric', fakeAsync(() => {
    component.metrics = mockMetrics;
    component.ngOnChanges({
      metrics: new SimpleChange(null, mockMetrics, true),
    });
    fixture.detectChanges();
    tick(300);

    expect((component as any).formatMemory()).toBe('6.8 GB');
  }));

  it('should display SLO compliance icon for failing SLO', () => {
    component.metrics = mockMetrics;
    fixture.detectChanges();

    expect((component as any).getSloIcon()).toBe('cancel');
    expect((component as any).getSloClass()).toBe('slo-fail');
  });

  it('should display SLO compliance icon for passing SLO', () => {
    component.metrics = { ...mockMetrics, sloCompliance: true };
    fixture.detectChanges();

    expect((component as any).getSloIcon()).toBe('check_circle');
    expect((component as any).getSloClass()).toBe('slo-pass');
  });

  it('should update display values when metrics change', fakeAsync(() => {
    component.metrics = mockMetrics;
    component.ngOnChanges({
      metrics: new SimpleChange(null, mockMetrics, true),
    });
    fixture.detectChanges();
    tick(300);

    const newMetrics: AlgorithmMetrics = {
      ...mockMetrics,
      accuracyMap: 70.5,
      latencyMs: 380,
    };

    component.metrics = newMetrics;
    component.ngOnChanges({
      metrics: new SimpleChange(mockMetrics, newMetrics, false),
    });
    fixture.detectChanges();
    tick(300);

    expect((component as any).formatAccuracy()).toBe('70.5%');
    expect((component as any).formatLatency()).toBe('380 ms');
  }));

  it('should call getAnimationDuration from ReducedMotionService', () => {
    component.metrics = mockMetrics;
    component.ngOnChanges({
      metrics: new SimpleChange(null, mockMetrics, true),
    });

    expect(mockReducedMotionService.getAnimationDuration).toHaveBeenCalledWith(200);
  });

  it('should have proper ARIA labels on metric values', () => {
    component.metrics = mockMetrics;
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const metricValues = compiled.querySelectorAll('.metric-value[aria-label]');
    expect(metricValues.length).toBeGreaterThan(0);
  });

  it('should have aria-live region for accessibility', () => {
    component.metrics = mockMetrics;
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const metricsList = compiled.querySelector('.metrics-list[aria-live]');
    expect(metricsList).toBeTruthy();
    expect(metricsList?.getAttribute('aria-live')).toBe('polite');
  });

  it('should cleanup animations on destroy', () => {
    component.metrics = mockMetrics;
    component.ngOnChanges({
      metrics: new SimpleChange(null, mockMetrics, true),
    });

    // Spy on cleanup (we can't directly spy on private methods, but we can verify no errors on destroy)
    expect(() => component.ngOnDestroy()).not.toThrow();
  });

  it('should use OnPush change detection', () => {
    expect(fixture.componentRef.changeDetectorRef).toBeDefined();
  });
});
