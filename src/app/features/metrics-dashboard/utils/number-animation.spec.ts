import { animateNumber, formatMetricValue } from './number-animation';

describe('number-animation utility', () => {
  describe('animateNumber', () => {
    it('should call onUpdate immediately when duration is 0', () => {
      const onUpdate = jasmine.createSpy('onUpdate');
      animateNumber(50, 100, 0, 1, onUpdate);

      expect(onUpdate).toHaveBeenCalledWith(100);
    });

    it('should call onUpdate immediately when start equals end', () => {
      const onUpdate = jasmine.createSpy('onUpdate');
      animateNumber(75.5, 75.5, 200, 1, onUpdate);

      expect(onUpdate).toHaveBeenCalledWith(75.5);
    });

    it('should call onUpdate with final value at end of animation', (done) => {
      const onUpdate = jasmine.createSpy('onUpdate');
      animateNumber(0, 100, 50, 0, onUpdate);

      setTimeout(() => {
        const calls = onUpdate.calls.all();
        const lastCall = calls[calls.length - 1];
        expect(lastCall?.args[0]).toBe(100);
        done();
      }, 100);
    });

    it('should respect precision parameter', () => {
      const onUpdate = jasmine.createSpy('onUpdate');
      animateNumber(0, 67.12345, 0, 2, onUpdate);

      expect(onUpdate).toHaveBeenCalledWith(67.12);
    });

    it('should return cleanup function', () => {
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      const cleanup = animateNumber(0, 100, 200, 0, () => {});
      expect(typeof cleanup).toBe('function');
    });

    it('should cancel animation when cleanup is called', (done) => {
      const onUpdate = jasmine.createSpy('onUpdate');
      const cleanup = animateNumber(0, 100, 100, 0, onUpdate);

      // Call cleanup immediately
      cleanup();

      setTimeout(() => {
        // Should only have been called once (initial frame)
        expect(onUpdate.calls.count()).toBeLessThan(3);
        done();
      }, 150);
    });

    it('should cancel animation when AbortSignal is triggered', (done) => {
      const onUpdate = jasmine.createSpy('onUpdate');
      const controller = new AbortController();

      animateNumber(0, 100, 100, 0, onUpdate, controller.signal);

      // Abort after a short delay
      setTimeout(() => {
        controller.abort();
      }, 20);

      setTimeout(() => {
        const initialCount = onUpdate.calls.count();
        // Wait a bit more and verify no more updates
        setTimeout(() => {
          expect(onUpdate.calls.count()).toBe(initialCount);
          done();
        }, 50);
      }, 30);
    });

    it('should animate from lower to higher value', (done) => {
      const values: number[] = [];
      const onUpdate = (value: number): void => {
        values.push(value);
      };

      animateNumber(0, 100, 50, 0, onUpdate);

      setTimeout(() => {
        // Verify values are increasing
        for (let i = 1; i < values.length; i++) {
          const current = values[i];
          const previous = values[i - 1];
          if (current !== undefined && previous !== undefined) {
            expect(current).toBeGreaterThanOrEqual(previous);
          }
        }
        // Verify final value is target
        expect(values[values.length - 1]).toBe(100);
        done();
      }, 100);
    });

    it('should animate from higher to lower value', (done) => {
      const values: number[] = [];
      const onUpdate = (value: number): void => {
        values.push(value);
      };

      animateNumber(100, 0, 50, 0, onUpdate);

      setTimeout(() => {
        // Verify values are decreasing
        for (let i = 1; i < values.length; i++) {
          const current = values[i];
          const previous = values[i - 1];
          if (current !== undefined && previous !== undefined) {
            expect(current).toBeLessThanOrEqual(previous);
          }
        }
        // Verify final value is target
        expect(values[values.length - 1]).toBe(0);
        done();
      }, 100);
    });
  });

  describe('formatMetricValue', () => {
    it('should format value with no unit', () => {
      expect(formatMetricValue(67.123, 1, '')).toBe('67.1');
    });

    it('should format value with unit', () => {
      expect(formatMetricValue(67.123, 1, '%')).toBe('67.1%');
    });

    it('should respect precision parameter', () => {
      expect(formatMetricValue(67.123, 0, '%')).toBe('67%');
      expect(formatMetricValue(67.123, 2, '%')).toBe('67.12%');
      expect(formatMetricValue(67.123, 3, '%')).toBe('67.123%');
    });

    it('should format negative values', () => {
      expect(formatMetricValue(-120.5, 0, ' ms')).toBe('-120 ms');
      expect(formatMetricValue(-120.5, 1, ' ms')).toBe('-120.5 ms');
    });

    it('should format zero', () => {
      expect(formatMetricValue(0, 1, '%')).toBe('0.0%');
    });

    it('should handle large numbers', () => {
      expect(formatMetricValue(1234.567, 2, ' GB')).toBe('1234.57 GB');
    });

    it('should handle very small numbers', () => {
      expect(formatMetricValue(0.001, 3, '')).toBe('0.001');
    });
  });
});
