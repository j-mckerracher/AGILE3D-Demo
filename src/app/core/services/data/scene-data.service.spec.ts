import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { SceneDataService } from './scene-data.service';
import { SceneMetadata, SceneRegistry } from '../../models/scene.models';

describe('SceneDataService', () => {
  let service: SceneDataService;
  let httpMock: HttpTestingController;

  const mockMetadata: SceneMetadata = {
    scene_id: 'test_scene_01',
    name: 'Test Scene',
    description: 'A test scene',
    pointsBin: 'assets/scenes/test_scene_01/test_scene_01_100k.bin',
    pointCount: 100000,
    pointStride: 3,
    bounds: {
      min: [-50, -50, -2],
      max: [50, 50, 10],
    },
    ground_truth: [],
    predictions: {},
    metadata: {
      vehicleCount: 5,
      pedestrianCount: 3,
      cyclistCount: 1,
      complexity: 'medium',
      optimalBranch: 'DSVT_Voxel',
    },
  };

  const mockRegistry: SceneRegistry = {
    version: '1.0.0',
    scenes: [
      {
        scene_id: 'test_scene_01',
        name: 'Test Scene',
        description: 'A test scene',
        complexity: 'medium',
        pointCount: 100000,
        hasFallback: true,
      },
    ],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        SceneDataService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(SceneDataService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    service.terminateWorker();
    service.clearCache();
  });

  describe('loadMetadata', () => {
    it('should load scene metadata', async () => {
      const promise = service.loadMetadata('test_scene_01');

      const req = httpMock.expectOne(
        'assets/scenes/test_scene_01/metadata.json'
      );
      expect(req.request.method).toBe('GET');
      req.flush(mockMetadata);

      const result = await promise;
      expect(result).toEqual(mockMetadata);
    });

    it('should cache loaded metadata', async () => {
      const promise1 = service.loadMetadata('test_scene_01');

      const req = httpMock.expectOne(
        'assets/scenes/test_scene_01/metadata.json'
      );
      req.flush(mockMetadata);

      await promise1;

      // Second call should use cache (no HTTP request)
      const result2 = await service.loadMetadata('test_scene_01');
      expect(result2).toEqual(mockMetadata);

      httpMock.expectNone('assets/scenes/test_scene_01/metadata.json');
    });

    it('should throw error on invalid metadata', async () => {
      const invalidMetadata = { scene_id: 'test' }; // Missing required fields

      const promise = service.loadMetadata('test_scene_01');

      const req = httpMock.expectOne(
        'assets/scenes/test_scene_01/metadata.json'
      );
      req.flush(invalidMetadata);

      await expectAsync(promise).toBeRejected();
    });

    it('should throw error on HTTP failure', async () => {
      const promise = service.loadMetadata('nonexistent');

      const req = httpMock.expectOne(
        'assets/scenes/nonexistent/metadata.json'
      );
      req.error(new ProgressEvent('error'), { status: 404 });

      await expectAsync(promise).toBeRejected();
    });
  });

  describe('loadRegistry', () => {
    it('should load scene registry', async () => {
      const promise = service.loadRegistry();

      const req = httpMock.expectOne('assets/scenes/registry.json');
      expect(req.request.method).toBe('GET');
      req.flush(mockRegistry);

      const result = await promise;
      expect(result).toEqual(mockRegistry);
    });

    it('should throw error on HTTP failure', async () => {
      const promise = service.loadRegistry();

      const req = httpMock.expectOne('assets/scenes/registry.json');
      req.error(new ProgressEvent('error'), { status: 500 });

      await expectAsync(promise).toBeRejected();
    });
  });

  describe('loadPoints', () => {
    it('should load and parse binary point cloud data', async () => {
      const binPath = 'assets/scenes/test_scene_01/test_scene_01_100k.bin';
      const cacheKey = 'test_scene_01:full';

      // Create mock binary data (3 points)
      const mockData = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      const arrayBuffer = mockData.buffer;

      // Mock worker to immediately return data
      spyOn(
        service as unknown as { parseInWorker: (buf: ArrayBuffer, stride: number) => Promise<Float32Array> },
        'parseInWorker'
      ).and.returnValue(Promise.resolve(mockData));

      const promise = service.loadPoints(binPath, cacheKey, 3);

      const req = httpMock.expectOne(binPath);
      expect(req.request.responseType).toBe('arraybuffer');
      req.flush(arrayBuffer);

      const result = await promise;
      expect(result).toEqual(mockData);
      expect(
        (service as unknown as { parseInWorker: (buf: ArrayBuffer, stride: number) => Promise<Float32Array> })
          .parseInWorker
      ).toHaveBeenCalledWith(arrayBuffer, 3);
    });

    it('should cache parsed point cloud data', async () => {
      const binPath = 'assets/scenes/test_scene_01/test_scene_01_100k.bin';
      const cacheKey = 'test_scene_01:full';
      const mockData = new Float32Array([1, 2, 3]);

      spyOn(
        service as unknown as { parseInWorker: (buf: ArrayBuffer, stride: number) => Promise<Float32Array> },
        'parseInWorker'
      ).and.returnValue(Promise.resolve(mockData));

      const promise1 = service.loadPoints(binPath, cacheKey, 3);

      const req = httpMock.expectOne(binPath);
      req.flush(mockData.buffer);

      await promise1;

      // Second call should use cache (no HTTP request, no worker call)
      const result2 = await service.loadPoints(binPath, cacheKey, 3);
      expect(result2).toEqual(mockData);

      httpMock.expectNone(binPath);
      expect(
        (service as unknown as { parseInWorker: (buf: ArrayBuffer, stride: number) => Promise<Float32Array> })
          .parseInWorker
      ).toHaveBeenCalledTimes(1);
    });

    it('should throw error on HTTP failure', async () => {
      const binPath = 'assets/scenes/test_scene_01/test_scene_01_100k.bin';
      const cacheKey = 'test_scene_01:full';

      const promise = service.loadPoints(binPath, cacheKey, 3);

      const req = httpMock.expectOne(binPath);
      req.error(new ProgressEvent('error'), { status: 404 });

      await expectAsync(promise).toBeRejected();
    });
  });

  describe('cache management', () => {
    it('should clear all caches', async () => {
      // Load and cache metadata
      const promise = service.loadMetadata('test_scene_01');
      const req = httpMock.expectOne(
        'assets/scenes/test_scene_01/metadata.json'
      );
      req.flush(mockMetadata);
      await promise;

      expect(service.getCacheStats().metadataCacheSize).toBe(1);

      // Clear cache
      service.clearCache();

      expect(service.getCacheStats().metadataCacheSize).toBe(0);
      expect(service.getCacheStats().pointsCacheSize).toBe(0);
    });

    it('should report cache statistics', () => {
      const stats = service.getCacheStats();
      expect(stats.pointsCacheSize).toBe(0);
      expect(stats.metadataCacheSize).toBe(0);
    });
  });

  describe('worker lifecycle', () => {
    it('should terminate worker on request', () => {
      // Terminate worker
      service.terminateWorker();

      // Worker should be null after termination
      expect((service as unknown as { worker: Worker | null }).worker).toBeNull();
    });
  });

  describe('metadata validation', () => {
    it('should reject metadata without required fields', async () => {
      const invalidMetadata = {
        scene_id: 'test',
        name: 'Test',
        // Missing other required fields
      };

      const promise = service.loadMetadata('test_scene_01');

      const req = httpMock.expectOne(
        'assets/scenes/test_scene_01/metadata.json'
      );
      req.flush(invalidMetadata);

      await expectAsync(promise).toBeRejectedWithError(/Missing required field/);
    });

    it('should reject metadata with invalid bounds', async () => {
      const invalidMetadata = {
        ...mockMetadata,
        bounds: {
          min: [1, 2], // Invalid: should be [x,y,z]
          max: [3, 4, 5],
        },
      };

      const promise = service.loadMetadata('test_scene_01');

      const req = httpMock.expectOne(
        'assets/scenes/test_scene_01/metadata.json'
      );
      req.flush(invalidMetadata);

      await expectAsync(promise).toBeRejectedWithError(/Invalid bounds/);
    });
  });
});
