/** Quantize a THREE.Color's components to Float32 precision in-place */
function quantizeColorFloat32(c: THREE.Color): void {
  const f = new Float32Array(3);
  f[0] = c.r;
  f[1] = c.g;
  f[2] = c.b;
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

// FP color override (red)
const FP_COLOR = new THREE.Color(0xff3b30);

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
  vehicle: THREE.Object3D | null; // Group or InstancedMesh
  pedestrian: THREE.Object3D | null;
  cyclist: THREE.Object3D | null;
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

    batches[classType] = createClassGroup(
      filtered,
      classType,
      colors[classType],
      diffMode,
      diffClassification
    );
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
 * Create a THREE.Group for a single class containing up to two InstancedMeshes:
 * - TP mesh in class color
 * - FP mesh in red
 * If no diffClassification is provided or mode filters to one side, the group
 * contains only the applicable mesh(es).
 */
function createClassGroup(
  detections: Detection[],
  classType: DetectionClass,
  color: THREE.Color,
  diffMode: DiffMode,
  diffClassification?: Map<string, 'tp' | 'fp' | 'fn'>
): THREE.Object3D {
  const group = new THREE.Group();
  group.name = `bbox-group-${classType}`;

  // If no classification map, just create single mesh with class color
  if (!diffClassification || diffMode === 'off') {
    const mesh = createInstancedMesh(detections, classType, color);
    group.add(mesh);
    return group;
  }

  // Partition detections
  const tpDet: Detection[] = [];
  const fpDet: Detection[] = [];
  const other: Detection[] = [];
  for (const d of detections) {
    const cls = diffClassification.get(d.id);
    if (cls === 'fp') fpDet.push(d);
    else if (cls === 'tp') tpDet.push(d);
    else other.push(d);
  }

  // Apply mode filtering
  if (diffMode === 'fp') {
    if (fpDet.length > 0) group.add(createInstancedMesh(fpDet, classType, FP_COLOR));
    return group;
  }
  if (diffMode === 'tp') {
    const arr = tpDet.length > 0 ? tpDet : other; // treat unknown as TP for class color
    if (arr.length > 0) group.add(createInstancedMesh(arr, classType, color));
    return group;
  }
  // 'all' or anything else: add both (TP/class + FP/red)
  const tpAll = tpDet.concat(other);
  if (tpAll.length > 0) group.add(createInstancedMesh(tpAll, classType, color));
  if (fpDet.length > 0) group.add(createInstancedMesh(fpDet, classType, FP_COLOR));
  return group;
}

/**
 * Create InstancedMesh with a uniform wireframe color.
 */
function createInstancedMesh(
  detections: Detection[],
  classType: DetectionClass,
  color: THREE.Color
): THREE.InstancedMesh {
  const count = detections.length;

  // Shared box geometry (1x1x1 unit cube)
  const geometry = new THREE.BoxGeometry(1, 1, 1);

  // Wireframe material with uniform class color (vertexColors disabled for wireframe)
  const material = new THREE.MeshBasicMaterial({
    wireframe: true,
    transparent: true,
    vertexColors: false,
    color: color,
  });

  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.name = `bbox-${classType}`;

  const matrix = new THREE.Matrix4();
  // No per-instance color for wireframe in step 1 (uniform class color)

  for (let i = 0; i < count; i++) {
    const det = detections[i];
    if (!det) continue; // Skip if undefined

    // Build transformation matrix
    // Order: Scale -> Rotate -> Translate
    matrix.makeRotationZ(det.yaw);
    matrix.setPosition(det.center[0], det.center[1], det.center[2]);
    matrix.scale(
      new THREE.Vector3(det.dimensions.width, det.dimensions.length, det.dimensions.height)
    );

    mesh.setMatrixAt(i, matrix);

    // No per-instance color in step 1; material.color provides uniform class color

    // Note: Three.js InstancedMesh doesn't support per-instance opacity directly
    // We handle overall opacity via material based on diff mode below
  }

  // Apply opacity to material (affects all instances)
  material.opacity = 1.0;

  mesh.instanceMatrix.needsUpdate = true;

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
  diffClassification?: Map<string, 'tp' | 'fp' | 'fn'>
): boolean {
  // Can only update if count matches
  if (mesh.count !== detections.length) {
    return false;
  }

  const matrix = new THREE.Matrix4();

  for (let i = 0; i < detections.length; i++) {
    const det = detections[i];
    if (!det) continue; // Skip if undefined

    // Update transformation matrix
    matrix.makeRotationZ(det.yaw);
    matrix.setPosition(det.center[0], det.center[1], det.center[2]);
    matrix.scale(
      new THREE.Vector3(det.dimensions.width, det.dimensions.length, det.dimensions.height)
    );

    mesh.setMatrixAt(i, matrix);

    // No per-instance color updates in step 1; material.color provides uniform class color
  }

  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }

  // Keep uniform opacity and update material color to class color
  const material = mesh.material as THREE.MeshBasicMaterial;
  material.opacity = 1.0;
  material.color.copy(color);

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
    const obj = batches[classType];
    if (!obj) continue;

    obj.traverse((child) => {
      const m = child as unknown as THREE.InstancedMesh;
      // Dispose only on InstancedMesh
      if ((m as any).isInstancedMesh) {
        m.geometry.dispose();
        if (Array.isArray(m.material)) m.material.forEach((mm) => mm.dispose());
        else m.material.dispose();
      }
    });
  }
}

/**
 * Get instance metadata from raycast intersection.
 *
 * @param intersection - Three.js raycast intersection result
 * @returns Instance metadata if available, undefined otherwise
 */
export function getInstanceMetadata(
  intersection: THREE.Intersection
): InstanceMetadata | undefined {
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
