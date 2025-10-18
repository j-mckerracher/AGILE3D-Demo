import { Injectable, inject, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  SceneMetadata,
  SceneRegistry,
  WorkerParseMessage,
  WorkerParseResponse,
} from '../../models/scene.models';

/**
 * Service for loading and parsing scene data.
 *
 * Responsibilities:
 * - Fetch scene metadata from JSON files
 * - Load binary point cloud data (.bin files)
 * - Parse point clouds in Web Worker (off main thread)
 * - Cache parsed results to avoid redundant parsing
 * - Manage worker lifecycle
 *
 * Performance:
 * - Uses transferable objects for zero-copy data transfer
 * - Caches parsed Float32Array results by scene ID
 * - Implements 10s timeout for worker operations
 *
 * @see WP-1.2.2 Scene Data & Parsing Infrastructure
 */
@Injectable({
  providedIn: 'root',
})
export class SceneDataService implements OnDestroy {
  private readonly http = inject(HttpClient);

  /** Cache for parsed point cloud positions, keyed by scene ID + tier */
  private readonly pointsCache = new Map<string, Float32Array>();

  /** Cache for scene metadata, keyed by scene ID */
  private readonly metadataCache = new Map<string, SceneMetadata>();

  /** Active worker instance */
  private worker: Worker | null = null;

  /** Worker timeout duration in milliseconds */
  private readonly WORKER_TIMEOUT_MS = 10_000;

  /**
   * Load scene metadata from JSON file.
   *
   * @param sceneId - Scene identifier (e.g., 'vehicle_heavy_01')
   * @returns Promise resolving to scene metadata
   * @throws Error if metadata file cannot be loaded or parsed
   */
  public async loadMetadata(sceneId: string): Promise<SceneMetadata> {
    // Check cache first
    const cached = this.metadataCache.get(sceneId);
    if (cached) {
      console.log('[SceneDataService] loadMetadata (cache hit)', sceneId);
      return cached;
    }

    try {
      const metadataPath = `assets/scenes/${sceneId}/metadata.json`;
      console.log('[SceneDataService] GET', metadataPath);
      const metadata = await firstValueFrom(
        this.http.get<SceneMetadata>(metadataPath)
      );

      // Validate required fields
      this.validateMetadata(metadata);
      console.log('[SceneDataService] metadata loaded', {
        scene_id: metadata.scene_id,
        pointCount: metadata.pointCount,
        stride: metadata.pointStride,
        pointsBin: metadata.pointsBin,
        preds: Object.keys(metadata.predictions || {}),
      });

      // Cache and return
      this.metadataCache.set(sceneId, metadata);
      return metadata;
    } catch (error) {
      console.error('[SceneDataService] loadMetadata error', error);
      throw new Error(
        `Failed to load metadata for scene '${sceneId}': ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Load scene registry containing all available scenes.
   *
   * @returns Promise resolving to scene registry
   * @throws Error if registry cannot be loaded
   */
  public async loadRegistry(): Promise<SceneRegistry> {
    try {
      const registryPath = 'assets/scenes/registry.json';
      console.log('[SceneDataService] GET', registryPath);
      const reg = await firstValueFrom(this.http.get<SceneRegistry>(registryPath));
      console.log('[SceneDataService] registry scenes', reg.scenes?.length ?? 0);
      return reg;
    } catch (error) {
      console.error('[SceneDataService] loadRegistry error', error);
      throw new Error(
        `Failed to load scene registry: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Load and parse binary point cloud data.
   *
   * Fetches the .bin file, parses it in a Web Worker, and caches the result.
   *
   * @param binPath - Path to .bin file (e.g., 'assets/scenes/vehicle_heavy_01/vehicle_heavy_01_100k.bin')
   * @param cacheKey - Cache key for storing parsed results (typically sceneId + tier)
   * @param stride - Number of floats per point (default: 3 for [x,y,z])
   * @returns Promise resolving to Float32Array of positions
   * @throws Error if loading or parsing fails
   */
  public async loadPoints(
    binPath: string,
    cacheKey: string,
    stride = 3
  ): Promise<Float32Array> {
    // Check cache first
    const cached = this.pointsCache.get(cacheKey);
    if (cached) {
      console.log('[SceneDataService] loadPoints (cache hit)', cacheKey);
      return cached;
    }

    try {
      console.log('[SceneDataService] GET', binPath, { stride, cacheKey });
      // Fetch binary data
      const arrayBuffer = await firstValueFrom(
        this.http.get(binPath, { responseType: 'arraybuffer' })
      );
      console.log('[SceneDataService] fetched bytes', arrayBuffer.byteLength);

      // Try worker parse with a transferable copy; fall back to main-thread parse on failure
      let positions: Float32Array;
      const workerBuffer = arrayBuffer.slice(0); // keep original for fallback
      try {
        positions = await this.parseInWorker(workerBuffer, stride);
        console.log('[SceneDataService] parsed via worker', positions.length);
      } catch (e) {
        console.warn('[SceneDataService] worker parse failed, falling back to main thread', e);
        positions = new Float32Array(arrayBuffer);
        if (positions.length % stride !== 0) {
          throw new Error(
            `Fallback parse produced misaligned length ${positions.length} for stride ${stride}`
          );
        }
      }

      // Cache result
      this.pointsCache.set(cacheKey, positions);

      return positions;
    } catch (error) {
      console.error('[SceneDataService] loadPoints error', error);
      throw new Error(
        `Failed to load points from '${binPath}': ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Parse point cloud data in Web Worker.
   *
   * Creates a worker, sends the buffer for parsing, and waits for the result.
   * Uses transferable objects for zero-copy performance.
   *
   * @param arrayBuffer - Raw binary data
   * @param stride - Number of floats per point
   * @returns Promise resolving to parsed Float32Array
   * @throws Error if parsing fails or times out
   */
  public async parseInWorker(
    arrayBuffer: ArrayBuffer,
    stride = 3
  ): Promise<Float32Array> {
    return new Promise((resolve, reject) => {
      // Create worker if not exists
      if (!this.worker) {
        try {
          // Use static asset path to avoid bundler URL issues
          this.worker = new Worker('/assets/workers/point-cloud-worker.js');
          console.log('[SceneDataService] worker created');
        } catch (error) {
          reject(
            new Error(
              `Failed to create worker: ${
                error instanceof Error ? error.message : 'Unknown error'
              }`
            )
          );
          return;
        }
      }

      // Set up timeout
      const timeoutId = setTimeout(() => {
        this.terminateWorker();
        reject(
          new Error(
            `Worker parsing timed out after ${this.WORKER_TIMEOUT_MS}ms`
          )
        );
      }, this.WORKER_TIMEOUT_MS);

      // Set up message handler
      const messageHandler = (event: MessageEvent<WorkerParseResponse | { ready?: boolean }>): void => {
        // Ignore worker ready pings
        if ((event.data as any)?.ready) {
          return;
        }

        clearTimeout(timeoutId);

        const data = event.data as WorkerParseResponse;
        if (data.ok && data.positions) {
          resolve(data.positions);
        } else {
          reject(new Error((data as any).error || 'Unknown worker parsing error'));
        }

        // Clean up listener
        this.worker?.removeEventListener('message', messageHandler);
      };

      this.worker.addEventListener('message', messageHandler);

      // Send parse request with transferable
      const message: WorkerParseMessage = { arrayBuffer, stride };
      this.worker.postMessage(message, [arrayBuffer]);
    });
  }

  /**
   * Terminate the worker and clean up resources.
   *
   * Call this when the service is no longer needed or to force worker restart.
   */
  public terminateWorker(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }

  /**
   * Clear all cached data.
   *
   * Useful for memory management or testing.
   */
  public clearCache(): void {
    this.pointsCache.clear();
    this.metadataCache.clear();
  }

  /**
   * Get cache statistics for monitoring.
   *
   * @returns Object with cache sizes
   */
  public getCacheStats(): { pointsCacheSize: number; metadataCacheSize: number } {
    return {
      pointsCacheSize: this.pointsCache.size,
      metadataCacheSize: this.metadataCache.size,
    };
  }

  /**
   * Validate scene metadata structure.
   *
   * @param metadata - Metadata to validate
   * @throws Error if metadata is invalid
   */
  private validateMetadata(metadata: SceneMetadata): void {
    const required = [
      'scene_id',
      'name',
      'pointsBin',
      'pointCount',
      'pointStride',
      'bounds',
      'ground_truth',
      'predictions',
      'metadata',
    ];

    for (const field of required) {
      if (!(field in metadata)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    if (!metadata.bounds.min || !metadata.bounds.max) {
      throw new Error('Invalid bounds: must have min and max');
    }

    if (
      !Array.isArray(metadata.bounds.min) ||
      metadata.bounds.min.length !== 3
    ) {
      throw new Error('Invalid bounds.min: must be [x, y, z]');
    }

    if (
      !Array.isArray(metadata.bounds.max) ||
      metadata.bounds.max.length !== 3
    ) {
      throw new Error('Invalid bounds.max: must be [x, y, z]');
    }
  }

  /**
   * Clean up resources on service destruction.
   */
  public ngOnDestroy(): void {
    this.terminateWorker();
    this.clearCache();
  }
}
