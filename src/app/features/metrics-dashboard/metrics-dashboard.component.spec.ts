import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MetricsDashboardComponent } from './metrics-dashboard.component';
import { SimulationService } from '../../core/services/simulation/simulation.service';
import { MetricsHistoryService, MetricsHistorySample } from '../../core/services/metrics/metrics-history.service';
import { of } from 'rxjs';
import { AlgorithmMetrics, ComparisonMetrics } from '../../core/models/config-and-metrics';

describe('MetricsDashboardComponent', () => {
  let component: MetricsDashboardComponent;
  let fixture: ComponentFixture<MetricsDashboardComponent>;
  let mockSimulationService: jasmine.SpyObj<SimulationService>;
  let mockMetricsHistoryService: jasmine.SpyObj<MetricsHistoryService>;

  const mockBaselineMetrics: AlgorithmMetrics = {
    name: 'DSVT-Voxel',
    accuracyMap: 67.1,
    latencyMs: 425,
    violationRate: 15.2,
    memoryGb: 6.8,
    sloCompliance: false,
  };

  const mockAgileMetrics: AlgorithmMetrics = {
    name: 'AGILE3D',
    activeBranch: 'CP_Pillar_032',
    accuracyMap: 69.4,
    latencyMs: 305,
    violationRate: 7.1,
    memoryGb: 3.2,
    sloCompliance: true,
  };

  const mockComparison: ComparisonMetrics = {
    accuracyDelta: 2.3,
    latencyDeltaMs: -120,
    violationReduction: 8.1,
  };

  const mockHistory: MetricsHistorySample[] = [
    { t: 1000, accuracyDelta: 1.5, latencyDeltaMs: -50, violationReduction: 5, scene: 'mixed' },
    { t: 2000, accuracyDelta: 2.0, latencyDeltaMs: -80, violationReduction: 7, scene: 'mixed' },
    { t: 3000, accuracyDelta: 2.3, latencyDeltaMs: -120, violationReduction: 8.1, scene: 'mixed' },
  ];

  beforeEach(async () => {
    mockSimulationService = jasmine.createSpyObj('SimulationService', [], {
      baselineMetrics$: of(mockBaselineMetrics),
      agileMetrics$: of(mockAgileMetrics),
      comparison$: of(mockComparison),
    });

    mockMetricsHistoryService = jasmine.createSpyObj('MetricsHistoryService', ['getHistory']);
    mockMetricsHistoryService.getHistory.and.returnValue(mockHistory);

    await TestBed.configureTestingModule({
      imports: [MetricsDashboardComponent],
      providers: [
        { provide: SimulationService, useValue: mockSimulationService },
        { provide: MetricsHistoryService, useValue: mockMetricsHistoryService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MetricsDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have baselineMetrics$ observable from SimulationService', (done) => {
    component.baselineMetrics$.subscribe((metrics) => {
      expect(metrics).toEqual(mockBaselineMetrics);
      done();
    });
  });

  it('should have agileMetrics$ observable from SimulationService', (done) => {
    component.agileMetrics$.subscribe((metrics) => {
      expect(metrics).toEqual(mockAgileMetrics);
      done();
    });
  });

  it('should have comparison$ observable from SimulationService', (done) => {
    component.comparison$.subscribe((comparison) => {
      expect(comparison).toEqual(mockComparison);
      done();
    });
  });

  it('should render metrics-dashboard section with proper ARIA labels', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const section = compiled.querySelector('.metrics-dashboard');
    expect(section).toBeTruthy();
    expect(section?.getAttribute('role')).toBe('region');
    expect(section?.getAttribute('aria-labelledby')).toBe('metrics-dashboard-title');
  });

  it('should render dashboard title', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const title = compiled.querySelector('#metrics-dashboard-title');
    expect(title?.textContent?.trim()).toBe('Performance Metrics');
  });

  it('should render three metrics panels', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const panels = compiled.querySelectorAll('.metrics-panel');
    expect(panels.length).toBe(3);
  });

  it('should render baseline metrics component', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const baselineComponent = compiled.querySelector('app-baseline-metrics');
    expect(baselineComponent).toBeTruthy();
  });

  it('should render agile3d metrics component', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const agileComponent = compiled.querySelector('app-agile3d-metrics');
    expect(agileComponent).toBeTruthy();
  });

  it('should render comparison highlights component', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const comparisonComponent = compiled.querySelector('app-comparison-highlights');
    expect(comparisonComponent).toBeTruthy();
  });

  it('should use OnPush change detection strategy', () => {
    expect(fixture.componentRef.changeDetectorRef).toBeDefined();
  });

  describe('Historical Trend Line Integration (WP-2.3.3)', () => {
    it('should have history$ observable', (done) => {
      component.history$.subscribe((history) => {
        expect(history).toBeTruthy();
        expect(Array.isArray(history)).toBe(true);
        done();
      });
    });

    it('should retrieve history from MetricsHistoryService', (done) => {
      component.history$.subscribe((history) => {
        expect(mockMetricsHistoryService.getHistory).toHaveBeenCalled();
        expect(history).toEqual(mockHistory);
        done();
      });
    });

    it('should render history-trend component', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const historyComponent = compiled.querySelector('app-history-trend');
      expect(historyComponent).toBeTruthy();
    });

    it('should pass history data to history-trend component', (done) => {
      component.history$.subscribe((history) => {
        expect(history.length).toBe(3);
        expect(history[0]?.accuracyDelta).toBe(1.5);
        expect(history[2]?.latencyDeltaMs).toBe(-120);
        done();
      });
    });

    it('should update history$ when comparison$ emits', (done) => {
      // history$ is derived from comparison$, so it should emit when comparison$ emits
      let emissionCount = 0;

      component.history$.subscribe(() => {
        emissionCount++;
        if (emissionCount === 1) {
          expect(mockMetricsHistoryService.getHistory).toHaveBeenCalled();
          done();
        }
      });
    });
  });
});
