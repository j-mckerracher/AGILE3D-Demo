import { Injectable, inject } from '@angular/core';
import { DebugService } from './debug.service';

/**
 * CapabilityService detects browser capabilities required for 3D rendering.
 *
 * Features:
 * - WebGL2 support detection with safe fallback
 * - OffscreenCanvas availability check
 * - QA override via ?webgl=0 to force unsupported state
 * - Cached results for performance
 *
 * @see WP-2.3.2 Instrumentation, Error Handling & QA Hooks
 * @see PRD NFR-2.5 (WebGL capability check with fallback message)
 */
@Injectable({
  providedIn: 'root',
})
export class CapabilityService {
  private readonly debug = inject(DebugService);

  private webgl2Supported?: boolean;
  private offscreenCanvasAvailable?: boolean;

  /**
   * Check if WebGL2 is supported by the current browser.
   *
   * Performs actual capability detection on first call, then caches the result.
   * Honors ?webgl=0 query parameter to force unsupported state for QA testing.
   *
   * @returns true if WebGL2 is available and not overridden by QA hook
   *
   * @example
   * if (!capabilityService.checkWebGL2Support()) {
   *   // Show error banner, skip 3D initialization
   * }
   */
  public checkWebGL2Support(): boolean {
    // Check cache first
    if (this.webgl2Supported !== undefined) {
      return this.webgl2Supported;
    }

    // QA Hook: ?webgl=0 forces unsupported
    const webglParam = this.debug.getQueryParam('webgl');
    if (webglParam === '0') {
      console.warn('[CapabilityService] QA Hook: webgl=0 - forcing unsupported');
      this.webgl2Supported = false;
      return false;
    }

    // SSR safety: return false if document undefined
    if (typeof document === 'undefined') {
      console.warn('[CapabilityService] Document undefined (SSR?), assuming WebGL2 unsupported');
      this.webgl2Supported = false;
      return false;
    }

    try {
      // Create temporary canvas
      const canvas = document.createElement('canvas');

      // Try to get WebGL2 context
      const gl = canvas.getContext('webgl2');

      // Clean up
      if (gl) {
        // Successful WebGL2 context creation
        this.webgl2Supported = true;

        // Optional: Check for required extensions
        // const requiredExtensions = ['EXT_color_buffer_float'];
        // const allSupported = requiredExtensions.every(ext => gl.getExtension(ext));

        if (this.debug.isDebugEnabled()) {
          console.log('[CapabilityService] WebGL2 supported', {
            vendor: gl.getParameter(gl.VENDOR),
            renderer: gl.getParameter(gl.RENDERER),
          });
        }
      } else {
        // Context creation failed
        this.webgl2Supported = false;
        console.warn('[CapabilityService] WebGL2 context creation failed');
      }

      return this.webgl2Supported;
    } catch (error) {
      // Exception during detection
      console.error('[CapabilityService] WebGL2 detection error', error);
      this.webgl2Supported = false;
      return false;
    }
  }

  /**
   * Check if OffscreenCanvas is available for Web Worker rendering.
   *
   * OffscreenCanvas allows rendering in a worker thread, improving main thread
   * performance. This is an optional enhancement - the app works without it.
   *
   * @returns true if OffscreenCanvas is supported
   */
  public hasOffscreenCanvas(): boolean {
    // Check cache first
    if (this.offscreenCanvasAvailable !== undefined) {
      return this.offscreenCanvasAvailable;
    }

    // SSR safety
    if (typeof window === 'undefined') {
      this.offscreenCanvasAvailable = false;
      return false;
    }

    try {
      this.offscreenCanvasAvailable = typeof OffscreenCanvas !== 'undefined';

      if (this.debug.isDebugEnabled()) {
        console.log(
          '[CapabilityService] OffscreenCanvas',
          this.offscreenCanvasAvailable ? 'supported' : 'not supported'
        );
      }

      return this.offscreenCanvasAvailable;
    } catch (error) {
      this.offscreenCanvasAvailable = false;
      return false;
    }
  }

  /**
   * Get a summary of all detected capabilities.
   *
   * Useful for debugging and feature detection logging.
   *
   * @returns Object with all capability flags
   */
  public getCapabilities(): {
    webgl2: boolean;
    offscreenCanvas: boolean;
  } {
    return {
      webgl2: this.checkWebGL2Support(),
      offscreenCanvas: this.hasOffscreenCanvas(),
    };
  }
}
