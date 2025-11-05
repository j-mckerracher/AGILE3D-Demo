# AGILE3D Interactive Demo - Phase 1 Meso-Level Plan (Revised v2 — per Claude review)

## Change Log (v2)
- Added explicit DSVT-Voxel baseline extraction as a critical deliverable in WP-1.2.1 (PRD §6.1.3)
- Restructured WP-1.2.2 to implement Web Worker + loader first, then scene generation, then validation (PRD §6.2.2)
- Revised timeline from 3 days to 3–4 days (28–41 hours) with explicit buffer (PRD §1.4 availability)
- Added extensibility validation: add a 4th config-only scene (FR-1.11)
- Moved Three.js proof-of-concept earlier in schedule; added decision gates
- Integrated camera synchronization with StateService (FR-1.4, PRD §7.4.1)
- Specified scene tier selection and FPS-based auto-fallback (NFR-1.9)
- Added asset pre-compression strategy and headers (NFR-1.6–1.7)
- Included advanced controls UI placeholder (FR-2.7–2.9) in Phase 1 layout
- Standardized coverage targets: ≥70% services, ≥60% components (NFR-6.2)
- Marked loading skeleton as optional (can defer if time-constrained)

---

## Executive Summary
This document provides a revised meso-level breakdown of Phase 1: Foundation & Data Preparation that aligns fully with the PRD and addresses review findings.

### Timeline Revision
- **Original Macro Estimate**: 2–3 days
- **Revised Meso Estimate**: 3–4 days (28–41 hours total effort incl. 6–8h buffer)
- **Rationale**: Three.js integration is the highest risk/complexity; explicit buffer reduces rework risk

### Success Criteria (Phase 1 Exit)
- ✅ Working Angular project with single rAF loop, core services, and Three.js PoC rendering at 60fps (desktop)
- ✅ All required paper data extracted and validated, including DSVT-Voxel baseline
- ✅ 3 synthetic point cloud scenes + parsing infra; budgets met; extensibility proven via config-only 4th scene
- ✅ Design system and responsive layout (with Advanced controls placeholder) ready for Phase 2

---

## Ordering & Execution Strategy (with Decision Gates)

### Updated Execution Timeline
- **Day 1 (8h)**
  - Morning: WP-1.1.1 Angular Project Initialization (2–3h)
  - Afternoon (parallel):
    - Start WP-1.2.1 Paper Data Extraction (3–4h)
    - Start WP-1.3.1 Design System Implementation (3–4h)

- **Day 2 (8h)**
  - Morning: Complete WP-1.2.1 (2–4h), Complete WP-1.3.1 (1–2h)
  - Afternoon: WP-1.1.2 Core Services & State (4–6h)
  - DECISION GATE A: Paper data completeness verified (incl. DSVT-Voxel baseline)

- **Day 3 (8h)**
  - Morning: WP-1.1.3 Three.js Proof-of-Concept (simplified scene, 3–4h)
  - DECISION GATE B: 60fps feasibility validated (desktop target)
  - Afternoon (parallel):
    - WP-1.2.2 Scene Data & Parsing — start with Web Worker + loader first (4–6h)
    - WP-1.3.2 Layout Structure (4–6h)

- **Day 4 (Buffer/Completion 6–8h)**
  - Complete remaining WP-1.2.2 tasks (scene generation, compression, validation)
  - Complete WP-1.3.2 if not finished
  - Integration sanity checks (camera sync ↔ state; scenes parse end-to-end)

### Parallelization
- After WP-1.1.1: Run WP-1.2.1 and WP-1.3.1 in parallel
- Day 3 afternoon: WP-1.2.2 (worker/loader first) in parallel with WP-1.3.2

---

## Work Packages (Revised)

### WP-1.1.1: Angular Project Initialization

**Purpose**: Establish Angular 17+ project with required dependencies and structure to support dual 3D viewers.

**Prerequisites**: Node 18+, Git

**Tasks**:
1. Create project: `ng new agile3d-demo --routing --style=scss --strict --standalone`
2. Install dependencies: three, @angular-three/core, @types/three, @angular/material, @angular/cdk, @angular/animations, rxjs@latest
3. Configure angular.json for prod optimizations; dev source maps
4. Enable TS strict; setup ESLint + Prettier; .gitignore baseline
5. Create folder structure (components/services/models/utils; assets/data, assets/scenes)

**Outputs**:
- Compiling Angular project (strict mode)
- Dependencies installed and linting configured
- Project folders scaffolded

**Validation**:
- `ng serve` and `ng build --configuration=production` succeed
- ESLint clean on scaffolding

**Estimated Effort**: 2–3 hours

**Dependencies**: None

**PRD Alignment**:
- Satisfies: NFR-5.1, NFR-6.1; Tech: PRD §7.1.1
- Quality: strict TS, ESLint, modular structure
- Risks addressed: Foundational setup consistency

---

### WP-1.1.2: Core Service Architecture & State

**Purpose**: Implement single rAF RenderLoopService, StateService (BehaviorSubjects), data interfaces.

**Prerequisites**: WP-1.1.1

**Tasks**:
1. RenderLoopService (single rAF; register/unregister; start/stop guard)
2. StateService (scene, contention, SLO, voxel size, active branch; camera position/target); derived state via combineLatest + shareReplay
3. DataService interfaces: scene metadata, point cloud loading, branch performance queries
4. LoggingService for structured logs and errors
5. Unit tests (≥70% coverage for services)

**Outputs**:
- RenderLoopService, StateService, DataService stubs, LoggingService
- Unit tests and docs

**Validation**:
- Services DI instantiate; derived streams produce expected outputs
- rAF loop stops/starts correctly; no memory leaks (5-minute test)
- Coverage ≥70% for services

**Estimated Effort**: 4–6 hours

**Dependencies**: WP-1.1.1

**PRD Alignment**:
- Satisfies: NFR-5.1, NFR-5.7, NFR-6.1; Tech: PRD §7.3, §7.4
- Risks addressed: memory leaks, maintainability

---

### WP-1.1.3: Three.js Integration Proof-of-Concept (with Camera Sync Integration)

**Purpose**: Prove Angular + angular-three + Three.js feasibility at 60fps; integrate camera sync with StateService.

**Prerequisites**: WP-1.1.2

**Tasks**:
1. Integrate angular-three in main.ts; extend required Three.js classes
2. Create minimal SceneViewerComponent rendering 10k points; clamp devicePixelRatio (≤2.0)
3. CameraControlService with OrbitControls
4. Integrate camera sync with StateService (two-way):
   - On camera change → push to cameraPosition$/cameraTarget$
   - On state change → update both viewers’ controls
5. Bounding boxes renderer using InstancedMesh (per PRD §7.1.2)
6. Basic performance overlay (FPS); pre-warm shaders; frustum culling
7. Component tests + integration tests; coverage ≥60% components

**Outputs**:
- Working PoC viewer at 60fps with synchronized camera state
- Instanced bounding box rendering sample
- Tests and perf notes

**Validation**:
- 60fps sustained on desktop test hardware (DevTools Performance)
- Camera interactions reflect within <16ms; both viewers stay in sync
- No WebGL errors; memory stable over 5 minutes
- Coverage: services ≥70%; components ≥60%

**Estimated Effort**: 6–8 hours

**Dependencies**: WP-1.1.2

**PRD Alignment**:
- Satisfies: NFR-1.2, FR-1.4, FR-1.5; Tech: PRD §7.1.2, §7.5.1
- Risks addressed: early performance feasibility, synchronization correctness

---

### WP-1.2.1: Paper Data Extraction (Incl. DSVT-Voxel Baseline — CRITICAL)

**Purpose**: Extract and validate all paper metrics for DSVT-Voxel baseline and AGILE3D branches.

**Prerequisites**: WP-1.1.1; access to paper PDF

**Tasks**:
1. Setup extraction spreadsheet + JSON schema(s); figures/tables mapping (Figures 7, 11; Table 2; Figures 15–16)
2. Extract AGILE3D branch data (3–5 branches): latency (mean/std) across contention levels; accuracy per scene; memory
3. Task 3 (CRITICAL) — Create DSVT-Voxel Baseline Dataset (PRD §6.1.3):
   - Accuracy per scene (vehicle-heavy, pedestrian-heavy, mixed)
   - Latency per contention (0%, 38%, 45%, 64%, 67%)
   - Violation rates per SLO (100/350/500ms)
   - Memory footprint
   - Primary sources: Figure 11 (Pareto), Section 5.1; cross-check with other figures
4. Build JSON files and schemas:
   - baseline-performance.json (+ schema)
   - agile3d-branches.json (+ schema)
   - accuracy-vs-contention.json
   - pareto-frontier.json
5. Validation pipeline: cross-reference with source pages/figures; consistency/unit checks; produce validation-report.json

**Outputs**:
- Baseline and branch datasets (JSON + schemas); validation report; documentation

**Validation**:
- 100% numeric parity with paper figures/tables; provenance recorded (page/figure refs)
- Schemas validate; validation report clean (≤1% discrepancy flagged + resolved)

**Estimated Effort**: 6–8 hours

**Dependencies**: WP-1.1.1

**PRD Alignment**:
- Satisfies: NFR-4.3, NFR-5.2; FR-3.1–3.2 (metrics)
- Tech/Data: PRD §6.1.1–6.1.3, §6.3
- Risks addressed: data accuracy, misrepresentation

---

### WP-1.2.2: Scene Data & Parsing Infrastructure (Worker First) + Extensibility Validation

**Purpose**: Implement parsing infra first, then generate 3 synthetic scenes within budgets; prove config-only extensibility and tier fallback.

**Prerequisites**: WP-1.2.1 (data specs), WP-1.1.2 (services)

**Tasks (reordered — Worker first)**:
1. Implement Web Worker parser for binary .bin (Float32Array stride 3: [x,y,z]) and postMessage transfer (zero-copy); ensure main thread remains responsive (PRD §6.2.2)
2. Implement SceneDataService:
   - loadSceneMetadata(sceneId), loadPointCloud(binPath)
   - parsePointCloudInWorker(arrayBuffer) → positions (Float32Array)
   - In-memory cache; Transferable objects
3. Create minimal validation harness to load a tiny sample .bin via worker and render in PoC viewer
4. Design scene metadata schema (PRD §6.2.3) and create 3 scenes:
   - Vehicle-heavy (15–20 vehicles, 0–2 peds), Pedestrian-heavy (10–15 peds, 0–3 vehicles), Mixed (8–10 vehicles, 6–8 peds, 3–5 cyclists)
   - Two tiers per scene: demo 100k points; fallback 50k points
   - Ground-truth + predictions (DSVT-Voxel + selected AGILE3D branches)
5. File size optimization + pre-compression:
   - Decimation/voxel downsampling as needed
   - Pre-compress .bin with Brotli (build-time) and ensure server/hosting serves Content-Encoding: br (document headers)
6. Budget validation:
   - Per-scene compressed ≤2.5MB; total 3D assets ≤8MB (NFR-1.6–1.7)
   - Parsing time <2s; no main-thread blocking (Performance tab)
7. Extensibility validation (FR-1.11): Add a 4th test scene via JSON config only (no code changes); confirm loading/rendering works end-to-end
8. Tier selection & fallback spec (NFR-1.9): Document FPS-based auto-fallback (if FPS <45 for ≥3s → switch to 50k tier); include manual override flag

**Outputs**:
- Web Worker + SceneDataService; 3 primary scenes + 4th config-only test scene
- Pre-compressed assets; tier-selection.md; budget validation report

**Validation**:
- Worker parsing verified; zero UI jank during loads
- Budgets met (≤2.5MB per scene compressed; ≤8MB total)
- Extensibility proven: 4th scene added via JSON only
- Tier fallback spec documented and reviewed

**Estimated Effort**: 8–10 hours

**Dependencies**: WP-1.2.1, WP-1.1.2

**PRD Alignment**:
- Satisfies: NFR-1.6–1.7, NFR-1.9; FR-1.8–1.11
- Tech/Data: PRD §6.2.1–6.2.3, §7.5.2
- Risks addressed: parsing perf, asset budgets, extensibility

---

### WP-1.3.1: Visual Design System Implementation

**Purpose**: Implement colors, typography, spacing, accessibility, and responsive tokens/system.

**Prerequisites**: WP-1.1.1

**Tasks**:
1. SCSS token variables; object class colors; method labels (baseline vs AGILE3D)
2. Typography (H1–H4, body, monospace for metrics); spacing (8px grid)
3. Angular Material theme; prefers-reduced-motion styles
4. Accessibility: WCAG AA color contrast tests; focus indicators; color-blind checks
5. Responsive breakpoints (desktop/tablet); utility classes

**Outputs**:
- Tokens, theme, style utilities, contrast validation notes

**Validation**:
- All colors pass AA; reduced-motion honored; responsive checks pass

**Estimated Effort**: 4–5 hours

**Dependencies**: WP-1.1.1

**PRD Alignment**:
- Satisfies: NFR-3.5–3.7; UI specs: PRD §8.2, §8.4

---

### WP-1.3.2: Layout Structure (with Advanced Controls Placeholder)

**Purpose**: Create responsive layout for dual viewers, controls, and metrics, including Advanced controls placeholder (collapsed by default).

**Prerequisites**: WP-1.3.1

**Tasks**:
1. Implement App/Header/Hero/MainDemo/Footer shell with semantic landmarks
2. DualViewer 50/50 desktop; stacked tablet; labels for “DSVT-Voxel (Baseline)” and “AGILE3D (Adaptive)”
3. ControlPanel shell: Scene selector, voxel size, contention, SLO; add Advanced toggle area (UI only; no logic yet)
4. MetricsDashboard shell: baseline, comparison, AGILE3D columns
5. Keyboard navigation order; skip links; ARIA labels/live regions stubs
6. (Optional) Loading skeletons — mark defer-to-Phase-2 if time-constrained

**Outputs**:
- Responsive layout; advanced controls UI placeholder; a11y scaffolding

**Validation**:
- Desktop and tablet breakpoints render correctly; keyboard navigation logical; screen reader announces landmarks

**Estimated Effort**: 4–6 hours

**Dependencies**: WP-1.3.1

**PRD Alignment**:
- Satisfies: FR-2.7–2.9 (placeholder), NFR-3.3–3.4; UI: PRD §8.1

---

## Dependencies & Critical Path

- WP-1.1.1 → WP-1.1.2 → WP-1.1.3 (PoC)
- WP-1.1.1 → WP-1.2.1 → WP-1.2.2 (Worker first)
- WP-1.1.1 → WP-1.3.1 → WP-1.3.2

Decision Gates:
- Gate A (end Day 2): Paper data completeness (incl. DSVT-Voxel)
- Gate B (mid Day 3): Three.js 60fps PoC validated

---

## Macro Plan Feedback (Updated)

### Issues Addressed
1. DSVT-Voxel baseline now explicit deliverable in WP-1.2.1 (CRITICAL)
2. Web Worker parsing moved to the start of WP-1.2.2
3. Timeline revised to 3–4 days, with buffer and decision gates
4. Extensibility validation added (4th scene via JSON only)
5. Camera synchronization integrated with StateService
6. Tier selection (FPS-based auto-fallback) documented
7. Asset pre-compression and headers included
8. Advanced controls placeholder added in layout

### Suggested Macro Plan Revisions
- Phase 1: Update timeline to 3–4 days with explicit buffer and gates
- Add explicit “DSVT-Voxel baseline extraction” bullet under Data Extraction
- Add “Three.js feasibility checkpoint” before heavy scene work
- Add “Extensibility validation” as Phase 1 exit criterion

### Validation of Macro Plan
- Foundations, dependencies, and technology stack remain sound
- With these adjustments, Phase 1 de-risks Phase 2 and aligns fully with PRD

---

## Open Questions (for Human Oversight)
1. DSVT-Voxel data sources beyond Figure 11? Any preferred secondary figures/tables to cross-check?
2. Should one scene intentionally show minimal AGILE3D advantage for educational contrast?
3. Advanced controls scope in Phase 1: UI placeholder only (as planned), or wire minimal toggles for demos?
4. Should the Three.js PoC match one of the production scene geometries or remain synthetic?

---

## Phase 1 Exit Check (Roll-up)
- Angular + Three.js PoC at 60fps with camera sync via StateService
- Paper data validated (incl. DSVT-Voxel baseline); JSON + schemas ready
- 3 primary scenes + 4th config-only scene; parsing infra proven; budgets met; tier fallback spec documented
- Design system + layout (incl. Advanced placeholder) complete and accessible
- Tests: services ≥70% coverage; components ≥60%
