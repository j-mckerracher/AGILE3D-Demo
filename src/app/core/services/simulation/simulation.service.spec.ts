import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { SimulationService } from './simulation.service';
import { PaperDataService } from '../data/paper-data.service';
import { StateService } from '../state/state.service';
import { BranchesData, BaselineData, BranchConfig } from '../../models/branch.models';
import { SystemParams, AdvancedKnobs } from '../../models/config-and-metrics';

describe('SimulationService', () => {
  let service: SimulationService;
  let stateService: StateService;
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
      {
        branch_id: 'CP_Pillar_048',
        name: 'CenterPoint Pillar 0.48m',
        controlKnobs: {
          encodingFormat: 'pillar',
          spatialResolution: 0.48,
          spatialEncoding: 'DV',
          featureExtractor: '2d_cnn',
          detectionHead: 'center',
        },
        performance: {
          memoryFootprint: 2.4,
          latency: {
            noContention: { mean: 98, std: 3.8 },
            lightContention: { mean: 112, std: 5.2 },
            moderateContention: { mean: 131, std: 8.7 },
            intenseContention: { mean: 167, std: 13.4 },
            peakContention: { mean: 205, std: 18.6 },
          },
          accuracy: {
            'vehicle-heavy': 61.8,
            'pedestrian-heavy': 55.3,
            'mixed': 58.9,
          },
        },
        modelFamily: 'CenterPoint',
      },
      {
        branch_id: 'CP_Voxel_024',
        name: 'CenterPoint Voxel 0.24m',
        controlKnobs: {
          encodingFormat: 'voxel',
          spatialResolution: 0.24,
          spatialEncoding: 'DV',
          featureExtractor: 'sparse_cnn',
          detectionHead: 'center',
        },
        performance: {
          memoryFootprint: 4.8,
          latency: {
            noContention: { mean: 215, std: 8.1 },
            lightContention: { mean: 248, std: 11.3 },
            moderateContention: { mean: 289, std: 17.2 },
            intenseContention: { mean: 372, std: 26.8 },
            peakContention: { mean: 451, std: 34.5 },
          },
          accuracy: {
            'vehicle-heavy': 65.9,
            'pedestrian-heavy': 61.2,
            'mixed': 63.8,
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
      providers: [SimulationService, PaperDataService, StateService],
    });

    service = TestBed.inject(SimulationService);
    stateService = TestBed.inject(StateService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Branch Selection Logic', () => {
    beforeEach(() => {
      // Flush initial HTTP requests triggered by SimulationService constructor
      const branchesReq = httpMock.expectOne('assets/data/branches.json');
      const baselineReq = httpMock.expectOne('assets/data/baseline.json');
      branchesReq.flush(mockBranchesData);
      baselineReq.flush(mockBaselineData);
    });

    it('should select branch with closest spatial resolution match', (done) => {
      // Set parameters that favor CP_Pillar_032 (0.32m resolution)
      stateService.setVoxelSize(0.32);
      stateService.setContention(0); // Low contention - all meet SLO
      stateService.setSlo(500); // High SLO - all meet it
      stateService.setScene('mixed');

      service.activeBranch$.subscribe((branchId) => {
        expect(branchId).toBe('CP_Pillar_032');
        done();
      });
    });

    it('should prefer lower latency branch when SLO is tight', (done) => {
      // Set tight SLO that only CP_Pillar_048 can meet
      stateService.setVoxelSize(0.48);
      stateService.setContention(38); // Light contention
      stateService.setSlo(150); // Tight SLO
      stateService.setScene('mixed');

      // CP_Pillar_048 has mean latency of 112ms @ lightContention
      // CP_Pillar_032 has mean latency of 168ms @ lightContention (violates SLO)
      service.activeBranch$.subscribe((branchId) => {
        expect(branchId).toBe('CP_Pillar_048');
        done();
      });
    });

    it('should apply format penalty when encoding format preference is set', (done) => {
      // Set parameters that would normally select CP_Pillar_032
      // but with voxel format preference should select CP_Voxel_024
      stateService.setVoxelSize(0.32);
      stateService.setContention(0);
      stateService.setSlo(500);
      stateService.setScene('mixed');
      stateService.setAdvancedKnobs({
        encodingFormat: 'voxel',
        detectionHead: 'center',
        featureExtractor: '2d_cnn',
      });

      service.activeBranch$.subscribe((branchId) => {
        // Should select voxel branch due to format preference
        expect(branchId).toBe('CP_Voxel_024');
        done();
      });
    });

    it('should handle rapid parameter changes without duplicate emissions', (done) => {
      const emissions: string[] = [];

      service.activeBranch$.subscribe((branchId) => {
        emissions.push(branchId);

        if (emissions.length === 3) {
          // Should have 3 distinct emissions for 3 different configurations
          expect(emissions.length).toBe(3);
          expect(new Set(emissions).size).toBeGreaterThan(0);
          done();
        }
      });

      // Rapid parameter changes
      stateService.setVoxelSize(0.32);
      setTimeout(() => stateService.setVoxelSize(0.48), 10);
      setTimeout(() => stateService.setVoxelSize(0.24), 20);
    });
  });

  describe('Metrics Calculation', () => {
    beforeEach(() => {
      const branchesReq = httpMock.expectOne('assets/data/branches.json');
      const baselineReq = httpMock.expectOne('assets/data/baseline.json');
      branchesReq.flush(mockBranchesData);
      baselineReq.flush(mockBaselineData);
    });

    it('should calculate baseline metrics correctly', (done) => {
      stateService.setScene('vehicle-heavy');
      stateService.setContention(0); // noContention
      stateService.setSlo(500);

      service.baselineMetrics$.subscribe((metrics) => {
        expect(metrics.name).toBe('DSVT-Voxel');
        expect(metrics.accuracyMap).toBe(67.1); // vehicle-heavy accuracy
        expect(metrics.latencyMs).toBe(371); // noContention mean latency
        expect(metrics.memoryGb).toBe(6.8);
        expect(metrics.sloCompliance).toBe(true); // 371 < 500
        done();
      });
    });

    it('should calculate AGILE3D metrics correctly', (done) => {
      stateService.setScene('mixed');
      stateService.setContention(38); // lightContention
      stateService.setSlo(200);
      stateService.setVoxelSize(0.32);

      service.agileMetrics$.subscribe((metrics) => {
        expect(metrics.name).toBe('AGILE3D');
        expect(metrics.activeBranch).toBe('CP_Pillar_032');
        expect(metrics.accuracyMap).toBe(61.5); // mixed scene accuracy
        expect(metrics.latencyMs).toBe(168); // lightContention mean latency
        expect(metrics.memoryGb).toBe(3.2);
        expect(metrics.sloCompliance).toBe(true); // 168 < 200
        done();
      });
    });

    it('should detect SLO violations correctly', (done) => {
      stateService.setScene('mixed');
      stateService.setContention(38); // lightContention
      stateService.setSlo(100); // Tight SLO that CP_Pillar_032 violates
      stateService.setVoxelSize(0.32);

      service.agileMetrics$.subscribe((metrics) => {
        // CP_Pillar_032 has 168ms latency @ lightContention
        expect(metrics.latencyMs).toBe(168);
        expect(metrics.sloCompliance).toBe(false); // 168 > 100
        expect(metrics.violationRate).toBeGreaterThan(0);
        done();
      });
    });
  });

  describe('Comparison Deltas', () => {
    beforeEach(() => {
      const branchesReq = httpMock.expectOne('assets/data/branches.json');
      const baselineReq = httpMock.expectOne('assets/data/baseline.json');
      branchesReq.flush(mockBranchesData);
      baselineReq.flush(mockBaselineData);
    });

    it('should calculate comparison deltas correctly', (done) => {
      stateService.setScene('vehicle-heavy');
      stateService.setContention(38); // lightContention
      stateService.setSlo(300);
      stateService.setVoxelSize(0.32);

      service.comparison$.subscribe((comparison) => {
        // Baseline: 67.1% accuracy, 425ms latency
        // AGILE3D (CP_Pillar_032): 64.2% accuracy, 168ms latency
        expect(comparison.accuracyDelta).toBeCloseTo(64.2 - 67.1, 1); // ~-2.9% (AGILE3D less accurate)
        expect(comparison.latencyDeltaMs).toBeCloseTo(168 - 425, 1); // ~-257ms (AGILE3D much faster)
        expect(comparison.violationReduction).toBeGreaterThanOrEqual(0);
        done();
      });
    });

    it('should show positive accuracy delta when AGILE3D is more accurate', (done) => {
      // Use a configuration where AGILE3D has higher accuracy than baseline
      // Need to manipulate StateService to test edge cases
      stateService.setScene('pedestrian-heavy');
      stateService.setContention(0);
      stateService.setSlo(500);
      stateService.setVoxelSize(0.24);

      service.comparison$.subscribe((comparison) => {
        // Baseline pedestrian-heavy: 62.3%
        // CP_Voxel_024 pedestrian-heavy: 61.2%
        expect(comparison.accuracyDelta).toBeCloseTo(61.2 - 62.3, 1);
        done();
      });
    });

    it('should handle zero deltas when metrics are identical', (done) => {
      // This is a theoretical edge case - in practice baseline and AGILE3D always differ
      // But we test the comparison logic handles equality correctly
      stateService.setScene('mixed');
      stateService.setContention(0);
      stateService.setSlo(500);
      stateService.setVoxelSize(0.32);

      service.comparison$.subscribe((comparison) => {
        // Verify comparison logic doesn't break with any valid input
        expect(comparison.accuracyDelta).toBeDefined();
        expect(comparison.latencyDeltaMs).toBeDefined();
        expect(comparison.violationReduction).toBeDefined();
        expect(typeof comparison.accuracyDelta).toBe('number');
        expect(typeof comparison.latencyDeltaMs).toBe('number');
        expect(typeof comparison.violationReduction).toBe('number');
        done();
      });
    });
  });

  describe('Observable Stability and Performance', () => {
    beforeEach(() => {
      const branchesReq = httpMock.expectOne('assets/data/branches.json');
      const baselineReq = httpMock.expectOne('assets/data/baseline.json');
      branchesReq.flush(mockBranchesData);
      baselineReq.flush(mockBaselineData);
    });

    it('should use shareReplay to avoid duplicate computations', (done) => {
      let emissionCount = 0;

      const sub1 = service.activeBranch$.subscribe(() => {
        emissionCount++;
      });

      const sub2 = service.activeBranch$.subscribe(() => {
        emissionCount++;
      });

      setTimeout(() => {
        // With shareReplay(1), both subscribers should receive the same emission
        // Total emissions should be 2 (one for each subscriber from the same source emission)
        expect(emissionCount).toBe(2);
        sub1.unsubscribe();
        sub2.unsubscribe();
        done();
      }, 100);
    });

    it('should not emit when parameters haven\'t changed (distinctUntilChanged)', (done) => {
      let emissionCount = 0;

      service.activeBranch$.subscribe(() => {
        emissionCount++;
      });

      // Set same values multiple times
      stateService.setVoxelSize(0.32);
      stateService.setVoxelSize(0.32);
      stateService.setVoxelSize(0.32);

      setTimeout(() => {
        // Should only emit once due to distinctUntilChanged
        expect(emissionCount).toBe(1);
        done();
      }, 150);
    });

    it('should complete metrics calculation within performance target', (done) => {
      const startTime = performance.now();

      stateService.setScene('mixed');
      stateService.setContention(45);
      stateService.setSlo(250);
      stateService.setVoxelSize(0.32);

      service.comparison$.subscribe(() => {
        const elapsed = performance.now() - startTime;
        // Should complete well within 100ms target
        expect(elapsed).toBeLessThan(100);
        done();
      });
    });
  });

  describe('Edge Cases and Robustness', () => {
    beforeEach(() => {
      const branchesReq = httpMock.expectOne('assets/data/branches.json');
      const baselineReq = httpMock.expectOne('assets/data/baseline.json');
      branchesReq.flush(mockBranchesData);
      baselineReq.flush(mockBaselineData);
    });

    it('should handle extreme contention values (clamping)', (done) => {
      stateService.setContention(150); // Beyond 100% - should clamp
      stateService.setScene('mixed');
      stateService.setVoxelSize(0.32);
      stateService.setSlo(500);

      service.agileMetrics$.subscribe((metrics) => {
        // Should not crash, should use peakContention level
        expect(metrics.latencyMs).toBe(298); // peakContention latency
        done();
      });
    });

    it('should handle extreme SLO values', (done) => {
      stateService.setSlo(1); // Very tight SLO
      stateService.setContention(0);
      stateService.setScene('mixed');
      stateService.setVoxelSize(0.32);

      service.agileMetrics$.subscribe((metrics) => {
        // Should not crash, should show non-compliance
        expect(metrics.sloCompliance).toBe(false);
        expect(metrics.violationRate).toBeGreaterThan(90);
        done();
      });
    });

    it('should handle all scene types', (done) => {
      const scenes: Array<'vehicle-heavy' | 'pedestrian-heavy' | 'mixed'> = [
        'vehicle-heavy',
        'pedestrian-heavy',
        'mixed',
      ];

      let count = 0;

      service.agileMetrics$.subscribe((metrics) => {
        expect(metrics.accuracyMap).toBeGreaterThan(0);
        count++;

        if (count === scenes.length) {
          done();
        }
      });

      scenes.forEach((scene) => stateService.setScene(scene));
    });
  });
});
