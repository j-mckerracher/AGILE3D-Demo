import {
  Component,
  EventEmitter,
  Input,
  Output,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil, interval, take } from 'rxjs';
import { FrameStreamService } from '../../../core/services/frame-stream/frame-stream.service';
import { FrameStreamStatus } from '../../../core/services/frame-stream/frame-stream.service';

/**
 * ErrorBannerComponent - Accessible error notification banner.
 *
 * Purpose:
 * - Display user-facing error messages with accessible ARIA markup
 * - Support dismissible and persistent error states
 * - Provide optional action links for troubleshooting
 * - Keyboard accessible with focus management
 * - Handle frame stream errors with retry logic
 *
 * Accessibility Features:
 * - role="alert" with aria-live="assertive" for screen readers
 * - Dismiss button receives focus when banner appears
 * - Keyboard navigable (Tab, Enter, Escape)
 * - High contrast mode support
 * - Respects prefers-reduced-motion media query
 *
 * Usage:
 * - WebGL unsupported errors
 * - Data loading failures
 * - Network connectivity issues
 * - Configuration errors
 * - Frame stream pause errors with retry options
 *
 * @example
 * <app-error-banner
 *   title="WebGL Not Supported"
 *   message="Your browser does not support WebGL 2.0."
 *   [links]="[{ label: 'Learn More', href: 'https://get.webgl.org/' }]"
 *   (dismissed)="onErrorDismissed()"
 * />
 *
 * @see WP-2.3.2 (Instrumentation, Error Handling & QA Hooks)
 * @see PRD NFR-4.2 (Graceful error handling)
 * @see PRD NFR-3.4 (Keyboard navigation)
 * @see UoW-U13 (Frame stream error banner with retry)
 */
@Component({
  selector: 'app-error-banner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './error-banner.component.html',
  styleUrls: ['./error-banner.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErrorBannerComponent implements OnInit, OnDestroy {
  /**
   * Error title (short, bold summary).
   * Default: "Error"
   */
  @Input() public title = 'Error';

  /**
   * Error message (detailed description).
   * Default: "Something went wrong."
   */
  @Input() public message = 'Something went wrong.';

  /**
   * Optional action links for user guidance.
   * Each link should have a label and href.
   *
   * @example
   * [{ label: 'Check System Requirements', href: '/docs/requirements' }]
   */
  @Input() public links: ReadonlyArray<{ label: string; href: string }> = [];

  /**
   * Whether to show the dismiss button.
   * Default: true
   */
  @Input() public showDismiss = true;

  /**
   * Whether to show retry buttons for frame stream errors.
   * Default: false
   */
  @Input() public showRetryButtons = false;

  /**
   * Emitted when the user dismisses the error banner.
   * Parent component should hide the banner in response.
   */
  @Output() public dismissed = new EventEmitter<void>();

  /**
   * Whether the banner should be shown.
   */
  public isVisible = false;

  /**
   * Current retry attempt count.
   */
  public retryAttempts = 0;

  /**
   * Maximum retry attempts for "Keep Trying" button.
   */
  private readonly maxRetries = 5;

  /**
   * Retry interval in milliseconds.
   */
  private readonly retryIntervalMs = 3000;

  /**
   * Subject for managing component lifecycle.
   */
  private readonly destroy$ = new Subject<void>();

  /**
   * Whether reduced motion is enabled.
   */
  public prefersReducedMotion = false;

  constructor(private frameStreamService: FrameStreamService) {
    // Check if reduced motion is preferred
    this.checkReducedMotionPreference();
  }

  /**
   * Initialize component by subscribing to FrameStreamService status changes.
   */
  public ngOnInit(): void {
    // Listen to frame stream status for PAUSED_MISS events
    this.frameStreamService.status$
      .pipe(takeUntil(this.destroy$))
      .subscribe((status) => {
        if (status === FrameStreamStatus.PAUSED_MISS) {
          this.showFrameStreamErrorBanner();
        } else if (status === FrameStreamStatus.PLAYING) {
          // Hide banner when playback resumes
          this.hideBanner();
        }
      });
  }

  /**
   * Cleanup on component destruction.
   */
  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Show the frame stream error banner.
   */
  private showFrameStreamErrorBanner(): void {
    this.title = 'Playback Paused';
    this.message = 'Playback paused due to network issues. Try again?';
    this.showRetryButtons = true;
    this.showDismiss = true;
    this.retryAttempts = 0;
    this.isVisible = true;
  }

  /**
   * Hide the error banner.
   */
  private hideBanner(): void {
    this.isVisible = false;
    this.showRetryButtons = false;
  }

  /**
   * Handle retry button click - resume playback immediately.
   */
  public onRetry(): void {
    this.frameStreamService.resume();
  }

  /**
   * Handle "Keep Trying" button click - auto-retry 5 times at 3-second intervals.
   */
  public onKeepTrying(): void {
    this.retryAttempts = 0;
    this.performAutoRetry();
  }

  /**
   * Perform auto-retry with exponential backoff.
   * Retries 5 times with 3-second intervals.
   */
  private performAutoRetry(): void {
    if (this.retryAttempts >= this.maxRetries) {
      return;
    }

    this.retryAttempts++;

    // Resume playback
    this.frameStreamService.resume();

    // If not at max retries, schedule next retry
    if (this.retryAttempts < this.maxRetries) {
      interval(this.retryIntervalMs)
        .pipe(take(1), takeUntil(this.destroy$))
        .subscribe(() => {
          this.performAutoRetry();
        });
    }
  }

  /**
   * Handle dismiss button click.
   */
  public onDismiss(): void {
    this.hideBanner();
    this.dismissed.emit();
  }

  /**
   * Check if reduced motion is preferred by the user.
   */
  private checkReducedMotionPreference(): void {
    if (typeof window !== 'undefined') {
      this.prefersReducedMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)'
      ).matches;
    }
  }
}
