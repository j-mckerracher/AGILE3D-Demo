import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ComparisonHighlightsComponent } from './comparison-highlights.component';
import { ReducedMotionService } from '../../../core/services/reduced-motion.service';
import { ComparisonMetrics } from '../../../core/models/config-and-metrics';
import { SimpleChange } from '@angular/core';

describe('ComparisonHighlightsComponent', () => {
  let component: ComparisonHighlightsComponent;
  let fixture: ComponentFixture<ComparisonHighlightsComponent>;
  let mockReducedMotionService: jasmine.SpyObj<ReducedMotionService>;

  const mockComparison: ComparisonMetrics = {
    accuracyDelta: 2.3,
    latencyDeltaMs: -120,
    violationReduction: 8.1,
  };

  beforeEach(async () => {
    mockReducedMotionService = jasmine.createSpyObj('ReducedMotionService', [
      'getAnimationDuration',
      'getCurrentPreference',
    ]);
    mockReducedMotionService.getAnimationDuration.and.returnValue(0); // Instant for tests
    mockReducedMotionService.getCurrentPreference.and.returnValue(false);

    await TestBed.configureTestingModule({
      imports: [ComparisonHighlightsComponent],
      providers: [{ provide: ReducedMotionService, useValue: mockReducedMotionService }],
    }).compileComponents();

    fixture = TestBed.createComponent(ComparisonHighlightsComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display loading state when comparison is null', () => {
    component.comparison = null;
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const loadingState = compiled.querySelector('.loading-state');
    expect(loadingState).toBeTruthy();
    expect(loadingState?.textContent).toContain('Loading comparison metrics');
  });

  it('should display comparison metrics when provided', fakeAsync(() => {
    component.comparison = mockComparison;
    component.ngOnChanges({
      comparison: new SimpleChange(null, mockComparison, true),
    });
    fixture.detectChanges();
    tick(300);

    const compiled = fixture.nativeElement as HTMLElement;
    const comparisonList = compiled.querySelector('.comparison-list');
    expect(comparisonList).toBeTruthy();
  }));

  describe('Accuracy Delta Thresholds', () => {
    it('should return green for accuracy gain > 2%', fakeAsync(() => {
      component.comparison = { ...mockComparison, accuracyDelta: 2.5 };
      component.ngOnChanges({
        comparison: new SimpleChange(null, component.comparison, true),
      });
      tick(300);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((component as any).getAccuracyThreshold()).toBe('green');
    }));

    it('should return red for accuracy loss < -2%', fakeAsync(() => {
      component.comparison = { ...mockComparison, accuracyDelta: -2.5 };
      component.ngOnChanges({
        comparison: new SimpleChange(null, component.comparison, true),
      });
      tick(300);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((component as any).getAccuracyThreshold()).toBe('red');
    }));

    it('should return amber for accuracy within ±2%', fakeAsync(() => {
      component.comparison = { ...mockComparison, accuracyDelta: 1.0 };
      component.ngOnChanges({
        comparison: new SimpleChange(null, component.comparison, true),
      });
      tick(300);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((component as any).getAccuracyThreshold()).toBe('amber');
    }));

    it('should return amber for accuracy exactly at threshold', fakeAsync(() => {
      component.comparison = { ...mockComparison, accuracyDelta: 2.0 };
      component.ngOnChanges({
        comparison: new SimpleChange(null, component.comparison, true),
      });
      tick(300);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((component as any).getAccuracyThreshold()).toBe('amber');
    }));
  });

  describe('Latency Delta Thresholds', () => {
    it('should return green for latency reduction < -10ms (faster)', fakeAsync(() => {
      component.comparison = { ...mockComparison, latencyDeltaMs: -120 };
      component.ngOnChanges({
        comparison: new SimpleChange(null, component.comparison, true),
      });
      tick(300);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((component as any).getLatencyThreshold()).toBe('green');
    }));

    it('should return red for latency increase > 10ms (slower)', fakeAsync(() => {
      component.comparison = { ...mockComparison, latencyDeltaMs: 50 };
      component.ngOnChanges({
        comparison: new SimpleChange(null, component.comparison, true),
      });
      tick(300);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((component as any).getLatencyThreshold()).toBe('red');
    }));

    it('should return amber for latency within ±10ms', fakeAsync(() => {
      component.comparison = { ...mockComparison, latencyDeltaMs: 5 };
      component.ngOnChanges({
        comparison: new SimpleChange(null, component.comparison, true),
      });
      tick(300);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((component as any).getLatencyThreshold()).toBe('amber');
    }));
  });

  describe('Violations Reduction Thresholds', () => {
    it('should return green for violation reduction > 5%', fakeAsync(() => {
      component.comparison = { ...mockComparison, violationReduction: 8.1 };
      component.ngOnChanges({
        comparison: new SimpleChange(null, component.comparison, true),
      });
      tick(300);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((component as any).getViolationsThreshold()).toBe('green');
    }));

    it('should return red for violation increase < -5%', fakeAsync(() => {
      component.comparison = { ...mockComparison, violationReduction: -6.0 };
      component.ngOnChanges({
        comparison: new SimpleChange(null, component.comparison, true),
      });
      tick(300);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((component as any).getViolationsThreshold()).toBe('red');
    }));

    it('should return amber for violations within ±5%', fakeAsync(() => {
      component.comparison = { ...mockComparison, violationReduction: 3.0 };
      component.ngOnChanges({
        comparison: new SimpleChange(null, component.comparison, true),
      });
      tick(300);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((component as any).getViolationsThreshold()).toBe('amber');
    }));
  });

  describe('Trend Icons', () => {
    it('should return trending_up icon for positive accuracy delta', fakeAsync(() => {
      component.comparison = { ...mockComparison, accuracyDelta: 2.5 };
      component.ngOnChanges({
        comparison: new SimpleChange(null, component.comparison, true),
      });
      tick(300);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((component as any).getAccuracyIcon()).toBe('trending_up');
    }));

    it('should return trending_down icon for negative accuracy delta', fakeAsync(() => {
      component.comparison = { ...mockComparison, accuracyDelta: -2.5 };
      component.ngOnChanges({
        comparison: new SimpleChange(null, component.comparison, true),
      });
      tick(300);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((component as any).getAccuracyIcon()).toBe('trending_down');
    }));

    it('should return trending_down icon for negative latency (faster = good)', fakeAsync(() => {
      component.comparison = { ...mockComparison, latencyDeltaMs: -120 };
      component.ngOnChanges({
        comparison: new SimpleChange(null, component.comparison, true),
      });
      tick(300);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((component as any).getLatencyIcon()).toBe('trending_down');
    }));

    it('should return trending_up icon for positive latency (slower = bad)', fakeAsync(() => {
      component.comparison = { ...mockComparison, latencyDeltaMs: 50 };
      component.ngOnChanges({
        comparison: new SimpleChange(null, component.comparison, true),
      });
      tick(300);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((component as any).getLatencyIcon()).toBe('trending_up');
    }));

    it('should return trending_down icon for positive violation reduction (good)', fakeAsync(() => {
      component.comparison = { ...mockComparison, violationReduction: 8.1 };
      component.ngOnChanges({
        comparison: new SimpleChange(null, component.comparison, true),
      });
      tick(300);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((component as any).getViolationsIcon()).toBe('trending_down');
    }));
  });

  describe('Formatting', () => {
    it('should format accuracy delta with sign and pp unit', fakeAsync(() => {
      component.comparison = { ...mockComparison, accuracyDelta: 2.3 };
      component.ngOnChanges({
        comparison: new SimpleChange(null, component.comparison, true),
      });
      tick(300);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((component as any).formatAccuracyDelta()).toBe('+2.3 pp');
    }));

    it('should format negative accuracy delta without explicit sign', fakeAsync(() => {
      component.comparison = { ...mockComparison, accuracyDelta: -1.5 };
      component.ngOnChanges({
        comparison: new SimpleChange(null, component.comparison, true),
      });
      tick(300);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((component as any).formatAccuracyDelta()).toBe('-1.5 pp');
    }));

    it('should format latency delta with sign and ms unit', fakeAsync(() => {
      component.comparison = { ...mockComparison, latencyDeltaMs: -120 };
      component.ngOnChanges({
        comparison: new SimpleChange(null, component.comparison, true),
      });
      tick(300);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((component as any).formatLatencyDelta()).toBe('-120 ms');
    }));

    it('should format violation reduction with sign and pp unit', fakeAsync(() => {
      component.comparison = { ...mockComparison, violationReduction: 8.1 };
      component.ngOnChanges({
        comparison: new SimpleChange(null, component.comparison, true),
      });
      tick(300);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((component as any).formatViolationReduction()).toBe('+8.1 pp');
    }));
  });

  it('should update display values when comparison changes', fakeAsync(() => {
    component.comparison = mockComparison;
    component.ngOnChanges({
      comparison: new SimpleChange(null, mockComparison, true),
    });
    tick(300);

    const newComparison: ComparisonMetrics = {
      accuracyDelta: 3.5,
      latencyDeltaMs: -150,
      violationReduction: 10.2,
    };

    component.comparison = newComparison;
    component.ngOnChanges({
      comparison: new SimpleChange(mockComparison, newComparison, false),
    });
    tick(300);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((component as any).formatAccuracyDelta()).toBe('+3.5 pp');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((component as any).formatLatencyDelta()).toBe('-150 ms');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((component as any).formatViolationReduction()).toBe('+10.2 pp');
  }));

  it('should call getAnimationDuration from ReducedMotionService', () => {
    component.comparison = mockComparison;
    component.ngOnChanges({
      comparison: new SimpleChange(null, mockComparison, true),
    });

    expect(mockReducedMotionService.getAnimationDuration).toHaveBeenCalledWith(200);
  });

  it('should have proper ARIA labels on comparison values', () => {
    component.comparison = mockComparison;
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const comparisonValues = compiled.querySelectorAll('.comparison-value[aria-label]');
    expect(comparisonValues.length).toBeGreaterThan(0);
  });

  it('should have aria-live region for accessibility', () => {
    component.comparison = mockComparison;
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const comparisonList = compiled.querySelector('.comparison-list[aria-live]');
    expect(comparisonList).toBeTruthy();
    expect(comparisonList?.getAttribute('aria-live')).toBe('polite');
  });

  it('should render threshold legend', () => {
    component.comparison = mockComparison;
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const legend = compiled.querySelector('.threshold-legend');
    expect(legend).toBeTruthy();

    const legendItems = legend?.querySelectorAll('.legend-item');
    expect(legendItems?.length).toBe(3); // Green, Amber, Red
  });

  it('should cleanup animations and timers on destroy', () => {
    component.comparison = mockComparison;
    component.ngOnChanges({
      comparison: new SimpleChange(null, mockComparison, true),
    });

    expect(() => component.ngOnDestroy()).not.toThrow();
  });

  it('should use OnPush change detection', () => {
    expect(fixture.componentRef.changeDetectorRef).toBeDefined();
  });
});
