/**
 * AGILE3D Viewer Style Adapter Service - Unit Tests
 *
 * Tests for CSS-to-Three.js color adaptation.
 */

import { TestBed } from '@angular/core/testing';
import { ViewerStyleAdapterService } from './viewer-style-adapter.service';
import { ThemeService } from './theme.service';
import { OverlayContainer } from '@angular/cdk/overlay';
import { Color } from 'three';

describe('ViewerStyleAdapterService', () => {
  let service: ViewerStyleAdapterService;
  let themeService: ThemeService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ViewerStyleAdapterService, ThemeService, OverlayContainer],
    });

    service = TestBed.inject(ViewerStyleAdapterService);
    themeService = TestBed.inject(ThemeService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Viewer Colors', () => {
    it('should get viewer color configuration', (done) => {
      service.viewerColors$.subscribe((colors) => {
        expect(colors.vehicle).toBeInstanceOf(Color);
        expect(colors.pedestrian).toBeInstanceOf(Color);
        expect(colors.cyclist).toBeInstanceOf(Color);
        expect(colors.background).toBeInstanceOf(Color);
        expect(colors.grid).toBeInstanceOf(Color);
        expect(colors.axisX).toBeInstanceOf(Color);
        expect(colors.axisY).toBeInstanceOf(Color);
        expect(colors.axisZ).toBeInstanceOf(Color);
        done();
      });
    });

    it('should get object class color', () => {
      const vehicleColor = service.getObjectClassColor('vehicle');
      expect(vehicleColor).toBeInstanceOf(Color);
    });

    it('should get object class color info', () => {
      const colorInfo = service.getObjectClassColorInfo('vehicle');

      expect(colorInfo.class).toBe('vehicle');
      expect(colorInfo.hex).toBeDefined();
      expect(colorInfo.hex).toMatch(/^#[0-9a-f]{6}$/i);
      expect(colorInfo.rgb).toBeDefined();
      expect(colorInfo.rgb.r).toBeGreaterThanOrEqual(0);
      expect(colorInfo.rgb.r).toBeLessThanOrEqual(255);
      expect(colorInfo.hsl).toBeDefined();
      expect(colorInfo.hsl.h).toBeGreaterThanOrEqual(0);
      expect(colorInfo.hsl.h).toBeLessThanOrEqual(360);
    });

    it('should get all object class colors', () => {
      const allColors = service.getAllObjectClassColors();

      expect(allColors.length).toBe(3);
      expect(allColors[0]?.class).toBe('vehicle');
      expect(allColors[1]?.class).toBe('pedestrian');
      expect(allColors[2]?.class).toBe('cyclist');
    });
  });

  describe('Viewer Motion Configuration', () => {
    it('should get viewer motion config with motion enabled', (done) => {
      themeService.setReducedMotion(false);

      service.viewerMotion$.subscribe((motion) => {
        expect(motion.enabled).toBe(true);
        expect(motion.cameraDuration).toBeGreaterThan(0);
        expect(motion.cameraEasing).toBeDefined();
        expect(motion.objectDuration).toBeGreaterThan(0);
        expect(motion.objectEasing).toBeDefined();
        done();
      });
    });

    it('should get viewer motion config with motion disabled', (done) => {
      themeService.setReducedMotion(true);

      service.viewerMotion$.subscribe((motion) => {
        expect(motion.enabled).toBe(false);
        expect(motion.cameraDuration).toBe(0.01);
        expect(motion.cameraEasing).toBe('linear');
        expect(motion.objectDuration).toBe(0.01);
        expect(motion.objectEasing).toBe('linear');
        done();
      });
    });

    it('should get motion config directly', () => {
      themeService.setReducedMotion(false);
      const motion = service.getViewerMotionConfig(false);

      expect(motion.enabled).toBe(true);
    });
  });

  describe('Theme Updates', () => {
    it('should update colors when theme changes', (done) => {
      let emissionCount = 0;

      service.viewerColors$.subscribe(() => {
        emissionCount++;
        if (emissionCount === 2) {
          // Second emission after theme change
          done();
        }
      });

      // Trigger theme change
      themeService.setThemeMode('dark');
    });
  });
});
