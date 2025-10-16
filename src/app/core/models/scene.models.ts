/** Fixed-length 3D vector. */
export type Vec3 = [number, number, number];

/** Object dimensions: width (x), length (y), height (z) in meters. */
export interface Dimensions {
  width: number;
  length: number;
  height: number;
}

/** Allowed detection classes. */
export type DetectionClass = 'vehicle' | 'pedestrian' | 'cyclist';

/**
 * Detection structure aligned with PRD and Phase 1 plan.
 */
export interface Detection {
  id: string;
  class: DetectionClass;
  center: Vec3;
  dimensions: Dimensions;
  yaw: number;
  confidence: number;
  matches_gt?: string;
}

/**
 * Scene metadata describing point cloud and annotations.
 */
export interface SceneMetadata {
  scene_id: string;
  name: string;
  description?: string;
  pointsBin: string;
  pointCount: number;
  pointStride: number; // 3 for [x,y,z]
  bounds: { min: Vec3; max: Vec3 };
  ground_truth: Detection[];
  predictions: Record<string, Detection[]>; // keys: e.g., "DSVT_Voxel", "AGILE3D_CP_Pillar_032"
  metadata: {
    vehicleCount: number;
    pedestrianCount: number;
    cyclistCount: number;
    complexity: string;
    optimalBranch: string;
  };
}

/**
 * Scene registry entry for listing available scenes.
 */
export interface SceneRegistryEntry {
  scene_id: string;
  name: string;
  description: string;
  complexity: string;
  pointCount: number;
  hasFallback: boolean;
}

/**
 * Scene registry containing all available scenes.
 */
export interface SceneRegistry {
  version: string;
  scenes: SceneRegistryEntry[];
}

/**
 * Quality tier for point cloud data.
 */
export type QualityTier = 'full' | 'fallback';

/**
 * Worker message for parsing point cloud data.
 */
export interface WorkerParseMessage {
  arrayBuffer: ArrayBuffer;
  stride: number;
}

/**
 * Worker response after parsing point cloud data.
 */
export interface WorkerParseResponse {
  ok: boolean;
  positions?: Float32Array;
  error?: string;
}
