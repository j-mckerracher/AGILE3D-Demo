import {
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  OnDestroy,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { ComparisonMetrics } from '../../../core/models/config-and-metrics';
import { ReducedMotionService } from '../../../core/services/reduced-motion.service';
import { animateNumber } from '../utils/number-animation';

/**
 * Threshold category for color coding.
 * - green: AGILE3D improvement
 * - amber: Neutral/minor difference
 * - red: AGILE3D degradation
 */
type ThresholdCategory = 'green' | 'amber' | 'red';

/**
 * ComparisonHighlightsComponent displays performance deltas between AGILE3D and baseline.
 *
 * Features:
 * - Displays three key comparison metrics (accuracy, latency, violations)
 * - Color-coded threshold indicators (green/amber/red)
 * - Directional icons (up/down arrows)
 * - Smooth number counting animations when values change
 * - Highlight pulse animation on significant changes (respects reduced motion)
 * - ARIA live region for screen reader announcements
 *
 * Color Thresholds (from PRD and WP-2.3.1):
 * - Green (Improvement):
 *   - Accuracy gain > +2%
 *   - Latency reduction < -10ms (negative = faster)
 *   - Violation reduction > +5%
 * - Amber (Neutral):
 *   - Accuracy within ±2%
 *   - Latency within ±10ms
 *   - Violations within ±5%
 * - Red (Degradation):
 *   - Accuracy loss < -2%
 *   - Latency increase > +10ms
 *   - Violations increase < -5%
 *
 * @see PRD FR-3.3–3.4 (Comparison highlights and color coding)
 * @see PRD FR-3.7 (Highlight flash on changes)
 * @see WP-2.3.1 (Metrics Dashboard implementation)
 */
@Component({
  selector: 'app-comparison-highlights',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule],
  templateUrl: './comparison-highlights.component.html',
  styleUrls: ['./comparison-highlights.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComparisonHighlightsComponent implements OnChanges, OnDestroy {
  /**
   * Input comparison metrics from SimulationService.
   * Null during initial loading state.
   */
  @Input() public comparison: ComparisonMetrics | null = null;

  // Display values (updated via animations)
  protected readonly displayAccuracyDelta = signal<number>(0);
  protected readonly displayLatencyDelta = signal<number>(0);
  protected readonly displayViolationReduction = signal<number>(0);

  // Highlight pulse state for visual feedback
  protected readonly highlightAccuracy = signal<boolean>(false);
  protected readonly highlightLatency = signal<boolean>(false);
  protected readonly highlightViolations = signal<boolean>(false);

  // Cleanup functions for active animations
  private cleanupFunctions: (() => void)[] = [];
  private highlightTimers: number[] = [];

  public constructor(
    // eslint-disable-next-line @angular-eslint/prefer-inject
    private readonly cdr: ChangeDetectorRef,
    // eslint-disable-next-line @angular-eslint/prefer-inject
    private readonly reducedMotion: ReducedMotionService
  ) {}

  /**
   * Handle input changes and trigger animations.
   * Cancels any in-progress animations before starting new ones.
   */
  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['comparison'] && this.comparison) {
      this.updateComparison(this.comparison);
    }
  }

  /**
   * Update displayed comparison metrics with animations and highlight pulses.
   * Uses animateNumber utility with reduced motion support.
   *
   * @param newComparison - New comparison metrics to display
   */
  private updateComparison(newComparison: ComparisonMetrics): void {
    // Cancel any in-progress animations
    this.cancelAnimations();
    this.clearHighlights();

    const duration = this.reducedMotion.getAnimationDuration(200);
    const shouldHighlight = !this.reducedMotion.getCurrentPreference();

    // Animate accuracy delta
    const accuracyChanged = this.displayAccuracyDelta() !== newComparison.accuracyDelta;
    const accuracyCleanup = animateNumber(
      this.displayAccuracyDelta(),
      newComparison.accuracyDelta,
      duration,
      1,
      (value) => {
        this.displayAccuracyDelta.set(value);
        this.cdr.markForCheck();
      }
    );
    this.cleanupFunctions.push(accuracyCleanup);
    if (shouldHighlight && accuracyChanged) {
      this.triggerHighlight('accuracy');
    }

    // Animate latency delta
    const latencyChanged = this.displayLatencyDelta() !== newComparison.latencyDeltaMs;
    const latencyCleanup = animateNumber(
      this.displayLatencyDelta(),
      newComparison.latencyDeltaMs,
      duration,
      0,
      (value) => {
        this.displayLatencyDelta.set(value);
        this.cdr.markForCheck();
      }
    );
    this.cleanupFunctions.push(latencyCleanup);
    if (shouldHighlight && latencyChanged) {
      this.triggerHighlight('latency');
    }

    // Animate violation reduction
    const violationsChanged = this.displayViolationReduction() !== newComparison.violationReduction;
    const violationsCleanup = animateNumber(
      this.displayViolationReduction(),
      newComparison.violationReduction,
      duration,
      1,
      (value) => {
        this.displayViolationReduction.set(value);
        this.cdr.markForCheck();
      }
    );
    this.cleanupFunctions.push(violationsCleanup);
    if (shouldHighlight && violationsChanged) {
      this.triggerHighlight('violations');
    }
  }

  /**
   * Trigger highlight pulse animation for a specific metric.
   * Auto-clears after 300ms.
   *
   * @param metric - Which metric to highlight
   */
  private triggerHighlight(metric: 'accuracy' | 'latency' | 'violations'): void {
    if (metric === 'accuracy') {
      this.highlightAccuracy.set(true);
      const timer = window.setTimeout(() => {
        this.highlightAccuracy.set(false);
        this.cdr.markForCheck();
      }, 300);
      this.highlightTimers.push(timer);
    } else if (metric === 'latency') {
      this.highlightLatency.set(true);
      const timer = window.setTimeout(() => {
        this.highlightLatency.set(false);
        this.cdr.markForCheck();
      }, 300);
      this.highlightTimers.push(timer);
    } else if (metric === 'violations') {
      this.highlightViolations.set(true);
      const timer = window.setTimeout(() => {
        this.highlightViolations.set(false);
        this.cdr.markForCheck();
      }, 300);
      this.highlightTimers.push(timer);
    }
  }

  /**
   * Clear all active highlight timers.
   */
  private clearHighlights(): void {
    this.highlightTimers.forEach((timer) => clearTimeout(timer));
    this.highlightTimers = [];
    this.highlightAccuracy.set(false);
    this.highlightLatency.set(false);
    this.highlightViolations.set(false);
  }

  /**
   * Cancel all active animations.
   * Called before starting new animations or on component destroy.
   */
  private cancelAnimations(): void {
    this.cleanupFunctions.forEach((cleanup) => cleanup());
    this.cleanupFunctions = [];
  }

  /**
   * Determine threshold category for accuracy delta.
   * @returns Threshold category (green/amber/red)
   */
  protected getAccuracyThreshold(): ThresholdCategory {
    const delta = this.displayAccuracyDelta();
    if (delta > 2) return 'green';
    if (delta < -2) return 'red';
    return 'amber';
  }

  /**
   * Determine threshold category for latency delta.
   * Note: Negative latency delta = faster = improvement
   * @returns Threshold category (green/amber/red)
   */
  protected getLatencyThreshold(): ThresholdCategory {
    const delta = this.displayLatencyDelta();
    if (delta < -10) return 'green';  // Negative = faster = good
    if (delta > 10) return 'red';     // Positive = slower = bad
    return 'amber';
  }

  /**
   * Determine threshold category for violation reduction.
   * @returns Threshold category (green/amber/red)
   */
  protected getViolationsThreshold(): ThresholdCategory {
    const reduction = this.displayViolationReduction();
    if (reduction > 5) return 'green';
    if (reduction < -5) return 'red';
    return 'amber';
  }

  /**
   * Get icon for accuracy delta.
   * @returns Material icon name
   */
  protected getAccuracyIcon(): string {
    const delta = this.displayAccuracyDelta();
    return delta > 0 ? 'trending_up' : delta < 0 ? 'trending_down' : 'trending_flat';
  }

  /**
   * Get icon for latency delta.
   * Note: Down arrow for negative (faster) = good
   * @returns Material icon name
   */
  protected getLatencyIcon(): string {
    const delta = this.displayLatencyDelta();
    return delta < 0 ? 'trending_down' : delta > 0 ? 'trending_up' : 'trending_flat';
  }

  /**
   * Get icon for violation reduction.
   * @returns Material icon name
   */
  protected getViolationsIcon(): string {
    const reduction = this.displayViolationReduction();
    return reduction > 0 ? 'trending_down' : reduction < 0 ? 'trending_up' : 'trending_flat';
  }

  /**
   * Format accuracy delta for display.
   * @returns Formatted string with sign and unit
   */
  protected formatAccuracyDelta(): string {
    const delta = this.displayAccuracyDelta();
    const sign = delta > 0 ? '+' : '';
    return `${sign}${delta.toFixed(1)} pp`;
  }

  /**
   * Format latency delta for display.
   * @returns Formatted string with sign and unit
   */
  protected formatLatencyDelta(): string {
    const delta = this.displayLatencyDelta();
    const sign = delta > 0 ? '+' : '';
    return `${sign}${delta.toFixed(0)} ms`;
  }

  /**
   * Format violation reduction for display.
   * @returns Formatted string with sign and unit
   */
  protected formatViolationReduction(): string {
    const reduction = this.displayViolationReduction();
    const sign = reduction > 0 ? '+' : '';
    return `${sign}${reduction.toFixed(1)} pp`;
  }

  /**
   * Cleanup lifecycle hook.
   * Cancels all active animations and timers to prevent memory leaks.
   */
  public ngOnDestroy(): void {
    this.cancelAnimations();
    this.clearHighlights();
  }
}
