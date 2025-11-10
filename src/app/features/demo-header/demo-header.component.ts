/**
 * Demo Header Component
 *
 * Displays dataset information and playback controls in the main content header.
 * Part of UI restructuring to move playback controls from dual-viewer overlay.
 *
 * Features:
 * - Dataset names (baseline + comparison)
 * - Playback controls (prev/pause/play/next)
 * - Current time/frame display
 * - Elapsed time info
 */

import {
  Component,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Input,
  Output,
  EventEmitter,
  inject,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FrameStreamService } from '../../core/services/frame-stream/frame-stream.service';
import { Subscription } from 'rxjs';

export interface PlaybackControlEvent {
  action: 'play' | 'pause' | 'prev' | 'next';
}

@Component({
  selector: 'app-demo-header',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './demo-header.component.html',
  styleUrls: ['./demo-header.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DemoHeaderComponent implements OnInit, OnDestroy {
  @Input() public baselineBranch = 'Baseline';
  @Input() public activeBranch = 'AGILE3D';

  @Output() public playbackControl = new EventEmitter<PlaybackControlEvent>();

  protected isPlaying = false;
  protected isPaused = false;
  protected isStopped = false;
  protected currentFrameIndex = 0;
  protected totalFrames = 0;
  protected elapsedTime = '0:00';

  private readonly frameStream = inject(FrameStreamService);
  private readonly cdr = inject(ChangeDetectorRef);
  private statusSubscription?: Subscription;
  private frameSubscription?: Subscription;
  private startTime?: number;

  public ngOnInit(): void {
    // Subscribe to playback status
    this.statusSubscription = this.frameStream.status$.subscribe((status) => {
      this.isPlaying = status === 'playing';
      this.isPaused = status === 'paused';
      this.isStopped = status === 'stopped';

      if (this.isPlaying && !this.startTime) {
        this.startTime = Date.now();
      } else if (!this.isPlaying) {
        this.startTime = undefined;
      }

      this.cdr.markForCheck(); // Trigger change detection
    });

    // Subscribe to current frame for counter
    this.frameSubscription = this.frameStream.currentFrame$.subscribe((frame) => {
      if (frame) {
        this.currentFrameIndex = frame.index;
        const total = this.frameStream.getTotalFrames();
        if (total > 0 && this.totalFrames !== total) {
          this.totalFrames = total;
        }

        // Update elapsed time
        if (this.startTime) {
          const elapsed = Date.now() - this.startTime;
          const seconds = Math.floor(elapsed / 1000);
          const minutes = Math.floor(seconds / 60);
          const secs = seconds % 60;
          this.elapsedTime = `${minutes}:${secs.toString().padStart(2, '0')}`;
        }

        this.cdr.markForCheck(); // Trigger change detection
      }
    });
  }

  public ngOnDestroy(): void {
    this.statusSubscription?.unsubscribe();
    this.frameSubscription?.unsubscribe();
  }

  protected onPlayPause(): void {
    if (this.isPlaying) {
      this.playbackControl.emit({ action: 'pause' });
    } else {
      this.playbackControl.emit({ action: 'play' });
    }
  }

  protected onPrevious(): void {
    this.playbackControl.emit({ action: 'prev' });
  }

  protected onNext(): void {
    this.playbackControl.emit({ action: 'next' });
  }
}
