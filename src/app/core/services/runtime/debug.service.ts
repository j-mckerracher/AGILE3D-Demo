import { Injectable, isDevMode } from '@angular/core';

/**
 * DebugService provides unified debug mode detection and query parameter access.
 *
 * Debug mode is enabled when either:
 * - Angular is running in development mode (isDevMode())
 * - URL contains ?debug=true query parameter
 *
 * This service is used to gate instrumentation features like FPS overlays,
 * console logging, and performance measurements.
 *
 * @see WP-2.3.2 Instrumentation, Error Handling & QA Hooks
 * @see PRD NFR-1.8 (Instrumentation present)
 */
@Injectable({
  providedIn: 'root',
})
export class DebugService {
  private readonly debugEnabled: boolean;
  private readonly queryParams: URLSearchParams;

  public constructor() {
    // Check Angular dev mode
    const angularDevMode = isDevMode();

    // Parse URL query parameters (SSR-safe)
    if (typeof window !== 'undefined' && window.location) {
      this.queryParams = new URLSearchParams(window.location.search);
      const debugParam = this.queryParams.get('debug');
      this.debugEnabled = angularDevMode || debugParam === 'true';
    } else {
      this.queryParams = new URLSearchParams();
      this.debugEnabled = angularDevMode;
    }

    if (this.debugEnabled) {
      console.log('[DebugService] Debug mode enabled', {
        angularDevMode,
        queryParam: this.getQueryParam('debug'),
      });
    }
  }

  /**
   * Check if debug mode is enabled.
   *
   * @returns true if Angular is in dev mode OR ?debug=true is present
   */
  public isDebugEnabled(): boolean {
    return this.debugEnabled;
  }

  /**
   * Get a query parameter value from the URL.
   *
   * @param name - Query parameter name
   * @returns Parameter value or null if not present
   *
   * @example
   * // URL: http://localhost:4200?tier=fallback
   * debugService.getQueryParam('tier') // returns 'fallback'
   */
  public getQueryParam(name: string): string | null {
    return this.queryParams.get(name);
  }
}
