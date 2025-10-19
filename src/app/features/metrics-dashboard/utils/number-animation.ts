/**
 * Number Animation Utility
 *
 * Provides smooth counting animations for metric value updates.
 * Respects user's prefers-reduced-motion setting for accessibility.
 *
 * @see PRD FR-3.6 (Number counting animations)
 * @see PRD NFR-3.7 (Respect prefers-reduced-motion)
 */

/**
 * Easing function for smooth acceleration/deceleration.
 * Uses ease-out cubic curve for natural-feeling animations.
 *
 * @param t - Progress value between 0 and 1
 * @returns Eased progress value between 0 and 1
 */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Animate a number from start value to end value over specified duration.
 *
 * Features:
 * - Smooth easing with ease-out cubic curve
 * - Configurable precision for decimal places
 * - Respects reduced motion (instant update if duration = 0)
 * - Uses requestAnimationFrame for smooth 60fps animation
 * - Cleanup on component destroy via AbortController
 *
 * @param startValue - Initial value
 * @param endValue - Target value
 * @param duration - Animation duration in milliseconds (0 = instant)
 * @param precision - Number of decimal places (default: 1)
 * @param onUpdate - Callback invoked on each frame with interpolated value
 * @param signal - Optional AbortSignal for cancellation
 * @returns Cleanup function to cancel animation
 *
 * @example
 * ```typescript
 * const cleanup = animateNumber(
 *   50.0,
 *   67.5,
 *   200,
 *   1,
 *   (value) => this.displayValue = value
 * );
 * // Later: cleanup() to cancel
 * ```
 */
export function animateNumber(
  startValue: number,
  endValue: number,
  duration: number,
  precision: number,
  onUpdate: (value: number) => void,
  signal?: AbortSignal
): () => void {
  // If duration is 0 (reduced motion) or start equals end, update immediately
  if (duration === 0 || startValue === endValue) {
    onUpdate(Number(endValue.toFixed(precision)));
    // No-op cleanup function
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    return () => {};
  }

  let rafId: number | null = null;
  let startTime: number | null = null;
  let cancelled = false;

  // Listen for abort signal
  if (signal) {
    signal.addEventListener('abort', () => {
      cancelled = true;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    });
  }

  const animate = (timestamp: number): void => {
    if (cancelled) return;

    if (startTime === null) {
      startTime = timestamp;
    }

    const elapsed = timestamp - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easedProgress = easeOutCubic(progress);

    // Interpolate between start and end
    const currentValue = startValue + (endValue - startValue) * easedProgress;
    const roundedValue = Number(currentValue.toFixed(precision));

    onUpdate(roundedValue);

    if (progress < 1) {
      rafId = requestAnimationFrame(animate);
    } else {
      // Ensure we end exactly at target value
      onUpdate(Number(endValue.toFixed(precision)));
      rafId = null;
    }
  };

  rafId = requestAnimationFrame(animate);

  // Return cleanup function
  return () => {
    cancelled = true;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  };
}

/**
 * Format a metric value with appropriate precision and units.
 *
 * @param value - Numeric value to format
 * @param precision - Number of decimal places
 * @param unit - Optional unit suffix (e.g., "%", "ms", "GB")
 * @returns Formatted string
 *
 * @example
 * ```typescript
 * formatMetricValue(67.123, 1, '%')  // "67.1%"
 * formatMetricValue(425, 0, ' ms')   // "425 ms"
 * ```
 */
export function formatMetricValue(
  value: number,
  precision: number,
  unit = ''
): string {
  return `${value.toFixed(precision)}${unit}`;
}
