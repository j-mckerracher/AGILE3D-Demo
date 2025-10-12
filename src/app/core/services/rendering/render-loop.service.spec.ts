import { TestBed } from '@angular/core/testing';
import { RenderLoopService } from './render-loop.service';

describe('RenderLoopService', () => {
  let originalRAF: typeof requestAnimationFrame;
  let originalCAF: typeof cancelAnimationFrame;

  beforeAll(() => {
    // Shim RAF/CAF with setTimeout/clearTimeout to avoid flakiness in Karma.
    originalRAF = window.requestAnimationFrame.bind(window);
    originalCAF = window.cancelAnimationFrame.bind(window);

    window.requestAnimationFrame = ((cb: FrameRequestCallback): number => {
      const handle = window.setTimeout(() => cb(Date.now()), 16);
      return handle as unknown as number;
    }) as typeof requestAnimationFrame;

    window.cancelAnimationFrame = ((handle: number): void => {
      window.clearTimeout(handle as unknown as number);
    }) as unknown as typeof cancelAnimationFrame;
  });

  afterAll(() => {
    window.requestAnimationFrame = originalRAF;
    window.cancelAnimationFrame = originalCAF;
  });

  let service: RenderLoopService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RenderLoopService);
  });

  it('starts on first register and stops on last unregister', (done) => {
    let calls = 0;
    const id = 't1';

    service.register(id, () => {
      calls++;
    });

    expect(service.isRunning()).toBeTrue();

    setTimeout(() => {
      expect(calls).toBeGreaterThan(0);

      service.unregister(id);
      expect(service.isRunning()).toBeFalse();

      const prev = calls;
      setTimeout(() => {
        expect(calls).toBe(prev); // no more calls after stop
        done();
      }, 40);
    }, 50);
  });

  it('callbacks receive delta and timestamp', (done) => {
    let firstDelta: number | null = null;
    let laterDelta: number | null = null;
    let gotTs = false;

    const id = 't2';
    let count = 0;

    service.register(id, (delta, ts) => {
      count++;
      if (count === 1) {
        firstDelta = delta;
        gotTs = typeof ts === 'number';
      } else if (count === 2) {
        laterDelta = delta;
        service.unregister(id);
      }
    });

    setTimeout(() => {
      expect(firstDelta).toBe(0);
      expect(laterDelta).not.toBeNull();
      expect(laterDelta as number).toBeGreaterThan(0);
      expect(gotTs).toBeTrue();
      done();
    }, 60);
  });

  it('supports unregister during a frame (predictable behavior)', (done) => {
    const idA = 'a';
    const idB = 'b';

    let aCalls = 0;
    let bCalls = 0;

    service.register(idA, () => {
      aCalls++;
      if (aCalls === 1) {
        service.unregister(idA);
      }
    });

    service.register(idB, () => {
      bCalls++;
      if (bCalls >= 3) {
        service.unregister(idB);
      }
    });

    setTimeout(() => {
      expect(aCalls).toBe(1); // called once then unregistered
      expect(bCalls).toBeGreaterThanOrEqual(3);
      expect(service.isRunning()).toBeFalse();
      done();
    }, 120);
  });

  it('enforces unique IDs', () => {
    const id = 'dup';
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    service.register(id, () => {});
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    expect(() => service.register(id, () => {})).toThrow();
    service.unregister(id);
  });
});
