/**
 * Sequence playback models for Waymo-style frame data
 */

import { DetectionClass } from './scene.models';
import type { Detection } from './scene.models';

// Re-export Detection for convenience
export type { Detection };

export interface FrameRef {
  id: string;
  ts?: number;
  pointCount?: number;
  urls: {
    points: string;
    gt?: string;
    det?: Record<string, string>;
  };
}

export interface SequenceManifest {
  version: string;
  sequenceId: string;
  fps?: number;
  branches?: string[];
  frames: FrameRef[];
}

export const LABEL_MAP: Record<number, DetectionClass> = {
  1: 'vehicle',
  2: 'pedestrian',
  3: 'cyclist'
};
