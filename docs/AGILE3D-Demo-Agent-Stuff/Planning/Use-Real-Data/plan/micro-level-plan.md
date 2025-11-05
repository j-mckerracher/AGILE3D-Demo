# Micro-Level Plan — Use Real Data

Session Inputs Summary
- Approved meso-level: Angular SPA streaming real LiDAR at fixed 10 Hz; side-by-side {Baseline_Branch}=DSVT_Voxel vs selectable {Active_Branch}∈{CP_Pillar_032, CP_Pillar_048, CP_Voxel_024, optional DSVT_Voxel_016}; autoplay, loop, no seek UI; score≥0.7 default; classes vehicle/pedestrian/cyclist enabled.
- Sequences: v_1784–1828, p_7513–7557, c_7910–7954; each with full (≤100k pts) and fallback (≤50k pts) tiers.
- NFRs: first frame ≤2 s (incl. Safari with ≤50k pts, DPR≤1.5); smooth 10 Hz; render ~60 fps; ≤16 ms per-frame budget; memory ≤350 MB (Chrome/Edge/Firefox), ≤250 MB (Safari); <0.5% frame errors; pause after 3 misses.
- Networking: manifest timeout 5s; frame timeout 3s; retries=2 with 250 ms and 750 ms backoff; prefetch=3; concurrency=2–3; “miss” includes late arrival.
- Delivery: {Object_Storage}+{CDN}; frames immutable 1 year; manifest TTL 300 s; Range‑GET enabled.
- Security/Ops: unsigned by default; prod-only signed URL manual toggle if (>1k req/min OR >75 GB/day); staging public; CORS restricted to {Prod_Domain}, {Staging_Domain}, and http://localhost:4200; no credentials.
- Observability: same-origin POST /metrics; JSON payload {ts, sessionId, seqId, frameId, event, bytes, latencyMs, fps, buffer, misses, ua}; sample 1/5 s + every error/miss; 30-day retention; opt-out via ?metrics=off.
- Traffic: Low (~50 concurrent sessions).

Open Questions and Blocked Decisions
- None critical. Provisional pins below can be adjusted to team standards with negligible impact.

---

1. Technology Stack and Version Pins
- Languages/Frameworks
  1) {Web_Framework}=Angular 17.x (mandated), TypeScript 5.6.x
  2) {3D_Engine}=Three.js r16x
  3) {Primary_Runtime}=Node.js 20 LTS (Proposed pin); Alt: Node 18 LTS (trade-off: older, wider CI images)
  4) Converter: Python 3.11.x (Alt: 3.10/3.12)
- Tooling
  - Package manager: pnpm 9.x (Alt: npm 10.x, yarn 1.x); pick pnpm for speed/dedupe
  - Lint/Format: ESLint (angular-eslint) + Prettier; Stylelint for CSS (optional)
  - Unit test: Jest 29.x + ts-jest (Alt: Karma/Jasmine; trade-off: slower)
  - E2E/Perf: Playwright 1.x
  - Type checking: tsc strict
  - Git hooks: Husky + lint-staged
  - Static analysis: TypeScript ESLint rules, dep audit ({Supply_Chain_Scanner_Option_A|B})
- Deprecation/Upgrade Policy
  - Minor updates monthly; lockfiles committed; renovate-enabled (if allowed)
  - Three.js pinned to r16x for stability; review quarterly

2. Repository Structure and Conventions
```
{repo_root}/
  apps/
    web/                         # Angular SPA
      src/app/
        features/dual-viewer/
        features/error-banner/
        services/frame-stream/
        services/scene-data/
        services/metrics/
        services/config/
        workers/points-parser/    # worker source (bundled)
        shared/models/
      src/assets/data/streams/sample/   # tiny local sample (10 frames)
      environments/
  libs/
    utils-geometry/
    utils-network/
  tools/
    converter/pkl2web.py
    scripts/upload_sequences.{sh|ps1}
  infra/
    cdn/                         # headers, CORS, cache policies (IaC optional)
  docs/
    Planning/
```
- Naming: kebab-case directories; PascalCase components; camelCase services
- Code style: Angular style guide; strict TS
- Documentation: apps/web/README.md; ADRs in docs/ADR
- Commit conv: Conventional Commits (feat:, fix:, docs:, chore:), semantic versioning for manifests

3. Build, Dependency, and Environment Setup
- Prereqs: Node 20 LTS, pnpm 9.x, Python 3.11, {Cloud_CLI_Option} for uploads
- Bootstrap
  - pnpm install
  - pnpm run prepare (husky)
  - Create apps/web/src/assets/data/streams/sample per provided sample
- Scripts (package.json)
  - build: pnpm -w ng build
  - start: pnpm -w ng serve
  - test: jest
  - e2e: playwright test
  - lint: eslint "**/*.{ts,js}"
  - format: prettier --write .
  - typecheck: tsc -p tsconfig.json --noEmit
- Lockfile: commit pnpm-lock.yaml; CI uses pnpm fetch + store-dir cache

4. Detailed Module/Component Specifications
- FrameStreamService
  - Purpose: fixed 10 Hz playback controller with prefetch=3, concurrency=2–3, cancellation and miss accounting
  - Inputs: manifest URL, activeBranch, timeouts/retries
  - Outputs: currentFrame$ (FrameRef), bufferLevel$, errors$, status$
  - Behavior: start() begins cadence; pause() stops; automatic loop; on 3 misses → pause and emit banner event
  - Pseudocode
```
class FrameStreamService {
  start(manifestUrl) { loadManifest(); frameIdx=0; scheduleTick(100ms); }
  tick() {
    while (prefetchQueue.size < 3 && inflight < 3) fetchNext();
    if (deadlinePassedFor(frameIdx) && !hasReady(frameIdx)) registerMiss();
    if (ready(frameIdx)) emitFrame(frameIdx++);
  }
  fetchNext() {
    const ctl = new AbortController(); inflight++;
    fetch(pointsUrl, {signal: ctl}).timeout(3000).retry([250,750]);
    fetch(detUrl, {signal: ctl}).timeout(3000).retry([250,750]);
    settle → cache.add(frameId); inflight--;
  }
}
```
- SceneDataService
  - Purpose: load/parse points in Worker, patch THREE.BufferAttribute in-place, deserialize detections, filter by score/labels
  - API: setActiveBranch(id), setScoreThreshold(n), setLabelMask(mask), applyFrame(FrameData)
  - Edge cases: handle varying point counts (realloc only when needed); Z-up yaw; dequantize if header present
- Points Parser Worker
  - Input: ArrayBuffer (.bin), optional small JSON header
  - Output: Float32Array positions; metadata {pointCount}
  - Validate size thresholds; return transferable buffers
- DualViewerComponent
  - Props: sharedGeometry, baselineBoxes[], activeBoxes[]; renders two synchronized views
  - Ensures consistent camera controls and frame alignment
- ErrorBannerComponent
  - Listens to service status; after 3 consecutive misses shows banner with Retry and Keep Trying (auto-retry 3 s ×5)
- MetricsService
  - Sampling: every 5 s and on error/miss; POST /metrics; queue with retry/backoff; opt-out flag
- ConfigModule
  - Loads runtime-config.json at boot; exposes typed get() with defaults
- Converter CLI (tools/converter/pkl2web.py)
  - CLI args: --input-pkl, --out-dir, --seq-id, --frames start:end, --downsample {100k|50k}, --quantize {off|fp16|int16}, --branches file.json
  - Emits: frames/*.bin, *.gt.json, *.det.{branch}.json, manifest.json
  - Validation: counts, AABB ranges, yaw sanity, ordering

5. Data Model and Persistence
- No DB; client memory only (sliding window ≤3 frames)
- Metrics sink: append-only logs in {Log_Store_Option} with 30-day retention
- Caching: CDN immutable for frames; client no IndexedDB v1; manifest cache per HTTP TTL (300 s)

6. API and Message Contracts
- POST {Base_URL}/metrics
  - Request JSON
```
{
  "ts": number, "sessionId": string, "seqId": string, "frameId": string,
  "event": "heartbeat"|"error"|"miss"|"play"|"pause",
  "bytes": number, "latencyMs": number, "fps": number, "buffer": number, "misses": number, "ua": string
}
```
  - Responses: 200 OK; 400 on schema error; 429 local throttle; 5xx retriable
  - Versioning: additive fields; server ignores unknowns
  - Rate limits: client throttle ≤1 event/5 s plus errors; server may enforce 10 rps/IP

7. Configuration and Secrets
- runtime-config.json (served with app)
```
{
  "manifestBaseUrl": "{CDN_Base}/sequences/",
  "sequences": ["v_1784_1828","p_7513_7557","c_7910_7954"],
  "branches": ["DSVT_Voxel","CP_Pillar_032","CP_Pillar_048","CP_Voxel_024","DSVT_Voxel_016"],
  "timeouts": {"manifestMs": 5000, "frameMs": 3000},
  "retries": [250,750],
  "prefetch": 3, "concurrency": 3,
  "scoreDefault": 0.7, "labelsDefault": ["vehicle","pedestrian","cyclist"],
  "metrics": {"enabled": true, "url": "/metrics", "sampleSec": 5}
}
```
- Precedence: env.ts defaults < runtime-config.json < query flags (?metrics=off)
- Secrets: none client-side; serverless metrics uses IAM/role-based write; no tokens exposed to clients

8. Observability and Operational Readiness
- Structured log shape (client): {ts, sessionId, level, event, seqId, frameId, msg, context}
- Levels: info (heartbeat), warn (retry), error (miss/pause)
- Correlation: sessionId UUIDv4; include user agent and page URL (no PII)
- Dashboards: throughput, avg/p95 latency, miss rate, bytes, cache hit ratio (from CDN logs)
- Alerts: egress >75 GB/day, req/min >1k, miss rate >1%, 1st-frame p95 >2 s

9. Security and Privacy Controls
- CORS as specified; credentials disabled
- Input validation on /metrics; size caps (≤5 KB payload); content-type application/json
- Least privilege roles on {Object_Storage}, {CDN_Config}, {Logs}
- Supply chain: lockfiles, {Supply_Chain_Scanner} in CI; disallow postinstall scripts
- No PII; telemetry opt-out honored; redact UA if policy changes

10. Testing Strategy and Plan
- Unit (70%+ coverage target overall)
  - FrameStreamService: cadence, prefetch queue, miss accounting
  - SceneDataService: buffer patching, variable point counts, filters
  - Worker: parser for Float32 and quantized headers
  - Converter: schema mapping, downsampling correctness
- Integration
  - Manifest load → first frame within 2 s; parallel fetch and apply
  - Error banner after 3 consecutive misses; Retry and Keep Trying flows
- E2E (Playwright)
  - Autoplay loop stability; side-by-side consistency; filters update bboxes
  - Safari profile: enforce ≤50k pts, DPR clamp 1.5
- Performance/Soak
  - 15-min soak: mem growth <50 MB; frame drops <0.5%; avg render ≥55 fps; p95 fetch latency ≤150 ms
- CI Partitioning: unit parallel shards; e2e nightly + pre-release

11. SKIP

12. Work Breakdown Structure (WBS)
- Epic A: Converter CLI
  1) CLI skeleton & args parsing; 2) PKL read & schema map; 3) Downsample/fallback; 4) Emit manifest/frames; 5) Validation report; 6) Sample sequence (10 frames)
- Epic B: Streaming Core
  1) Manifest loader; 2) FrameStreamService cadence + queue; 3) AbortController & retries; 4) Miss accounting + events; 5) Range‑GET verify
- Epic C: Scene & Rendering
  1) Worker parser; 2) BufferAttribute reuse path; 3) BBox instancing util; 4) DualViewer wiring; 5) Label/score filters
- Epic D: UX & Error Handling
  1) Autoplay/loop; 2) ErrorBanner with controls; 3) Reduced-motion handling; 4) Empty/error states
- Epic E: Telemetry
  1) MetricsService; 2) Schema + client throttle; 3) /metrics backend stub; 4) Sampling & opt-out
- Epic F: Infra & Delivery
  1) CDN headers/CORS/TTL; 2) Public-read baseline; 3) Signed-URL toggle; 4) Upload scripts; 5) CI manual pipeline
- Epic G: QA & Soak
  1) Unit/integration suite; 2) E2E scenarios; 3) Soak harness; 4) Safari acceptance checklist
- Sequencing/Critical Path: A→B→C→D/E→F→G; parallelize B and A after manifest schema frozen
- Entry/Exit Criteria per epic: defined by NFR targets and acceptance in section 10

13. SKIP

14. Risks, Assumptions, and Open Questions (Micro-Level)
- Risks: axis/yaw mismatch (mitigation: 10-frame sanity + signoff); payload spikes (drop/skip with log); Safari limits (≤50k & DPR clamp); egress surge (alarms + signed URL toggle)
- Assumptions: Node 20 LTS & pnpm OK; Jest + Playwright acceptable; serverless metrics available same-origin
- Open: none

15. Definition of Done (Micro Level)
- Code: typed TS, ESLint/Prettier clean, no console errors
- Tests: unit/integration passing; e2e basic pass; coverage ≥70%
- Perf: first frame ≤2 s; avg render ≥55 fps; p95 fetch ≤150 ms; soak mem growth <50 MB/15 min
- Security: CORS as specified; no PII; dependency scan clean
- Observability: /metrics emitting with sampling and opt-out; dashboards populated
- Delivery: built SPA deployed to staging; sequences uploaded; CDN headers and CORS validated; rollback tested
- Signoffs: yaw/axis, licensing, CDN/CORS, final demo acceptance

16. Appendices
- Example TypeScript interfaces
```
export interface FrameRef { id: string; ts?: number; pointCount?: number; urls:{points:string; gt?:string; det?:Record<string,string>}; }
export interface SequenceManifest { version:string; sequenceId:string; fps:number; classMap:Record<string,string>; branches:string[]; frames:FrameRef[]; }
```
- Example package.json scripts
```
{
  "scripts": {
    "start": "ng serve",
    "build": "ng build",
    "test": "jest",
    "e2e": "playwright test",
    "lint": "eslint \"**/*.{ts,js}\"",
    "format": "prettier --write .",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  }
}
```
- Example CDN headers
```
/sequences/*.bin  → Cache-Control: public, max-age=31536000, immutable
/sequences/*.json → Cache-Control: public, max-age=300
CORS: Allow-Origin {Prod|Staging|http://localhost:4200}; Methods GET,HEAD,OPTIONS; Allow-Headers Accept,Range,Content-Type; Expose Accept-Ranges,Content-Length,Content-Range; Max-Age 86400
```
