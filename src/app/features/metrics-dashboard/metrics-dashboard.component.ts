import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { SimulationService } from '../../core/services/simulation/simulation.service';
import { AlgorithmMetrics, ComparisonMetrics } from '../../core/models/config-and-metrics';
import { BaselineMetricsComponent } from './baseline-metrics/baseline-metrics.component';
import { Agile3dMetricsComponent } from './agile3d-metrics/agile3d-metrics.component';
import { ComparisonHighlightsComponent } from './comparison-highlights/comparison-highlights.component';
import { HistoryTrendComponent } from './history-trend/history-trend.component';
import {
  MetricsHistoryService,
  MetricsHistorySample,
} from '../../core/services/metrics/metrics-history.service';
import { map } from 'rxjs/operators';

/**
 * MetricsDashboardComponent displays performance comparison between
 * DSVT-Voxel baseline and AGILE3D adaptive system.
 *
 * Layout: 3-column grid with baseline (left), comparison (center), AGILE3D (right),
 * plus optional historical trend line below.
 *
 * Features:
 * - Reactive data flow from SimulationService
 * - Real-time metric updates (<100ms propagation)
 * - Color-coded comparison indicators
 * - Historical trend visualization (last 10 changes)
 * - Accessible with ARIA labels and live regions
 * - Respects prefers-reduced-motion for animations
 *
 * @see PRD FR-3.1–3.8 (Metrics dashboard requirements)
 * @see PRD NFR-1.3 (Control updates within 100ms)
 * @see WP-2.3.1 (Metrics Dashboard implementation)
 * @see WP-2.3.3 (Historical Trend Line implementation)
 */
@Component({
  selector: 'app-metrics-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    BaselineMetricsComponent,
    Agile3dMetricsComponent,
    ComparisonHighlightsComponent,
    HistoryTrendComponent,
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

  /**
   * Observable stream of historical metrics samples for trend visualization.
   * Updates reactively as MetricsHistoryService captures new snapshots.
   *
   * @see WP-2.3.3 (Historical Trend Line)
   */
  public readonly history$: Observable<readonly MetricsHistorySample[]>;

  public constructor(
    // eslint-disable-next-line @angular-eslint/prefer-inject
    private readonly simulationService: SimulationService,
    // eslint-disable-next-line @angular-eslint/prefer-inject
    private readonly metricsHistoryService: MetricsHistoryService
  ) {
    // Wire up reactive streams from SimulationService
    this.baselineMetrics$ = this.simulationService.baselineMetrics$;
    this.agileMetrics$ = this.simulationService.agileMetrics$;
    this.comparison$ = this.simulationService.comparison$;

    // Wire up historical trend data from MetricsHistoryService
    // Wrap in Observable that polls getHistory() for reactive updates
    this.history$ = this.comparison$.pipe(map(() => this.metricsHistoryService.getHistory()));
  }
}
