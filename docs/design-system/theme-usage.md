# AGILE3D Theme Usage Guide

This guide explains how to use the theme system in the AGILE3D Interactive Demo.

## Table of Contents

- [Overview](#overview)
- [ThemeService](#themeservice)
- [Theme Modes](#theme-modes)
- [Reduced Motion](#reduced-motion)
- [ViewerStyleAdapter](#viewerstyleadapter)
- [Components](#components)
- [Best Practices](#best-practices)

---

## Overview

The AGILE3D theme system provides:

- **Light/Dark Themes**: Automatic theme switching with system preference detection
- **Reduced Motion**: Respects user's motion preferences for accessibility
- **3D Integration**: Seamless color synchronization with Three.js viewers
- **Persistence**: Theme preferences saved to localStorage
- **Reactive**: RxJS observables for real-time updates

---

## ThemeService

The `ThemeService` is the central service for theme management.

### Basic Usage

```typescript
import { Component } from '@angular/core';
import { ThemeService } from '@core/theme/theme.service';

@Component({
  selector: 'app-my-component',
  template: `
    <div>
      <p>Current theme: {{ activeTheme$ | async }}</p>
      <p>Theme mode: {{ themeMode$ | async }}</p>
      <p>Reduced motion: {{ reducedMotion$ | async }}</p>
    </div>
  `
})
export class MyComponent {
  activeTheme$ = this.themeService.activeTheme$;
  themeMode$ = this.themeService.themeMode$;
  reducedMotion$ = this.themeService.reducedMotion$;

  constructor(private themeService: ThemeService) {}
}
```

### Setting Theme Mode

```typescript
// Set explicit theme
this.themeService.setThemeMode('light');
this.themeService.setThemeMode('dark');
this.themeService.setThemeMode('system');

// Toggle theme
this.themeService.toggleTheme();

// Get current mode
const mode = this.themeService.getThemeMode(); // 'light' | 'dark' | 'system'
const active = this.themeService.getActiveTheme(); // 'light' | 'dark'
```

### Listening to Theme Changes

```typescript
this.themeService.themeChange$.subscribe(event => {
  console.log('Theme changed:', {
    from: event.previousTheme,
    to: event.currentTheme,
    mode: event.mode,
    timestamp: event.timestamp
  });
});
```

---

## Theme Modes

### Light Theme

Optimized for bright environments with high contrast and readability.

```scss
.ag3d-theme-light {
  --ag3d-color-surface-base: hsl(0 0% 100%);      // White
  --ag3d-color-text-primary: hsl(0 0% 8%);        // Near-black
  --ag3d-color-border: hsl(0 0% 90%);             // Light gray
}
```

### Dark Theme

Reduced eye strain in low-light environments with OLED-friendly colors.

```scss
.ag3d-theme-dark {
  --ag3d-color-surface-base: hsl(0 0% 8%);        // Dark gray
  --ag3d-color-text-primary: hsl(0 0% 98%);       // Off-white
  --ag3d-color-border: hsl(0 0% 28%);             // Medium gray
}
```

### System Theme

Automatically follows the user's operating system preference.

```typescript
// Detect system preference
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

// Service handles this automatically when mode is 'system'
this.themeService.setThemeMode('system');
```

---

## Reduced Motion

Respects `prefers-reduced-motion` for users with vestibular disorders.

### Setting Reduced Motion

```typescript
// Enable reduced motion
this.themeService.setReducedMotion(true);

// Toggle reduced motion
this.themeService.toggleReducedMotion();

// Check current state
const isReduced = this.themeService.isReducedMotion();
```

### Listening to Reduced Motion Changes

```typescript
this.themeService.reducedMotionChange$.subscribe(event => {
  console.log('Reduced motion changed:', {
    enabled: event.reducedMotion,
    source: event.source, // 'user' | 'system'
    timestamp: event.timestamp
  });
});
```

### In Animations

```scss
.my-animated-element {
  transition: transform var(--ag3d-duration-normal) var(--ag3d-easing-standard);
}

// Automatically respects reduced motion via CSS variables
@media (prefers-reduced-motion: reduce) {
  :root {
    --ag3d-duration-normal: 0.01ms;
  }
}
```

---

## ViewerStyleAdapter

The `ViewerStyleAdapterService` bridges CSS design tokens to Three.js colors.

### Getting Viewer Colors

```typescript
import { ViewerStyleAdapterService } from '@core/theme/viewer-style-adapter.service';

constructor(private viewerStyleAdapter: ViewerStyleAdapterService) {
  // Subscribe to color updates
  this.viewerStyleAdapter.viewerColors$.subscribe(colors => {
    this.scene.background = colors.background;
    this.vehicleMaterial.color = colors.vehicle;
    this.pedestrianMaterial.color = colors.pedestrian;
    this.cyclistMaterial.color = colors.cyclist;
  });
}
```

### Getting Motion Configuration

```typescript
this.viewerStyleAdapter.viewerMotion$.subscribe(motion => {
  if (motion.enabled) {
    // Enable animations
    this.camera.animationDuration = motion.cameraDuration;
  } else {
    // Disable animations
    this.camera.animationDuration = 0;
  }
});
```

### Getting Object Class Colors

```typescript
// Get single class color
const vehicleColor = this.viewerStyleAdapter.getObjectClassColor('vehicle');

// Get detailed color info
const colorInfo = this.viewerStyleAdapter.getObjectClassColorInfo('vehicle');
console.log(colorInfo);
// {
//   class: 'vehicle',
//   hex: '#3b82f6',
//   rgb: { r: 59, g: 130, b: 246 },
//   hsl: { h: 217, s: 91, l: 60 }
// }

// Get all object class colors
const allColors = this.viewerStyleAdapter.getAllObjectClassColors();
```

---

## Components

### Theme Toggle Component

Pre-built component for theme switching.

```html
<!-- In your template -->
<app-theme-toggle></app-theme-toggle>
```

```typescript
import { ThemeToggleComponent } from '@shared/components/theme-toggle/theme-toggle.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [ThemeToggleComponent],
  template: `
    <header>
      <h1>AGILE3D</h1>
      <app-theme-toggle></app-theme-toggle>
    </header>
  `
})
export class HeaderComponent {}
```

### Legend Component

Displays object class color legend.

```html
<!-- Basic usage -->
<app-legend></app-legend>

<!-- With options -->
<app-legend
  [layout]="'vertical'"
  [showIcons]="true"
  [showDescriptions]="true"
  [title]="'Object Classes'"
></app-legend>
```

```typescript
import { LegendComponent } from '@shared/components/legend/legend.component';

@Component({
  selector: 'app-viewer',
  standalone: true,
  imports: [LegendComponent],
  template: `
    <div class="viewer-container">
      <canvas #viewerCanvas></canvas>
      <app-legend [layout]="'horizontal'"></app-legend>
    </div>
  `
})
export class ViewerComponent {}
```

---

## Best Practices

### 1. Always Use Design Tokens

❌ **Don't hardcode colors:**
```scss
.my-component {
  color: #1e3a8a;
  background-color: white;
}
```

✅ **Use design tokens:**
```scss
.my-component {
  color: var(--ag3d-color-primary-600);
  background-color: var(--ag3d-color-surface-base);
}
```

### 2. Subscribe in OnInit, Unsubscribe in OnDestroy

```typescript
export class MyComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  ngOnInit() {
    this.themeService.activeTheme$
      .pipe(takeUntil(this.destroy$))
      .subscribe(theme => {
        // Handle theme change
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
```

### 3. Use Async Pipe for Templates

✅ **Preferred:**
```html
<div [class.dark]="(activeTheme$ | async) === 'dark'">
  Content
</div>
```

### 4. Respect Reduced Motion

```typescript
// In your animation logic
this.themeService.reducedMotion$.subscribe(reducedMotion => {
  if (reducedMotion) {
    // Disable or minimize animations
    this.animationDuration = 0;
  } else {
    // Enable full animations
    this.animationDuration = 500;
  }
});
```

### 5. Test with Both Themes

Always test components in both light and dark themes:

```typescript
describe('MyComponent', () => {
  it('should work in light theme', () => {
    themeService.setThemeMode('light');
    // Test component
  });

  it('should work in dark theme', () => {
    themeService.setThemeMode('dark');
    // Test component
  });
});
```

---

## Troubleshooting

### Theme Not Applying

1. Check that `styles/_index.scss` is imported in `styles.scss`
2. Verify `ThemeService` is provided in root
3. Ensure component styles use CSS variables correctly

### Colors Not Updating in 3D Viewer

1. Verify subscription to `viewerColors$`
2. Check that Three.js materials are being updated
3. Ensure `material.needsUpdate = true` is called after color changes

### Reduced Motion Not Working

1. Check browser's `prefers-reduced-motion` setting
2. Verify CSS motion tokens are being used
3. Test with `themeService.setReducedMotion(true)` directly

---

## API Reference

### ThemeService

| Method | Returns | Description |
|--------|---------|-------------|
| `setThemeMode(mode)` | `void` | Set theme mode |
| `toggleTheme()` | `void` | Toggle between light/dark |
| `getThemeMode()` | `ThemeMode` | Get current mode |
| `getActiveTheme()` | `ActiveTheme` | Get active theme |
| `setReducedMotion(enabled)` | `void` | Set reduced motion |
| `toggleReducedMotion()` | `void` | Toggle reduced motion |
| `isReducedMotion()` | `boolean` | Check if reduced motion |
| `getThemeConfig()` | `ThemeConfig` | Get full config |

### ViewerStyleAdapterService

| Method | Returns | Description |
|--------|---------|-------------|
| `getViewerColors()` | `ViewerColorConfig` | Get all viewer colors |
| `getViewerMotionConfig(reduced)` | `ViewerMotionConfig` | Get motion config |
| `getObjectClassColor(class)` | `Color` | Get Three.js color |
| `getObjectClassColorInfo(class)` | `ObjectClassColor` | Get color info |
| `getAllObjectClassColors()` | `ObjectClassColor[]` | Get all colors |

---

## See Also

- [Design Tokens Reference](./tokens.md)
- [Accessibility Checklist](./accessibility-checklist.md)
- [Angular Material Theming Guide](https://material.angular.io/guide/theming)
