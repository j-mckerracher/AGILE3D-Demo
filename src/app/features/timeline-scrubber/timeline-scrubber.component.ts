/**
 * Timeline Scrubber Component
 *
 * Horizontal progress bar with draggable handle for frame navigation.
 * Part of UI restructuring to move timeline controls below dual viewer.
 *
 * Features:
 * - Horizontal progress bar
 * - Draggable handle for seeking
 * - Click-to-seek functionality
 * - Frame counter display (Frame X / Y)
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
import { MatSliderModule } from '@angular/material/slider';
import { FrameStreamService } from '../../core/services/frame-stream/frame-stream.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-timeline-scrubber',
  standalone: true,
  imports: [CommonModule, MatSliderModule],
  templateUrl: './timeline-scrubber.component.html',
  styleUrls: ['./timeline-scrubber.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimelineScrubberComponent implements OnInit, OnDestroy {
  @Input() public currentFrame = 0;
  @Input() public totalFrames = 100;

  @Output() public seekTo = new EventEmitter<number>();

  protected isPlaying = false;
  private readonly frameStream = inject(FrameStreamService);
  private readonly cdr = inject(ChangeDetectorRef);
  private frameSubscription?: Subscription;
  private statusSubscription?: Subscription;

  public ngOnInit(): void {
    // Subscribe to current frame
    this.frameSubscription = this.frameStream.currentFrame$.subscribe((frame) => {
      if (frame) {
        this.currentFrame = frame.index;
        const total = this.frameStream.getTotalFrames();
        if (total > 0) {
          this.totalFrames = total;
        }
        this.cdr.markForCheck(); // Trigger change detection
      }
    });

    // Subscribe to playback status
    this.statusSubscription = this.frameStream.status$.subscribe((status) => {
      this.isPlaying = status === 'playing';
      this.cdr.markForCheck(); // Trigger change detection
    });
  }

  public ngOnDestroy(): void {
    this.frameSubscription?.unsubscribe();
    this.statusSubscription?.unsubscribe();
  }

  protected onSeek(frameIndex: number): void {
    // Pause during manual seeking
    if (this.isPlaying) {
      this.frameStream.pause();
    }
    this.seekTo.emit(frameIndex);
  }

  protected getProgress(): number {
    if (this.totalFrames === 0) return 0;
    return (this.currentFrame / (this.totalFrames - 1)) * 100;
  }
}
