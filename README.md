# AGILE3D Interactive Demo

An interactive web demonstration of the AGILE3D adaptive perception system for autonomous vehicles, showcasing real-time 3D point cloud visualization and performance comparisons.

## Project Overview

This Angular application demonstrates the AGILE3D system's ability to adapt 3D perception quality to network conditions while maintaining safety requirements. The demo features:

- **Dual 3D Viewers**: Side-by-side comparison of DSVT-Voxel (baseline) and AGILE3D adaptive approach
- **Real-time Metrics**: Live performance comparison showing latency, accuracy, and network efficiency
- **Interactive Controls**: Adjust simulation parameters to see how AGILE3D adapts to changing conditions
- **Three Scene Types**: Vehicle-heavy, pedestrian-heavy, and mixed traffic scenarios

## Architecture: Dual Viewer Foundation (WP-2.1.1)

### Shared Geometry Management

The DualViewer component implements memory-efficient 3D rendering by sharing a single point cloud geometry instance across both viewers:

**Key Features:**
- **Single GPU Buffer**: ONE `THREE.BufferGeometry` instance shared by both baseline and AGILE3D viewers
- **Centralized Ownership**: `SceneDataService` creates and manages the shared `THREE.Points` instance
- **Zero Duplication**: No geometry cloning or buffer duplication, ensuring optimal memory usage
- **Lifecycle Safety**: Service-managed disposal prevents premature cleanup or memory leaks

**Implementation:**
```typescript
// SceneDataService creates shared Points instance
const points = await sceneDataService.loadPointsObject(binPath, cacheKey);

// DualViewerComponent extracts geometry and passes to both viewers
const sharedGeometry = points.geometry;
// Both SceneViewer instances render using the same geometry
```

### Camera Synchronization

Automatic bidirectional camera sync between viewers via `CameraControlService`:

- **Feedback Prevention**: Guard mechanisms prevent infinite update loops
- **StateService Integration**: Camera state (position, target) flows through global state
- **Frame-Accurate**: Changes propagate within a single frame
- **Zero Configuration**: Automatic setup, no manual wiring required

### Scene Crossfade Transitions

Smooth visual transitions between viewers with ≤500ms crossfade:

- **CSS-Based**: Opacity transitions using design token `--ag3d-duration-slower` (500ms)
- **Accessibility**: Respects `prefers-reduced-motion: reduce` for instant transitions
- **Continuous Rendering**: Both viewers stay active during fade to prevent visual jumps
- **Interactive Toggle**: Central button switches between baseline and AGILE3D views

**Usage:**
```html
<app-dual-viewer
  [inputPoints]="sharedPoints"
  [baselineDetections]="baselineDetections"
  [agile3dDetections]="agile3dDetections"
  [showFps]="true"
/>
```

### Performance Guarantees

Per WP-2.1.1 requirements:
- ✅ **Shared Geometry**: Single GPU buffer verified via THREE.js object identity
- ✅ **Camera Sync**: Bidirectional sync without feedback loops
- ✅ **Crossfade Timing**: ≤500ms transitions (verified via CSS motion tokens)
- ✅ **60fps Sustained**: Both viewers maintain target frame rate during interaction
- ✅ **Accessibility**: WCAG 2.2 AA compliant with reduced-motion support

## Detection Visualization (WP-2.1.2)

The application renders 3D object detection bounding boxes with high-performance instancing and interactive diff highlighting.

### Class-Based Color Coding

Each detection class uses a distinct color for visual identification:

| Class | Color | Hex Code |
|-------|-------|----------|
| **Vehicle** | Blue | `#3B82F6` |
| **Pedestrian** | Red | `#EF4444` |
| **Cyclist** | Orange | `#F97316` |

Colors are sourced from the design system (`ViewerStyleAdapterService`) and update automatically when the theme changes.

### Diff Modes

The application supports multiple diff modes for comparing detection results between baseline and AGILE3D:

- **`off`**: No diff highlighting, show all detections with full opacity
- **`tp`** (True Positives): Show only detections that match ground truth
- **`fp`** (False Positives): Show only detections that don't match ground truth (reduced opacity: 0.4)
- **`fn`** (False Negatives): Ground truth detections not matched by predictions
- **`all`**: Show all detections with TP/FP visual encoding

**Visual Encoding:**
- True Positives (TP): Full opacity (1.0), normal color
- False Positives (FP): Reduced opacity (0.4) for visual distinction
- False Negatives (FN): Handled separately as ground truth overlay (future WP)

**Implementation:**
```typescript
// Enable diff mode with classification
<app-dual-viewer
  [baselineDetections]="baselineDetections"
  [agile3dDetections]="agile3dDetections"
  [diffMode]="'all'"
  [baselineDiffClassification]="baselineDiffMap"
  [agile3dDiffClassification]="agile3dDiffMap"
/>
```

### Interactive Tooltips

Hover over any detection bounding box to view detailed information:

**Tooltip Content:**
- **Class**: Detection class (vehicle, pedestrian, cyclist)
- **Confidence**: Prediction confidence score (0-100%)
- **Matches GT**: Ground truth ID matched by this detection (if available)

**Accessibility:**
- Tooltips use `role="tooltip"` and `aria-live="polite"` for screen readers
- Keyboard accessible via click/Enter fallback
- Positioned to avoid viewport edges

### Performance Optimizations

Per WP-2.1.2 requirements:

- ✅ **Per-Class Instancing**: One `InstancedMesh` per class minimizes material switches
- ✅ **Shared Geometry**: All detections use a single `BoxGeometry(1,1,1)` with matrix transforms
- ✅ **Efficient Updates**: Detections rebuild only when arrays change, not per-frame
- ✅ **Raycasting**: Fast hover detection using Three.js raycaster on instanced meshes

### Reduced Motion Support

The application respects the user's `prefers-reduced-motion` setting (WCAG 2.2 AA):

- **Animations Disabled**: Bounding box transitions disabled when reduced motion is active
- **Instant Updates**: Detection changes appear immediately without fade effects
- **Service Integration**: `ReducedMotionService` provides reactive motion state
- **Viewer Motion Config**: `ViewerStyleAdapterService` applies motion preferences to Three.js animations

**Implementation:**
```typescript
// Automatic via ViewerMotionConfig
this.viewerStyleAdapter.viewerMotion$.subscribe((motion) => {
  // motion.enabled = false when prefers-reduced-motion: reduce
  // motion.objectDuration = 0.01ms (effectively instant)
});
```

### Ground Truth Overlay

A placeholder toggle button is present in the UI for future ground truth overlay visualization (deferred to a later work package). This feature will allow users to compare predicted detections against ground truth annotations.

**Current State:**
- UI toggle button visible but disabled
- Marked as "Coming soon" with tooltip
- FN (False Negative) diff mode reserved for GT overlay

## Advanced Controls (WP-2.2.2)

The application provides advanced configuration controls for fine-tuning AGILE3D's detection pipeline architecture. These controls are hidden by default and can be revealed via an "Advanced" toggle button.

### Purpose

Advanced controls allow users to manually configure AGILE3D's architectural parameters, providing insight into how different detection pipeline configurations affect performance. These settings influence the branch selection algorithm in conjunction with system parameters (scene type, contention, latency SLO).

### Control Options

#### Encoding Format
**Options**: Voxel | Pillar

Point cloud spatial encoding strategy:
- **Voxel**: 3D voxel grid encoding (higher accuracy, higher latency)
- **Pillar**: 2D pillar encoding (lower latency, slightly lower accuracy)

**Tooltip**: "Voxel vs Pillar encoding affects feature layout and latency."

#### Detection Head
**Options**: Anchor-based | Center-based

3D object detection strategy:
- **Anchor**: Anchor-based detection with predefined bounding box templates
- **Center**: Center-based detection (CenterPoint-style keypoint prediction)

**Tooltip**: "Anchor-based vs Center-based detection strategy."

#### Feature Extractor
**Options**: Transformer | Sparse CNN | 2D CNN

Feature extraction backbone network:
- **Transformer**: Transformer-based 3D feature extractor (DSVT-style, highest accuracy)
- **Sparse CNN**: Sparse 3D CNN backbone (balanced accuracy/latency)
- **2D CNN**: 2D CNN on BEV features (lowest latency, lower accuracy)

**Tooltip**: "Backbone network type used for 3D features."

### Usage

**Location**: Control Panel in the main demo interface

**Default State**: Hidden

**To Reveal**: Click the "Advanced" button in the control panel

**To Hide**: Click "Advanced" again, or press the **ESC** key

**Default Values**:
- Encoding Format: Pillar
- Detection Head: Center-based
- Feature Extractor: 2D CNN

### Implementation Details

- **Form Debouncing**: Changes to advanced controls are debounced (100ms) to prevent excessive state updates during rapid adjustments
- **Distinct Emissions**: Deep equality checking prevents redundant state emissions when values haven't actually changed
- **State Persistence**: Form values are preserved when the advanced section is toggled (no form destruction)
- **Reactive State**: All changes immediately propagate to `StateService.advancedKnobs$` for consumption by downstream services (e.g., SimulationService in WP-2.2.3)

### Accessibility

- **Keyboard Navigation**: Full keyboard support (Tab, Shift+Tab to navigate controls)
- **ARIA Attributes**:
  - `aria-expanded` on toggle button indicates panel state
  - `aria-controls` links toggle to panel
  - `aria-hidden` on panel when collapsed
  - `aria-label` on all form controls for screen readers
- **ESC Key**: Close advanced section by pressing Escape
- **Tooltips**: Contextual help available on hover for all controls
- **Focus Management**: Clear focus indicators on all interactive elements

### PRD Requirements Satisfied

- **FR-2.7**: Advanced toggle hidden by default ✅
- **FR-2.8**: Advanced controls for encoding format, detection head, feature extractor ✅
- **FR-2.9**: Tooltips for each advanced control ✅
- **NFR-3.1**: Intuitive controls requiring minimal instruction ✅
- **NFR-3.2**: Helpful tooltips available on hover ✅
- **NFR-3.4**: Keyboard navigation support ✅
- **NFR-3.5**: Accessible color contrast (WCAG AA) ✅

### Code Location

- Component: `src/app/features/control-panel/advanced-controls/`
- State Management: `src/app/core/services/state/state.service.ts` (`advancedKnobs$`, `setAdvancedKnobs()`)
- Types: `src/app/core/models/config-and-metrics.ts` (`AdvancedKnobs` interface)

---

## Current Configuration Display (WP-2.2.4)

The application provides a live display of the current system configuration, showing both the baseline and AGILE3D settings along with all active control knob values.

### Purpose

The Current Configuration Display gives users immediate visibility into:
- Which detection algorithms are currently active
- What parameter values are driving the simulation
- When AGILE3D switches between branches (adaptive behavior indicator)

This component complements the control panel by providing real-time feedback on the system's current state.

### Displayed Information

#### Baseline Configuration
- **Model Name**: "DSVT-Voxel (fixed)"
- **Status**: Always static (non-adaptive baseline)

#### AGILE3D Configuration
- **Active Branch**: Current branch ID (e.g., "CP-Pillar-032")
- **Branch Change Indicator**: Visual indicator (●) appears when AGILE3D switches branches
  - Auto-clears after 2 seconds
  - Respects `prefers-reduced-motion` (no pulse animation if reduced motion is active)

#### Control Knob Settings (5 Parameters)

1. **Encoding Format**: Voxel or Pillar
2. **Spatial Resolution**: Voxel/pillar size in meters (e.g., "0.32 m")
3. **Spatial Encoding**: HV (horizontal-vertical) or DV (depth-vertical)
4. **Feature Extractor**: Transformer, Sparse CNN, or 2D CNN
5. **Detection Head**: Anchor-based or Center-based

### Data Sources

The component reactively combines data from multiple services:
- **StateService**: Advanced knobs (encoding format, detection head, feature extractor), voxel size
- **SimulationService**: Active branch selection (branch ID)
- **PaperDataService**: Full branch configuration including spatial encoding

All values update automatically when upstream state changes, with updates rendering within <100ms (per NFR-1.3).

### Branch Change Indicator

The visual indicator provides real-time feedback when AGILE3D adapts by switching branches:

**Behavior:**
- **Appears**: When `SimulationService.activeBranch$` emits a new branch ID
- **Auto-Clears**: After 2 seconds
- **Accessibility**: Uses `role="status"` and `aria-label="Branch changed"` for screen readers
- **Reduced Motion**: Pulse animation disabled when `prefers-reduced-motion: reduce` is active (simple opacity change only)

**Implementation:**
```typescript
// Branch change detection with auto-clear
branchId$.pipe(
  distinctUntilChanged(),
  switchMap((branchId, index) => {
    if (index === 0) return [false]; // No indicator on initial load
    return timer(0, 2000).pipe(
      map((tick) => tick === 0), // true for 0ms, false for 2000ms
      startWith(true)
    );
  })
)
```

### Fallback Handling

If branch configuration data is unavailable (e.g., branch not found in data service), the component displays "—" for the spatial encoding field.

**Example:**
```typescript
spatialEncoding: branch?.controlKnobs.spatialEncoding ?? '—'
```

### Accessibility

Per WCAG 2.2 AA standards (NFR-3.1–3.5):
- **Live Region**: Container uses `aria-live="polite"` for screen reader announcements
- **High Contrast**: All labels meet 4.5:1 contrast ratio (WCAG AA)
- **Clear Hierarchy**: Semantic headings and structured layout
- **Responsive**: Stacks knobs vertically on narrow screens (<480px)

### PRD Requirements Satisfied

- **FR-2.10**: Show active AGILE3D branch name ✅
- **FR-2.11**: Display baseline model name ("DSVT-Voxel (fixed)") ✅
- **FR-2.12**: Display all 5 control knob settings ✅
- **FR-2.13**: Visual indicator when AGILE3D switches branches ✅
- **NFR-3.1**: Intuitive display requiring minimal instruction ✅
- **NFR-3.2**: Clear labels and visual hierarchy ✅
- **NFR-3.4**: Keyboard navigation (read-only, but navigable) ✅
- **NFR-3.5**: Accessible color contrast (WCAG AA) ✅
- **NFR-3.7**: Respects `prefers-reduced-motion` ✅

### Code Location

- Component: `src/app/features/current-configuration/`
- State Management: `src/app/core/services/state/state.service.ts`, `src/app/core/services/simulation/simulation.service.ts`
- Types: `src/app/core/models/config-and-metrics.ts`, `src/app/core/models/branch.models.ts`

---

## Historical Trend Line (WP-2.3.3)

The Metrics Dashboard includes an optional historical trend visualization that displays the last 10 parameter-driven changes to key performance metrics. This feature helps demonstrate AGILE3D's adaptive behavior over time.

### Purpose

The Historical Trend Line provides:
- **Visual feedback** on how metrics evolve as system parameters change
- **Demonstration aid** for showing AGILE3D's dynamic adaptation during presentations
- **Short-term history** for understanding recent performance trajectory

### Displayed Metrics

Three sparkline charts visualize comparison deltas:

1. **Accuracy Gain** (%)
   - Shows accuracy improvement/degradation relative to baseline
   - Positive values indicate AGILE3D outperforms baseline
   - Circular markers for color-blind accessibility

2. **Latency Difference** (ms)
   - Shows latency delta (negative = AGILE3D faster)
   - Negative values indicate AGILE3D is more efficient
   - Square markers for color-blind accessibility

3. **Violation Reduction** (%)
   - Shows SLO violation rate improvement
   - Positive values indicate fewer violations with AGILE3D
   - Diamond markers for color-blind accessibility

### Behavior

**Visibility:**
- Automatically appears when 2+ samples are captured
- Hides when fewer than 2 samples (e.g., on initial load or after scene change)

**Sample Capture:**
- Triggered on every `SimulationService.comparison$` emission with distinct values
- Captures: timestamp, accuracy delta, latency delta, violation reduction, scene ID
- Ring buffer maintains maximum of 10 samples (oldest removed when limit exceeded)

**Scene Changes:**
- History automatically clears when scene changes to prevent cross-scene metric mixing
- Fresh history begins accumulating for the new scene

**Performance:**
- <100ms update latency from metrics emission to visual rendering
- Lightweight SVG rendering (<1ms overhead per update)
- Immutable arrays and OnPush change detection for optimal performance

### Accessibility

Per WCAG 2.2 AA standards (NFR-3.4–3.7):

**Visual Encoding:**
- Each metric uses a distinct marker shape (circle, square, diamond) in addition to color
- Color-blind safe palette (green, blue, amber)
- High contrast mode supported (increased stroke width)

**Screen Reader Support:**
- ARIA labels on each sparkline with latest value summary
- Visually-hidden data table with full numerical history
- `aria-live="polite"` for dynamic updates

**Keyboard Navigation:**
- SVG charts are keyboard focusable
- Clear focus indicators (2px outline)
- Legend provides context for all three metrics

**Reduced Motion:**
- Respects `prefers-reduced-motion: reduce` setting
- Disables path transitions and marker animations
- Instant updates when reduced motion is active

### Data Table (Screen Readers)

A visually-hidden HTML table provides full historical data for screen readers:

```html
| Change # | Accuracy Gain (%) | Latency Diff (ms) | Violation Reduction (%) |
|----------|-------------------|-------------------|-------------------------|
| 1        | +1.5              | -50               | +5.0                    |
| 2        | +2.0              | -80               | +7.0                    |
| 3        | +2.3              | -120              | +8.1                    |
```

### Implementation Details

**Architecture:**
- **MetricsHistoryService**: Ring buffer maintaining last 10 samples
- **HistoryTrendComponent**: SVG sparkline visualization with accessibility features
- **Integration**: Embedded below Comparison Highlights in Metrics Dashboard

**Data Flow:**
```
SimulationService.comparison$
  → MetricsHistoryService (capture + buffer)
  → MetricsDashboardComponent.history$
  → HistoryTrendComponent (render sparklines)
```

**Memory Safety:**
- Bounded ring buffer (max 10 samples)
- Automatic cleanup on scene changes
- Observable cleanup via `takeUntil` pattern

### PRD Requirements Satisfied

- **FR-3.8**: Optional historical trend line ✅
- **NFR-1.3**: UI updates within 100ms ✅
- **NFR-3.4**: Keyboard navigation support ✅
- **NFR-3.5**: WCAG AA color contrast ✅
- **NFR-3.6**: Color-blind safe palettes (shape + color encoding) ✅
- **NFR-3.7**: Respects `prefers-reduced-motion` ✅

### Code Location

- Service: `src/app/core/services/metrics/metrics-history.service.ts`
- Component: `src/app/features/metrics-dashboard/history-trend/`
- Integration: `src/app/features/metrics-dashboard/metrics-dashboard.component.ts`
- Types: `src/app/core/services/metrics/metrics-history.service.ts` (`MetricsHistorySample` interface)

---

## QA Hooks & Instrumentation (WP-2.3.2)

The application provides URL-based QA hooks for testing error paths and performance instrumentation for measuring scene switch timing.

### Debug Mode

Debug mode enables developer features like FPS overlays and verbose logging.

**Activation:**
- **Automatic**: Enabled in Angular development mode (`ng serve`)
- **Manual Override**: Add `?debug=true` to URL (works in production builds)

**Features When Enabled:**
- FPS overlay visible in both 3D viewers
- Verbose console logging for instrumentation events
- Performance measurements logged to console

**Example:**
```
http://localhost:4200?debug=true
```

### WebGL QA Hook

Force WebGL2 unsupported state for testing error handling and fallback UI.

**Usage:**
```
http://localhost:4200?webgl=0
```

**Behavior:**
- `CapabilityService.checkWebGL2Support()` returns `false`
- Error banner displays: "WebGL 2.0 is required but not available in your browser."
- 3D viewers are not initialized (skip WebGL context creation)
- Control panel and metrics dashboard remain functional (data-only mode)

**Use Cases:**
- Test error banner accessibility and usability
- Verify graceful degradation when WebGL is unavailable
- Validate error message clarity for end users

### Tier QA Hook

Force fallback tier assets for testing reduced-quality rendering.

**Usage:**
```
http://localhost:4200?tier=fallback
```

**Behavior:**
- Disables automatic tier selection (`SceneTierManagerService.setAutoTierEnabled(false)`)
- Forces tier to `'fallback'` (50k point clouds instead of 100k)
- Point cloud paths resolve to `*_50k.bin` files

**Use Cases:**
- Test lower-quality asset rendering
- Verify tier system behavior under constrained conditions
- Validate fallback asset availability

### Performance Instrumentation

The application uses the Performance API to measure scene switch timing.

**Instrumentation Points:**
1. **Scene Switch Start**: `performance.mark('{id}:start')` when scene loading begins
2. **Data Loaded**: `performance.mark('{id}:data-loaded')` when JSON/binary data arrives
3. **Scene Switch End**: `performance.mark('{id}:end')` when scene is ready to render

**Performance Measures:**
- **Name**: `scene-switch:{label}` (e.g., `scene-switch:initial`, `scene-switch:mixed`)
- **Duration**: Total time from start to end (target: ≤500ms)

**Viewing Measurements:**
```javascript
// In browser console
performance.getEntriesByType('measure').filter(e => e.name.startsWith('scene-switch:'))

// Output example:
// [
//   { name: 'scene-switch:initial', duration: 387.2 },
//   { name: 'scene-switch:highway', duration: 412.5 }
// ]
```

**Historical Data:**
```javascript
// Access last 20 scene switch timings (in debug mode)
// Inject InstrumentationService and call:
instrumentation.getRecent()
// Returns: [{ label: 'initial', durationMs: 387.2 }, ...]
```

### Error Banner

Accessible error notification system for compatibility and data loading errors.

**Triggers:**
- WebGL 2.0 unsupported (or `?webgl=0` hook active)
- Scene metadata loading failure
- Point cloud binary fetch error
- Network connectivity issues

**Accessibility Features:**
- `role="alert"` with `aria-live="assertive"` for immediate screen reader announcement
- Dismiss button receives keyboard focus on appearance
- ESC key support for quick dismissal
- High contrast mode support (increased border width)
- Helpful action links (e.g., "WebGL System Requirements", "Browser Compatibility")

**Example Error States:**
```typescript
// WebGL unsupported
title: "Compatibility or Data Error"
message: "WebGL 2.0 is required but not available in your browser."
links: [
  { label: 'WebGL System Requirements', href: 'https://get.webgl.org/' },
  { label: 'Browser Compatibility', href: 'https://caniuse.com/webgl2' }
]

// Data loading failure
title: "Compatibility or Data Error"
message: "Failed to fetch scene data: Network request failed"
```

### Combined QA Hooks

Multiple hooks can be combined for comprehensive testing:

```
# Test error handling in debug mode with verbose logging
http://localhost:4200?debug=true&webgl=0

# Test fallback assets with debug FPS overlay
http://localhost:4200?debug=true&tier=fallback

# Production error simulation (no debug logging)
http://localhost:4200?webgl=0
```

### PRD Requirements Satisfied

- **NFR-1.8**: Instrumentation present (Performance API marks/measures) ✅
- **NFR-2.5**: WebGL capability check with fallback message ✅
- **NFR-3.4**: Keyboard navigation for error UI ✅
- **NFR-4.2**: Graceful error handling for unsupported browsers ✅

### Code Location

- **DebugService**: `src/app/core/services/runtime/debug.service.ts`
- **CapabilityService**: `src/app/core/services/runtime/capability.service.ts`
- **InstrumentationService**: `src/app/core/services/runtime/instrumentation.service.ts`
- **ErrorBannerComponent**: `src/app/shared/components/error-banner/`
- **Integration**: `src/app/features/main-demo/main-demo.component.ts` (`ngOnInit`, `loadInitialScene`)

---

## Camera Sync & Independent Mode (WP-2.1.3)

The application provides flexible camera control modes for comparing scenes from different viewpoints or maintaining synchronized views.

### Synchronized Cameras (Default)

By default, both viewers share a synchronized camera. Moving the camera in either viewer instantly mirrors the movement in the other viewer, enabling side-by-side comparison from identical viewpoints.

**Features:**
- **Bidirectional Sync**: Camera changes in either viewer immediately propagate to the other
- **Frame-Accurate**: Synchronization happens within a single frame via reactive state management
- **Feedback Prevention**: Guard mechanisms prevent infinite update loops
- **Zero Configuration**: Automatic setup through `CameraControlService` and `StateService`

### Independent Camera Mode

Toggle "Independent Cameras" to control each viewer's camera separately, allowing comparison from different angles or distances.

**Location**: Camera controls panel at the top center of the dual viewer interface

**Behavior:**
- **Independent Mode ON**: Each viewer maintains its own camera pose; moving one viewer does NOT affect the other
- **Independent Mode OFF** (default): Cameras are synchronized across both viewers
- **Re-sync**: When toggling back from independent to sync mode, both viewers automatically align to a common camera pose without visual jumps

**Implementation Details:**
- Mode state managed by `StateService.independentCamera$` observable
- `CameraControlService` conditionally enables/disables global state updates based on mode
- On re-sync: first attached viewer's camera becomes canonical source for both viewers

### Camera Reset

Click "Reset Camera" to restore the default view, useful after extensive navigation or to return to a standard viewing position.

**Default View:**
- **Position**: `[0, 0, 10]` (10 units along Z-axis)
- **Target**: `[0, 0, 0]` (looking at origin)
- **Works in both modes**: Reset applies to current viewer in independent mode, or all viewers in sync mode

### Scene Persistence (FR-1.10)

Camera pose is preserved when switching scenes. The camera maintains its position and orientation across scene changes unless manually reset.

**Benefits:**
- Consistent viewing angle when comparing different scenes
- No jarring camera jumps during scene transitions
- Manual control via Reset Camera button when fresh perspective is needed

**Usage Example:**
```typescript
// Access camera sync controls in DualViewerComponent
<app-camera-sync-controls />

// Toggle independent mode programmatically
stateService.setIndependentCamera(true);

// Reset camera to default
stateService.setCameraPos([0, 0, 10]);
stateService.setCameraTarget([0, 0, 0]);
```

### Accessibility

Camera controls follow WCAG 2.2 AA standards:
- **ARIA Labels**: Toggle and button have descriptive labels for screen readers
- **Keyboard Navigation**: Full keyboard support (Tab, Enter, Space)
- **Tooltips**: Context-sensitive help text on hover
- **Focus Indicators**: Clear visual focus states for keyboard navigation

## Technology Stack

- **Framework**: Angular 20.x (standalone components)
- **3D Rendering**: Three.js 0.179.0 with angular-three 4.x
- **UI Framework**: Angular Material 20.x
- **Language**: TypeScript 5.9.x (strict mode)
- **Build Tool**: Angular CLI with esbuild
- **Testing**: Jasmine + Karma
- **Code Quality**: ESLint + Prettier

## Prerequisites

- **Node.js**: ≥20.19.0 (LTS recommended)
- **npm**: ≥10.8.0

## Getting Started

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd AGILE3D-Demo

# Install dependencies
npm install
```

### Development Server

```bash
# Start development server (http://localhost:4200)
npm start

# Or explicitly run
npm run start
```

The application will automatically reload when you make changes to source files.

### Building

```bash
# Development build
npm run build

# Production build (optimized, minified)
npm run build:prod
```

Build artifacts are output to `dist/agile3d-demo/`.

### Testing

```bash
# Run unit tests via Karma
npm test

# Run tests in headless mode (CI)
npm test -- --watch=false --browsers=ChromeHeadless
```

### Code Quality

```bash
# Run ESLint
npm run lint

# Auto-fix linting issues
npm run lint:fix

# Format code with Prettier
npm run format
```

## Project Structure

```
src/
├── app/
│   ├── core/                      # Core services, models, and utilities
│   │   ├── services/              # State management, data services
│   │   ├── models/                # TypeScript interfaces and types
│   │   └── utils/                 # Helper functions, workers
│   ├── features/                  # Feature modules
│   │   ├── dual-viewer/           # Main split-screen 3D viewer
│   │   ├── scene-viewer/          # Individual 3D scene component
│   │   ├── control-panel/         # Simulation controls
│   │   ├── metrics-dashboard/     # Performance metrics display
│   │   ├── header/                # Application header
│   │   ├── hero/                  # Landing hero section
│   │   └── footer/                # Application footer
│   ├── app.config.ts              # Application configuration
│   └── app.routes.ts              # Route definitions
├── assets/
│   ├── data/                      # JSON data files
│   ├── scenes/                    # 3D scene files (.bin, .json)
│   └── workers/                   # Web Workers
└── environments/                  # Environment configurations
```

## Development Guidelines

### Code Standards

- **TypeScript**: Strict mode enabled, no implicit `any` types
- **Functions**: Maximum 50 lines
- **Files**: Maximum 300 lines
- **Comments**: JSDoc for all public methods
- **Testing**: ≥70% coverage for services, ≥60% for components

### Angular Patterns

- Use **standalone components** (no NgModules)
- Implement **OnPush** change detection where possible
- Use **RxJS** with proper cleanup (`takeUntil` pattern)
- Follow **Angular style guide** naming conventions

### Example Component

```typescript
import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-example',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './example.component.html',
  styleUrls: ['./example.component.scss'],
})
export class ExampleComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  public ngOnInit(): void {
    // Subscribe with cleanup
    this.service.data$.pipe(takeUntil(this.destroy$)).subscribe((data) => {
      // Handle data
    });
  }

  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
```

## Scripts Reference

| Command | Description |
|---------|-------------|
| `npm start` | Start development server |
| `npm run build` | Build for production |
| `npm run build:prod` | Build with production optimizations |
| `npm run watch` | Build and watch for changes |
| `npm test` | Run unit tests |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Auto-fix linting errors |
| `npm run format` | Format code with Prettier |

## Configuration Files

- `angular.json` - Angular CLI configuration
- `tsconfig.json` - TypeScript compiler options
- `eslint.config.js` - ESLint rules
- `package.json` - Prettier config (embedded)
- `.gitignore` - Git ignore patterns

## Performance Targets

- **Frame Rate**: 60fps sustained in both 3D viewers
- **Initial Load**: <5 seconds
- **Control Response**: <100ms
- **Bundle Size**: <10MB (excluding 3D assets)
- **3D Assets**: ≤8MB compressed

## Browser Support

- Chrome/Edge (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)

## Adding New Scenes (JSON-Only Update)

The application supports adding new 3D scenes without any code changes, demonstrating the extensibility requirement (FR-1.11).

### Scene File Structure

Each scene requires:

```
src/assets/scenes/{scene_id}/
├── metadata.json                    # Scene metadata and annotations
├── {scene_id}_100k.bin             # Full quality point cloud (100k points)
└── {scene_id}_50k.bin              # Fallback quality (50k points)
```

### Metadata Schema

Create a `metadata.json` file following this structure:

```json
{
  "scene_id": "your_scene_id",
  "name": "Display Name",
  "description": "Scene description",
  "pointsBin": "assets/scenes/your_scene_id/your_scene_id_100k.bin",
  "pointCount": 100000,
  "pointStride": 3,
  "bounds": {
    "min": [-50, -50, -2],
    "max": [50, 50, 10]
  },
  "ground_truth": [],
  "predictions": {
    "DSVT_Voxel": [],
    "AGILE3D_CP_Pillar_032": []
  },
  "metadata": {
    "vehicleCount": 0,
    "pedestrianCount": 0,
    "cyclistCount": 0,
    "complexity": "medium",
    "optimalBranch": "AGILE3D_CP_Pillar_032"
  }
}
```

### Point Cloud Binary Format

Point cloud files (`.bin`) must be:

- **Format**: Little-endian Float32Array
- **Stride**: 3 floats per point `[x, y, z]`
- **Size**: 100k points = 1.17 MB (uncompressed), 50k points = 585 KB
- **Compression**: Served with Brotli compression (≤2.5MB per scene compressed)

### Registry Update

Add your scene to `src/assets/scenes/registry.json`:

```json
{
  "version": "1.0.0",
  "scenes": [
    {
      "scene_id": "your_scene_id",
      "name": "Display Name",
      "description": "Scene description",
      "complexity": "medium",
      "pointCount": 100000,
      "hasFallback": true
    }
  ]
}
```

### Step-by-Step Guide

1. **Create Scene Directory**:
   ```bash
   mkdir -p src/assets/scenes/my_scene_01
   ```

2. **Generate Point Cloud Data**:
   - Use the provided generator script:
     ```bash
     node tools/generate-scene-data.mjs
     ```
   - Or create custom data matching the binary format

3. **Create metadata.json**:
   - Follow the schema above
   - Include ground truth and prediction annotations

4. **Update registry.json**:
   - Add entry to the scenes array
   - Set appropriate complexity level

5. **Validate Asset Budgets**:
   ```bash
   node tools/validate-asset-budgets.mjs
   ```
   - Ensures compressed size ≤2.5MB per scene
   - Ensures total compressed size ≤8MB

6. **Test the Scene**:
   - Restart dev server: `npm start`
   - Scene automatically appears in scene selector
   - No code changes required!

### Budget Constraints

- **Per-Scene**: ≤2.5MB compressed (Brotli)
- **Total Assets**: ≤8MB compressed
- **Validation**: Run `node tools/validate-asset-budgets.mjs` before committing

### Example: Adding a Parking Lot Scene

```bash
# Generate the scene
node tools/add-parking-lot-scene.mjs

# Validate budgets
node tools/validate-asset-budgets.mjs

# Start server to test
npm start
```

The scene will automatically appear in the application without any code changes.

## Accessibility

- WCAG AA color contrast compliance
- Full keyboard navigation support
- ARIA labels on interactive elements
- Respects `prefers-reduced-motion`

## Contributing

1. Create a feature branch from `main`
2. Follow code standards and testing requirements
3. Run `npm run lint` and `npm run format` before committing
4. Ensure all tests pass with `npm test`
5. Submit pull request with descriptive title and summary

## License

[License information to be added]

## Contact

[Contact information to be added]

---

Built with Angular 20 and Three.js for the NSF AGILE3D project demonstration.
