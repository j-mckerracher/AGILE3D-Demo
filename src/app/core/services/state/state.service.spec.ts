import { TestBed } from '@angular/core/testing';
import { firstValueFrom, take } from 'rxjs';
import { StateService, ComparisonData } from './state.service';

describe('StateService', () => {
  let service: StateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(StateService);
  });

  it('has correct initial values', async () => {
    expect(await firstValueFrom(service.currentScene$.pipe(take(1)))).toBe('vehicle-heavy');
    expect(await firstValueFrom(service.contention$.pipe(take(1)))).toBe(0);
    expect(await firstValueFrom(service.latencySlo$.pipe(take(1)))).toBe(350);
    expect(await firstValueFrom(service.voxelSize$.pipe(take(1)))).toBe(0.32);
    expect(await firstValueFrom(service.activeBranch$.pipe(take(1)))).toBe('CP_Pillar_032');
    expect(await firstValueFrom(service.cameraPos$.pipe(take(1)))).toEqual([0, 0, 10]);
    expect(await firstValueFrom(service.cameraTarget$.pipe(take(1)))).toEqual([0, 0, 0]);
  });

  it('emits comparisonData$ with mapped fields', (done) => {
    const emissions: ComparisonData[] = [];
    const sub = service.comparisonData$.subscribe((v) => {
      emissions.push(v);
    });

    // Wait for initial emission
    setTimeout(() => {
      expect(emissions.length).toBeGreaterThanOrEqual(1);
      expect(emissions[0]).toEqual({
        scene: 'vehicle-heavy',
        contention: 0,
        latencySlo: 350,
        voxelSize: 0.32,
      });

      // Update state values - each triggers combineLatest
      service.setCurrentScene('mixed');
      service.setContention(10);
      service.setLatencySlo(200);
      service.setVoxelSize(0.5);

      // Wait for all combineLatest emissions to settle
      setTimeout(() => {
        // Last emission should have all final values
        const lastEmission = emissions[emissions.length - 1];
        expect(lastEmission).toEqual({
          scene: 'mixed',
          contention: 10,
          latencySlo: 200,
          voxelSize: 0.48, // 0.5 snaps to nearest valid VoxelSize (0.48)
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
    service.setContention(0); // same as default

    setTimeout(() => {
      expect(count).toBe(1); // only initial emission
      sub.unsubscribe();
      done();
    }, 20);
  });

  it('clamps numeric setters to valid ranges', async () => {
    service.setContention(200);
    service.setLatencySlo(20);
    service.setVoxelSize(0.01);

    expect(await firstValueFrom(service.contention$.pipe(take(1)))).toBe(100);
    expect(await firstValueFrom(service.latencySlo$.pipe(take(1)))).toBe(100);
    expect(await firstValueFrom(service.voxelSize$.pipe(take(1)))).toBe(0.16);
  });

  it('updates camera vectors only when changed', async () => {
    service.setCameraPos([0, 0, 10]); // unchanged
    expect(await firstValueFrom(service.cameraPos$.pipe(take(1)))).toEqual([0, 0, 10]);

    service.setCameraPos([1, 2, 3]);
    expect(await firstValueFrom(service.cameraPos$.pipe(take(1)))).toEqual([1, 2, 3]);
  });

  it('completes all subjects on ngOnDestroy', (done) => {
    let completionCount = 0;
    const expectedCompletions = 7; // All 7 BehaviorSubjects

    // Subscribe to all subjects and count completions
    service.currentScene$.subscribe({ complete: () => completionCount++ });
    service.contention$.subscribe({ complete: () => completionCount++ });
    service.latencySlo$.subscribe({ complete: () => completionCount++ });
    service.voxelSize$.subscribe({ complete: () => completionCount++ });
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
