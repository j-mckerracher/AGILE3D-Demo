# AGILE3D Interactive Demo - Phase 2 Meso-Level Plan

## Executive Summary
Phase 2 delivers the Core Side-by-Side Comparison Demo. It builds on Phase 1 outputs (Angular foundation, Three.js PoC with camera sync, parsing infrastructure, scene datasets, design system and layout). This plan defines concrete work packages to implement dual synchronized 3D viewers, the configuration control panel (including Advanced controls), and the metrics dashboard with comparison highlights.

Targets (PRD): 60fps 3D rendering, <100ms control response, <200ms parameter propagation, WCAG AA, extensible scenes, accurate baseline vs AGILE3D representation.

Note on estimates: Ranges (e.g., 4–6h) reflect a ~4h baseline with up to ~2h buffer for integration edge cases and cross-browser differences.

---

## Assumptions & Prerequisites (from Phase 1)
- Angular project with RenderLoopService and StateService in place
- Three.js PoC proven at 60fps with synchronized camera (two-way with StateService)
- SceneDataService + Web Worker parsing working; 3 primary scenes present
- Design system and layout shell (with Advanced controls placeholder) complete
- Paper data extracted and validated (incl. DSVT-Voxel baseline; AGILE3D branches)

---

## Work Packages

### WP-2.1.1: Dual Viewer Foundation (Single → Dual with Shared Geometry)

**Purpose**: Implement the production viewer component(s) with shared point cloud geometry and then duplicate to create synchronized left/right viewers.

**Prerequisites**:
- Phase 1 PoC viewer and camera sync (WP-1.1.3)
- SceneDataService and parsed scene data available (WP-1.2.2)

**Tasks**:
1. Implement production SceneViewerComponent (baseline) with:
   - Shared Points BufferGeometry (positions from worker) and lightweight ShaderMaterial
   - Labels: "DSVT-Voxel (Baseline)" and "AGILE3D"
2. Extract viewer into a reusable, standalone component with Inputs for:
   - points geometry reference; detections; camera state streams
3. Duplicate for right viewer (AGILE3D), wiring both to shared points geometry (render twice).
4. Integrate into DualViewerComponent with side-by-side grid; connect labels from design system tokens.
5. Implement scene switching with crossfade (<500ms total):
   - Fade out current scene (150ms)
   - Load + parse new scene via Web Worker
   - Swap geometry references
   - Fade in new scene (150ms)

**Outputs**:
- src/app/components/scene-viewer/SceneViewerComponent (prod variant)
- src/app/components/dual-viewer/DualViewerComponent integrated in layout

**Validation**:
- Both viewers render same point cloud; baseline vs AGILE3D detections differ
- Shared geometry verified (single BufferGeometry instance, two draw paths)
- Sustained 60fps at desktop target resolution on test hardware

**Estimated Effort**: 4–6 hours

**Dependencies**: Blocks 2.1.2, 2.1.3, 2.3.1 partially

**PRD Alignment**:
- Satisfies: FR-1.1, FR-1.2, FR-1.7; NFR-1.2
- Tech specs: PRD §7.1.2, §7.5.1

---

### WP-2.1.2: Detection Visualization & Diff Highlighting

**Purpose**: Render 3D bounding boxes for each method with correct color coding and highlight differences against ground truth.

**Prerequisites**:
- WP-2.1.1 viewers in place
- Ground truth and prediction metadata in scene JSON (Phase 1)

**Tasks**:
1. Implement InstancedMesh bounding boxes (per PRD §7.1.2) for performance:
   - Blue vehicles (#3B82F6), Red pedestrians (#EF4444), Orange cyclists (#F97316)
2. Hover tooltip UI:
   - Show detection confidence on hover (and optional ground truth match id)
3. Diff highlighting modes:
   - True positives, false positives, false negatives visualization
   - Toggle for ground truth overlay
4. Animate bbox updates when branch switches OR scene changes (detections change); no animation for camera/lighting changes; respect prefers-reduced-motion

**Outputs**:
- BoundingBoxRenderer utilities; diff-highlighting toggle state

**Validation**:
- Colors match PRD; hover shows confidence; diff toggles correctly reflect metadata
- Smooth bbox update animations (disabled when prefers-reduced-motion)

**Estimated Effort**: 4–6 hours

**Dependencies**: Depends on WP-2.1.1; Blocks metrics wiring validation (2.3.1)

**PRD Alignment**:
- Satisfies: FR-1.3, FR-1.12–1.15; NFR-3.7
- Tech specs: PRD §7.1.2, §8.3

---

### WP-2.1.3: Camera Sync Enhancements & Independent Camera Toggle

**Purpose**: Finalize synchronized camera controls, and implement optional independent camera toggle.

**Prerequisites**:
- WP-2.1.1 viewers; WP-1.1.3 camera sync

**Tasks**:
1. Wire CameraControlService to StateService streams (two-way) for both viewers
2. Add toggle in Advanced Controls panel (hidden by default) to switch between:
   - Synchronized camera (default)
   - Independent camera per viewer
3. Persist camera pose state on scene switch; optional reset button

**Outputs**:
- Camera synchronization integrated
- Independent camera toggle

**Validation**:
- Default sync mode: both viewers move together; toggle enables independent control
- Camera pose preserved during scene changes; reset works

**Estimated Effort**: 2–4 hours

**Dependencies**: Depends on WP-2.1.1

**PRD Alignment**:
- Satisfies: FR-1.4, FR-1.10
- Tech specs: PRD §7.4.1

---

### WP-2.1.4: Performance Guardrails & Fallbacks

**Purpose**: Ensure sustained 60fps via LOD/decimation and fallback to 50k tier when needed.

**Prerequisites**:
- WP-2.1.1 viewers
- Phase 1 FPS counter utility

**Tasks**:
1. Implement FPS smoothed counter overlay (dev only; visible in production only when ?debug=true)
2. LOD/decimation policy:
   - Reduce point size or decimate when zoomed out; clamp devicePixelRatio to 1.5–2.0
3. Auto-fallback when FPS <45 for ≥3s:
   - Switch to 50k tier scene; show performance warning
4. Dispose geometries/materials correctly on component destroy; memory checks using Chrome DevTools Memory profiler (ensure no heap growth over 15 minutes; no detached DOM nodes)

**Outputs**:
- LOD policy; auto-fallback triggers; cleanup hooks

**Validation**:
- 60fps sustained; fallback triggers reliably under load
- No memory leaks after 15-minute session

**Estimated Effort**: 4–6 hours

**Dependencies**: Depends on 2.1.1; Influences 2.2/2.3 user experience

**PRD Alignment**:
- Satisfies: NFR-1.2, NFR-1.8, NFR-1.9, NFR-4.5
- Tech specs: PRD §7.5.1–7.5.3

---

### WP-2.2.1: Control Panel — Primary Controls

**Purpose**: Implement scene selector, voxel size, contention, and latency SLO with tooltips and debounce.

**Prerequisites**:
- Layout ControlPanelComponent shell (Phase 1); PaperDataService; StateService

**Tasks**:
1. Scene selector (Vehicle-heavy, Pedestrian-heavy, Mixed); show metadata counts
2. Voxel size control (0.16, 0.24, 0.32, 0.48, 0.64) — discrete buttons or slider
3. Contention slider (0–100%) with markers at 0, 38, 45, 64, 67; 100ms debounce
4. Latency SLO slider (100–500ms, step 10ms); 100ms debounce; violation indicator
5. Tooltips per PRD §9.1; keyboard accessibility (tab order, ARIA labels)

**Outputs**:
- Fully functional primary control panel, wired to StateService

**Validation**:
- Controls update StateService in <100ms; parameter propagation to viewers in <200ms
- Tooltips and keyboard navigation meet WCAG AA

**Estimated Effort**: 4–6 hours

**Dependencies**: Blocks 2.2.3

**PRD Alignment**:
- Satisfies: FR-2.1–2.6; NFR-1.3, NFR-3.1–3.5

---

### WP-2.2.2: Advanced Controls (Hidden by Default)

**Purpose**: Implement advanced controls UI and wiring (encoding format, detection head, feature extractor); hidden behind toggle.

**Prerequisites**:
- WP-2.2.1 baseline control panel

**Tasks**:
1. Add Advanced toggle; reveals advanced panel when on
2. Controls:
   - Encoding format (Voxel/Pillar)
   - Detection head (Anchor/Center)
   - Feature extractor (Transformer/Sparse CNN/2D CNN)
3. Tooltips for each control; ARIA labels
4. Persist state in StateService; no immediate need for deep model plumbing beyond SimulationService mapping

**Outputs**:
- Advanced controls UI and state wiring

**Validation**:
- Hidden by default; shows on toggle
- State changes reflected in current configuration display

**Estimated Effort**: 3–5 hours

**Dependencies**: Depends on 2.2.1; Blocks 2.2.3 mapping completeness

**PRD Alignment**:
- Satisfies: FR-2.7–2.9, FR-2.10–2.13 (display aspects)
- NFR-3.1–3.5 (usability/a11y)

---

### WP-2.2.3: Branch Selection Logic & State Wiring

**Purpose**: Implement SimulationService mapping inputs → active AGILE3D branch and compute baseline/AGILE3D metrics for current settings.

**Prerequisites**:
- PaperDataService datasets (Phase 1); Primary & Advanced controls (2.2.1, 2.2.2)

**Tasks**:
1. Implement selectOptimalBranch using precomputed lookup table (simplified DPO):
   - Input: (scene, contention, slo, voxelSize, advancedKnobs)
   - Lookup: Match to closest of 3–5 representative branches from PRD §6.3.1
   - Fallback: If no exact match, choose branch with closest control knob values
   - Note: DPO scheduling from paper is simplified to lookup for demo fidelity and performance
2. Calculate metrics for selected branch; compute baseline metrics; derive comparison deltas
3. Update Current Configuration Display with active branch and control knob settings
4. Ensure updates complete within <100ms; use shareReplay(1) and minimal computation

**Outputs**:
- SimulationService; Current Configuration Display wiring; Derived comparison state

**Validation**:
- Branch selection and metric calculations match paper tables/figures
- Updates <100ms; parameter propagation <200ms

**Estimated Effort**: 4–6 hours

**Dependencies**: Depends on 2.2.1–2.2.2; Blocks 2.3.1

**PRD Alignment**:
- Satisfies: FR-2.10–2.13, FR-3.1–3.4; NFR-1.3–1.4; NFR-5.2
- Tech specs: PRD §7.3, §7.4

### WP-2.2.4: Current Configuration Display Component

**Purpose**: Provide a clear display of the active AGILE3D branch, fixed baseline model, and current control knob settings.

**Prerequisites**:
- WP-2.2.1 Primary Controls, WP-2.2.2 Advanced Controls, WP-2.2.3 SimulationService

**Tasks**:
1. Create CurrentConfigurationComponent positioned at top of control panel (or as a separate card under controls)
2. Display:
   - Active AGILE3D branch name (e.g., "CP-Pillar-0.32")
   - Baseline model: "DSVT-Voxel (fixed)"
   - Control knobs: encoding format, spatial resolution, spatial encoding, feature extractor, detection head
   - Visual indicator when branch switches
3. Wire to StateService and SimulationService derived state; ensure updates <100ms

**Outputs**:
- src/app/components/current-configuration/CurrentConfigurationComponent

**Validation**:
- Values match SimulationService outputs
- Branch switch indicator triggers on change; a11y labels present

**Estimated Effort**: 2–4 hours

**Dependencies**: Depends on 2.2.1–2.2.3; informs 2.3.1 visuals

**PRD Alignment**:
- Satisfies: FR-2.10–2.13; NFR-3.1–3.5

---

### WP-2.3.1: Metrics Dashboard & Comparison Highlights

**Purpose**: Implement Baseline Metrics, AGILE3D Metrics, and Comparison Highlights with smooth updates.

**Prerequisites**:
- SimulationService (2.2.3)

**Tasks**:
1. Baseline Metrics (left): Accuracy, Latency, Violations, Memory, SLO Compliance
2. AGILE3D Metrics (right): same + Active Branch (branch switch counter deferred to Phase 3)
3. Comparison Highlights (center/bottom): Accuracy Gain, Latency Difference, Violation Reduction with color coding (green/amber/red)
   - Thresholds: Green if Accuracy gain >2%, Latency reduction >10%, or Violations reduction >5%; Amber if within ±2% accuracy, ±10ms latency, ±5% violations; Red if Accuracy loss >2%, Latency increase >10%, or Violations increase >5%
4. Animations: 200ms transitions, number counting (respect reduced motion)

**Outputs**:
- MetricsDashboardComponent with three panels and bound data

**Validation**:
- Metrics update within <100ms; animated transitions are smooth or disabled per motion preference
- Color coding matches PRD; values match data

**Estimated Effort**: 4–6 hours

**Dependencies**: Depends on 2.2.3; Independent of 2.1.4

**PRD Alignment**:
- Satisfies: FR-3.1–3.8; NFR-1.3
- Tech specs: PRD §7.1.3 (uPlot optional later), §8.3

---

### WP-2.3.2: Instrumentation, Error Handling, and QA Hooks

**Purpose**: Provide performance instrumentation, accessibility live regions, and error-handling for robustness and SQA.

**Prerequisites**:
- Baseline metrics dashboard (2.3.1) and viewers (2.1.x)

**Tasks**:
1. Instrumentation:
   - FPS counter (smoothed); rAF timing logs (dev-mode)
   - Pre-warm shaders/materials on init
2. A11y live updates:
   - ARIA live regions for metric updates
   - Keyboard navigation validation (tab order)
3. Error handling & fallbacks:
   - WebGL capability check; show message: "WebGL is required but not available in your browser"
   - Suggest upgrading to latest Chrome/Firefox/Safari/Edge; link to upgrade instructions
   - Optional: show static screenshot or demo video
   - Robust data loading errors with user feedback

**Outputs**:
- Dev-only instrumentation panel; A11y live regions; error handlers

**Validation**:
- Meets NFR-1.8 instrumentation checklist
- WebGL failures show actionable fallback messages
- Screen readers announce metric changes

**Estimated Effort**: 3–5 hours

**Dependencies**: Parallel to 2.3.1; touches 2.1.x

**PRD Alignment**:
- Satisfies: NFR-1.8, NFR-2.5, NFR-3.4; NFR-4.2

---

## Phase 2 Dependencies & Execution Order

1) 2.1.1 Dual Viewer Foundation → 2.1.2 Detection Visualization → 2.1.3 Camera Sync Toggle → 2.1.4 Guardrails
2) 2.2.1 Primary Controls → 2.2.2 Advanced Controls → 2.2.3 Branch Selection & Metrics
3) 2.3.1 Metrics Dashboard → 2.3.2 Instrumentation & QA Hooks

Parallelization:
- 2.3.2 Instrumentation can start once 2.1.1 is stable
- Some metrics UI (2.3.1) can be scaffolded while 2.2.3 is in progress using mocked observables

Success Gates (Phase 2 exit):
- Both viewers 60fps sustained on target hardware; auto-fallback verified
- Controls (incl. advanced) update viewers and metrics within time budgets
- Metrics accurate vs PRD datasets; color coding and animations correct
- Accessibility checks (WCAG AA) pass for controls and metrics
- Integration test checklist:
  - [ ] Scene switch triggers viewers + metrics + controls update
  - [ ] Control changes propagate through StateService → SimulationService → Viewers + Metrics
  - [ ] Camera sync works in both default and independent modes
  - [ ] Advanced controls toggle reveals/hides panel correctly
  - [ ] Performance guardrails trigger fallback under load
  - [ ] All animations respect prefers-reduced-motion
- Cross-browser: Verified on latest Chrome, Firefox, Safari, Edge (desktop)

---

## Risks & Mitigations (Phase 2)
- Performance regressions: keep FPS overlay visible during development; profile early (Chrome Performance)
- State complexity: rely on BehaviorSubjects + shareReplay; small pure functions in SimulationService; strict TS
- A11y regressions: run aXe/lighthouse; manual keyboard nav checks
- Data correctness: unit tests comparing metrics against paper JSON; SQA checklist
