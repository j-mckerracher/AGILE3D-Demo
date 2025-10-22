/**
 * AGILE3D Theme Service
 *
 * Manages application theming including:
 * - Light/dark theme switching
 * - System preference detection (prefers-color-scheme)
 * - Theme persistence via localStorage
 * - Reduced motion preference handling (prefers-reduced-motion)
 * - Integration with Angular Material OverlayContainer
 *
 * PRD References:
 * - WP-1.3.1: Visual Design System & Theme
 * - NFR-3.7: Respect prefers-reduced-motion
 * - UI-8.2: Consistent visual identity
 */

import { Injectable, PLATFORM_ID, OnDestroy, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { OverlayContainer } from '@angular/cdk/overlay';
import { BehaviorSubject, Observable, fromEvent, Subject } from 'rxjs';
import { takeUntil, map, distinctUntilChanged } from 'rxjs/operators';
import {
  ThemeMode,
  ActiveTheme,
  ThemeConfig,
  ThemeChangeEvent,
  ReducedMotionChangeEvent,
} from './theme.models';

const THEME_STORAGE_KEY = 'ag3d-theme-mode';
const REDUCED_MOTION_STORAGE_KEY = 'ag3d-reduced-motion';
const LIGHT_THEME_CLASS = 'ag3d-theme-light';
const DARK_THEME_CLASS = 'ag3d-theme-dark';

@Injectable({
  providedIn: 'root',
})
export class ThemeService implements OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly isBrowser: boolean;

  // Theme state
  private readonly themeModeSubject = new BehaviorSubject<ThemeMode>('system');
  private readonly activeThemeSubject = new BehaviorSubject<ActiveTheme>('light');
  private readonly reducedMotionSubject = new BehaviorSubject<boolean>(false);

  // Public observables
  public readonly themeMode$: Observable<ThemeMode> = this.themeModeSubject.asObservable();
  public readonly activeTheme$: Observable<ActiveTheme> = this.activeThemeSubject.asObservable();
  public readonly reducedMotion$: Observable<boolean> = this.reducedMotionSubject.asObservable();

  // Theme change events
  private readonly themeChangeSubject = new Subject<ThemeChangeEvent>();
  public readonly themeChange$: Observable<ThemeChangeEvent> =
    this.themeChangeSubject.asObservable();

  // Reduced motion change events
  private readonly reducedMotionChangeSubject = new Subject<ReducedMotionChangeEvent>();
  public readonly reducedMotionChange$: Observable<ReducedMotionChangeEvent> =
    this.reducedMotionChangeSubject.asObservable();

  private readonly platformId = inject(PLATFORM_ID);
  private readonly overlayContainer = inject(OverlayContainer);

  public constructor() {
    this.isBrowser = isPlatformBrowser(this.platformId);
    if (this.isBrowser) {
      this.initializeTheme();
      this.initializeReducedMotion();
      this.watchSystemPreferences();
    }
  }

  /**
   * Initialize theme from localStorage or system preference.
   */
  private initializeTheme(): void {
    const storedMode = this.getStoredThemeMode();
    const mode = storedMode || 'system';
    this.themeModeSubject.next(mode);

    const activeTheme = this.resolveActiveTheme(mode);
    this.applyTheme(activeTheme);
  }

  /**
   * Initialize reduced motion preference from localStorage or system.
   */
  private initializeReducedMotion(): void {
    const storedPreference = this.getStoredReducedMotion();
    if (storedPreference !== null) {
      this.reducedMotionSubject.next(storedPreference);
    } else {
      // Detect system preference
      const prefersReducedMotion = this.getSystemReducedMotionPreference();
      this.reducedMotionSubject.next(prefersReducedMotion);
    }
  }

  /**
   * Watch for system preference changes.
   */
  private watchSystemPreferences(): void {
    // Watch color scheme changes
    const colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    fromEvent<MediaQueryListEvent>(colorSchemeQuery, 'change')
      .pipe(
        map((event) => event.matches),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        // Only react if in system mode
        if (this.themeModeSubject.value === 'system') {
          const activeTheme = this.resolveActiveTheme('system');
          this.applyTheme(activeTheme);
        }
      });

    // Watch reduced motion changes
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    fromEvent<MediaQueryListEvent>(reducedMotionQuery, 'change')
      .pipe(
        map((event) => event.matches),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe((prefersReducedMotion) => {
        // Only update if user hasn't set explicit preference
        const storedPreference = this.getStoredReducedMotion();
        if (storedPreference === null) {
          this.setReducedMotion(prefersReducedMotion, 'system');
        }
      });
  }

  /**
   * Set theme mode (light, dark, or system).
   */
  public setThemeMode(mode: ThemeMode): void {
    const previousTheme = this.activeThemeSubject.value;
    this.themeModeSubject.next(mode);
    this.storeThemeMode(mode);

    const activeTheme = this.resolveActiveTheme(mode);
    this.applyTheme(activeTheme);

    // Emit theme change event
    this.themeChangeSubject.next({
      previousTheme,
      currentTheme: activeTheme,
      mode,
      timestamp: Date.now(),
    });
  }

  /**
   * Toggle between light and dark themes.
   * If in system mode, switches to explicit light/dark.
   */
  public toggleTheme(): void {
    const currentMode = this.themeModeSubject.value;
    const currentActiveTheme = this.activeThemeSubject.value;

    // If system mode, toggle to opposite of current active theme
    if (currentMode === 'system') {
      const newMode: ThemeMode = currentActiveTheme === 'light' ? 'dark' : 'light';
      this.setThemeMode(newMode);
    } else {
      // Toggle between light and dark
      const newMode: ThemeMode = currentMode === 'light' ? 'dark' : 'light';
      this.setThemeMode(newMode);
    }
  }

  /**
   * Set reduced motion preference.
   */
  public setReducedMotion(enabled: boolean, source: 'user' | 'system' = 'user'): void {
    this.reducedMotionSubject.next(enabled);
    if (source === 'user') {
      this.storeReducedMotion(enabled);
    }

    this.reducedMotionChangeSubject.next({
      reducedMotion: enabled,
      source,
      timestamp: Date.now(),
    });
  }

  /**
   * Toggle reduced motion preference.
   */
  public toggleReducedMotion(): void {
    const current = this.reducedMotionSubject.value;
    this.setReducedMotion(!current, 'user');
  }

  /**
   * Get current theme configuration.
   */
  public getThemeConfig(): ThemeConfig {
    return {
      mode: this.themeModeSubject.value,
      reducedMotion: this.reducedMotionSubject.value,
    };
  }

  /**
   * Get current theme mode.
   */
  public getThemeMode(): ThemeMode {
    return this.themeModeSubject.value;
  }

  /**
   * Get current active theme.
   */
  public getActiveTheme(): ActiveTheme {
    return this.activeThemeSubject.value;
  }

  /**
   * Check if reduced motion is enabled.
   */
  public isReducedMotion(): boolean {
    return this.reducedMotionSubject.value;
  }

  /**
   * Resolve active theme from mode.
   */
  private resolveActiveTheme(mode: ThemeMode): ActiveTheme {
    if (mode === 'system') {
      return this.getSystemThemePreference();
    }
    return mode;
  }

  /**
   * Apply theme to DOM.
   */
  private applyTheme(theme: ActiveTheme): void {
    if (!this.isBrowser) return;

    this.activeThemeSubject.next(theme);

    // Update document element class
    const htmlElement = document.documentElement;
    htmlElement.classList.remove(LIGHT_THEME_CLASS, DARK_THEME_CLASS);
    htmlElement.classList.add(theme === 'light' ? LIGHT_THEME_CLASS : DARK_THEME_CLASS);

    // Update overlay container (for Material overlays like dialogs, menus)
    const overlayContainerElement = this.overlayContainer.getContainerElement();
    overlayContainerElement.classList.remove(LIGHT_THEME_CLASS, DARK_THEME_CLASS);
    overlayContainerElement.classList.add(theme === 'light' ? LIGHT_THEME_CLASS : DARK_THEME_CLASS);

    // Update color-scheme for native controls
    htmlElement.style.colorScheme = theme;
  }

  /**
   * Get system theme preference.
   */
  private getSystemThemePreference(): ActiveTheme {
    if (!this.isBrowser) return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  /**
   * Get system reduced motion preference.
   */
  private getSystemReducedMotionPreference(): boolean {
    if (!this.isBrowser) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /**
   * Store theme mode in localStorage.
   */
  private storeThemeMode(mode: ThemeMode): void {
    if (!this.isBrowser) return;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (error) {
      console.warn('Failed to store theme mode:', error);
    }
  }

  /**
   * Get stored theme mode from localStorage.
   */
  private getStoredThemeMode(): ThemeMode | null {
    if (!this.isBrowser) return null;
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        return stored;
      }
    } catch (error) {
      console.warn('Failed to get stored theme mode:', error);
    }
    return null;
  }

  /**
   * Store reduced motion preference in localStorage.
   */
  private storeReducedMotion(enabled: boolean): void {
    if (!this.isBrowser) return;
    try {
      localStorage.setItem(REDUCED_MOTION_STORAGE_KEY, String(enabled));
    } catch (error) {
      console.warn('Failed to store reduced motion preference:', error);
    }
  }

  /**
   * Get stored reduced motion preference from localStorage.
   */
  private getStoredReducedMotion(): boolean | null {
    if (!this.isBrowser) return null;
    try {
      const stored = localStorage.getItem(REDUCED_MOTION_STORAGE_KEY);
      if (stored === 'true') return true;
      if (stored === 'false') return false;
    } catch (error) {
      console.warn('Failed to get stored reduced motion preference:', error);
    }
    return null;
  }

  /**
   * Cleanup on service destroy.
   */
  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
