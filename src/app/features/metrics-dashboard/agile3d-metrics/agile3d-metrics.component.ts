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
import { AlgorithmMetrics } from '../../../core/models/config-and-metrics';
import { ReducedMotionService } from '../../../core/services/reduced-motion.service';
import { animateNumber, formatMetricValue } from '../utils/number-animation';

/**
 * Agile3dMetricsComponent displays performance metrics for the AGILE3D adaptive system.
 *
 * Features:
 * - Displays all AGILE3D metrics (accuracy, latency, violations, memory, SLO compliance)
 * - Shows active AGILE3D branch name
 * - Smooth number counting animations when values change
 * - Respects prefers-reduced-motion for instant updates
 * - ARIA live region for screen reader announcements
 * - Color-coded SLO compliance indicator
 *
 * @see PRD FR-3.2 (Display AGILE3D metrics)
 * @see PRD FR-3.5–3.6 (Smooth animations and number counting)
 * @see PRD NFR-3.7 (Respect prefers-reduced-motion)
 * @see WP-2.3.1 (Metrics Dashboard implementation)
 */
@Component({
  selector: 'app-agile3d-metrics',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule],
  templateUrl: './agile3d-metrics.component.html',
  styleUrls: ['./agile3d-metrics.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Agile3dMetricsComponent implements OnChanges, OnDestroy {
  /**
   * Input metrics from SimulationService.
   * Null during initial loading state.
   */
  @Input() public metrics: AlgorithmMetrics | null = null;

  // Display values (updated via animations)
  protected readonly displayAccuracy = signal<number>(0);
  protected readonly displayLatency = signal<number>(0);
  protected readonly displayViolations = signal<number>(0);
  protected readonly displayMemory = signal<number>(0);

  // Cleanup functions for active animations
  private cleanupFunctions: (() => void)[] = [];

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
    if (changes['metrics'] && this.metrics) {
      this.updateMetrics(this.metrics);
    }
  }

  /**
   * Update displayed metrics with animations.
   * Uses animateNumber utility with reduced motion support.
   *
   * @param newMetrics - New metrics to display
   */
  private updateMetrics(newMetrics: AlgorithmMetrics): void {
    // Cancel any in-progress animations
    this.cancelAnimations();

    const duration = this.reducedMotion.getAnimationDuration(200);

    // Animate accuracy (mAP %)
    const accuracyCleanup = animateNumber(
      this.displayAccuracy(),
      newMetrics.accuracyMap,
      duration,
      1,
      (value) => {
        this.displayAccuracy.set(value);
        this.cdr.markForCheck();
      }
    );
    this.cleanupFunctions.push(accuracyCleanup);

    // Animate latency (ms)
    const latencyCleanup = animateNumber(
      this.displayLatency(),
      newMetrics.latencyMs,
      duration,
      0,
      (value) => {
        this.displayLatency.set(value);
        this.cdr.markForCheck();
      }
    );
    this.cleanupFunctions.push(latencyCleanup);

    // Animate violation rate (%)
    const violationsCleanup = animateNumber(
      this.displayViolations(),
      newMetrics.violationRate,
      duration,
      1,
      (value) => {
        this.displayViolations.set(value);
        this.cdr.markForCheck();
      }
    );
    this.cleanupFunctions.push(violationsCleanup);

    // Animate memory (GB)
    const memoryCleanup = animateNumber(
      this.displayMemory(),
      newMetrics.memoryGb,
      duration,
      1,
      (value) => {
        this.displayMemory.set(value);
        this.cdr.markForCheck();
      }
    );
    this.cleanupFunctions.push(memoryCleanup);
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
   * Format branch name for display.
   * Converts underscore-separated IDs to hyphen-separated display names.
   *
   * @returns Formatted branch name (e.g., "CP-Pillar-0.32")
   */
  protected formatBranchName(): string {
    if (!this.metrics?.activeBranch) return 'N/A';
    return this.metrics.activeBranch.replace(/_/g, '-');
  }

  /**
   * Format accuracy value for display.
   * @returns Formatted accuracy string with unit
   */
  protected formatAccuracy(): string {
    return formatMetricValue(this.displayAccuracy(), 1, '%');
  }

  /**
   * Format latency value for display.
   * @returns Formatted latency string with unit
   */
  protected formatLatency(): string {
    return formatMetricValue(this.displayLatency(), 0, ' ms');
  }

  /**
   * Format violation rate for display.
   * @returns Formatted violation rate string with unit
   */
  protected formatViolations(): string {
    return formatMetricValue(this.displayViolations(), 1, '%');
  }

  /**
   * Format memory value for display.
   * @returns Formatted memory string with unit
   */
  protected formatMemory(): string {
    return formatMetricValue(this.displayMemory(), 1, ' GB');
  }

  /**
   * Get SLO compliance status icon.
   * @returns Icon name for Material Icons
   */
  protected getSloIcon(): string {
    return this.metrics?.sloCompliance ? 'check_circle' : 'cancel';
  }

  /**
   * Get SLO compliance CSS class for styling.
   * @returns CSS class name
   */
  protected getSloClass(): string {
    return this.metrics?.sloCompliance ? 'slo-pass' : 'slo-fail';
  }

  /**
   * Cleanup lifecycle hook.
   * Cancels all active animations to prevent memory leaks.
   */
  public ngOnDestroy(): void {
    this.cancelAnimations();
  }
}
