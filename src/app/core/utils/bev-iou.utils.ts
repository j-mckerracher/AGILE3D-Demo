/**
 * BEV (Bird's Eye View) IoU Utilities
 *
 * Implements oriented 2D bounding box Intersection-over-Union calculation
 * and TP/FP classification for object detection evaluation.
 *
 * Key features:
 * - Oriented rectangle corner calculation in BEV (XY plane)
 * - Sutherland-Hodgman polygon clipping for intersection
 * - Shoelace formula for polygon area
 * - IoU threshold-based TP/FP classification
 *
 * Performance optimizations:
 * - Float32Array for coordinates to avoid GC pressure
 * - Minimal object allocations in hot paths
 * - Pre-computed corner caches when available
 *
 * @example
 * ```typescript
 * const corners1 = getBEVCorners(x1, y1, dx1, dy1, heading1);
 * const corners2 = getBEVCorners(x2, y2, dx2, dy2, heading2);
 * const iou = bevIoU(corners1, corners2);
 *
 * const classification = classifyDetections(predictions, groundTruths, 0.5);
 * ```
 */

import { Detection } from '../models/sequence.models';

/**
 * A 2D point in BEV space (x, y)
 */
interface Point2D {
  x: number;
  y: number;
}

/**
 * Get the 4 corners of an oriented rectangle in BEV (XY plane).
 * Returns corners in counter-clockwise order starting from front-right.
 *
 * @param cx - Center X coordinate
 * @param cy - Center Y coordinate
 * @param dx - Length along heading direction (after rotation)
 * @param dy - Width perpendicular to heading
 * @param heading - Rotation angle in radians (yaw about Z-axis)
 * @returns Float32Array of 8 values: [x0, y0, x1, y1, x2, y2, x3, y3]
 */
export function getBEVCorners(
  cx: number,
  cy: number,
  dx: number,
  dy: number,
  heading: number
): Float32Array {
  const corners = new Float32Array(8);

  const cos = Math.cos(heading);
  const sin = Math.sin(heading);

  const halfDx = dx * 0.5;
  const halfDy = dy * 0.5;

  // Corner offsets in local frame (before rotation)
  // Front-right, front-left, rear-left, rear-right
  const localOffsets = [
    [halfDx, halfDy],    // front-right
    [halfDx, -halfDy],   // front-left
    [-halfDx, -halfDy],  // rear-left
    [-halfDx, halfDy],   // rear-right
  ];

  // Rotate and translate each corner
  for (let i = 0; i < 4; i++) {
    const [lx, ly] = localOffsets[i]!;
    const rotatedX = lx! * cos - ly! * sin;
    const rotatedY = lx! * sin + ly! * cos;
    corners[i * 2] = cx + rotatedX;
    corners[i * 2 + 1] = cy + rotatedY;
  }

  return corners;
}

/**
 * Compute the area of a polygon using the Shoelace formula.
 *
 * @param polygon - Array of points defining the polygon
 * @returns Area of the polygon (always positive)
 */
function polygonArea(polygon: Point2D[]): number {
  if (polygon.length < 3) return 0;

  let area = 0;
  const n = polygon.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += polygon[i]!.x * polygon[j]!.y;
    area -= polygon[j]!.x * polygon[i]!.y;
  }

  return Math.abs(area * 0.5);
}

/**
 * Sutherland-Hodgman polygon clipping algorithm.
 * Clips a subject polygon against a convex clip polygon.
 *
 * @param subject - Polygon to be clipped
 * @param clip - Convex clipping polygon
 * @returns Clipped polygon (may be empty if no intersection)
 */
function sutherlandHodgman(subject: Point2D[], clip: Point2D[]): Point2D[] {
  let output = [...subject];

  // For each edge of the clipping polygon
  for (let i = 0; i < clip.length; i++) {
    if (output.length === 0) break;

    const clipEdgeStart = clip[i]!;
    const clipEdgeEnd = clip[(i + 1) % clip.length]!;

    const input = output;
    output = [];

    // For each edge of the subject polygon
    for (let j = 0; j < input.length; j++) {
      const currentVertex = input[j]!;
      const prevVertex = input[(j + input.length - 1) % input.length]!;

      const currentInside = isInsideEdge(currentVertex, clipEdgeStart, clipEdgeEnd);
      const prevInside = isInsideEdge(prevVertex, clipEdgeStart, clipEdgeEnd);

      if (currentInside) {
        if (!prevInside) {
          // Entering: add intersection point
          const intersection = lineIntersection(
            prevVertex,
            currentVertex,
            clipEdgeStart,
            clipEdgeEnd
          );
          if (intersection) {
            output.push(intersection);
          }
        }
        // Add current vertex
        output.push(currentVertex);
      } else if (prevInside) {
        // Leaving: add intersection point
        const intersection = lineIntersection(
          prevVertex,
          currentVertex,
          clipEdgeStart,
          clipEdgeEnd
        );
        if (intersection) {
          output.push(intersection);
        }
      }
    }
  }

  return output;
}

/**
 * Check if a point is inside (on the left side of) an edge.
 * Uses the cross product to determine sidedness.
 */
function isInsideEdge(point: Point2D, edgeStart: Point2D, edgeEnd: Point2D): boolean {
  // Cross product: (edgeEnd - edgeStart) × (point - edgeStart)
  const cross = (edgeEnd.x - edgeStart.x) * (point.y - edgeStart.y) -
                (edgeEnd.y - edgeStart.y) * (point.x - edgeStart.x);
  return cross >= 0;
}

/**
 * Compute the intersection point of two line segments.
 * Returns null if segments don't intersect or are parallel.
 */
function lineIntersection(
  p1: Point2D,
  p2: Point2D,
  p3: Point2D,
  p4: Point2D
): Point2D | null {
  const x1 = p1.x, y1 = p1.y;
  const x2 = p2.x, y2 = p2.y;
  const x3 = p3.x, y3 = p3.y;
  const x4 = p4.x, y4 = p4.y;

  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);

  if (Math.abs(denom) < 1e-10) return null; // Parallel or coincident

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;

  return {
    x: x1 + t * (x2 - x1),
    y: y1 + t * (y2 - y1),
  };
}

/**
 * Convert Float32Array corners to Point2D array.
 */
function cornersToPoints(corners: Float32Array): Point2D[] {
  const points: Point2D[] = [];
  for (let i = 0; i < 4; i++) {
    points.push({
      x: corners[i * 2]!,
      y: corners[i * 2 + 1]!,
    });
  }
  return points;
}

/**
 * Compute BEV IoU between two oriented rectangles.
 *
 * @param corners1 - First rectangle corners (8 values: x0,y0,x1,y1,x2,y2,x3,y3)
 * @param corners2 - Second rectangle corners
 * @returns IoU value in range [0, 1]
 */
export function bevIoU(corners1: Float32Array, corners2: Float32Array): number {
  const poly1 = cornersToPoints(corners1);
  const poly2 = cornersToPoints(corners2);

  // Compute intersection polygon
  const intersection = sutherlandHodgman(poly1, poly2);

  if (intersection.length < 3) {
    return 0; // No intersection
  }

  const area1 = polygonArea(poly1);
  const area2 = polygonArea(poly2);
  const areaIntersection = polygonArea(intersection);

  const areaUnion = area1 + area2 - areaIntersection;

  if (areaUnion < 1e-10) {
    return 0; // Avoid division by zero
  }

  return areaIntersection / areaUnion;
}

/**
 * Classify detections as True Positive (TP) or False Positive (FP) based on IoU with ground truth.
 *
 * Strategy:
 * - For each prediction, find the ground truth box with maximum IoU
 * - If max IoU >= threshold, mark as TP
 * - Otherwise, mark as FP
 * - Each GT box can only be matched once (greedy matching)
 *
 * @param predictions - Array of predicted detections
 * @param groundTruths - Array of ground truth detections
 * @param iouThreshold - IoU threshold for TP classification (default: 0.5)
 * @returns Map from detection ID to classification ('tp' or 'fp')
 */
export function classifyDetections(
  predictions: Detection[],
  groundTruths: Detection[],
  iouThreshold = 0.5
): Map<string, 'tp' | 'fp' | 'fn'> {
  const classification = new Map<string, 'tp' | 'fp' | 'fn'>();

  // Precompute GT corners for efficiency
  const gtCorners = groundTruths.map(gt => ({
    detection: gt,
    corners: getBEVCorners(
      gt.center[0],
      gt.center[1],
      gt.dimensions.length,  // dx maps to length
      gt.dimensions.width,   // dy maps to width
      gt.yaw
    ),
  }));

  // Track which GT boxes have been matched
  const matchedGT = new Set<number>();

  // Sort predictions by confidence (descending) for greedy matching
  const sortedPredictions = [...predictions].sort((a, b) =>
    (b.confidence ?? 0) - (a.confidence ?? 0)
  );

  // Match each prediction to best GT
  for (const pred of sortedPredictions) {
    const predCorners = getBEVCorners(
      pred.center[0],
      pred.center[1],
      pred.dimensions.length,
      pred.dimensions.width,
      pred.yaw
    );

    let maxIoU = 0;
    let bestGTIdx = -1;

    // Find best matching GT (that hasn't been matched yet)
    for (let i = 0; i < gtCorners.length; i++) {
      if (matchedGT.has(i)) continue; // Skip already matched GT

      const iou = bevIoU(predCorners, gtCorners[i]!.corners);

      if (iou > maxIoU) {
        maxIoU = iou;
        bestGTIdx = i;
      }
    }

    // Classify based on best IoU
    if (maxIoU >= iouThreshold) {
      classification.set(pred.id, 'tp');
      matchedGT.add(bestGTIdx);
    } else {
      classification.set(pred.id, 'fp');
    }
  }

  // Mark unmatched GT as false negatives (FN)
  for (let i = 0; i < groundTruths.length; i++) {
    if (!matchedGT.has(i)) {
      classification.set(groundTruths[i]!.id, 'fn');
    }
  }

  return classification;
}
