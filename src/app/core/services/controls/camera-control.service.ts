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
    // Detach all on service destruction (defensive, as service is providedIn: 'root')
    const ids = Array.from(this.attachments.keys());
    ids.forEach((id) => this.detach(id));
  }

  /**
   * Called when OrbitControls 'change' event fires.
   * Pushes camera position and target to StateService, guarded by 'updating'.
   */
  private onControlsChange(id: string): void {
    const attachment = this.attachments.get(id);
    if (!attachment || attachment.updating) return;

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
   */
  private onStatePositionChange(id: string, pos: Vec3): void {
    const attachment = this.attachments.get(id);
    if (!attachment || attachment.updating) return;

    attachment.updating = true;
    try {
      attachment.controls.object.position.set(pos[0], pos[1], pos[2]);
      attachment.controls.update();
    } finally {
      attachment.updating = false;
    }
  }

  /**
   * Called when StateService cameraTarget$ emits a new value.
   * Updates controls target, guarded by 'updating'.
   */
  private onStateTargetChange(id: string, target: Vec3): void {
    const attachment = this.attachments.get(id);
    if (!attachment || attachment.updating) return;

    attachment.updating = true;
    try {
      attachment.controls.target.set(target[0], target[1], target[2]);
      attachment.controls.update();
    } finally {
      attachment.updating = false;
    }
  }
}
