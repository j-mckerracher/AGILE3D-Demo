/**
 * AGILE3D Theme Models
 *
 * Type definitions and interfaces for theme management.
 *
 * PRD References:
 * - WP-1.3.1: Visual Design System & Theme
 * - NFR-3.7: Respect prefers-reduced-motion
 */

/**
 * Available theme modes.
 */
export type ThemeMode = 'light' | 'dark' | 'system';

/**
 * Active theme (resolved from ThemeMode).
 */
export type ActiveTheme = 'light' | 'dark';

/**
 * Theme configuration interface.
 */
export interface ThemeConfig {
  mode: ThemeMode;
  reducedMotion: boolean;
}

/**
 * Object class types for color coding (PRD FR-1.3).
 */
export type ObjectClass = 'vehicle' | 'pedestrian' | 'cyclist';

/**
 * Object class color configuration.
 */
export interface ObjectClassColor {
  class: ObjectClass;
  hex: string;
  rgb: { r: number; g: number; b: number };
  hsl: { h: number; s: number; l: number };
}

/**
 * CSS custom property name mapping.
 */
export type CSSVariableMap = Record<string, string>;

/**
 * Theme change event data.
 */
export interface ThemeChangeEvent {
  previousTheme: ActiveTheme;
  currentTheme: ActiveTheme;
  mode: ThemeMode;
  timestamp: number;
}

/**
 * Reduced motion change event data.
 */
export interface ReducedMotionChangeEvent {
  reducedMotion: boolean;
  source: 'user' | 'system';
  timestamp: number;
}
