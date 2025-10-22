import { Injectable, inject } from '@angular/core';
import { QualityTier } from '../../models/scene.models';
import { RenderLoopService } from '../rendering/render-loop.service';

/**
 * Manages quality tier selection based on performance metrics.
 *
 * Responsibilities:
 * - Track recent FPS from render loop
 * - Automatically switch to fallback tier when performance degrades
 * - Provide utilities for tier-aware path resolution
 * - Enforce NFR-1.9 automatic fallback requirement
 *
 * Performance Thresholds:
 * - Full tier: FPS >= 45 (sustained)
 * - Fallback tier: FPS < 45 (averaged over ~180 frames / 3 seconds)
 *
 * @see WP-1.2.2 Scene Data & Parsing Infrastructure
 * @see NFR-1.9 Automatic Fallback to 50k Tier
 */
@Injectable({
  providedIn: 'root',
})
export class SceneTierManagerService {
  private readonly renderLoop = inject(RenderLoopService);

  /** Current quality tier */
  private currentTier: QualityTier = 'full';

  /** FPS threshold for maintaining full quality */
  private readonly FPS_THRESHOLD = 45;

  /** Number of frames to average for tier decisions */
  private readonly FPS_WINDOW_SIZE = 180; // ~3 seconds at 60fps

  /** Recent FPS samples for averaging */
  private readonly fpsHistory: number[] = [];

  /** Whether automatic tier management is enabled */
  private autoTierEnabled = true;

  /**
   * Initialize the tier manager.
   *
   * Sets up FPS monitoring from the render loop.
   */
  public constructor() {
    this.initializeFPSMonitoring();
  }

  /**
   * Get the current quality tier.
   *
   * @returns Current tier ('full' or 'fallback')
   */
  public getCurrentTier(): QualityTier {
    return this.currentTier;
  }

  /**
   * Manually set the quality tier.
   *
   * Useful for testing or user preferences.
   *
   * @param tier - Tier to set
   */
  public setTier(tier: QualityTier): void {
    if (this.currentTier !== tier) {
      console.log(`[SceneTierManager] Switching tier: ${this.currentTier} -> ${tier}`);
      this.currentTier = tier;
    }
  }

  /**
   * Enable or disable automatic tier management.
   *
   * When disabled, tier must be set manually via setTier().
   *
   * @param enabled - Whether automatic tier management is enabled
   */
  public setAutoTierEnabled(enabled: boolean): void {
    this.autoTierEnabled = enabled;
    if (!enabled) {
      this.fpsHistory.length = 0; // Clear history when disabling
    }
  }

  /**
   * Check if automatic tier management is enabled.
   *
   * @returns True if automatic tier management is enabled
   */
  public isAutoTierEnabled(): boolean {
    return this.autoTierEnabled;
  }

  /**
   * Resolve the appropriate bin path for the current tier.
   *
   * Converts paths like:
   * - 'vehicle_heavy_01_100k.bin' -> 'vehicle_heavy_01_50k.bin' (if fallback)
   * - 'vehicle_heavy_01_100k.bin' -> 'vehicle_heavy_01_100k.bin' (if full)
   *
   * @param fullTierPath - Path to full-quality bin file
   * @returns Path adjusted for current tier
   */
  public getTierPath(fullTierPath: string): string {
    if (this.currentTier === 'fallback') {
      return fullTierPath.replace('_100k.bin', '_50k.bin');
    }
    return fullTierPath;
  }

  /**
   * Get cache key for the current tier.
   *
   * Used by SceneDataService to cache tier-specific results.
   *
   * @param sceneId - Scene identifier
   * @returns Cache key including tier (e.g., 'vehicle_heavy_01:full')
   */
  public getCacheKey(sceneId: string): string {
    return `${sceneId}:${this.currentTier}`;
  }

  /**
   * Get recent FPS statistics.
   *
   * @returns Object with FPS stats
   */
  public getFPSStats(): {
    current: number;
    average: number;
    min: number;
    max: number;
    sampleCount: number;
  } {
    if (this.fpsHistory.length === 0) {
      return {
        current: 0,
        average: 0,
        min: 0,
        max: 0,
        sampleCount: 0,
      };
    }

    const sum = this.fpsHistory.reduce((a, b) => a + b, 0);
    const average = sum / this.fpsHistory.length;
    const min = Math.min(...this.fpsHistory);
    const max = Math.max(...this.fpsHistory);
    const current = this.fpsHistory[this.fpsHistory.length - 1] ?? 0;

    return {
      current,
      average,
      min,
      max,
      sampleCount: this.fpsHistory.length,
    };
  }

  /**
   * Reset FPS history.
   *
   * Useful when switching scenes or resetting performance tracking.
   */
  public resetFPSHistory(): void {
    this.fpsHistory.length = 0;
  }

  /**
   * Initialize FPS monitoring from render loop.
   *
   * Subscribes to FPS metrics and tracks history for tier decisions.
   *
   * Note: Full implementation deferred to future WP when RenderLoopService
   * includes metrics$ observable. For now, this is a stub.
   */
  private initializeFPSMonitoring(): void {
    // TODO: Subscribe to RenderLoopService.metrics$ when available (future WP)
    // For now, tier management is manual-only via setTier()
    console.log('[SceneTierManager] FPS monitoring stub - awaiting RenderLoopService.metrics$');
  }

  /**
   * Update tier based on recent FPS average.
   *
   * Switches to fallback if FPS drops below threshold,
   * switches back to full if FPS recovers above threshold.
   */
  private updateTierBasedOnFPS(): void {
    const stats = this.getFPSStats();

    if (this.currentTier === 'full' && stats.average < this.FPS_THRESHOLD) {
      console.warn(
        `[SceneTierManager] FPS below threshold (${stats.average.toFixed(1)} < ${this.FPS_THRESHOLD}). Switching to fallback tier.`
      );
      this.setTier('fallback');
      // Reset history to give fallback tier a fresh start
      this.resetFPSHistory();
    } else if (this.currentTier === 'fallback' && stats.average >= this.FPS_THRESHOLD + 5) {
      // Add hysteresis (+5fps) to prevent thrashing
      console.log(
        `[SceneTierManager] FPS recovered (${stats.average.toFixed(1)} >= ${this.FPS_THRESHOLD + 5}). Switching to full tier.`
      );
      this.setTier('full');
      // Reset history to give full tier a fresh start
      this.resetFPSHistory();
    }
  }
}
