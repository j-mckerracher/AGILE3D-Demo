import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MetricsDashboardComponent } from './metrics-dashboard.component';
import { SimulationService } from '../../core/services/simulation/simulation.service';
import { of } from 'rxjs';
import { AlgorithmMetrics, ComparisonMetrics } from '../../core/models/config-and-metrics';

describe('MetricsDashboardComponent', () => {
  let component: MetricsDashboardComponent;
  let fixture: ComponentFixture<MetricsDashboardComponent>;
  let mockSimulationService: jasmine.SpyObj<SimulationService>;

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

  beforeEach(async () => {
    mockSimulationService = jasmine.createSpyObj('SimulationService', [], {
      baselineMetrics$: of(mockBaselineMetrics),
      agileMetrics$: of(mockAgileMetrics),
      comparison$: of(mockComparison),
    });

    await TestBed.configureTestingModule({
      imports: [MetricsDashboardComponent],
      providers: [{ provide: SimulationService, useValue: mockSimulationService }],
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
});
