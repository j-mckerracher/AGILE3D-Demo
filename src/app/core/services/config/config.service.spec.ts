import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ConfigService, RuntimeConfig } from './config.service';

describe('ConfigService', () => {
  let service: ConfigService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ConfigService],
    });
    service = TestBed.inject(ConfigService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('initialization', () => {
    it('should load runtime-config.json and merge with environment defaults', async () => {
      const runtimeConfig: Partial<RuntimeConfig> = {
        manifestBaseUrl: 'http://example.com',
        sequences: ['seq1', 'seq2'],
      };

      const initPromise = service.initialize();

      const req = httpMock.expectOne('/assets/runtime-config.json');
      expect(req.request.method).toBe('GET');
      req.flush(runtimeConfig);

      await initPromise;

      expect(service.get('manifestBaseUrl')).toBe('http://example.com');
      expect(service.get('sequences')).toEqual(['seq1', 'seq2']);
      // Environment defaults should still be present for unspecified keys
      expect(service.get('metrics')).toBe(true);
      expect(service.get('scoreDefault')).toBe(0.5);
    });

    it('should use environment defaults if runtime-config.json fails to load', async () => {
      const initPromise = service.initialize();

      const req = httpMock.expectOne('/assets/runtime-config.json');
      req.error(new ErrorEvent('Network error'));

      await initPromise;

      // Should fall back to environment defaults
      expect(service.get('manifestBaseUrl')).toBe('http://localhost:3000');
      expect(service.get('metrics')).toBe(true);
      expect(service.get('branches')).toEqual(['DSVT_Voxel']);
    });
  });

  describe('precedence: env defaults < runtime-config < query flags', () => {
    it('should apply query flag override for string value', async () => {
      // Set up URL with query parameter
      spyOnProperty(window.location, 'search', 'get').and.returnValue('?manifestBaseUrl=http://override.com');

      const runtimeConfig: Partial<RuntimeConfig> = {
        manifestBaseUrl: 'http://runtime.com',
      };

      const initPromise = service.initialize();

      const req = httpMock.expectOne('/assets/runtime-config.json');
      req.flush(runtimeConfig);

      await initPromise;

      // Query flag should win
      expect(service.get('manifestBaseUrl')).toBe('http://override.com');
    });

    it('should apply query flag override for boolean value (metrics)', async () => {
      spyOnProperty(window.location, 'search', 'get').and.returnValue('?metrics=false');

      const runtimeConfig: Partial<RuntimeConfig> = {
        metrics: true,
      };

      const initPromise = service.initialize();

      const req = httpMock.expectOne('/assets/runtime-config.json');
      req.flush(runtimeConfig);

      await initPromise;

      expect(service.get('metrics')).toBe(false);
    });

    it('should apply query flag override for numeric value', async () => {
      spyOnProperty(window.location, 'search', 'get').and.returnValue('?scoreDefault=0.8');

      const runtimeConfig: Partial<RuntimeConfig> = {
        scoreDefault: 0.5,
      };

      const initPromise = service.initialize();

      const req = httpMock.expectOne('/assets/runtime-config.json');
      req.flush(runtimeConfig);

      await initPromise;

      expect(service.get('scoreDefault')).toBe(0.8);
    });

    it('should apply query flag override for array value (comma-separated)', async () => {
      spyOnProperty(window.location, 'search', 'get').and.returnValue('?branches=PointPillar,PV_RCNN');

      const initPromise = service.initialize();

      const req = httpMock.expectOne('/assets/runtime-config.json');
      req.flush({});

      await initPromise;

      expect(service.get('branches')).toEqual(['PointPillar', 'PV_RCNN']);
    });

    it('should respect precedence: env < runtime < query', async () => {
      // Environment default: metrics = true
      // Runtime config: metrics = true (via runtime-config.json)
      // Query flag: metrics = false (via ?metrics=false)
      spyOnProperty(window.location, 'search', 'get').and.returnValue('?metrics=false');

      const runtimeConfig: Partial<RuntimeConfig> = {
        metrics: true,
      };

      const initPromise = service.initialize();

      const req = httpMock.expectOne('/assets/runtime-config.json');
      req.flush(runtimeConfig);

      await initPromise;

      // Query flag should win (lowest precedence: env < runtime < query)
      expect(service.get('metrics')).toBe(false);
    });
  });

  describe('get() method', () => {
    beforeEach(async () => {
      const initPromise = service.initialize();
      const req = httpMock.expectOne('/assets/runtime-config.json');
      req.flush({});
      await initPromise;
    });

    it('should return top-level config value', () => {
      expect(service.get('metrics')).toBe(true);
      expect(service.get('scoreDefault')).toBe(0.5);
    });

    it('should return nested config value using dot notation', () => {
      expect(service.get('timeouts.fetchManifest')).toBe(30000);
      expect(service.get('timeouts.fetchFrame')).toBe(20000);
    });

    it('should return undefined for missing key', () => {
      expect(service.get('nonexistent')).toBeUndefined();
    });

    it('should return provided default value for missing key', () => {
      expect(service.get('nonexistent', 'default')).toBe('default');
      expect(service.get('nonexistent', 42)).toBe(42);
    });

    it('should return undefined for missing nested key', () => {
      expect(service.get('timeouts.invalid')).toBeUndefined();
    });

    it('should return default for missing nested key', () => {
      expect(service.get('timeouts.invalid', 15000)).toBe(15000);
    });

    it('should support array values', () => {
      expect(service.get('branches')).toEqual(['DSVT_Voxel']);
    });

    it('should have typed branches with baseline default', () => {
      const branches = service.get('branches') as string[];
      expect(branches).toContain('DSVT_Voxel');
    });
  });

  describe('typing', () => {
    beforeEach(async () => {
      const initPromise = service.initialize();
      const req = httpMock.expectOne('/assets/runtime-config.json');
      req.flush({});
      await initPromise;
    });

    it('should properly type boolean values', () => {
      const metricsEnabled = service.get('metrics');
      expect(typeof metricsEnabled).toBe('boolean');
    });

    it('should properly type numeric values', () => {
      const scoreDefault = service.get('scoreDefault');
      expect(typeof scoreDefault).toBe('number');
    });

    it('should properly type string values', () => {
      const url = service.get('manifestBaseUrl');
      expect(typeof url).toBe('string');
    });

    it('should properly type array values', () => {
      const branches = service.get('branches');
      expect(Array.isArray(branches)).toBe(true);
    });

    it('should properly type nested objects', () => {
      const timeouts = service.get('timeouts');
      expect(typeof timeouts).toBe('object');
      expect(typeof timeouts.fetchManifest).toBe('number');
    });
  });

  describe('environment defaults', () => {
    beforeEach(async () => {
      const initPromise = service.initialize();
      const req = httpMock.expectOne('/assets/runtime-config.json');
      req.flush({});
      await initPromise;
    });

    it('should have baseline branch default as DSVT_Voxel', () => {
      const branches = service.get('branches') as string[];
      expect(branches[0]).toBe('DSVT_Voxel');
    });

    it('should have all required config keys', () => {
      expect(service.get('manifestBaseUrl')).toBeDefined();
      expect(service.get('sequences')).toBeDefined();
      expect(service.get('branches')).toBeDefined();
      expect(service.get('timeouts')).toBeDefined();
      expect(service.get('retries')).toBeDefined();
      expect(service.get('prefetch')).toBeDefined();
      expect(service.get('concurrency')).toBeDefined();
      expect(service.get('scoreDefault')).toBeDefined();
      expect(service.get('labelsDefault')).toBeDefined();
      expect(service.get('metrics')).toBeDefined();
    });
  });
});
