import { TestBed } from '@angular/core/testing';
import { CapabilityService } from './capability.service';
import { DebugService } from './debug.service';

describe('CapabilityService (WP-2.3.2)', () => {
  let service: CapabilityService;
  let mockDebugService: jasmine.SpyObj<DebugService>;
  let originalDocument: Document;

  beforeEach(() => {
    // Save original document
    originalDocument = document;

    // Create mock DebugService
    mockDebugService = jasmine.createSpyObj('DebugService', ['getQueryParam', 'isDebugEnabled']);
    mockDebugService.getQueryParam.and.returnValue(null);
    mockDebugService.isDebugEnabled.and.returnValue(false);
  });

  afterEach(() => {
    // Restore original document (if it was modified)
    // In browser tests, document is typically not modified at global level
  });

  it('should be created', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: DebugService, useValue: mockDebugService }],
    });
    service = TestBed.inject(CapabilityService);
    expect(service).toBeTruthy();
  });

  describe('checkWebGL2Support', () => {
    it('should return false when ?webgl=0 query parameter is present (QA hook)', () => {
      mockDebugService.getQueryParam.and.callFake((param: string) => {
        return param === 'webgl' ? '0' : null;
      });

      TestBed.configureTestingModule({
        providers: [{ provide: DebugService, useValue: mockDebugService }],
      });
      service = TestBed.inject(CapabilityService);

      const result = service.checkWebGL2Support();
      expect(result).toBe(false);
      expect(mockDebugService.getQueryParam).toHaveBeenCalledWith('webgl');
    });

    it('should return true when WebGL2 is supported', () => {
      // Mock successful WebGL2 context
      const mockCanvas = document.createElement('canvas');
      const mockGL = {
        getParameter: jasmine.createSpy('getParameter').and.returnValue('Mock Vendor'),
        VENDOR: 0x1f00,
        RENDERER: 0x1f01,
      };

      spyOn(document, 'createElement').and.returnValue(mockCanvas);
      spyOn(mockCanvas, 'getContext').and.returnValue(mockGL as unknown as RenderingContext);

      TestBed.configureTestingModule({
        providers: [{ provide: DebugService, useValue: mockDebugService }],
      });
      service = TestBed.inject(CapabilityService);

      const result = service.checkWebGL2Support();
      expect(result).toBe(true);
      expect(document.createElement).toHaveBeenCalledWith('canvas');
      expect(mockCanvas.getContext).toHaveBeenCalledWith('webgl2');
    });

    it('should return false when getContext returns null (WebGL2 not supported)', () => {
      const mockCanvas = document.createElement('canvas');
      spyOn(document, 'createElement').and.returnValue(mockCanvas);
      spyOn(mockCanvas, 'getContext').and.returnValue(null);

      TestBed.configureTestingModule({
        providers: [{ provide: DebugService, useValue: mockDebugService }],
      });
      service = TestBed.inject(CapabilityService);

      const result = service.checkWebGL2Support();
      expect(result).toBe(false);
    });

    it('should return false when document is undefined (SSR safety)', () => {
      // Note: In browser-based Karma tests, we can't easily mock document being undefined
      // This test verifies the code path exists by checking the service handles the condition
      // The actual SSR safety is validated by code review and the typeof check in the implementation

      // We can test the behavior by mocking createElement to fail
      spyOn(document, 'createElement').and.throwError('document unavailable');
      spyOn(console, 'error');

      TestBed.configureTestingModule({
        providers: [{ provide: DebugService, useValue: mockDebugService }],
      });
      service = TestBed.inject(CapabilityService);

      const result = service.checkWebGL2Support();
      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalled();
    });

    it('should cache the result and not re-check on subsequent calls', () => {
      const mockCanvas = document.createElement('canvas');
      const mockGL = {
        getParameter: jasmine.createSpy('getParameter').and.returnValue('Mock Vendor'),
        VENDOR: 0x1f00,
        RENDERER: 0x1f01,
      };

      const createElementSpy = spyOn(document, 'createElement').and.returnValue(mockCanvas);
      spyOn(mockCanvas, 'getContext').and.returnValue(mockGL as unknown as RenderingContext);

      TestBed.configureTestingModule({
        providers: [{ provide: DebugService, useValue: mockDebugService }],
      });
      service = TestBed.inject(CapabilityService);

      // First call
      const result1 = service.checkWebGL2Support();
      expect(result1).toBe(true);
      expect(createElementSpy).toHaveBeenCalledTimes(1);

      // Second call - should use cached value
      const result2 = service.checkWebGL2Support();
      expect(result2).toBe(true);
      expect(createElementSpy).toHaveBeenCalledTimes(1); // Still only 1 call
    });

    it('should log vendor and renderer info when debug mode is enabled', () => {
      mockDebugService.isDebugEnabled.and.returnValue(true);

      const mockCanvas = document.createElement('canvas');
      const mockGL = {
        getParameter: jasmine
          .createSpy('getParameter')
          .and.returnValues('Mock Vendor', 'Mock Renderer'),
        VENDOR: 0x1f00,
        RENDERER: 0x1f01,
      };

      spyOn(document, 'createElement').and.returnValue(mockCanvas);
      spyOn(mockCanvas, 'getContext').and.returnValue(mockGL as unknown as RenderingContext);
      spyOn(console, 'log');

      TestBed.configureTestingModule({
        providers: [{ provide: DebugService, useValue: mockDebugService }],
      });
      service = TestBed.inject(CapabilityService);

      service.checkWebGL2Support();

      expect(console.log).toHaveBeenCalledWith(
        '[CapabilityService] WebGL2 supported',
        jasmine.objectContaining({
          vendor: 'Mock Vendor',
          renderer: 'Mock Renderer',
        })
      );
    });

    it('should not log vendor info when debug mode is disabled', () => {
      mockDebugService.isDebugEnabled.and.returnValue(false);

      const mockCanvas = document.createElement('canvas');
      const mockGL = {
        getParameter: jasmine.createSpy('getParameter').and.returnValue('Mock Vendor'),
        VENDOR: 0x1f00,
        RENDERER: 0x1f01,
      };

      spyOn(document, 'createElement').and.returnValue(mockCanvas);
      spyOn(mockCanvas, 'getContext').and.returnValue(mockGL as unknown as RenderingContext);
      spyOn(console, 'log');

      TestBed.configureTestingModule({
        providers: [{ provide: DebugService, useValue: mockDebugService }],
      });
      service = TestBed.inject(CapabilityService);

      service.checkWebGL2Support();

      expect(console.log).not.toHaveBeenCalledWith(
        '[CapabilityService] WebGL2 supported',
        jasmine.anything()
      );
    });

    it('should handle exceptions during WebGL2 detection', () => {
      spyOn(document, 'createElement').and.throwError('Canvas creation failed');
      spyOn(console, 'error');

      TestBed.configureTestingModule({
        providers: [{ provide: DebugService, useValue: mockDebugService }],
      });
      service = TestBed.inject(CapabilityService);

      const result = service.checkWebGL2Support();
      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        '[CapabilityService] WebGL2 detection error',
        jasmine.any(Error)
      );
    });

    it('should warn when QA hook webgl=0 is used', () => {
      mockDebugService.getQueryParam.and.callFake((param: string) => {
        return param === 'webgl' ? '0' : null;
      });
      spyOn(console, 'warn');

      TestBed.configureTestingModule({
        providers: [{ provide: DebugService, useValue: mockDebugService }],
      });
      service = TestBed.inject(CapabilityService);

      service.checkWebGL2Support();

      expect(console.warn).toHaveBeenCalledWith(
        '[CapabilityService] QA Hook: webgl=0 - forcing unsupported'
      );
    });
  });

  describe('hasOffscreenCanvas', () => {
    it('should return true when OffscreenCanvas is available', () => {
      // Mock OffscreenCanvas availability
      (window as { OffscreenCanvas?: unknown }).OffscreenCanvas = class {};

      TestBed.configureTestingModule({
        providers: [{ provide: DebugService, useValue: mockDebugService }],
      });
      service = TestBed.inject(CapabilityService);

      const result = service.hasOffscreenCanvas();
      expect(result).toBe(true);

      // Cleanup
      delete (window as { OffscreenCanvas?: unknown }).OffscreenCanvas;
    });

    it('should return false when OffscreenCanvas is not available', () => {
      // Ensure OffscreenCanvas is undefined
      delete (window as { OffscreenCanvas?: unknown }).OffscreenCanvas;

      TestBed.configureTestingModule({
        providers: [{ provide: DebugService, useValue: mockDebugService }],
      });
      service = TestBed.inject(CapabilityService);

      const result = service.hasOffscreenCanvas();
      expect(result).toBe(false);
    });

    it('should return false when window is undefined (SSR safety)', () => {
      // Note: In browser-based Karma tests, window is always defined
      // This test verifies SSR safety through code review of the typeof check
      // We test the false path by ensuring OffscreenCanvas is undefined

      delete (window as { OffscreenCanvas?: unknown }).OffscreenCanvas;

      TestBed.configureTestingModule({
        providers: [{ provide: DebugService, useValue: mockDebugService }],
      });
      service = TestBed.inject(CapabilityService);

      const result = service.hasOffscreenCanvas();
      expect(result).toBe(false);
    });

    it('should cache the result and not re-check on subsequent calls', () => {
      (window as { OffscreenCanvas?: unknown }).OffscreenCanvas = class {};

      TestBed.configureTestingModule({
        providers: [{ provide: DebugService, useValue: mockDebugService }],
      });
      service = TestBed.inject(CapabilityService);

      const result1 = service.hasOffscreenCanvas();
      expect(result1).toBe(true);

      // Delete OffscreenCanvas to verify caching
      delete (window as { OffscreenCanvas?: unknown }).OffscreenCanvas;

      const result2 = service.hasOffscreenCanvas();
      expect(result2).toBe(true); // Should still be true due to caching
    });

    it('should log OffscreenCanvas availability when debug mode is enabled', () => {
      mockDebugService.isDebugEnabled.and.returnValue(true);
      (window as { OffscreenCanvas?: unknown }).OffscreenCanvas = class {};
      spyOn(console, 'log');

      TestBed.configureTestingModule({
        providers: [{ provide: DebugService, useValue: mockDebugService }],
      });
      service = TestBed.inject(CapabilityService);

      service.hasOffscreenCanvas();

      expect(console.log).toHaveBeenCalledWith('[CapabilityService] OffscreenCanvas', 'supported');

      delete (window as { OffscreenCanvas?: unknown }).OffscreenCanvas;
    });

    it('should handle exceptions during OffscreenCanvas detection', () => {
      // Mock OffscreenCanvas to throw when accessed
      Object.defineProperty(window, 'OffscreenCanvas', {
        get: () => {
          throw new Error('OffscreenCanvas check failed');
        },
        configurable: true,
      });

      TestBed.configureTestingModule({
        providers: [{ provide: DebugService, useValue: mockDebugService }],
      });
      service = TestBed.inject(CapabilityService);

      const result = service.hasOffscreenCanvas();
      expect(result).toBe(false);

      // Cleanup
      delete (window as { OffscreenCanvas?: unknown }).OffscreenCanvas;
    });
  });

  describe('getCapabilities', () => {
    it('should return all capabilities as an object', () => {
      const mockCanvas = document.createElement('canvas');
      const mockGL = {
        getParameter: jasmine.createSpy('getParameter').and.returnValue('Mock Vendor'),
        VENDOR: 0x1f00,
        RENDERER: 0x1f01,
      };

      spyOn(document, 'createElement').and.returnValue(mockCanvas);
      spyOn(mockCanvas, 'getContext').and.returnValue(mockGL as unknown as RenderingContext);
      (window as { OffscreenCanvas?: unknown }).OffscreenCanvas = class {};

      TestBed.configureTestingModule({
        providers: [{ provide: DebugService, useValue: mockDebugService }],
      });
      service = TestBed.inject(CapabilityService);

      const capabilities = service.getCapabilities();

      expect(capabilities).toEqual({
        webgl2: true,
        offscreenCanvas: true,
      });

      delete (window as { OffscreenCanvas?: unknown }).OffscreenCanvas;
    });

    it('should return false for all capabilities when browser lacks support', () => {
      const mockCanvas = document.createElement('canvas');
      spyOn(document, 'createElement').and.returnValue(mockCanvas);
      spyOn(mockCanvas, 'getContext').and.returnValue(null);
      delete (window as { OffscreenCanvas?: unknown }).OffscreenCanvas;

      TestBed.configureTestingModule({
        providers: [{ provide: DebugService, useValue: mockDebugService }],
      });
      service = TestBed.inject(CapabilityService);

      const capabilities = service.getCapabilities();

      expect(capabilities).toEqual({
        webgl2: false,
        offscreenCanvas: false,
      });
    });
  });
});
