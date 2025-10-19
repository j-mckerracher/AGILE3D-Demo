
/** Quantize a THREE.Color's components to Float32 precision in-place */
function quantizeColorFloat32(c: THREE.Color): void {
  const f = new Float32Array(3);
  f[0] = c.r; f[1] = c.g; f[2] = c.b;
  c.setRGB(f[0], f[1], f[2]);
}

/**
 * BBox Instancing Utilities
 *
 * Utilities for creating high-performance instanced mesh batches of 3D bounding boxes.
 * Groups detections by class to minimize material switches and optimize rendering.
 *
 * Strategy:
 * - One InstancedMesh per detection class (vehicle, pedestrian, cyclist)
 * - Shared BoxGeometry(1,1,1) with per-instance transformations
 * - Per-instance colors based on class and diff mode
 * - Instance matrices encode position, rotation (yaw), and scale (dimensions)
 *
 * PRD References:
 * - FR-1.3: 3D bounding box rendering with class color coding
 * - FR-1.14: Visual diff highlighting (TP/FP/FN)
 * - NFR-5.1: Performance optimization via instancing
 * - WP-2.1.2: Detection Visualization and Diff Highlighting
 *
 * @example
 * ```typescript
 * const batches = buildClassBatches(detections, colors, 'all');
 * scene.add(batches.vehicle);
 * scene.add(batches.pedestrian);
 * scene.add(batches.cyclist);
 * ```
 */

import * as THREE from 'three';
import { Detection, DetectionClass } from '../../models/scene.models';

/**
 * Diff mode for visual encoding.
 */
export type DiffMode = 'off' | 'tp' | 'fp' | 'fn' | 'all';

/**
 * Class-based color configuration.
 */
export interface ClassColors {
  vehicle: THREE.Color;
  pedestrian: THREE.Color;
  cyclist: THREE.Color;
}

/**
 * Result of buildClassBatches containing per-class InstancedMesh objects.
 */
export interface ClassBatches {
  vehicle: THREE.InstancedMesh | null;
  pedestrian: THREE.InstancedMesh | null;
  cyclist: THREE.InstancedMesh | null;
}

/**
 * Metadata about a specific instance for hover interactions.
 */
export interface InstanceMetadata {
  detection: Detection;
  classType: DetectionClass;
  instanceIndex: number;
  meshName: string;
}

/**
 * Build per-class InstancedMesh batches from detections.
 *
 * @param detections - Array of detections to render
 * @param colors - Color configuration for each class
 * @param diffMode - Diff mode for opacity encoding (TP=1.0, FP=0.4)
 * @param diffClassification - Optional map of detection ID to diff type for filtering
 * @returns Object containing InstancedMesh for each class (null if no detections of that class)
 *
 * @remarks
 * - Creates wireframe boxes using MeshBasicMaterial
 * - Applies opacity based on diff mode: TP (1.0), FP (0.4), FN (handled separately as GT overlay)
 * - Each instance matrix encodes: scale (dimensions), rotation (yaw), position (center)
 * - Instance colors set per detection based on class
 */
export function buildClassBatches(
  detections: Detection[],
  colors: ClassColors,
  diffMode: DiffMode = 'off',
  diffClassification?: Map<string, 'tp' | 'fp' | 'fn'>
): ClassBatches {
  // Quantize incoming colors to Float32 to match InstancedBufferAttribute precision
  quantizeColorFloat32(colors.vehicle);
  quantizeColorFloat32(colors.pedestrian);
  quantizeColorFloat32(colors.cyclist);
  // Group detections by class
  const grouped = groupByClass(detections);

  const batches: ClassBatches = {
    vehicle: null,
    pedestrian: null,
    cyclist: null,
  };

  // Build InstancedMesh for each class
  for (const classType of ['vehicle', 'pedestrian', 'cyclist'] as DetectionClass[]) {
    const classDetections = grouped[classType];
    if (classDetections.length === 0) {
      continue;
    }

    // Filter by diff mode if needed
    const filtered = filterByDiffMode(classDetections, diffMode, diffClassification);
    if (filtered.length === 0) {
      continue;
    }

    batches[classType] = createInstancedMesh(filtered, classType, colors[classType], diffMode, diffClassification);
  }

  return batches;
}

/**
 * Group detections by class.
 */
function groupByClass(detections: Detection[]): Record<DetectionClass, Detection[]> {
  const grouped: Record<DetectionClass, Detection[]> = {
    vehicle: [],
    pedestrian: [],
    cyclist: [],
  };

  for (const det of detections) {
    grouped[det.class].push(det);
  }

  return grouped;
}

/**
 * Filter detections by diff mode.
 */
function filterByDiffMode(
  detections: Detection[],
  mode: DiffMode,
  classification?: Map<string, 'tp' | 'fp' | 'fn'>
): Detection[] {
  if (mode === 'off' || mode === 'all' || !classification) {
    return detections;
  }

  return detections.filter((det) => classification.get(det.id) === mode);
}

/**
 * Create InstancedMesh for a single class.
 */
function createInstancedMesh(
  detections: Detection[],
  classType: DetectionClass,
  color: THREE.Color,
  diffMode: DiffMode,
  _diffClassification?: Map<string, 'tp' | 'fp' | 'fn'>
): THREE.InstancedMesh {
  const count = detections.length;

  // Shared box geometry (1x1x1 unit cube)
  const geometry = new THREE.BoxGeometry(1, 1, 1);

  // Determine material opacity based on diff mode
  const material = new THREE.MeshBasicMaterial({
    wireframe: true,
    transparent: true,
    vertexColors: true,
  });

  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.name = `bbox-${classType}`;

  const matrix = new THREE.Matrix4();
  const instanceColor = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const det = detections[i];
    if (!det) continue; // Skip if undefined

    // Build transformation matrix
    // Order: Scale -> Rotate -> Translate
    matrix.makeRotationZ(det.yaw);
    matrix.setPosition(det.center[0], det.center[1], det.center[2]);
    matrix.scale(new THREE.Vector3(det.dimensions.width, det.dimensions.length, det.dimensions.height));

    mesh.setMatrixAt(i, matrix);

    // Set instance color
    // Copy supplied color directly to preserve component values as provided
    instanceColor.copy(color);
    mesh.setColorAt(i, instanceColor);

    // Note: Three.js InstancedMesh doesn't support per-instance opacity directly
    // We handle overall opacity via material based on diff mode below
  }

  // Apply opacity to material (affects all instances)
  // For per-instance opacity, we'd need custom shader or separate meshes
  // For now, use uniform opacity for the entire class
  if (diffMode !== 'off' && diffMode !== 'all') {
    // Single mode (tp, fp, fn) - apply specific opacity
    if (diffMode === 'fp') {
      material.opacity = 0.4;
    } else {
      material.opacity = 1.0;
    }
  } else {
    material.opacity = 1.0;
  }

  // Force instanceColor attribute creation by accessing after first set
  if (!mesh.instanceColor) {
    (mesh as unknown as { instanceColor: THREE.InstancedBufferAttribute | null }).instanceColor = (mesh.geometry.getAttribute('instanceColor') as THREE.InstancedBufferAttribute) ?? null;
  }

  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }

  // Store detection metadata in userData for raycasting
  mesh.userData['detections'] = detections;
  mesh.userData['classType'] = classType;

  return mesh;
}

/**
 * Update existing InstancedMesh with new detection data.
 * More efficient than recreating mesh when detection count hasn't changed.
 *
 * @param mesh - Existing InstancedMesh to update
 * @param detections - New detection data
 * @param color - Class color
 * @param diffMode - Diff mode for opacity
 * @param diffClassification - Optional diff classification map
 * @returns True if update successful, false if mesh needs recreation
 */
export function updateInstancedMesh(
  mesh: THREE.InstancedMesh,
  detections: Detection[],
  color: THREE.Color,
  diffMode: DiffMode = 'off',
  _diffClassification?: Map<string, 'tp' | 'fp' | 'fn'>
): boolean {
  // Can only update if count matches
  if (mesh.count !== detections.length) {
    return false;
  }

  const matrix = new THREE.Matrix4();
  const instanceColor = new THREE.Color();

  for (let i = 0; i < detections.length; i++) {
    const det = detections[i];
    if (!det) continue; // Skip if undefined

    // Update transformation matrix
    matrix.makeRotationZ(det.yaw);
    matrix.setPosition(det.center[0], det.center[1], det.center[2]);
    matrix.scale(new THREE.Vector3(det.dimensions.width, det.dimensions.length, det.dimensions.height));

    mesh.setMatrixAt(i, matrix);

    // Update color
    instanceColor.copy(color);
    mesh.setColorAt(i, instanceColor);
  }

  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }

  // Update material opacity based on diff mode
  const material = mesh.material as THREE.MeshBasicMaterial;
  if (diffMode === 'fp') {
    material.opacity = 0.4;
  } else {
    material.opacity = 1.0;
  }

  // Update metadata
  mesh.userData['detections'] = detections;

  return true;
}

/**
 * Dispose all resources in ClassBatches.
 *
 * @param batches - Class batches to dispose
 */
export function disposeClassBatches(batches: ClassBatches): void {
  for (const classType of ['vehicle', 'pedestrian', 'cyclist'] as DetectionClass[]) {
    const mesh = batches[classType];
    if (mesh) {
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => m.dispose());
      } else {
        mesh.material.dispose();
      }
    }
  }
}

/**
 * Get instance metadata from raycast intersection.
 *
 * @param intersection - Three.js raycast intersection result
 * @returns Instance metadata if available, undefined otherwise
 */
export function getInstanceMetadata(intersection: THREE.Intersection): InstanceMetadata | undefined {
  const mesh = intersection.object as THREE.InstancedMesh;
  const instanceId = intersection.instanceId;

  if (instanceId === undefined || !mesh.userData['detections']) {
    return undefined;
  }

  const detections = mesh.userData['detections'] as Detection[];
  const classType = mesh.userData['classType'] as DetectionClass;

  if (instanceId >= detections.length) {
    return undefined;
  }

  const detection = detections[instanceId];
  if (!detection) {
    return undefined;
  }

  return {
    detection,
    classType,
    instanceIndex: instanceId,
    meshName: mesh.name,
  };
}
