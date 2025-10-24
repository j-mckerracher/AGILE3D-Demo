import { TestBed } from '@angular/core/testing';
import { DetectionDiffService } from './detection-diff.service';
import { Detection } from '../../models/scene.models';

describe('DetectionDiffService', () => {
  let service: DetectionDiffService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DetectionDiffService],
    });
    service = TestBed.inject(DetectionDiffService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('computeDiff', () => {
    it('should classify predictions with valid matches_gt as TP', () => {
      const groundTruth: Detection[] = [
        {
          id: 'gt-1',
          class: 'vehicle',
          center: [0, 0, 0],
          dimensions: { width: 2, length: 4, height: 1.5 },
          yaw: 0,
          confidence: 1.0,
        },
        {
          id: 'gt-2',
          class: 'pedestrian',
          center: [5, 5, 0],
          dimensions: { width: 0.5, length: 0.5, height: 1.8 },
          yaw: 0,
          confidence: 1.0,
        },
      ];

      const predictions: Detection[] = [
        {
          id: 'pred-1',
          class: 'vehicle',
          center: [0.1, 0.1, 0],
          dimensions: { width: 2, length: 4, height: 1.5 },
          yaw: 0,
          confidence: 0.95,
          matches_gt: 'gt-1',
        },
        {
          id: 'pred-2',
          class: 'pedestrian',
          center: [5.1, 5.1, 0],
          dimensions: { width: 0.5, length: 0.5, height: 1.8 },
          yaw: 0,
          confidence: 0.88,
          matches_gt: 'gt-2',
        },
      ];

      const result = service.computeDiff(groundTruth, predictions);

      expect(result.tp.length).toBe(2);
      expect(result.fp.length).toBe(0);
      expect(result.fn.length).toBe(0);
      expect(result.tp.map((d) => d.id)).toEqual(['pred-1', 'pred-2']);
    });

    it('should classify predictions without matches_gt as FP', () => {
      const groundTruth: Detection[] = [
        {
          id: 'gt-1',
          class: 'vehicle',
          center: [0, 0, 0],
          dimensions: { width: 2, length: 4, height: 1.5 },
          yaw: 0,
          confidence: 1.0,
        },
      ];

      const predictions: Detection[] = [
        {
          id: 'pred-1',
          class: 'vehicle',
          center: [10, 10, 0],
          dimensions: { width: 2, length: 4, height: 1.5 },
          yaw: 0,
          confidence: 0.75,
          // No matches_gt field
        },
      ];

      const result = service.computeDiff(groundTruth, predictions);

      expect(result.tp.length).toBe(0);
      expect(result.fp.length).toBe(1);
      expect(result.fn.length).toBe(1);
      expect(result.fp[0]?.id).toBe('pred-1');
      expect(result.fn[0]?.id).toBe('gt-1');
    });

    it('should classify predictions with invalid matches_gt as FP', () => {
      const groundTruth: Detection[] = [
        {
          id: 'gt-1',
          class: 'vehicle',
          center: [0, 0, 0],
          dimensions: { width: 2, length: 4, height: 1.5 },
          yaw: 0,
          confidence: 1.0,
        },
      ];

      const predictions: Detection[] = [
        {
          id: 'pred-1',
          class: 'vehicle',
          center: [0, 0, 0],
          dimensions: { width: 2, length: 4, height: 1.5 },
          yaw: 0,
          confidence: 0.95,
          matches_gt: 'gt-99', // Non-existent GT
        },
      ];

      const result = service.computeDiff(groundTruth, predictions);

      expect(result.tp.length).toBe(0);
      expect(result.fp.length).toBe(1);
      expect(result.fn.length).toBe(1);
    });

    it('should identify unmatched ground truth as FN', () => {
      const groundTruth: Detection[] = [
        {
          id: 'gt-1',
          class: 'vehicle',
          center: [0, 0, 0],
          dimensions: { width: 2, length: 4, height: 1.5 },
          yaw: 0,
          confidence: 1.0,
        },
        {
          id: 'gt-2',
          class: 'pedestrian',
          center: [5, 5, 0],
          dimensions: { width: 0.5, length: 0.5, height: 1.8 },
          yaw: 0,
          confidence: 1.0,
        },
      ];

      const predictions: Detection[] = [
        {
          id: 'pred-1',
          class: 'vehicle',
          center: [0, 0, 0],
          dimensions: { width: 2, length: 4, height: 1.5 },
          yaw: 0,
          confidence: 0.95,
          matches_gt: 'gt-1', // Only matches gt-1
        },
      ];

      const result = service.computeDiff(groundTruth, predictions);

      expect(result.tp.length).toBe(1);
      expect(result.fp.length).toBe(0);
      expect(result.fn.length).toBe(1);
      expect(result.fn[0]?.id).toBe('gt-2');
    });

    it('should handle empty ground truth', () => {
      const groundTruth: Detection[] = [];
      const predictions: Detection[] = [
        {
          id: 'pred-1',
          class: 'vehicle',
          center: [0, 0, 0],
          dimensions: { width: 2, length: 4, height: 1.5 },
          yaw: 0,
          confidence: 0.95,
        },
      ];

      const result = service.computeDiff(groundTruth, predictions);

      expect(result.tp.length).toBe(0);
      expect(result.fp.length).toBe(1);
      expect(result.fn.length).toBe(0);
    });

    it('should handle empty predictions', () => {
      const groundTruth: Detection[] = [
        {
          id: 'gt-1',
          class: 'vehicle',
          center: [0, 0, 0],
          dimensions: { width: 2, length: 4, height: 1.5 },
          yaw: 0,
          confidence: 1.0,
        },
      ];
      const predictions: Detection[] = [];

      const result = service.computeDiff(groundTruth, predictions);

      expect(result.tp.length).toBe(0);
      expect(result.fp.length).toBe(0);
      expect(result.fn.length).toBe(1);
    });

    it('should handle mixed TP/FP/FN scenario', () => {
      const groundTruth: Detection[] = [
        {
          id: 'gt-1',
          class: 'vehicle',
          center: [0, 0, 0],
          dimensions: { width: 2, length: 4, height: 1.5 },
          yaw: 0,
          confidence: 1.0,
        },
        {
          id: 'gt-2',
          class: 'pedestrian',
          center: [5, 5, 0],
          dimensions: { width: 0.5, length: 0.5, height: 1.8 },
          yaw: 0,
          confidence: 1.0,
        },
        {
          id: 'gt-3',
          class: 'cyclist',
          center: [10, 10, 0],
          dimensions: { width: 0.6, length: 1.8, height: 1.2 },
          yaw: 0,
          confidence: 1.0,
        },
      ];

      const predictions: Detection[] = [
        {
          id: 'pred-1',
          class: 'vehicle',
          center: [0, 0, 0],
          dimensions: { width: 2, length: 4, height: 1.5 },
          yaw: 0,
          confidence: 0.95,
          matches_gt: 'gt-1',
        }, // TP
        {
          id: 'pred-2',
          class: 'pedestrian',
          center: [5, 5, 0],
          dimensions: { width: 0.5, length: 0.5, height: 1.8 },
          yaw: 0,
          confidence: 0.88,
          matches_gt: 'gt-2',
        }, // TP
        {
          id: 'pred-3',
          class: 'vehicle',
          center: [20, 20, 0],
          dimensions: { width: 2, length: 4, height: 1.5 },
          yaw: 0,
          confidence: 0.65,
        }, // FP (no match)
        // gt-3 is not matched -> FN
      ];

      const result = service.computeDiff(groundTruth, predictions);

      expect(result.tp.length).toBe(2);
      expect(result.fp.length).toBe(1);
      expect(result.fn.length).toBe(1);
      expect(result.tp.map((d) => d.id)).toEqual(['pred-1', 'pred-2']);
      expect(result.fp[0]?.id).toBe('pred-3');
      expect(result.fn[0]?.id).toBe('gt-3');
    });
  });

  describe('getDiffStats', () => {
    it('should compute correct statistics', () => {
      const diff = {
        tp: [
          {
            id: 'pred-1',
            class: 'vehicle' as const,
            center: [0, 0, 0] as [number, number, number],
            dimensions: { width: 2, length: 4, height: 1.5 },
            yaw: 0,
            confidence: 0.95,
          },
          {
            id: 'pred-2',
            class: 'pedestrian' as const,
            center: [5, 5, 0] as [number, number, number],
            dimensions: { width: 0.5, length: 0.5, height: 1.8 },
            yaw: 0,
            confidence: 0.88,
          },
        ],
        fp: [
          {
            id: 'pred-3',
            class: 'vehicle' as const,
            center: [10, 10, 0] as [number, number, number],
            dimensions: { width: 2, length: 4, height: 1.5 },
            yaw: 0,
            confidence: 0.65,
          },
        ],
        fn: [
          {
            id: 'gt-3',
            class: 'cyclist' as const,
            center: [15, 15, 0] as [number, number, number],
            dimensions: { width: 0.6, length: 1.8, height: 1.2 },
            yaw: 0,
            confidence: 1.0,
          },
        ],
      };

      const stats = service.getDiffStats(diff);

      expect(stats.totalPredictions).toBe(3);
      expect(stats.totalGroundTruth).toBe(3);
      expect(stats.truePositives).toBe(2);
      expect(stats.falsePositives).toBe(1);
      expect(stats.falseNegatives).toBe(1);
      expect(stats.precision).toBeCloseTo(2 / 3, 5);
      expect(stats.recall).toBeCloseTo(2 / 3, 5);
      expect(stats.f1Score).toBeCloseTo(2 / 3, 5);
    });

    it('should handle edge case of zero predictions', () => {
      const diff = {
        tp: [],
        fp: [],
        fn: [
          {
            id: 'gt-1',
            class: 'vehicle' as const,
            center: [0, 0, 0] as [number, number, number],
            dimensions: { width: 2, length: 4, height: 1.5 },
            yaw: 0,
            confidence: 1.0,
          },
        ],
      };

      const stats = service.getDiffStats(diff);

      expect(stats.precision).toBe(0);
      expect(stats.recall).toBe(0);
      expect(stats.f1Score).toBe(0);
    });

    it('should handle perfect predictions', () => {
      const diff = {
        tp: [
          {
            id: 'pred-1',
            class: 'vehicle' as const,
            center: [0, 0, 0] as [number, number, number],
            dimensions: { width: 2, length: 4, height: 1.5 },
            yaw: 0,
            confidence: 0.95,
          },
        ],
        fp: [],
        fn: [],
      };

      const stats = service.getDiffStats(diff);

      expect(stats.precision).toBe(1.0);
      expect(stats.recall).toBe(1.0);
      expect(stats.f1Score).toBe(1.0);
    });
  });
});
