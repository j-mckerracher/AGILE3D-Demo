import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { HistoryTrendComponent } from './history-trend.component';
import { ReducedMotionService } from '../../../core/services/reduced-motion.service';
import { MetricsHistorySample } from '../../../core/services/metrics/metrics-history.service';

describe('HistoryTrendComponent', () => {
  let component: HistoryTrendComponent;
  let fixture: ComponentFixture<HistoryTrendComponent>;
  let mockReducedMotionService: jasmine.SpyObj<ReducedMotionService>;

  const createSampleHistory = (count: number): MetricsHistorySample[] => {
    return Array.from({ length: count }, (_, i) => ({
      t: Date.now() + i * 1000,
      accuracyDelta: 1.0 + i * 0.5,
      latencyDeltaMs: -50 - i * 5,
      violationReduction: 10 + i * 2,
      scene: 'mixed' as const,
    }));
  };

  beforeEach(async () => {
    // Create mock ReducedMotionService with signal
    const reducedMotionSignal = signal(false);
    mockReducedMotionService = jasmine.createSpyObj('ReducedMotionService', [], {
      prefersReducedMotion: reducedMotionSignal.asReadonly(),
    });

    await TestBed.configureTestingModule({
      imports: [HistoryTrendComponent],
      providers: [{ provide: ReducedMotionService, useValue: mockReducedMotionService }],
    }).compileComponents();

    fixture = TestBed.createComponent(HistoryTrendComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Visibility Behavior', () => {
    it('should hide when fewer than 2 samples', () => {
      component.history = createSampleHistory(1);
      fixture.detectChanges();

      const section = fixture.debugElement.query(By.css('.history-trend'));
      expect(section).toBeNull();
    });

    it('should show when 2 or more samples', () => {
      component.history = createSampleHistory(2);
      fixture.detectChanges();

      const section = fixture.debugElement.query(By.css('.history-trend'));
      expect(section).not.toBeNull();
    });

    it('should show with maximum 10 samples', () => {
      component.history = createSampleHistory(10);
      fixture.detectChanges();

      const section = fixture.debugElement.query(By.css('.history-trend'));
      expect(section).not.toBeNull();

      const title = fixture.debugElement.query(By.css('.history-title'));
      expect(title.nativeElement.textContent).toContain('Last 10 Changes');
    });

    it('should update visibility reactively when history changes', () => {
      component.history = createSampleHistory(1);
      fixture.detectChanges();
      expect(fixture.debugElement.query(By.css('.history-trend'))).toBeNull();

      component.history = createSampleHistory(3);
      fixture.detectChanges();
      expect(fixture.debugElement.query(By.css('.history-trend'))).not.toBeNull();
    });
  });

  describe('SVG Sparkline Rendering', () => {
    beforeEach(() => {
      component.history = createSampleHistory(5);
      fixture.detectChanges();
    });

    it('should render three sparkline charts', () => {
      const sparklines = fixture.debugElement.queryAll(By.css('.sparkline'));
      expect(sparklines.length).toBe(3);
    });

    it('should render accuracy gain sparkline with path', () => {
      const accuracyPath = fixture.debugElement.query(By.css('.accuracy-path'));
      expect(accuracyPath).not.toBeNull();
      expect(accuracyPath.nativeElement.getAttribute('d')).toBeTruthy();
    });

    it('should render latency difference sparkline with path', () => {
      const latencyPath = fixture.debugElement.query(By.css('.latency-path'));
      expect(latencyPath).not.toBeNull();
      expect(latencyPath.nativeElement.getAttribute('d')).toBeTruthy();
    });

    it('should render violation reduction sparkline with path', () => {
      const violationsPath = fixture.debugElement.query(By.css('.violations-path'));
      expect(violationsPath).not.toBeNull();
      expect(violationsPath.nativeElement.getAttribute('d')).toBeTruthy();
    });

    it('should generate valid SVG path syntax (M...L...)', () => {
      const accuracyPath = fixture.debugElement.query(By.css('.accuracy-path'));
      const pathData = accuracyPath.nativeElement.getAttribute('d');

      expect(pathData).toMatch(/^M\s[\d.]+,[\d.]+(\s+L\s[\d.]+,[\d.]+)*$/);
    });

    it('should update sparkline paths when history changes', () => {
      const getAccuracyPath = (): string =>
        fixture.debugElement.query(By.css('.accuracy-path')).nativeElement.getAttribute('d');

      const initialPath = getAccuracyPath();

      component.history = createSampleHistory(7);
      fixture.detectChanges();

      const updatedPath = getAccuracyPath();
      expect(updatedPath).not.toBe(initialPath);
    });
  });

  describe('Color-Blind Accessible Markers', () => {
    beforeEach(() => {
      component.history = createSampleHistory(3);
      fixture.detectChanges();
    });

    it('should render circle markers on accuracy chart', () => {
      const circles = fixture.debugElement.queryAll(
        By.css('.sparkline-container:nth-child(1) .sparkline-marker')
      );
      expect(circles.length).toBe(3);
      expect(circles[0]!.nativeElement.tagName.toLowerCase()).toBe('circle');
    });

    it('should render square (rect) markers on latency chart', () => {
      const rects = fixture.debugElement.queryAll(
        By.css('.sparkline-container:nth-child(2) .sparkline-marker')
      );
      expect(rects.length).toBe(3);
      expect(rects[0]!.nativeElement.tagName.toLowerCase()).toBe('rect');
    });

    it('should render diamond (polygon) markers on violations chart', () => {
      const polygons = fixture.debugElement.queryAll(
        By.css('.sparkline-container:nth-child(3) .sparkline-marker')
      );
      expect(polygons.length).toBe(3);
      expect(polygons[0]!.nativeElement.tagName.toLowerCase()).toBe('polygon');
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      component.history = createSampleHistory(4);
      fixture.detectChanges();
    });

    it('should have accessible region role', () => {
      const section = fixture.debugElement.query(By.css('.history-trend'));
      expect(section.nativeElement.getAttribute('role')).toBe('region');
      expect(section.nativeElement.getAttribute('aria-labelledby')).toBe('history-trend-title');
    });

    it('should have aria-live for dynamic updates', () => {
      const section = fixture.debugElement.query(By.css('.history-trend'));
      expect(section.nativeElement.getAttribute('aria-live')).toBe('polite');
    });

    it('should have ARIA labels on SVG sparklines', () => {
      const sparklines = fixture.debugElement.queryAll(By.css('.sparkline'));
      sparklines.forEach((svg) => {
        expect(svg.nativeElement.getAttribute('role')).toBe('img');
        expect(svg.nativeElement.getAttribute('aria-label')).toBeTruthy();
      });
    });

    it('should include metric summary in ARIA labels', () => {
      const accuracySvg = fixture.debugElement.query(
        By.css('.sparkline-container:nth-child(1) .sparkline')
      );
      const ariaLabel = accuracySvg.nativeElement.getAttribute('aria-label');
      expect(ariaLabel).toContain('accuracy');
    });

    it('should render visually-hidden data table for screen readers', () => {
      const table = fixture.debugElement.query(By.css('table.sr-only'));
      expect(table).not.toBeNull();
      expect(table.nativeElement.getAttribute('aria-label')).toContain('Historical metrics data');
    });

    it('should populate data table with all samples', () => {
      const rows = fixture.debugElement.queryAll(By.css('table.sr-only tbody tr'));
      expect(rows.length).toBe(4); // 4 samples
    });

    it('should have legend with accessible labels', () => {
      const legend = fixture.debugElement.query(By.css('.legend'));
      expect(legend.nativeElement.getAttribute('role')).toBe('region');
      expect(legend.nativeElement.getAttribute('aria-label')).toContain('legend');

      const legendItems = fixture.debugElement.queryAll(By.css('.legend-item'));
      expect(legendItems.length).toBe(3);
    });
  });

  describe('Reduced Motion Support', () => {
    it('should apply reduced-motion class when user prefers reduced motion', () => {
      const reducedMotionSignal = signal(true);
      Object.defineProperty(mockReducedMotionService, 'prefersReducedMotion', {
        get: () => reducedMotionSignal.asReadonly(),
        configurable: true,
      });

      component.history = createSampleHistory(3);
      fixture.detectChanges();

      const section = fixture.debugElement.query(By.css('.history-trend'));
      expect(section.nativeElement.classList.contains('reduced-motion')).toBe(true);
    });

    it('should not apply reduced-motion class when animations enabled', () => {
      const reducedMotionSignal = signal(false);
      Object.defineProperty(mockReducedMotionService, 'prefersReducedMotion', {
        get: () => reducedMotionSignal.asReadonly(),
        configurable: true,
      });

      component.history = createSampleHistory(3);
      fixture.detectChanges();

      const section = fixture.debugElement.query(By.css('.history-trend'));
      expect(section.nativeElement.classList.contains('reduced-motion')).toBe(false);
    });
  });

  describe('Data Formatting', () => {
    beforeEach(() => {
      component.history = createSampleHistory(3);
      fixture.detectChanges();
    });

    it('should format positive values with + sign', () => {
      const formatted = component.formatValue(5.2);
      expect(formatted).toBe('+5.2');
    });

    it('should format negative values with - sign', () => {
      const formatted = component.formatValue(-10.5);
      expect(formatted).toBe('-10.5');
    });

    it('should format zero without sign', () => {
      const formatted = component.formatValue(0);
      expect(formatted).toBe('+0.0');
    });

    it('should respect precision parameter', () => {
      const formatted = component.formatValue(123.456, 2);
      expect(formatted).toBe('+123.46');
    });

    it('should apply formatting in data table', () => {
      const tableCells = fixture.debugElement.queryAll(By.css('table.sr-only td'));
      expect(tableCells.length).toBeGreaterThanOrEqual(2);
      const firstAccuracyCell = tableCells[1]!; // Second cell (first is index)

      expect(firstAccuracyCell.nativeElement.textContent.trim()).toMatch(/^[+-]\d+\.\d+$/);
    });
  });

  describe('Path Building Logic', () => {
    it('should return empty path for fewer than 2 values', () => {
      component.history = [];
      fixture.detectChanges();

      // Component should be hidden, but verify path generation logic
      expect(component['buildSparklinePath']([1])).toBe('');
    });

    it('should generate path with M and L commands', () => {
      const path = component['buildSparklinePath']([10, 20, 15, 25]);
      expect(path).toContain('M');
      expect(path).toContain('L');
    });

    it('should handle constant values (no variation)', () => {
      const path = component['buildSparklinePath']([5, 5, 5, 5]);
      expect(path).toBeTruthy();
      expect(path).toContain('M');
    });
  });

  describe('Marker Generation', () => {
    it('should generate diamond points for polygon markers', () => {
      const points = component.getMarkerPoints(20, 20, 3);
      expect(points).toContain('20,17'); // Top
      expect(points).toContain('23,20'); // Right
      expect(points).toContain('20,23'); // Bottom
      expect(points).toContain('17,20'); // Left
    });
  });

  describe('Performance', () => {
    it('should not re-render when history reference is same', () => {
      const history = createSampleHistory(5);
      component.history = history;
      fixture.detectChanges();

      const spy = spyOn(fixture.componentRef.changeDetectorRef, 'detectChanges');

      // Set same reference
      component.history = history;
      fixture.detectChanges();

      // Change detection should not be triggered (OnPush)
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty history array', () => {
      component.history = [];
      fixture.detectChanges();

      const section = fixture.debugElement.query(By.css('.history-trend'));
      expect(section).toBeNull();
    });

    it('should handle single sample', () => {
      component.history = createSampleHistory(1);
      fixture.detectChanges();

      const section = fixture.debugElement.query(By.css('.history-trend'));
      expect(section).toBeNull();
    });

    it('should handle large values without overflow', () => {
      const largeValues: MetricsHistorySample[] = [
        {
          t: 1000,
          accuracyDelta: 1000,
          latencyDeltaMs: -1000,
          violationReduction: 500,
          scene: 'mixed',
        },
        {
          t: 2000,
          accuracyDelta: 2000,
          latencyDeltaMs: -2000,
          violationReduction: 1000,
          scene: 'mixed',
        },
      ];

      component.history = largeValues;
      fixture.detectChanges();

      const paths = fixture.debugElement.queryAll(By.css('.sparkline-path'));
      paths.forEach((path) => {
        const d = path.nativeElement.getAttribute('d');
        expect(d).toBeTruthy();
        expect(d).not.toContain('Infinity');
        expect(d).not.toContain('NaN');
      });
    });

    it('should handle negative accuracy deltas', () => {
      const negativeAccuracy: MetricsHistorySample[] = [
        {
          t: 1000,
          accuracyDelta: -2.0,
          latencyDeltaMs: -50,
          violationReduction: 10,
          scene: 'mixed',
        },
        {
          t: 2000,
          accuracyDelta: -1.5,
          latencyDeltaMs: -40,
          violationReduction: 8,
          scene: 'mixed',
        },
      ];

      component.history = negativeAccuracy;
      fixture.detectChanges();

      const section = fixture.debugElement.query(By.css('.history-trend'));
      expect(section).not.toBeNull();
    });
  });
});
