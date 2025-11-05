# AGILE3D Interactive Demo — Phase 3 Detailed Plan with Pseudocode (v1)

## Executive Summary
Phase 3 finalizes the demo: polish, performance, accessibility, comprehensive testing, deployment, and rehearsal. This plan includes actionable steps and pseudocode to achieve PRD success metrics: 60fps sustained, <5s load, <100ms control response, WCAG AA, reliability, and accurate metrics.

Estimated duration: 3–4 days (24–36 hours) + small buffer.

Exit criteria (must pass in production build):
- Performance: ≥60fps (both viewers), TTI <5s, control response <100ms, propagation <200ms
- Accessibility: WCAG AA contrast, keyboard navigation (all controls), aria-live for metrics, prefers-reduced-motion honored
- Reliability: No crashes; graceful WebGL/data fallback; memory stable over 15 minutes; no leaks
- Compatibility: Latest two versions of Chrome/Firefox/Safari/Edge (desktop), tablet layout at 1024×768
- Deployment: Vercel (or equivalent) with brotli, cache headers; CDN working
- Demo readiness: Rehearsal complete on presentation hardware; backup video ready and linked

---

## Day-by-Day (4 days suggested)
- Day 1: WP-3.1.1 Visual polish + WP-3.1.2 Loading states (parallel) → WP-3.2.1 Perf pass
- Day 2: WP-3.2.2 Bundle & assets → WP-3.3.1 Accessibility audit (start) → WP-3.4.1 Copy
- Day 3: WP-3.3.1 finish → WP-3.5.1 Comprehensive testing (critical gate)
- Day 4: Bug fixes buffer → WP-3.6.1 Deployment → WP-3.6.2 Rehearsal

---

## WP-3.1.1 Visual Polish & Micro-Interactions (3–5h)

Purpose: Consistent animation timing/easing; respectful of reduced motion; scene-crossfade integrated with tokens.

Pseudocode: centralized animation tokens
```
// src/app/utils/animation-tokens.ts
export const ANIM = {
  duration: { fast: 150, normal: 200, slow: 300, sceneCrossfade: 500 },
  easing: {
    standard: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
    decel: 'cubic-bezier(0.0, 0.0, 0.2, 1)',
    accel: 'cubic-bezier(0.4, 0.0, 1, 1)'
  }
};

// Reduced motion helper
export function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
```

Crossfade integration in DualViewer
```
// When crossfadeState === 'fade-out' → fade container opacity to 0 (ANIM.duration.fast)
// Load/parse/swap
// crossfadeState === 'fade-in' → fade container opacity to 1 (ANIM.duration.fast)
```

CSS example (dual-viewer.component.scss)
```
.dual-viewer {
  transition: opacity 150ms cubic-bezier(0.4, 0.0, 0.2, 1);
  &.fade-out { opacity: 0; }
  &.fade-in { opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .dual-viewer { transition-duration: 0ms; }
}
```

Reactive reduced motion helper
```
@Injectable({ providedIn: 'root' })
export class AnimationService {
  private mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  reducedMotion$ = new BehaviorSubject<boolean>(this.mq.matches);
  constructor(){ this.mq.addEventListener('change', e => this.reducedMotion$.next(e.matches)); }
}
```

Validation:
- Smooth, consistent animations; zero jank; reduced-motion dynamically disables non-essential transitions

PRD: FR-3.5–3.8; NFR-3.7; §8.3

---

## WP-3.1.2 Loading States & Perceived Performance (2–3h)

Purpose: Provide skeletons/spinners during parse and scene switch; avoid layout shift.

Pseudocode:
```
@Component({ selector:'app-loading-skeleton', template:`
  <div class="skeleton-viewer"></div>
  <div class="skeleton-controls"></div>
  <div class="skeleton-metrics"></div>
`})
export class LoadingSkeletonComponent {}

// DualViewer usage
<app-loading-skeleton *ngIf="(crossfadeState$ | async) !== 'idle'"></app-loading-skeleton>
```

Validation:
- Skeletons only when needed; no blank screens; minimal CLS

PRD: NFR-1.1, NFR-4.2; §7.5.2, §8.2

---

## WP-3.2.1 3D Performance Optimization Pass (4–6h)

Purpose: Lock ≥60fps with guardrails; verify frustum culling; clamp DPR; prewarm.

Pseudocode:
```
// Clamp DPR at viewer bootstrap
const maxDPR = Math.min(window.devicePixelRatio || 1, 2.0);
renderer.setPixelRatio(maxDPR);

// Prewarm (after scene constructed)
renderer.compile(scene, camera);

// Frustum culling sanity check (manual)
scene.traverse(obj => obj.frustumCulled = true);
```

Pause loop when tab hidden
```
// src/app/services/rendering/render-loop.service.ts
fromEvent(document, 'visibilitychange').subscribe(() => {
  if (document.hidden) this.stop(); else if (this.renderers.size) this.start();
});
```

FPS overlay (dev or ?debug=true)
```
@Component({
  selector: 'app-fps-overlay',
  template: `<div class="fps-overlay" *ngIf="show">FPS: {{ fps | number:'1.0-0' }}</div>`,
  styles: [`.fps-overlay { position: fixed; top:10px; right:10px; background:rgba(0,0,0,.8); color:#0f0; padding:4px 8px; font-family:monospace; font-size:12px; z-index:9999; }`]
})
export class FpsOverlayComponent {
  @Input() show = false; fps = 60;
  constructor(private tier: SceneTierManager){
    interval(1000).subscribe(() => {
      const hist = (this.tier as any).history as number[]; // or expose getter
      if (hist?.length) this.fps = hist.reduce((a,b)=>a+b,0) / hist.length;
    });
  }
}
```

Scene switch instrumentation (Performance API)
```
// In DualViewerComponent scenePoints$ pipeline
performance.clearMarks('scene-switch-start');
performance.clearMarks('scene-switch-end');
performance.clearMeasures('scene-switch');
performance.mark('scene-switch-start');
this.crossfadeState$.next('fade-out'); await this.delay(150);
// load + parse
this.crossfadeState$.next('fade-in'); await this.delay(150);
this.crossfadeState$.next('idle');
performance.mark('scene-switch-end');
performance.measure('scene-switch', 'scene-switch-start', 'scene-switch-end');
if (isDevMode()) {
  const m = performance.getEntriesByName('scene-switch')[0];
  console.log(`Scene switch took ${m.duration.toFixed(0)}ms`);
}
```

Validation:
- Traces show stable ≥60fps; no spikes on parameter changes; loop pauses when hidden; FPS overlay works in dev; scene switch measurement <500ms

PRD: NFR-1.2, NFR-1.8, NFR-4.5; §7.5.1

---

## WP-3.2.2 Bundle & Asset Budgets (3–5h)

Purpose: Meet <5s load; compress assets; set cache headers; protect perf with CI.

Angular budgets (angular.json)
```
"budgets": [
  { "type": "initial", "maximumWarning": "5mb", "maximumError": "10mb" }
]
```

Lazy-load optional components
```
// app.routes.ts
export const routes: Routes = [
  { path: 'charts', loadComponent: () => import('./components/comparison-chart/comparison-chart.component').then(m => m.ComparisonChartComponent) }
];
```

Lighthouse CI (optional)
```
// lighthouserc.json
{
  "ci": {
    "collect": { "url": ["http://localhost:4200"], "numberOfRuns": 3 },
    "assert": {
      "preset": "lighthouse:recommended",
      "assertions": {
        "categories:performance": ["error", {"minScore": 0.9}],
        "categories:accessibility": ["error", {"minScore": 0.95}],
        "first-contentful-paint": ["error", {"maxNumericValue": 2000}],
        "interactive": ["error", {"maxNumericValue": 5000}]
      }
    },
    "upload": { "target": "temporary-public-storage" }
  }
}
```

Vercel headers (example via vercel.json)
```
{
  "headers": [
    { "source": "/assets/(.*)\.bin", "headers": [
      { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
    ]}
  ]
}
```

Validation:
- TTI <5s; bundle <10MB (excluding 3D assets); assets: total ≤8MB compressed; per scene ≤2.5MB

PRD: NFR-1.1, NFR-1.5–1.7; §7.1.6

---

## WP-3.3.1 Accessibility & Responsiveness Audit (4–6h)

Purpose: WCAG AA, keyboard nav, live regions; validate breakpoints.

Pseudocode (aria-live + focus):
```
// Metrics labels use aria-live so SRs announce updates
<div aria-live="polite">Accuracy: {{ accuracy }}%</div>

// Focus visible style
:focus-visible { outline: 2px solid #2563EB; outline-offset: 2px; border-radius: 4px; }
```

Responsive tests: 1024×768 (min tablet), 1366×768 (laptop), 1920×1080 (desktop)

Validation:
- Axe/Lighthouse clean; keyboard nav logical; SR announces changes; layouts good at specified resolutions

PRD: NFR-2.3, NFR-3.3–3.7; §8.1, §8.4

---

## WP-3.4.1 Educational Content & Copy (2–4h)

Purpose: Finalize minimal copy for Hero/Tooltips/Footer; ensure consistency with paper.

Pseudocode:
```
// HeroComponent
<h1>AGILE3D: Adaptive 3D Object Detection</h1>
<p>See how adaptive detection outperforms a static baseline in real-time.</p>
<button mat-raised-button color="primary" (click)="scrollToDemo()">Try the Demo</button>

// Tooltip content (short, consistent, paper-aligned)
const tooltips = {
  scene: 'Choose a scenario to compare behavior in different environments',
  voxel: 'Spatial resolution: smaller = more detail, slower',
  contention: 'Simulated GPU resource pressure from other apps',
  slo: 'Target latency; AGILE3D adapts to meet it'
};
```

Validation:
- Copy concise; links (paper, repo) valid; terminology matches paper; no overflow

PRD: FR-5.1–5.9; §9

---

## WP-3.4.2 Optional Charts (uPlot) (4–6h, stretch)

Purpose: Add comparison chart(s) if ahead of schedule; lazy-load route.

Pseudocode:
```
// comparison-chart.component.ts
initChart(el: HTMLElement, series: Series[]){
  const opts: UPlot.Options = { width: el.clientWidth, height: 200, series };
  this.uplot = new uPlot(opts, data, el);
}
```

Validation:
- Chart updates on control changes; no perf regression; a11y labels present

PRD: FR-4.1–4.7 (if implemented)

---

## WP-3.5.1 Comprehensive Testing & SQA (6–8h)

Purpose: Validate functionality, performance, accessibility, reliability.

Pseudocode & procedures:
```
// Enforce coverage thresholds
// jest.config.js or karma.conf.js -> coverageThreshold

// E2E Playwright: scene switch timing
await page.click('[data-test=scene-mixed]');
const measures = await page.evaluate(() => performance.getEntriesByName('scene-switch'));
expect(Math.min(...measures.map(m => m.duration))).toBeLessThan(500);

// Memory leak automation (Chrome): 100 param changes + 20 scene switches
const baseline = await page.evaluate(() => performance.memory?.usedJSHeapSize || 0);
for (let i=0;i<100;i++){ await page.fill('[data-test=contention-slider]', String(Math.floor(Math.random()*100))); await page.waitForTimeout(50); }
for (let i=0;i<20;i++){ await page.click('[data-test=scene-vehicle]'); await page.waitForTimeout(500); await page.click('[data-test=scene-pedestrian]'); await page.waitForTimeout(500); }
await page.evaluate(() => { if ((window as any).gc) (window as any).gc(); });
const final = await page.evaluate(() => performance.memory?.usedJSHeapSize || 0);
expect((final - baseline) / (1024*1024)).toBeLessThan(50);
```

Data accuracy validation suite (unit tests):
```
// src/app/services/simulation.service.spec.ts
it('baseline metrics match paper (Figure 11)', () => {
  const m = service.calculateMetrics('DSVT_Voxel','vehicle-heavy',0,350);
  expectWithinTolerance(m.baseline.accuracy, 67.1, 1.0);
  expectWithinTolerance(m.baseline.latency, 371, 1.0);
});

it('branch selection prefers SLO-feasible fast branch when needed', () => {
  const id = service.selectOptimalBranch('pedestrian-heavy',64,100,0.48,{encodingFormat:'pillar',detectionHead:'center',featureExtractor:'2d_cnn'});
  const cfg = paper.getBranchConfig(id);
  expect(cfg.performance.latency.intenseContention.mean).toBeLessThan(100);
});
```

Cross-browser scope and versions:
- Chrome 120, 121; Firefox 120, 121; Safari 17.1, 17.2; Edge 120, 121 (desktop)

Validation:
- All PRD acceptance checks pass or tracked; no critical bugs; coverage ≥70% services, ≥60% components

Validation:
- All PRD acceptance checks pass or tracked; no critical bugs; coverage ≥70% services, ≥60% components

PRD: NFR-1.x–4.x, NFR-6.2; §14

---

## WP-3.6.1 Deployment (Vercel) & CDN (3–5h)

Purpose: Production deployment with compression, caching, and HTTPS.

Pseudocode (vercel.json):
```
{
  "headers": [
    { "source": "/assets/(.*)\.bin", "headers": [
      { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
    ]}
  ]
}
```

WebGL fallback component location (App initialization):
```
// app.component.ts
export class AppComponent implements OnInit { showFallback=false; ngOnInit(){ this.showFallback=!this.checkWebGL2(); }
  private checkWebGL2(): boolean { try{ const c=document.createElement('canvas'); return !!c.getContext('webgl2'); } catch { return false; } }
}
// app.component.html
<app-webgl-fallback *ngIf="showFallback"></app-webgl-fallback>
<router-outlet *ngIf="!showFallback"></router-outlet>
```

Staging first, then production. Validate WebGL fallback message; TTI <5s on target hardware.

PRD: NFR-1.1, NFR-1.6–1.7, NFR-2.5; §7.1.6

---

## WP-3.6.2 Documentation & Demo Rehearsal (3–4h)

Purpose: Documentation plus full rehearsal on presentation hardware; backup video ready.

README structure:
- Quick start; scripts; data; performance tips; troubleshooting; demo walkthrough

Backup video specifications:
- 3–5 minutes at 1920×1080 @ 60fps; MP4; covers key features; embedded on fallback page with manual trigger

Backup Video Recording Procedure:
1) Tool: OBS Studio (Windows/macOS) or QuickTime (macOS)
2) Settings: 1920×1080, 60fps, H.264 MP4, optional voiceover or captions
3) Content outline:
   - 0:00–0:30 Hero + overview
   - 0:30–2:30 Scene selection, control changes, metrics comparison
   - 2:30–3:30 Branch switching demonstration
   - 3:30–4:00 Key takeaways
4) Export: <100MB; place at /assets/demo-backup.mp4
5) Test playback in Chrome/Firefox/Safari/Edge; ensure fallback page plays

Pseudocode (fallback page snippet):
```
if (!webgl2Supported()) {
  showError('WebGL required', 'Watch the demo video instead');
  showEmbeddedVideo('/assets/demo-backup.mp4');
}
```

Validation:
- Rehearsal passes end-to-end on target hardware; docs clear; backup video accessible

PRD: §17.4; NFR-4.1–4.5

---

## Phase 3 Exit Gate
- Meets performance, accessibility, reliability, compatibility targets in production build
- Deployed with compression & caching; fallback verified
- Comprehensive test report (Markdown/JSON) attached; no critical bugs open
- Rehearsal completed; backup plan prepared

---

## Risks & Mitigations
- Testing time overrun → Allocate full Day 3 to testing + 2–4h fix buffer Day 4
- Last-minute perf issues → Profile Day 1; gate before testing if <60fps
- Deployment surprises → Staging deploy before production; check headers/compression
- Browser-specific bugs → Test across Chrome/Firefox/Safari/Edge early; avoid non-core WebGL

---

## PRD Alignment Matrix (Phase 3)
- NFR-1.x: Perf targets, load time, instrumentation → 3.2.x, 3.5.1
- NFR-2.x: Compatibility, WebGL fallback → 3.3.1, 3.5.1, 3.6.1
- NFR-3.x: Usability, accessibility → 3.1.x, 3.3.1, 3.4.1
- NFR-4.x: Reliability, memory, error handling → 3.2.1, 3.5.1
- FR-4.x (optional charts) → 3.4.2 (stretch)
- §17.4 Rehearsal & backup → 3.6.2
