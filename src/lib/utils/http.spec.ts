/**
 * HTTP Utilities Spec
 *
 * Unit tests for fetchWithTimeoutAndRetry and verifyRangeGet.
 * Tests cover success cases, timeouts, retries, AbortSignal handling, and Range detection.
 */

import {
  fetchWithTimeoutAndRetry,
  FetchWithTimeoutOptions,
  verifyRangeGet,
  TimeoutError,
  RangeGetResult,
} from './http';

describe('HTTP Utilities', () => {
  let fetchSpy: any;

  beforeEach(() => {
    fetchSpy = jasmine.createSpy('fetch');
    (globalThis.fetch as any) = fetchSpy;
  });

  // ============================================================================
  // fetchWithTimeoutAndRetry Tests
  // ============================================================================

  describe('fetchWithTimeoutAndRetry', () => {
    it('test_fetchWithTimeoutAndRetry_success: should fetch successfully on first attempt', (done) => {
      const mockResponse = new Response('success', { status: 200 });
      fetchSpy.and.returnValue(Promise.resolve(mockResponse));

      fetchWithTimeoutAndRetry('https://example.com/data').then((result) => {
        expect(result).toBe(mockResponse);
        expect(fetchSpy).toHaveBeenCalledTimes(1);
        done();
      }).catch(done.fail);
    });

    it('test_fetchWithTimeoutAndRetry_timeout_first_attempt: should timeout on first attempt and retry', (done) => {
      const mockResponse = new Response('success', { status: 200 });
      let callCount = 0;

      fetchSpy.and.callFake(() => {
        callCount++;
        if (callCount === 1) {
          // Simulate timeout by rejecting with AbortError
          return Promise.reject(new DOMException('The operation was aborted', 'AbortError'));
        }
        return Promise.resolve(mockResponse);
      });

      fetchWithTimeoutAndRetry('https://example.com/data', {
        timeoutMs: 50,
        retryBackoff: [50],
      }).then((result) => {
        expect(result).toBe(mockResponse);
        expect(fetchSpy).toHaveBeenCalledTimes(2);
        done();
      }).catch((err) => {
        done.fail('Should succeed after retry: ' + err.message);
      });
    });

    it('test_fetchWithTimeoutAndRetry_timeout_all_retries: should fail when all attempts timeout', (done) => {
      fetchSpy.and.returnValue(
        Promise.reject(new DOMException('The operation was aborted', 'AbortError'))
      );

      fetchWithTimeoutAndRetry('https://example.com/data', {
        timeoutMs: 50,
        retryBackoff: [50],
      }).then(() => {
        done.fail('Should have thrown TimeoutError');
      }).catch((err) => {
        expect(err).toEqual(jasmine.any(TimeoutError));
        expect(fetchSpy).toHaveBeenCalledTimes(2);
        done();
      });
    });

    it('test_fetchWithTimeoutAndRetry_network_error_retry: should retry on network error with backoff', (done) => {
      const mockResponse = new Response('success', { status: 200 });
      let callCount = 0;

      fetchSpy.and.callFake(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new TypeError('Failed to fetch'));
        }
        return Promise.resolve(mockResponse);
      });

      fetchWithTimeoutAndRetry('https://example.com/data', {
        retryBackoff: [50],
      }).then((result) => {
        expect(result).toBe(mockResponse);
        expect(fetchSpy).toHaveBeenCalledTimes(2);
        done();
      }).catch((err) => {
        done.fail('Should succeed after retry: ' + err.message);
      });
    });

    it('test_fetchWithTimeoutAndRetry_abort_signal_respected: should handle abort from caller', (done) => {
      const controller = new AbortController();

      fetchSpy.and.returnValue(
        new Promise((_, reject) => {
          // Simulate the fetch being aborted
          setTimeout(() => {
            reject(new DOMException('Aborted by caller', 'AbortError'));
          }, 10);
        })
      );

      fetchWithTimeoutAndRetry('https://example.com/data', {
        signal: controller.signal,
        timeoutMs: 5000,
        retryBackoff: [],
      }).then(() => {
        done.fail('Should have thrown error on abort');
      }).catch((err) => {
        // Abort or timeout error expected
        expect(err instanceof Error).toBe(true);
        done();
      });

      // Abort immediately
      setTimeout(() => {
        controller.abort();
      }, 5);
    });

    it('test_fetchWithTimeoutAndRetry_custom_backoff: should use custom backoff delays', (done) => {
      const mockResponse = new Response('success', { status: 200 });
      let callCount = 0;

      fetchSpy.and.callFake(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve(mockResponse);
      });

      const customBackoff = [50, 50];
      fetchWithTimeoutAndRetry('https://example.com/data', {
        retryBackoff: customBackoff,
      }).then((result) => {
        expect(result).toBe(mockResponse);
        expect(fetchSpy).toHaveBeenCalledTimes(3);
        done();
      }).catch((err) => {
        done.fail('Should succeed after retries: ' + err.message);
      });
    });
  });

  // ============================================================================
  // verifyRangeGet Tests
  // ============================================================================

  describe('verifyRangeGet', () => {
    it('test_verifyRangeGet_supports_range: should detect Range support via Accept-Ranges header', (done) => {
      const mockResponse = new Response(undefined, {
        status: 200,
        headers: {
          'accept-ranges': 'bytes',
          'content-length': '1000000',
        },
      });

      fetchSpy.and.returnValue(Promise.resolve(mockResponse));

      verifyRangeGet('https://example.com/data.bin').then((result) => {
        expect(result.supportsRange).toBe(true);
        expect(result.contentLength).toBe(1000000);
        done();
      }).catch(done.fail);
    });

    it('test_verifyRangeGet_no_range_support: should detect no Range support when headers missing', (done) => {
      const mockResponse = new Response(undefined, {
        status: 200,
        headers: {
          'content-length': '1000000',
        },
      });

      fetchSpy.and.returnValue(Promise.resolve(mockResponse));

      verifyRangeGet('https://example.com/data.bin').then((result) => {
        expect(result.supportsRange).toBe(false);
        expect(result.contentLength).toBe(1000000);
        done();
      }).catch(done.fail);
    });

    it('test_verifyRangeGet_error_handling: should gracefully handle errors and return false', (done) => {
      fetchSpy.and.returnValue(Promise.reject(new TypeError('Network error')));

      verifyRangeGet('https://example.com/data.bin').then((result) => {
        expect(result.supportsRange).toBe(false);
        expect(result.contentLength).toBeUndefined();
        done();
      }).catch(done.fail);
    });

    it('test_verifyRangeGet_returns_content_length: should extract and return Content-Length', (done) => {
      const mockResponse = new Response(undefined, {
        status: 206,
        headers: {
          'accept-ranges': 'bytes',
          'content-length': '2500000',
          'content-range': 'bytes 0-0/2500000',
        },
      });

      fetchSpy.and.returnValue(Promise.resolve(mockResponse));

      verifyRangeGet('https://cdn.example.com/file.mp4').then((result) => {
        expect(result.supportsRange).toBe(true);
        expect(result.contentLength).toBe(2500000);
        done();
      }).catch(done.fail);
    });

    it('test_verifyRangeGet_content_range_header: should detect Range support via Content-Range header', (done) => {
      const mockResponse = new Response(undefined, {
        status: 206,
        headers: {
          'content-range': 'bytes 0-0/5000000',
          'content-length': '5000000',
        },
      });

      fetchSpy.and.returnValue(Promise.resolve(mockResponse));

      verifyRangeGet('https://example.com/stream.bin').then((result) => {
        expect(result.supportsRange).toBe(true);
        expect(result.contentLength).toBe(5000000);
        done();
      }).catch(done.fail);
    });
  });

  // ============================================================================
  // TimeoutError Class Tests
  // ============================================================================

  describe('TimeoutError', () => {
    it('should create TimeoutError with attempt information', () => {
      const error = new TimeoutError('Timeout after 3000ms', 2, 3);

      expect(error.name).toBe('TimeoutError');
      expect(error.message).toBe('Timeout after 3000ms');
      expect(error.attemptNumber).toBe(2);
      expect(error.totalAttempts).toBe(3);
      expect(error instanceof Error).toBe(true);
    });
  });
});
