import { Injectable, OnDestroy, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { StateService } from '../state/state.service';
import { Vec3 } from '../../models/scene.models';

/**
 * CameraControlService synchronizes OrbitControls with StateService camera state
 * in both directions: controls -> state and state -> controls.
 * Prevents feedback loops via an 'updating' guard per attached control instance.
 *
 * Supports independent camera mode (WP-2.1.3):
 * - When independent mode is OFF (default): cameras sync across all viewers
 * - When independent mode is ON: each viewer controls its camera independently
 *
 * Usage:
 *   const controls = new OrbitControls(camera, domElement);
 *   cameraControlService.attach('viewer-1', controls);
 *   // ...
 *   cameraControlService.detach('viewer-1');
 */
@Injectable({ providedIn: 'root' })
export class CameraControlService implements OnDestroy {
  private readonly state = inject(StateService);

  private readonly attachments = new Map<
    string,
    {
      controls: OrbitControls;
      changeListener: () => void;
      subscriptions: Subscription[];
      updating: boolean;
    }
  >();

  private independentMode = false;
  private modeSubscription?: Subscription;

  /**
   * Attach OrbitControls for bidirectional sync with StateService.
   * @param id Unique identifier for this control instance.
   * @param controls The OrbitControls to synchronize.
   * @throws If id is already attached.
   * @returns void
   */
  public attach(id: string, controls: OrbitControls): void {
    if (!id) throw new Error('CameraControlService.attach: id is required');
    if (this.attachments.has(id)) {
      throw new Error(`CameraControlService.attach: id "${id}" already attached`);
    }

    const attachment = {
      controls,
      changeListener: (): void => this.onControlsChange(id),
      subscriptions: [] as Subscription[],
      updating: false,
    };

    // Controls -> State: Push camera position and target to StateService when controls change
    controls.addEventListener('change', attachment.changeListener);

    // State -> Controls: Subscribe to StateService and update controls
    attachment.subscriptions.push(
      this.state.cameraPos$.subscribe((pos) => this.onStatePositionChange(id, pos))
    );
    attachment.subscriptions.push(
      this.state.cameraTarget$.subscribe((target) => this.onStateTargetChange(id, target))
    );

    this.attachments.set(id, attachment);

    // Subscribe to independent camera mode on first attachment
    if (!this.modeSubscription) {
      this.modeSubscription = this.state.independentCamera$.subscribe((independent) => {
        this.onModeChange(independent);
      });
    }
  }

  /**
   * Detach previously attached controls and clean up listeners/subscriptions.
   * @param id The identifier used at attachment time.
   * @returns void
   */
  public detach(id: string): void {
    const attachment = this.attachments.get(id);
    if (!attachment) return;

    attachment.controls.removeEventListener('change', attachment.changeListener);
    attachment.subscriptions.forEach((sub) => sub.unsubscribe());
    this.attachments.delete(id);
  }

  public ngOnDestroy(): void {
    // Unsubscribe from mode changes
    if (this.modeSubscription) {
      this.modeSubscription.unsubscribe();
    }

    // Detach all on service destruction (defensive, as service is providedIn: 'root')
    const ids = Array.from(this.attachments.keys());
    ids.forEach((id) => this.detach(id));
  }

  /**
   * Called when OrbitControls 'change' event fires.
   * Pushes camera position and target to StateService, guarded by 'updating'.
   * In independent mode, skips pushing to global state.
   */
  private onControlsChange(id: string): void {
    const attachment = this.attachments.get(id);
    if (!attachment || attachment.updating) return;

    // In independent mode, don't push to global state
    if (this.independentMode) return;

    attachment.updating = true;
    try {
      const cam = attachment.controls.object;
      const pos: Vec3 = [cam.position.x, cam.position.y, cam.position.z];
      const target: Vec3 = [
        attachment.controls.target.x,
        attachment.controls.target.y,
        attachment.controls.target.z,
      ];

      this.state.setCameraPos(pos);
      this.state.setCameraTarget(target);
    } finally {
      attachment.updating = false;
    }
  }

  /**
   * Called when StateService cameraPos$ emits a new value.
   * Updates controls camera position, guarded by 'updating'.
   * In independent mode, skips updates from global state.
   */
  private onStatePositionChange(id: string, pos: Vec3): void {
    const attachment = this.attachments.get(id);
    if (!attachment || attachment.updating) return;

    // In independent mode, don't update from global state
    if (this.independentMode) return;

    attachment.updating = true;
    try {
      const position = (attachment.controls.object as unknown as { position?: Vec3Like }).position;
      setVec3Like(position, pos);
      attachment.controls.update();
    } finally {
      attachment.updating = false;
    }
  }

  /**
   * Called when StateService cameraTarget$ emits a new value.
   * Updates controls target, guarded by 'updating'.
   * In independent mode, skips updates from global state.
   */
  private onStateTargetChange(id: string, target: Vec3): void {
    const attachment = this.attachments.get(id);
    if (!attachment || attachment.updating) return;

    // In independent mode, don't update from global state
    if (this.independentMode) return;

    attachment.updating = true;
    try {
      const tgt = (attachment.controls as unknown as { target?: Vec3Like }).target;
      setVec3Like(tgt, target);
      attachment.controls.update();
    } finally {
      attachment.updating = false;
    }
  }

  /**
   * Called when independent camera mode changes.
   * When switching from independent → sync, re-syncs all cameras to a canonical pose.
   */
  private onModeChange(independent: boolean): void {
    const wasIndependent = this.independentMode;
    this.independentMode = independent;

    // When switching from independent back to sync, re-sync cameras
    if (wasIndependent && !independent) {
      this.resyncCameras();
    }
  }

  /**
   * Re-sync all cameras to a canonical pose.
   * Uses the first attached viewer's camera as the canonical source.
   */
  private resyncCameras(): void {
    const ids = Array.from(this.attachments.keys());
    if (ids.length === 0) return;

    // Use first viewer as canonical source
    const canonicalId = ids[0];
    if (!canonicalId) return;

    const canonical = this.attachments.get(canonicalId);
    if (!canonical) return;

    const cam = canonical.controls.object;
    const pos: Vec3 = [cam.position.x, cam.position.y, cam.position.z];
    const target: Vec3 = [
      canonical.controls.target.x,
      canonical.controls.target.y,
      canonical.controls.target.z,
    ];

    // Push canonical pose to global state once
    // This will trigger onStatePositionChange/onStateTargetChange for all viewers
    this.state.setCameraPos(pos);
    this.state.setCameraTarget(target);
  }
}

// Support both real THREE.Vector3-like objects (with set) and plain objects used in tests
type Vec3Like =
  | { set(x: number, y: number, z: number): void }
  | { x: number; y: number; z: number };

function setVec3Like(obj: Vec3Like | undefined, v: Vec3): void {
  if (!obj) return;
  if (typeof (obj as { set?: (x: number, y: number, z: number) => void }).set === 'function') {
    (obj as { set: (x: number, y: number, z: number) => void }).set(v[0], v[1], v[2]);
  } else {
    (obj as { x: number; y: number; z: number }).x = v[0];
    (obj as { x: number; y: number; z: number }).y = v[1];
    (obj as { x: number; y: number; z: number }).z = v[2];
  }
}
