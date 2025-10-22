/**
 * TypeScript models for AGILE3D paper data
 * These models correspond to the JSON schemas defined in assets/data/schemas/
 */

// ============================================================================
// Control Knobs and Branch Configuration
// ============================================================================

export type EncodingFormat = 'voxel' | 'pillar';
export type SpatialResolution = 0.16 | 0.24 | 0.32 | 0.48 | 0.64;
export type SpatialEncoding = 'HV' | 'DV';
export type FeatureExtractor = 'transformer' | 'sparse_cnn' | '2d_cnn';
export type DetectionHead = 'anchor' | 'center';
export type ModelFamily = 'DSVT' | 'CenterPoint' | 'PointPillars' | 'VoxelNet';

export interface ControlKnobs {
  encodingFormat: EncodingFormat;
  spatialResolution: SpatialResolution;
  spatialEncoding: SpatialEncoding;
  featureExtractor: FeatureExtractor;
  detectionHead: DetectionHead;
}

export interface LatencyStats {
  mean: number; // milliseconds
  std: number; // milliseconds
}

export interface LatencyByContention {
  noContention: LatencyStats;
  lightContention: LatencyStats;
  moderateContention: LatencyStats;
  intenseContention: LatencyStats;
  peakContention: LatencyStats;
}

export interface AccuracyByScene {
  vehicleHeavy: number; // mAP percentage
  pedestrianHeavy: number; // mAP percentage
  mixed: number; // mAP percentage
}

export interface BranchPerformance {
  memoryFootprint: number; // GB
  latency: LatencyByContention;
  accuracy: AccuracyByScene;
}

export interface BranchConfig {
  branch_id: string;
  name: string;
  controlKnobs: ControlKnobs;
  performance: BranchPerformance;
  modelFamily: ModelFamily;
}

// ============================================================================
// Baseline Performance (DSVT-Voxel)
// ============================================================================

export type ContentionLevel = '0' | '38' | '45' | '64' | '67';

export interface ViolationRatesByContention {
  '0': number; // percentage
  '38': number; // percentage
  '45': number; // percentage
  '64': number; // percentage
  '67': number; // percentage
}

export interface ViolationRatesBySLO {
  '100ms': ViolationRatesByContention;
  '350ms': ViolationRatesByContention;
  '500ms': ViolationRatesByContention;
}

export interface BaselinePerformance {
  model: 'DSVT_Voxel';
  accuracyByScene: AccuracyByScene;
  latencyByContention: Record<ContentionLevel, LatencyStats>;
  violationRatesBySLO: ViolationRatesBySLO;
  memoryFootprint: number; // GB
}

// ============================================================================
// Accuracy vs Contention
// ============================================================================

export type Dataset = 'Waymo' | 'nuScenes' | 'KITTI';
export type SLOTarget = '100ms' | '350ms' | '500ms';

export type AccuracyByContention = Record<string, number>;

export type AccuracyBySLO = Record<string, AccuracyByContention>;

export interface AccuracyVsContention {
  dataset: Dataset;
  metric: 'mAP';
  contentionLevels: number[];
  sloTargets: number[];
  dsvt_voxel: AccuracyBySLO;
  agile3d: AccuracyBySLO;
}

// ============================================================================
// Pareto Frontier
// ============================================================================

export interface ParetoPoint {
  method: string;
  latency_ms: number;
  mAP: number;
  branch_id?: string;
  isBaseline?: boolean;
  controlKnobs?: ControlKnobs;
}

export interface ParetoFrontier {
  dataset: Dataset;
  points: ParetoPoint[];
}

// ============================================================================
// Utility Types for State Management
// ============================================================================

export interface SystemConfig {
  scene: 'vehicleHeavy' | 'pedestrianHeavy' | 'mixed';
  contentionLevel: number; // 0-100%
  latencySLO: number; // milliseconds
  voxelSize: SpatialResolution;
}

export interface Metrics {
  accuracy: number; // mAP percentage
  latency: number; // milliseconds
  violationRate: number; // percentage
  memoryUsage: number; // GB
  sloCompliance: boolean;
}

export interface ComparisonData {
  baseline: {
    branch: BranchConfig;
    metrics: Metrics;
  };
  agile3d: {
    branch: BranchConfig;
    metrics: Metrics;
  };
  deltas: {
    accuracyGain: number; // percentage points
    latencyDifference: number; // milliseconds
    violationReduction: number; // percentage points
  };
}
