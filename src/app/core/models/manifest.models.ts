/**
 * Manifest Models
 *
 * TypeScript interfaces for sequence manifests and frame references.
 * Aligns with converter-generated metadata structure for frame streaming.
 */

/**
 * Reference to a single frame within a sequence.
 *
 * @interface FrameRef
 * @property {string} id - Unique frame identifier (e.g., "frame_001")
 * @property {number} [ts] - Optional timestamp (milliseconds)
 * @property {number} [pointCount] - Optional point cloud sample count
 * @property {object} urls - URL references to frame data
 * @property {string} urls.points - URL to point cloud data
 * @property {string} [urls.gt] - Optional ground truth annotation URL
 * @property {Record<string, string>} [urls.det] - Optional detection results by model ID
 */
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

/**
 * Complete metadata for a sequence of frames.
 *
 * Returned by ManifestService and consumed by FrameStreamService
 * to discover available frames and their URLs.
 *
 * @interface SequenceManifest
 * @property {string} version - Manifest format version (e.g., "1.0.0")
 * @property {string} sequenceId - Sequence identifier (e.g., "v_1784_1828")
 * @property {number} fps - Frames per second playback rate
 * @property {Record<string, string>} classMap - Mapping of class IDs to class names
 * @property {string[]} branches - Available detection algorithm branches/variants
 * @property {FrameRef[]} frames - Array of frame references in order
 */
export interface SequenceManifest {
  version: string;
  sequenceId: string;
  fps: number;
  classMap: Record<string, string>;
  branches: string[];
  frames: FrameRef[];
}

/**
 * Configuration for manifest fetch behavior.
 *
 * @interface ManifestFetchConfig
 * @property {number} timeoutMs - HTTP request timeout in milliseconds (default: 5000)
 * @property {number[]} retryBackoff - Backoff delays in milliseconds for retry attempts (default: [250, 750])
 * @property {string} baseUrl - Base URL for CDN or asset server (default: '/assets/data/streams')
 */
export interface ManifestFetchConfig {
  timeoutMs: number;
  retryBackoff: number[];
  baseUrl: string;
}

/**
 * Default manifest fetch configuration.
 * Provides 5-second timeout and exponential backoff [250ms, 750ms] for retries.
 */
export const DEFAULT_MANIFEST_CONFIG: ManifestFetchConfig = {
  timeoutMs: 5000,
  retryBackoff: [250, 750],
  baseUrl: '/assets/data/streams',
};
