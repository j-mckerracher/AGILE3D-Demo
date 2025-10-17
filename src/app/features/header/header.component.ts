/**
 * Header Component
 *
 * Application header with branding, navigation, and theme toggle.
 *
 * PRD References:
 * - UI §8.1: Layout Structure
 * - NFR-3.3: Clear visual hierarchy
 * - NFR-3.4: Keyboard navigation support
 */

import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeToggleComponent } from '../../shared/components/theme-toggle/theme-toggle.component';
import { KeyboardNavDirective } from '../../shared/directives/keyboard-nav.directive';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, ThemeToggleComponent, KeyboardNavDirective],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent {}
