import { TestBed } from '@angular/core/testing';
import { SceneTierManagerService } from './scene-tier-manager.service';
import { RenderLoopService } from '../rendering/render-loop.service';

describe('SceneTierManagerService', () => {
  let service: SceneTierManagerService;
  let mockRenderLoop: jasmine.SpyObj<RenderLoopService>;

  beforeEach(() => {
    mockRenderLoop = jasmine.createSpyObj('RenderLoopService', ['register', 'unregister']);

    TestBed.configureTestingModule({
      providers: [
        SceneTierManagerService,
        { provide: RenderLoopService, useValue: mockRenderLoop },
      ],
    });

    service = TestBed.inject(SceneTierManagerService);
  });

  describe('initialization', () => {
    it('should start with full tier', () => {
      expect(service.getCurrentTier()).toBe('full');
    });

    it('should have auto tier management enabled by default', () => {
      expect(service.isAutoTierEnabled()).toBe(true);
    });
  });

  describe('manual tier control', () => {
    it('should allow manual tier setting', () => {
      service.setTier('fallback');
      expect(service.getCurrentTier()).toBe('fallback');
    });

    it('should allow switching back to full tier', () => {
      service.setTier('fallback');
      service.setTier('full');
      expect(service.getCurrentTier()).toBe('full');
    });

    it('should not change tier if already set to target', () => {
      const initialTier = service.getCurrentTier();
      service.setTier(initialTier);
      expect(service.getCurrentTier()).toBe(initialTier);
    });
  });

  describe('auto tier management', () => {
    it('should enable/disable auto tier management', () => {
      service.setAutoTierEnabled(false);
      expect(service.isAutoTierEnabled()).toBe(false);

      service.setAutoTierEnabled(true);
      expect(service.isAutoTierEnabled()).toBe(true);
    });

    it('should clear FPS history when disabling auto tier', () => {
      service.setAutoTierEnabled(false);

      const stats = service.getFPSStats();
      expect(stats.sampleCount).toBe(0);
    });
  });

  describe('FPS tracking', () => {
    it('should reset FPS history on demand', () => {
      service.resetFPSHistory();

      const stats = service.getFPSStats();
      expect(stats.sampleCount).toBe(0);
    });
  });

  describe('path resolution', () => {
    it('should return full tier path when on full tier', () => {
      service.setTier('full');
      const path = service.getTierPath('scene_100k.bin');
      expect(path).toBe('scene_100k.bin');
    });

    it('should return fallback tier path when on fallback tier', () => {
      service.setTier('fallback');
      const path = service.getTierPath('scene_100k.bin');
      expect(path).toBe('scene_50k.bin');
    });

    it('should handle complex paths', () => {
      service.setTier('fallback');
      const path = service.getTierPath('assets/scenes/vehicle_heavy_01/vehicle_heavy_01_100k.bin');
      expect(path).toBe('assets/scenes/vehicle_heavy_01/vehicle_heavy_01_50k.bin');
    });
  });

  describe('cache key generation', () => {
    it('should generate cache key with tier', () => {
      service.setTier('full');
      expect(service.getCacheKey('test_scene')).toBe('test_scene:full');

      service.setTier('fallback');
      expect(service.getCacheKey('test_scene')).toBe('test_scene:fallback');
    });

    it('should generate unique keys for different scenes', () => {
      const key1 = service.getCacheKey('scene1');
      const key2 = service.getCacheKey('scene2');
      expect(key1).not.toBe(key2);
    });
  });

  describe('FPS statistics edge cases', () => {
    it('should return zero stats when no samples', () => {
      const stats = service.getFPSStats();
      expect(stats.current).toBe(0);
      expect(stats.average).toBe(0);
      expect(stats.min).toBe(0);
      expect(stats.max).toBe(0);
      expect(stats.sampleCount).toBe(0);
    });
  });
});
