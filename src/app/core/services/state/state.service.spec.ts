import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { firstValueFrom, take } from 'rxjs';
import { StateService, ComparisonData } from './state.service';
import { AdvancedKnobs, SystemParams } from '../../models/config-and-metrics';

describe('StateService', () => {
  let service: StateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(StateService);
  });

  it('has correct initial values', async () => {
    expect(await firstValueFrom(service.scene$.pipe(take(1)))).toBe('mixed');
    expect(await firstValueFrom(service.voxelSize$.pipe(take(1)))).toBe(0.32);
    // Debounced observables need tick in fakeAsync
    expect(await firstValueFrom(service.activeBranch$.pipe(take(1)))).toBe('CP_Pillar_032');
    expect(await firstValueFrom(service.cameraPos$.pipe(take(1)))).toEqual([0, 0, 10]);
    expect(await firstValueFrom(service.cameraTarget$.pipe(take(1)))).toEqual([0, 0, 0]);
    expect(await firstValueFrom(service.independentCamera$.pipe(take(1)))).toBe(false);
  });

  it('has correct initial values for debounced observables', fakeAsync(() => {
    let contentionValue: number | undefined;
    let sloValue: number | undefined;

    service.contention$.pipe(take(1)).subscribe((v) => (contentionValue = v));
    service.sloMs$.pipe(take(1)).subscribe((v) => (sloValue = v));

    tick(100); // Wait for debounce
    expect(contentionValue).toBe(38);
    expect(sloValue).toBe(350);
  }));

  it('emits comparisonData$ with mapped fields (backwards compat)', (done) => {
    const emissions: ComparisonData[] = [];
    const sub = service.comparisonData$.subscribe((v) => {
      emissions.push(v);
    });

    // Wait for initial emission
    setTimeout(() => {
      expect(emissions.length).toBeGreaterThanOrEqual(1);
      expect(emissions[0]).toEqual({
        scene: 'mixed',
        contention: 38,
        latencySlo: 350,
        voxelSize: 0.32,
      });

      // Update state values - each triggers combineLatest
      service.setScene('pedestrian-heavy');
      service.setContention(10);
      service.setSlo(200);
      service.setVoxelSize(0.48);

      // Wait for all combineLatest emissions to settle
      setTimeout(() => {
        // Last emission should have all final values
        const lastEmission = emissions[emissions.length - 1];
        expect(lastEmission).toEqual({
          scene: 'pedestrian-heavy',
          contention: 10,
          latencySlo: 200,
          voxelSize: 0.48,
        });
        sub.unsubscribe();
        done();
      }, 20);
    }, 10);
  });

  it('distinctUntilChanged prevents duplicate emissions', (done) => {
    let count = 0;
    const sub = service.comparisonData$.subscribe(() => {
      count++;
    });

    // Initial emission happens immediately.
    // These set operations do not change the derived tuple:
    service.setVoxelSize(0.32); // same as default
    service.setContention(38); // same as default

    setTimeout(() => {
      expect(count).toBe(1); // only initial emission
      sub.unsubscribe();
      done();
    }, 20);
  });

  it('clamps numeric setters to valid ranges', fakeAsync(() => {
    let contentionValue: number | undefined;
    let sloValue: number | undefined;

    service.setContention(200);
    service.setSlo(20);

    service.contention$.pipe(take(1)).subscribe((v) => (contentionValue = v));
    service.sloMs$.pipe(take(1)).subscribe((v) => (sloValue = v));

    tick(100); // Wait for debounce
    expect(contentionValue).toBe(100);
    expect(sloValue).toBe(100);
  }));

  it('new typed setters work correctly', fakeAsync(() => {
    let sceneValue: string | undefined;
    let voxelValue: number | undefined;
    let contentionValue: number | undefined;
    let sloValue: number | undefined;

    service.setScene('vehicle-heavy');
    service.setVoxelSize(0.24);
    service.setContention(50);
    service.setSlo(400);

    service.scene$.pipe(take(1)).subscribe((v) => (sceneValue = v));
    service.voxelSize$.pipe(take(1)).subscribe((v) => (voxelValue = v));
    service.contention$.pipe(take(1)).subscribe((v) => (contentionValue = v));
    service.sloMs$.pipe(take(1)).subscribe((v) => (sloValue = v));

    tick(100); // Wait for debounce
    expect(sceneValue).toBe('vehicle-heavy');
    expect(voxelValue).toBe(0.24);
    expect(contentionValue).toBe(50);
    expect(sloValue).toBe(400);
  }));

  it('updates camera vectors only when changed', async () => {
    service.setCameraPos([0, 0, 10]); // unchanged
    expect(await firstValueFrom(service.cameraPos$.pipe(take(1)))).toEqual([0, 0, 10]);

    service.setCameraPos([1, 2, 3]);
    expect(await firstValueFrom(service.cameraPos$.pipe(take(1)))).toEqual([1, 2, 3]);
  });

  it('updates independent camera mode correctly (WP-2.1.3)', async () => {
    // Default is false (sync mode)
    expect(await firstValueFrom(service.independentCamera$.pipe(take(1)))).toBe(false);

    // Set to independent mode
    service.setIndependentCamera(true);
    expect(await firstValueFrom(service.independentCamera$.pipe(take(1)))).toBe(true);

    // Set back to sync mode
    service.setIndependentCamera(false);
    expect(await firstValueFrom(service.independentCamera$.pipe(take(1)))).toBe(false);
  });

  it('does not emit independentCamera$ if value unchanged', async () => {
    const emissions: boolean[] = [];
    const sub = service.independentCamera$.subscribe((v) => emissions.push(v));

    // Initial emission
    expect(emissions.length).toBe(1);
    expect(emissions[0]).toBe(false);

    // Set same value
    service.setIndependentCamera(false);
    expect(emissions.length).toBe(1); // No new emission

    // Change value
    service.setIndependentCamera(true);
    expect(emissions.length).toBe(2);
    expect(emissions[1]).toBe(true);

    sub.unsubscribe();
  });

  it('debounces contention$ emissions', fakeAsync(() => {
    const emissions: number[] = [];
    const sub = service.contention$.subscribe((v) => emissions.push(v));

    tick(100); // Initial value after debounce
    expect(emissions.length).toBe(1);
    expect(emissions[0]).toBe(38);

    // Rapid fire updates
    service.setContention(10);
    service.setContention(20);
    service.setContention(30);

    // Should not emit yet (debounce window)
    expect(emissions.length).toBe(1);

    tick(100); // Wait for debounce
    expect(emissions.length).toBe(2);
    expect(emissions[1]).toBe(30); // Only final value emitted

    sub.unsubscribe();
  }));

  it('debounces sloMs$ emissions', fakeAsync(() => {
    const emissions: number[] = [];
    const sub = service.sloMs$.subscribe((v) => emissions.push(v));

    tick(100); // Initial value after debounce
    expect(emissions.length).toBe(1);
    expect(emissions[0]).toBe(350);

    // Rapid fire updates
    service.setSlo(100);
    service.setSlo(200);
    service.setSlo(300);

    // Should not emit yet (debounce window)
    expect(emissions.length).toBe(1);

    tick(100); // Wait for debounce
    expect(emissions.length).toBe(2);
    expect(emissions[1]).toBe(300); // Only final value emitted

    sub.unsubscribe();
  }));

  it('emits currentParams$ with correct SystemParams', fakeAsync(() => {
    const emissions: SystemParams[] = [];
    const sub = service.currentParams$.subscribe((v) => emissions.push(v));

    tick(100); // Wait for debounced streams
    expect(emissions.length).toBe(1);
    expect(emissions[0]).toEqual({
      scene: 'mixed',
      voxelSize: 0.32,
      contentionPct: 38,
      sloMs: 350,
    });

    // Update all parameters
    service.setScene('vehicle-heavy');
    service.setVoxelSize(0.24);
    service.setContention(50);
    service.setSlo(400);

    tick(100); // Wait for debounced emissions
    const lastEmission = emissions[emissions.length - 1];
    expect(lastEmission).toEqual({
      scene: 'vehicle-heavy',
      voxelSize: 0.24,
      contentionPct: 50,
      sloMs: 400,
    });

    sub.unsubscribe();
  }));

  it('currentParams$ suppresses duplicate emissions with distinctUntilChanged', fakeAsync(() => {
    const emissions: SystemParams[] = [];
    const sub = service.currentParams$.subscribe((v) => emissions.push(v));

    tick(100); // Initial emission
    const initialCount = emissions.length;

    // Set same values again
    service.setScene('mixed');
    service.setVoxelSize(0.32);
    service.setContention(38);
    service.setSlo(350);

    tick(100); // Wait for debounce
    // Should not emit again since values are the same
    expect(emissions.length).toBe(initialCount);

    sub.unsubscribe();
  }));

  it('completes all subjects on ngOnDestroy', (done) => {
    let completionCount = 0;
    const expectedCompletions = 9; // All 9 BehaviorSubjects (added advancedKnobs in WP-2.2.2)

    // Subscribe to all observables and count completions
    service.scene$.subscribe({ complete: () => completionCount++ });
    service.voxelSize$.subscribe({ complete: () => completionCount++ });
    service.contention$.subscribe({ complete: () => completionCount++ });
    service.sloMs$.subscribe({ complete: () => completionCount++ });
    service.activeBranch$.subscribe({ complete: () => completionCount++ });
    service.cameraPos$.subscribe({ complete: () => completionCount++ });
    service.cameraTarget$.subscribe({ complete: () => completionCount++ });
    service.independentCamera$.subscribe({ complete: () => completionCount++ });
    service.advancedKnobs$.subscribe({ complete: () => completionCount++ });

    // Trigger cleanup
    service.ngOnDestroy();

    // Allow async completion to settle
    setTimeout(() => {
      expect(completionCount).toBe(expectedCompletions);
      done();
    }, 10);
  });

  // WP-2.2.2: Advanced Controls Tests
  describe('advancedKnobs$ (WP-2.2.2)', () => {
    it('has correct default values', async () => {
      const defaultKnobs = await firstValueFrom(service.advancedKnobs$.pipe(take(1)));
      expect(defaultKnobs).toEqual({
        encodingFormat: 'pillar',
        detectionHead: 'center',
        featureExtractor: '2d_cnn',
      });
    });

    it('updates when setAdvancedKnobs is called with new values', async () => {
      const newKnobs: AdvancedKnobs = {
        encodingFormat: 'voxel',
        detectionHead: 'anchor',
        featureExtractor: 'transformer',
      };

      service.setAdvancedKnobs(newKnobs);

      const updated = await firstValueFrom(service.advancedKnobs$.pipe(take(1)));
      expect(updated).toEqual(newKnobs);
    });

    it('does not emit if values are unchanged (deep equality check)', async () => {
      const emissions: AdvancedKnobs[] = [];
      const sub = service.advancedKnobs$.subscribe((v) => emissions.push(v));

      // Initial emission
      expect(emissions.length).toBe(1);
      expect(emissions[0]).toEqual({
        encodingFormat: 'pillar',
        detectionHead: 'center',
        featureExtractor: '2d_cnn',
      });

      // Set the same values (should not emit due to deep equality check)
      service.setAdvancedKnobs({
        encodingFormat: 'pillar',
        detectionHead: 'center',
        featureExtractor: '2d_cnn',
      });

      // Allow async to settle
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should still be 1 emission (no duplicate)
      expect(emissions.length).toBe(1);

      sub.unsubscribe();
    });

    it('emits when any single knob value changes', async () => {
      const emissions: AdvancedKnobs[] = [];
      const sub = service.advancedKnobs$.subscribe((v) => emissions.push(v));

      // Initial emission
      expect(emissions.length).toBe(1);

      // Change only encodingFormat
      service.setAdvancedKnobs({
        encodingFormat: 'voxel',
        detectionHead: 'center',
        featureExtractor: '2d_cnn',
      });

      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(emissions.length).toBe(2);
      expect(emissions[1]!.encodingFormat).toBe('voxel');

      // Change only detectionHead
      service.setAdvancedKnobs({
        encodingFormat: 'voxel',
        detectionHead: 'anchor',
        featureExtractor: '2d_cnn',
      });

      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(emissions.length).toBe(3);
      expect(emissions[2]!.detectionHead).toBe('anchor');

      // Change only featureExtractor
      service.setAdvancedKnobs({
        encodingFormat: 'voxel',
        detectionHead: 'anchor',
        featureExtractor: 'sparse_cnn',
      });

      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(emissions.length).toBe(4);
      expect(emissions[3]!.featureExtractor).toBe('sparse_cnn');

      sub.unsubscribe();
    });

    it('uses distinctUntilChanged with JSON deep equality to prevent redundant emissions', async () => {
      const emissions: AdvancedKnobs[] = [];
      const sub = service.advancedKnobs$.subscribe((v) => emissions.push(v));

      // Initial emission
      expect(emissions.length).toBe(1);

      // Rapidly set the same values multiple times
      service.setAdvancedKnobs({
        encodingFormat: 'voxel',
        detectionHead: 'anchor',
        featureExtractor: 'transformer',
      });

      service.setAdvancedKnobs({
        encodingFormat: 'voxel',
        detectionHead: 'anchor',
        featureExtractor: 'transformer',
      });

      service.setAdvancedKnobs({
        encodingFormat: 'voxel',
        detectionHead: 'anchor',
        featureExtractor: 'transformer',
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should only have 2 emissions: initial + first change (duplicates suppressed)
      expect(emissions.length).toBe(2);

      sub.unsubscribe();
    });

    it('handles all valid knob value combinations', async () => {
      const testCases: AdvancedKnobs[] = [
        { encodingFormat: 'voxel', detectionHead: 'anchor', featureExtractor: 'transformer' },
        { encodingFormat: 'voxel', detectionHead: 'center', featureExtractor: 'sparse_cnn' },
        { encodingFormat: 'pillar', detectionHead: 'anchor', featureExtractor: '2d_cnn' },
        { encodingFormat: 'pillar', detectionHead: 'center', featureExtractor: 'transformer' },
      ];

      for (const knobs of testCases) {
        service.setAdvancedKnobs(knobs);
        const emitted = await firstValueFrom(service.advancedKnobs$.pipe(take(1)));
        expect(emitted).toEqual(knobs);
      }
    });
  });
});
