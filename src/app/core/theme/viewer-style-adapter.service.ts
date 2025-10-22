/**
 * AGILE3D Viewer Style Adapter Service
 *
 * Adapts CSS design tokens to Three.js-compatible color values.
 * Provides real-time color updates when theme changes.
 *
 * This service bridges the gap between CSS color variables and Three.js Color objects,
 * ensuring that 3D viewers use the same color palette as the rest of the application.
 *
 * PRD References:
 * - WP-1.3.1: Visual Design System & Theme
 * - FR-1.3: 3D bounding box color coding
 * - UI-8.2: Consistent visual identity
 */

import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Color } from 'three';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ThemeService } from './theme.service';
import { ObjectClass, ObjectClassColor } from './theme.models';

/**
 * Color information for Three.js rendering.
 */
export interface ViewerColorConfig {
  vehicle: Color;
  pedestrian: Color;
  cyclist: Color;
  background: Color;
  grid: Color;
  axisX: Color;
  axisY: Color;
  axisZ: Color;
}

/**
 * Motion configuration for Three.js animations.
 */
export interface ViewerMotionConfig {
  enabled: boolean;
  cameraDuration: number;
  cameraEasing: string;
  objectDuration: number;
  objectEasing: string;
}

@Injectable({
  providedIn: 'root',
})
export class ViewerStyleAdapterService {
  private readonly isBrowser: boolean;

  // Observable of viewer color configuration
  public readonly viewerColors$: Observable<ViewerColorConfig>;

  // Observable of viewer motion configuration
  public readonly viewerMotion$: Observable<ViewerMotionConfig>;

  private readonly platformId = inject(PLATFORM_ID);
  private readonly themeService = inject(ThemeService);

  public constructor() {
    this.isBrowser = isPlatformBrowser(this.platformId);

    // Create observable that updates when theme changes
    this.viewerColors$ = this.themeService.activeTheme$.pipe(map(() => this.getViewerColors()));

    // Create observable that updates when reduced motion changes
    this.viewerMotion$ = this.themeService.reducedMotion$.pipe(
      map((reducedMotion) => this.getViewerMotionConfig(reducedMotion))
    );
  }

  /**
   * Get current viewer color configuration.
   */
  public getViewerColors(): ViewerColorConfig {
    return {
      vehicle: this.getColorFromCSS('--ag3d-color-class-vehicle'),
      pedestrian: this.getColorFromCSS('--ag3d-color-class-pedestrian'),
      cyclist: this.getColorFromCSS('--ag3d-color-class-cyclist'),
      background: this.getColorFromCSS('--ag3d-color-viewer-background'),
      grid: this.getColorFromCSS('--ag3d-color-viewer-grid'),
      axisX: this.getColorFromCSS('--ag3d-color-viewer-axis-x'),
      axisY: this.getColorFromCSS('--ag3d-color-viewer-axis-y'),
      axisZ: this.getColorFromCSS('--ag3d-color-viewer-axis-z'),
    };
  }

  /**
   * Get viewer motion configuration based on reduced motion preference.
   */
  public getViewerMotionConfig(reducedMotion: boolean): ViewerMotionConfig {
    if (reducedMotion) {
      return {
        enabled: false,
        cameraDuration: 0.01,
        cameraEasing: 'linear',
        objectDuration: 0.01,
        objectEasing: 'linear',
      };
    }

    return {
      enabled: true,
      cameraDuration: this.getDurationFromCSS('--ag3d-viewer-camera-duration'),
      cameraEasing: this.getEasingFromCSS('--ag3d-viewer-camera-easing'),
      objectDuration: this.getDurationFromCSS('--ag3d-viewer-object-duration'),
      objectEasing: this.getEasingFromCSS('--ag3d-viewer-object-easing'),
    };
  }

  /**
   * Get color for specific object class.
   */
  public getObjectClassColor(objectClass: ObjectClass): Color {
    const cssVariable = `--ag3d-color-class-${objectClass}`;
    return this.getColorFromCSS(cssVariable);
  }

  /**
   * Get detailed color information for object class.
   */
  public getObjectClassColorInfo(objectClass: ObjectClass): ObjectClassColor {
    const color = this.getObjectClassColor(objectClass);
    const hex = '#' + color.getHexString();

    return {
      class: objectClass,
      hex,
      rgb: {
        r: Math.round(color.r * 255),
        g: Math.round(color.g * 255),
        b: Math.round(color.b * 255),
      },
      hsl: this.rgbToHsl(color.r, color.g, color.b),
    };
  }

  /**
   * Get all object class colors.
   */
  public getAllObjectClassColors(): ObjectClassColor[] {
    const classes: ObjectClass[] = ['vehicle', 'pedestrian', 'cyclist'];
    return classes.map((cls) => this.getObjectClassColorInfo(cls));
  }

  /**
   * Read CSS color variable and convert to Three.js Color.
   */
  private getColorFromCSS(cssVariable: string): Color {
    if (!this.isBrowser) {
      return new Color(0xffffff); // Default white for SSR
    }

    const cssValue = this.getCSSVariable(cssVariable);
    if (!cssValue) {
      console.warn(`CSS variable ${cssVariable} not found, using default color`);
      return new Color(0xffffff);
    }

    return this.parseColor(cssValue);
  }

  /**
   * Read CSS duration variable and convert to milliseconds.
   */
  private getDurationFromCSS(cssVariable: string): number {
    if (!this.isBrowser) return 0;

    const cssValue = this.getCSSVariable(cssVariable);
    if (!cssValue) return 0;

    // Parse duration (supports ms and s)
    const match = cssValue.match(/^([\d.]+)(ms|s)$/);
    if (!match || !match[1] || !match[2]) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2];

    return unit === 's' ? value * 1000 : value;
  }

  /**
   * Read CSS easing variable.
   */
  private getEasingFromCSS(cssVariable: string): string {
    if (!this.isBrowser) return 'linear';

    const cssValue = this.getCSSVariable(cssVariable);
    return cssValue || 'linear';
  }

  /**
   * Get CSS variable value from document.
   */
  private getCSSVariable(variableName: string): string {
    if (!this.isBrowser) return '';

    const value = getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();

    return value;
  }

  /**
   * Parse CSS color value into Three.js Color.
   * Supports hex, rgb, rgba, hsl, hsla formats.
   */
  private parseColor(cssColor: string): Color {
    const color = new Color();

    // Remove whitespace
    const cleanColor = cssColor.trim();

    try {
      // Try parsing as hex or named color
      if (cleanColor.startsWith('#') || !cleanColor.includes('(')) {
        color.set(cleanColor);
        return color;
      }

      // Parse HSL/HSLA
      if (cleanColor.startsWith('hsl')) {
        const hsl = this.parseHSL(cleanColor);
        if (hsl) {
          color.setHSL(hsl.h / 360, hsl.s / 100, hsl.l / 100);
          return color;
        }
      }

      // Parse RGB/RGBA
      if (cleanColor.startsWith('rgb')) {
        const rgb = this.parseRGB(cleanColor);
        if (rgb) {
          color.setRGB(rgb.r / 255, rgb.g / 255, rgb.b / 255);
          return color;
        }
      }

      // Fallback: try Three.js built-in parser
      color.set(cleanColor);
    } catch (error) {
      console.warn(`Failed to parse color: ${cssColor}`, error);
      color.set(0xffffff); // Default to white
    }

    return color;
  }

  /**
   * Parse HSL/HSLA color string.
   */
  private parseHSL(hslString: string): { h: number; s: number; l: number } | null {
    const match = hslString.match(
      /hsla?\(\s*([\d.]+)\s*,?\s*([\d.]+)%?\s*,?\s*([\d.]+)%?\s*(?:,?\s*\/?\s*([\d.]+%?))?\s*\)/
    );

    if (!match || !match[1] || !match[2] || !match[3]) return null;

    return {
      h: parseFloat(match[1]),
      s: parseFloat(match[2]),
      l: parseFloat(match[3]),
    };
  }

  /**
   * Parse RGB/RGBA color string.
   */
  private parseRGB(rgbString: string): { r: number; g: number; b: number } | null {
    const match = rgbString.match(
      /rgba?\(\s*([\d.]+)\s*,?\s*([\d.]+)\s*,?\s*([\d.]+)\s*(?:,?\s*\/?\s*([\d.]+))?\s*\)/
    );

    if (!match || !match[1] || !match[2] || !match[3]) return null;

    return {
      r: parseFloat(match[1]),
      g: parseFloat(match[2]),
      b: parseFloat(match[3]),
    };
  }

  /**
   * Convert RGB to HSL.
   */
  private rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;

    if (max === min) {
      return { h: 0, s: 0, l: l * 100 };
    }

    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    let h: number;
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
      default:
        h = 0;
    }

    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100),
    };
  }
}
