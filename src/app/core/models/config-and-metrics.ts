/**
 * UI State and Data Contracts for AGILE3D Interactive Demo
 *
 * Defines typed contracts for configuration parameters and performance metrics
 * to enable type-safe reactive data flow from control panel → state → simulation → metrics display.
 *
 * @see PRD FR-2.4–2.6 (control panel inputs)
 * @see PRD FR-3.1–3.3 (metrics display)
 * @see PRD NFR-5.1, NFR-6.1 (strict types, maintainable code)
 */

/**
 * Scene identifiers aligned with PRD.
 * - vehicle-heavy: High vehicle density scenario
 * - pedestrian-heavy: High pedestrian density scenario
 * - mixed: Mixed traffic scenario with balanced object types
 */
export type SceneId = 'vehicle-heavy' | 'pedestrian-heavy' | 'mixed';

/**
 * Voxel sizes in meters.
 * Spatial resolution options for point cloud voxelization.
 * Range: 0.16m (fine) to 0.64m (coarse)
 */
export type VoxelSize = 0.16 | 0.24 | 0.32 | 0.48 | 0.64;

/**
 * System configuration parameters.
 * Represents the current state of user-controlled inputs that drive
 * simulation and metrics calculations.
 */
export interface SystemParams {
  /** Selected scene identifier */
  scene: SceneId;

  /** Spatial resolution for voxelization (meters) */
  voxelSize: VoxelSize;

  /** GPU contention level as percentage (0-100) */
  contentionPct: number;

  /** Latency Service Level Objective in milliseconds (100-500) */
  sloMs: number;
}

/**
 * Base performance metrics structure.
 * Common fields for both baseline and AGILE3D algorithm performance.
 */
export interface Metrics {
  /** Mean Average Precision (mAP) as percentage (0-100) */
  accuracyMap: number;

  /** Average inference latency in milliseconds */
  latencyMs: number;

  /** SLO violation rate as percentage (0-100) */
  violationRate: number;

  /** Memory consumption in gigabytes */
  memoryGb: number;

  /** Whether current configuration meets SLO requirements */
  sloCompliance: boolean;
}

/**
 * Algorithm-specific metrics with additional metadata.
 * Extends base Metrics with algorithm identification and branch-switching info.
 */
export interface AlgorithmMetrics extends Metrics {
  /** Algorithm name (e.g., "DSVT-Voxel", "AGILE3D") */
  name: string;

  /** Active AGILE3D branch identifier (e.g., "CP_Pillar_032"), if applicable */
  activeBranch?: string;

  /** Count of branch switches during evaluation period, if applicable */
  branchSwitches?: number;
}

/**
 * Comparison metrics showing relative performance differences.
 * Represents AGILE3D performance deltas relative to baseline.
 * Positive values indicate AGILE3D improvement; negative indicate degradation.
 */
export interface ComparisonMetrics {
  /** Accuracy difference in percentage points (+/-) */
  accuracyDelta: number;

  /** Latency difference in milliseconds (+/- ms, negative = faster) */
  latencyDeltaMs: number;

  /** SLO violation rate reduction in percentage points (+/- pp) */
  violationReduction: number;
}
