import { Injectable, NgZone, OnDestroy, inject } from '@angular/core';

/**
 * RenderLoopService provides a single, shared requestAnimationFrame loop
 * for the entire application. Consumers register callbacks by ID and
 * receive (deltaMs, timestamp) each frame. The loop starts on the first
 * registration and stops automatically when no callbacks remain.
 *
 * The animation loop runs outside Angular's zone to avoid unnecessary
 * change detection. Consumers can use NgZone.run() if they need to
 * trigger Angular updates from a callback.
 */
@Injectable({ providedIn: 'root' })
export class RenderLoopService implements OnDestroy {
  private readonly zone = inject(NgZone);
  private readonly callbacks = new Map<string, (deltaMs: number, ts: number) => void>();
  private rafId: number | null = null;
  private lastTs: number | null = null;
  private running = false;

  /**
   * Register a callback to be invoked each animation frame.
   * @param id Unique identifier for this callback. Registering a duplicate ID throws.
   * @param cb Callback invoked as (deltaMs, timestamp)
   */
  public register(id: string, cb: (deltaMs: number, ts: number) => void): void {
    if (!id) throw new Error('RenderLoopService.register: id is required');
    if (this.callbacks.has(id)) {
      throw new Error(`RenderLoopService.register: id "${id}" already registered`);
    }
    this.callbacks.set(id, cb);
    this.ensureRunning();
  }

  /**
   * Unregister a previously registered callback.
   * @param id The identifier used at registration time
   */
  public unregister(id: string): void {
    this.callbacks.delete(id);
    if (this.callbacks.size === 0) {
      this.stop();
    }
  }

  /** Returns true while the RAF loop is active. */
  public isRunning(): boolean {
    return this.running;
  }

  public ngOnDestroy(): void {
    this.callbacks.clear();
    this.stop();
  }

  private ensureRunning(): void {
    if (this.running) return;
    this.running = true;
    this.lastTs = null;

    this.zone.runOutsideAngular(() => {
      const tick = (ts: number): void => {
        if (!this.running) return;

        const deltaMs = this.lastTs == null ? 0 : ts - this.lastTs;
        this.lastTs = ts;

        // Snapshot callbacks to ensure predictable behavior if the map mutates during iteration.
        const cbs = Array.from(this.callbacks.values());
        for (const cb of cbs) {
          try {
            cb(deltaMs, ts);
          } catch {
            // Swallow errors from consumer callbacks to keep loop resilient.
          }
        }

        this.rafId = requestAnimationFrame(tick);
      };

      this.rafId = requestAnimationFrame(tick);
    });
  }

  private stop(): void {
    if (!this.running) return;
    if (this.rafId != null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.lastTs = null;
    this.running = false;
  }
}
