import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { PaperDataService } from './paper-data.service';
import { BranchesData, BaselineData } from '../../models/branch.models';

describe('PaperDataService', () => {
  let service: PaperDataService;
  let httpMock: HttpTestingController;

  const mockBranchesData: BranchesData = {
    branches: [
      {
        branch_id: 'CP_Pillar_032',
        name: 'CenterPoint Pillar 0.32m',
        controlKnobs: {
          encodingFormat: 'pillar',
          spatialResolution: 0.32,
          spatialEncoding: 'DV',
          featureExtractor: '2d_cnn',
          detectionHead: 'center',
        },
        performance: {
          memoryFootprint: 3.2,
          latency: {
            noContention: { mean: 147, std: 5.2 },
            lightContention: { mean: 168, std: 7.8 },
            moderateContention: { mean: 195, std: 12.3 },
            intenseContention: { mean: 245, std: 18.9 },
            peakContention: { mean: 298, std: 25.1 },
          },
          accuracy: {
            'vehicle-heavy': 64.2,
            'pedestrian-heavy': 58.7,
            'mixed': 61.5,
          },
        },
        modelFamily: 'CenterPoint',
      },
    ],
  };

  const mockBaselineData: BaselineData = {
    branch_id: 'DSVT_Voxel',
    name: 'DSVT Voxel (Baseline)',
    controlKnobs: {
      encodingFormat: 'voxel',
      spatialResolution: 0.16,
      spatialEncoding: 'DV',
      featureExtractor: 'transformer',
      detectionHead: 'center',
    },
    performance: {
      memoryFootprint: 6.8,
      latency: {
        noContention: { mean: 371, std: 15.2 },
        lightContention: { mean: 425, std: 22.8 },
        moderateContention: { mean: 498, std: 35.7 },
        intenseContention: { mean: 645, std: 58.2 },
        peakContention: { mean: 782, std: 72.4 },
      },
      accuracy: {
        'vehicle-heavy': 67.1,
        'pedestrian-heavy': 62.3,
        'mixed': 64.8,
      },
    },
    modelFamily: 'DSVT',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [PaperDataService],
    });
    service = TestBed.inject(PaperDataService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getBranches', () => {
    it('should load and return branches data', (done) => {
      service.getBranches().subscribe((branches) => {
        expect(branches).toEqual(mockBranchesData.branches);
        expect(branches.length).toBe(1);
        expect(branches[0].branch_id).toBe('CP_Pillar_032');
        done();
      });

      const req = httpMock.expectOne('assets/data/branches.json');
      expect(req.request.method).toBe('GET');
      req.flush(mockBranchesData);
    });

    it('should cache branches data and not make duplicate requests', (done) => {
      // First subscription
      service.getBranches().subscribe(() => {
        // Second subscription (should use cache)
        service.getBranches().subscribe((branches) => {
          expect(branches.length).toBe(1);
          done();
        });
      });

      // Should only have one HTTP request due to shareReplay
      const req = httpMock.expectOne('assets/data/branches.json');
      req.flush(mockBranchesData);
    });
  });

  describe('getBaseline', () => {
    it('should load and return baseline data', (done) => {
      service.getBaseline().subscribe((baseline) => {
        expect(baseline).toEqual(mockBaselineData);
        expect(baseline.branch_id).toBe('DSVT_Voxel');
        expect(baseline.performance.memoryFootprint).toBe(6.8);
        done();
      });

      const req = httpMock.expectOne('assets/data/baseline.json');
      expect(req.request.method).toBe('GET');
      req.flush(mockBaselineData);
    });
  });

  describe('lookupLatency', () => {
    it('should lookup latency for no contention (0%)', (done) => {
      service.lookupLatency('CP_Pillar_032', 0).subscribe((latency) => {
        expect(latency.mean).toBe(147);
        expect(latency.std).toBe(5.2);
        done();
      });

      const req = httpMock.expectOne('assets/data/branches.json');
      req.flush(mockBranchesData);
    });

    it('should lookup latency for light contention (38%)', (done) => {
      service.lookupLatency('CP_Pillar_032', 38).subscribe((latency) => {
        expect(latency.mean).toBe(168);
        expect(latency.std).toBe(7.8);
        done();
      });

      const req = httpMock.expectOne('assets/data/branches.json');
      req.flush(mockBranchesData);
    });

    it('should lookup latency for moderate contention (45%)', (done) => {
      service.lookupLatency('CP_Pillar_032', 45).subscribe((latency) => {
        expect(latency.mean).toBe(195);
        expect(latency.std).toBe(12.3);
        done();
      });

      const req = httpMock.expectOne('assets/data/branches.json');
      req.flush(mockBranchesData);
    });

    it('should lookup latency for intense contention (64%)', (done) => {
      service.lookupLatency('CP_Pillar_032', 64).subscribe((latency) => {
        expect(latency.mean).toBe(245);
        expect(latency.std).toBe(18.9);
        done();
      });

      const req = httpMock.expectOne('assets/data/branches.json');
      req.flush(mockBranchesData);
    });

    it('should lookup latency for peak contention (70%)', (done) => {
      service.lookupLatency('CP_Pillar_032', 70).subscribe((latency) => {
        expect(latency.mean).toBe(298);
        expect(latency.std).toBe(25.1);
        done();
      });

      const req = httpMock.expectOne('assets/data/branches.json');
      req.flush(mockBranchesData);
    });

    it('should throw error for non-existent branch', (done) => {
      service.lookupLatency('INVALID_BRANCH', 50).subscribe({
        next: () => fail('Should have thrown error'),
        error: (error) => {
          expect(error.message).toContain('Branch not found: INVALID_BRANCH');
          done();
        },
      });

      const req = httpMock.expectOne('assets/data/branches.json');
      req.flush(mockBranchesData);
    });
  });

  describe('lookupAccuracy', () => {
    it('should lookup accuracy for vehicle-heavy scene', (done) => {
      service.lookupAccuracy('CP_Pillar_032', 'vehicle-heavy').subscribe((accuracy) => {
        expect(accuracy).toBe(64.2);
        done();
      });

      const req = httpMock.expectOne('assets/data/branches.json');
      req.flush(mockBranchesData);
    });

    it('should lookup accuracy for pedestrian-heavy scene', (done) => {
      service.lookupAccuracy('CP_Pillar_032', 'pedestrian-heavy').subscribe((accuracy) => {
        expect(accuracy).toBe(58.7);
        done();
      });

      const req = httpMock.expectOne('assets/data/branches.json');
      req.flush(mockBranchesData);
    });

    it('should lookup accuracy for mixed scene', (done) => {
      service.lookupAccuracy('CP_Pillar_032', 'mixed').subscribe((accuracy) => {
        expect(accuracy).toBe(61.5);
        done();
      });

      const req = httpMock.expectOne('assets/data/branches.json');
      req.flush(mockBranchesData);
    });
  });

  describe('lookupMemory', () => {
    it('should lookup memory footprint', (done) => {
      service.lookupMemory('CP_Pillar_032').subscribe((memory) => {
        expect(memory).toBe(3.2);
        done();
      });

      const req = httpMock.expectOne('assets/data/branches.json');
      req.flush(mockBranchesData);
    });
  });

  describe('getBaselineLatency', () => {
    it('should get baseline latency for no contention', (done) => {
      service.getBaselineLatency(0).subscribe((latency) => {
        expect(latency.mean).toBe(371);
        expect(latency.std).toBe(15.2);
        done();
      });

      const req = httpMock.expectOne('assets/data/baseline.json');
      req.flush(mockBaselineData);
    });

    it('should get baseline latency for peak contention', (done) => {
      service.getBaselineLatency(100).subscribe((latency) => {
        expect(latency.mean).toBe(782);
        expect(latency.std).toBe(72.4);
        done();
      });

      const req = httpMock.expectOne('assets/data/baseline.json');
      req.flush(mockBaselineData);
    });
  });

  describe('getBaselineAccuracy', () => {
    it('should get baseline accuracy for vehicle-heavy scene', (done) => {
      service.getBaselineAccuracy('vehicle-heavy').subscribe((accuracy) => {
        expect(accuracy).toBe(67.1);
        done();
      });

      const req = httpMock.expectOne('assets/data/baseline.json');
      req.flush(mockBaselineData);
    });

    it('should get baseline accuracy for mixed scene', (done) => {
      service.getBaselineAccuracy('mixed').subscribe((accuracy) => {
        expect(accuracy).toBe(64.8);
        done();
      });

      const req = httpMock.expectOne('assets/data/baseline.json');
      req.flush(mockBaselineData);
    });
  });

  describe('getBaselineMemory', () => {
    it('should get baseline memory footprint', (done) => {
      service.getBaselineMemory().subscribe((memory) => {
        expect(memory).toBe(6.8);
        done();
      });

      const req = httpMock.expectOne('assets/data/baseline.json');
      req.flush(mockBaselineData);
    });
  });
});
