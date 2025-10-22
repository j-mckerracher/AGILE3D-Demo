import { Injectable, inject } from '@angular/core';
import { DebugService } from './debug.service';

/**
 * Scene switch instrumentation token.
 * Returned by beginSceneSwitch() and passed to markDataLoaded() and endSceneSwitch().
 */
export interface SceneToken {
  /** Unique identifier for this scene switch operation */
  id: string;
  /** Human-readable label for this scene switch */
  label: string;
}

/**
 * Historical scene switch timing record.
 */
export interface SceneSwitchRecord {
  /** Scene label */
  label: string;
  /** Total duration in milliseconds */
  durationMs: number;
}

/**
 * InstrumentationService - Performance measurement and timing instrumentation.
 *
 * Purpose:
 * - Measure scene switch performance using Performance API
 * - Track historical timing data for optimization analysis
 * - Support debug logging for development and QA
 *
 * Performance Marks:
 * - {id}:start → Scene switch initiated
 * - {id}:data-loaded → Data fetch completed
 * - {id}:end → Scene switch completed (render ready)
 *
 * Performance Measures:
 * - scene-switch:{label} → Total duration from start to end
 *
 * Usage Pattern:
 * 1. Call beginSceneSwitch(label) → receive token
 * 2. Load scene data
 * 3. Call markDataLoaded(token) when data arrives
 * 4. Complete scene initialization
 * 5. Call endSceneSwitch(token) when ready to render
 *
 * @see WP-2.3.2 Instrumentation, Error Handling & QA Hooks
 * @see PRD NFR-1.8 (Instrumentation present - timing measurements)
 * @see PRD FR-3.5 (Scene switching ≤500ms goal)
 *
 * @example
 * // In MainDemoComponent
 * const token = this.instrument.beginSceneSwitch('initial');
 * try {
 *   await this.loadSceneData();
 *   this.instrument.markDataLoaded(token);
 *   await this.initializeViewers();
 * } finally {
 *   this.instrument.endSceneSwitch(token);
 * }
 */
@Injectable({
  providedIn: 'root',
})
export class InstrumentationService {
  private readonly debug = inject(DebugService);
  private readonly performanceAvailable: boolean;

  /** Maximum number of historical records to retain (ring buffer) */
  private readonly maxHistory = 20;

  /** Historical scene switch timing records */
  private readonly history: SceneSwitchRecord[] = [];

  public constructor() {
    // Check if Performance API is available (SSR safety)
    this.performanceAvailable =
      typeof performance !== 'undefined' &&
      typeof performance.mark === 'function' &&
      typeof performance.measure === 'function';

    if (!this.performanceAvailable && this.debug.isDebugEnabled()) {
      console.warn('[InstrumentationService] Performance API not available (SSR or old browser)');
    }
  }

  /**
   * Begin a scene switch operation and create a performance mark.
   *
   * @param label - Human-readable label for this scene switch (e.g., 'initial', 'mixed', 'highway')
   * @returns Token to pass to markDataLoaded() and endSceneSwitch()
   *
   * @example
   * const token = this.instrument.beginSceneSwitch('highway');
   */
  public beginSceneSwitch(label = 'initial'): SceneToken {
    const id = `scene-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    if (this.performanceAvailable) {
      performance.mark(`${id}:start`);
    }

    if (this.debug.isDebugEnabled()) {
      console.info('[Instrumentation] Scene switch started', { id, label });
    }

    return { id, label };
  }

  /**
   * Mark the point when scene data has been loaded.
   * This creates a performance mark for data loading analysis.
   *
   * @param token - Token from beginSceneSwitch()
   *
   * @example
   * this.instrument.markDataLoaded(token);
   */
  public markDataLoaded(token: SceneToken): void {
    if (this.performanceAvailable) {
      performance.mark(`${token.id}:data-loaded`);
    }

    if (this.debug.isDebugEnabled()) {
      console.info('[Instrumentation] Data loaded', { id: token.id, label: token.label });
    }
  }

  /**
   * End a scene switch operation and create a performance measure.
   * Records total duration in history ring buffer and logs in debug mode.
   *
   * @param token - Token from beginSceneSwitch()
   *
   * @example
   * this.instrument.endSceneSwitch(token);
   */
  public endSceneSwitch(token: SceneToken): void {
    if (this.performanceAvailable) {
      performance.mark(`${token.id}:end`);

      try {
        const measureName = `scene-switch:${token.label}`;
        performance.measure(measureName, `${token.id}:start`, `${token.id}:end`);

        // Retrieve the measure entry
        const entries = performance.getEntriesByName(measureName);
        const entry = entries[entries.length - 1];
        const durationMs = entry?.duration ?? NaN;

        // Add to history ring buffer
        this.pushHistory({ label: token.label, durationMs });

        if (this.debug.isDebugEnabled()) {
          console.info('[Instrumentation] Scene switch completed', {
            id: token.id,
            label: token.label,
            durationMs: durationMs.toFixed(2),
            measure: measureName,
          });
        }

        // Clean up marks to prevent memory leaks
        this.clearMarks(`${token.id}:start`, `${token.id}:data-loaded`, `${token.id}:end`);
        this.clearMeasure(measureName);
      } catch (error) {
        console.error('[Instrumentation] Failed to measure scene switch', error);
      }
    } else {
      // Performance API unavailable, just log
      if (this.debug.isDebugEnabled()) {
        console.info('[Instrumentation] Scene switch completed (no timing)', {
          id: token.id,
          label: token.label,
        });
      }
    }
  }

  /**
   * Get recent scene switch timing history.
   *
   * @returns Array of historical timing records (most recent last)
   *
   * @example
   * const recent = this.instrument.getRecent();
   * console.table(recent);
   */
  public getRecent(): readonly SceneSwitchRecord[] {
    return [...this.history];
  }

  /**
   * Add a record to the history ring buffer.
   * Maintains maximum size by removing oldest entries.
   */
  private pushHistory(item: SceneSwitchRecord): void {
    this.history.push(item);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
  }

  /**
   * Clear one or more performance marks.
   *
   * @param names - Mark names to clear
   */
  private clearMarks(...names: string[]): void {
    if (!this.performanceAvailable) {
      return;
    }

    try {
      names.forEach((name) => {
        performance.clearMarks(name);
      });
    } catch (error) {
      // Ignore errors during cleanup
    }
  }

  /**
   * Clear a performance measure.
   *
   * @param name - Measure name to clear
   */
  private clearMeasure(name: string): void {
    if (!this.performanceAvailable) {
      return;
    }

    try {
      performance.clearMeasures(name);
    } catch (error) {
      // Ignore errors during cleanup
    }
  }

  /**
   * Check if the Performance API is available.
   *
   * Useful for conditional instrumentation logic.
   *
   * @returns true if Performance API is available
   */
  public isAvailable(): boolean {
    return this.performanceAvailable;
  }
}
