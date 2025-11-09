# AGILE3D-Demo Component Layout & Responsive Behavior

## Visual App Structure

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│                    <app-header> [sticky]                      │
│              Position: sticky, top: 0, z-index: 1000          │
│          Background: Gradient (primary-600 to primary-500)    │
│                                                                │
│   Desktop (>768px):  [Logo/Branding] [Gap] [Theme Toggle]     │
│   Mobile (<768px):   [Logo/Branding]                          │
│                      [Theme Toggle]                           │
│                                                                │
└────────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│                      <app-hero>                               │
│              Centered content with gradient overlay            │
│                                                                │
│          Desktop:  Title + Description + CTA + Stats (4col)   │
│          Mobile:   Title + Description + CTA + Stats (1col)   │
│                                                                │
└────────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────────┐
│                   <main class="main-content">                 │
│        CSS Grid: grid-template-columns: 1fr (always)          │
│                                                                │
│   ┌──────────────────────────────────────────────────────┐   │
│   │                                                      │   │
│   │      <.dual-viewer-section>                         │   │
│   │      Height: 60vh (min 500px desktop)               │   │
│   │      Height: auto (min 400px mobile)                │   │
│   │                                                      │   │
│   │    ┌─────────────────────────────────────────────┐  │   │
│   │    │      <app-dual-viewer>                      │  │   │
│   │    │                                             │  │   │
│   │    │  Desktop (>768px): Side-by-side layout      │  │   │
│   │    │  ┌──────────────┐  ┌──────────────┐        │  │   │
│   │    │  │  Baseline    │  │   AGILE3D    │        │  │   │
│   │    │  │   Viewer     │  │   Viewer     │        │  │   │
│   │    │  └──────────────┘  └──────────────┘        │  │   │
│   │    │                                             │  │   │
│   │    │  Mobile (<768px): Potentially stacked      │  │   │
│   │    │  (No current responsive breakpoint)         │  │   │
│   │    │                                             │  │   │
│   │    │  Legend Overlay: Fixed position (top-left) │  │   │
│   │    │  Crossfade Toggle: Center button            │  │   │
│   │    │                                             │  │   │
│   │    └─────────────────────────────────────────────┘  │   │
│   │                                                      │   │
│   └──────────────────────────────────────────────────────┘   │
│                              ↓ Gap (24px)                     │
│   ┌──────────────────────────────────────────────────────┐   │
│   │   <.controls-and-metrics-row>                       │   │
│   │   CSS Grid layout                                   │   │
│   │                                                      │   │
│   │   Desktop (>768px): grid-template-columns: 1fr 1fr  │   │
│   │   ┌──────────────────────────────────────────────┐  │   │
│   │   │   <.control-panel-section>                  │  │   │
│   │   │      gap: 24px                              │  │   │
│   │   │                                             │  │   │
│   │   │   [Control Panel - inline styles]           │  │   │
│   │   │                                             │  │   │
│   │   │   Primary Controls:                         │  │   │
│   │   │   Grid layout (1-col base, 2-col@920px)    │  │   │
│   │   │   - Scene Selector (ButtonToggleGroup)      │  │   │
│   │   │   - Voxel Size Slider (MatSlider)          │  │   │
│   │   │   - Contention Slider (MatSlider)          │  │   │
│   │   │   - Latency SLO Slider (MatSlider)         │  │   │
│   │   │   - Baseline Branch (MatSelect)            │  │   │
│   │   │   - AGILE3D Branch (MatSelect)             │  │   │
│   │   │                                             │  │   │
│   │   │   Advanced Controls:                        │  │   │
│   │   │   [app-advanced-controls - child]           │  │   │
│   │   │                                             │  │   │
│   │   └──────────────────────────────────────────────┘  │   │
│   │                   gap: 24px                         │   │
│   │   ┌──────────────────────────────────────────────┐  │   │
│   │   │   <.metrics-section>                        │  │   │
│   │   │                                             │  │   │
│   │   │   <app-metrics-dashboard>                  │  │   │
│   │   │                                             │  │   │
│   │   │   Desktop (>1024px):                        │  │   │
│   │   │   grid-template-columns: repeat(3, 1fr)   │  │   │
│   │   │   ┌──────┐  ┌──────┐  ┌──────┐            │  │   │
│   │   │   │Base- │  │Compa-│  │AGILE │            │  │   │
│   │   │   │ line │  │rison │  │3D    │            │  │   │
│   │   │   └──────┘  └──────┘  └──────┘            │  │   │
│   │   │                                             │  │   │
│   │   │   Mobile (<1024px):                        │  │   │
│   │   │   grid-template-columns: 1fr (stacked)    │  │   │
│   │   │   ┌──────────────┐                        │  │   │
│   │   │   │Baseline      │                        │  │   │
│   │   │   ├──────────────┤                        │  │   │
│   │   │   │AGILE3D       │                        │  │   │
│   │   │   ├──────────────┤                        │  │   │
│   │   │   │Comparison    │                        │  │   │
│   │   │   └──────────────┘                        │  │   │
│   │   │                                             │  │   │
│   │   │   Child Components:                        │  │   │
│   │   │   - baseline-metrics                       │  │   │
│   │   │   - agile3d-metrics                        │  │   │
│   │   │   - comparison-highlights                  │  │   │
│   │   │   - history-trend (optional)               │  │   │
│   │   │                                             │  │   │
│   │   └──────────────────────────────────────────────┘  │   │
│   │                                                      │   │
│   │   Mobile (<768px): grid-template-columns: 1fr      │   │
│   │   [Stack vertically: Control Panel, then Metrics]   │   │
│   │                                                      │   │
│   └──────────────────────────────────────────────────────┘   │
│                                                                │
└────────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│                      <app-footer>                             │
│              Simple footer with links and copyright           │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

## Responsive Breakpoint Transformations

### Desktop (>1024px)
```
┌─ Header ──────────────────────────────────────┐
│  Logo [flex: 1]    |    Theme Toggle [auto]   │
├───────────────────────────────────────────────┤
│                                               │
│                   Hero                        │
│              Stats: 4-column grid             │
│                                               │
├───────────────────────────────────────────────┤
│                                               │
│          Dual Viewer (60vh, min 500px)        │
│                                               │
│  Gap: 24px                                    │
│                                               │
│  ┌─────────────────────────┬─────────────────┐│
│  │   Control Panel         │  Metrics (3col) ││
│  │   [1fr]                 │  [1fr]          ││
│  └─────────────────────────┴─────────────────┘│
│                                               │
├───────────────────────────────────────────────┤
│                   Footer                      │
└───────────────────────────────────────────────┘
```

### Tablet (768px - 1024px)
```
┌─ Header ──────────────────────────────────────┐
│  Logo/Branding    [flex: 1]                   │
│  Theme Toggle     [flex: auto]                │
├───────────────────────────────────────────────┤
│                                               │
│                   Hero                        │
│              Stats: 1-column grid             │
│                                               │
├───────────────────────────────────────────────┤
│                                               │
│      Dual Viewer (auto, min 400px)            │
│                                               │
│  Gap: 16px                                    │
│                                               │
│  ┌───────────────────────────────────────────┐│
│  │   Control Panel [1fr]                     ││
│  ├───────────────────────────────────────────┤│
│  │   Metrics (1-col stack) [1fr]            ││
│  └───────────────────────────────────────────┘│
│                                               │
├───────────────────────────────────────────────┤
│                   Footer                      │
└───────────────────────────────────────────────┘
```

### Mobile (<768px)
```
┌─ Header ──────────────────────────────────────┐
│  Logo/Branding                                │
├───────────────────────────────────────────────┤
│  Theme Toggle (aligned right)                 │
├───────────────────────────────────────────────┤
│                                               │
│                 Hero (compact)                │
│         Title (smaller font)                  │
│       Description (smaller font)              │
│       CTA Buttons (full-width stack)          │
│           Stats (1-column)                    │
│                                               │
├───────────────────────────────────────────────┤
│                                               │
│    Dual Viewer (auto, min 400px)              │
│    [Potentially needs more optimization]      │
│                                               │
│  Padding: 16px (not 32px)                     │
│  Gap: 16px (not 24px)                         │
│                                               │
│  ┌───────────────────────────────────────────┐│
│  │                                           ││
│  │   Control Panel (1-column, 16px pad)     ││
│  │                                           ││
│  │   Sliders full-width                      ││
│  │   Dropdowns full-width                    ││
│  │   Buttons may need larger touch targets   ││
│  │                                           ││
│  └───────────────────────────────────────────┘│
│                                               │
│  Gap: 16px                                    │
│                                               │
│  ┌───────────────────────────────────────────┐│
│  │                                           ││
│  │   Metrics Dashboard (stacked)             ││
│  │   - All cards single-column               ││
│  │   - Cards may be cramped                  ││
│  │                                           ││
│  │   ┌─────────────────────────────────────┐ ││
│  │   │  Baseline Metrics                   │ ││
│  │   └─────────────────────────────────────┘ ││
│  │   ┌─────────────────────────────────────┐ ││
│  │   │  AGILE3D Metrics                    │ ││
│  │   └─────────────────────────────────────┘ ││
│  │   ┌─────────────────────────────────────┐ ││
│  │   │  Comparison Highlights              │ ││
│  │   └─────────────────────────────────────┘ ││
│  │   ┌─────────────────────────────────────┐ ││
│  │   │  History Trend (if included)        │ ││
│  │   └─────────────────────────────────────┘ ││
│  │                                           ││
│  └───────────────────────────────────────────┘│
│                                               │
├───────────────────────────────────────────────┤
│            Footer (compact)                   │
└───────────────────────────────────────────────┘
```

## Specific Component Breakpoint Behaviors

### Control Panel (@920px breakpoint)
```
Mobile (<920px):
┌─────────────────────────┐
│  Control Panel [1col]   │
├─────────────────────────┤
│  Scene Selector (full)  │
├─────────────────────────┤
│  Voxel Size (full)      │
├─────────────────────────┤
│  Contention (full)      │
├─────────────────────────┤
│  Latency SLO (full)     │
├─────────────────────────┤
│  Baseline Branch (full) │
├─────────────────────────┤
│  AGILE3D Branch (full)  │
└─────────────────────────┘

Desktop (>=920px):
┌──────────────────┬──────────────────┐
│ Control Panel    │  (2-col layout)  │
├──────────────────┴──────────────────┤
│  Scene Selector (full width)        │
├──────────────┬──────────────────────┤
│ Voxel Size   │  Contention         │
├──────────────┼──────────────────────┤
│ Latency SLO  │  Baseline Branch    │
├──────────────┼──────────────────────┤
│ AGILE3D Branch (or spans both)      │
└──────────────┴──────────────────────┘
```

### Metrics Dashboard (@1024px breakpoint)
```
Desktop (>=1024px):
┌─────────────────┬─────────────────┬─────────────────┐
│  Baseline (1/3) │ Comparison (1/3)│  AGILE3D (1/3)  │
└─────────────────┴─────────────────┴─────────────────┘

Tablet (<1024px):
┌─────────────────────────────────────┐
│  Baseline Metrics                   │
├─────────────────────────────────────┤
│  AGILE3D Metrics                    │
├─────────────────────────────────────┤
│  Comparison Highlights              │
├─────────────────────────────────────┤
│  History Trend (if included)        │
└─────────────────────────────────────┘
```

## Key Responsive Values

| Property | Mobile | Tablet | Desktop | Ultra |
|----------|--------|--------|---------|-------|
| Padding  | 16px   | 24px   | 32px    | 48px  |
| Gap      | 16px   | 24px   | 24px    | 24px  |
| Viewer H | auto   | auto   | 60vh    | 70vh  |
| Min-H    | 400px  | 400px  | 500px   | 600px |
| Columns  | 1      | 1      | 2       | 2     |

## CSS Grid Properties Summary

### .main-demo
```scss
display: grid;
grid-template-columns: 1fr;        // Always single column
grid-template-rows: auto auto auto; // 3 rows
gap: var(--ag3d-space-24);         // 24px on desktop, 16px on mobile
```

### .controls-and-metrics-row
```scss
display: grid;
grid-template-columns: 1fr 1fr;    // 2 columns on desktop
gap: var(--ag3d-space-24);

@media (max-width: 768px) {
  grid-template-columns: 1fr;      // 1 column on mobile
  gap: var(--ag3d-space-16);
}
```

### .metrics-grid
```scss
display: grid;
grid-template-columns: repeat(3, 1fr); // 3 columns on large desktop
gap: var(--spacing-md);

@media (max-width: 1024px) {
  grid-template-columns: 1fr;      // 1 column on tablet
}
```

## Current Issues & Gaps

1. **Dual Viewer**: No mobile breakpoint - side-by-side layout forced on all sizes
2. **Touch Targets**: Control panel sliders not optimized for touch (may be difficult to use)
3. **Metrics Cards**: Cramped on mobile due to content density
4. **Canvas Sizing**: 3D viewer responsiveness relies solely on CSS (no manual adjustment)
5. **No Landscape Detection**: Landscape mobile orientation not specifically handled
6. **No Viewport Service**: All sizing is CSS-based, no TypeScript viewport tracking
7. **Limited Mobile Controls**: No drawer/modal pattern for controls on mobile (takes up 50% of screen)

## Recommended Mobile Optimizations

1. Implement drawer/modal for Control Panel on mobile
2. Add tab/toggle between Dual Viewers on mobile
3. Implement touch-optimized slider component
4. Add "full-screen" mode for 3D viewers on mobile
5. Implement landscape orientation detection
6. Consider lazy-loading 3D components on mobile
7. Add swipe gesture support between viewers

