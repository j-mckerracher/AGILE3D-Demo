/**
 * HTTP Utilities
 *
 * Reusable fetch utilities for network operations with timeout, retry, and Range support detection.
 * Provides `fetchWithTimeoutAndRetry` for frame downloads and `verifyRangeGet` for CDN capability probing.
 *
 * Both functions are standalone utilities (no Angular/RxJS dependencies) and support AbortController
 * for cancellation and timeout handling.
 *
 * @example
 * // Fetch with timeout and retry
 * try {
 *   const response = await fetchWithTimeoutAndRetry('https://cdn.example.com/frame.bin', {
 *     timeoutMs: 3000,
 *     retryBackoff: [250, 750]
 *   });
 *   const data = await response.arrayBuffer();
 * } catch (err) {
 *   console.error('Fetch failed:', err.message);
 * }
 *
 * @example
 * // Verify Range GET support
 * const result = await verifyRangeGet('https://cdn.example.com/manifest.json');
 * console.log(`CDN supports Range requests: ${result.supportsRange}`);
 */

/**
 * Timeout error class for distinguishing timeout failures from other network errors.
 */
export class TimeoutError extends Error {
  constructor(message: string, public readonly attemptNumber: number, public readonly totalAttempts: number) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * Options for fetchWithTimeoutAndRetry.
 */
export interface FetchWithTimeoutOptions {
  /**
   * Request timeout in milliseconds (default: 3000 = 3 seconds)
   */
  timeoutMs?: number;

  /**
   * Array of backoff delays in milliseconds for retry attempts (default: [250, 750])
   * Example: [250, 750] means first retry waits 250ms, second retry waits 750ms
   */
  retryBackoff?: number[];

  /**
   * AbortSignal from caller; if aborted, fetch is cancelled immediately
   */
  signal?: AbortSignal;
}

/**
 * Result of Range GET verification.
 */
export interface RangeGetResult {
  /**
   * Whether CDN supports HTTP Range requests
   */
  supportsRange: boolean;

  /**
   * Content length if provided in response headers
   */
  contentLength?: number;
}

/**
 * Fetch with timeout and retry backoff.
 *
 * Performs HTTP request with automatic timeout and exponential backoff retry.
 * Each attempt gets its own AbortController for independent timeout handling.
 * Respects caller-provided AbortSignal (aborts if caller cancels).
 *
 * @param url - Request URL
 * @param options - Configuration for timeout, retry backoff, and abort signal
 * @returns Promise resolving to Response on success, or throws on final failure
 * @throws {TimeoutError} When timeout occurs on all attempts
 * @throws {Error} When network error or final error after all retries exhausted
 *
 * @example
 * const response = await fetchWithTimeoutAndRetry(
 *   'https://cdn.example.com/frame_001.bin',
 *   { timeoutMs: 3000, retryBackoff: [250, 750] }
 * );
 * const buffer = await response.arrayBuffer();
 */
export async function fetchWithTimeoutAndRetry(
  url: string,
  options?: FetchWithTimeoutOptions
): Promise<Response> {
  const timeoutMs = options?.timeoutMs ?? 3000;
  const retryBackoff = options?.retryBackoff ?? [250, 750];
  const callerSignal = options?.signal;

  const maxAttempts = 1 + retryBackoff.length;
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Create abort controller for this attempt
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      // If caller provided signal, listen for their abort too
      let callerAbortHandler: (() => void) | undefined;
      if (callerSignal) {
        callerAbortHandler = () => controller.abort();
        callerSignal.addEventListener('abort', callerAbortHandler);
      }

      try {
        console.log('[http] Fetch attempt', { attempt, maxAttempts, url });

        const response = await fetch(url, {
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        if (callerAbortHandler && callerSignal) {
          callerSignal.removeEventListener('abort', callerAbortHandler);
        }

        console.log('[http] Fetch success', { attempt, status: response.status });
        return response;
      } finally {
        clearTimeout(timeoutId);
        if (callerAbortHandler && callerSignal) {
          callerSignal.removeEventListener('abort', callerAbortHandler);
        }
      }
    } catch (error) {
      const errorName = error instanceof Error ? error.name : 'Unknown';
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Check if this is a timeout (AbortError from our timeout)
      if (error instanceof Error && error.name === 'AbortError') {
        lastError = new TimeoutError(
          `Fetch timeout after ${timeoutMs}ms on attempt ${attempt}/${maxAttempts}`,
          attempt,
          maxAttempts
        );
        console.warn('[http] Fetch timeout', { attempt, maxAttempts, timeoutMs });
      } else {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn('[http] Fetch error', { attempt, maxAttempts, errorName, errorMessage });
      }

      // If we have retries left, wait and try again
      if (attempt < maxAttempts) {
        const delayMs = retryBackoff[attempt - 1]!;
        console.log('[http] Retrying', { attempt, nextDelayMs: delayMs });
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  // All attempts exhausted
  const finalMessage = lastError?.message ?? 'Unknown error';
  console.error('[http] Fetch failed after all retries', {
    url,
    attempts: maxAttempts,
    finalError: finalMessage,
  });

  throw lastError ?? new Error(`Fetch failed after ${maxAttempts} attempts`);
}

/**
 * Verify CDN support for HTTP Range requests.
 *
 * Sends HEAD request with `Range: bytes=0-0` header to probe for Range support.
 * Checks response headers for `Accept-Ranges: bytes` or `Content-Range` header.
 * Gracefully handles errors (returns false if probe fails).
 *
 * @param url - URL to probe for Range support
 * @param signal - Optional AbortSignal for cancellation
 * @returns Promise resolving to {supportsRange, contentLength?}
 *
 * @example
 * const result = await verifyRangeGet('https://cdn.example.com/data.bin');
 * if (result.supportsRange) {
 *   console.log(`File size: ${result.contentLength} bytes`);
 *   // Safe to use Range requests for streaming
 * }
 */
export async function verifyRangeGet(url: string, signal?: AbortSignal): Promise<RangeGetResult> {
  try {
    console.log('[http] Probing Range GET support', { url });

    const response = await fetch(url, {
      method: 'HEAD',
      headers: {
        'Range': 'bytes=0-0',
      },
      signal,
    });

    // Check for Range support indicators
    const acceptRanges = response.headers.get('accept-ranges');
    const contentRange = response.headers.get('content-range');
    const supportsRange = acceptRanges === 'bytes' || contentRange !== null;

    // Extract content length if available
    const contentLengthHeader = response.headers.get('content-length');
    const contentLength = contentLengthHeader ? parseInt(contentLengthHeader, 10) : undefined;

    const result: RangeGetResult = {
      supportsRange,
      contentLength,
    };

    console.log('[http] Range GET probe result', {
      url,
      supportsRange,
      contentLength,
      acceptRanges,
      hasContentRange: contentRange !== null,
    });

    if (!supportsRange) {
      console.warn('[http] CDN does not support Range requests', { url });
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[http] Range GET probe failed', { url, error: errorMessage });

    // Gracefully return false if probe fails
    return { supportsRange: false };
  }
}
