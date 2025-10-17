/**
 * Footer Component
 *
 * Application footer with copyright and NSF acknowledgment.
 *
 * PRD References:
 * - UI §8.1: Layout Structure
 * - UI §8.4: Professional presentation for NSF demonstration
 */

import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FooterComponent {
  protected readonly currentYear = new Date().getFullYear();
}
