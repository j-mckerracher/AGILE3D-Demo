import { TestBed } from '@angular/core/testing';
import { CameraControlService } from './camera-control.service';
import { StateService } from '../state/state.service';
import { Vec3 } from '../../models/scene.models';

describe('CameraControlService', () => {
  let service: CameraControlService;
  let stateService: StateService;

  // Mock OrbitControls
  class MockOrbitControls {
    public object = {
      position: { x: 0, y: 0, z: 10 },
    };
    public target = { x: 0, y: 0, z: 0 };
    private listeners = new Map<string, (() => void)[]>();

    public addEventListener(event: string, callback: () => void): void {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, []);
      }
      this.listeners.get(event)?.push(callback);
    }

    public removeEventListener(event: string, callback: () => void): void {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        const idx = callbacks.indexOf(callback);
        if (idx >= 0) callbacks.splice(idx, 1);
      }
    }

    public update(): void {
      // no-op in mock
    }

    public triggerChange(): void {
      const callbacks = this.listeners.get('change');
      if (callbacks) {
        callbacks.forEach((cb) => cb());
      }
    }
  }

  type OrbitControlsLike = MockOrbitControls;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CameraControlService, StateService],
    });
    service = TestBed.inject(CameraControlService);
    stateService = TestBed.inject(StateService);
  });

  afterEach(() => {
    service.ngOnDestroy();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should throw if attaching with duplicate id', () => {
    const controls = new MockOrbitControls() as unknown as OrbitControlsLike;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service.attach('test-1', controls as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => service.attach('test-1', controls as any)).toThrowError(/already attached/);
    service.detach('test-1');
  });

  it('should push camera position and target to state when controls change', (done: DoneFn) => {
    const controls = new MockOrbitControls() as unknown as OrbitControlsLike;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service.attach('test-1', controls as any);

    // Update controls position and target
    controls.object.position = { x: 1, y: 2, z: 3 };
    controls.target = { x: 4, y: 5, z: 6 };

    // Subscribe to state changes
    let posReceived = false;
    let targetReceived = false;

    stateService.cameraPos$.subscribe((pos) => {
      if (pos[0] === 1 && pos[1] === 2 && pos[2] === 3) {
        posReceived = true;
        checkDone();
      }
    });

    stateService.cameraTarget$.subscribe((target) => {
      if (target[0] === 4 && target[1] === 5 && target[2] === 6) {
        targetReceived = true;
        checkDone();
      }
    });

    function checkDone(): void {
      if (posReceived && targetReceived) {
        service.detach('test-1');
        done();
      }
    }

    // Trigger controls change
    controls.triggerChange();
  });

  it('should update controls when state changes', () => {
    const controls = new MockOrbitControls() as unknown as OrbitControlsLike;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service.attach('test-1', controls as any);

    // Emit new camera position and target from state
    const newPos: Vec3 = [10, 20, 30];
    const newTarget: Vec3 = [5, 10, 15];

    stateService.setCameraPos(newPos);
    stateService.setCameraTarget(newTarget);

    // Check controls were updated
    expect(controls.object.position.x).toBe(10);
    expect(controls.object.position.y).toBe(20);
    expect(controls.object.position.z).toBe(30);
    expect(controls.target.x).toBe(5);
    expect(controls.target.y).toBe(10);
    expect(controls.target.z).toBe(15);

    service.detach('test-1');
  });

  it('should prevent feedback loops with updating guard', () => {
    const controls = new MockOrbitControls() as unknown as OrbitControlsLike;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service.attach('test-1', controls as any);

    let stateUpdateCount = 0;

    // Count how many times state is updated
    stateService.cameraPos$.subscribe(() => {
      stateUpdateCount++;
    });

    // Trigger controls change which updates state
    controls.object.position = { x: 100, y: 200, z: 300 };
    controls.triggerChange();

    // State should update once, but the update guard should prevent
    // the state change from triggering another controls update that
    // would trigger another state update (feedback loop).
    // Initial subscription fires immediately, plus one from triggerChange
    expect(stateUpdateCount).toBeLessThanOrEqual(2);

    service.detach('test-1');
  });

  it('should detach cleanly and stop syncing', () => {
    const controls = new MockOrbitControls() as unknown as OrbitControlsLike;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service.attach('test-1', controls as any);

    // Detach
    service.detach('test-1');

    // Update state
    const newPos: Vec3 = [99, 88, 77];
    stateService.setCameraPos(newPos);

    // Controls should not be updated (still at original position)
    expect(controls.object.position.x).toBe(0);
    expect(controls.object.position.y).toBe(0);
    expect(controls.object.position.z).toBe(10);
  });

  it('should handle multiple attached controls independently', () => {
    const controls1 = new MockOrbitControls() as unknown as OrbitControlsLike;
    const controls2 = new MockOrbitControls() as unknown as OrbitControlsLike;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service.attach('test-1', controls1 as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service.attach('test-2', controls2 as any);

    // Update state
    const newPos: Vec3 = [1, 2, 3];
    stateService.setCameraPos(newPos);

    // Both controls should update
    expect(controls1.object.position.x).toBe(1);
    expect(controls2.object.position.x).toBe(1);

    service.detach('test-1');
    service.detach('test-2');
  });
});
