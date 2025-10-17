/**
 * Hero Component
 *
 * Hero section with call-to-action and project overview.
 *
 * PRD References:
 * - UI §8.1: Layout Structure
 * - UI §8.4: Professional presentation for NSF demonstration
 */

import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-hero',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './hero.component.html',
  styleUrls: ['./hero.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroComponent {
  /**
   * Scroll to main demo section
   */
  public scrollToDemo(): void {
    const mainContent = document.getElementById('main-content');
    mainContent?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
