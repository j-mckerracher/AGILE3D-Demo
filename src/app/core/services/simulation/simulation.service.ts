import { Injectable } from '@angular/core';
import { combineLatest, distinctUntilChanged, map, Observable, shareReplay } from 'rxjs';
import { PaperDataService } from '../data/paper-data.service';
import { StateService } from '../state/state.service';
import {
  AdvancedKnobs,
  AlgorithmMetrics,
  ComparisonMetrics,
  Metrics,
  SceneId,
  SystemParams,
} from '../../models/config-and-metrics';
import { BranchConfig, LatencyStats } from '../../models/branch.models';

/**
 * SimulationService implements branch selection logic and metrics calculation
 * for the AGILE3D interactive demo.
 *
 * This service:
 * - Selects the optimal AGILE3D branch based on current system parameters
 * - Computes baseline (DSVT-Voxel) and AGILE3D metrics
 * - Calculates comparison deltas
 * - Provides reactive streams for UI consumption
 *
 * Performance targets:
 * - Branch selection and metrics computation: <100ms
 * - Observable propagation to UI: <200ms total
 *
 * @see PRD FR-2.10–2.13 (Active branch and configuration display)
 * @see PRD FR-3.1–3.4 (Metrics and comparison)
 * @see PRD NFR-1.3–1.4 (Performance requirements)
 * @see WP-2.2.3 (SimulationService implementation)
 */
@Injectable({ providedIn: 'root' })
export class SimulationService {
  /**
   * Memoization cache for branch selection.
   * Key: JSON-stringified (SystemParams + AdvancedKnobs)
   * Value: selected branch ID
   */
  private readonly branchSelectionCache = new Map<string, string>();

  /**
   * Memoization cache for metrics calculation.
   * Key: JSON-stringified (branchId + SystemParams)
   * Value: calculated metrics
   */
  private readonly metricsCache = new Map<string, {
    baseline: Metrics;
    agile: Metrics;
    deltas: ComparisonMetrics;
  }>();

  /**
   * Reactive stream of the currently selected AGILE3D branch ID.
   * Updates when system parameters or advanced knobs change.
   * Uses memoization to avoid redundant computations.
   */
  public readonly activeBranch$: Observable<string>;

  /**
   * Reactive stream of baseline (DSVT-Voxel) metrics.
   * Updates based on current system parameters.
   */
  public readonly baselineMetrics$: Observable<AlgorithmMetrics>;

  /**
   * Reactive stream of AGILE3D metrics for the currently selected branch.
   * Updates based on current system parameters and active branch.
   */
  public readonly agileMetrics$: Observable<AlgorithmMetrics>;

  /**
   * Reactive stream of comparison metrics (deltas between AGILE3D and baseline).
   * Positive values indicate AGILE3D improvement.
   */
  public readonly comparison$: Observable<ComparisonMetrics>;

  constructor(
    private readonly paperData: PaperDataService,
    private readonly state: StateService
  ) {
    // Set up reactive stream for active branch selection
    this.activeBranch$ = combineLatest([
      this.state.currentParams$,
      this.state.advancedKnobs$,
      this.paperData.getBranches(),
    ]).pipe(
      map(([params, knobs, branches]) =>
        this.selectOptimalBranch(params, knobs, branches)
      ),
      distinctUntilChanged(),
      shareReplay(1)
    );

    // Set up reactive stream for baseline metrics
    this.baselineMetrics$ = combineLatest([
      this.state.currentParams$,
      this.paperData.getBaseline(),
    ]).pipe(
      map(([params, baseline]) =>
        this.calculateBaselineMetrics(params, baseline)
      ),
      shareReplay(1)
    );

    // Set up reactive stream for AGILE3D metrics
    this.agileMetrics$ = combineLatest([
      this.state.currentParams$,
      this.activeBranch$,
      this.paperData.getBranches(),
    ]).pipe(
      map(([params, branchId, branches]) => {
        const branch = branches.find((b) => b.branch_id === branchId);
        if (!branch) {
          throw new Error(`Active branch not found: ${branchId}`);
        }
        return this.calculateAgileMetrics(params, branch);
      }),
      shareReplay(1)
    );

    // Set up reactive stream for comparison deltas
    this.comparison$ = combineLatest([
      this.baselineMetrics$,
      this.agileMetrics$,
    ]).pipe(
      map(([baseline, agile]) => this.calculateComparison(baseline, agile)),
      shareReplay(1)
    );

    // Wire activeBranch$ updates back to StateService for other consumers
    this.activeBranch$.subscribe((branchId) => {
      this.state.setActiveBranch(branchId);
    });
  }

  /**
   * Select the optimal AGILE3D branch based on system parameters and advanced knobs.
   *
   * Selection algorithm:
   * 1. Filter branches by encoding format preference (if specified in knobs)
   * 2. Score each candidate branch based on:
   *    - Spatial resolution closeness to target voxel size
   *    - SLO feasibility penalty (sharp penalty for SLO violations)
   *    - Format match bonus/penalty
   * 3. Return branch with lowest score (best match)
   *
   * Uses memoization to avoid redundant calculations for identical inputs.
   *
   * @param params - Current system parameters (scene, voxel size, contention, SLO)
   * @param knobs - Advanced control knobs (encoding format, detection head, feature extractor)
   * @param branches - Available AGILE3D branch configurations
   * @returns Branch ID of the selected optimal branch
   */
  private selectOptimalBranch(
    params: SystemParams,
    knobs: AdvancedKnobs,
    branches: BranchConfig[]
  ): string {
    // Check memoization cache
    const cacheKey = JSON.stringify({ params, knobs });
    const cached = this.branchSelectionCache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    // Ensure we have at least one branch
    if (branches.length === 0) {
      throw new Error('No branches available for selection');
    }

    // Score and select best branch
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    let bestBranch: BranchConfig = branches[0]!;
    let bestScore = Infinity;

    for (const branch of branches) {
      const score = this.scoreBranch(branch, params, knobs);
      if (score < bestScore) {
        bestScore = score;
        bestBranch = branch;
      }
    }

    // Cache and return
    this.branchSelectionCache.set(cacheKey, bestBranch.branch_id);

    // Limit cache size to prevent unbounded growth
    if (this.branchSelectionCache.size > 100) {
      const firstKey = this.branchSelectionCache.keys().next().value;
      if (firstKey !== undefined) {
        this.branchSelectionCache.delete(firstKey);
      }
    }

    return bestBranch.branch_id;
  }

  /**
   * Score a branch candidate for selection.
   * Lower score = better match.
   *
   * Scoring components:
   * 1. Spatial resolution difference (meters)
   * 2. SLO penalty (latency > SLO gets heavily penalized)
   * 3. Format mismatch penalty
   *
   * @param branch - Branch configuration to score
   * @param params - System parameters
   * @param knobs - Advanced knobs
   * @returns Numeric score (lower is better)
   */
  private scoreBranch(
    branch: BranchConfig,
    params: SystemParams,
    knobs: AdvancedKnobs
  ): number {
    // Component 1: Spatial resolution closeness
    const voxelDiff = Math.abs(
      branch.controlKnobs.spatialResolution - params.voxelSize
    );

    // Component 2: SLO feasibility penalty
    const latencyStats = this.lookupLatencySync(branch, params.contentionPct);
    const latencyMean = latencyStats.mean;
    const sloPenalty = latencyMean > params.sloMs
      ? (latencyMean - params.sloMs) * 10 // Sharp penalty for SLO violations
      : 0;

    // Component 3: Format match
    const formatPenalty =
      knobs.encodingFormat &&
      knobs.encodingFormat !== branch.controlKnobs.encodingFormat
        ? 100 // Large penalty for format mismatch
        : 0;

    return voxelDiff + sloPenalty + formatPenalty;
  }

  /**
   * Synchronous lookup of latency stats from branch configuration.
   * Helper method for scoring during branch selection.
   *
   * @param branch - Branch configuration
   * @param contentionPct - Contention percentage
   * @returns Latency statistics
   */
  private lookupLatencySync(
    branch: BranchConfig,
    contentionPct: number
  ): LatencyStats {
    const level = this.mapContentionToLevel(contentionPct);
    return branch.performance.latency[level];
  }

  /**
   * Calculate baseline (DSVT-Voxel) metrics for current system parameters.
   *
   * @param params - Current system parameters
   * @param baseline - Baseline configuration
   * @returns Baseline metrics with algorithm metadata
   */
  private calculateBaselineMetrics(
    params: SystemParams,
    baseline: BranchConfig
  ): AlgorithmMetrics {
    const latencyStats = this.lookupLatencySync(baseline, params.contentionPct);
    const accuracy = baseline.performance.accuracy[params.scene];
    const memory = baseline.performance.memoryFootprint;

    // Calculate violation rate using latency distribution
    // Simplified: assume normal distribution, violation if mean > SLO
    const violationRate = latencyStats.mean > params.sloMs
      ? this.estimateViolationRate(latencyStats, params.sloMs)
      : 0;

    return {
      name: 'DSVT-Voxel',
      accuracyMap: accuracy,
      latencyMs: latencyStats.mean,
      violationRate,
      memoryGb: memory,
      sloCompliance: latencyStats.mean <= params.sloMs,
    };
  }

  /**
   * Calculate AGILE3D metrics for current system parameters and selected branch.
   *
   * @param params - Current system parameters
   * @param branch - Selected AGILE3D branch configuration
   * @returns AGILE3D metrics with branch metadata
   */
  private calculateAgileMetrics(
    params: SystemParams,
    branch: BranchConfig
  ): AlgorithmMetrics {
    const latencyStats = this.lookupLatencySync(branch, params.contentionPct);
    const accuracy = branch.performance.accuracy[params.scene];
    const memory = branch.performance.memoryFootprint;

    const violationRate = latencyStats.mean > params.sloMs
      ? this.estimateViolationRate(latencyStats, params.sloMs)
      : 0;

    return {
      name: 'AGILE3D',
      activeBranch: branch.branch_id,
      accuracyMap: accuracy,
      latencyMs: latencyStats.mean,
      violationRate,
      memoryGb: memory,
      sloCompliance: latencyStats.mean <= params.sloMs,
    };
  }

  /**
   * Calculate comparison metrics (deltas) between AGILE3D and baseline.
   *
   * Positive values indicate AGILE3D improvement:
   * - accuracyDelta > 0: AGILE3D more accurate
   * - latencyDeltaMs < 0: AGILE3D faster
   * - violationReduction > 0: AGILE3D fewer violations
   *
   * @param baseline - Baseline metrics
   * @param agile - AGILE3D metrics
   * @returns Comparison deltas
   */
  private calculateComparison(
    baseline: Metrics,
    agile: Metrics
  ): ComparisonMetrics {
    return {
      accuracyDelta: agile.accuracyMap - baseline.accuracyMap,
      latencyDeltaMs: agile.latencyMs - baseline.latencyMs,
      violationReduction: baseline.violationRate - agile.violationRate,
    };
  }

  /**
   * Estimate SLO violation rate based on latency distribution.
   * Simplified model: assumes normal distribution, calculates probability of exceeding SLO.
   *
   * For production, this could use actual empirical CDF from paper data.
   *
   * @param latencyStats - Latency mean and standard deviation
   * @param sloMs - Service level objective in milliseconds
   * @returns Estimated violation rate as percentage (0-100)
   */
  private estimateViolationRate(
    latencyStats: LatencyStats,
    sloMs: number
  ): number {
    // Simplified: if mean > SLO, estimate violation rate based on how far above
    const zScore = (sloMs - latencyStats.mean) / (latencyStats.std || 1);

    // Rough approximation using standard normal CDF
    // For z < -2: ~97% violations
    // For z = 0: ~50% violations
    // For z > 2: ~3% violations
    if (zScore <= -2) return 95;
    if (zScore >= 2) return 5;

    // Linear interpolation for middle range
    const violationPct = 50 - zScore * 23.5;
    return Math.max(0, Math.min(100, violationPct));
  }

  /**
   * Map a continuous contention percentage to a discrete contention level.
   * Mirrors PaperDataService implementation for consistency.
   *
   * @param contentionPct - Contention percentage (0-100)
   * @returns Discrete contention level
   */
  private mapContentionToLevel(contentionPct: number):
    'noContention' | 'lightContention' | 'moderateContention' | 'intenseContention' | 'peakContention' {
    const clamped = Math.max(0, Math.min(100, contentionPct));

    if (clamped < 20) return 'noContention';
    if (clamped < 42) return 'lightContention';
    if (clamped < 55) return 'moderateContention';
    if (clamped < 66) return 'intenseContention';
    return 'peakContention';
  }
}
