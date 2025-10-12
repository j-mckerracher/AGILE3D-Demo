import { TestBed } from '@angular/core/testing';
import { ReducedMotionService } from './reduced-motion.service';

describe('ReducedMotionService', () => {
  let service: ReducedMotionService;
  let mockMediaQueryList: Partial<MediaQueryList>;
  let mediaQueryListeners: ((event: MediaQueryListEvent) => void)[] = [];

  beforeEach(() => {
    // Reset listeners array
    mediaQueryListeners = [];

    // Create a mock MediaQueryList
    mockMediaQueryList = {
      matches: false,
      media: '(prefers-reduced-motion: reduce)',
      addEventListener: jasmine
        .createSpy('addEventListener')
        .and.callFake((event: string, listener: (event: MediaQueryListEvent) => void) => {
          mediaQueryListeners.push(listener);
        }),
      removeEventListener: jasmine.createSpy('removeEventListener'),
    };

    // Mock window.matchMedia
    spyOn(window, 'matchMedia').and.returnValue(mockMediaQueryList as MediaQueryList);

    TestBed.configureTestingModule({});
    service = TestBed.inject(ReducedMotionService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('initialization', () => {
    it('should query prefers-reduced-motion media query', () => {
      expect(window.matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
    });

    it('should set up event listener for media query changes', () => {
      expect(mockMediaQueryList.addEventListener).toHaveBeenCalledWith(
        'change',
        jasmine.any(Function)
      );
    });

    it('should initialize signal with current media query value', () => {
      expect(service.prefersReducedMotion()).toBe(false);
    });
  });

  describe('prefersReducedMotion signal', () => {
    it('should return false when user does not prefer reduced motion', () => {
      expect(service.prefersReducedMotion()).toBe(false);
    });

    it('should return true when user prefers reduced motion', () => {
      // Create new service with reduced motion enabled
      mockMediaQueryList.matches = true;
      const reducedMotionService = new ReducedMotionService();
      expect(reducedMotionService.prefersReducedMotion()).toBe(true);
    });

    it('should update when media query changes', () => {
      expect(service.prefersReducedMotion()).toBe(false);

      // Simulate media query change
      const event = { matches: true } as MediaQueryListEvent;
      mediaQueryListeners.forEach((listener) => listener(event));

      expect(service.prefersReducedMotion()).toBe(true);
    });
  });

  describe('animationsEnabled computed signal', () => {
    it('should return true when reduced motion is not preferred', () => {
      expect(service.animationsEnabled()).toBe(true);
    });

    it('should return false when reduced motion is preferred', () => {
      // Simulate media query change to reduced motion
      const event = { matches: true } as MediaQueryListEvent;
      mediaQueryListeners.forEach((listener) => listener(event));

      expect(service.animationsEnabled()).toBe(false);
    });
  });

  describe('prefersReducedMotion$ observable', () => {
    it('should emit current value on subscription', (done) => {
      service.prefersReducedMotion$.subscribe((reduced) => {
        expect(reduced).toBe(false);
        done();
      });
    });

    it('should emit when media query changes', (done) => {
      const values: boolean[] = [];

      service.prefersReducedMotion$.subscribe((reduced) => {
        values.push(reduced);

        if (values.length === 2) {
          expect(values).toEqual([false, true]);
          done();
        }
      });

      // Simulate media query change
      setTimeout(() => {
        const event = { matches: true } as MediaQueryListEvent;
        mediaQueryListeners.forEach((listener) => listener(event));
      }, 10);
    });

    it('should be shared among multiple subscribers', (done) => {
      const subscriber1Values: boolean[] = [];
      const subscriber2Values: boolean[] = [];

      service.prefersReducedMotion$.subscribe((reduced) => {
        subscriber1Values.push(reduced);
      });

      service.prefersReducedMotion$.subscribe((reduced) => {
        subscriber2Values.push(reduced);

        if (subscriber2Values.length === 2) {
          expect(subscriber1Values).toEqual([false, true]);
          expect(subscriber2Values).toEqual([false, true]);
          done();
        }
      });

      // Simulate media query change
      setTimeout(() => {
        const event = { matches: true } as MediaQueryListEvent;
        mediaQueryListeners.forEach((listener) => listener(event));
      }, 10);
    });
  });

  describe('getCurrentPreference', () => {
    it('should return current media query value', () => {
      expect(service.getCurrentPreference()).toBe(false);
    });

    it('should return true when reduced motion is preferred', () => {
      mockMediaQueryList.matches = true;
      expect(service.getCurrentPreference()).toBe(true);
    });
  });

  describe('getAnimationDuration', () => {
    it('should return normal duration when reduced motion is not preferred', () => {
      expect(service.getAnimationDuration(500)).toBe(500);
      expect(service.getAnimationDuration(1000)).toBe(1000);
    });

    it('should return 0 when reduced motion is preferred', () => {
      // Simulate reduced motion preference
      const event = { matches: true } as MediaQueryListEvent;
      mediaQueryListeners.forEach((listener) => listener(event));

      expect(service.getAnimationDuration(500)).toBe(0);
      expect(service.getAnimationDuration(1000)).toBe(0);
    });
  });

  describe('getAnimationSpeed', () => {
    it('should return 1 when reduced motion is not preferred', () => {
      expect(service.getAnimationSpeed()).toBe(1);
    });

    it('should return 0 when reduced motion is preferred', () => {
      // Simulate reduced motion preference
      const event = { matches: true } as MediaQueryListEvent;
      mediaQueryListeners.forEach((listener) => listener(event));

      expect(service.getAnimationSpeed()).toBe(0);
    });

    it('should be useful for Three.js timeScale', () => {
      // Mock Three.js mixer
      const mockMixer = { timeScale: 1 };

      // Apply animation speed
      mockMixer.timeScale = service.getAnimationSpeed();
      expect(mockMixer.timeScale).toBe(1);

      // Simulate reduced motion
      const event = { matches: true } as MediaQueryListEvent;
      mediaQueryListeners.forEach((listener) => listener(event));

      mockMixer.timeScale = service.getAnimationSpeed();
      expect(mockMixer.timeScale).toBe(0);
    });
  });
});
