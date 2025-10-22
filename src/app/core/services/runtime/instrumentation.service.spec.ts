import { TestBed } from '@angular/core/testing';
import { InstrumentationService, SceneToken } from './instrumentation.service';
import { DebugService } from './debug.service';

describe('InstrumentationService (WP-2.3.2)', () => {
  let service: InstrumentationService;
  let mockDebugService: jasmine.SpyObj<DebugService>;

  beforeEach(() => {
    // Create mock DebugService
    mockDebugService = jasmine.createSpyObj('DebugService', ['isDebugEnabled']);
    mockDebugService.isDebugEnabled.and.returnValue(false);

    TestBed.configureTestingModule({
      providers: [InstrumentationService, { provide: DebugService, useValue: mockDebugService }],
    });

    service = TestBed.inject(InstrumentationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should detect Performance API availability', () => {
    // In test environment, performance API should be available
    expect(service.isAvailable()).toBe(true);
  });

  describe('beginSceneSwitch()', () => {
    it('should return a scene token with id and label', () => {
      const token = service.beginSceneSwitch('highway');

      expect(token).toBeDefined();
      expect(token.id).toMatch(/^scene-\d+-[a-z0-9]+$/);
      expect(token.label).toBe('highway');
    });

    it('should use default label "initial" if not provided', () => {
      const token = service.beginSceneSwitch();

      expect(token.label).toBe('initial');
    });

    it('should create a performance mark for scene start', () => {
      spyOn(performance, 'mark');

      const token = service.beginSceneSwitch('test');

      expect(performance.mark).toHaveBeenCalledWith(`${token.id}:start`);
    });

    it('should log when debug mode is enabled', () => {
      mockDebugService.isDebugEnabled.and.returnValue(true);
      spyOn(performance, 'mark');
      spyOn(console, 'info');

      const token = service.beginSceneSwitch('debug-scene');

      expect(console.info).toHaveBeenCalledWith('[Instrumentation] Scene switch started', {
        id: token.id,
        label: 'debug-scene',
      });
    });

    it('should not log when debug mode is disabled', () => {
      mockDebugService.isDebugEnabled.and.returnValue(false);
      spyOn(performance, 'mark');
      spyOn(console, 'info');

      service.beginSceneSwitch('quiet');

      expect(console.info).not.toHaveBeenCalled();
    });

    it('should generate unique token IDs for consecutive calls', () => {
      const token1 = service.beginSceneSwitch('scene1');
      const token2 = service.beginSceneSwitch('scene2');

      expect(token1.id).not.toBe(token2.id);
    });
  });

  describe('markDataLoaded()', () => {
    it('should create a performance mark for data loaded', () => {
      spyOn(performance, 'mark');

      const token: SceneToken = { id: 'test-123', label: 'test' };
      service.markDataLoaded(token);

      expect(performance.mark).toHaveBeenCalledWith('test-123:data-loaded');
    });

    it('should log when debug mode is enabled', () => {
      mockDebugService.isDebugEnabled.and.returnValue(true);
      spyOn(performance, 'mark');
      spyOn(console, 'info');

      const token: SceneToken = { id: 'debug-456', label: 'debug-scene' };
      service.markDataLoaded(token);

      expect(console.info).toHaveBeenCalledWith('[Instrumentation] Data loaded', {
        id: 'debug-456',
        label: 'debug-scene',
      });
    });

    it('should not log when debug mode is disabled', () => {
      mockDebugService.isDebugEnabled.and.returnValue(false);
      spyOn(performance, 'mark');
      spyOn(console, 'info');

      const token: SceneToken = { id: 'quiet-789', label: 'quiet' };
      service.markDataLoaded(token);

      expect(console.info).not.toHaveBeenCalled();
    });
  });

  describe('endSceneSwitch()', () => {
    it('should create performance marks and measure', () => {
      spyOn(performance, 'mark');
      spyOn(performance, 'measure').and.returnValue({
        name: 'scene-switch:test',
        duration: 250.5,
        entryType: 'measure',
        startTime: 0,
        toJSON: () => ({}),
      } as PerformanceMeasure);
      spyOn(performance, 'getEntriesByName').and.returnValue([
        { duration: 250.5 } as PerformanceEntry,
      ]);

      const token: SceneToken = { id: 'test-abc', label: 'test' };
      service.endSceneSwitch(token);

      expect(performance.mark).toHaveBeenCalledWith('test-abc:end');
      expect(performance.measure).toHaveBeenCalledWith(
        'scene-switch:test',
        'test-abc:start',
        'test-abc:end'
      );
    });

    it('should add measurement to history ring buffer', () => {
      spyOn(performance, 'mark');
      spyOn(performance, 'measure').and.returnValue({} as PerformanceMeasure);
      spyOn(performance, 'getEntriesByName').and.returnValue([
        { duration: 300.5 } as PerformanceEntry,
      ]);
      spyOn(performance, 'clearMarks');
      spyOn(performance, 'clearMeasures');

      const token: SceneToken = { id: 'history-test', label: 'highway' };
      service.endSceneSwitch(token);

      const history = service.getRecent();
      expect(history.length).toBe(1);
      expect(history[0]?.label).toBe('highway');
      expect(history[0]?.durationMs).toBe(300.5);
    });

    it('should maintain ring buffer max size of 20', () => {
      spyOn(performance, 'mark');
      spyOn(performance, 'measure').and.returnValue({} as PerformanceMeasure);
      spyOn(performance, 'getEntriesByName').and.returnValue([
        { duration: 100 } as PerformanceEntry,
      ]);
      spyOn(performance, 'clearMarks');
      spyOn(performance, 'clearMeasures');

      // Add 25 entries
      for (let i = 0; i < 25; i++) {
        const token: SceneToken = { id: `test-${i}`, label: `scene-${i}` };
        service.endSceneSwitch(token);
      }

      const history = service.getRecent();
      expect(history.length).toBe(20); // Max size
      expect(history[0]?.label).toBe('scene-5'); // First 5 removed
      expect(history[19]?.label).toBe('scene-24'); // Last entry
    });

    it('should clean up marks and measures after recording', () => {
      spyOn(performance, 'mark');
      spyOn(performance, 'measure').and.returnValue({} as PerformanceMeasure);
      spyOn(performance, 'getEntriesByName').and.returnValue([
        { duration: 150 } as PerformanceEntry,
      ]);
      spyOn(performance, 'clearMarks');
      spyOn(performance, 'clearMeasures');

      const token: SceneToken = { id: 'cleanup-test', label: 'test' };
      service.endSceneSwitch(token);

      expect(performance.clearMarks).toHaveBeenCalledWith('cleanup-test:start');
      expect(performance.clearMarks).toHaveBeenCalledWith('cleanup-test:data-loaded');
      expect(performance.clearMarks).toHaveBeenCalledWith('cleanup-test:end');
      expect(performance.clearMeasures).toHaveBeenCalledWith('scene-switch:test');
    });

    it('should log when debug mode is enabled', () => {
      mockDebugService.isDebugEnabled.and.returnValue(true);
      spyOn(performance, 'mark');
      spyOn(performance, 'measure').and.returnValue({} as PerformanceMeasure);
      spyOn(performance, 'getEntriesByName').and.returnValue([
        { duration: 420.75 } as PerformanceEntry,
      ]);
      spyOn(performance, 'clearMarks');
      spyOn(performance, 'clearMeasures');
      spyOn(console, 'info');

      const token: SceneToken = { id: 'log-test', label: 'mixed' };
      service.endSceneSwitch(token);

      expect(console.info).toHaveBeenCalledWith('[Instrumentation] Scene switch completed', {
        id: 'log-test',
        label: 'mixed',
        durationMs: '420.75',
        measure: 'scene-switch:mixed',
      });
    });

    it('should handle errors during measurement gracefully', () => {
      spyOn(performance, 'mark');
      spyOn(performance, 'measure').and.throwError('Measurement error');
      spyOn(console, 'error');

      const token: SceneToken = { id: 'error-test', label: 'error' };

      expect(() => service.endSceneSwitch(token)).not.toThrow();
      expect(console.error).toHaveBeenCalledWith(
        '[Instrumentation] Failed to measure scene switch',
        jasmine.any(Error)
      );
    });

    it('should log when Performance API is unavailable', () => {
      // Mock unavailable Performance API
      (service as any).performanceAvailable = false;
      mockDebugService.isDebugEnabled.and.returnValue(true);
      spyOn(console, 'info');

      const token: SceneToken = { id: 'no-perf', label: 'test' };
      service.endSceneSwitch(token);

      expect(console.info).toHaveBeenCalledWith(
        '[Instrumentation] Scene switch completed (no timing)',
        { id: 'no-perf', label: 'test' }
      );
    });
  });

  describe('getRecent()', () => {
    it('should return empty array initially', () => {
      const history = service.getRecent();
      expect(history).toEqual([]);
    });

    it('should return copy of history array (immutable)', () => {
      spyOn(performance, 'mark');
      spyOn(performance, 'measure').and.returnValue({} as PerformanceMeasure);
      spyOn(performance, 'getEntriesByName').and.returnValue([
        { duration: 100 } as PerformanceEntry,
      ]);
      spyOn(performance, 'clearMarks');
      spyOn(performance, 'clearMeasures');

      const token = service.beginSceneSwitch('test');
      service.endSceneSwitch(token);

      const history1 = service.getRecent();
      const history2 = service.getRecent();

      expect(history1).not.toBe(history2); // Different array instances
      expect(history1).toEqual(history2); // Same content
    });

    it('should return records in FIFO order', () => {
      spyOn(performance, 'mark');
      spyOn(performance, 'measure').and.returnValue({} as PerformanceMeasure);
      spyOn(performance, 'getEntriesByName').and.returnValue([
        { duration: 100 } as PerformanceEntry,
      ]);
      spyOn(performance, 'clearMarks');
      spyOn(performance, 'clearMeasures');

      const token1 = service.beginSceneSwitch('first');
      service.endSceneSwitch(token1);

      const token2 = service.beginSceneSwitch('second');
      service.endSceneSwitch(token2);

      const history = service.getRecent();
      expect(history[0]?.label).toBe('first');
      expect(history[1]?.label).toBe('second');
    });
  });

  describe('SSR safety', () => {
    it('should handle missing Performance API gracefully', () => {
      // Mock service with unavailable performance API
      (service as any).performanceAvailable = false;

      expect(service.isAvailable()).toBe(false);

      // Should not throw when Performance API unavailable
      const token = service.beginSceneSwitch('ssr-test');
      expect(() => service.markDataLoaded(token)).not.toThrow();
      expect(() => service.endSceneSwitch(token)).not.toThrow();
    });
  });

  describe('Complete workflow', () => {
    it('should track complete scene switch lifecycle', () => {
      spyOn(performance, 'mark');
      spyOn(performance, 'measure').and.returnValue({} as PerformanceMeasure);
      spyOn(performance, 'getEntriesByName').and.returnValue([
        { duration: 387.5 } as PerformanceEntry,
      ]);
      spyOn(performance, 'clearMarks');
      spyOn(performance, 'clearMeasures');

      // Begin scene switch
      const token = service.beginSceneSwitch('highway');
      expect(performance.mark).toHaveBeenCalledWith(`${token.id}:start`);

      // Mark data loaded
      service.markDataLoaded(token);
      expect(performance.mark).toHaveBeenCalledWith(`${token.id}:data-loaded`);

      // End scene switch
      service.endSceneSwitch(token);
      expect(performance.mark).toHaveBeenCalledWith(`${token.id}:end`);
      expect(performance.measure).toHaveBeenCalledWith(
        'scene-switch:highway',
        `${token.id}:start`,
        `${token.id}:end`
      );

      // Verify history
      const history = service.getRecent();
      expect(history.length).toBe(1);
      expect(history[0]).toEqual({ label: 'highway', durationMs: 387.5 });
    });
  });
});
