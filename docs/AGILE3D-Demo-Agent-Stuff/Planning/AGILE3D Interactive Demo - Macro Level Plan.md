# AGILE3D Interactive Demo - Revised Macro Plan

## Overview
Build a focused comparison demo showing AGILE3D vs. baseline algorithm side-by-side on the same 3D point cloud scenes, with user-controllable parameters and live metrics display. Target audience: NSF representatives.

**Reference inspiration**: https://sprasan3.github.io/edge-server-demo/

---

## Phase 1: Foundation & Data Preparation

### 1.1 Project Setup
- Initialize Angular project with required dependencies
- Configure build system and deployment pipeline
- Set up project structure and module organization
- Use angular-three (ngt) as the Three.js integration layer
- Create a RenderLoopService that owns a single requestAnimationFrame loop; components subscribe via Observables to avoid multiple loops

### 1.2 Data Extraction & Preparation
- Worker-first parsing infrastructure:
  - Implement Web Worker for .bin Float32 parsing and SceneDataService (zero-copy via Transferable)
  - Minimal validation harness to render a tiny .bin and verify non-blocking UI
- Extract numerical data from paper figures (Figures 7–15) and tables
- Explicit: DSVT-Voxel Baseline Data (PRD §6.1.3)
  - Accuracy per scene (vehicle-heavy, pedestrian-heavy, mixed)
  - Latency per contention (0%, 38%, 45%, 64%, 67%)
  - Violation rates per SLO (100/350/500ms)
  - Memory footprint
- Create JSON data structures for:
  - Accuracy vs contention data
  - Branch performance characteristics (latency, accuracy per configuration)
  - Baseline model specifications (DSVT-Voxel)
- Point cloud data format and size budget:
  - Store raw points in binary Float32Array files (.bin) fetched via arrayBuffer (stride 3: [x, y, z])
  - Parse in a Web Worker to keep main thread responsive
  - Size budgets: total 3D assets ≤ 8MB; per scene ≤ 2.5MB (bin + metadata), compressed (brotli/gzip) at rest
  - Provide two scene tiers:
    - Demo hardware: ≤100k points/scene
    - Fallback hardware: ≤50k points/scene
- Generate synthetic point cloud data for three scenarios (vehicle-heavy, pedestrian-heavy, mixed)
- Asset pre-compression:
  - Pre-compress .bin with Brotli at build-time; ensure server serves with Content-Encoding: br
- Extensibility validation:
  - Add a 4th test scene via JSON configuration only (no code changes) to validate FR-1.11
- Tier selection & fallback (NFR-1.9):
  - Document FPS-based auto-fallback (<45fps sustained ⇒ switch to 50k tier) with manual override

### 1.3 Design System & Layout
- Define color scheme and typography
- Design two-column comparison layout (inspired by reference site):
  - Left: Baseline algorithm 3D view
  - Right: AGILE3D 3D view
  - Top: Configuration inputs panel
  - Advanced controls placeholder (collapsed by default; UI only in Phase 1)
  - Bottom/Side: Metrics display
- Create component style guidelines
- Design responsive breakpoints
- Establish animation/transition standards

---

## Phase 2: Core Side-by-Side Comparison Demo

### 2.1 Dual 3D Point Cloud Viewers
- Integrate Three.js with Angular using angular-three (ngt)
- Implement basic 3D scene setup (camera, lighting, renderer)
- Build point cloud rendering system
- Create 3D bounding box visualization with color coding:
  - Blue: Vehicles
  - Red: Pedestrians
  - Orange: Cyclists
- Create TWO synchronized 3D viewers:
  - **Left viewer**: Shows baseline algorithm detections (DSVT-Voxel - based on paper's primary static baseline)
  - **Right viewer**: Shows AGILE3D detections
- Implement synchronized camera controls (orbit, zoom, pan) - both viewers move together
- Add object highlighting and selection
- Rendering strategy for performance:
  - Use a single Points BufferGeometry with interleaved attributes and lightweight ShaderMaterial
  - Render bounding boxes as instanced LineSegments (wireframes) or line-based cylinders
  - Apply frustum culling, decimation when zoomed out, and configurable LOD targets
  - Share point cloud geometry between both viewers (render same points twice with different detections)
- **Architecture note**: Design SceneService to use a configuration-driven approach where scene types are loaded from JSON/config files, making it trivial to add new scenes without code changes

### 2.2 Configuration Input Panel
Build centralized control panel with these inputs:

**Scene Selection:**
- Dropdown/buttons: Vehicle-Heavy, Pedestrian-Heavy, Mixed Traffic
- Display: Object counts preview

**System Parameters:**
- **Voxel/Pillar Size** (Spatial Resolution):
  - Slider or discrete buttons: 0.16m, 0.24m, 0.32m, 0.48m, 0.64m
  - Label: "Spatial Resolution"
  - Shows impact on both accuracy and latency

- **Contention Level**:
  - Slider: 0-100% with markers at key points
  - Labels: None (0%), Light (38%), Moderate (45%), Intense (64%), Peak (67%)
  - Represents GPU resource contention
  - 100ms debounce on changes

- **Latency SLO** (Service Level Objective):
  - Slider: 100-500ms, step 10ms
  - Shows target latency requirement
  - 100ms debounce on changes

**Optional Advanced Controls** (behind "Advanced" toggle, hidden by default):
- Encoding format: Voxel vs Pillar
- Detection head: Anchor-based vs Center-based
- Feature extractor type: Transformer vs CNN

**Current Configuration Display:**
- Show active AGILE3D branch name (e.g., "CP-Pillar-0.32")
- Display baseline model name: **"DSVT-Voxel"** (fixed baseline from paper)
- Show control knob settings:
  - Encoding format (Voxel/Pillar)
  - Spatial resolution (grid size)
  - Spatial encoding (HV/DV)
  - 3D feature extractor
  - Detection head

Wire up reactive data flow:
- Use BehaviorSubjects with shareReplay(1)
- SimulationService maps (scenario, voxelSize, contention, SLO) → (baseline metrics, AGILE3D metrics, active branch)
- Updates both 3D viewers with new detection results
- Updates metrics panels

### 2.3 Metrics Display Panels

**Baseline Algorithm Metrics** (Left side):
- **Accuracy (mAP)**: X.XX%
- **Latency**: XXX ms
- **Violations**: X.XX% (times exceeded SLO)
- **Memory**: X.X GB
- Status indicator: ✓ or ✗ for SLO compliance

**AGILE3D Metrics** (Right side):
- **Accuracy (mAP)**: X.XX%
- **Latency**: XXX ms
- **Violations**: X.XX% (times exceeded SLO)
- **Memory**: X.X GB
- **Active Branch**: Branch name
- **Branch Switches**: Count (if tracking over time)
- Status indicator: ✓ or ✗ for SLO compliance

**Comparison Highlights** (Center or bottom):
- **Accuracy Gain**: +X.X% (AGILE3D vs Baseline)
- **Latency Improvement**: -XX ms or "Maintained SLO"
- **Violation Reduction**: -X.X%
- Use color coding: green for improvements, amber for neutral, red for degradation

Implement animated transitions:
- Number counting animations when values change
- Color highlights on improvements
- Smooth fade transitions

---

## Phase 3: Polish & Deployment

### 3.1 Visual Polish & UX
- Implement smooth animations and transitions
- Add loading states and progress indicators
- Create entrance animations for page load
- Add micro-interactions (hover states, button feedback)
- Implement tooltips explaining each configuration parameter
- Add help icons with explanations of metrics

### 3.2 Performance Optimization
- Optimize 3D rendering (LOD, frustum culling)
- Pre-warm shaders/materials
- Cap devicePixelRatio to 1.5-2.0 for performance
- Implement lazy loading for heavy components
- Add FPS counter (smoothed) and performance monitoring
- Cap point counts dynamically to sustain 60fps
- Auto-fallback to 50k point scenes if performance drops

### 3.3 Responsive Design & Accessibility
- Desktop layout (1920x1080 primary target)
- Tablet support (1024x768+)
- Stack viewers vertically on smaller screens
- Keyboard navigation support
- ARIA labels for controls and metrics
- Color contrast compliance (WCAG AA)
- Color-blind safe palette
- Respect prefers-reduced-motion

### 3.4 Educational Content
- Add brief "What is AGILE3D?" explanation at top (keep minimal as requested)
- Tooltips on hover explaining:
  - What voxel/pillar size affects
  - What contention means
  - What each metric represents
- Optional expandable "Learn More" sections for:
  - Why 3D detection is challenging
  - How AGILE3D adapts
  - The 5 control knobs concept (brief overview only)
- Link to paper and code repository
- **Keep content minimal and focused** - prioritize visual demonstration over text explanation

### 3.5 Testing & Validation
- Test interactive controls functionality
- Verify data accuracy against paper
- Test performance across devices and browsers
- Validate camera synchronization
- Check metric calculations
- Test all configuration combinations
- User testing with representative audience

### 3.6 Deployment
- Configure hosting (GitHub Pages, Netlify, or Vercel)
- Enable brotli/gzip compression
- Set immutable cache headers for binary 3D assets
- Set up custom domain (if applicable)
- Implement analytics tracking (optional)
- Create backup/maintenance plan

---

## Additional Configurable Inputs (Beyond Voxel Size & Contention)

Based on the paper and the adaptive nature of AGILE3D, these make sense as user controls:

### Primary Inputs (Must Have):
1. ✅ **Scene Type** - Vehicle-heavy / Pedestrian-heavy / Mixed
2. ✅ **Spatial Resolution (Voxel/Pillar Size)** - 0.16m to 0.64m
3. ✅ **Contention Level** - 0-100% (GPU resource pressure)
4. ✅ **Latency SLO** - 100-500ms (target latency requirement)

### Secondary Inputs (Nice to Have - Advanced Mode):
5. **Encoding Format** - Voxel vs Pillar
6. **Detection Head** - Anchor-based vs Center-based
7. **Feature Extractor** - Transformer vs Sparse CNN vs 2D CNN

### Metrics to Display (What Users Should See):

**Per Algorithm (Baseline & AGILE3D):**
- Accuracy (mAP %)
- Latency (ms)
- Latency Violation Rate (%)
- Memory Usage (GB)
- SLO Compliance Status (✓/✗)

**AGILE3D Specific:**
- Active Branch Name
- Branch Switches Count (if applicable)

**Comparison Metrics:**
- Accuracy Delta (+/- %)
- Latency Delta (+/- ms)
- Violation Reduction (%)

---

## Dependencies & Ordering

### Critical Path
1. Phase 1 (Foundation) with early PoC and worker-first:
   - 1.1 Project Setup → 1.1.2 Core Services & State
   - In parallel: 1.2.1 Data Extraction (incl. DSVT baseline) and 1.3.1 Design System
   - 1.1.3 Three.js Proof-of-Concept early (Day 3 AM) with camera sync (Decision Gate B)
   - 1.2.2 Scene Data & Parsing (Web Worker first), scenes, budgets, extensibility validation (Phase 1 Exit)
   - Decision Gate A (end Day 2): Paper data completeness verified
2. Phase 2 (Core Demo) builds on Phase 1
   - 2.1 Dual 3D Viewers → 2.2 Configuration Panel → 2.3 Metrics Display
   - Viewers must work before connecting controls
3. Phase 3 (Polish & Deploy) is final
   - All functionality must be complete before polish
   - Testing happens throughout but final validation at end

### Parallelization Opportunities
- Phase 1: Run Data Extraction (1.2.1) and Design System (1.3.1) in parallel after 1.1.1
- Phase 1 Day 3: Run worker-first portion of 1.2.2 in parallel with 1.3.2 Layout
- Phase 2: Metrics display (2.3) can be built while viewers (2.1) are in progress

### Decision Gates
- Gate A (end Day 2): DSVT-Voxel baseline and AGILE3D branch datasets extracted and validated
- Gate B (Day 3 AM): Three.js PoC achieves 60fps and camera sync integration
- Phase 1 Exit: Extensibility validation (load 4th scene via JSON-only; budgets met; worker parsing verified)

---

## Success Criteria

### Functional Requirements
- ✅ Side-by-side 3D point cloud visualization (Baseline vs AGILE3D)
- ✅ Synchronized camera controls
- ✅ Real-time updates based on configuration inputs
- ✅ Accurate representation of paper's data and findings
- ✅ Smooth performance (60fps for 3D, <100ms for interactions)
- ✅ Clear visual differentiation between baseline and AGILE3D performance

### Educational Requirements
- ✅ Clear demonstration of AGILE3D's adaptive advantage
- ✅ Intuitive controls requiring minimal explanation
- ✅ Visible impact of configuration changes
- ✅ Obvious performance improvements over baseline

### Presentation Requirements
- ✅ Professional, polished appearance
- ✅ Impressive visual impact for NSF representatives
- ✅ Stable, bug-free experience
- ✅ Loads in <5 seconds on modern hardware
- ✅ Clearly shows "before and after" comparison

---

## Timeline Estimate

**Phase 1**: 3-4 days
- Project setup: 4-6 hours
- Core services & state: 4-6 hours
- Three.js PoC + camera sync: 6-8 hours
- Design system: 3-4 hours
- Data extraction (incl. DSVT baseline): 6-8 hours
- Scene parsing infra + scenes + budgets + extensibility validation: 8-10 hours
- Buffer: 6-8 hours

**Phase 2**: 6-7 days
- Dual 3D viewers: 16-24 hours
- Configuration panel: 8-12 hours
- Metrics display: 8-10 hours

**Phase 3**: 3-4 days
- Visual polish: 8-10 hours
- Performance optimization: 6-8 hours
- Responsive design: 4-6 hours
- Educational content: 4-6 hours
- Testing: 6-8 hours
- Deployment: 2-4 hours

**Total**: ~11-14 days (fits within 2-week constraint)