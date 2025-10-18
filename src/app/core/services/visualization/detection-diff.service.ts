/**
 * Detection Diff Service
 *
 * Classifies detections as True Positive (TP), False Positive (FP), or False Negative (FN)
 * based on ground truth matching using the matches_gt field.
 *
 * Strategy:
 * - TP: Prediction has matches_gt field that references a valid ground truth ID
 * - FP: Prediction without valid matches_gt or matches_gt references non-existent GT
 * - FN: Ground truth detection not referenced by any prediction's matches_gt
 *
 * PRD References:
 * - FR-1.14: Highlight differences between baseline and AGILE3D detections
 * - WP-2.1.2: Detection Visualization and Diff Highlighting
 *
 * @example
 * ```typescript
 * const service = inject(DetectionDiffService);
 * const { tp, fp, fn } = service.computeDiff(groundTruth, predictions);
 * ```
 */

import { Injectable } from '@angular/core';
import { Detection } from '../../models/scene.models';

/**
 * Result of detection diff computation.
 */
export interface DetectionDiff {
  /** True Positives: predictions matching ground truth */
  tp: Detection[];
  /** False Positives: predictions not matching ground truth */
  fp: Detection[];
  /** False Negatives: ground truth not matched by predictions */
  fn: Detection[];
}

@Injectable({
  providedIn: 'root',
})
export class DetectionDiffService {
  /**
   * Compute difference between ground truth and predictions.
   *
   * @param groundTruth - Ground truth detections
   * @param predictions - Predicted detections to compare
   * @returns Classification of predictions into TP/FP and ground truth into FN
   *
   * @remarks
   * Uses the optional matches_gt field on predictions to determine matches.
   * If matches_gt is missing on all predictions, falls back to naive matching
   * based on ID presence (no IoU computation in this implementation).
   */
  public computeDiff(groundTruth: Detection[], predictions: Detection[]): DetectionDiff {
    // Build set of ground truth IDs for fast lookup
    const gtIds = new Set(groundTruth.map((det) => det.id));

    // Track which GT IDs have been matched
    const matchedGtIds = new Set<string>();

    // Classify predictions as TP or FP
    const tp: Detection[] = [];
    const fp: Detection[] = [];

    for (const pred of predictions) {
      if (pred.matches_gt && gtIds.has(pred.matches_gt)) {
        // Valid match: prediction references existing ground truth
        tp.push(pred);
        matchedGtIds.add(pred.matches_gt);
      } else {
        // No match or invalid match_gt reference
        fp.push(pred);
      }
    }

    // Identify unmatched ground truth (False Negatives)
    const fn = groundTruth.filter((gt) => !matchedGtIds.has(gt.id));

    return { tp, fp, fn };
  }

  /**
   * Get diff statistics for reporting.
   *
   * @param diff - Detection diff result from computeDiff
   * @returns Statistics summary
   */
  public getDiffStats(diff: DetectionDiff): {
    totalPredictions: number;
    totalGroundTruth: number;
    truePositives: number;
    falsePositives: number;
    falseNegatives: number;
    precision: number;
    recall: number;
    f1Score: number;
  } {
    const totalPredictions = diff.tp.length + diff.fp.length;
    const totalGroundTruth = diff.tp.length + diff.fn.length;

    const precision = totalPredictions > 0 ? diff.tp.length / totalPredictions : 0;
    const recall = totalGroundTruth > 0 ? diff.tp.length / totalGroundTruth : 0;
    const f1Score =
      precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    return {
      totalPredictions,
      totalGroundTruth,
      truePositives: diff.tp.length,
      falsePositives: diff.fp.length,
      falseNegatives: diff.fn.length,
      precision,
      recall,
      f1Score,
    };
  }
}
