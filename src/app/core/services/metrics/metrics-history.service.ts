import { Injectable, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil, distinctUntilChanged } from 'rxjs/operators';
import { SimulationService } from '../simulation/simulation.service';
import { StateService } from '../state/state.service';
import { ComparisonMetrics, SceneId } from '../../models/config-and-metrics';

/**
 * Historical sample capturing a snapshot of comparison metrics at a specific point in time.
 * Used for trend visualization in the Metrics Dashboard.
 */
export interface MetricsHistorySample {
  /** Timestamp when the sample was captured (milliseconds since epoch) */
  t: number;

  /** Accuracy delta (mAP percentage points, positive = AGILE3D better) */
  accuracyDelta: number;

  /** Latency delta (milliseconds, negative = AGILE3D faster) */
  latencyDeltaMs: number;

  /** Violation rate reduction (percentage points, positive = AGILE3D better) */
  violationReduction: number;

  /** Scene identifier when sample was captured */
  scene: SceneId;
}

/**
 * MetricsHistoryService maintains a rolling buffer of recent comparison metrics
 * for historical trend visualization in the Metrics Dashboard.
 *
 * Features:
 * - Ring buffer of last 10 comparison snapshots
 * - Automatic scene-change clearing to prevent cross-scene contamination
 * - Distinct emission filtering to avoid duplicate samples
 * - Memory-safe with bounded buffer size
 *
 * Performance:
 * - O(1) sample addition (ring buffer)
 * - O(1) history retrieval (immutable array copy)
 * - <1ms overhead per metrics emission
 *
 * @see PRD FR-3.8 (Optional: Historical trend line)
 * @see WP-2.3.3 (Historical Trend Line implementation)
 */
@Injectable({
  providedIn: 'root',
})
export class MetricsHistoryService implements OnDestroy {
  /** Maximum number of samples to retain in history */
  private readonly MAX_SAMPLES = 10;

  /**
   * Ring buffer storing historical samples.
   * Bounded to MAX_SAMPLES to prevent unbounded memory growth.
   */
  private readonly samples: MetricsHistorySample[] = [];

  /**
   * Current scene being tracked.
   * Used to detect scene changes and trigger history clearing.
   */
  private currentScene: SceneId | null = null;

  /**
   * Cleanup subject for RxJS subscription management.
   */
  private readonly destroy$ = new Subject<void>();

  public constructor(
    // eslint-disable-next-line @angular-eslint/prefer-inject
    private readonly simulationService: SimulationService,
    // eslint-disable-next-line @angular-eslint/prefer-inject
    private readonly stateService: StateService
  ) {
    this.initializeSubscriptions();
  }

  /**
   * Initialize reactive subscriptions for metrics capture and scene-change clearing.
   */
  private initializeSubscriptions(): void {
    // Subscribe to scene changes for history clearing
    this.stateService.scene$.pipe(takeUntil(this.destroy$)).subscribe((scene) => {
      if (this.currentScene !== null && this.currentScene !== scene) {
        this.clear(`Scene changed from ${this.currentScene} to ${scene}`);
      }
      this.currentScene = scene;
    });

    // Subscribe to comparison metrics with distinct filtering
    this.simulationService.comparison$
      .pipe(distinctUntilChanged(this.shallowEqual), takeUntil(this.destroy$))
      .subscribe((comparison) => {
        if (this.currentScene) {
          this.addSample({
            t: Date.now(),
            accuracyDelta: comparison.accuracyDelta,
            latencyDeltaMs: comparison.latencyDeltaMs,
            violationReduction: comparison.violationReduction,
            scene: this.currentScene,
          });
        }
      });
  }

  /**
   * Add a new sample to the history buffer.
   * Maintains ring buffer semantics: oldest sample is removed when buffer exceeds MAX_SAMPLES.
   *
   * @param sample - Metrics snapshot to add to history
   */
  public addSample(sample: MetricsHistorySample): void {
    this.samples.push(sample);

    // Maintain ring buffer size limit
    if (this.samples.length > this.MAX_SAMPLES) {
      this.samples.shift(); // Remove oldest sample
    }
  }

  /**
   * Retrieve the full history as a readonly array.
   * Returns a shallow copy to prevent external mutation.
   *
   * @returns Readonly array of historical samples, ordered oldest to newest
   */
  public getHistory(): readonly MetricsHistorySample[] {
    return [...this.samples];
  }

  /**
   * Clear all historical samples from the buffer.
   * Typically invoked on scene changes to prevent cross-scene metric mixing.
   *
   * @param reason - Optional reason for clearing (for debugging/logging)
   */
  public clear(reason?: string): void {
    if (reason) {
      console.log(`[MetricsHistoryService] Clearing history: ${reason}`);
    }
    this.samples.length = 0;
  }

  /**
   * Cleanup lifecycle hook.
   * Completes subscriptions to prevent memory leaks.
   */
  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Shallow equality comparison for ComparisonMetrics.
   * Prevents duplicate samples when metrics haven't actually changed.
   *
   * @param a - First comparison metrics object
   * @param b - Second comparison metrics object
   * @returns true if all fields are equal, false otherwise
   */
  private shallowEqual(a: ComparisonMetrics, b: ComparisonMetrics): boolean {
    return (
      a.accuracyDelta === b.accuracyDelta &&
      a.latencyDeltaMs === b.latencyDeltaMs &&
      a.violationReduction === b.violationReduction
    );
  }
}
