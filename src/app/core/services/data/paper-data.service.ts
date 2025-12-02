import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  BranchConfig,
  BranchesData,
  BaselineData,
  ContentionLevel,
  LatencyStats,
} from '../../models/branch.models';
import { SceneId } from '../../models/config-and-metrics';

/**
 * PaperDataService provides access to precomputed branch configurations,
 * baseline performance data, and lookup tables derived from the AGILE3D paper.
 *
 * This service loads JSON data files once and caches them for fast lookup operations
 * during branch selection and metrics calculation.
 *
 * @see PRD Section 6.3 (Branch Configuration Data)
 * @see PRD NFR-5.2 (Separated data layer)
 * @see WP-2.2.3 (SimulationService data access)
 */
@Injectable({ providedIn: 'root' })
export class PaperDataService {
  /**
   * Cached observable of all AGILE3D branch configurations.
   * Loaded once and shared across all subscribers.
   */
  private readonly branchesData$: Observable<BranchesData>;

  /**
   * Cached observable of baseline (DSVT-Voxel) configuration.
   * Loaded once and shared across all subscribers.
   */
  private readonly baselineData$: Observable<BaselineData>;

  // eslint-disable-next-line @angular-eslint/prefer-inject
  public constructor(private readonly http: HttpClient) {
    this.branchesData$ = this.http
      .get<BranchesData>('assets/data/branches.json')
      .pipe(shareReplay(1));

    this.baselineData$ = this.http
      .get<BaselineData>('assets/data/baseline.json')
      .pipe(shareReplay(1));
  }

  /**
   * Get all available AGILE3D branch configurations.
   * Returns a cached observable that emits the complete branches data.
   *
   * @returns Observable emitting array of branch configurations
   */
  public getBranches(): Observable<BranchConfig[]> {
    return this.branchesData$.pipe(map((data) => data.branches));
  }

  /**
   * Get the baseline (DSVT-Voxel) configuration.
   * Returns a cached observable that emits the baseline data.
   *
   * @returns Observable emitting baseline configuration
   */
  public getBaseline(): Observable<BaselineData> {
    return this.baselineData$;
  }

  /**
   * Lookup latency statistics for a specific branch at a given contention level.
   *
   * @param branchId - Branch identifier (e.g., "CP_Pillar_032")
   * @param contentionPct - GPU contention percentage (0-100)
   * @returns Observable emitting latency stats (mean and std in ms)
   */
  public lookupLatency(branchId: string, contentionPct: number): Observable<LatencyStats> {
    const level = this.mapContentionToLevel(contentionPct);
    return this.branchesData$.pipe(
      map((data) => {
        const branch = data.branches.find((b) => b.branch_id === branchId);
        if (!branch) {
          throw new Error(`Branch not found: ${branchId}`);
        }
        return branch.performance.latency[level];
      })
    );
  }

  /**
   * Lookup accuracy (mAP) for a specific branch and scene type.
   *
   * @param branchId - Branch identifier
   * @param scene - Scene type identifier
   * @returns Observable emitting accuracy as mAP percentage
   */
  public lookupAccuracy(branchId: string, scene: SceneId): Observable<number> {
    return this.branchesData$.pipe(
      map((data) => {
        const branch = data.branches.find((b) => b.branch_id === branchId);
        if (!branch) {
          throw new Error(`Branch not found: ${branchId}`);
        }
        return branch.performance.accuracy[scene];
      })
    );
  }

  /**
   * Lookup memory footprint for a specific branch.
   *
   * @param branchId - Branch identifier
   * @returns Observable emitting memory usage in gigabytes
   */
  public lookupMemory(branchId: string): Observable<number> {
    return this.branchesData$.pipe(
      map((data) => {
        const branch = data.branches.find((b) => b.branch_id === branchId);
        if (!branch) {
          throw new Error(`Branch not found: ${branchId}`);
        }
        return branch.performance.memoryFootprint;
      })
    );
  }

  /**
   * Get baseline latency statistics at a given contention level.
   *
   * @param contentionPct - GPU contention percentage (0-100)
   * @returns Observable emitting baseline latency stats
   */
  public getBaselineLatency(contentionPct: number): Observable<LatencyStats> {
    const level = this.mapContentionToLevel(contentionPct);
    return this.baselineData$.pipe(map((baseline) => baseline.performance.latency[level]));
  }

  /**
   * Get baseline accuracy for a specific scene type.
   *
   * @param scene - Scene type identifier
   * @returns Observable emitting baseline accuracy as mAP percentage
   */
  public getBaselineAccuracy(scene: SceneId): Observable<number> {
    return this.baselineData$.pipe(map((baseline) => baseline.performance.accuracy[scene]));
  }

  /**
   * Get baseline memory footprint.
   *
   * @returns Observable emitting baseline memory usage in gigabytes
   */
  public getBaselineMemory(): Observable<number> {
    return this.baselineData$.pipe(map((baseline) => baseline.performance.memoryFootprint));
  }

  /**
   * Map a continuous contention percentage to a discrete contention level category.
   * Uses nearest-neighbor binning based on Excel lookup table data.
   *
   * Bins:
   * - 0-9%: noContention (0% nominal)
   * - 10-34%: lightContention (20% nominal)
   * - 35-69%: moderateContention (50% nominal)
   * - 70-100%: intenseContention (90% nominal)
   *
   * @param contentionPct - Contention percentage (0-100)
   * @returns Discrete contention level for lookup
   */
  private mapContentionToLevel(contentionPct: number): ContentionLevel {
    const clamped = Math.max(0, Math.min(100, contentionPct));

    if (clamped < 10) return 'noContention';
    if (clamped < 35) return 'lightContention';
    if (clamped < 70) return 'moderateContention';
    return 'intenseContention';
  }
}
