/**
 * AGILE3D Theme Service - Unit Tests
 *
 * Tests for theme management including:
 * - Theme mode switching
 * - System preference detection
 * - localStorage persistence
 * - Reduced motion handling
 */

import { TestBed } from '@angular/core/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import { ThemeService } from './theme.service';
import { ThemeMode, ActiveTheme } from './theme.models';

describe('ThemeService', () => {
  let service: ThemeService;
  let overlayContainer: OverlayContainer;
  let localStorageMock: Record<string, string>;

  beforeEach(() => {
    // Mock localStorage
    localStorageMock = {};
    const localStorageSpies = {
      getItem: (key: string) => localStorageMock[key] || null,
      setItem: (key: string, value: string) => {
        localStorageMock[key] = value;
      },
      removeItem: (key: string) => {
        delete localStorageMock[key];
      },
      clear: () => {
        localStorageMock = {};
      },
    };

    spyOn(localStorage, 'getItem').and.callFake(localStorageSpies.getItem);
    spyOn(localStorage, 'setItem').and.callFake(localStorageSpies.setItem);
    spyOn(localStorage, 'removeItem').and.callFake(localStorageSpies.removeItem);
    spyOn(localStorage, 'clear').and.callFake(localStorageSpies.clear);

    TestBed.configureTestingModule({
      providers: [ThemeService, OverlayContainer],
    });

    service = TestBed.inject(ThemeService);
    overlayContainer = TestBed.inject(OverlayContainer);
  });

  afterEach(() => {
    localStorageMock = {};
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Theme Mode', () => {
    it('should initialize with system theme mode by default', (done) => {
      service.themeMode$.subscribe((mode) => {
        expect(mode).toBe('system');
        done();
      });
    });

    it('should set light theme mode', (done) => {
      service.setThemeMode('light');

      service.themeMode$.subscribe((mode) => {
        expect(mode).toBe('light');
        done();
      });
    });

    it('should set dark theme mode', (done) => {
      service.setThemeMode('dark');

      service.themeMode$.subscribe((mode) => {
        expect(mode).toBe('dark');
        done();
      });
    });

    it('should persist theme mode to localStorage', () => {
      service.setThemeMode('dark');
      expect(localStorage.setItem).toHaveBeenCalledWith('ag3d-theme-mode', 'dark');
    });

    it('should toggle between light and dark themes', (done) => {
      service.setThemeMode('light');

      service.toggleTheme();

      service.themeMode$.subscribe((mode) => {
        expect(mode).toBe('dark');
        done();
      });
    });

    it('should toggle from dark to light', (done) => {
      service.setThemeMode('dark');

      service.toggleTheme();

      service.themeMode$.subscribe((mode) => {
        expect(mode).toBe('light');
        done();
      });
    });

    it('should get current theme mode', () => {
      service.setThemeMode('dark');
      expect(service.getThemeMode()).toBe('dark');
    });
  });

  describe('Active Theme', () => {
    it('should set active theme to light when mode is light', (done) => {
      service.setThemeMode('light');

      service.activeTheme$.subscribe((theme) => {
        expect(theme).toBe('light');
        done();
      });
    });

    it('should set active theme to dark when mode is dark', (done) => {
      service.setThemeMode('dark');

      service.activeTheme$.subscribe((theme) => {
        expect(theme).toBe('dark');
        done();
      });
    });

    it('should get current active theme', () => {
      service.setThemeMode('light');
      expect(service.getActiveTheme()).toBe('light');
    });

    it('should apply theme class to document element', () => {
      service.setThemeMode('dark');

      const htmlElement = document.documentElement;
      expect(htmlElement.classList.contains('ag3d-theme-dark')).toBe(true);
      expect(htmlElement.classList.contains('ag3d-theme-light')).toBe(false);
    });

    it('should apply theme class to overlay container', () => {
      service.setThemeMode('dark');

      const containerElement = overlayContainer.getContainerElement();
      expect(containerElement.classList.contains('ag3d-theme-dark')).toBe(true);
      expect(containerElement.classList.contains('ag3d-theme-light')).toBe(false);
    });
  });

  describe('Reduced Motion', () => {
    it('should initialize reduced motion as false by default', (done) => {
      service.reducedMotion$.subscribe((reducedMotion) => {
        expect(reducedMotion).toBe(false);
        done();
      });
    });

    it('should enable reduced motion', (done) => {
      service.setReducedMotion(true);

      service.reducedMotion$.subscribe((reducedMotion) => {
        expect(reducedMotion).toBe(true);
        done();
      });
    });

    it('should disable reduced motion', (done) => {
      service.setReducedMotion(true);
      service.setReducedMotion(false);

      service.reducedMotion$.subscribe((reducedMotion) => {
        expect(reducedMotion).toBe(false);
        done();
      });
    });

    it('should persist reduced motion preference to localStorage', () => {
      service.setReducedMotion(true, 'user');
      expect(localStorage.setItem).toHaveBeenCalledWith('ag3d-reduced-motion', 'true');
    });

    it('should toggle reduced motion', (done) => {
      service.setReducedMotion(false);
      service.toggleReducedMotion();

      service.reducedMotion$.subscribe((reducedMotion) => {
        expect(reducedMotion).toBe(true);
        done();
      });
    });

    it('should check if reduced motion is enabled', () => {
      service.setReducedMotion(true);
      expect(service.isReducedMotion()).toBe(true);
    });
  });

  describe('Theme Configuration', () => {
    it('should get theme configuration', () => {
      service.setThemeMode('dark');
      service.setReducedMotion(true);

      const config = service.getThemeConfig();

      expect(config.mode).toBe('dark');
      expect(config.reducedMotion).toBe(true);
    });
  });

  describe('Theme Change Events', () => {
    it('should emit theme change event when theme changes', (done) => {
      service.setThemeMode('light');

      service.themeChange$.subscribe((event) => {
        expect(event.currentTheme).toBe('dark');
        expect(event.previousTheme).toBe('light');
        expect(event.mode).toBe('dark');
        expect(event.timestamp).toBeDefined();
        done();
      });

      service.setThemeMode('dark');
    });
  });

  describe('Reduced Motion Change Events', () => {
    it('should emit reduced motion change event', (done) => {
      service.reducedMotionChange$.subscribe((event) => {
        expect(event.reducedMotion).toBe(true);
        expect(event.source).toBe('user');
        expect(event.timestamp).toBeDefined();
        done();
      });

      service.setReducedMotion(true, 'user');
    });
  });
});
