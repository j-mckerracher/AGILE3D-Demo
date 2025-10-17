/**
 * Main Demo Component
 *
 * Main container component that orchestrates the dual viewer, control panel,
 * and metrics dashboard sections. Implements responsive layout with CSS Grid.
 *
 * PRD References:
 * - UI §8.1: Layout Structure
 * - NFR-3.3: Clear visual hierarchy
 * - NFR-3.4: Keyboard navigation support
 */

import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DualViewerComponent } from '../dual-viewer/dual-viewer.component';

@Component({
  selector: 'app-main-demo',
  standalone: true,
  imports: [CommonModule, DualViewerComponent],
  templateUrl: './main-demo.component.html',
  styleUrls: ['./main-demo.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainDemoComponent {
  // Placeholder detection data
  protected baselineDetections = [];
  protected agile3dDetections = [];
}
