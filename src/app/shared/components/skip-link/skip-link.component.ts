/**
 * Skip Link Component
 *
 * Provides a keyboard-accessible skip link for users to bypass navigation
 * and jump directly to main content. Meets WCAG 2.2 Success Criterion 2.4.1.
 *
 * PRD References:
 * - NFR-3.3: Clear visual hierarchy and semantic HTML
 * - NFR-3.4: Keyboard navigation support
 *
 * Usage:
 * <app-skip-link targetId="main-content">Skip to main content</app-skip-link>
 */

import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-skip-link',
  standalone: true,
  imports: [CommonModule],
  template: `
    <a
      [href]="'#' + targetId"
      class="skip-link"
      (click)="onSkipClick($event)"
      [attr.aria-label]="ariaLabel || content"
    >
      <ng-content>{{ content }}</ng-content>
    </a>
  `,
  styles: [
    `
      .skip-link {
        position: absolute;
        top: -100%;
        left: 0;
        z-index: 9999;
        padding: var(--ag3d-space-8) var(--ag3d-space-16);
        background-color: var(--ag3d-color-primary-600);
        color: var(--ag3d-color-text-on-primary);
        text-decoration: none;
        border-radius: var(--ag3d-radius-sm);
        font-weight: var(--ag3d-font-weight-medium);
        font-size: var(--ag3d-font-size-body-large);
        transition: var(--ag3d-transition-fade);

        &:focus {
          top: var(--ag3d-space-8);
          left: var(--ag3d-space-8);
          outline: 3px solid var(--ag3d-color-focus);
          outline-offset: 2px;
        }

        &:hover {
          background-color: var(--ag3d-color-primary-700);
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SkipLinkComponent {
  /**
   * ID of the target element to skip to
   */
  @Input() public targetId = 'main-content';

  /**
   * Accessible label for the skip link (defaults to content)
   */
  @Input() public ariaLabel?: string;

  /**
   * Default text content if no ng-content provided
   */
  @Input() public content = 'Skip to main content';

  /**
   * Handle skip link click - move focus to target element
   */
  public onSkipClick(event: Event): void {
    event.preventDefault();
    const target = document.getElementById(this.targetId);

    if (target) {
      // Set tabindex temporarily to allow focus
      const originalTabindex = target.getAttribute('tabindex');
      target.setAttribute('tabindex', '-1');

      // Focus the target element
      target.focus();

      // Restore original tabindex after a short delay
      setTimeout(() => {
        if (originalTabindex === null) {
          target.removeAttribute('tabindex');
        } else {
          target.setAttribute('tabindex', originalTabindex);
        }
      }, 100);

      // Scroll to target smoothly
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  }
}
