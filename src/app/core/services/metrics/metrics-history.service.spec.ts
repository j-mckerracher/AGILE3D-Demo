import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { MetricsHistoryService, MetricsHistorySample } from './metrics-history.service';
import { SimulationService } from '../simulation/simulation.service';
import { StateService } from '../state/state.service';
import { ComparisonMetrics, SceneId } from '../../models/config-and-metrics';

describe('MetricsHistoryService', () => {
  let service: MetricsHistoryService;
  let mockSimulationService: jasmine.SpyObj<SimulationService>;
  let mockStateService: jasmine.SpyObj<StateService>;
  let comparisonSubject: BehaviorSubject<ComparisonMetrics>;
  let sceneSubject: BehaviorSubject<SceneId>;

  beforeEach(() => {
    // Create mock observables
    comparisonSubject = new BehaviorSubject<ComparisonMetrics>({
      accuracyDelta: 1.5,
      latencyDeltaMs: -50,
      violationReduction: 10,
    });
    sceneSubject = new BehaviorSubject<SceneId>('mixed');

    // Create mock services
    mockSimulationService = jasmine.createSpyObj('SimulationService', [], {
      comparison$: comparisonSubject.asObservable(),
    });

    mockStateService = jasmine.createSpyObj('StateService', [], {
      scene$: sceneSubject.asObservable(),
    });

    TestBed.configureTestingModule({
      providers: [
        MetricsHistoryService,
        { provide: SimulationService, useValue: mockSimulationService },
        { provide: StateService, useValue: mockStateService },
      ],
    });

    service = TestBed.inject(MetricsHistoryService);
  });

  afterEach(() => {
    service.ngOnDestroy();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Ring Buffer Behavior', () => {
    it('should add samples to history buffer', fakeAsync(() => {
      const sample: MetricsHistorySample = {
        t: Date.now(),
        accuracyDelta: 2.0,
        latencyDeltaMs: -60,
        violationReduction: 12,
        scene: 'mixed',
      };

      service.addSample(sample);
      tick();

      const history = service.getHistory();
      expect(history.length).toBe(1);
      expect(history[0]).toEqual(sample);
    }));

    it('should maintain a maximum of 10 samples (ring buffer)', fakeAsync(() => {
      // Add 15 samples (exceeds max of 10)
      for (let i = 0; i < 15; i++) {
        service.addSample({
          t: Date.now() + i,
          accuracyDelta: i,
          latencyDeltaMs: -i,
          violationReduction: i,
          scene: 'mixed',
        });
      }
      tick();

      const history = service.getHistory();
      expect(history.length).toBe(10);

      // Verify oldest samples were removed (first 5)
      expect(history[0]?.accuracyDelta).toBe(5); // Sample index 5 is now oldest
      expect(history[9]?.accuracyDelta).toBe(14); // Sample index 14 is newest
    }));

    it('should return history in oldest-to-newest order', fakeAsync(() => {
      const timestamps = [100, 200, 300, 400, 500];

      timestamps.forEach((t) => {
        service.addSample({
          t,
          accuracyDelta: 1.0,
          latencyDeltaMs: -10,
          violationReduction: 5,
          scene: 'mixed',
        });
      });
      tick();

      const history = service.getHistory();
      expect(history.length).toBe(5);
      expect(history.map((s) => s.t)).toEqual(timestamps);
    }));

    it('should return a readonly copy of history (prevent external mutation)', fakeAsync(() => {
      service.addSample({
        t: 1000,
        accuracyDelta: 1.0,
        latencyDeltaMs: -10,
        violationReduction: 5,
        scene: 'mixed',
      });
      tick();

      const history1 = service.getHistory();
      const history2 = service.getHistory();

      // Verify they are separate arrays
      expect(history1).not.toBe(history2);
      expect(history1).toEqual(history2);
    }));
  });

  describe('Scene Change Clearing', () => {
    it('should clear history when scene changes', fakeAsync(() => {
      // Add initial samples
      comparisonSubject.next({ accuracyDelta: 1.0, latencyDeltaMs: -10, violationReduction: 5 });
      tick();

      expect(service.getHistory().length).toBeGreaterThan(0);

      // Change scene
      sceneSubject.next('vehicle-heavy');
      tick();

      // History should be cleared
      const history = service.getHistory();
      expect(history.length).toBe(0);
    }));

    it('should not clear history on initial scene load', fakeAsync(() => {
      // Initial scene emission should not clear (currentScene starts null)
      expect(service.getHistory().length).toBe(0);

      comparisonSubject.next({ accuracyDelta: 1.5, latencyDeltaMs: -20, violationReduction: 8 });
      tick();

      expect(service.getHistory().length).toBe(1);
    }));

    it('should update currentScene after scene change', fakeAsync(() => {
      sceneSubject.next('pedestrian-heavy');
      tick();

      comparisonSubject.next({ accuracyDelta: 2.0, latencyDeltaMs: -30, violationReduction: 10 });
      tick();

      const history = service.getHistory();
      expect(history[0]?.scene).toBe('pedestrian-heavy');
    }));
  });

  describe('Distinct Emission Filtering', () => {
    it('should capture distinct comparison metrics only', fakeAsync(() => {
      // Emit same metrics twice
      const metrics: ComparisonMetrics = {
        accuracyDelta: 1.5,
        latencyDeltaMs: -50,
        violationReduction: 10,
      };

      comparisonSubject.next(metrics);
      tick();
      comparisonSubject.next(metrics); // Duplicate
      tick();

      // Should only capture one sample (distinctUntilChanged)
      const history = service.getHistory();
      expect(history.length).toBe(1);
    }));

    it('should capture new samples when metrics change', fakeAsync(() => {
      comparisonSubject.next({
        accuracyDelta: 1.0,
        latencyDeltaMs: -10,
        violationReduction: 5,
      });
      tick();

      comparisonSubject.next({
        accuracyDelta: 2.0,
        latencyDeltaMs: -20,
        violationReduction: 8,
      });
      tick();

      const history = service.getHistory();
      expect(history.length).toBe(2);
      expect(history[0]?.accuracyDelta).toBe(1.0);
      expect(history[1]?.accuracyDelta).toBe(2.0);
    }));

    it('should detect partial changes in comparison metrics', fakeAsync(() => {
      comparisonSubject.next({
        accuracyDelta: 1.0,
        latencyDeltaMs: -10,
        violationReduction: 5,
      });
      tick();

      // Change only one field
      comparisonSubject.next({
        accuracyDelta: 1.0,
        latencyDeltaMs: -20, // Changed
        violationReduction: 5,
      });
      tick();

      const history = service.getHistory();
      expect(history.length).toBe(2);
    }));
  });

  describe('Clear Method', () => {
    it('should clear all samples when clear() is called', fakeAsync(() => {
      // Add multiple samples
      for (let i = 0; i < 5; i++) {
        service.addSample({
          t: Date.now() + i,
          accuracyDelta: i,
          latencyDeltaMs: -i,
          violationReduction: i,
          scene: 'mixed',
        });
      }
      tick();

      expect(service.getHistory().length).toBe(5);

      service.clear('Manual clear');
      tick();

      expect(service.getHistory().length).toBe(0);
    }));

    it('should handle clear() with no samples gracefully', fakeAsync(() => {
      expect(service.getHistory().length).toBe(0);

      service.clear();
      tick();

      expect(service.getHistory().length).toBe(0);
    }));
  });

  describe('Performance and Memory Safety', () => {
    it('should handle rapid comparison updates without memory growth', fakeAsync(() => {
      // Emit 100 rapid updates
      for (let i = 0; i < 100; i++) {
        comparisonSubject.next({
          accuracyDelta: i,
          latencyDeltaMs: -i,
          violationReduction: i,
        });
        tick();
      }

      // Should still maintain only 10 samples
      const history = service.getHistory();
      expect(history.length).toBeLessThanOrEqual(10);
    }));

    it('should complete subscriptions on ngOnDestroy', () => {
      spyOn(comparisonSubject, 'subscribe').and.callThrough();

      service.ngOnDestroy();

      // Verify cleanup doesn't throw
      expect(() => service.ngOnDestroy()).not.toThrow();
    });
  });

  describe('Sample Timestamping', () => {
    it('should capture timestamp for each sample', fakeAsync(() => {
      const beforeTime = Date.now();

      comparisonSubject.next({
        accuracyDelta: 1.5,
        latencyDeltaMs: -30,
        violationReduction: 8,
      });
      tick();

      const afterTime = Date.now();
      const history = service.getHistory();

      expect(history.length).toBe(1);
      expect(history[0]?.t).toBeGreaterThanOrEqual(beforeTime);
      expect(history[0]?.t).toBeLessThanOrEqual(afterTime);
    }));
  });

  describe('Integration with SimulationService', () => {
    it('should automatically capture samples from SimulationService.comparison$', fakeAsync(() => {
      // Service automatically subscribed on init
      expect(service.getHistory().length).toBe(0);

      // Emit from SimulationService
      comparisonSubject.next({
        accuracyDelta: 3.2,
        latencyDeltaMs: -75,
        violationReduction: 15,
      });
      tick();

      const history = service.getHistory();
      expect(history.length).toBe(1);
      expect(history[0]?.accuracyDelta).toBe(3.2);
      expect(history[0]?.latencyDeltaMs).toBe(-75);
      expect(history[0]?.violationReduction).toBe(15);
    }));
  });

  describe('Integration with StateService', () => {
    it('should track current scene from StateService.scene$', fakeAsync(() => {
      sceneSubject.next('vehicle-heavy');
      tick();

      comparisonSubject.next({
        accuracyDelta: 1.0,
        latencyDeltaMs: -10,
        violationReduction: 5,
      });
      tick();

      const history = service.getHistory();
      expect(history[0]?.scene).toBe('vehicle-heavy');
    }));
  });
});
