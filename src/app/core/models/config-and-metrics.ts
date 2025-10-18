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

/**
 * Advanced control knobs for AGILE3D branch selection.
 *
 * These parameters provide fine-grained control over the detection pipeline
 * architecture. Controlled via the Advanced Controls panel (FR-2.7–2.9).
 *
 * @see PRD FR-2.8 (Advanced control options)
 * @see PRD FR-2.12 (Display control knob settings for AGILE3D)
 */
export interface AdvancedKnobs {
  /**
   * Point cloud encoding format.
   * - voxel: 3D voxel grid encoding (higher accuracy, higher latency)
   * - pillar: 2D pillar encoding (lower latency, slightly lower accuracy)
   */
  encodingFormat: 'voxel' | 'pillar';

  /**
   * 3D object detection head type.
   * - anchor: Anchor-based detection (predefined bounding box templates)
   * - center: Center-based detection (CenterPoint-style keypoint prediction)
   */
  detectionHead: 'anchor' | 'center';

  /**
   * Feature extraction backbone network.
   * - transformer: Transformer-based 3D feature extractor (DSVT-style, highest accuracy)
   * - sparse_cnn: Sparse 3D CNN backbone (balanced accuracy/latency)
   * - 2d_cnn: 2D CNN on BEV features (lowest latency, lower accuracy)
   */
  featureExtractor: 'transformer' | 'sparse_cnn' | '2d_cnn';
}
