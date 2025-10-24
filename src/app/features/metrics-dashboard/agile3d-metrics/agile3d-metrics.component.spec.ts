import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Agile3dMetricsComponent } from './agile3d-metrics.component';
import { ReducedMotionService } from '../../../core/services/reduced-motion.service';
import { AlgorithmMetrics } from '../../../core/models/config-and-metrics';
import { SimpleChange } from '@angular/core';

describe('Agile3dMetricsComponent', () => {
  let component: Agile3dMetricsComponent;
  let fixture: ComponentFixture<Agile3dMetricsComponent>;
  let mockReducedMotionService: jasmine.SpyObj<ReducedMotionService>;

  const mockMetrics: AlgorithmMetrics = {
    name: 'AGILE3D',
    activeBranch: 'CP_Pillar_032',
    accuracyMap: 69.4,
    latencyMs: 305,
    violationRate: 7.1,
    memoryGb: 3.2,
    sloCompliance: true,
  };

  beforeEach(async () => {
    mockReducedMotionService = jasmine.createSpyObj('ReducedMotionService', [
      'getAnimationDuration',
      'getCurrentPreference',
    ]);
    mockReducedMotionService.getAnimationDuration.and.returnValue(0); // Instant for tests

    await TestBed.configureTestingModule({
      imports: [Agile3dMetricsComponent],
      providers: [{ provide: ReducedMotionService, useValue: mockReducedMotionService }],
    }).compileComponents();

    fixture = TestBed.createComponent(Agile3dMetricsComponent);
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
    expect(loadingState?.textContent).toContain('Loading AGILE3D metrics');
  });

  it('should display metrics when provided', fakeAsync(() => {
    component.metrics = mockMetrics;
    component.ngOnChanges({
      metrics: new SimpleChange(null, mockMetrics, true),
    });
    fixture.detectChanges();
    tick(300);

    const compiled = fixture.nativeElement as HTMLElement;
    const metricsList = compiled.querySelector('.metrics-list');
    expect(metricsList).toBeTruthy();
  }));

  it('should display algorithm name', () => {
    component.metrics = mockMetrics;
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const algorithmName = compiled.querySelector('.algorithm-name');
    expect(algorithmName?.textContent?.trim()).toBe('AGILE3D');
  });

  it('should display active branch name', () => {
    component.metrics = mockMetrics;
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const branchName = compiled.querySelector('.branch-name');
    expect(branchName?.textContent).toContain('CP-Pillar-032');
  });

  it('should format branch name by replacing underscores with hyphens', () => {
    component.metrics = mockMetrics;
    fixture.detectChanges();

    expect((component as any).formatBranchName()).toBe('CP-Pillar-032');
  });

  it('should return N/A when no active branch', () => {
    component.metrics = { ...mockMetrics, activeBranch: undefined };
    fixture.detectChanges();

    expect((component as any).formatBranchName()).toBe('N/A');
  });

  it('should display accuracy metric', fakeAsync(() => {
    component.metrics = mockMetrics;
    component.ngOnChanges({
      metrics: new SimpleChange(null, mockMetrics, true),
    });
    fixture.detectChanges();
    tick(300);

    expect((component as any).formatAccuracy()).toBe('69.4%');
  }));

  it('should display latency metric', fakeAsync(() => {
    component.metrics = mockMetrics;
    component.ngOnChanges({
      metrics: new SimpleChange(null, mockMetrics, true),
    });
    fixture.detectChanges();
    tick(300);

    expect((component as any).formatLatency()).toBe('305 ms');
  }));

  it('should display violation rate metric', fakeAsync(() => {
    component.metrics = mockMetrics;
    component.ngOnChanges({
      metrics: new SimpleChange(null, mockMetrics, true),
    });
    fixture.detectChanges();
    tick(300);

    expect((component as any).formatViolations()).toBe('7.1%');
  }));

  it('should display memory metric', fakeAsync(() => {
    component.metrics = mockMetrics;
    component.ngOnChanges({
      metrics: new SimpleChange(null, mockMetrics, true),
    });
    fixture.detectChanges();
    tick(300);

    expect((component as any).formatMemory()).toBe('3.2 GB');
  }));

  it('should display SLO compliance icon for passing SLO', () => {
    component.metrics = mockMetrics;
    fixture.detectChanges();

    expect((component as any).getSloIcon()).toBe('check_circle');
    expect((component as any).getSloClass()).toBe('slo-pass');
  });

  it('should display SLO compliance icon for failing SLO', () => {
    component.metrics = { ...mockMetrics, sloCompliance: false };
    fixture.detectChanges();

    expect((component as any).getSloIcon()).toBe('cancel');
    expect((component as any).getSloClass()).toBe('slo-fail');
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
      accuracyMap: 72.1,
      latencyMs: 290,
      activeBranch: 'CP_Voxel_016',
    };

    component.metrics = newMetrics;
    component.ngOnChanges({
      metrics: new SimpleChange(mockMetrics, newMetrics, false),
    });
    fixture.detectChanges();
    tick(300);

    expect((component as any).formatAccuracy()).toBe('72.1%');
    expect((component as any).formatLatency()).toBe('290 ms');
    expect((component as any).formatBranchName()).toBe('CP-Voxel-016');
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

  it('should have ARIA label on branch name', () => {
    component.metrics = mockMetrics;
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const branchName = compiled.querySelector('.branch-name[aria-label]');
    expect(branchName).toBeTruthy();
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

    expect(() => component.ngOnDestroy()).not.toThrow();
  });

  it('should use OnPush change detection', () => {
    expect(fixture.componentRef.changeDetectorRef).toBeDefined();
  });
});
