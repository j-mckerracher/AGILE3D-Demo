/**
 * Video Landing Component
 *
 * Displays embedded YouTube video with responsive layout and error handling.
 * Replaces 3D interactive demo with video-only presentation.
 *
 * PRD References:
 * - Epic 2: VideoLandingComponent implementation
 * - NFR-3.3: Clear visual hierarchy
 * - NFR-3.4: Keyboard navigation support
 * - NFR-6.1: Performance optimization
 */

import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';

/**
 * Inline video configuration
 * @constant
 */
const videoConfig = {
  // TODO: Replace with actual VIDEO_ID when provided
  VIDEO_ID: 'dQw4w9WgXcQ',
  EMBED_BASE_URL: 'https://www.youtube-nocookie.com/embed/',
  PRECONNECT_URL: 'https://www.youtube-nocookie.com',
} as const;

@Component({
  selector: 'app-video-landing',
  standalone: true,
  imports: [],
  templateUrl: './video-landing.component.html',
  styleUrls: ['./video-landing.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VideoLandingComponent implements OnInit {
  private readonly document = inject(DOCUMENT);

  /** Track iframe load state */
  public iframeLoaded = false;

  /** Track error state for fallback UI */
  public errorState = false;

  /** Computed iframe source URL */
  public get iframeSrc(): string {
    return `${videoConfig.EMBED_BASE_URL}${videoConfig.VIDEO_ID}`;
  }

  /** Direct video URL for fallback link */
  public get videoUrl(): string {
    return `https://www.youtube.com/watch?v=${videoConfig.VIDEO_ID}`;
  }

  public ngOnInit(): void {
    this.addPreconnectLink();
  }

  /**
   * Add preconnect link to DOM for performance optimization
   * @private
   */
  private addPreconnectLink(): void {
    const link = this.document.createElement('link');
    link.rel = 'preconnect';
    link.href = videoConfig.PRECONNECT_URL;
    this.document.head.appendChild(link);
  }

  /**
   * Handle iframe load event
   */
  public onIframeLoad(): void {
    this.iframeLoaded = true;
  }

  /**
   * Handle iframe error event
   */
  public onIframeError(): void {
    this.errorState = true;
  }
}
