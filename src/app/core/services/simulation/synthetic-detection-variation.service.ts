/**
 * Synthetic Detection Variation Service
 *
 * PURPOSE:
 * ========
 * This service generates synthetic variations of 3D object detections to simulate
 * how different AGILE3D branches would produce different detection results.
 *
 * WHY THIS EXISTS:
 * ================
 * The scene metadata files currently only contain ONE set of AGILE3D predictions
 * (AGILE3D_CP_Pillar_032) for each scene. When users adjust voxel size or contention,
 * the SimulationService correctly selects different branches (e.g., CP_Pillar_064,
 * CP_Voxel_024), but the metadata doesn't have actual predictions for those branches.
 *
 * Without this service:
 * - Metrics change correctly (latency, accuracy, memory)
 * - But 3D bounding boxes remain visually identical
 * - Users can't see the impact of their parameter choices
 *
 * WHAT THIS SERVICE DOES:
 * ========================
 * Takes a base set of detections and applies controlled, deterministic transformations
 * based on branch characteristics (voxel size, encoding format, feature extractor).
 * These transformations simulate realistic differences that would occur in actual
 * 3D object detection pipelines.
 *
 * IMPORTANT: This is a SIMULATION for demo purposes. In a production system, you
 * would have actual predictions from running each branch configuration through the
 * real detector. This service exists because generating real predictions for all
 * branch combinations would require:
 * - Running inference on actual 3D detection models
 * - Significant computational resources
 * - Access to trained models for all configurations
 *
 * REALISM:
 * =========
 * The transformations are based on known characteristics of 3D object detection:
 *
 * 1. VOXEL/PILLAR SIZE (Spatial Resolution):
 *    - Larger voxels (0.64m): Lower spatial resolution
 *      → Misses smaller objects (below size threshold)
 *      → Less precise bounding boxes (quantization error)
 *      → Faster inference (fewer voxels to process)
 *    - Smaller voxels (0.16m): Higher spatial resolution
 *      → Detects smaller objects
 *      → More precise bounding boxes
 *      → Slower inference (more voxels to process)
 *
 * 2. ENCODING FORMAT (Voxel vs Pillar):
 *    - Voxel: Full 3D grid encoding
 *      → Better vertical (Z-axis) precision
 *      → More accurate object heights
 *    - Pillar: Columnar encoding (collapses Z dimension)
 *      → Less vertical precision
 *      → Faster processing (fewer features)
 *
 * 3. FEATURE EXTRACTOR (Transformer vs CNN vs 2D CNN):
 *    - Transformer: Better long-range dependencies
 *      → Higher confidence on distant objects
 *    - 2D CNN: Fastest but limited context
 *      → Lower confidence on occluded objects
 *
 * 4. DETECTION HEAD (Anchor-based vs Center-based):
 *    - Anchor-based: Predicts offsets from predefined boxes
 *      → Better for common object sizes
 *    - Center-based: Predicts from object centers
 *      → Better for unusual aspect ratios
 *
 * DETERMINISM:
 * ============
 * All transformations are deterministic - same branch + same base detections
 * always produce the same output. This is achieved through:
 * - Seeded random number generation (branch ID → seed)
 * - Consistent ordering of detections
 * - Reproducible transformation algorithms
 *
 * @see WP-2.3.1 Metrics Dashboard (visual feedback requirement)
 * @see PRD FR-1.14 (Detection visualization requirements)
 */

import { Injectable } from '@angular/core';
import { Detection } from '../../models/scene.models';
import { BranchConfig } from '../../models/branch.models';

/**
 * Seeded pseudo-random number generator for deterministic variations.
 * Uses a simple LCG (Linear Congruential Generator) algorithm.
 */
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed % 2147483647;
    if (this.seed <= 0) this.seed += 2147483646;
  }

  /**
   * Generate next random number in range [0, 1)
   */
  public next(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }

  /**
   * Generate random number in range [min, max)
   */
  public range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /**
   * Generate random boolean with given probability
   */
  public bool(probability: number): boolean {
    return this.next() < probability;
  }
}

@Injectable({ providedIn: 'root' })
export class SyntheticDetectionVariationService {
  /**
   * Apply synthetic variations to detections based on branch characteristics.
   *
   * This creates a new array of detections with modifications that simulate
   * how the specified branch configuration would affect detection results.
   *
   * @param baseDetections - Original detections from metadata
   * @param branch - Branch configuration specifying algorithm parameters
   * @param contentionPct - GPU resource contention percentage (0-100), optional
   * @returns New array of modified detections (original array is not mutated)
   */
  public applyBranchVariations(
    baseDetections: Detection[],
    branch: BranchConfig,
    contentionPct: number = 0
  ): Detection[] {
    if (!baseDetections || baseDetections.length === 0) {
      return [];
    }

    // Create seeded RNG from branch ID for deterministic variations
    const rng = this.createSeededRng(branch.branch_id);

    // Start with deep copy to avoid mutating original
    let varied = this.deepCopyDetections(baseDetections);

    // Apply transformations in order (each builds on previous)

    // 1. Voxel/Pillar size affects spatial resolution and detection capability
    varied = this.applyVoxelSizeVariation(varied, branch, rng);

    // 2. Encoding format affects precision (voxel vs pillar)
    varied = this.applyEncodingFormatVariation(varied, branch, rng);

    // 3. Feature extractor affects confidence scores
    varied = this.applyFeatureExtractorVariation(varied, branch, rng);

    // 4. Detection head affects bounding box fitting
    varied = this.applyDetectionHeadVariation(varied, branch, rng);

    // 5. Contention affects reliability and confidence (if specified)
    if (contentionPct > 0) {
      varied = this.applyContentionVariation(varied, contentionPct, rng);
    }

    return varied;
  }

  /**
   * Apply variations based on voxel/pillar size (spatial resolution).
   *
   * REALISTIC BASIS:
   * - Larger voxels = coarser grid = objects smaller than voxel size may be missed
   * - Larger voxels = quantization error increases = less precise bboxes
   * - Smaller voxels = finer grid = better localization
   *
   * TRANSFORMATIONS:
   * - Filter out small objects that fall below detection threshold
   * - Add position jitter proportional to voxel size (quantization error)
   * - Adjust dimension precision (larger voxels = rounder dimensions)
   */
  private applyVoxelSizeVariation(
    detections: Detection[],
    branch: BranchConfig,
    rng: SeededRandom
  ): Detection[] {
    const voxelSize = branch.controlKnobs.spatialResolution;

    // Calculate size threshold: objects smaller than ~2x voxel size may be missed
    const sizeThreshold = voxelSize * 2.0;

    // Quantization error: position uncertainty proportional to voxel size
    const positionJitter = voxelSize * 0.3; // ±30% of voxel size

    // Dimension rounding: larger voxels snap dimensions to coarser increments
    const dimensionRounding = voxelSize * 0.5;

    // Process detections: filter small objects and apply transformations
    const varied: Detection[] = [];

    for (const det of detections) {
      // Calculate miss probability for this detection
      const minDim = Math.min(det.dimensions.width, det.dimensions.length, det.dimensions.height);
      const missProbability = Math.max(0, (sizeThreshold - minDim) / sizeThreshold);

      // Probabilistic filtering: larger voxels miss smaller objects
      if (rng.bool(missProbability * 0.5)) {
        // Max 50% chance to miss - skip this detection
        continue;
      }

      // Apply transformations to surviving detections
      varied.push({
        ...det,
        // Add position jitter (quantization error)
        center: [
          det.center[0] + rng.range(-positionJitter, positionJitter),
          det.center[1] + rng.range(-positionJitter, positionJitter),
          det.center[2] + rng.range(-positionJitter, positionJitter) * 0.5, // Less Z jitter
        ] as [number, number, number],

        // Round dimensions to voxel grid
        dimensions: {
          width: this.roundToNearest(det.dimensions.width, dimensionRounding),
          length: this.roundToNearest(det.dimensions.length, dimensionRounding),
          height: this.roundToNearest(det.dimensions.height, dimensionRounding),
        },

        // Adjust confidence based on object size relative to voxel
        confidence: det.confidence * (1.0 - missProbability * 0.2),
      });
    }

    return varied;
  }

  /**
   * Apply variations based on encoding format (voxel vs pillar).
   *
   * REALISTIC BASIS:
   * - Voxel encoding: Full 3D grid preserves vertical information
   * - Pillar encoding: Collapses Z dimension, loses some height precision
   *
   * TRANSFORMATIONS:
   * - Pillar: Reduce height precision (Z-axis compression)
   * - Voxel: Maintain full 3D precision
   */
  private applyEncodingFormatVariation(
    detections: Detection[],
    branch: BranchConfig,
    rng: SeededRandom
  ): Detection[] {
    const isPillar = branch.controlKnobs.encodingFormat === 'pillar';

    if (!isPillar) {
      return detections; // Voxel encoding maintains precision
    }

    // Pillar encoding loses vertical precision
    const heightJitter = 0.15; // ±15cm typical pillar quantization

    return detections.map((det) => ({
      ...det,
      center: [
        det.center[0],
        det.center[1],
        det.center[2] + rng.range(-heightJitter, heightJitter), // Z jitter
      ] as [number, number, number],
      dimensions: {
        ...det.dimensions,
        // Height less accurate with pillar encoding
        height: det.dimensions.height * rng.range(0.95, 1.05),
      },
    }));
  }

  /**
   * Apply variations based on feature extractor type.
   *
   * REALISTIC BASIS:
   * - Transformer: Better global context → higher confidence on distant/occluded objects
   * - Sparse CNN: Moderate context → baseline confidence
   * - 2D CNN: Limited context → lower confidence on complex scenes
   *
   * TRANSFORMATIONS:
   * - Adjust confidence scores based on extractor capability
   * - Transformer gets bonus for distant objects
   * - 2D CNN penalty for objects far from camera
   */
  private applyFeatureExtractorVariation(
    detections: Detection[],
    branch: BranchConfig,
    rng: SeededRandom
  ): Detection[] {
    const extractor = branch.controlKnobs.featureExtractor;

    // Calculate confidence multipliers
    let baseMultiplier = 1.0;
    let distanceSensitivity = 0.0;

    switch (extractor) {
      case 'transformer':
        baseMultiplier = 1.05; // +5% baseline confidence
        distanceSensitivity = 0.02; // Better on distant objects
        break;
      case 'sparse_cnn':
        baseMultiplier = 1.0; // Baseline
        distanceSensitivity = 0.0;
        break;
      case '2d_cnn':
        baseMultiplier = 0.95; // -5% baseline confidence
        distanceSensitivity = -0.03; // Worse on distant objects
        break;
    }

    return detections.map((det) => {
      // Calculate distance from camera (assumed at origin)
      const distance = Math.sqrt(det.center[0] ** 2 + det.center[1] ** 2);

      // Normalize distance (typical detection range 0-50m)
      const normalizedDist = Math.min(distance / 50.0, 1.0);

      // Apply confidence adjustment
      const distanceEffect = distanceSensitivity * normalizedDist;
      const confidenceMultiplier = baseMultiplier + distanceEffect;

      return {
        ...det,
        confidence: Math.max(0.1, Math.min(1.0, det.confidence * confidenceMultiplier)),
      };
    });
  }

  /**
   * Apply variations based on detection head type.
   *
   * REALISTIC BASIS:
   * - Anchor-based: Predicts offsets from predefined anchor boxes
   *   → Better for objects matching anchor shapes
   *   → May snap unusual shapes to nearest anchor
   * - Center-based: Predicts directly from object centers
   *   → Better for unusual aspect ratios
   *   → More flexible dimension prediction
   *
   * TRANSFORMATIONS:
   * - Anchor-based: Subtle snapping to common vehicle/pedestrian aspect ratios
   * - Center-based: Preserve original aspect ratios more closely
   */
  private applyDetectionHeadVariation(
    detections: Detection[],
    branch: BranchConfig,
    rng: SeededRandom
  ): Detection[] {
    const isAnchorBased = branch.controlKnobs.detectionHead === 'anchor';

    if (!isAnchorBased) {
      return detections; // Center-based preserves dimensions
    }

    // Anchor-based heads use predefined aspect ratios
    const vehicleAspectRatio = 2.5; // length/width for typical vehicle
    const pedestrianAspectRatio = 0.5; // length/width for typical pedestrian

    return detections.map((det) => {
      const currentAspect = det.dimensions.length / det.dimensions.width;
      const isVehicleLike = det.class === 'vehicle';
      const targetAspect = isVehicleLike ? vehicleAspectRatio : pedestrianAspectRatio;

      // Gently pull aspect ratio toward anchor (20% influence)
      const blendFactor = 0.2;
      const adjustedAspect = currentAspect * (1 - blendFactor) + targetAspect * blendFactor;

      // Maintain volume, adjust dimensions
      const volume = det.dimensions.width * det.dimensions.length * det.dimensions.height;
      const newWidth = Math.sqrt(volume / (adjustedAspect * det.dimensions.height));
      const newLength = newWidth * adjustedAspect;

      return {
        ...det,
        dimensions: {
          width: newWidth,
          length: newLength,
          height: det.dimensions.height,
        },
      };
    });
  }

  /**
   * Apply variations based on GPU resource contention.
   *
   * REALISTIC BASIS:
   * - Contention = GPU resources shared with other applications
   * - High contention (50%+) = limited compute/memory bandwidth
   * - This affects inference quality:
   *   → Reduced confidence scores (less thorough inference)
   *   → Probabilistic detection failures (dropped frames, timeouts)
   *   → More variability in results
   *
   * IMPORTANT: This simulates PERFORMANCE degradation, not spatial degradation.
   * Unlike voxel size (which affects what CAN be detected), contention affects
   * how RELIABLY detections occur under resource pressure.
   *
   * TRANSFORMATIONS:
   * - Low contention (0-25%): Minimal effect
   * - Medium contention (25-50%): Slight confidence reduction
   * - High contention (50-75%): Noticeable confidence drop + occasional misses
   * - Extreme contention (75-100%): Significant degradation
   *
   * @param detections - Input detections
   * @param contentionPct - Contention percentage (0-100)
   * @param rng - Seeded random number generator
   * @returns Detections with contention-based variations
   */
  private applyContentionVariation(
    detections: Detection[],
    contentionPct: number,
    rng: SeededRandom
  ): Detection[] {
    // Normalize contention to 0-1 range
    const contention = Math.max(0, Math.min(100, contentionPct)) / 100;

    // Contention effects scale non-linearly (worse at high contention)
    // Use quadratic scaling: mild effect until ~50%, then accelerates
    const contentionFactor = contention * contention;

    // Calculate miss rate: low contention = few misses, high contention = more misses
    // 0% contention = 0% miss rate
    // 50% contention = ~2% miss rate
    // 75% contention = ~5% miss rate
    // 100% contention = ~8% miss rate
    const missRate = contentionFactor * 0.08;

    // Calculate confidence reduction
    // 0% contention = 0% reduction
    // 50% contention = ~6% reduction
    // 75% contention = ~14% reduction
    // 100% contention = ~25% reduction
    const confidenceReduction = contentionFactor * 0.25;

    // Process detections: probabilistic filtering and confidence adjustment
    const varied: Detection[] = [];

    for (const det of detections) {
      // Probabilistic detection failure due to resource pressure
      if (rng.bool(missRate)) {
        // This detection was "missed" due to contention (dropped frame, timeout, etc.)
        continue;
      }

      // Apply confidence reduction for surviving detections
      const newConfidence = det.confidence * (1 - confidenceReduction);

      varied.push({
        ...det,
        confidence: Math.max(0.05, newConfidence), // Floor at 5% confidence
      });
    }

    return varied;
  }

  /**
   * Create seeded RNG from branch ID for deterministic variations.
   */
  private createSeededRng(branchId: string): SeededRandom {
    // Convert branch ID to numeric seed
    let hash = 0;
    for (let i = 0; i < branchId.length; i++) {
      hash = (hash << 5) - hash + branchId.charCodeAt(i);
      hash |= 0; // Convert to 32-bit integer
    }
    return new SeededRandom(Math.abs(hash));
  }

  /**
   * Deep copy detections array to avoid mutations.
   */
  private deepCopyDetections(detections: Detection[]): Detection[] {
    return detections.map((det) => ({
      ...det,
      center: [...det.center] as [number, number, number],
      dimensions: { ...det.dimensions },
    }));
  }

  /**
   * Round value to nearest multiple of increment.
   */
  private roundToNearest(value: number, increment: number): number {
    if (increment <= 0) return value;
    return Math.round(value / increment) * increment;
  }
}
