import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * ErrorBannerComponent - Accessible error notification banner.
 *
 * Purpose:
 * - Display user-facing error messages with accessible ARIA markup
 * - Support dismissible and persistent error states
 * - Provide optional action links for troubleshooting
 * - Keyboard accessible with focus management
 *
 * Accessibility Features:
 * - role="alert" with aria-live="assertive" for screen readers
 * - Dismiss button receives focus when banner appears
 * - Keyboard navigable (Tab, Enter, Escape)
 * - High contrast mode support
 *
 * Usage:
 * - WebGL unsupported errors
 * - Data loading failures
 * - Network connectivity issues
 * - Configuration errors
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
 */
@Component({
  selector: 'app-error-banner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './error-banner.component.html',
  styleUrls: ['./error-banner.component.scss'],
})
export class ErrorBannerComponent {
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
   * Emitted when the user dismisses the error banner.
   * Parent component should hide the banner in response.
   */
  @Output() public dismissed = new EventEmitter<void>();

  /**
   * Handle dismiss button click or Escape key.
   * Emits the dismissed event for parent component to handle.
   */
  public onDismiss(): void {
    this.dismissed.emit();
  }
}
