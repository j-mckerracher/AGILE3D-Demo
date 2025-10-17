# AGILE3D Design Tokens Reference

This document provides a comprehensive reference for all design tokens in the AGILE3D design system.

## Table of Contents

- [Colors](#colors)
- [Typography](#typography)
- [Spacing](#spacing)
- [Border Radius](#border-radius)
- [Elevation (Shadows)](#elevation-shadows)
- [Motion & Animation](#motion--animation)

---

## Colors

### Primary Colors (Deep Blue)

```scss
--ag3d-color-primary-50: hsl(222 84% 97%)
--ag3d-color-primary-100: hsl(222 84% 93%)
--ag3d-color-primary-200: hsl(222 84% 86%)
--ag3d-color-primary-300: hsl(222 84% 76%)
--ag3d-color-primary-400: hsl(222 84% 66%)
--ag3d-color-primary-500: hsl(222 84% 56%)  // Base primary
--ag3d-color-primary-600: hsl(222 84% 46%)  // Main brand color
--ag3d-color-primary-700: hsl(222 84% 36%)
--ag3d-color-primary-800: hsl(222 84% 26%)
--ag3d-color-primary-900: hsl(222 84% 16%)
```

### Secondary Colors (Teal)

```scss
--ag3d-color-secondary-50: hsl(173 80% 97%)
--ag3d-color-secondary-100: hsl(173 80% 93%)
--ag3d-color-secondary-200: hsl(173 80% 86%)
--ag3d-color-secondary-300: hsl(173 80% 76%)
--ag3d-color-secondary-400: hsl(173 80% 56%)
--ag3d-color-secondary-500: hsl(173 80% 46%)
--ag3d-color-secondary-600: hsl(173 80% 36%)  // Main secondary
--ag3d-color-secondary-700: hsl(173 80% 26%)
--ag3d-color-secondary-800: hsl(173 80% 16%)
--ag3d-color-secondary-900: hsl(173 80% 10%)
```

### Object Classification Colors (CVD-Safe)

**Vehicles - Blue Family**
```scss
--ag3d-color-class-vehicle: hsl(217 91% 60%)        // #3b82f6
--ag3d-color-class-vehicle-light: hsl(217 91% 70%)
--ag3d-color-class-vehicle-dark: hsl(217 91% 50%)
```

**Pedestrians - Amber Family** (CVD-safe alternative to red)
```scss
--ag3d-color-class-pedestrian: hsl(38 92% 50%)      // #f59e0b
--ag3d-color-class-pedestrian-light: hsl(38 92% 60%)
--ag3d-color-class-pedestrian-dark: hsl(38 92% 40%)
```

**Cyclists - Green Family** (CVD-safe alternative to orange)
```scss
--ag3d-color-class-cyclist: hsl(158 64% 52%)        // #10b981
--ag3d-color-class-cyclist-light: hsl(158 64% 62%)
--ag3d-color-class-cyclist-dark: hsl(158 64% 42%)
```

### Neutral Scale

```scss
--ag3d-color-neutral-0: hsl(0 0% 100%)      // White
--ag3d-color-neutral-50: hsl(0 0% 98%)
--ag3d-color-neutral-100: hsl(0 0% 96%)
--ag3d-color-neutral-200: hsl(0 0% 90%)
--ag3d-color-neutral-300: hsl(0 0% 80%)
--ag3d-color-neutral-400: hsl(0 0% 64%)
--ag3d-color-neutral-500: hsl(0 0% 50%)
--ag3d-color-neutral-600: hsl(0 0% 40%)
--ag3d-color-neutral-700: hsl(0 0% 28%)
--ag3d-color-neutral-800: hsl(0 0% 16%)
--ag3d-color-neutral-900: hsl(0 0% 8%)
--ag3d-color-neutral-1000: hsl(0 0% 4%)     // Near-black
```

### Semantic Colors

```scss
// Success
--ag3d-color-success: hsl(142 71% 45%)              // #16a34a
--ag3d-color-success-light: hsl(142 71% 55%)
--ag3d-color-success-dark: hsl(142 71% 35%)

// Warning
--ag3d-color-warning: hsl(45 93% 47%)               // #eab308
--ag3d-color-warning-light: hsl(45 93% 57%)
--ag3d-color-warning-dark: hsl(45 93% 37%)

// Error
--ag3d-color-error: hsl(0 84% 60%)                  // #ef4444
--ag3d-color-error-light: hsl(0 84% 65%)
--ag3d-color-error-dark: hsl(0 84% 50%)

// Info
--ag3d-color-info: hsl(199 89% 48%)                 // #06b6d4
--ag3d-color-info-light: hsl(199 89% 58%)
--ag3d-color-info-dark: hsl(199 89% 38%)
```

### Surface & UI Colors

Theme-specific, see [Theme Usage Guide](./theme-usage.md) for light/dark variants.

```scss
--ag3d-color-surface-base
--ag3d-color-surface-raised
--ag3d-color-surface-overlay
--ag3d-color-surface-disabled
--ag3d-color-border
--ag3d-color-border-strong
--ag3d-color-divider
--ag3d-color-text-primary
--ag3d-color-text-secondary
--ag3d-color-text-disabled
--ag3d-color-text-on-primary
--ag3d-color-focus
--ag3d-color-focus-ring
```

---

## Typography

### Font Families

```scss
--ag3d-font-family-base: 'Roboto', 'Helvetica Neue', Arial, sans-serif
--ag3d-font-family-mono: 'Roboto Mono', 'Consolas', 'Monaco', monospace
```

### Font Weights

```scss
--ag3d-font-weight-light: 300
--ag3d-font-weight-regular: 400
--ag3d-font-weight-medium: 500
--ag3d-font-weight-semibold: 600
--ag3d-font-weight-bold: 700
```

### Type Scale

| Category | Size | Line Height | Weight | Use Case |
|----------|------|-------------|--------|----------|
| Display Large | 56px | 64px | 400 | Hero sections |
| Display Medium | 45px | 52px | 400 | Large headlines |
| Display Small | 36px | 44px | 400 | Section headers |
| Headline Large | 32px | 40px | 400 | Page titles |
| Headline Medium | 28px | 36px | 400 | Section titles |
| Headline Small | 24px | 32px | 400 | Card headers |
| Title Large | 22px | 28px | 400 | Subsection titles |
| Title Medium | 16px | 24px | 500 | Component titles |
| Title Small | 14px | 20px | 500 | Small headers |
| Body Large | 16px | 24px | 400 | Main content |
| Body Medium | 14px | 20px | 400 | Secondary content |
| Body Small | 12px | 16px | 400 | Captions |
| Label Large | 14px | 20px | 500 | Button text |
| Label Medium | 12px | 16px | 500 | Form labels |
| Label Small | 11px | 16px | 500 | Metadata |

---

## Spacing

Based on 8px grid system (1 unit = 8px).

```scss
--ag3d-space-0: 0           // 0px
--ag3d-space-1: 0.125rem    // 2px
--ag3d-space-2: 0.25rem     // 4px
--ag3d-space-4: 0.5rem      // 8px (1 unit)
--ag3d-space-8: 1rem        // 16px (2 units)
--ag3d-space-12: 1.5rem     // 24px (3 units)
--ag3d-space-16: 2rem       // 32px (4 units)
--ag3d-space-20: 2.5rem     // 40px (5 units)
--ag3d-space-24: 3rem       // 48px (6 units)
--ag3d-space-32: 4rem       // 64px (8 units)
--ag3d-space-40: 5rem       // 80px (10 units)
--ag3d-space-48: 6rem       // 96px (12 units)
--ag3d-space-64: 8rem       // 128px (16 units)
```

### Semantic Spacing

```scss
--ag3d-space-xs: 8px
--ag3d-space-sm: 16px
--ag3d-space-md: 32px
--ag3d-space-lg: 48px
--ag3d-space-xl: 64px
```

---

## Border Radius

```scss
--ag3d-radius-none: 0
--ag3d-radius-xs: 2px
--ag3d-radius-sm: 4px
--ag3d-radius-md: 6px       // Default
--ag3d-radius-lg: 8px
--ag3d-radius-xl: 12px
--ag3d-radius-2xl: 16px
--ag3d-radius-3xl: 24px
--ag3d-radius-full: 9999px  // Fully rounded
```

### Component-Specific

```scss
--ag3d-radius-button: 6px
--ag3d-radius-card: 8px
--ag3d-radius-input: 4px
--ag3d-radius-chip: 9999px
--ag3d-radius-dialog: 12px
```

---

## Elevation (Shadows)

```scss
--ag3d-elevation-0: none                            // No shadow
--ag3d-elevation-1: 0 1px 2px 0 rgba(0,0,0,0.05)   // Subtle lift
--ag3d-elevation-2: 0 1px 3px 0 rgba(0,0,0,0.1)... // Low elevation
--ag3d-elevation-3: 0 4px 6px -1px rgba(0,0,0,0.1)...
--ag3d-elevation-4: 0 10px 15px -3px rgba(0,0,0,0.1)...
--ag3d-elevation-5: 0 20px 25px -5px rgba(0,0,0,0.1)...
--ag3d-elevation-6: 0 25px 50px -12px rgba(0,0,0,0.25)
```

---

## Motion & Animation

### Durations

```scss
--ag3d-duration-instant: 0ms
--ag3d-duration-fast: 100ms
--ag3d-duration-normal: 200ms
--ag3d-duration-slow: 300ms
--ag3d-duration-slower: 500ms
```

### Easing Curves

```scss
--ag3d-easing-standard: cubic-bezier(0.4, 0, 0.2, 1)      // Default
--ag3d-easing-decelerate: cubic-bezier(0, 0, 0.2, 1)      // Enter
--ag3d-easing-accelerate: cubic-bezier(0.4, 0, 1, 1)      // Exit
--ag3d-easing-sharp: cubic-bezier(0.4, 0, 0.6, 1)         // Quick
--ag3d-easing-linear: linear                               // Constant
```

### Component Transitions

```scss
--ag3d-transition-button     // Background + shadow (100ms)
--ag3d-transition-card       // Shadow + transform (200ms)
--ag3d-transition-input      // Border + shadow (100ms)
--ag3d-transition-fade       // Opacity (200ms)
--ag3d-transition-slide      // Transform (200ms, decelerate)
--ag3d-transition-scale      // Transform (100ms)
--ag3d-transition-color      // Color + background (100ms)
```

---

## Usage Examples

### SCSS

```scss
.my-component {
  color: var(--ag3d-color-text-primary);
  background-color: var(--ag3d-color-surface-base);
  padding: var(--ag3d-space-md);
  border-radius: var(--ag3d-radius-lg);
  box-shadow: var(--ag3d-elevation-2);
  transition: var(--ag3d-transition-card);

  &:hover {
    box-shadow: var(--ag3d-elevation-3);
  }
}
```

### TypeScript (ViewerStyleAdapter)

```typescript
import { ViewerStyleAdapterService } from '@core/theme/viewer-style-adapter.service';

constructor(private viewerStyleAdapter: ViewerStyleAdapterService) {
  // Get colors for 3D rendering
  this.viewerStyleAdapter.viewerColors$.subscribe(colors => {
    this.vehicleColor = colors.vehicle;
    this.pedestrianColor = colors.pedestrian;
    this.cyclistColor = colors.cyclist;
  });
}
```

---

## WCAG 2.2 AA Compliance

All color combinations meet WCAG 2.2 AA requirements:
- **Normal text**: Minimum 4.5:1 contrast ratio
- **Large text**: Minimum 3:1 contrast ratio
- **UI components**: Minimum 3:1 contrast ratio

Object class colors are CVD-safe (color-blind friendly).
