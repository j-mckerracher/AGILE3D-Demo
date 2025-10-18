import { Injectable, signal, computed } from '@angular/core';
import { fromEvent, Observable } from 'rxjs';
import { map, startWith, shareReplay } from 'rxjs/operators';

/**
 * Service to detect and respond to user's prefers-reduced-motion setting.
 * Provides both signal-based and Observable-based APIs for components to adapt animations.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
 * @see WCAG 2.1 Success Criterion 2.3.3 Animation from Interactions
 */
@Injectable({
  providedIn: 'root',
})
export class ReducedMotionService {
  private readonly mediaQuery: MediaQueryList;
  private readonly reducedMotionSignal = signal<boolean>(false);

  /**
   * Signal indicating whether the user prefers reduced motion.
   * Use this in components with Angular signals for reactive updates.
   *
   * @example
   * ```typescript
   * constructor(private reducedMotion: ReducedMotionService) {
   *   effect(() => {
   *     if (this.reducedMotion.prefersReducedMotion()) {
   *       this.disableAnimations();
   *     }
   *   });
   * }
   * ```
   */
  public readonly prefersReducedMotion = this.reducedMotionSignal.asReadonly();

  /**
   * Computed signal that returns true if animations should be enabled.
   * Inverse of prefersReducedMotion for convenience.
   */
  public readonly animationsEnabled = computed(() => !this.reducedMotionSignal());

  /**
   * Observable stream of reduced motion preference changes.
   * Use this for RxJS-based reactive patterns.
   *
   * @example
   * ```typescript
   * this.reducedMotion.prefersReducedMotion$
   *   .pipe(takeUntil(this.destroy$))
   *   .subscribe(reduced => {
   *     this.animationSpeed = reduced ? 0 : 1;
   *   });
   * ```
   */
  public readonly prefersReducedMotion$: Observable<boolean>;

  public constructor() {
    // Create media query list for prefers-reduced-motion
    this.mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    // Initialize signal with current value
    this.reducedMotionSignal.set(this.mediaQuery.matches);

    // Create observable from media query changes
    this.prefersReducedMotion$ = fromEvent<MediaQueryListEvent>(this.mediaQuery, 'change').pipe(
      map((event) => event.matches),
      startWith(this.mediaQuery.matches),
      shareReplay(1)
    );

    // Update signal when media query changes
    this.mediaQuery.addEventListener('change', (event) => {
      this.reducedMotionSignal.set(event.matches);
    });
  }

  /**
   * Returns the current reduced motion preference synchronously.
   * Useful for one-time checks without subscribing.
   *
   * @returns true if user prefers reduced motion, false otherwise
   */
  public getCurrentPreference(): boolean {
    return this.reducedMotionSignal();
  }

  /**
   * Returns animation duration based on user preference.
   * Returns 0 if reduced motion is preferred, otherwise returns the provided duration.
   *
   * @param normalDuration - Duration in milliseconds when animations are enabled
   * @returns 0 if reduced motion preferred, normalDuration otherwise
   *
   * @example
   * ```typescript
   * const duration = this.reducedMotion.getAnimationDuration(500); // 0 or 500
   * ```
   */
  public getAnimationDuration(normalDuration: number): number {
    return this.reducedMotionSignal() ? 0 : normalDuration;
  }

  /**
   * Returns animation speed multiplier based on user preference.
   * Returns 0 if reduced motion is preferred, otherwise returns 1.
   * Useful for Three.js animations.
   *
   * @returns 0 if reduced motion preferred, 1 otherwise
   *
   * @example
   * ```typescript
   * const speed = this.reducedMotion.getAnimationSpeed();
   * this.mixer.timeScale = speed; // Pause animations if reduced motion
   * ```
   */
  public getAnimationSpeed(): number {
    return this.reducedMotionSignal() ? 0 : 1;
  }
}
