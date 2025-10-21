import {
  Component,
  Input,
  ChangeDetectionStrategy,
  computed,
  signal,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MetricsHistorySample } from '../../../core/services/metrics/metrics-history.service';
import { ReducedMotionService } from '../../../core/services/reduced-motion.service';

/**
 * Data point for SVG path rendering.
 * Contains normalized coordinates for plotting.
 */
interface PathPoint {
  x: number;
  y: number;
  value: number;
}

/**
 * HistoryTrendComponent visualizes recent metrics history as compact SVG sparklines.
 *
 * Features:
 * - Three sparkline charts: Accuracy Gain, Latency Diff, Violation Reduction
 * - Shows last 10 parameter-driven changes
 * - Hides when fewer than 2 samples available
 * - Respects prefers-reduced-motion for instant transitions
 * - Accessible: ARIA labels, keyboard navigation, color-blind safe encoding
 * - Visually-hidden data table for screen readers
 *
 * Performance:
 * - Lightweight SVG rendering (<1ms per update)
 * - OnPush change detection
 * - Immutable input arrays
 *
 * @see PRD FR-3.8 (Optional: Historical trend line)
 * @see PRD NFR-3.4–3.7 (Accessibility and reduced motion)
 * @see WP-2.3.3 (Historical Trend Line implementation)
 */
@Component({
  selector: 'app-history-trend',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './history-trend.component.html',
  styleUrls: ['./history-trend.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoryTrendComponent {
  /** SVG dimensions for sparkline charts */
  private readonly SVG_WIDTH = 120;
  private readonly SVG_HEIGHT = 40;
  private readonly PADDING = 4;

  /**
   * Historical metrics samples to visualize.
   * Expected to be immutable array from MetricsHistoryService.
   */
  @Input({ required: true }) public set history(value: readonly MetricsHistorySample[]) {
    this.historySignal.set(value);
  }

  protected readonly historySignal = signal<readonly MetricsHistorySample[]>([]);

  /**
   * Computed signal: whether to show the history panel.
   * Requires at least 2 samples for meaningful trend visualization.
   */
  protected readonly shouldShow = computed(() => this.historySignal().length >= 2);

  /**
   * Computed signal: SVG path for accuracy delta sparkline.
   */
  protected readonly accuracyPath = computed(() => {
    const samples = this.historySignal();
    const values = samples.map((s) => s.accuracyDelta);
    return this.buildSparklinePath(values);
  });

  /**
   * Computed signal: SVG path for latency delta sparkline.
   */
  protected readonly latencyPath = computed(() => {
    const samples = this.historySignal();
    const values = samples.map((s) => s.latencyDeltaMs);
    return this.buildSparklinePath(values);
  });

  /**
   * Computed signal: SVG path for violation reduction sparkline.
   */
  protected readonly violationPath = computed(() => {
    const samples = this.historySignal();
    const values = samples.map((s) => s.violationReduction);
    return this.buildSparklinePath(values);
  });

  /**
   * Computed signal: summary statistics for ARIA labels.
   */
  protected readonly summary = computed(() => {
    const samples = this.historySignal();
    if (samples.length === 0) {
      return { accuracy: '', latency: '', violations: '' };
    }

    const latest = samples[samples.length - 1];
    if (!latest) {
      return { accuracy: '', latency: '', violations: '' };
    }

    return {
      accuracy: `Latest accuracy gain: ${latest.accuracyDelta.toFixed(1)}%`,
      latency: `Latest latency difference: ${latest.latencyDeltaMs.toFixed(0)}ms`,
      violations: `Latest violation reduction: ${latest.violationReduction.toFixed(1)}%`,
    };
  });

  /**
   * ReducedMotionService injection (Angular 17+ inject pattern).
   */
  private readonly reducedMotionService = inject(ReducedMotionService);

  /**
   * Whether reduced motion is preferred by user.
   * When true, disables all transition animations.
   */
  protected readonly reducedMotion = this.reducedMotionService.prefersReducedMotion;

  /**
   * Expose Math for template usage.
   */
  protected readonly Math = Math;

  /**
   * Build SVG path string for a sparkline from data values.
   * Normalizes values to fit within SVG viewport with padding.
   *
   * @param values - Array of numeric values to plot
   * @returns SVG path string (e.g., "M 0,20 L 10,15 L 20,25")
   */
  private buildSparklinePath(values: number[]): string {
    if (values.length < 2) {
      return '';
    }

    const points = this.normalizeValues(values);
    const pathSegments = points.map((pt, i) => {
      const cmd = i === 0 ? 'M' : 'L';
      return `${cmd} ${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
    });

    return pathSegments.join(' ');
  }

  /**
   * Normalize data values to SVG coordinate space.
   * Maps values to [PADDING, HEIGHT - PADDING] range with auto-scaling.
   *
   * @param values - Raw data values
   * @returns Array of normalized path points
   */
  private normalizeValues(values: number[]): PathPoint[] {
    const n = values.length;
    if (n === 0) {
      return [];
    }

    // Calculate value range for y-axis scaling
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;

    // Handle constant values (no variation)
    const yScale = range === 0 ? 0 : (this.SVG_HEIGHT - 2 * this.PADDING) / range;
    const xScale = (this.SVG_WIDTH - 2 * this.PADDING) / Math.max(1, n - 1);

    return values.map((value, i) => {
      const x = this.PADDING + i * xScale;

      // Invert y-axis (SVG y grows downward, we want higher values at top)
      const normalizedY = range === 0 ? this.SVG_HEIGHT / 2 : (max - value) * yScale;
      const y = this.PADDING + normalizedY;

      return { x, y, value };
    });
  }

  /**
   * Format number for display in data table.
   * Handles positive/negative sign and precision.
   *
   * @param value - Numeric value to format
   * @param precision - Decimal places (default: 1)
   * @returns Formatted string with sign
   */
  protected formatValue(value: number, precision = 1): string {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(precision)}`;
  }

  /**
   * Generate SVG polygon points for diamond marker shape.
   * Used for color-blind accessible shape encoding on violation reduction chart.
   *
   * @param cx - Center x coordinate
   * @param cy - Center y coordinate
   * @param size - Diamond size (half-width/half-height)
   * @returns SVG polygon points string
   */
  protected getMarkerPoints(cx: number, cy: number, size: number): string {
    return `${cx},${cy - size} ${cx + size},${cy} ${cx},${cy + size} ${cx - size},${cy}`;
  }
}
