# AGILE3D Interactive Demo - Product Requirements Document (v2.0)

## 1. Executive Summary

### 1.1 Purpose
Create an interactive web-based side-by-side comparison demonstration of the AGILE3D system that effectively communicates its technical innovation and real-world impact to NSF representatives.

### 1.2 Goals
- **Primary**: Impress NSF representatives with technical sophistication and real-world applicability
- **Secondary**: Educate audience on adaptive 3D object detection challenges and solutions through direct visual comparison
- **Tertiary**: Showcase research contributions (DPO for branch scheduling, MEF with 5 control knobs)

### 1.3 Target Audience
- NSF program directors and representatives
- Technical background in computer science/engineering
- Interest in autonomous systems, embedded computing, and AI/ML
- May not be experts in 3D object detection specifically

### 1.4 Timeline & Team
- **Duration**: Two weeks from project start to deployment
- **Team**: AI agents (Software Engineer, SQA, PR Reviewer) + Human oversight
- **Demo Inspiration**: https://sprasan3.github.io/edge-server-demo/

---

## 2. Product Vision

### 2.1 Core Experience
Users see **two synchronized 3D point cloud viewers side-by-side**:
- **Left**: DSVT-Voxel (fixed baseline model from paper)
- **Right**: AGILE3D (adaptive system)

Users adjust parameters (scene type, contention level, latency SLO, voxel size) and observe in real-time how AGILE3D adapts while the baseline remains static, with live metrics showing the performance difference.

### 2.2 Key Differentiators
- **Side-by-side 3D visualization** showing baseline vs AGILE3D on identical point clouds
- **Synchronized camera controls** - both viewers move together
- **Real-time metrics comparison** with clear delta indicators
- **Interactive parameter tuning** with immediate visual and quantitative feedback
- **Data-driven insights** from published research results

### 2.3 Success Metrics
- Positive feedback from NSF representatives
- Ability to convey key contributions within 5-10 minute demo
- Technical credibility (accurate representation of paper)
- Visual impact and professional presentation
- Clear demonstration of AGILE3D's adaptive advantage

---

## 3. User Stories

### 3.1 Primary User Stories

**As an NSF representative, I want to:**
1. **Immediately see the difference** between baseline and AGILE3D approaches
2. **Understand why adaptation matters** through visual and quantitative comparison
3. **Interact with parameters** to see how AGILE3D responds dynamically
4. **Grasp the performance gains** (1-5% accuracy improvement, SLO compliance)
5. **Connect this to real-world impact** for autonomous systems

### 3.2 User Journey

```
Landing → Quick Overview → Interactive Comparison Demo → Results → Impact
  ↓            ↓                     ↓                     ↓        ↓
Hook      Context          Core Experience            Validate  Remember
```

**Detailed Flow:**
1. **Land on page** (0-10 seconds): Hero explains side-by-side comparison concept
2. **Read brief overview** (10-30 seconds): Problem and solution in 2-3 sentences
3. **Interact with demo** (3-7 minutes): Adjust parameters, observe both viewers, compare metrics
4. **Review quantitative results** (1-2 minutes): Performance improvements, Pareto frontiers
5. **Appreciate impact** (30 seconds): Real-world applications

---

## 4. Functional Requirements

### 4.1 Dual Scene Visualization (Side-by-Side 3D Viewers)

#### 4.1.1 Core Rendering
- **FR-1.1**: Display two synchronized 3D point cloud viewers
  - Left: "DSVT-Voxel (Baseline)" label
  - Right: "AGILE3D (Adaptive)" label
- **FR-1.2**: Render identical point cloud data in both viewers
- **FR-1.3**: Render 3D bounding boxes around detected objects with color coding:
  - Blue: Vehicles
  - Red: Pedestrians
  - Orange: Cyclists
- **FR-1.4**: Support synchronized camera controls (orbit, pan, zoom)
  - Both viewers move together when user interacts with either
  - Optional: Independent camera toggle (advanced feature)
- **FR-1.5**: Maintain 60fps performance during interaction
- **FR-1.6**: Handle viewport resizing gracefully
- **FR-1.7**: Share point cloud geometry between viewers (render same points twice with different detections)

#### 4.1.2 Scene Types
- **FR-1.8**: Provide three distinct scene scenarios:
  - **Vehicle-heavy**: Highway/parking lot (15-20 cars, 0-2 pedestrians)
  - **Pedestrian-heavy**: Crosswalk/sidewalk (10-15 pedestrians, 0-3 vehicles)
  - **Mixed**: Urban intersection (8-10 vehicles, 6-8 pedestrians, 3-5 cyclists)
- **FR-1.9**: Allow instant switching between scenes (<500ms transition)
- **FR-1.10**: Preserve camera position when switching scenes (optional reset button)
- **FR-1.11**: **Extensibility**: Code architecture must support adding new scenes via configuration files without code changes

#### 4.1.3 Detection Visualization
- **FR-1.12**: Display detection confidence for each bounding box (on hover or click)
- **FR-1.13**: Visually differentiate correct vs incorrect detections
  - Option 1: Color saturation (bright = high confidence)
  - Option 2: Toggle to show ground truth overlay
- **FR-1.14**: Highlight detection differences between baseline and AGILE3D
  - False positives (detected but not in ground truth)
  - False negatives (in ground truth but not detected)
  - True positives (correctly detected)
- **FR-1.15**: Animate bounding box updates when parameters change

### 4.2 Configuration Control Panel

#### 4.2.1 Scene Selection
- **FR-2.1**: Dropdown or button group to select scene type
- **FR-2.2**: Display scene metadata (object counts, scene complexity)
- **FR-2.3**: Show AGILE3D's selected branch for current configuration

#### 4.2.2 Primary Controls
- **FR-2.4**: **Voxel/Pillar Size (Spatial Resolution)** slider or discrete buttons
  - Options: 0.16m, 0.24m, 0.32m, 0.48m, 0.64m
  - Label: "Spatial Resolution"
  - Tooltip: Explanation of impact on accuracy and latency
  
- **FR-2.5**: **Contention Level** slider (0-100%)
  - Labeled markers at: 0% (None), 38% (Light), 45% (Moderate), 64% (Intense), 67% (Peak)
  - Display current percentage value
  - 100ms debounce on updates
  - Tooltip: Explanation of GPU resource contention

- **FR-2.6**: **Latency SLO** slider (100-500ms)
  - Step: 10ms
  - Display current SLO value
  - Show feasible branch count for current SLO (optional)
  - Visual indicator when SLO is violated
  - 100ms debounce on updates
  - Tooltip: Explanation of Service Level Objective

#### 4.2.3 Advanced Controls (Hidden by Default)
- **FR-2.7**: "Advanced" toggle button to reveal additional controls
- **FR-2.8**: Advanced control options (when toggled):
  - Encoding format: Voxel vs Pillar
  - Detection head: Anchor-based vs Center-based
  - Feature extractor: Transformer vs CNN variants
- **FR-2.9**: All advanced controls include tooltips explaining their purpose

#### 4.2.4 Current Configuration Display
- **FR-2.10**: Show active AGILE3D branch name (e.g., "CP-Pillar-0.32")
- **FR-2.11**: Display baseline model name: "DSVT-Voxel" (fixed)
- **FR-2.12**: Display control knob settings for AGILE3D:
  - Encoding format (Voxel/Pillar)
  - Spatial resolution (grid size in meters)
  - Spatial encoding (HV/DV)
  - 3D feature extractor (Transformer/Sparse CNN/2D CNN)
  - Detection head (Anchor-based/Center-based)
- **FR-2.13**: Visual indicator when AGILE3D switches branches

### 4.3 Metrics Dashboard (Comparison View)

#### 4.3.1 Baseline Metrics (Left Panel)
- **FR-3.1**: Display DSVT-Voxel metrics:
  - **Accuracy (mAP)**: XX.X%
  - **Latency**: XXX ms
  - **Violation Rate**: X.X%
  - **Memory Usage**: X.X GB
  - **SLO Compliance**: ✓ or ✗

#### 4.3.2 AGILE3D Metrics (Right Panel)
- **FR-3.2**: Display AGILE3D metrics:
  - **Accuracy (mAP)**: XX.X%
  - **Latency**: XXX ms
  - **Violation Rate**: X.X%
  - **Memory Usage**: X.X GB
  - **Active Branch**: Branch name
  - **Branch Switches**: Count (if tracking over time)
  - **SLO Compliance**: ✓ or ✗

#### 4.3.3 Comparison Highlights (Center)
- **FR-3.3**: Display delta metrics between AGILE3D and baseline:
  - **Accuracy Gain**: +X.X% (or -X.X%)
  - **Latency Difference**: ±XX ms
  - **Violation Reduction**: -X.X%
- **FR-3.4**: Use color coding:
  - Green: AGILE3D improvement
  - Amber: Neutral/minor difference
  - Red: AGILE3D degradation (rare)

#### 4.3.4 Visual Presentation
- **FR-3.5**: Animate metric changes smoothly (200ms transitions)
- **FR-3.6**: Number counting animations when values update
- **FR-3.7**: Highlight flash effect on significant changes
- **FR-3.8**: Optional: Historical trend line (last 10 parameter changes)

### 4.4 Comparison Visualization (Optional Charts)

**Note**: These are lower priority than the core side-by-side 3D comparison.

#### 4.4.1 Chart Types (If Time Permits)
- **FR-4.1**: Line chart showing accuracy vs contention for current configuration
- **FR-4.2**: Simple bar chart comparing baseline vs AGILE3D at current settings

#### 4.4.2 Data Series
- **FR-4.3**: AGILE3D (CARL + MEF) - primary series
- **FR-4.4**: DSVT-Voxel baseline for reference

#### 4.4.3 Interactivity
- **FR-4.5**: Hover tooltips with exact values
- **FR-4.6**: Update chart based on control panel inputs
- **FR-4.7**: Use uPlot for performance (lightweight, fast updates)

### 4.5 Educational Content (Minimal)

#### 4.5.1 Hero Section
- **FR-5.1**: Brief headline explaining the demo concept
- **FR-5.2**: 2-3 sentence summary of AGILE3D
- **FR-5.3**: "Explore the Demo" CTA button

#### 4.5.2 Tooltips & Help
- **FR-5.4**: Hover tooltips on all controls explaining:
  - What the parameter affects
  - Why it matters
  - Expected behavior
- **FR-5.5**: Optional "?" help icons with expandable explanations
- **FR-5.6**: Keep all text concise (1-2 sentences max)

#### 4.5.3 Footer
- **FR-5.7**: Link to full paper (PDF)
- **FR-5.8**: Link to code repository (GitHub/Zenodo)
- **FR-5.9**: Brief citation information

---

## 5. Non-Functional Requirements

### 5.1 Performance
- **NFR-1.1**: Initial page load <5 seconds on modern hardware (desktop, 16GB RAM, modern GPU)
- **NFR-1.2**: 3D rendering maintains 60fps during interaction in BOTH viewers simultaneously
- **NFR-1.3**: Control updates reflect in UI within 100ms
- **NFR-1.4**: Parameter changes update both viewers within 200ms
- **NFR-1.5**: Total bundle size <10MB (excluding 3D assets)
- **NFR-1.6**: 3D asset budget ≤8MB compressed (brotli/gzip)
- **NFR-1.7**: Per-scene asset budget ≤2.5MB compressed
- **NFR-1.8**: Instrumentation present:
  - In-app FPS counter (smoothed)
  - requestAnimationFrame timing logs (dev mode)
  - Shader/material prewarm on init
  - devicePixelRatio clamped to 1.5–2.0
- **NFR-1.9**: Automatic fallback if performance drops below 45fps:
  - Reduce point count (decimate to 50k)
  - Disable shadows/effects
  - Show performance warning to user

### 5.2 Compatibility
- **NFR-2.1**: Support Chrome, Firefox, Safari, Edge (latest 2 versions)
- **NFR-2.2**: Primary target: Desktop 1920x1080
- **NFR-2.3**: Tablet support: 1024x768 minimum (stacked layout)
- **NFR-2.4**: WebGL 2.0 required for 3D visualization
- **NFR-2.5**: WebGL capability check with fallback:
  - Show clear error message if WebGL unavailable
  - Provide static images/video fallback (optional)
  - Link to browser upgrade instructions
- **NFR-2.6**: Graceful degradation on older browsers (show compatibility warning)

### 5.3 Usability
- **NFR-3.1**: Intuitive controls requiring minimal instruction
- **NFR-3.2**: Helpful tooltips available on hover/click
- **NFR-3.3**: Clear visual hierarchy and information architecture
- **NFR-3.4**: Keyboard navigation support for controls
- **NFR-3.5**: Accessible color contrast ratios (WCAG AA)
- **NFR-3.6**: Color-blind safe palettes:
  - Use patterns/icons in addition to color
  - Test with color blindness simulators
- **NFR-3.7**: Respect prefers-reduced-motion:
  - Disable entrance animations
  - Disable counting animations
  - Use instant transitions instead
- **NFR-3.8**: First-time user can understand and use demo within 30 seconds

### 5.4 Reliability
- **NFR-4.1**: No crashes or freezes during normal usage
- **NFR-4.2**: Graceful error handling with user feedback
- **NFR-4.3**: Data accuracy verified against paper figures
- **NFR-4.4**: Consistent behavior across page reloads
- **NFR-4.5**: Handle edge cases:
  - Rapid parameter changes (debouncing)
  - Browser tab backgrounding (pause rendering)
  - Window resizing (responsive layouts)
  - Memory pressure (cleanup on component destroy)

### 5.5 Maintainability
- **NFR-5.1**: Modular Angular component architecture
- **NFR-5.2**: Separated data layer (JSON files)
- **NFR-5.3**: Documented code with JSDoc comments
- **NFR-5.4**: Version controlled with Git
- **NFR-5.5**: Easy to update data without code changes
- **NFR-5.6**: Configuration-driven scene management (add scenes via JSON)
- **NFR-5.7**: Clear separation of concerns:
  - Services handle data and state
  - Components handle presentation
  - Utilities handle common logic

### 5.6 AI Agent Integration
- **NFR-6.1**: Code must be AI-agent friendly:
  - Clear function and variable names
  - Explicit types (TypeScript strict mode)
  - Small, focused functions (max 50 lines)
  - Comprehensive JSDoc comments
- **NFR-6.2**: Test coverage requirements:
  - Unit tests for all services
  - Component tests for interactive elements
  - E2E tests for critical user flows
- **NFR-6.3**: PR requirements:
  - Descriptive commit messages
  - Clear PR descriptions with context
  - Link to related issues/requirements
  - Before/after screenshots for UI changes
- **NFR-6.4**: Code review focus areas:
  - Performance implications
  - Memory leaks
  - Accessibility compliance
  - Data accuracy

---

## 6. Data Requirements

### 6.1 Paper Data Extraction

#### 6.1.1 Accuracy vs Contention (Figure 7)
- Extract accuracy values for DSVT-Voxel and AGILE3D across 4 contention levels
- Extract for 3 latency SLOs (100ms, 350ms, 500ms)
- Store latency violation rates
- Waymo dataset, Orin GPU
- **Format**: JSON lookup tables for fast access

#### 6.1.2 Branch Performance Data
- Extract performance characteristics for 3-5 representative AGILE3D branches:
  - Mean latency per contention level
  - Latency std dev per contention level
  - Accuracy per scene type
  - Memory footprint
- **Scope control**: Only precompute predictions for these branches to stay within asset budget

#### 6.1.3 DSVT-Voxel Baseline Data
- Extract DSVT-Voxel performance across all conditions:
  - Accuracy per scene type
  - Latency per contention level
  - Violation rates per latency SLO
- **Source**: Section 5.1 and Figure 11 of paper

### 6.2 Synthetic Point Cloud Data

#### 6.2.1 Scene Requirements
- **Vehicle-heavy**: 15-20 cars/trucks, 0-2 pedestrians, sparse point density
- **Pedestrian-heavy**: 10-15 pedestrians, 0-3 vehicles, moderate density
- **Mixed**: 8-10 vehicles, 6-8 pedestrians, 3-5 cyclists, high density

#### 6.2.2 Point Cloud Specifications
- **Coordinate system**: Standard LiDAR frame (x: forward, y: left, z: up)
- **Point density tiers**:
  - Demo hardware: 100,000 points per scene
  - Fallback hardware: 50,000 points per scene
- **Bounding box format**: [x, y, z, length, width, height, rotation]
- **Object classes**: vehicle, pedestrian, cyclist
- **Storage format**: Binary Float32Array (.bin files)
  - Attributes: [x, y, z] or [x, y, z, intensity]
  - NOT embedded in JSON (too large)
- **Parsing**: Use Web Worker to keep main thread responsive
- **Budgets**:
  - Per-scene asset ≤2.5MB compressed (brotli/gzip)
  - Total 3D assets ≤8MB compressed

#### 6.2.3 Data Format (JSON Metadata)
```json
{
  "scene_id": "vehicle_heavy_01",
  "name": "Highway Scene",
  "description": "Multi-lane highway with heavy vehicle traffic",
  "pointsBin": "assets/scenes/vehicle_heavy_01.bin",
  "pointCount": 100000,
  "pointStride": 3,
  "hasIntensity": false,
  "bounds": {
    "min": [-50, -25, -2],
    "max": [50, 25, 5]
  },
  "ground_truth": [
    {
      "id": "obj_001",
      "class": "vehicle",
      "bbox": [10.5, 3.2, 0.0, 4.5, 1.8, 1.5, 0.1],
      "confidence": 1.0
    }
  ],
  "predictions": {
    "DSVT_Voxel": [
      {
        "id": "pred_001",
        "class": "vehicle",
        "bbox": [10.3, 3.1, 0.0, 4.6, 1.9, 1.6, 0.12],
        "confidence": 0.92,
        "matches_gt": "obj_001"
      }
    ],
    "AGILE3D_CP_Pillar_032": [
      {
        "id": "pred_001",
        "class": "vehicle",
        "bbox": [10.4, 3.2, 0.0, 4.5, 1.8, 1.5, 0.11],
        "confidence": 0.95,
        "matches_gt": "obj_001"
      }
    ]
  },
  "metadata": {
    "vehicleCount": 18,
    "pedestrianCount": 1,
    "cyclistCount": 0,
    "complexity": "medium",
    "optimalBranch": "CP_Pillar_032"
  }
}
```

**Critical**: Raw point arrays MUST NOT be in JSON. Binary files only.

### 6.3 Branch Configuration Data

#### 6.3.1 AGILE3D Branch Configurations (3-5 Representative Branches)
```json
{
  "branch_id": "CP_Pillar_032",
  "name": "CenterPoint Pillar 0.32m",
  "controlKnobs": {
    "encodingFormat": "pillar",
    "spatialResolution": 0.32,
    "spatialEncoding": "DV",
    "featureExtractor": "2d_cnn",
    "detectionHead": "center"
  },
  "performance": {
    "memoryFootprint": 3.2,
    "latency": {
      "noContention": { "mean": 147, "std": 5.2 },
      "lightContention": { "mean": 168, "std": 7.8 },
      "moderateContention": { "mean": 195, "std": 12.3 },
      "intenseContention": { "mean": 245, "std": 18.9 },
      "peakContention": { "mean": 298, "std": 25.1 }
    },
    "accuracy": {
      "vehicleHeavy": 64.2,
      "pedestrianHeavy": 58.7,
      "mixed": 61.5
    }
  },
  "modelFamily": "CenterPoint"
}
```

#### 6.3.2 Baseline Configuration (DSVT-Voxel)
```json
{
  "branch_id": "DSVT_Voxel",
  "name": "DSVT Voxel (Baseline)",
  "controlKnobs": {
    "encodingFormat": "voxel",
    "spatialResolution": 0.16,
    "spatialEncoding": "DV",
    "featureExtractor": "transformer",
    "detectionHead": "center"
  },
  "performance": {
    "memoryFootprint": 6.8,
    "latency": {
      "noContention": { "mean": 371, "std": 15.2 },
      "lightContention": { "mean": 425, "std": 22.8 },
      "moderateContention": { "mean": 498, "std": 35.7 },
      "intenseContention": { "mean": 645, "std": 58.2 },
      "peakContention": { "mean": 782, "std": 72.4 }
    },
    "accuracy": {
      "vehicleHeavy": 67.1,
      "pedestrianHeavy": 62.3,
      "mixed": 64.8
    }
  },
  "modelFamily": "DSVT"
}
```

---

## 7. Technical Architecture

### 7.1 Technology Stack

#### 7.1.1 Core Framework
- **Angular 17+** (latest stable, standalone components)
- **TypeScript** (strict mode enabled)
- **RxJS** for reactive programming

#### 7.1.2 3D Visualization
- **Three.js** (r159 or later) for WebGL rendering
- **angular-three (ngt)** for Angular integration
- Custom shaders for point cloud rendering (if needed for performance)
- **BufferGeometry** with interleaved attributes
- **InstancedMesh** for bounding boxes

#### 7.1.3 Data Visualization
- **uPlot** for high-performance real-time charts (preferred)
- Lightweight, no heavy framework dependencies
- Alternative: **ECharts** if advanced features needed

#### 7.1.4 UI Framework
- **Angular Material** for component library
- Use CSS custom properties for theming
- Defer Tailwind (Material is faster for 2-week timeline)
- Custom SCSS for specialized layouts

#### 7.1.5 Animation
- **Angular animations** module for component transitions
- **CSS transitions** for simple state changes
- **GSAP** only if absolutely necessary for complex animations
- Respect `prefers-reduced-motion` media query

#### 7.1.6 Build & Deployment
- **Angular CLI** for build system
- **Vercel** (preferred) for hosting
  - Built-in brotli/gzip compression
  - Easy CDN configuration
  - Automatic HTTPS
- Configure immutable cache headers for .bin files
- GitHub for version control
- GitHub Actions for CI/CD (optional)

### 7.2 Component Architecture

```
AppComponent
├── HeaderComponent (logo, title)
├── HeroComponent (brief intro, CTA)
└── MainDemoComponent
    ├── DualViewerComponent (contains both 3D viewers)
    │   ├── SceneViewerComponent (Left: Baseline)
    │   │   ├── PointCloudRenderer
    │   │   └── BoundingBoxRenderer
    │   └── SceneViewerComponent (Right: AGILE3D)
    │       ├── PointCloudRenderer
    │       └── BoundingBoxRenderer
    ├── ControlPanelComponent
    │   ├── SceneSelectorComponent
    │   ├── VoxelSizeSliderComponent
    │   ├── ContentionSliderComponent
    │   ├── LatencySloSliderComponent
    │   └── AdvancedControlsComponent (hidden by default)
    ├── MetricsDashboardComponent
    │   ├── BaselineMetricsComponent
    │   ├── Agile3dMetricsComponent
    │   └── ComparisonHighlightsComponent
    ├── ComparisonChartComponent (optional, if time permits)
    └── FooterComponent (paper link, repo link)
```

### 7.3 Data Services

```typescript
// Core data management
DataService
├── SceneDataService
│   ├── loadSceneMetadata(sceneId): Observable<SceneMetadata>
│   ├── loadPointCloud(binPath): Promise<Float32Array>
│   └── parsePointCloudInWorker(data): Observable<Point[]>
├── BranchConfigService
│   ├── getBaselineConfig(): BranchConfig
│   ├── getAgile3dBranches(): BranchConfig[]
│   └── getBranchPerformance(branchId, contention, slo): PerformanceMetrics
├── PaperDataService
│   ├── getAccuracyData(figure): any
│   ├── getParetoData(dataset): any
│   └── getLatencyData(model, contention): any
└── SimulationService
    ├── selectOptimalBranch(scene, contention, slo, voxelSize): string
    ├── calculateMetrics(branchId, scene, contention, slo): Metrics
    └── compareWithBaseline(agile3dMetrics, baselineMetrics): Comparison

// Rendering service
RenderLoopService
├── registerRenderer(id, callback): void
├── unregisterRenderer(id): void
└── private animationLoop(): void // Single rAF loop

// State management
StateService
├── currentScene$: BehaviorSubject<string>
├── contentionLevel$: BehaviorSubject<number>
├── latencySlo$: BehaviorSubject<number>
├── voxelSize$: BehaviorSubject<number>
├── activeBranch$: BehaviorSubject<string>
└── comparisonData$: Observable<ComparisonData> // Derived state
```

### 7.4 State Management

#### 7.4.1 Global State (BehaviorSubjects)
- Current scene selection
- Current contention level (0-100%)
- Current latency SLO (100-500ms)
- Current voxel/pillar size (0.16-0.64m)
- Active AGILE3D branch
- Camera position/rotation (for sync)

#### 7.4.2 Derived State (combineLatest + map)
- Optimal AGILE3D branch for current config
- Baseline metrics for current config
- AGILE3D metrics for current config
- Comparison deltas
- Chart data series

#### 7.4.3 Management Approach
- Angular services with BehaviorSubjects
- Use `shareReplay(1)` at boundaries
- SimulationService maps inputs → outputs via precomputed lookup tables
- Target: <100ms for all state updates
- NgRx: NOT needed (overkill for this scope)

### 7.5 Performance Optimizations

#### 7.5.1 3D Rendering
- Single shared `Points` geometry for both viewers
- InstancedMesh for all bounding boxes (one draw call per object type)
- Frustum culling enabled
- LOD: Decimate to 50k points if FPS < 45
- Pre-warm shaders and materials on init
- Clamp devicePixelRatio to 1.5-2.0
- Dispose geometries/materials on component destroy

#### 7.5.2 Data Loading
- Binary point clouds loaded on demand
- Parse in Web Worker (offload from main thread)
- Cache parsed data in memory
- Lazy load scenes (don't load all 3 upfront)
- Use Transfer ArrayBuffer for zero-copy to Worker

#### 7.5.3 Bundle Size
- Lazy load non-critical routes
- Code splitting for chart components
- Tree-shaking enabled
- Compress assets with brotli/gzip
- Use Angular's production build optimizations

---

## 8. User Interface Specifications

### 8.1 Layout Structure

#### 8.1.1 Desktop Layout (1920x1080)
```
┌────────────────────────────────────────────────────────┐
│  Header (Logo, Title)                                   │
├────────────────────────────────────────────────────────┤
│  Hero (Brief Intro, CTA)                                │
├─────────────────────────┬──────────────────────────────┤
│                          │                               │
│  DSVT-Voxel (Baseline)   │  AGILE3D (Adaptive)           │
│  3D Viewer (50% width)   │  3D Viewer (50% width)        │
│                          │                               │
│  [Point cloud + boxes]   │  [Point cloud + boxes]        │
│                          │                               │
│                          │                               │
├──────────────────────────┴──────────────────────────────┤
│  Control Panel (horizontal layout)                       │
│  [Scene] [Voxel Size] [Contention] [Latency SLO] [⚙️Adv] │
├────────────────────────────────────────────────────────┤
│  Metrics Dashboard (3-column layout)                     │
│  ┌────────────┬────────────────┬────────────┐          │
│  │ Baseline   │  Comparison    │  AGILE3D   │          │
│  │ Metrics    │  Highlights    │  Metrics   │          │
│  │ (Left)     │  (Center)      │  (Right)   │          │
│  └────────────┴────────────────┴────────────┘          │
├────────────────────────────────────────────────────────┤
│  Footer (Paper Link, Repo Link)                         │
└────────────────────────────────────────────────────────┘
```

#### 8.1.2 Tablet Layout (768-1024px)
```
┌────────────────────────────────────┐
│  Header                             │
├────────────────────────────────────┤
│  Hero (Condensed)                   │
├────────────────────────────────────┤
│  DSVT-Voxel (Baseline)              │
│  3D Viewer (100% width)             │
├────────────────────────────────────┤
│  AGILE3D (Adaptive)                 │
│  3D Viewer (100% width)             │
├────────────────────────────────────┤
│  Control Panel (vertical)           │
├────────────────────────────────────┤
│  Metrics (stacked)                  │
│  ┌──────────────────────────────┐  │
│  │ Baseline                     │  │
│  ├──────────────────────────────┤  │
│  │ Comparison                   │  │
│  ├──────────────────────────────┤  │
│  │ AGILE3D                      │  │
│  └──────────────────────────────┘  │
├────────────────────────────────────┤
│  Footer                             │
└────────────────────────────────────┘
```

### 8.2 Visual Design Principles

#### 8.2.1 Color Palette
- **Primary**: Professional blue (#2563EB) for CTAs and highlights
- **Secondary**: Slate gray (#475569) for UI elements
- **Accent**: Emerald green (#10B981) for success/improvements
- **Warning**: Amber (#F59E0B) for moderate/neutral differences
- **Error**: Red (#EF4444) for violations/degradation
- **Background**: White (#FFFFFF) or light gray (#F8FAFC)
- **Object colors** (3D bounding boxes):
  - Blue (#3B82F6): Vehicles
  - Red (#EF4444): Pedestrians
  - Orange (#F97316): Cyclists
- **Viewer labels**:
  - Baseline: Gray background (#6B7280)
  - AGILE3D: Blue background (#2563EB)

#### 8.2.2 Typography
- **Font family**: System font stack (SF Pro, Segoe UI, Roboto)
- **Headings**: Sans-serif, 600 weight
  - H1: 48px
  - H2: 36px
  - H3: 24px
  - H4: 20px
- **Body**: Sans-serif, 16px, 1.5 line height, 400 weight
- **Metrics/Data**: Monospace font (Consolas, Monaco, Courier), 14-16px
- **Labels**: 14px, 500 weight

#### 8.2.3 Spacing & Layout
- **Base unit**: 8px (use multiples: 8, 16, 24, 32, 48, 64)
- **Padding**: Components use 16px or 24px
- **Margins**: Sections separated by 32px or 48px
- **Card-based design** for distinct sections
- **Clear visual groupings** with whitespace and subtle borders

### 8.3 Animation Specifications

#### 8.3.1 Transitions (When prefers-reduced-motion: no-preference)
- **Parameter changes**: 300ms ease-in-out
- **Metric updates**: 200ms ease-out with number counting
- **Branch switching**: 300ms highlight flash
- **Scene switching**: 500ms crossfade
- **Bounding box updates**: 400ms ease-in-out
- **Hover effects**: 150ms ease-out

#### 8.3.2 Reduced Motion (When prefers-reduced-motion: reduce)
- **All transitions**: Instant (0ms)
- **No counting animations**
- **No entrance animations**
- **No highlight flashes**
- **Simple opacity changes only**

#### 8.3.3 Micro-interactions
- **Slider drag**: Thumb scale(1.15), value tooltip follows
- **Button hover**: Slight lift (2px translateY), shadow increase
- **Metric change**: Brief highlight pulse
- **Branch switch**: Icon spin (180deg)

### 8.4 Accessibility Features

#### 8.4.1 Color Contrast
- All text meets WCAG AA standards (4.5:1 for normal, 3:1 for large)
- Critical information not conveyed by color alone
- Color-blind safe palette tested with simulators

#### 8.4.2 Keyboard Navigation
- All interactive elements are keyboard accessible
- Visible focus indicators (2px solid blue outline)
- Logical tab order
- Escape key closes advanced controls

#### 8.4.3 Screen Readers
- Proper ARIA labels on all controls
- ARIA live regions for metric updates
- Alt text for any images
- Semantic HTML (button, nav, main, article)

#### 8.4.4 Alternative Representations
- Bounding boxes use patterns in addition to color
- Metrics show icons (✓/✗) in addition to color coding
- Tooltips available via click in addition to hover

---

## 9. Content Requirements

### 9.1 Text Content

#### 9.1.1 Hero Section
- **Headline**: "AGILE3D: Adaptive 3D Object Detection"
- **Subheadline**: "See how adaptive detection outperforms static baselines in real-time"
- **CTA**: "Try the Demo" button (scrolls to viewers)

#### 9.1.2 Viewer Labels
- **Left viewer**: "DSVT-Voxel (Baseline)" with subtitle "Fixed Configuration"
- **Right viewer**: "AGILE3D" with subtitle "Adaptive System"

#### 9.1.3 Tooltips (Keep concise, 1-2 sentences)
- **Scene selector**: "Choose a scenario to see how each system performs in different environments"
- **Voxel size**: "Spatial resolution affects both accuracy and latency. Smaller voxels = more detail but slower."
- **Contention**: "Simulates GPU resource competition from other applications running simultaneously"
- **Latency SLO**: "Target processing time. AGILE3D adapts to meet this requirement."
- **Advanced controls**: "Fine-tune additional parameters for AGILE3D branch selection"

#### 9.1.4 Metrics Labels
- **Accuracy (mAP)**: "Detection accuracy (higher is better)"
- **Latency**: "Processing time per frame (lower is better)"
- **Violations**: "Percentage of frames exceeding latency SLO (lower is better)"
- **Memory**: "GPU memory usage (lower is better)"
- **SLO Compliance**: "Meeting the target latency requirement"

#### 9.1.5 Footer
- "Learn more: [Read the paper] | [View code on GitHub]"
- Citation: "Wang et al., AGILE3D, MobiSys 2025"

### 9.2 Visual Assets

#### 9.2.1 Required Assets (Minimal)
- Logo/icon for AGILE3D (optional, can use text)
- Object type icons (vehicle, pedestrian, cyclist) for legend
- Icons for metrics (accuracy, latency, memory)
- Loading spinner for point cloud loading

#### 9.2.2 Optional Assets (If Time Permits)
- Background pattern/texture for hero section
- Illustration of MEF concept (simplified diagram)
- Screenshots for social media sharing

#### 9.2.3 3D Assets (Critical)
- 3 point cloud scenes (.bin files)
- Bounding box data (JSON metadata)
- Detection predictions for baseline and 3-5 AGILE3D branches

---

## 10. AI Agent Development Workflow

### 10.1 Software Engineer Agent

#### 10.1.1 Agent Responsibilities
- Implement components according to PRD specifications
- Follow Angular best practices and style guide
- Write clean, maintainable, well-documented code
- Create unit tests for services and components
- Follow the project's coding standards

#### 10.1.2 Agent Inputs
- This PRD document
- Macro plan and meso-level work packages
- Technical requirements and specifications
- Acceptance criteria for each work package

#### 10.1.3 Agent Outputs
- Implemented features (TypeScript, HTML, SCSS)
- Unit tests (Jasmine/Karma)
- Component documentation (JSDoc comments)
- Git commits with descriptive messages
- Pull requests with context and screenshots

#### 10.1.4 Code Quality Standards
- **TypeScript strict mode** enabled
- **ESLint** compliance (Angular recommended rules)
- **No console.log** in production code (use proper logging)
- **Function complexity**: Max 50 lines per function
- **File length**: Max 300 lines per file
- **Test coverage**: Minimum 70% for services, 60% for components
- **Comments**: JSDoc for all public methods
- **Types**: No `any` unless absolutely necessary (use `unknown` instead)

### 10.2 SQA (Software Quality Assurance) Agent

#### 10.2.1 Agent Responsibilities
- Review implemented features against PRD requirements
- Execute test plans and document results
- Identify bugs, regressions, and edge cases
- Verify accessibility compliance
- Validate performance against NFRs
- Test cross-browser compatibility

#### 10.2.2 Testing Checklist
- [ ] **Functional testing**: All FR requirements met
- [ ] **Performance testing**: All NFR requirements met (60fps, <5s load, etc.)
- [ ] **Accessibility testing**: WCAG AA compliance
- [ ] **Browser testing**: Chrome, Firefox, Safari, Edge (latest 2 versions)
- [ ] **Responsive testing**: Desktop (1920x1080), Tablet (1024x768)
- [ ] **Data accuracy**: All numbers match paper figures
- [ ] **Edge cases**: Rapid inputs, window resize, tab backgrounding
- [ ] **Error handling**: Graceful degradation on failures
- [ ] **Memory leaks**: No leaks after 10+ minutes of usage

#### 10.2.3 Test Reports
- Format: Markdown or JSON
- Include: Test name, status (pass/fail), evidence (screenshots/logs)
- Priority: Critical, High, Medium, Low
- Reproducibility: Steps to reproduce any failures

#### 10.2.4 Bug Report Template
```markdown
## Bug Report

**Title**: [Brief description]

**Priority**: Critical | High | Medium | Low

**Component**: [Affected component name]

**Requirements**: [Related FR/NFR numbers]

**Environment**:
- Browser: [Name and version]
- OS: [Operating system]
- Screen resolution: [Width x Height]

**Steps to Reproduce**:
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected Behavior**: [What should happen]

**Actual Behavior**: [What actually happens]

**Evidence**: [Screenshots, console logs, video]

**Impact**: [How this affects users]

**Suggested Fix**: [Optional, if known]
```

### 10.3 PR Review Agent

#### 10.3.1 Agent Responsibilities
- Review code quality and adherence to standards
- Check for performance issues and potential bugs
- Verify test coverage and test quality
- Ensure accessibility compliance
- Validate against PRD requirements
- Check for security vulnerabilities

#### 10.3.2 Review Checklist

**Code Quality**:
- [ ] Code follows Angular style guide
- [ ] TypeScript strict mode compliance
- [ ] No `any` types (use `unknown` or proper types)
- [ ] Proper error handling
- [ ] No console.log in production code
- [ ] Functions are small and focused (<50 lines)
- [ ] Clear and descriptive naming

**Documentation**:
- [ ] JSDoc comments for all public methods
- [ ] README updated if needed
- [ ] Inline comments for complex logic
- [ ] PR description is clear and complete

**Testing**:
- [ ] Unit tests written and passing
- [ ] Test coverage meets minimum requirements
- [ ] Edge cases are tested
- [ ] No skipped or disabled tests without justification

**Performance**:
- [ ] No obvious performance issues (N+1 queries, unnecessary re-renders)
- [ ] Proper use of RxJS operators (shareReplay, distinctUntilChanged)
- [ ] Memory leaks prevented (unsubscribe, component cleanup)
- [ ] Large data handled efficiently (Web Workers, pagination)

**Accessibility**:
- [ ] ARIA labels present where needed
- [ ] Keyboard navigation works
- [ ] Color contrast meets WCAG AA
- [ ] Focus indicators visible

**Security**:
- [ ] No hardcoded credentials or API keys
- [ ] User input properly sanitized
- [ ] No XSS vulnerabilities
- [ ] Dependencies are up-to-date and secure

#### 10.3.3 Review Feedback Format
```markdown
## PR Review: [PR Title]

### Summary
[Brief overview of changes]

### Status
- [ ] Approved
- [ ] Approved with minor suggestions
- [ ] Changes requested

### Code Quality: [Pass/Fail]
- [✓] Follows style guide
- [✗] Contains `any` types in 3 locations
- [✓] Proper error handling

### Testing: [Pass/Fail]
- [✓] Unit tests present and passing
- [✓] Coverage: 75% (meets requirement)
- [✗] Missing edge case test for rapid slider changes

### Performance: [Pass/Fail]
- [✓] No obvious performance issues
- [⚠️] Consider using shareReplay on line 42

### Accessibility: [Pass/Fail]
- [✓] ARIA labels present
- [✓] Keyboard navigation works
- [✗] Missing focus indicator on custom button

### Requirements: [Pass/Fail]
- [✓] Meets FR-2.4 (Voxel size slider)
- [✓] Meets NFR-1.3 (Updates within 100ms)

### Issues Found
1. **Critical**: [None]
2. **High**: Missing focus indicator on custom button (line 127)
3. **Medium**: Consider using shareReplay to avoid duplicate subscriptions (line 42)
4. **Low**: Typo in comment (line 89)

### Suggestions
- Consider extracting lines 50-75 into a separate utility function
- Add JSDoc comment to explain the complex calculation on line 112

### Evidence
[Screenshots if applicable]
```

### 10.4 Human Oversight

#### 10.4.1 Human Responsibilities
- Review agent outputs for correctness
- Make final decisions on design and architecture
- Approve or reject PRs
- Handle complex edge cases agents can't resolve
- Conduct final demo rehearsal
- Present to NSF representatives

#### 10.4.2 Escalation Triggers
Agents should escalate to human when:
- Ambiguity in requirements cannot be resolved
- Performance targets cannot be met with current approach
- Critical bugs cannot be fixed within time constraints
- Architectural decisions needed beyond PRD scope
- Security concerns identified
- Accessibility requirements unclear

---

## 11. Out of Scope

### 11.1 Explicitly Excluded from v1.0
- **Real-time model inference**: Demo uses pre-computed results only
- **User data upload**: No ability to upload custom point clouds
- **Training interface**: No ability to retrain models
- **Video recording/export**: No download of demo sessions
- **Multi-user features**: No collaboration or sharing
- **Backend services**: Fully static, client-side application
- **Mobile optimization**: Desktop and tablet only (mobile is bonus)
- **Detailed architecture diagrams**: Keep minimal, focus on demo
- **Extensive technical deep-dive**: Minimal educational content only
- **Multiple baseline models**: DSVT-Voxel only
- **Historical trend tracking**: Metrics show current state only (no timeline)

### 11.2 Future Enhancements (Post-Demo)
- Live model inference integration
- Additional datasets beyond Waymo/nuScenes/KITTI
- Additional scene types (construction, parking, rural)
- User-selectable baseline models
- Video replay and export
- Historical metrics tracking over time
- Comparative mode with more methods (Chanakya, LiteReconfig)
- Detailed branch profiling explorer
- Download results as PDF/CSV
- API for researchers to query data
- Mobile-optimized interface

---

## 12. Risks & Mitigations

### 12.1 Technical Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Three.js performance issues rendering two viewers | Critical | High | Share geometry, use instancing, implement LOD, test early and often |
| Point cloud file sizes exceed budget | High | Medium | Decimate points, use binary format, aggressive compression |
| Angular + Three.js integration complexity | High | Medium | Use angular-three (ngt), allocate time for learning, start with simple scene |
| Browser compatibility issues (WebGL) | Medium | Medium | Add capability check, provide fallback message, test on all browsers early |
| Timeline overrun due to dual viewer complexity | Critical | High | MVP first (single working viewer), add second viewer once proven |
| Data extraction errors from paper | High | Low | Double-check all values, create validation tests, cross-reference multiple figures |
| AI agents produce non-functional code | High | Medium | Human review all code, comprehensive testing, clear specifications |
| Memory leaks from Two viewers | High | Medium | Proper cleanup, dispose geometries, unsubscribe observables, memory profiling |

### 12.2 Content Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Misrepresenting paper findings | Critical | Low | Cross-reference all claims, have paper authors review if possible |
| Demo doesn't clearly show advantage | Critical | Medium | Focus on scenarios where difference is obvious, highlight metrics |
| Users don't understand controls | High | Medium | Clear tooltips, consider brief tutorial on first load |
| Insufficient "wow factor" | High | Low | Polish animations, smooth interactions, impressive visual quality |

### 12.3 Schedule Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Dual 3D viewers take longer than expected | Critical | High | MVP with one viewer first, add second incrementally, have static fallback ready |
| Data preparation delays development | High | Medium | Front-load data extraction (Week 1 Day 1-2), parallelize with setup |
| AI agent debugging overhead | Medium | Medium | Clear specifications, comprehensive testing, human review checkpoints |
| Scope creep from stakeholder requests | Medium | Medium | Lock requirements after planning phase, maintain "future enhancements" list |
| Performance optimization takes too long | High | Medium | Set minimum viable performance targets, optimize iteratively |

---

## 13. Success Metrics

### 13.1 Demo Day Success Criteria

**Must Have** (Critical for NSF demo):
- ✅ Demo runs without crashes for 15+ minute presentation
- ✅ Both 3D viewers render smoothly (60fps sustained)
- ✅ Side-by-side comparison clearly shows AGILE3D advantage
- ✅ All controls work intuitively
- ✅ Metrics accurately reflect paper findings
- ✅ NSF representatives understand key innovation within 5 minutes

**Nice to Have**:
- ✅ Audience members want to interact themselves
- ✅ Questions focus on methodology rather than demo functionality
- ✅ Requests for collaboration or follow-up discussions
- ✅ Positive unsolicited feedback about visual quality
- ✅ Social media sharing or word-of-mouth recommendations

### 13.2 Technical Success Metrics

**Performance** (Must Meet NFRs):
- 3D rendering: ≥60fps sustained in both viewers
- Initial load: <5 seconds
- Control response: <100ms
- Parameter updates: <200ms
- Zero crashes during 30-minute stress test
- Memory usage: <2GB after 15 minutes

**Accuracy** (Must Be Correct):
- All numbers match paper figures exactly
- Detection visualizations match paper examples
- Branch selection logic follows paper methodology
- Baseline performance matches DSVT-Voxel from paper

**Usability** (Should Be Intuitive):
- First-time user can navigate without instructions
- All controls are discoverable within 60 seconds
- Tooltips provide adequate context
- Comparison is immediately obvious

### 13.3 Agent Performance Metrics

**Software Engineer Agent**:
- Code passes all linting checks
- Test coverage ≥70% for services
- No critical bugs in code review
- PRs require <2 rounds of revisions

**SQA Agent**:
- Identifies ≥90% of bugs before human review
- Test reports are comprehensive and actionable
- No critical bugs missed in testing
- Performance validation catches issues early

**PR Review Agent**:
- Catches all critical code quality issues
- Reviews completed within 24 hours
- Feedback is actionable and specific
- <10% false positive rate on issues

---

## 14. Acceptance Criteria

### 14.1 Functional Acceptance

**Dual 3D Viewers**:
- [ ] Both viewers render identical point clouds
- [ ] Left viewer labeled "DSVT-Voxel (Baseline)"
- [ ] Right viewer labeled "AGILE3D"
- [ ] Camera controls are synchronized
- [ ] Bounding boxes render with correct colors (blue/red/orange)
- [ ] Scene switching works for all 3 scenes (<500ms)
- [ ] Detection differences are visually obvious

**Control Panel**:
- [ ] Scene selector switches between 3 scenes
- [ ] Voxel size slider has discrete steps (0.16-0.64m)
- [ ] Contention slider has labeled markers (0-100%)
- [ ] Latency SLO slider ranges 100-500ms
- [ ] Advanced controls are hidden by default
- [ ] Advanced toggle reveals additional options
- [ ] All controls update both viewers

**Metrics Dashboard**:
- [ ] Baseline metrics display correctly (left panel)
- [ ] AGILE3D metrics display correctly (right panel)
- [ ] Comparison highlights show deltas (center panel)
- [ ] Color coding indicates improvement/degradation
- [ ] Metrics update within 100ms of parameter changes
- [ ] Animations are smooth (or disabled if prefers-reduced-motion)

### 14.2 Non-Functional Acceptance

**Performance**:
- [ ] Initial page load <5 seconds
- [ ] Both 3D viewers maintain ≥60fps during interaction
- [ ] Control updates reflect in <100ms
- [ ] Parameter changes update viewers in <200ms
- [ ] No memory leaks after 15 minutes
- [ ] Bundle size <10MB (excluding 3D assets)
- [ ] 3D assets <8MB compressed

**Compatibility**:
- [ ] Works in Chrome (latest 2 versions)
- [ ] Works in Firefox (latest 2 versions)
- [ ] Works in Safari (latest 2 versions)
- [ ] Works in Edge (latest 2 versions)
- [ ] Responsive on tablet (1024x768+)
- [ ] WebGL check shows fallback on unsupported browsers

**Quality**:
- [ ] No console errors during normal usage
- [ ] All links work (paper, repo)
- [ ] Text contrast meets WCAG AA
- [ ] No broken images or assets
- [ ] Smooth animations without jank
- [ ] Keyboard navigation works for all controls

**Accuracy**:
- [ ] All numerical data matches paper (validated against Figures 7, 11-16)
- [ ] DSVT-Voxel baseline matches paper specifications
- [ ] AGILE3D branches match paper descriptions
- [ ] Terminology is consistent with paper
- [ ] Citations are correct

---

## 15. Appendices

### 15.1 Reference Materials

**Primary Source**:
- AGILE3D Paper (MobiSys '25): https://engineering.purdue.edu/dcsl/publications/papers/2025/agile3d-mobisys25.pdf

**Datasets**:
- Waymo Open Dataset: https://waymo.com/open/
- nuScenes Dataset: https://www.nuscenes.org/
- KITTI Dataset: http://www.cvlibs.net/datasets/kitti/

**Code Repository**:
- AGILE3D Artifacts: https://doi.org/10.5281/zenodo.15073471

**Design Inspiration**:
- Reference Demo: https://sprasan3.github.io/edge-server-demo/

### 15.2 Key Data Extraction Sources

**Critical Figures for Data**:
- **Figure 7** (p.11): Accuracy vs contention for DSVT-Voxel and AGILE3D
- **Figure 11** (p.13): Waymo Pareto frontier (extract DSVT-Voxel baseline)
- **Table 2** (p.13): Performance metrics for different branches

**Supporting Figures**:
- **Figure 4** (p.5): Point cloud visualizations (inspiration for scenes)
- **Figure 15-16** (p.14): Voxel/pillar size impacts

### 15.3 Glossary

See original PRD Section 15 (unchanged).

---

## 16. Sign-off & Approvals

### 16.1 Approval Required From

- [ ] **Project Lead**: Confirms scope and requirements
- [ ] **Primary Developer** (Human): Confirms technical feasibility
- [ ] **NSF Presenter**: Confirms demo meets presentation needs

### 16.2 Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Initial | AI Assistant | Original comprehensive PRD |
| 2.0 | Updated | AI Assistant | Revised for side-by-side comparison demo, added AI agent workflow |

---

## 17. Next Steps

### 17.1 Immediate Actions (Day 1)
1. **Human**: Review and approve this PRD
2. **Human**: Extract data from paper figures into JSON files
3. **Software Engineer Agent**: Set up Angular project structure
4. **Software Engineer Agent**: Install dependencies (Angular, Three.js, angular-three)
5. **Human**: Generate or source synthetic point cloud data

### 17.2 Week 1 Priorities
- **Days 1-2**: Project setup, data extraction, design system
- **Days 3-4**: Build single 3D viewer (prove feasibility)
- **Day 5**: Duplicate viewer for side-by-side
- **Days 6-7**: Implement control panel with reactive updates

### 17.3 Week 2 Priorities
- **Days 8-9**: Implement metrics dashboard and comparison highlights
- **Days 10-11**: Polish animations, accessibility, performance optimization
- **Days 12-13**: Comprehensive testing (SQA Agent), bug fixes
- **Day 14**: Final review, deployment, demo rehearsal

### 17.4 Pre-Demo Checklist
- [ ] Full walkthrough rehearsal completed
- [ ] Tested on presentation hardware (specific laptop/projector)
- [ ] Backup plan ready (video recording of demo)
- [ ] All links verified (paper, repository)
- [ ] Talking points prepared
- [ ] Q&A anticipated and practiced
- [ ] Demo URL shared with NSF representatives in advance
- [ ] Analytics configured (optional, to track engagement)

---

**End of PRD v2.0**