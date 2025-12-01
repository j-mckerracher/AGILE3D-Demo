/**
 * Branch Configuration and Performance Data Models
 *
 * Defines typed contracts for AGILE3D branch configurations and baseline performance data.
 * These models align with the JSON data files in src/assets/data/ and support
 * the SimulationService branch selection and metrics calculation logic.
 *
 * @see PRD Section 6.3 (Branch Configuration Data)
 * @see WP-2.2.3 (SimulationService)
 */

/**
 * Contention level categories for latency lookup.
 * Maps to GPU resource contention percentages.
 */
export type ContentionLevel =
  | 'noContention' // 0% contention
  | 'lightContention' // 20% contention
  | 'moderateContention' // 50% contention
  | 'intenseContention'; // 90% contention

/**
 * Latency statistics for a given contention level.
 */
export interface LatencyStats {
  /** Mean latency in milliseconds */
  mean: number;
  /** Standard deviation in milliseconds */
  std: number;
}

/**
 * Accuracy metrics per scene type.
 * Values are mean Average Precision (mAP) percentages.
 */
export interface AccuracyByScene {
  /** Accuracy for vehicle-heavy scenes (mAP %) */
  'vehicle-heavy': number;
  /** Accuracy for pedestrian-heavy scenes (mAP %) */
  'pedestrian-heavy': number;
  /** Accuracy for mixed traffic scenes (mAP %) */
  mixed: number;
}

/**
 * Performance characteristics for a branch across contention levels and scenes.
 */
export interface BranchPerformance {
  /** GPU memory footprint in gigabytes */
  memoryFootprint: number;

  /**
   * Latency statistics indexed by contention level.
   * Each level contains mean and standard deviation in milliseconds.
   */
  latency: Record<ContentionLevel, LatencyStats>;

  /**
   * Accuracy (mAP %) indexed by scene type.
   */
  accuracy: AccuracyByScene;
}

/**
 * Control knobs configuration for a branch.
 * These parameters define the detection pipeline architecture.
 *
 * @see PRD FR-2.12 (Display control knob settings)
 */
export interface BranchControlKnobs {
  /** Point cloud encoding format */
  encodingFormat: 'voxel' | 'pillar';

  /** Spatial resolution (voxel/pillar size) in meters */
  spatialResolution: number;

  /** Spatial encoding dimension (HV=horizontal-vertical, DV=depth-vertical) */
  spatialEncoding: 'HV' | 'DV';

  /** 3D feature extraction backbone network type */
  featureExtractor: 'transformer' | 'sparse_cnn' | '2d_cnn';

  /** Detection head architecture type */
  detectionHead: 'anchor' | 'center';
}

/**
 * Complete branch configuration including performance data.
 * Represents a single AGILE3D branch or the baseline model.
 */
export interface BranchConfig {
  /** Unique branch identifier (e.g., "CP_Pillar_032", "DSVT_Voxel") */
  branch_id: string;

  /** Human-readable branch name */
  name: string;

  /** Control knobs configuration */
  controlKnobs: BranchControlKnobs;

  /** Performance metrics across contention levels and scenes */
  performance: BranchPerformance;

  /** Model family identifier (e.g., "CenterPoint", "DSVT") */
  modelFamily: string;
}

/**
 * Branches data file structure (branches.json).
 * Contains all available AGILE3D branches for selection.
 */
export interface BranchesData {
  branches: BranchConfig[];
}

/**
 * Baseline data file structure (baseline.json).
 * Contains the fixed DSVT-Voxel baseline configuration.
 */
export type BaselineData = BranchConfig;
