/**
 * AGILE3D Theme Toggle Component
 *
 * Accessible theme toggle button that allows users to switch between
 * light, dark, and system themes. Includes proper ARIA labels and
 * keyboard navigation support.
 *
 * PRD References:
 * - WP-1.3.1: Visual Design System & Theme
 * - NFR-3.5: WCAG 2.2 AA compliance
 * - NFR-3.6: Keyboard navigation support
 */

import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { ThemeService } from '../../../core/theme/theme.service';
import { ThemeMode, ActiveTheme } from '../../../core/theme/theme.models';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule, MatMenuModule],
  templateUrl: './theme-toggle.component.html',
  styleUrls: ['./theme-toggle.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThemeToggleComponent {
  public readonly themeMode$: Observable<ThemeMode>;
  public readonly activeTheme$: Observable<ActiveTheme>;

  constructor(private themeService: ThemeService) {
    this.themeMode$ = this.themeService.themeMode$;
    this.activeTheme$ = this.themeService.activeTheme$;
  }

  /**
   * Set theme mode.
   */
  public setThemeMode(mode: ThemeMode): void {
    this.themeService.setThemeMode(mode);
  }

  /**
   * Get icon for current theme.
   */
  public getThemeIcon(mode: ThemeMode, activeTheme: ActiveTheme): string {
    if (mode === 'system') {
      return 'brightness_auto';
    }
    return activeTheme === 'light' ? 'light_mode' : 'dark_mode';
  }

  /**
   * Get accessible label for current theme.
   */
  public getThemeLabel(mode: ThemeMode, activeTheme: ActiveTheme): string {
    if (mode === 'system') {
      return `System theme (currently ${activeTheme})`;
    }
    return `${mode.charAt(0).toUpperCase() + mode.slice(1)} theme`;
  }

  /**
   * Get tooltip for theme button.
   */
  public getTooltip(mode: ThemeMode): string {
    return `Current theme: ${mode}. Click to change theme.`;
  }

  /**
   * Check if theme mode is selected.
   */
  public isSelected(currentMode: ThemeMode, targetMode: ThemeMode): boolean {
    return currentMode === targetMode;
  }
}
