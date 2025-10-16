import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { firstValueFrom, take } from 'rxjs';
import { StateService, ComparisonData } from './state.service';
import { SystemParams } from '../../models/config-and-metrics';

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
    const expectedCompletions = 7; // All 7 BehaviorSubjects

    // Subscribe to all observables and count completions
    service.scene$.subscribe({ complete: () => completionCount++ });
    service.voxelSize$.subscribe({ complete: () => completionCount++ });
    service.contention$.subscribe({ complete: () => completionCount++ });
    service.sloMs$.subscribe({ complete: () => completionCount++ });
    service.activeBranch$.subscribe({ complete: () => completionCount++ });
    service.cameraPos$.subscribe({ complete: () => completionCount++ });
    service.cameraTarget$.subscribe({ complete: () => completionCount++ });

    // Trigger cleanup
    service.ngOnDestroy();

    // Allow async completion to settle
    setTimeout(() => {
      expect(completionCount).toBe(expectedCompletions);
      done();
    }, 10);
  });
});
