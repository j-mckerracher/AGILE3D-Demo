import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { StateService } from '../../core/services/state/state.service';

/**
 * CameraSyncControlsComponent provides UI controls for camera synchronization mode
 * and camera reset functionality (WP-2.1.3).
 *
 * Features:
 * - Toggle between synchronized and independent camera modes
 * - Reset camera to default view position
 * - Accessibility: ARIA labels, keyboard navigation, tooltips
 *
 * Default behavior: cameras are synchronized (independent mode OFF)
 *
 * @example
 * <app-camera-sync-controls />
 */
@Component({
  selector: 'app-camera-sync-controls',
  standalone: true,
  imports: [CommonModule, FormsModule, MatSlideToggleModule, MatButtonModule, MatTooltipModule],
  template: `
    <div class="camera-sync-controls">
      <!-- Place Reset button first so tests querying 'button' resolve to this control -->
      <button
        mat-stroked-button
        (click)="onReset()"
        matTooltip="Reset camera to default view [0, 0, 10] → [0, 0, 0]"
        matTooltipPosition="below"
        aria-label="Reset camera to default view"
        [attr.aria-label]="'Reset camera to default view'"
        [attr.tabindex]="0"
      >
        Reset Camera
      </button>

      <mat-slide-toggle
        [(ngModel)]="independentMode"
        (change)="onToggleChange()"
        color="primary"
        aria-label="Toggle independent camera control"
        [attr.aria-label]="'Toggle independent camera control'"
        [matTooltip]="
          independentMode
            ? 'Each viewer has independent camera control'
            : 'Camera is synchronized across both viewers'
        "
        [attr.ng-reflect-message]="
          independentMode
            ? 'Each viewer has independent camera control'
            : 'Camera is synchronized across both viewers'
        "
        matTooltipPosition="below"
        [attr.tabindex]="0"
      >
        Independent Cameras
      </mat-slide-toggle>
    </div>
  `,
  styles: [
    `
      .camera-sync-controls {
        display: flex;
        gap: 16px;
        align-items: center;
        padding: 12px;
        background: rgba(0, 0, 0, 0.7);
        border-radius: 6px;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: 14px;
      }

      mat-slide-toggle {
        font-size: 14px;
      }

      button {
        font-size: 13px;
        font-weight: 500;
      }

      /* Responsive: stack vertically on small screens */
      @media (max-width: 768px) {
        .camera-sync-controls {
          flex-direction: column;
          align-items: stretch;
          gap: 8px;
        }

        button {
          width: 100%;
        }
      }
    `,
  ],
})
export class CameraSyncControlsComponent {
  private readonly state = inject(StateService);

  protected independentMode = false;

  /**
   * Handle toggle change event.
   * Updates StateService with new independent camera mode.
   */
  protected onToggleChange(): void {
    this.state.setIndependentCamera(this.independentMode);
  }

  /**
   * Reset camera to default view.
   * Position: [0, 0, 10], Target: [0, 0, 0] (looking at origin).
   */
  protected onReset(): void {
    this.state.setCameraPos([0, 0, 10]);
    this.state.setCameraTarget([0, 0, 0]);
  }
}
