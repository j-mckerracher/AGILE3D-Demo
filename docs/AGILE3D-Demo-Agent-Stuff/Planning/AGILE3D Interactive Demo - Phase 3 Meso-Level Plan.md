# AGILE3D Interactive Demo - Phase 3 Meso-Level Plan

## Executive Summary
Phase 3 focuses on polish, performance, accessibility, testing, and deployment to deliver a professional, reliable NSF demo. It builds on Phase 2’s dual viewers, controls, and metrics. Scope is intentionally tight to hit PRD success metrics: 60fps sustained, <5s load, <100ms control response, WCAG AA, and data accuracy.

Estimated duration: 3–4 days (24–36 hours) with small buffer. Effort ranges per WP include a ~20–30% buffer for cross-browser and integration variance.

Testing allocation: Reserve a full Day 3 (≈8h) for comprehensive testing and add a 2–4h bug-fix buffer on Day 4 before deployment.

Phase 3 exit criteria (roll-up):
- Performance: ≥60fps sustained in both viewers; initial load <5s; control response <100ms; parameter updates <200ms
- Accessibility: WCAG AA contrast; keyboard navigation; ARIA for live metrics; prefers-reduced-motion honored
- Reliability: No crashes; graceful WebGL and data-load fallbacks; memory stable over 15 minutes
- Compatibility: Latest Chrome, Firefox, Safari, Edge on desktop; tablet layout at 1024×768
- Deployment: Production build on Vercel (or equivalent) with brotli, cache headers, and CDN
- Demo readiness: Rehearsal complete; backup video; on-hardware verification

---

## Work Packages

### WP-3.1.1: Visual Polish & Micro-Interactions

Purpose: Elevate perceived quality with smooth, consistent interactions that respect reduced-motion preferences.

Prerequisites:
- Phase 2 UI complete (viewers, controls, metrics)

Tasks:
1. Normalize animation timings and easings per PRD §8.3.1 (e.g., 200–300ms transitions)
2. Add micro-interactions (hover emphasis on buttons, subtle panel elevation changes)
3. Ensure scene switching crossfade integrates cleanly (from WP-2.1.1) with global timing tokens
4. Implement visual highlight for significant metric changes (branch switch pulse), disabled when prefers-reduced-motion
5. Centralize animation tokens in code (durations, easings; sceneCrossfade=500ms) with reduced-motion fallback

Outputs:
- Unified animation tokens and styles; tweaked component styles

Validation:
- Animations feel consistent; no jank; reduced-motion disables non-essential motion
- UX review confirms polish without distraction

Estimated Effort: 3–5 hours

Dependencies: Depends on Phase 2 completion; independent of deployment

PRD Alignment:
- Satisfies: FR-3.5–3.8; NFR-3.7
- Technical specs from: §8.3 (Animation Specifications)
- Quality standards: Smooth transitions, reduced-motion compliance
- Risks addressed: Perceived lack of polish; motion sensitivity

---

### WP-3.1.2: Loading States & Perceived Performance

Purpose: Reduce perceived latency and provide feedback during scene loads and parsing.

Prerequisites:
- Worker parsing path from Phase 1/2

Tasks:
1. Add skeleton states for DualViewer, ControlPanel, Metrics
2. Show spinner/indeterminate progress during Web Worker parsing and scene swaps
3. Defer heavy UI updates until data is ready (avoid partial flashes)

Outputs:
- Loading skeleton components and state wiring

Validation:
- No blank screens; loader visible only while work is in progress; no layout shift

Estimated Effort: 2–3 hours

Dependencies: After Phase 2; can run parallel with WP-3.1.1

PRD Alignment:
- Satisfies: NFR-1.1, NFR-4.2
- Technical specs from: §7.5.2 (Data Loading); §8.2 (UI principles)
- Quality standards: Perceived performance improvements; clear feedback
- Risks addressed: User confusion during loads

---

### WP-3.2.1: 3D Performance Optimization Pass

Purpose: Lock in ≥60fps with guardrails applied consistently across scenes and browsers.

Prerequisites:
- Dual viewers and detection visualization working (Phase 2)

Tasks:
1. Tune LOD/decimation thresholds; confirm point size vs zoom heuristics
2. Confirm frustum culling and material/shader prewarm on init; verify culling by toggling camera frustum tests and observing render calls (or using dev tools/logging)
3. Clamp devicePixelRatio (1.5–2.0) and validate impact on text/UI sharpness
4. Profile rAF work per frame; ensure single loop; coalesce state changes before render

Outputs:
- Tuned performance configuration; profiling notes

Validation:
- Chrome Performance traces show stable ≥60fps during interactions across scenes
- GPU/CPU utilization acceptable; no frame spikes on parameter changes

Estimated Effort: 4–6 hours

Dependencies: After Phase 2; informs WP-3.2.2 budgets

PRD Alignment:
- Satisfies: NFR-1.2, NFR-1.8, NFR-1.9
- Technical specs from: §7.5.1 (3D rendering);
- Quality standards: Sustained framerate; no leaks; predictable updates
- Risks addressed: Performance regressions; stutter

---

### WP-3.2.2: Bundle & Asset Budgets (Load <5s)

Purpose: Ensure initial load and asset budgets meet targets with brotli and cache headers configured.

Prerequisites:
- Build ready; assets organized (Phase 1/2)

Tasks:
1. Analyze bundle size; apply code splitting; lazy-load optional components (e.g., charts). Specifically lazy-load: ComparisonChartComponent (if implemented), uPlot and chart utilities, heavy dev-only utilities.
2. Confirm brotli/gzip pre-compression in build; verify server serves Content-Encoding: br
3. Set cache headers:
   - Immutable caching for .bin and static assets
   - Reasonable TTL for data JSON
4. Measure initial load <5s on target hardware/network; optimize as needed
5. Lighthouse targets and (optional) CI:
   - Performance ≥90 (desktop), Accessibility ≥95, Best Practices ≥90
   - Time-to-Interactive <5s, FCP <2s, LCP <3s
   - (Optional) Add Lighthouse CI with assertions to prevent regressions

Outputs:
- Optimized production build; documented budgets with measurements

Validation:
- Lighthouse/WebPageTest shows <5s Time-to-Interactive; bundle <10MB (excluding 3D assets)
- Assets ≤8MB total; ≤2.5MB per scene compressed

Estimated Effort: 3–5 hours

Dependencies: After WP-3.2.1 profiling

PRD Alignment:
- Satisfies: NFR-1.1, NFR-1.5–1.7
- Technical specs from: §7.1.6 (Build & Deployment)
- Quality standards: Fast initial load; correct caching & compression
- Risks addressed: Slow startup; CDN misconfig

---

### WP-3.3.1: Accessibility & Responsiveness Audit

Purpose: Validate and remediate WCAG AA, keyboard navigation, screen reader, and responsive behavior.

Prerequisites:
- Phase 2 layout and components complete

Tasks:
1. Run aXe/Lighthouse; fix color contrast, label, and ARIA issues
2. Verify keyboard nav order; add focus indicators; Escape closes Advanced
   - Skip links: optional; for this demo, defer unless trivial (WCAG AA achievable without)
3. Add ARIA live regions for metric updates
4. Validate responsive layouts at: 1024×768 (min tablet), 1366×768 (common laptop), 1920×1080 (target desktop)

Outputs:
- Accessibility report; fixes merged; responsive verification notes

Validation:
- WCAG AA: pass contrast; keyboard nav works; screen reader announces sections and live metrics
- Tablet layout stacks correctly; no overlap or clipping

Estimated Effort: 4–6 hours

Dependencies: After Phase 2; before testing and deployment

PRD Alignment:
- Satisfies: NFR-2.3, NFR-3.3–3.7, §8.4
- Technical specs from: §8.1 (layout), §8.4 (accessibility)
- Quality standards: WCAG AA; ARIA correctness
- Risks addressed: A11y regressions; layout issues

---

### WP-3.4.1: Educational Content & Copy Quality Pass

Purpose: Implement minimal copy per PRD with clarity and technical credibility.

Prerequisites:
- Phase 2 UI complete

Tasks:
1. Finalize Hero headline/subheadline/CTA; wire scroll-to-demo
2. Refine tooltips (scene, voxel size, contention, SLO, advanced) with concise, accurate text
3. Footer: paper link, code link, citation
4. Ensure terminology aligns with paper (consistent branch names)

Outputs:
- Finalized copy in Hero, Tooltips, Footer

Validation:
- Copy is concise, consistent, and accurate; links work; no overflow or truncation

Estimated Effort: 2–4 hours

Dependencies: After Phase 2

PRD Alignment:
- Satisfies: FR-5.1–5.9; Content: §9.1–9.2
- Technical specs from: §9 Content Requirements
- Quality standards: Minimal but clear educational framing
- Risks addressed: Misinterpretation; over-explaining

---

### WP-3.4.2 (Optional): Comparison Charts (uPlot)

Purpose: Add lightweight charts if time permits; strictly optional and deferrable.

Prerequisites:
- Phase 2 metrics functioning; data available

Tasks:
1. Implement simple bar chart (baseline vs AGILE3D at current settings)
2. (Optional) Line chart: accuracy vs contention for current config
3. Ensure updates on control changes; minimal animations

Outputs:
- ComparisonChartComponent (optional lazy-loaded)

Validation:
- Charts update correctly; no performance impact; a11y labels present

Estimated Effort: 4–6 hours (stretch)

Dependencies: After WP-3.2.2 budgets verified

PRD Alignment:
- Satisfies: FR-4.1–4.7 (if implemented)
- Technical specs from: §7.1.3 (uPlot)
- Quality standards: Lightweight; accessible
- Risks addressed: Scope creep; performance

---

### WP-3.5.1: Comprehensive Testing & SQA Validation

Purpose: Validate functionality, performance, accessibility, and reliability with structured tests.

Prerequisites:
- Feature complete (Phase 2 + Phase 3 polish)

Tasks:
1. Author test plan from PRD acceptance criteria (Section 14)
2. Unit tests: services and components; coverage ≥70% services, ≥60% components; enforce thresholds in test config so builds fail if below targets
2b. Data accuracy validation tests:
   - Compare SimulationService outputs against hand-calculated examples from paper figures
   - Validate baseline metrics match DSVT-Voxel (Figure 11, Table 2)
   - Verify AGILE3D branch performance matches extracted data
   - Pass: All numerical values within ±1% of paper sources (allow interpolation where specified)
3. E2E checks for critical flows:
   - Scene switch timing measured via Performance API: from selector click → new scene fully rendered (state update + worker parse + geometry swap + crossfade) <500ms
   - Control response <100ms; parameter propagation viewers+metrics <200ms
   - Camera sync modes verified; fallback triggers
4. Cross-browser: latest two major versions of Chrome, Firefox, Safari, Edge (desktop); tablet check
5. Memory leak protocol:
   - Procedure: Baseline heap after load → 100 parameter changes across controls → 20 scene switches (each of 3 scenes) → record heap every 3 minutes for 15 minutes
   - Pass: Heap growth <50MB; no detached DOM nodes; no timer leaks
   - Tooling: Chrome DevTools Memory Profiler + Heap snapshots comparison
6. Error handling: Simulate WebGL unavailable and data load failures

Outputs:
- Test report (Markdown/JSON) with evidence; bug list prioritized

Validation:
- All acceptance criteria (Section 14) pass or tracked with high-priority fixes
- No critical bugs open; performance & a11y checks pass

Estimated Effort: 6–8 hours

Dependencies: After polish; before deployment

PRD Alignment:
- Satisfies: NFR-1.x, 2.x, 3.x, 4.x, 6.2; Acceptance §14
- Technical specs from: §10.2 (SQA), §13 (Success Metrics)
- Quality standards: Coverage thresholds; no critical defects
- Risks addressed: Late defects; regressions

---

### WP-3.6.1: Deployment (Vercel) & CDN Configuration

Purpose: Production deployment with compression and caching configured for performance.

Prerequisites:
- Build passing; tests green or acceptable risk

Tasks:
1. Configure Vercel project; set environment and build settings
2. Ensure brotli pre-compressed assets served with correct headers
3. Configure immutable cache for .bin and static assets; set proper TTLs
4. Set custom domain (if applicable); enable HTTPS
5. Analytics: defer to post-demo. If implemented later, prefer privacy-safe (e.g., Plausible; no cookies; DNT-respecting) and track only page views, scene selections, session duration

Outputs:
- Live production URL; deployment notes

Validation:
- Site loads <5s on target hardware; assets cached; 60fps verified in prod
- WebGL fallback message displays correctly on unsupported devices

Estimated Effort: 3–5 hours

Dependencies: After testing (WP-3.5.1)

PRD Alignment:
- Satisfies: NFR-1.1, NFR-1.6–1.7, NFR-2.5
- Technical specs from: §7.1.6 (Build & Deployment)
- Quality standards: Fast, reliable prod environment
- Risks addressed: Misconfigured caching/compression; deployment surprises

---

### WP-3.6.2: Documentation & Demo Rehearsal

Purpose: Prepare documentation and rehearse the demo end-to-end on presentation hardware.

Prerequisites:
- Production deployment ready

Tasks:
1. Update README (run, build, deploy, troubleshooting); include demo walkthrough
2. Architecture & data docs (scene config, parsing, SimulationService assumptions)
3. Backup video (manual trigger on error page):
   - Duration: 3–5 minutes; covers key features end-to-end
   - Quality: 1920×1080 @ 60fps, MP4; narration or captions
   - Hosting: Embedded in demo with fallback link
4. On-hardware test (laptop/projector) with pre-demo checklist

Outputs:
- Documentation updated; rehearsal checklist; backup video link

Validation:
- Smooth rehearsal; no surprises on hardware; presenters comfortable with flow

Estimated Effort: 3–4 hours

Dependencies: After WP-3.6.1

PRD Alignment:
- Satisfies: §17.4 Pre-Demo Checklist; NFR-4.1–4.5 (reliability)
- Technical specs from: §10 (Agent workflow), §7.1.6 (deployment)
- Quality standards: Clear docs; confident delivery
- Risks addressed: Presentation hiccups; last-minute confusion

---

## Dependencies & Suggested Sequence (Phase 3)
1) 3.1.1 Visual Polish ↔ 3.1.2 Loading States (parallel)
2) 3.2.1 3D Performance → 3.2.2 Bundles/Assets
3) 3.3.1 Accessibility & Responsiveness
4) 3.4.1 Educational Copy (parallel with 3.3.1) → 3.4.2 Charts (optional if time permits)
5) 3.5.1 Comprehensive Testing & SQA
6) 3.6.1 Deployment → 3.6.2 Documentation & Rehearsal

## Phase 3 Success Gate (Exit)
- Performance targets met in production build with caching/compression
- A11y and responsiveness validated (WCAG AA, keyboard, ARIA live metrics)
- Reliability confirmed (no crashes; fallbacks work; memory stable)
- Cross-browser verified (latest desktop browsers) and tablet layout
- Documentation complete; rehearsal successful; backup in place

## Notes
- Explicit deferrals for Phase 3:
  - Ground truth overlay toggle (FR-1.13): deferred to post-demo (Future Enhancements)
  - Analytics: deferred to post-demo; not necessary for NSF presentation
  - Skip links: not implemented (WCAG AA achievable without); may add minimal "Skip to demo" later if time permits
- Optional charts (FR-4.1–4.7) remain a stretch goal and should not jeopardize core performance or accessibility goals.
- Keep changes incremental with frequent builds on real hardware to avoid surprises.
