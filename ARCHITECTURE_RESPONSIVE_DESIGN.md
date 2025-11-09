# AGILE3D-Demo Codebase Architecture & Responsive Design Overview

## 1. PROJECT STRUCTURE & FRAMEWORK

### Framework: Angular 20
- **UI Framework**: Angular 20.3.4 (Standalone Components)
- **Component Architecture**: Standalone components with dependency injection
- **Build Tool**: Angular CLI 20.3.5
- **Configuration**: `angular.json`, `tsconfig.json`

### Key Dependencies:
- **Angular Material 20.2.8**: UI components, form controls, dialogs
- **Three.js 0.179.0**: 3D graphics and rendering (WebGL)
- **Angular-three 4.0.0-next.115**: Angular wrapper for Three.js
- **RxJS 7.8.0**: Reactive programming (Observables)
- **ngxtension 6.0.0**: Angular utility functions
- **Angular CDK 20.2.8**: Component utility functions

### Project Type:
- **Single Page Application (SPA)**
- **Standalone Angular Components** (no NgModule dependencies)
- **Responsive Design**: Mobile-first with progressive enhancement

---

## 2. STYLING APPROACH

### Styling Architecture:
- **Preprocessor**: SCSS (Sass) with CSS Variables (Custom Properties)
- **Theming**: CSS Variables for dynamic theme switching (light/dark)
- **Design System**: AGILE3D Design Tokens system
- **Theme Management**: Light/Dark theme with `ag3d-theme-dark` class
- **Material Integration**: Angular Material theming with custom AGILE3D palettes

### Global Styling Structure:

```
src/styles/
├── _index.scss                 # Main entry point (orchestrator)
├── _accessibility.scss         # WCAG 2.2 AA compliance utilities
├── tokens/
│   ├── _colors.scss           # Color palette and CSS variables
│   ├── _typography.scss       # Font scales, weights, line heights
│   ├── _spacing.scss          # 8px grid system and spacing scale
│   ├── _radius.scss           # Border radius tokens
│   ├── _elevation.scss        # Shadow/elevation tokens
│   └── _motion.scss           # Animation and transition tokens
├── theme/
│   ├── _light.scss            # Light theme overrides
│   ├── _dark.scss             # Dark theme overrides
│   └── _material-theme.scss   # Angular Material integration
└── styles.scss                 # Global application styles
```

### Key Design Tokens:

**Spacing Scale (8px grid)**:
- Base unit: `--ag3d-space-4` = 8px (0.5rem)
- Scale: 0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128px
- Semantic naming: `--ag3d-space-xs`, `--ag3d-space-sm`, `--ag3d-space-md`, `--ag3d-space-lg`, `--ag3d-space-xl`
- Container: `--ag3d-container-max-width: 75rem` (1200px)

**Typography Scale**:
- Font family: Roboto, Roboto Mono
- Weights: 300 (light), 400 (regular), 500 (medium), 600 (semibold), 700 (bold)
- Type scale: Display (56px-36px), Headline (32px-24px), Title, Body, Label
- Material Design 3 inspired scale

**Colors**:
- Primary: `--ag3d-color-primary-600` (main brand color)
- Secondary: `--ag3d-color-secondary-600`
- Semantic: success, warning, error, info
- Object classes: vehicle, pedestrian, cyclist
- Light/Dark theme overrides

**Elevation/Shadows**:
- Multiple shadow levels: `--ag3d-elevation-1` through `--ag3d-elevation-4`
- Card shadows: `--ag3d-shadow-card`, `--ag3d-shadow-card-hover`
- Button shadows: `--ag3d-shadow-button`, `--ag3d-shadow-button-hover`
- Focus shadows: `--ag3d-shadow-focus`

**Border Radius**:
- `--ag3d-radius-sm`: 4px
- `--ag3d-radius-md`: 8px
- `--ag3d-radius-lg`: 12px
- `--ag3d-radius-full`: 9999px (pill buttons)

### Utility Classes:
- Spacing: `.ag3d-mt-*`, `.ag3d-mb-*`, `.ag3d-p-*`
- Flexbox: `.ag3d-flex`, `.ag3d-flex-column`, `.ag3d-flex-center`, `.ag3d-flex-between`
- Grid: `.ag3d-grid`
- Gap: `.ag3d-gap-xs` through `.ag3d-gap-lg`
- Colors: `.ag3d-color-*`, `.ag3d-bg-*`
- Text: `.ag3d-text-primary`, `.ag3d-text-secondary`, `.ag3d-font-bold`
- Surface: `.ag3d-surface-base`, `.ag3d-surface-raised`
- Elevation: `.ag3d-elevation-1` through `.ag3d-elevation-4`
- Accessibility: `.ag3d-sr-only` (screen reader only)

---

## 3. MAIN LAYOUT COMPONENTS

### App Shell Architecture:
```
<app-root> (app.ts / app.html)
├── <app-skip-link>              # Accessibility: skip to content
├── <app-header>                 # Sticky header with branding & theme toggle
├── <app-hero>                   # Hero section with intro content
├── <main class="main-content">  # Main content area (router outlet)
│   └── <app-main-demo>          # Primary demo container
│       ├── <app-dual-viewer>    # Side-by-side 3D viewers
│       └── <div class="controls-and-metrics-row">
│           ├── <app-control-panel>        # Primary + advanced controls
│           └── <app-metrics-dashboard>    # Performance metrics display
└── <app-footer>                 # Footer with links
```

### Header Component (`app-header`):
- **File**: `/src/app/features/header/header.component.ts|html|scss`
- **Layout**: Sticky, flexbox-based with gradient background
- **Key Elements**:
  - Logo/branding (flex: 1)
  - Tagline
  - Navigation area (flex: auto) with theme toggle
  - Responsive: Stacks vertically on mobile (768px breakpoint)
- **Styling**:
  - Position: sticky, top: 0, z-index: 1000
  - Gradient background
  - Responsive padding adjustments

### Hero Component (`app-hero`):
- **File**: `/src/app/features/hero/hero.component.ts|scss`
- **Layout**: Centered content with gradient overlay
- **Elements**:
  - Display title with gradient text effect
  - Description text
  - CTA buttons
  - Statistics grid (auto-fit, minmax 150px)
- **Responsive**: 
  - Desktop: Full display font sizes, multi-column stats
  - Tablet: Reduced font sizes
  - Mobile (768px): Single column, full-width buttons

### Main Demo Component (`app-main-demo`):
- **File**: `/src/app/features/main-demo/main-demo.component.ts|html|scss`
- **Layout**: CSS Grid with 3 rows
  - Row 1: Dual viewer (60vh height, min 500px)
  - Row 2: Controls & metrics (2-column grid, gaps via CSS Grid)
  - Row 3: (reserved for future content)
- **Grid Structure**:
  ```scss
  .main-demo {
    display: grid;
    grid-template-columns: 1fr;
    grid-template-rows: auto auto auto;
    gap: var(--ag3d-space-24);
    padding: var(--ag3d-space-32) var(--ag3d-space-16);
  }
  
  .controls-and-metrics-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--ag3d-space-24);
  }
  ```

### Dual Viewer Component (`app-dual-viewer`):
- **File**: `/src/app/features/dual-viewer/dual-viewer.component.ts`
- **Layout**: Side-by-side comparison with crossfade toggle
- **Features**:
  - Two synchronized 3D viewers (baseline vs. AGILE3D)
  - Legend overlay (fixed position)
  - Crossfade toggle button (center)
  - Responsive: May stack on very small screens
- **Height**: 60vh on desktop, flexible on mobile

### Control Panel Component (`app-control-panel`):
- **File**: `/src/app/features/control-panel/control-panel.component.ts`
- **Internal Template**: Inline styles and template
- **Layout**: 
  - Primary controls: 1-column by default, 2-column on 920px+
  - Grid with gap spacing
  - Scene selector spans full width on large screens
- **Controls**:
  - Scene selector (button toggle group)
  - Voxel size slider (mat-slider)
  - Contention slider with tick labels
  - Latency SLO slider
  - Baseline branch dropdown
  - AGILE3D branch dropdown
- **Advanced Controls**: Child component `app-advanced-controls`
- **Responsive**:
  ```scss
  @media (min-width: 920px) {
    .primary-grid {
      grid-template-columns: 1fr 1fr;
    }
    .scene-group {
      grid-column: 1 / -1;  // Full width
    }
  }
  ```

### Metrics Dashboard Component (`app-metrics-dashboard`):
- **File**: `/src/app/features/metrics-dashboard/metrics-dashboard.component.ts|scss`
- **Layout**: 3-column grid for baseline, comparison, AGILE3D
- **Responsive**:
  ```scss
  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    
    @media (max-width: 1024px) {
      grid-template-columns: 1fr;  // Stack vertically
    }
  }
  ```
- **Child Components**:
  - `baseline-metrics`
  - `comparison-highlights`
  - `agile3d-metrics`
  - `history-trend` (optional historical visualization)

### Footer Component (`app-footer`):
- **File**: `/src/app/features/footer/footer.component.ts|scss`
- **Layout**: Simple footer with links and copyright

---

## 4. RESPONSIVE DESIGN PATTERNS

### Breakpoints Used:
- **Mobile**: Default (0px - 768px)
- **Tablet/Small Desktop**: 768px
- **Desktop**: 920px (control panel)
- **Large Desktop**: 1024px (metrics dashboard)
- **Ultra-wide**: 1920px

### Media Queries Summary:

| Component | Breakpoint | Changes |
|-----------|-----------|---------|
| **header** | 768px | Stack flex-direction, reduce font sizes |
| **main-demo** | 768px | Reduce padding, single-column controls |
| **main-demo** | 768px | Dual viewer min-height 400px |
| **controls-and-metrics-row** | 768px | Stack to single column |
| **control-panel** | 920px | 2-column grid layout |
| **metrics-dashboard** | 1024px | 1-column layout (from 3-col) |
| **hero** | 768px | Reduce padding, single-column stats |
| **control-panel** | 768px | Single column, reduced padding |
| **advanced-controls** | 768px | Responsive grid adjustments |
| **legend** | 640px | Compact legend layout |
| **current-configuration** | 480px, 768px | Responsive adjustments |

### Accessibility Media Queries:
- `prefers-reduced-motion: reduce` - Disables animations
- `prefers-contrast: high` - Increases border/outline width
- `prefers-color-scheme: dark` - Dark theme support

### View Height Handling:
- Main demo: 60vh for dual viewer (min 500px desktop, min 400px mobile)
- Responsive heights with min-height fallbacks
- Flex layouts for flexible content areas

---

## 5. CURRENT VIEWPORT/WINDOW SIZE HANDLING

### No Explicit Viewport Detection Found:
The codebase does NOT use explicit window resize listeners or viewport detection services.

### Responsive Approach:
- **CSS-based**: Relies entirely on CSS media queries
- **Mobile-first**: Base styles for mobile, media queries enhance for larger screens
- **Viewport Meta Tag**: `<meta name="viewport" content="width=device-width, initial-scale=1" />`
- **Automatic**: Browser handles viewport scaling and responsive layout

### Layout Flexibility:
- **Flexbox**: Primary layout method for flexible containers
- **CSS Grid**: Used for 2D layouts (main demo, metrics dashboard)
- **Percentage/Viewport Units**: Some elements use relative sizing
- **Min/Max Heights**: Constraints to ensure readable content

### 3D Viewer Sizing:
- Uses viewport height percentages (60vh, 70vh)
- Min-height fallbacks for small viewports
- Canvas auto-resizes within container
- Camera aspect ratio adapts to container dimensions

### No Manual Breakpoint Service:
- No responsive design service detected
- No window.matchMedia() usage in TypeScript
- No ResizeObserver for size tracking
- No Signal-based viewport state management

---

## 6. COMPONENTS AFFECTED BY RESPONSIVE DESIGN

### Critical Components for Responsive Redesign:

#### 1. **Dual Viewer** (Highest Priority)
- **Current**: Side-by-side layout
- **Responsive Impact**:
  - Very large: Full side-by-side (1200px+)
  - Tablet: May need layout adjustments
  - Mobile: Could stack or use tabs/toggle
- **Height**: 60vh with min-height constraints
- **Issues**: Fixed aspect ratio may not work well on mobile
- **Opportunity**: Implement mobile-optimized view toggle

#### 2. **Control Panel** (High Priority)
- **Current**: 1-column base, 2-column at 920px+
- **Responsive Impact**:
  - Form controls need touch-friendly sizing (44x44px minimum)
  - Sliders need larger touch targets on mobile
  - Dropdowns need mobile optimization
  - Scene selector buttons may need wrapping
- **Space Constraints**: Very limited space on mobile
- **Opportunity**: Consider drawer/modal for controls on mobile

#### 3. **Metrics Dashboard** (High Priority)
- **Current**: 3-column grid at 1024px+, single-column below
- **Responsive Impact**:
  - Cards may be too cramped on mobile
  - Text overflow issues in narrow columns
  - Chart/graph visualization sizing
- **Reflow**: Proper stacking and reordering on smaller screens
- **Opportunity**: Implement card-based mobile layout

#### 4. **Header** (Medium Priority)
- **Current**: Horizontal layout
- **Responsive Impact**:
  - Breaks at 768px with vertical stacking
  - Logo text gradient may overflow
  - Tagline readability on small screens
- **Status**: Already has responsive adjustments

#### 5. **Hero Section** (Medium Priority)
- **Current**: Centered with stats grid
- **Responsive Impact**:
  - Large display fonts may overflow
  - Stats grid converts to single column at 768px
  - CTA buttons need full-width on mobile
- **Status**: Already has responsive adjustments

#### 6. **Advanced Controls** (Low Priority)
- **Current**: Hidden by default, expands when opened
- **Responsive Impact**:
  - Child component handles own responsive design
  - May need drawer/modal pattern on mobile

#### 7. **Error Banner** (Low Priority)
- **Current**: Inline error messages
- **Responsive Impact**: 
  - Links may wrap on small screens
  - Text readability maintained
- **Status**: Has 768px breakpoint

#### 8. **Legend** (Low Priority)
- **Current**: Overlay on dual viewer
- **Responsive Impact**:
  - Compact legend needed on mobile (640px breakpoint exists)
  - May need repositioning on small screens
- **Status**: Has 640px breakpoint

---

## 7. CURRENT RESPONSIVE DESIGN STATE

### Strengths:
1. **Semantic HTML**: Proper structure with roles and ARIA labels
2. **Design Tokens**: CSS Variables allow theme/layout adjustments
3. **Flexbox/Grid**: Modern layout methods
4. **Mobile-first**: Base styles target mobile
5. **Media Queries**: Comprehensive breakpoints defined
6. **Accessibility**: WCAG 2.2 AA compliance with:
   - Focus management (focus-visible)
   - Keyboard navigation
   - Screen reader support (sr-only classes)
   - Reduced motion support
   - High contrast mode support
   - Color blind friendly patterns
7. **Touch Targets**: `.ag3d-touch-target` class (44x44px minimum)

### Gaps & Limitations:
1. **No Viewport Service**: No reactive viewport state management
2. **Limited Mobile Optimization**: 
   - Control panel sliders may be difficult to use on touch
   - Dual viewer height might be too large for mobile
   - No drawer/modal implementations for mobile controls
3. **No Landscape/Portrait Handling**: No orientation detection
4. **No Touch-Specific Interactions**: No touch gesture support
5. **No Fluid Typography**: Font sizes don't scale between breakpoints
6. **Container Queries**: No container query usage (would be modern approach)
7. **Single-Column Issues**: Some components may not work well on narrow screens
8. **Canvas Sizing**: 3D viewer canvas responsiveness depends on CSS

### Breaking Points:
- Very small mobile (<360px): May have overflow issues
- Landscape mobile (800x600): Cramped layout likely
- Tablets in portrait: Good coverage
- Tablets in landscape: Good coverage
- Desktop: Excellent
- Ultra-wide (1920px+): Max-width constraint applied

---

## 8. DESIGN SYSTEM SUMMARY

### Material Design 3 Influenced:
- Type scale (Display, Headline, Title, Body, Label)
- Elevation/shadow system
- Color system (primary, secondary, error, success, warning, info)
- Motion/animation tokens

### Key Features:
- **CSS Variables as Source of Truth**: All tokens defined in CSS custom properties
- **SCSS Mirrors**: SCSS variables mirror CSS variables for build-time use
- **Theme Switching**: `ag3d-theme-dark` class toggles dark theme
- **Utility Classes**: Comprehensive utility class library
- **Accessibility First**: WCAG 2.2 AA compliance built-in

### Color System:
- **Neutral**: Base colors for surfaces and text
- **Primary/Secondary**: Brand colors
- **Semantic**: Success (green), Warning (amber), Error (red), Info (blue)
- **Object Classes**: Vehicle, Pedestrian, Cyclist (green family)
- **Adaptive**: Light/dark theme variants

---

## 9. NEXT STEPS FOR RESPONSIVE ENHANCEMENT

### Recommended Improvements:
1. **Add Viewport Service**: Implement reactive viewport state (desktop/tablet/mobile)
2. **Mobile Controls**: Implement drawer pattern for control panel on mobile
3. **Dual Viewer Mobile**: Add swipe/toggle between viewers on mobile
4. **Fluid Typography**: Implement responsive font scaling using clamp()
5. **Touch Optimization**: Increase touch target sizes on mobile
6. **Landscape Handling**: Detect and optimize for landscape orientation
7. **Container Queries**: Use container queries for component-level responsiveness
8. **Performance**: Lazy load heavy components on mobile
9. **Testing**: Add responsive design testing at key breakpoints

---

## File Reference Guide

### Core Layout Files:
- `/src/app/app.ts` - Root component
- `/src/app/app.html` - Root template
- `/src/app/app.scss` - Root styles
- `/src/app/app.config.ts` - Root config

### Header & Navigation:
- `/src/app/features/header/header.component.ts`
- `/src/app/features/header/header.component.html`
- `/src/app/features/header/header.component.scss`

### Main Content:
- `/src/app/features/main-demo/main-demo.component.ts` (700+ lines, complex)
- `/src/app/features/main-demo/main-demo.component.html`
- `/src/app/features/main-demo/main-demo.component.scss`

### 3D Viewers:
- `/src/app/features/dual-viewer/dual-viewer.component.ts`
- `/src/app/features/scene-viewer/scene-viewer.component.ts`

### Controls:
- `/src/app/features/control-panel/control-panel.component.ts`
- `/src/app/features/control-panel/advanced-controls/advanced-controls.component.ts`
- `/src/app/features/control-panel/advanced-controls/advanced-controls.component.scss`

### Metrics:
- `/src/app/features/metrics-dashboard/metrics-dashboard.component.ts`
- `/src/app/features/metrics-dashboard/metrics-dashboard.component.scss`
- `/src/app/features/metrics-dashboard/baseline-metrics/`
- `/src/app/features/metrics-dashboard/agile3d-metrics/`
- `/src/app/features/metrics-dashboard/comparison-highlights/`
- `/src/app/features/metrics-dashboard/history-trend/`

### Design System (Tokens):
- `/src/styles/_index.scss` - Main orchestrator
- `/src/styles/_accessibility.scss` - A11y utilities
- `/src/styles/tokens/_colors.scss`
- `/src/styles/tokens/_spacing.scss`
- `/src/styles/tokens/_typography.scss`
- `/src/styles/tokens/_radius.scss`
- `/src/styles/tokens/_elevation.scss`
- `/src/styles/tokens/_motion.scss`
- `/src/styles/theme/_light.scss`
- `/src/styles/theme/_dark.scss`
- `/src/styles/theme/_material-theme.scss`

### Global:
- `/src/styles.scss` - Global stylesheet entry
- `/src/index.html` - HTML entry point

