/**
 * BEV IoU Utilities Tests
 *
 * Unit tests for oriented 2D bounding box IoU calculation.
 */

import { getBEVCorners, bevIoU, classifyDetections } from './bev-iou.utils';
import { Detection } from '../models/sequence.models';

describe('BEV IoU Utilities', () => {
  describe('getBEVCorners', () => {
    it('should compute corners for axis-aligned box', () => {
      const corners = getBEVCorners(0, 0, 4, 2, 0);

      expect(corners.length).toBe(8);

      // Front-right, front-left, rear-left, rear-right
      // With heading=0, dx=4, dy=2:
      // Front-right: (2, 1)
      // Front-left: (2, -1)
      // Rear-left: (-2, -1)
      // Rear-right: (-2, 1)

      expect(corners[0]).toBeCloseTo(2, 5); // front-right x
      expect(corners[1]).toBeCloseTo(1, 5); // front-right y
      expect(corners[2]).toBeCloseTo(2, 5); // front-left x
      expect(corners[3]).toBeCloseTo(-1, 5); // front-left y
      expect(corners[4]).toBeCloseTo(-2, 5); // rear-left x
      expect(corners[5]).toBeCloseTo(-1, 5); // rear-left y
      expect(corners[6]).toBeCloseTo(-2, 5); // rear-right x
      expect(corners[7]).toBeCloseTo(1, 5); // rear-right y
    });

    it('should compute corners for rotated box', () => {
      const corners = getBEVCorners(0, 0, 4, 2, Math.PI / 2); // 90 degree rotation

      expect(corners.length).toBe(8);

      // After 90 degree rotation:
      // Front-right: (-1, 2)
      // Front-left: (1, 2)
      // Rear-left: (1, -2)
      // Rear-right: (-1, -2)

      expect(corners[0]).toBeCloseTo(-1, 5); // front-right x
      expect(corners[1]).toBeCloseTo(2, 5); // front-right y
      expect(corners[2]).toBeCloseTo(1, 5); // front-left x
      expect(corners[3]).toBeCloseTo(2, 5); // front-left y
    });
  });

  describe('bevIoU', () => {
    it('should return 1.0 for identical boxes', () => {
      const corners1 = getBEVCorners(0, 0, 4, 2, 0);
      const corners2 = getBEVCorners(0, 0, 4, 2, 0);

      const iou = bevIoU(corners1, corners2);

      expect(iou).toBeCloseTo(1.0, 5);
    });

    it('should return 0.0 for non-overlapping boxes', () => {
      const corners1 = getBEVCorners(0, 0, 4, 2, 0); // centered at origin
      const corners2 = getBEVCorners(10, 10, 4, 2, 0); // far away

      const iou = bevIoU(corners1, corners2);

      expect(iou).toBe(0);
    });

    it('should return value between 0 and 1 for partial overlap', () => {
      const corners1 = getBEVCorners(0, 0, 4, 2, 0); // centered at origin
      const corners2 = getBEVCorners(2, 0, 4, 2, 0); // shifted 2 units in x

      const iou = bevIoU(corners1, corners2);

      expect(iou).toBeGreaterThan(0);
      expect(iou).toBeLessThan(1);
      // Boxes have area 8 each
      // Intersection width: 2 (from -2+2=0 to 2)
      // Intersection height: 2 (from -1 to 1)
      // Intersection area: 4
      // Union area: 8 + 8 - 4 = 12
      // IoU: 4/12 = 0.333...
      expect(iou).toBeCloseTo(0.333, 2);
    });

    it('should handle rotated boxes correctly', () => {
      const corners1 = getBEVCorners(0, 0, 4, 2, 0); // axis-aligned
      const corners2 = getBEVCorners(0, 0, 4, 2, Math.PI / 4); // 45 degree rotation

      const iou = bevIoU(corners1, corners2);

      expect(iou).toBeGreaterThan(0);
      expect(iou).toBeLessThan(1);
    });
  });

  describe('classifyDetections', () => {
    const createDetection = (
      id: string,
      x: number,
      y: number,
      dx: number,
      dy: number,
      heading: number,
      confidence: number = 0.9
    ): Detection => ({
      id,
      class: 'vehicle',
      center: [x, y, 0] as [number, number, number],
      dimensions: {
        width: dy,
        length: dx,
        height: 1,
      },
      yaw: heading,
      confidence,
    });

    it('should classify perfect match as TP', () => {
      const predictions = [createDetection('pred1', 0, 0, 4, 2, 0)];
      const groundTruths = [createDetection('gt1', 0, 0, 4, 2, 0)];

      const classification = classifyDetections(predictions, groundTruths, 0.5);

      expect(classification.get('pred1')).toBe('tp');
    });

    it('should classify no match as FP', () => {
      const predictions = [createDetection('pred1', 0, 0, 4, 2, 0)];
      const groundTruths = [createDetection('gt1', 10, 10, 4, 2, 0)]; // far away

      const classification = classifyDetections(predictions, groundTruths, 0.5);

      expect(classification.get('pred1')).toBe('fp');
    });

    it('should classify partial overlap correctly', () => {
      const predictions = [createDetection('pred1', 2, 0, 4, 2, 0)]; // shifted
      const groundTruths = [createDetection('gt1', 0, 0, 4, 2, 0)]; // original

      // IoU is approximately 0.333, which is below threshold 0.5
      const classification = classifyDetections(predictions, groundTruths, 0.5);

      expect(classification.get('pred1')).toBe('fp');
    });

    it('should handle multiple predictions', () => {
      const predictions = [
        createDetection('pred1', 0, 0, 4, 2, 0), // matches gt1
        createDetection('pred2', 10, 0, 4, 2, 0), // matches gt2
        createDetection('pred3', 100, 100, 4, 2, 0), // no match
      ];
      const groundTruths = [
        createDetection('gt1', 0, 0, 4, 2, 0),
        createDetection('gt2', 10, 0, 4, 2, 0),
      ];

      const classification = classifyDetections(predictions, groundTruths, 0.5);

      expect(classification.get('pred1')).toBe('tp');
      expect(classification.get('pred2')).toBe('tp');
      expect(classification.get('pred3')).toBe('fp');
    });

    it('should mark unmatched GT as FN', () => {
      const predictions = [
        createDetection('pred1', 0, 0, 4, 2, 0), // matches gt1
      ];
      const groundTruths = [
        createDetection('gt1', 0, 0, 4, 2, 0),
        createDetection('gt2', 10, 0, 4, 2, 0), // unmatched
      ];

      const classification = classifyDetections(predictions, groundTruths, 0.5);

      expect(classification.get('pred1')).toBe('tp');
      expect(classification.get('gt2')).toBe('fn');
    });

    it('should use greedy matching (highest confidence first)', () => {
      const predictions = [
        createDetection('pred1', 0.1, 0, 4, 2, 0, 0.9), // high confidence, close to gt1
        createDetection('pred2', 0, 0, 4, 2, 0, 0.5), // lower confidence, perfect match to gt1
      ];
      const groundTruths = [createDetection('gt1', 0, 0, 4, 2, 0)];

      const classification = classifyDetections(predictions, groundTruths, 0.5);

      // pred1 should match gt1 first due to higher confidence
      expect(classification.get('pred1')).toBe('tp');
      expect(classification.get('pred2')).toBe('fp'); // gt1 already matched
    });
  });
});
