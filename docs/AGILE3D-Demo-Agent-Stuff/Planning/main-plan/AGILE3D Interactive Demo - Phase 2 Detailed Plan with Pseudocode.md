# AGILE3D Interactive Demo — Phase 2 Detailed Plan with Pseudocode (v2)

## Executive Summary
Phase 2 implements the core comparison experience: dual synchronized 3D viewers (baseline vs AGILE3D), the configuration control panel (primary + advanced), and the metrics dashboard with comparison highlights. This document expands the Phase 2 meso plan into executable steps with pseudocode for all major components and services.

Prereqs (from Phase 1):
- Angular 17 project with strict TS; RenderLoopService; StateService
- Web Worker parsing + SceneDataService; scene metadata + .bin
- Design tokens & layout shell; Three.js PoC @ 60fps with camera sync
- Paper data extracted (DSVT baseline + branches) with JSON + schemas

Targets (PRD): 60fps 3D; <100ms control response; <200ms view/metrics propagation; WCAG AA; configuration-driven scenes; accurate baseline vs AGILE3D metrics.

---

## Day-by-Day Execution Plan (4–5 days)
Day 1: 2.1.1 Dual Viewer Foundation → start 2.1.2 Detection Visualization
Day 2: Finish 2.1.2 → 2.1.3 Camera Sync Toggle → 2.2.1 Primary Controls
Day 3: 2.2.2 Advanced Controls → 2.2.3 SimulationService mapping → scaffold 2.3.1 Metrics
Day 4: Finish 2.3.1 → 2.1.4 Performance Guardrails & Fallbacks → 2.3.2 Instrumentation/Errors
Day 5 (buffer): Integration tests, cross-browser spot checks, bug fixes

---

## WP-2.1.1 — Dual Viewer Foundation (Shared Geometry) (4–6h)

Purpose: Render two viewers sharing the same Points geometry and scene metadata; wire scene switching crossfade.

Structure:
```
src/app/components/
  dual-viewer/
    dual-viewer.component.ts/html/scss
  scene-viewer/
    scene-viewer.component.ts/html/scss
```

DualViewer template (pseudocode):
```
<!-- dual-viewer.component.html -->
<div class="dual-viewer">
  <div class="pane baseline">
    <header>
      <span class="label">DSVT-Voxel (Baseline)</span>
    </header>
    <app-scene-viewer
      [viewerId]="'baseline'"
      [points]="points$ | async"
      [detections]="baselineDetections$ | async"
      [crossfadeState]="crossfadeState$ | async"
    />
  </div>
  <div class="pane agile3d">
    <header>
      <span class="label">AGILE3D (Adaptive)</span>
    </header>
    <app-scene-viewer
      [viewerId]="'agile3d'"
      [points]="points$ | async"
      [detections]="agile3dDetections$ | async"
      [crossfadeState]="crossfadeState$ | async"
    />
  </div>
</div>
```

DualViewer component (pseudocode):
```
@Component({ ... })
export class DualViewerComponent implements OnInit, OnDestroy {
  points$ = this.scenePoints$; // shared Float32Array → BufferGeometry inside child
  baselineDetections$ = this.stateService.currentScene$.pipe(
    switchMap(sceneId => this.loadBaselineDetections(sceneId))
  );
  agile3dDetections$ = this.stateService.currentScene$.pipe(
    switchMap(sceneId => this.loadAgileDetections(sceneId, this.stateService.activeBranch$.value))
  );
  crossfadeState$ = new BehaviorSubject<'idle'|'fade-out'|'fade-in'>('idle');

  constructor(
    private stateService: StateService,
    private sceneData: SceneDataService,
    private tier: SceneTierManager,
  ) {}

  private scenePoints$ = this.stateService.currentScene$.pipe(
    switchMap(async (sceneId) => {
      // Crossfade sequence (<500ms total)
      this.crossfadeState$.next('fade-out');
      const meta = await this.sceneData.loadMeta(sceneId);
      const binPath = this.tier.tierPath(meta.pointsBin);
      const raw = await this.sceneData.loadPoints(binPath); // Float32Array
      const positions = await this.sceneData.parseInWorker(raw.buffer, 3);
      this.crossfadeState$.next('fade-in');
      return positions; // Float32Array for child to convert to BufferGeometry
    })
  );

  ngOnInit() {}
  ngOnDestroy() {}
}
```

SceneViewer points rendering (pseudocode):
```
@Component({ ... })
export class SceneViewerComponent implements OnInit, OnDestroy, OnChanges {
  @Input() viewerId!: 'baseline'|'agile3d';
  @Input() points?: Float32Array; // shared positions
  @Input() detections?: Detection[];
  @Input() crossfadeState: 'idle'|'fade-out'|'fade-in' = 'idle';

  private geometry?: BufferGeometry;
  private pointsObj?: Points;

  constructor(private loop: RenderLoopService) {}

  ngOnChanges(){
    if (this.points) {
      if (!this.geometry) this.geometry = new BufferGeometry();
      const attr = new Float32BufferAttribute(this.points, 3);
      this.geometry.setAttribute('position', attr);
      this.geometry.computeBoundingSphere();
      if (!this.pointsObj) {
        const mat = new PointsMaterial({ size: 0.05, sizeAttenuation: true });
        this.pointsObj = new Points(this.geometry, mat);
        // add to scene graph
      } else {
        (this.geometry.getAttribute('position') as BufferAttribute).needsUpdate = true;
      }
    }
    // handle crossfade (opacity change) respecting reduced motion
  }

  ngOnInit(){ this.loop.register(this.viewerId, () => this.render()); }
  ngOnDestroy(){ this.loop.unregister(this.viewerId); /* dispose */ }
  private render(){ /* renderer.render(scene,camera) */ }
}
```

Validation:
- Both viewers render identical point clouds with different detections; crossfade <500ms
- Shared positions are converted to BufferGeometry in each child; 60fps sustained

PRD Alignment: FR-1.1, FR-1.2, FR-1.9; NFR-1.2

---

## WP-2.1.2 — Detection Visualization & Diff Highlighting (4–6h)

Purpose: Render detections as InstancedMesh batches per class; highlight diffs between baseline and AGILE3D.

Notes:
- Ground truth overlay toggle (FR-1.13) is deferred to Phase 3 (per decision) — placeholder only in UI
- Use metadata.matches_gt for simple diff; do not compute 3D IoU now

Pseudocode:
```
class DetectionDiffService {
  computeDiff(gt: Detection[], base: Detection[], agile: Detection[]): {
    base: { tp: Detection[], fp: Detection[], fn: Detection[] },
    agile: { tp: Detection[], fp: Detection[], fn: Detection[] }
  } {
    // Use matches_gt to classify; fallback to naive unmatched logic
    const gtIds = new Set(gt.map(g => g.id));
    const classify = (preds: Detection[]) => {
      const tp: Detection[] = []; const fp: Detection[] = []; const matched = new Set<string>();
      for (const p of preds) {
        if (p.matches_gt && gtIds.has(p.matches_gt)) { tp.push(p); matched.add(p.matches_gt); } else { fp.push(p); }
      }
      const fn = gt.filter(g => !matched.has(g.id));
      return { tp, fp, fn };
    };
    return { base: classify(base), agile: classify(agile) };
  }
}

function buildInstancedBatches(dets: Detection[]): {
  vehicles: InstancedMesh; peds: InstancedMesh; cyclists: InstancedMesh
} { /* pool by class, set colors, return */ }
```

SceneViewer usage:
```
if (this.detections) {
  const { vehicles, peds, cyclists } = buildInstancedBatches(this.detections);
  // add/update instanced meshes in scene graph
  // animate bbox transforms on detection set changes (branch switch or scene change)
}
```

Validation:
- BBoxes render with class colors; diff highlighting clearly distinguishes tp/fp/fn for each side
- Animations only when detection sets change; respects reduced motion

PRD Alignment: FR-1.3, FR-1.12, FR-1.14, FR-1.15; NFR-3.7

---

## WP-2.1.3 — Camera Sync Enhancements & Independent Toggle (2–4h)

Purpose: Allow toggling between synchronized camera mode (default) and independent mode in Advanced controls panel.

Pseudocode (wiring):
```
// Advanced panel emits independentCamera$ boolean
this.advanced.independentCamera$.subscribe(enabled => {
  if (enabled) {
    // Unsubscribe viewer A/B from global cameraPos$/Target$ updates (or ignore updates)
  } else {
    // Re-subscribe and synchronize both again
  }
});
```

Validation:
- Sync on by default; toggle -> viewers decouple; restore -> resync without jumps

PRD Alignment: FR-1.4 (optional independent toggle)

---

## WP-2.1.4 — Performance Guardrails & Auto-Fallback (4–6h)

Purpose: Use SceneTierManager to monitor FPS and fallback to 50k tier if sustained <45fps for ~3s.

Pseudocode (render loop integration):
```
// In SceneViewer loop callback
let lastTime = performance.now();
this.loop.register(this.viewerId, () => {
  const now = performance.now();
  const dt = now - lastTime; lastTime = now;
  this.tierManager.recordFrame(dt);
  // log or display dev-only FPS overlay when ?debug=true
  this.renderer.render(this.scene, this.camera);
});
```

On tier change, reload binPath via tier.tierPath(meta.pointsBin) in DualViewer; crossfade as in WP-2.1.1.

Validation:
- FPS dip triggers fallback; warning shown; 60fps restored where possible; no memory leaks

PRD Alignment: NFR-1.2, NFR-1.8, NFR-1.9

---

## WP-2.2.1 — Control Panel (Primary Controls) (4–6h)

Purpose: Implement scene selector + voxel size + contention + latency SLO with tooltips and debounced state updates.

Template (pseudocode):
```
<form [formGroup]="controls">
  <mat-button-toggle-group formControlName="scene">
    <mat-button-toggle value="vehicle-heavy">Vehicle-Heavy</mat-button-toggle>
    <mat-button-toggle value="pedestrian-heavy">Pedestrian-Heavy</mat-button-toggle>
    <mat-button-toggle value="mixed">Mixed</mat-button-toggle>
  </mat-button-toggle-group>

  <mat-slider formControlName="voxelSize" [step]="0.08" [min]="0.16" [max]="0.64"></mat-slider>
  <mat-slider formControlName="contention" [min]="0" [max]="100"></mat-slider>
  <mat-slider formControlName="latencySlo" [min]="100" [max]="500" [step]="10"></mat-slider>
</form>
```

Component (pseudocode):
```
this.controls.valueChanges.pipe(
  debounceTime(100),
  tap(v => {
    this.state.currentScene$.next(v.scene);
    this.state.voxelSize$.next(v.voxelSize);
    this.state.contention$.next(v.contention);
    this.state.latencySlo$.next(v.latencySlo);
  })
).subscribe();
```

Validation:
- Control updates <100ms to state; propagation <200ms to both viewers and metrics; tooltips present

PRD Alignment: FR-2.1–2.6; NFR-1.3

---

## WP-2.2.2 — Advanced Controls (Hidden by Default) (3–5h)

Purpose: Implement Advanced toggle with encoding format, detection head, feature extractor; update StateService.

State shape:
```
interface AdvancedKnobs {
  encodingFormat: 'voxel'|'pillar';
  detectionHead: 'anchor'|'center';
  featureExtractor: 'transformer'|'sparse_cnn'|'2d_cnn';
}
```

Wiring (pseudocode):
```
this.advancedForm.valueChanges.pipe(
  debounceTime(100),
  distinctUntilChanged((a,b)=>JSON.stringify(a)===JSON.stringify(b)),
  tap(knobs => this.state.advancedKnobs$.next(knobs))
).subscribe();
```

Validation:
- Advanced panel hidden by default; opening shows controls with tooltips; state updates in <100ms

PRD Alignment: FR-2.7–2.9; FR-2.10–2.13 (display of knobs)

---

## WP-2.2.3 — SimulationService: Branch Selection & Metrics (4–6h)

Purpose: Map (scene, contention, SLO, voxel, advanced) → optimal AGILE3D branch; compute metrics; output comparison deltas.

Inputs:
- PaperDataService: baseline-performance.json, agile3d-branches.json, accuracy-vs-contention.json

Selection algorithm (lookup-table simplification):
```
@Injectable({ providedIn:'root' })
export class SimulationService {
  constructor(private paper: PaperDataService){}

  selectOptimalBranch(scene: string, contention: number, slo: number, voxel: number, knobs: AdvancedKnobs): string {
    const branches = this.paper.getAgile3dBranches();
    // Filter branches by encoding format if specified; compute score by closeness of voxel + SLO feasibility
    let best = branches[0]; let bestScore = Infinity;
    for (const b of branches) {
      const vDiff = Math.abs(b.controlKnobs.spatialResolution - voxel);
      const latMean = this.paper.lookupLatency(b.branch_id, contention).mean;
      const sloPenalty = latMean > slo ? (latMean - slo) * 10 : 0; // penalize SLO violation sharply
      const formatPenalty = knobs.encodingFormat && (knobs.encodingFormat !== b.controlKnobs.encodingFormat) ? 1 : 0;
      const score = vDiff + sloPenalty + formatPenalty;
      if (score < bestScore) { bestScore = score; best = b; }
    }
    return best.branch_id;
  }

  calculateMetrics(branchId: string, scene: string, contention: number, slo: number): {
    baseline: Metrics; agile: Metrics; deltas: Comparison
  } {
    const base = this.paper.getBaselineMetrics(scene, contention, slo);
    const agile = this.paper.getBranchMetrics(branchId, scene, contention, slo);
    return { baseline: base, agile, deltas: this.compare(agile, base) };
  }

  private compare(a: Metrics, b: Metrics): Comparison {
    return {
      accuracyGain: a.accuracy - b.accuracy,
      latencyDiff: a.latency - b.latency,
      violationReduction: b.violations - a.violations
    };
  }
}
```

Performance: Use memoization for repeated (scene, contention, slo, voxel, knobs) to branchId; ensure <100ms runtime for updates.

Validation:
- Selected branch aligns with lookup data; metrics match paper JSON; <100ms updates; <200ms propagation to UI

PRD Alignment: FR-2.10–2.13, FR-3.1–3.4; NFR-1.3–1.4; NFR-5.2

---

## WP-2.2.4 — Current Configuration Display Component (2–4h)

Purpose: Display active AGILE3D branch, baseline label, and 5 control knob settings; indicator on branch change.

Template (pseudocode):
```
<div class="current-config" aria-live="polite">
  <div class="row">
    <label>Baseline:</label> <span>DSVT-Voxel (fixed)</span>
  </div>
  <div class="row">
    <label>AGILE3D Branch:</label> <span>{{ branch$ | async }}</span>
    <mat-icon *ngIf="branchChanged$ | async" class="switch-indicator"></mat-icon>
  </div>
  <div class="row knobs">
    <span>Format: {{ knobs.encodingFormat }}</span>
    <span>Resolution: {{ knobs.spatialResolution }}m</span>
    <span>Encoding: {{ knobs.spatialEncoding }}</span>
    <span>Extractor: {{ knobs.featureExtractor }}</span>
    <span>Head: {{ knobs.detectionHead }}</span>
  </div>
</div>
```

Validation:
- Updates immediately when SimulationService reselects branch; indicator flashes (respect reduced motion)

PRD Alignment: FR-2.10–2.13; NFR-3.1–3.5

---

## WP-2.3.1 — Metrics Dashboard & Comparison Highlights (4–6h)

Purpose: Implement baseline metrics, AGILE3D metrics, and comparison highlights with thresholds and smooth updates.

Thresholds (from prior plan):
- Green if accuracy gain >2%, latency reduction >10%, violations reduction >5%
- Amber if within ±2% acc, ±10ms latency, ±5% violations
- Red if accuracy loss >2%, latency increase >10%, violations increase >5%

Pseudocode:
```
@Component({ ... })
export class MetricsDashboardComponent {
  // Inputs: baseline$, agile$, deltas$ (from SimulationService)
  // Use number animations when reduced-motion = no-preference
  // Use aria-live="polite" for updated metrics
}
```

Validation:
- Metrics change within <100ms of state updates; color coding matches thresholds; animations respect reduced motion

PRD Alignment: FR-3.1–3.8; NFR-1.3

---

## WP-2.3.2 — Instrumentation, Error Handling & QA Hooks (3–5h)

Purpose: Provide dev-only FPS overlay, Performance API timing, and robust WebGL/data error messages.

Pseudocode:
```
// Dev-only FPS (or ?debug=true)
if (isDevMode() || location.search.includes('debug=true')) showFpsOverlay();

// Scene switch timing (Performance API)
const markStart = performance.mark('scene-switch-start');
// ... load/parse/swap ...
const markEnd = performance.mark('scene-switch-end');
performance.measure('scene-switch', 'scene-switch-start', 'scene-switch-end');

// WebGL fallback message (NFR-2.5)
if (!webgl2Supported()) {
  showError(
    'WebGL is required but not available in your browser',
    'Please upgrade to the latest Chrome/Firefox/Safari/Edge. ' +
    'Alternatively, watch the demo video.'
  );
}
```

Validation:
- FPS overlay visible in dev; scene switch measure <500ms; WebGL/data errors show clear guidance

PRD Alignment: NFR-1.8, NFR-2.5, NFR-3.4, NFR-4.2

---

## Integration & E2E Test Plan (Phase 2)

- Scene switching: measure click → fully rendered (state + worker parse + geometry swap + crossfade) <500ms via Performance API
- Control changes: response <100ms; propagation to viewers/metrics <200ms
- Camera sync: synced by default; independent toggle decouples and recouples correctly
- Fallback: artificially force FPS drop to trigger 50k tier; verify swap occurs and warning shows
- Accessibility: keyboard navigation for all controls; aria-live for metrics; color contrast AA retained
- Cross-browser: latest 2 versions of Chrome, Firefox, Safari, Edge (desktop)

---

## Risks & Mitigations (Phase 2)

- Performance regressions: Early FPS overlay and profiling; guardrails + fallback
- State complexity: Small pure functions; memoization; shareReplay at boundaries
- Data correctness: Unit tests for SimulationService vs paper JSON; deltas validated
- Browser differences: Early tests on Safari/Firefox; avoid WebGL extensions not in core

---

## PRD Alignment Matrix (Phase 2)
- FR-1.1–1.7: Dual viewers, shared geometry, synchronized cameras → 2.1.1, 2.1.3
- FR-1.12–1.15: Detection viz + animated updates → 2.1.2
- FR-2.1–2.13: Controls + Current Config display → 2.2.1–2.2.4
- FR-3.1–3.8: Metrics & comparison thresholds → 2.3.1
- NFR-1.x: Performance targets, fallback, instrumentation → 2.1.4, 2.3.2
- NFR-2.x: Compatibility; WebGL check → 2.3.2
- NFR-3.x: Usability & a11y → 2.2.x, 2.3.1
- NFR-5.2: Separated data layer; config-driven scenes → all 2.x depend on 1.x data layer
