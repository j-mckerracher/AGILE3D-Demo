/**
 * BEV (Bird's Eye View) IoU utilities for 3D object detection evaluation.
 * 
 * Implements 2D oriented bounding box intersection-over-union in XY plane,
 * ignoring Z coordinate for speed and matching Pengcheng's evaluation approach.
 */

interface Box2D {
  x: number;
  y: number;
  dx: number;  // length (X-axis)
  dy: number;  // width (Y-axis)
  heading: number;  // rotation in radians about Z-axis
}

interface Point2D {
  x: number;
  y: number;
}

/**
 * Build oriented rectangle corners from box center, dimensions, and heading.
 * Returns corners in CCW order starting from front-right.
 */
export function buildBoxCorners(box: Box2D): Point2D[] {
  const cos_h = Math.cos(box.heading);
  const sin_h = Math.sin(box.heading);
  
  // Half dimensions
  const half_dx = box.dx / 2;
  const half_dy = box.dy / 2;
  
  // Corners in local frame (before rotation)
  const local_corners: Point2D[] = [
    { x: half_dx, y: half_dy },   // front-right
    { x: -half_dx, y: half_dy },  // front-left
    { x: -half_dx, y: -half_dy }, // rear-left
    { x: half_dx, y: -half_dy }   // rear-right
  ];
  
  // Rotate and translate to global frame
  return local_corners.map(c => ({
    x: box.x + (c.x * cos_h - c.y * sin_h),
    y: box.y + (c.x * sin_h + c.y * cos_h)
  }));
}

/**
 * Sutherland-Hodgman polygon clipping algorithm.
 * Clips polygon A against each edge of polygon B.
 */
function sutherlandHodgmanClip(subjectPoly: Point2D[], clipPoly: Point2D[]): Point2D[] {
  let output = [...subjectPoly];
  
  for (let i = 0; i < clipPoly.length; i++) {
    if (output.length === 0) break;
    
    const input = output;
    output = [];
    
    const edgeStart = clipPoly[i]!;
    const edgeEnd = clipPoly[(i + 1) % clipPoly.length]!;
    
    for (let j = 0; j < input.length; j++) {
      const current = input[j]!;
      const previous = input[(j - 1 + input.length) % input.length]!;
      
      const currentInside = isInsideEdge(current, edgeStart, edgeEnd);
      const previousInside = isInsideEdge(previous, edgeStart, edgeEnd);
      
      if (currentInside) {
        if (!previousInside) {
          const intersection = getLineIntersection(previous, current, edgeStart, edgeEnd);
          if (intersection) output.push(intersection);
        }
        output.push(current);
      } else if (previousInside) {
        const intersection = getLineIntersection(previous, current, edgeStart, edgeEnd);
        if (intersection) output.push(intersection);
      }
    }
  }
  
  return output;
}

/**
 * Check if point is on the left side of (inside) edge vector.
 */
function isInsideEdge(point: Point2D, edgeStart: Point2D, edgeEnd: Point2D): boolean {
  const cross = (edgeEnd.x - edgeStart.x) * (point.y - edgeStart.y) -
                (edgeEnd.y - edgeStart.y) * (point.x - edgeStart.x);
  return cross >= 0;
}

/**
 * Find intersection of two line segments.
 */
function getLineIntersection(
  p1: Point2D, p2: Point2D,
  p3: Point2D, p4: Point2D
): Point2D | null {
  const x1 = p1.x, y1 = p1.y;
  const x2 = p2.x, y2 = p2.y;
  const x3 = p3.x, y3 = p3.y;
  const x4 = p4.x, y4 = p4.y;
  
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 1e-10) return null;
  
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  
  return {
    x: x1 + t * (x2 - x1),
    y: y1 + t * (y2 - y1)
  };
}

/**
 * Compute polygon area using shoelace formula.
 */
function polygonArea(polygon: Point2D[]): number {
  if (polygon.length < 3) return 0;
  
  let area = 0;
  for (let i = 0; i < polygon.length; i++) {
    const p1 = polygon[i]!;
    const p2 = polygon[(i + 1) % polygon.length]!;
    area += p1.x * p2.y - p2.x * p1.y;
  }
  return Math.abs(area) / 2;
}

/**
 * Compute union area of two boxes.
 * Assumes corners are ordered CCW.
 */
function unionArea(aCorners: Point2D[], bCorners: Point2D[]): number {
  const areaA = polygonArea(aCorners);
  const areaB = polygonArea(bCorners);
  
  const intersection = sutherlandHodgmanClip(aCorners, bCorners);
  const areaIntersect = polygonArea(intersection);
  
  return areaA + areaB - areaIntersect;
}

/**
 * Compute BEV IoU between two 3D boxes.
 * 
 * @param boxA First box
 * @param boxB Second box
 * @returns IoU value between 0 and 1
 */
export function bevIoU(boxA: Box2D, boxB: Box2D): number {
  const cornersA = buildBoxCorners(boxA);
  const cornersB = buildBoxCorners(boxB);
  
  const intersection = sutherlandHodgmanClip(cornersA, cornersB);
  const areaIntersect = polygonArea(intersection);
  
  if (areaIntersect < 1e-10) return 0;
  
  const union = unionArea(cornersA, cornersB);
  if (union < 1e-10) return 0;
  
  return areaIntersect / union;
}

/**
 * Classify detections as TP or FP based on IoU with ground truth.
 * 
 * @param predictions Predicted boxes
 * @param groundTruth Ground truth boxes
 * @param iouThresh IoU threshold for positive match (default 0.5)
 * @returns Array where index i is true if prediction i is TP, false for FP
 */
export function classifyDetections(
  predictions: Box2D[],
  groundTruth: Box2D[],
  iouThresh: number = 0.5
): boolean[] {
  return predictions.map(pred => {
    if (groundTruth.length === 0) return false;
    
    const maxIoU = Math.max(...groundTruth.map(gt => bevIoU(pred, gt)));
    return maxIoU >= iouThresh;
  });
}

/**
 * Pre-compute ground truth corners for efficient repeated evaluation.
 * 
 * @param groundTruth Array of GT boxes
 * @returns Cached corners for each box
 */
export function cacheGTCorners(groundTruth: Box2D[]): Point2D[][] {
  return groundTruth.map(box => buildBoxCorners(box));
}

/**
 * Fast classification using pre-computed GT corners.
 * 
 * @param predictions Predicted boxes
 * @param gtCorners Pre-computed GT corners
 * @param iouThresh IoU threshold for positive match (default 0.5)
 * @returns Array where index i is true if prediction i is TP, false for FP
 */
export function classifyDetectionsFast(
  predictions: Box2D[],
  gtCorners: Point2D[][],
  iouThresh: number = 0.5
): boolean[] {
  return predictions.map(pred => {
    if (gtCorners.length === 0) return false;
    
    const predCorners = buildBoxCorners(pred);
    const maxIoU = Math.max(
      ...gtCorners.map(gtCorner => {
        const intersection = sutherlandHodgmanClip(predCorners, gtCorner);
        const areaIntersect = polygonArea(intersection);
        if (areaIntersect < 1e-10) return 0;
        
        const union = unionArea(predCorners, gtCorner);
        return areaIntersect / union;
      })
    );
    
    return maxIoU >= iouThresh;
  });
}
