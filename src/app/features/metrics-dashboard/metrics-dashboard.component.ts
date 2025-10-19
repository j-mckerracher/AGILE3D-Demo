import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { SimulationService } from '../../core/services/simulation/simulation.service';
import { AlgorithmMetrics, ComparisonMetrics } from '../../core/models/config-and-metrics';
import { BaselineMetricsComponent } from './baseline-metrics/baseline-metrics.component';
import { Agile3dMetricsComponent } from './agile3d-metrics/agile3d-metrics.component';
import { ComparisonHighlightsComponent } from './comparison-highlights/comparison-highlights.component';

/**
 * MetricsDashboardComponent displays performance comparison between
 * DSVT-Voxel baseline and AGILE3D adaptive system.
 *
 * Layout: 3-column grid with baseline (left), comparison (center), AGILE3D (right).
 *
 * Features:
 * - Reactive data flow from SimulationService
 * - Real-time metric updates (<100ms propagation)
 * - Color-coded comparison indicators
 * - Accessible with ARIA labels and live regions
 * - Respects prefers-reduced-motion for animations
 *
 * @see PRD FR-3.1–3.8 (Metrics dashboard requirements)
 * @see PRD NFR-1.3 (Control updates within 100ms)
 * @see WP-2.3.1 (Metrics Dashboard implementation)
 */
@Component({
  selector: 'app-metrics-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    BaselineMetricsComponent,
    Agile3dMetricsComponent,
    ComparisonHighlightsComponent,
  ],
  templateUrl: './metrics-dashboard.component.html',
  styleUrls: ['./metrics-dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MetricsDashboardComponent {
  /**
   * Observable stream of baseline (DSVT-Voxel) metrics.
   * Updates reactively when system parameters change.
   */
  public readonly baselineMetrics$: Observable<AlgorithmMetrics>;

  /**
   * Observable stream of AGILE3D metrics for the currently selected branch.
   * Updates reactively when system parameters or branch selection changes.
   */
  public readonly agileMetrics$: Observable<AlgorithmMetrics>;

  /**
   * Observable stream of comparison deltas between AGILE3D and baseline.
   * Positive values indicate AGILE3D improvement.
   */
  public readonly comparison$: Observable<ComparisonMetrics>;

  public constructor(
    // eslint-disable-next-line @angular-eslint/prefer-inject
    private readonly simulationService: SimulationService
  ) {
    // Wire up reactive streams from SimulationService
    this.baselineMetrics$ = this.simulationService.baselineMetrics$;
    this.agileMetrics$ = this.simulationService.agileMetrics$;
    this.comparison$ = this.simulationService.comparison$;
  }
}
