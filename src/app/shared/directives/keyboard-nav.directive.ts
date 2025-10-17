/**
 * Keyboard Navigation Directive
 *
 * Implements roving tabindex pattern for enhanced keyboard navigation.
 * Allows arrow key navigation within a group of focusable elements.
 *
 * PRD References:
 * - NFR-3.4: Keyboard navigation support
 * - NFR-3.6: Keyboard navigation with logical tab order
 *
 * Usage:
 * <div appKeyboardNav [navItems]="'.nav-item'" [orientation]="'horizontal'">
 *   <button class="nav-item">Item 1</button>
 *   <button class="nav-item">Item 2</button>
 *   <button class="nav-item">Item 3</button>
 * </div>
 */

import {
  Directive,
  ElementRef,
  HostListener,
  Input,
  AfterViewInit,
  OnDestroy,
} from '@angular/core';

export type NavigationOrientation = 'horizontal' | 'vertical' | 'both';

@Directive({
  selector: '[appKeyboardNav]',
  standalone: true,
})
export class KeyboardNavDirective implements AfterViewInit, OnDestroy {
  /**
   * CSS selector for navigable items within the host element
   */
  @Input() public navItems = '[role="button"], button, a';

  /**
   * Navigation orientation (horizontal, vertical, or both)
   */
  @Input() public orientation: NavigationOrientation = 'horizontal';

  /**
   * Whether to wrap focus to the beginning/end
   */
  @Input() public wrap = true;

  /**
   * Home/End key support
   */
  @Input() public homeEndKeys = true;

  private focusableElements: HTMLElement[] = [];
  private currentIndex = 0;
  private mutationObserver?: MutationObserver;

  constructor(private elementRef: ElementRef<HTMLElement>) {}

  public ngAfterViewInit(): void {
    this.updateFocusableElements();
    this.initializeTabindex();
    this.observeMutations();
  }

  public ngOnDestroy(): void {
    this.mutationObserver?.disconnect();
  }

  /**
   * Handle keyboard events for navigation
   */
  @HostListener('keydown', ['$event'])
  public onKeyDown(event: KeyboardEvent): void {
    if (this.focusableElements.length === 0) return;

    const target = event.target as HTMLElement;
    const currentElementIndex = this.focusableElements.indexOf(target);

    if (currentElementIndex === -1) return;

    let handled = false;
    let newIndex = currentElementIndex;

    // Horizontal navigation
    if (this.orientation === 'horizontal' || this.orientation === 'both') {
      if (event.key === 'ArrowRight') {
        newIndex = this.getNextIndex(currentElementIndex);
        handled = true;
      } else if (event.key === 'ArrowLeft') {
        newIndex = this.getPreviousIndex(currentElementIndex);
        handled = true;
      }
    }

    // Vertical navigation
    if (this.orientation === 'vertical' || this.orientation === 'both') {
      if (event.key === 'ArrowDown') {
        newIndex = this.getNextIndex(currentElementIndex);
        handled = true;
      } else if (event.key === 'ArrowUp') {
        newIndex = this.getPreviousIndex(currentElementIndex);
        handled = true;
      }
    }

    // Home/End keys
    if (this.homeEndKeys) {
      if (event.key === 'Home') {
        newIndex = 0;
        handled = true;
      } else if (event.key === 'End') {
        newIndex = this.focusableElements.length - 1;
        handled = true;
      }
    }

    if (handled) {
      event.preventDefault();
      this.moveFocus(newIndex);
    }
  }

  /**
   * Get next valid index
   */
  private getNextIndex(currentIndex: number): number {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= this.focusableElements.length) {
      return this.wrap ? 0 : currentIndex;
    }
    return nextIndex;
  }

  /**
   * Get previous valid index
   */
  private getPreviousIndex(currentIndex: number): number {
    const prevIndex = currentIndex - 1;
    if (prevIndex < 0) {
      return this.wrap ? this.focusableElements.length - 1 : currentIndex;
    }
    return prevIndex;
  }

  /**
   * Move focus to element at specified index
   */
  private moveFocus(index: number): void {
    if (index < 0 || index >= this.focusableElements.length) return;

    // Update tabindex values
    this.focusableElements.forEach((el, i) => {
      el.setAttribute('tabindex', i === index ? '0' : '-1');
    });

    // Focus the element
    this.focusableElements[index]?.focus();
    this.currentIndex = index;
  }

  /**
   * Update list of focusable elements
   */
  private updateFocusableElements(): void {
    const host = this.elementRef.nativeElement;
    const elements = Array.from(host.querySelectorAll<HTMLElement>(this.navItems));

    this.focusableElements = elements.filter(
      (el) =>
        !el.hasAttribute('disabled') &&
        el.getAttribute('aria-hidden') !== 'true' &&
        getComputedStyle(el).display !== 'none'
    );
  }

  /**
   * Initialize tabindex for roving pattern
   */
  private initializeTabindex(): void {
    if (this.focusableElements.length === 0) return;

    // Find currently focused element or use first element
    const focusedElement = this.focusableElements.find((el) => el === document.activeElement);
    const initialIndex = focusedElement
      ? this.focusableElements.indexOf(focusedElement)
      : 0;

    this.focusableElements.forEach((el, index) => {
      el.setAttribute('tabindex', index === initialIndex ? '0' : '-1');
    });

    this.currentIndex = initialIndex;
  }

  /**
   * Observe DOM mutations to update focusable elements
   */
  private observeMutations(): void {
    this.mutationObserver = new MutationObserver(() => {
      this.updateFocusableElements();
      this.initializeTabindex();
    });

    this.mutationObserver.observe(this.elementRef.nativeElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['disabled', 'aria-hidden', 'style'],
    });
  }
}
