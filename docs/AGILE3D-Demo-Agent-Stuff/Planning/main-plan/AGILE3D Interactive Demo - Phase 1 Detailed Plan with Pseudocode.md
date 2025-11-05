# AGILE3D Interactive Demo — Phase 1 Detailed Plan with Pseudocode (v3)

## Executive Summary
Phase 1 establishes the technical foundation and data needed for the dual 3D viewer demo. This detailed plan expands prior Phase 1 deliverables with concrete steps, wiring diagrams, and pseudocode stubs to accelerate implementation.

Duration: 3–4 days (28–41 hours), with explicit decision gates:
- Gate A (end Day 2): Paper data completeness verified (incl. DSVT-Voxel baseline); JSON+schemas green
- Gate B (Day 3 AM): Three.js PoC achieves 60fps with synchronized camera state

Guiding constraints (PRD):
- Performance: 60fps 3D; <100ms control response; <200ms propagation
- Assets: ≤8MB total compressed; ≤2.5MB per scene compressed
- Parsing: Web Worker; binary Float32 (.bin); stride=3 [x,y,z]
- Extensibility (FR-1.11): Add new scenes via JSON only
- Accessibility: WCAG AA; prefers-reduced-motion honored

---

## Day-by-Day Execution Plan

Day 1 (8h):
- AM: WP-1.1.1 Angular project init; dependencies; lint; strict TS; structure
- PM: In parallel: WP-1.2.1 Paper data extraction; WP-1.3.1 Design system tokens/theme

Day 2 (8h):
- AM: Complete WP-1.2.1; WP-1.3.1; start WP-1.1.2 core services/state
- PM: Finish WP-1.1.2; begin WP-1.2.2 Worker-first parsing infra
- Gate A: Paper data validated (DSVT baseline explicit)

Day 3 (8h):
- AM: WP-1.1.3 Three.js PoC + camera sync
- PM: WP-1.2.2 scenes + budgets + extensibility validation; WP-1.3.2 layout shell
- Gate B: 60fps PoC validated

Day 4 (Buffer, 6–8h):
- Complete outstanding tasks in 1.2.2/1.3.2; integration sanity checks

---

## WP-1.1.1 — Angular Project Initialization (2–3h)

Purpose: Create the Angular 17+ project with strict TS; install angular-three, Three.js, Material; set structure.

Tasks:
1) Create project and install deps
```
pwsh
ng new agile3d-demo --routing --style=scss --strict --standalone
cd agile3d-demo
npm i three @angular-three/core @angular-three/schematics
npm i @angular/material @angular/cdk @angular/animations
npm i -D @types/three eslint prettier
```
2) Enable strict mode and ESLint (Angular recommended), Prettier
3) Structure folders and assets
```
src/
  app/
    components/
      dual-viewer/
      scene-viewer/
      control-panel/
      metrics-dashboard/
    services/
      state/
      data/
      rendering/
    models/
    utils/
  assets/
    data/         # paper-data, branch-configs
    scenes/       # scene folders + .bin + metadata.json
    workers/      # point-cloud-worker.js
```
4) angular.json: production optimizations on; dev source maps on

ESLint config example (.eslintrc.json)
```
{
  "extends": ["@angular-eslint/recommended"],
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/explicit-function-return-type": "warn"
  }
}
```

Prettier config (.prettierrc)
```
{
  "singleQuote": true,
  "trailingComma": "es5",
  "tabWidth": 2,
  "semi": true,
  "printWidth": 100
}
```

Outputs:
- Compiling Angular app with deps installed and structure in place

Validation:
- ng serve/build OK; ESLint runs clean; strict TS enabled

PRD Alignment:
- NFR-5.1, NFR-6.1; Tech §7.1.1

---

## WP-1.1.2 — Core Services & State (4–6h)

Purpose: Implement single rAF loop; global state via BehaviorSubjects; derived state; interfaces.

Pseudocode (TypeScript):

RenderLoopService (single requestAnimationFrame)
```
// src/app/services/rendering/render-loop.service.ts (pseudocode)
@Injectable({ providedIn: 'root' })
export class RenderLoopService {
  private renderers = new Map<string, () => void>();
  private running = false;
  private rafId: number | null = null;

  register(id: string, cb: () => void): void {
    this.renderers.set(id, cb);
    if (!this.running) this.start();
  }
  unregister(id: string): void {
    this.renderers.delete(id);
    if (this.renderers.size === 0) this.stop();
  }
  private start(): void {
    this.running = true;
    const loop = (t: number) => {
      this.renderers.forEach(cb => cb());
      if (this.running) this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }
  private stop(): void {
    this.running = false;
    if (this.rafId != null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }
}
```

StateService (global state + derived)
```
// src/app/services/state/state.service.ts (pseudocode)
@Injectable({ providedIn: 'root' })
export class StateService {
  // Primary
  currentScene$ = new BehaviorSubject<string>('vehicle-heavy');
  contention$   = new BehaviorSubject<number>(0);
  latencySlo$   = new BehaviorSubject<number>(350);
  voxelSize$    = new BehaviorSubject<number>(0.32);
  activeBranch$ = new BehaviorSubject<string>('CP-Pillar-032');

  // Camera sync
  cameraPos$    = new BehaviorSubject<[number,number,number]>([0,0,10]);
  cameraTarget$ = new BehaviorSubject<[number,number,number]>([0,0,0]);

  // Derived example (wire in Phase 2 SimulationService)
  comparisonData$ = combineLatest([
    this.currentScene$, this.contention$, this.latencySlo$, this.voxelSize$
  ]).pipe(
    map(([scene, cont, slo, vox]) => ({ scene, cont, slo, vox })),
    distinctUntilChanged((a,b) => JSON.stringify(a)===JSON.stringify(b)),
    shareReplay(1)
  );
}
```

Data interfaces
```
// src/app/models/scene.models.ts
export interface Detection {
  id: string; class: 'vehicle'|'pedestrian'|'cyclist';
  center: [number,number,number];
  dimensions: { width:number; length:number; height:number };
  yaw: number; confidence: number; matches_gt?: string;
}
export interface SceneMetadata {
  scene_id: string; name: string; description: string;
  pointsBin: string; pointCount: number; pointStride: 3;
  bounds: { min:[number,number,number]; max:[number,number,number] };
  ground_truth: Detection[];
  predictions: Record<string, Detection[]>; // keys: DSVT_Voxel, AGILE3D_...
  metadata: { vehicleCount:number; pedestrianCount:number; cyclistCount:number; complexity:string; optimalBranch:string };
}
```

Unit test sketch
```
// render-loop.service.spec.ts
it('starts loop after first register and stops when empty', () => {
  service.register('a', () => {});
  expect(service['running']).toBeTrue();
  service.unregister('a');
  expect(service['running']).toBeFalse();
});
```

Validation:
- Services instantiate; rAF starts/stops; derived observables emit; ≥70% service test coverage

PRD Alignment:
- NFR-5.1, NFR-5.7, NFR-6.1; Tech §7.3, §7.4

---

## WP-1.1.3 — Three.js Integration PoC (+ Camera Sync) (6–8h)

Purpose: Prove Three.js (angular-three) runs at 60fps; implement OrbitControls camera sync with StateService; instanced bbox sample.

Pseudocode wiring:

Angular-three setup
```
// src/main.ts (pseudocode)
import { extend } from '@angular-three/core';
import { Mesh, Points, BufferGeometry, PointsMaterial, BoxGeometry, MeshBasicMaterial, InstancedMesh } from 'three';
extend({ Mesh, Points, BufferGeometry, PointsMaterial, BoxGeometry, MeshBasicMaterial, InstancedMesh });
```

SceneViewerComponent skeleton
```
@Component({ selector:'app-scene-viewer', standalone:true, template:`
  <ngt-canvas [camera]="{ position:[0,0,10], fov:75 }" [gl]="{ antialias:true, alpha:true }">
    <ngt-ambient-light [intensity]="0.4" />
    <ngt-directional-light [position]="[10,10,5]" [intensity]="0.8" />
    <!-- points + boxes projected here -->
  </ngt-canvas>
`})
export class SceneViewerComponent implements OnInit, OnDestroy {
  @Input() viewerId!: 'baseline'|'agile3d';
  constructor(private state: StateService, private loop: RenderLoopService) {}
  ngOnInit(){ this.loop.register(this.viewerId, () => this.renderFrame()); }
  ngOnDestroy(){ this.loop.unregister(this.viewerId); /* dispose geometries/materials */ }
  private renderFrame(){ /* renderer.render(scene, camera) */ }
}
```

CameraControlService (two-way sync with feedback-loop prevention)
```
@Injectable({ providedIn:'root' })
export class CameraControlService {
  private controls = new Map<string, OrbitControls>();
  private updating = false; // prevent feedback loops
  constructor(private state: StateService){}
  attach(id:string, controls:OrbitControls){
    this.controls.set(id, controls);

    // Controls → State (user interaction)
    controls.addEventListener('change', () => {
      if (!this.updating) {
        this.updating = true;
        this.state.cameraPos$.next(
          controls.object.position.toArray() as [number,number,number]
        );
        this.state.cameraTarget$.next(
          controls.target.toArray() as [number,number,number]
        );
        this.updating = false;
      }
    });

    // State → Controls (external updates)
    this.state.cameraPos$.subscribe(p => {
      if (!this.updating) {
        this.updating = true;
        controls.object.position.set(...p);
        controls.update();
        this.updating = false;
      }
    });
    this.state.cameraTarget$.subscribe(t => {
      if (!this.updating) {
        this.updating = true;
        controls.target.set(...t);
        controls.update();
        this.updating = false;
      }
    });
  }
}
```

Instanced bbox sample
```
function createBBoxInstances(dets: Detection[]): InstancedMesh {
  const geom = new BoxGeometry(1, 1, 1);
  const mat = new MeshBasicMaterial({ wireframe: true, transparent: true, opacity: 0.8 });
  const mesh = new InstancedMesh(geom, mat, dets.length);

  dets.forEach((d, i) => {
    const matrix = new Matrix4();
    const position = new Vector3(...d.center);
    const rotation = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), d.yaw);
    const scale = new Vector3(d.dimensions.width, d.dimensions.length, d.dimensions.height);
    matrix.compose(position, rotation, scale);
    mesh.setMatrixAt(i, matrix);

    // Set color based on class (Three r159+)
    const color = new Color(colorForClass(d.class));
    mesh.setColorAt(i, color);
  });

  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceColor!.needsUpdate = true;

  return mesh;
}
function colorForClass(cls: string): number {
  const colors = { vehicle: 0x3B82F6, pedestrian: 0xEF4444, cyclist: 0xF97316 };
  return colors[cls as keyof typeof colors] || 0x6B7280;
}
```

Validation:
- 60fps stable on test hardware; camera sync two-way; no WebGL errors; ≥60% component coverage

PRD Alignment:
- NFR-1.2; FR-1.4, FR-1.5; Tech §7.1.2, §7.5.1

---

## WP-1.2.1 — Paper Data Extraction (Incl. DSVT Baseline) (6–8h)

Purpose: Extract DSVT-Voxel baseline and AGILE3D branches; create JSON lookup tables.

Data targets (PRD §6.1):
- Figure 7: Accuracy vs contention for DSVT & AGILE3D @ SLO {100,350,500}
- Figure 11 (Pareto) + Section 5.1: DSVT-Voxel baseline (accuracy, latency)
- Table 2: Branch perf (mean/std), memory; Figures 15–16 (voxel/pillar effects)

Pseudocode for extraction pipeline (choose Python or JS; example Python):
```
# tools/extract_paper_data.py (pseudocode)
import json

def extract_figure7(pdf_path)->dict: ...
def extract_pareto_fig11(pdf_path)->dict: ...
def extract_table2(pdf_path)->dict: ...

data = {
  'accuracy_vs_contention': extract_figure7('agile3d.pdf'),
  'pareto_frontier': extract_pareto_fig11('agile3d.pdf'),
  'branches': extract_table2('agile3d.pdf')
}
with open('assets/data/accuracy-vs-contention.json','w') as f: json.dump(data['accuracy_vs_contention'], f)
```

Schemas:
```
// assets/data/schemas/branch-config.schema.json (pseudocode)
{
  "$id":"branch-config.schema.json",
  "type":"object",
  "required":["branch_id","controlKnobs","performance"],
  "properties":{
    "branch_id":{"type":"string"},
    "controlKnobs":{
      "type":"object",
      "required":["encodingFormat","spatialResolution","spatialEncoding","featureExtractor","detectionHead"]
    },
    "performance":{
      "type":"object",
      "required":["memoryFootprint","latency","accuracy"]
    }
  }
}
```

Schema validation (build-time) pseudocode using Ajv
```
import Ajv from 'ajv';
const ajv = new Ajv();
const validate = ajv.compile(branchConfigSchema);
const valid = validate(branchData);
if (!valid) console.error('Schema errors', validate.errors);
```

Deliverables:
- baseline-performance.json; agile3d-branches.json; accuracy-vs-contention.json; pareto-frontier.json; validation-report.json

Validation:
- 100% parity to paper (±1% if interpolation documented); schemas pass; provenance (page/figure references)

PRD Alignment:
- NFR-4.3, NFR-5.2; FR-3.1–3.2; Data §6.1–6.3

---

## WP-1.2.2 — Scene Data & Parsing Infra (Worker-First) + Extensibility (8–10h)

Purpose: Build parsing infra first; then 3 scenes (100k/50k point tiers); validate budgets and config-only extensibility.

Worker-based parsing
```
// assets/workers/point-cloud-worker.js (pseudocode)
self.onmessage = (evt) => {
  const { arrayBuffer, stride /*=3*/ } = evt.data;
  try {
    const inF32 = new Float32Array(arrayBuffer);
    const count = Math.floor(inF32.length / stride);
    const positions = new Float32Array(count*3);
    for (let i=0, j=0; i<inF32.length; i+=stride, j+=3) {
      positions[j]   = inF32[i+0];
      positions[j+1] = inF32[i+1];
      positions[j+2] = inF32[i+2];
    }
    // Transfer positions back to main thread
    self.postMessage({ ok:true, positions }, [positions.buffer]);
  } catch(e){ self.postMessage({ ok:false, error: String(e) }); }
};
```

SceneDataService (worker integration + caching)
```
// src/app/services/data/scene-data.service.ts (pseudocode)
@Injectable({ providedIn:'root' })
export class SceneDataService {
  private worker?: Worker;
  private memCache = new Map<string, { meta:SceneMetadata; positions:Float32Array }>();

  async loadMeta(sceneId:string): Promise<SceneMetadata> {
    const resp = await fetch(`/assets/scenes/${sceneId}/metadata.json`);
    return await resp.json();
  }
  async loadPoints(binPath:string): Promise<Float32Array> {
    const resp = await fetch(binPath); const buf = await resp.arrayBuffer();
    return new Float32Array(buf);
  }
parseInWorker(buf:ArrayBuffer, stride=3): Promise<Float32Array> {
    return new Promise((resolve, reject) => {
      if(!this.worker) {
        this.worker = new Worker('/assets/workers/point-cloud-worker.js');
      }
      const timeout = setTimeout(() => reject(new Error('Worker timeout after 10s')), 10000);
      this.worker.onmessage = (e: MessageEvent) => {
        clearTimeout(timeout);
        if ((e as any).data?.ok) resolve((e as any).data.positions);
        else reject(new Error((e as any).data?.error ?? 'Worker error'));
      };
      this.worker.onerror = (err) => { clearTimeout(timeout); reject(err as any); };
      // Note: buf is transferred (zero-copy) and becomes unusable on main thread
      this.worker.postMessage({ arrayBuffer: buf, stride }, [buf]);
    });
  }
  // Optional cleanup to prevent leaks
  terminateWorker(): void {
    if (this.worker) { this.worker.terminate(); this.worker = undefined; }
  }
}
```

Scene metadata example (vehicle-heavy)
```
{
  "scene_id":"vehicle_heavy_01",
  "name":"Highway Scene",
  "pointsBin":"assets/scenes/vehicle_heavy_01/vehicle_heavy_01_100k.bin",
  "pointCount":100000,
  "pointStride":3,
  "bounds":{"min":[-50,-25,-2],"max":[50,25,5]},
  "ground_truth":[ {"id":"obj_001","class":"vehicle","center":[10.5,3.2,0.0],"dimensions":{"width":4.5,"length":1.8,"height":1.6},"yaw":0.1,"confidence":1.0} ],
  "predictions":{
    "DSVT_Voxel":[{"id":"pred_001","class":"vehicle","center":[10.3,3.1,0.0],"dimensions":{"width":4.6,"length":1.9,"height":1.6},"yaw":0.12,"confidence":0.92,"matches_gt":"obj_001"}],
    "AGILE3D_CP_Pillar_032":[{"id":"pred_001","class":"vehicle","center":[10.4,3.2,0.0],"dimensions":{"width":4.5,"length":1.8,"height":1.5},"yaw":0.11,"confidence":0.95,"matches_gt":"obj_001"}]
  },
  "metadata":{"vehicleCount":18,"pedestrianCount":1,"cyclistCount":0,"complexity":"medium","optimalBranch":"CP_Pillar_032"}
}
```

Extensibility validation (FR-1.11):
- Add a 4th scene `assets/scenes/parking_lot_01/metadata.json` + `.bin` paths; no code changes allowed; ensure DualViewer loads it via JSON config list

Size budgets & pre-compression:
- Pre-compress `.bin` with Brotli at build-time (Vercel supports `Content-Encoding: br`)
- Validate per-scene ≤2.5MB compressed; total ≤8MB compressed

Tier selection (NFR-1.9) — pseudocode
```
@Injectable({ providedIn: 'root' })
export class SceneTierManager {
  private history: number[] = [];
  private readonly WINDOW = 180; // 3s @ 60fps
  private readonly THRESH = 45;
  currentTier$ = new BehaviorSubject<'demo'|'fallback'>('demo');

  recordFrame(deltaMs: number): void {
    const fps = 1000 / deltaMs; this.history.push(fps);
    if (this.history.length > this.WINDOW) this.history.shift();
    if (this.history.length === this.WINDOW) {
      const avg = this.history.reduce((a,b)=>a+b,0) / this.WINDOW;
      if (avg < this.THRESH && this.currentTier$.value === 'demo') {
        this.currentTier$.next('fallback');
      }
    }
  }
  tierPath(binPath:string): string {
    return this.currentTier$.value === 'fallback' ? binPath.replace('.bin','_50k.bin') : binPath;
  }
}
```

Validation:
- Worker parsing non-blocking; sizes within budgets; 4th scene loads via JSON-only

PRD Alignment:
- NFR-1.6–1.7, NFR-1.9; FR-1.8–1.11; Tech §6.2, §7.5.2

---

## WP-1.3.1 — Visual Design System & Theme (4–5h)

Purpose: Implement tokens (colors/typography/spacing), Material theme, reduced-motion, a11y colors.

SCSS tokens (sample)
```
// src/styles/_tokens.scss
$primary:#2563EB; $secondary:#475569; $accent:#10B981; $warning:#F59E0B; $error:#EF4444;
$vehicle:#3B82F6; $pedestrian:#EF4444; $cyclist:#F97316;
$space-8:8px; $space-16:16px; $space-24:24px; $space-32:32px; $space-48:48px;
$font-base: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
$h1:48px; $h2:36px; $h3:24px; $h4:20px; $body:16px; $mono:14px;
```

Angular Material theme (sample)
```
// src/styles/theme.scss
@use '@angular/material' as mat;
$theme: mat.define-light-theme((
  color:(
    primary: mat.define-palette(mat.$blue-palette,600),
    accent: mat.define-palette(mat.$green-palette,500),
    warn: mat.define-palette(mat.$red-palette,500)
  ),
  typography: mat.define-typography-config(
    $font-family: $font-base,
    $headline-1: mat.define-typography-level($h1, 1.2, 600),
    $headline-2: mat.define-typography-level($h2, 1.2, 600),
    $headline-3: mat.define-typography-level($h3, 1.2, 600),
    $headline-4: mat.define-typography-level($h4, 1.2, 600),
    $body-1:     mat.define-typography-level($body, 1.5, 400)
  ),
  density: 0
));
@include mat.all-component-themes($theme);
```

Reduced motion
```
@media (prefers-reduced-motion: reduce){ *,*::before,*::after{ animation-duration:0ms !important; transition-duration:0ms !important; }}
```

Validation:
- Tokens compiled; colors WCAG AA; reduced-motion honored
- Automated contrast check performed for text/background token combinations (≥4.5:1)

PRD Alignment:
- NFR-3.5–3.7; UI §8.2, §8.4

---

## WP-1.3.2 — Layout Structure Shell (4–6h)

Purpose: Build responsive shell (Header/Hero/MainDemo/Footer); dual viewer region; controls region; metrics region.

MainDemo layout
```
// src/app/components/main-demo/main-demo.component.html (pseudocode)
<section id="demo" class="main-demo" role="main">
  <div class="dual-viewer-section"><app-dual-viewer/></div>
  <div class="control-panel-section"><app-control-panel/></div>
  <div class="metrics-section"><app-metrics-dashboard/></div>
</section>
```

Styles (grid + responsive)
```
.main-demo{ min-height:100vh; padding:$space-32 0; background:#F8FAFC; }
.dual-viewer-section{ height:60vh; min-height:500px; background:#fff; border-radius:8px; box-shadow:0 4px 6px rgba(0,0,0,.1); overflow:hidden; }
@media (max-width:1024px){ .dual-viewer-section{ height:auto; min-height:400px; } }
```

Keyboard nav directive
```
@Directive({ selector:'[appSkipLink]' })
export class SkipLinkDirective{
  @HostListener('keydown.enter',['$event']) onEnter(e:KeyboardEvent){ /* focus target */ }
}
```

Validation:
- Desktop 1920×1080 and Tablet 1024×768 render correctly; keyboard nav order logical

PRD Alignment:
- UI §8.1; NFR-3.3–3.4

---

## Phase 1 Acceptance & Validation Checklist

Gate A (end Day 2):
- [ ] baseline-performance.json, agile3d-branches.json, accuracy-vs-contention.json, pareto-frontier.json present and validate (±1%)
- [ ] Schemas created; validation-report.json recorded with provenance
- [ ] Design tokens and theme compiled; WCAG AA verified

Gate B (Day 3 AM):
- [ ] Three.js PoC achieves ≥60fps on desktop; camera sync two-way
- [ ] No WebGL errors; memory stable over 5 minutes of interaction

Phase 1 Exit:
- [ ] Worker parsing non-blocking; 3 scenes load; sizes within budgets
- [ ] 4th scene added via JSON config only (no code change)
- [ ] Layout shell (dual-viewer, controls, metrics) present
- [ ] Services tested: ≥70% coverage; components ≥60% (PoC)

---

## Risk Register & Mitigations (Phase 1)
- Three.js perf risk (High): Early PoC; shared geometry; instanced bboxes; DPR clamp
- Data accuracy risk (Med): Double-entry verification; schemas; provenance
- Asset budgets risk (Med): Decimation to 50k; Brotli; LOD switch guidance
- Worker integration (Low/Med): Minimal harness early; transferables; perf tracing

---

## PRD Alignment Matrix (Phase 1)
- FR-1.4, FR-1.5, FR-1.7: Camera sync + 60fps + shared geometry (WP-1.1.3)
- FR-1.8–1.11: Scene types, instant switching (infra), extensibility via config (WP-1.2.2)
- FR-2.x foundations: Controls shell (WP-1.3.2); tokens (WP-1.3.1)
- FR-3.x foundations: Data available for metrics (WP-1.2.1)
- NFR-1.1–1.9: Perf budgets and fallbacks (WP-1.2.2, WP-1.1.3)
- NFR-2.x: Browser compatibility groundwork (Material theme; WebGL checks added later)
- NFR-3.x: Accessibility tokens and layout semantics (WP-1.3.1/1.3.2)
- NFR-4.3: Data accuracy validation (WP-1.2.1)
- NFR-5.x: Modular structure; strict TS; separated data layer (WP-1.1.1–1.1.2)

---

## Appendix — Adding a New Scene via JSON Only (How-To)
1) Duplicate an existing scene folder under `assets/scenes/new_scene_id/`
2) Place a `.bin` file (100k tier) and optional `_50k.bin` fallback
3) Create `metadata.json` following schema above; update counts/paths
4) Add the new scene ID to a scene registry JSON (consumed by SceneSelector) — no code changes
5) Reload app; verify the scene appears and loads via worker; check budget report
