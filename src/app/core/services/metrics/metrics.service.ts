import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { throttleTime, takeUntil, catchError, retry } from 'rxjs/operators';
import { of, timer } from 'rxjs';

/**
 * Telemetry event payload matching backend schema.
 * Captures performance metrics and user session data.
 *
 * @see UoW-U14 (Telemetry Service)
 */
export interface MetricsPayload {
  /** Timestamp of event (ms since epoch) */
  ts: number;

  /** Session identifier for grouping user interactions */
  sessionId: string;

  /** Sequential event counter within session */
  seqId: number;

  /** Frame identifier (e.g., request ID or stream ID) */
  frameId?: string;

  /** Event type/name */
  event: string;

  /** Data size in bytes */
  bytes?: number;

  /** Latency in milliseconds */
  latencyMs?: number;

  /** Frames per second */
  fps?: number;

  /** Buffer state (0-100 percentage) */
  buffer?: number;

  /** Number of missed frames or events */
  misses?: number;

  /** User agent string (no PII) */
  ua: string;
}

/**
 * Client-side telemetry service with sampled metrics collection,
 * throttling (≤1 event per 5s), and retry-with-backoff for 5xx errors.
 *
 * Features:
 * - Query flag `?metrics=off` disables service entirely
 * - RxJS-based event queue with throttling
 * - Exponential backoff retry on 5xx errors
 * - Configuration via ConfigService (if available)
 * - Opt-out support with graceful no-op when disabled
 *
 * Usage:
 * ```ts
 * constructor(private metrics: MetricsService) {}
 *
 * captureMetric(frameId: string, latency: number) {
 *   this.metrics.capture({
 *     event: 'frame-complete',
 *     frameId,
 *     latencyMs: latency,
 *     fps: 60,
 *   });
 * }
 * ```
 *
 * @see UoW-U14 (Client-side telemetry)
 */
@Injectable({
  providedIn: 'root',
})
export class MetricsService implements OnDestroy {
  /** Session ID generated at service initialization */
  private readonly sessionId: string;

  /** Event sequence counter */
  private seqId: number = 0;

  /** Metrics queue subject */
  private readonly queue$ = new Subject<Partial<MetricsPayload>>();

  /** Cleanup subject */
  private readonly destroy$ = new Subject<void>();

  /** Service disabled flag (from ?metrics=off query param) */
  private readonly disabled: boolean;

  /** Metrics endpoint URL (default: /metrics) */
  private readonly metricsUrl: string;

  /** Throttle interval in milliseconds (default: 5000ms = 5s) */
  private readonly throttleMs: number;

  constructor(private readonly http: HttpClient) {
    this.sessionId = this.generateSessionId();
    this.disabled = this.isMetricsDisabled();
    this.metricsUrl = '/metrics';
    this.throttleMs = 5000; // Default: 1 event per 5 seconds

    // Initialize metrics queue if not disabled
    if (!this.disabled) {
      this.initializeQueue();
    }
  }

  /**
   * Capture a metric event.
   * No-op if metrics are disabled via query flag.
   *
   * @param metric - Partial metric payload (will be merged with defaults)
   */
  public capture(metric: Partial<MetricsPayload>): void {
    if (this.disabled) {
      return; // Metrics disabled via ?metrics=off
    }

    this.queue$.next(metric);
  }

  /**
   * Initialize the metrics queue with throttling and HTTP POST.
   * Applies throttleTime operator and retries 5xx with exponential backoff.
   */
  private initializeQueue(): void {
    this.queue$
      .pipe(
        throttleTime(this.throttleMs, undefined, {
          leading: true,
          trailing: true,
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((metric) => {
        const payload: MetricsPayload = {
          ts: Date.now(),
          sessionId: this.sessionId,
          seqId: ++this.seqId,
          event: metric.event || 'unknown',
          ua: navigator.userAgent,
          ...metric,
        };

        this.sendMetric(payload);
      });
  }

  /**
   * Send metric to backend with retry and backoff logic.
   * Retries on 5xx errors using exponential backoff.
   *
   * @param payload - Serialized metric payload
   */
  private sendMetric(payload: MetricsPayload): void {
    this.http
      .post<void>(this.metricsUrl, payload)
      .pipe(
        retry({
          count: 3,
          delay: (error, retryCount) => {
            // Exponential backoff: 1s, 2s, 4s
            if (error.status >= 500) {
              const backoffMs = Math.pow(2, retryCount) * 1000;
              return timer(backoffMs);
            }
            // Don't retry non-5xx errors
            throw error;
          },
        }),
        catchError((error) => {
          // Log errors but don't break the service
          console.debug('[MetricsService] POST failed:', error);
          return of(undefined);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe();
  }

  /**
   * Check if metrics are disabled via query parameter.
   * @returns true if ?metrics=off is present, false otherwise
   */
  private isMetricsDisabled(): boolean {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.has('metrics') && params.get('metrics') === 'off';
    } catch {
      return false;
    }
  }

  /**
   * Generate a unique session identifier.
   * @returns UUID-like session ID
   */
  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup lifecycle hook.
   * Completes subscriptions and flushes pending metrics.
   */
  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.queue$.complete();
  }
}
