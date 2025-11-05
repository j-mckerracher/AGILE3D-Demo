---
tags: [planning, work-decomposition]
project: "[[01-Projects/AGILE3D-Demo]]"
plan_title: "Use Real Data"
context_budget_tokens: 6000
created: "2025-10-31"
source_plan: "[[01-Projects/AGILE3D-Demo/Planning/Use-Real-Data/plan/micro-level-plan.md]]"
---

# Work Decomposition — Use Real Data

## Overview
- Project: [[01-Projects/AGILE3D-Demo]]
- Source plan: [[01-Projects/AGILE3D-Demo/Planning/Use-Real-Data/plan/micro-level-plan.md]]
- Context budget (tokens): 6000

## Units

### Unit U01: Converter CLI — Skeleton and Args Parsing
- Goal: Establish `pkl2web.py` CLI with validated arguments and help output.
- Scope:
  - Create CLI entrypoint with argparse (input PKL, out dir, seq id, frames, downsample, quantize, branches file).
  - Stub subroutines for read/convert/emit to enable incremental build-out.
- Traceability:
  - Micro sections: ["4. Converter CLI", "12. WBS — Epic A(1)"]
- Dependencies: []
- Inputs required: sample PKL path(s), branches JSON path (to be provided)
- Files to read: `/home/josh/Code/AGILE3D-Demo/tools/converter/**` (to be discovered)
- Files to edit or create: `/home/josh/Code/AGILE3D-Demo/tools/converter/pkl2web.py`, `/home/josh/Code/AGILE3D-Demo/tools/converter/README.md`
- Acceptance criteria:
  - [ ] `python tools/converter/pkl2web.py --help` shows all flags listed in §4.
  - [ ] Invalid/missing args return non-zero with clear error.
- Test plan:
  - Unit: `/home/josh/Code/AGILE3D-Demo/tools/converter/tests/test_args.py` covers required/optional flags and error cases.
  - Manual: Run with dummy inputs; verify no filesystem writes when `--dry-run`.
- Risks/assumptions:
  - Assumes Python 3.11 environment available.
- Estimates:
  - est_impl_tokens: 1200
  - max_changes: files=2, loc=200

### Unit U02: Converter CLI — PKL Read & Schema Mapping
- Goal: Read PKL and map to internal frame/detection schema.
- Scope:
  - Implement PKL reader and minimal models for frames and detections.
  - Wire into CLI pipeline without emitting files yet.
- Traceability:
  - Micro sections: ["4. Converter CLI", "12. WBS — Epic A(2)", "16. Appendices — interfaces"]
- Dependencies: [U01]
- Inputs required: 
  - Detections PKL glob: `/home/josh/Code/AGILE3D-Demo/assets/data/model-outputs/**/det/test/*.pkl`
  - GT snippets: `/home/josh/Code/adaptive-3d-openpcdet/output/{v_1784-1982.pkl,p_7513-7711.pkl,c_7910-8108.pkl}`
  - Branch mapping JSON: `/home/josh/Code/AGILE3D-Demo/pkl_branch_map.json`
- Files to read: `/home/josh/Code/AGILE3D-Demo/tools/converter/pkl2web.py`
- Files to edit or create: `/home/josh/Code/AGILE3D-Demo/tools/converter/pkl2web.py`, `/home/josh/Code/AGILE3D-Demo/tools/converter/io/pkl_reader.py`, `/home/josh/Code/AGILE3D-Demo/tools/converter/models.py`
- Acceptance criteria:
  - [ ] Reader loads PKL and returns in-memory structures matching example interfaces.
  - [ ] Unknown fields tolerated (ignored) per additive versioning rule.
- Test plan:
  - Unit: `/home/josh/Code/AGILE3D-Demo/tools/converter/tests/test_pkl_reader.py` with fixture PKL.
  - Manual: `--dry-run` prints summary counts per frame.
- Risks/assumptions:
  - PKL schema stability; provide sample fixtures.
- Estimates:
  - est_impl_tokens: 1600
  - max_changes: files=3, loc=300

### Unit U03: Converter CLI — Downsampling and Quantization
- Goal: Implement fallback tiers and optional quantization.
- Scope:
  - Add downsample `{100k|50k}` and quantize `{off|fp16|int16}` transforms.
  - Ensure size thresholds and metadata are validated.
- Traceability:
  - Micro sections: ["4. Converter CLI", "5. Data Model", "12. WBS — Epic A(3)"]
- Dependencies: [U02]
- Inputs required: representative frames with >100k points
- Files to read: `/home/josh/Code/AGILE3D-Demo/tools/converter/models.py`
- Files to edit or create: `/home/josh/Code/AGILE3D-Demo/tools/converter/transforms/downsample.py`, `/home/josh/Code/AGILE3D-Demo/tools/converter/transforms/quantize.py`, `/home/josh/Code/AGILE3D-Demo/tools/converter/pkl2web.py`
- Acceptance criteria:
  - [ ] Output point counts respect selected tier within ±1%.
  - [ ] Quantization modes round-trip without crashes; metadata indicates mode.
- Test plan:
  - Unit: `/home/josh/Code/AGILE3D-Demo/tools/converter/tests/test_downsample.py`, `/home/josh/Code/AGILE3D-Demo/tools/converter/tests/test_quantize.py`.
  - Manual: Inspect histograms or sample points for artifacts.
- Risks/assumptions:
  - Quality vs. size trade-offs acceptable at demo scale.
- Estimates:
  - est_impl_tokens: 1800
  - max_changes: files=3, loc=300

### Unit U04: Converter CLI — Emit Frames and Manifest
- Goal: Write frames (*.bin, *.json) and `manifest.json` per contract.
- Scope:
  - Implement writers for points, detections (per-branch), and manifest schema.
  - Ensure ordering, counts, and filenames deterministic.
- Traceability:
  - Micro sections: ["4. Converter CLI", "6. API and Message Contracts", "12. WBS — Epic A(4)"]
- Dependencies: [U03]
- Inputs required: branches list, seq id, frame range
- Files to read: `/home/josh/Code/AGILE3D-Demo/tools/converter/models.py`
- Files to edit or create: `/home/josh/Code/AGILE3D-Demo/tools/converter/io/writers.py`, `/home/josh/Code/AGILE3D-Demo/tools/converter/pkl2web.py`, `/home/josh/Code/AGILE3D-Demo/tools/converter/schemas/manifest.py`
- Acceptance criteria:
  - [ ] Output tree matches plan: `frames/*.bin`, `*.gt.json`, `*.det.{branch}.json`, `manifest.json`.
  - [ ] Manifest validates against schema and includes branches.
- Test plan:
  - Unit: `/home/josh/Code/AGILE3D-Demo/tools/converter/tests/test_writers.py`, schema validation test.
  - Manual: Spot-check 3 frames for consistency and AABB ranges.
- Risks/assumptions:
  - Filesystem performance adequate; ensure incremental writes.
- Estimates:
  - est_impl_tokens: 2000
  - max_changes: files=3, loc=350

### Unit U05: Converter CLI — Validation Report & Sample Generator
- Goal: Add validation report and script to generate 10-frame sample into app assets.
- Scope:
  - Implement validators (counts, AABB, yaw sanity, ordering).
  - Provide `generate_sample.sh` to emit 10-frame sample (full and fallback tiers) into assets path.
- Traceability:
  - Micro sections: ["4. Converter CLI", "12. WBS — Epic A(5)(6)"]
- Dependencies: [U04]
- Inputs required: PKL source for v/p/c sequences, branch map JSON
- Files to read: `/home/josh/Code/AGILE3D-Demo/apps/web/src/assets/` (ensure path exists), `/home/josh/Code/AGILE3D-Demo/tools/converter/**`
- Files to edit or create: `/home/josh/Code/AGILE3D-Demo/tools/converter/validators/validators.py`, `/home/josh/Code/AGILE3D-Demo/tools/converter/generate_sample.sh`
- Acceptance criteria:
  - [ ] Validator emits pass/fail summary; non-fatal warnings allowed.
  - [ ] Running script places 10-frame sample in `/home/josh/Code/AGILE3D-Demo/apps/web/src/assets/data/streams/sample/` with manifest.
- Test plan:
  - Unit: `/home/josh/Code/AGILE3D-Demo/tools/converter/tests/test_validators.py`.
  - Manual: Run script; load manifest in browser later UoWs.
- Risks/assumptions:
  - Binary artifacts not checked into VCS; generated locally.
- Estimates:
  - est_impl_tokens: 1200
  - max_changes: files=2, loc=250

### Unit U06: Manifest Loader Service and Models (SPA)
- Goal: Implement manifest fetch and typed models.
- Scope:
  - Create `SequenceManifest`/`FrameRef` models and service to fetch/parse manifest with timeout/retries.
  - Respect TTL semantics (cache via HTTP only).
- Traceability:
  - Micro sections: ["4. Detailed Module — FrameStreamService inputs", "6. API and Message Contracts", "12. WBS — Epic B(1)"]
- Dependencies: [U05, U16]
- Inputs required: runtime-config manifestBaseUrl, sequence id
- Files to read: `/home/josh/Code/AGILE3D-Demo/apps/web/src/environments/**` (to be discovered), `/home/josh/Code/AGILE3D-Demo/apps/web/src/app/app.module.ts`
- Files to edit or create: `/home/josh/Code/AGILE3D-Demo/apps/web/src/app/shared/models/manifest.ts`, `/home/josh/Code/AGILE3D-Demo/apps/web/src/app/services/scene-data/manifest.service.ts`, `/home/josh/Code/AGILE3D-Demo/apps/web/src/app/services/scene-data/manifest.service.spec.ts`, `/home/josh/Code/AGILE3D-Demo/apps/web/src/app/app.module.ts`
- Acceptance criteria:
  - [ ] Fetch uses `manifestMs=5000` timeout and `[250,750]` retry backoff.
  - [ ] Parsed models align with §16 interfaces; invalid schema → error stream.
- Test plan:
  - Unit: spec with mock fetch and timeouts.
  - Manual: Load sample manifest from assets via `ng serve`.
- Risks/assumptions:
  - Angular HTTP client vs fetch; pick one and standardize.
- Estimates:
  - est_impl_tokens: 1800
  - max_changes: files=4, loc=300

### Unit U07: Utils-Network — Timeout/Retry and Range‑GET Check
- Goal: Provide reusable fetch helpers with timeout/retry and Range‑GET verification.
- Scope:
  - Implement `fetchWithTimeoutAndRetry` and `verifyRangeGet(url)` (HEAD+range probe).
- Traceability:
  - Micro sections: ["1. Tooling", "7. Networking", "12. WBS — Epic B(5)"]
- Dependencies: []
- Inputs required: CDN base URL
- Files to read: `/home/josh/Code/AGILE3D-Demo/libs/utils-network/**` (to be created)
- Files to edit or create: `/home/josh/Code/AGILE3D-Demo/libs/utils-network/src/lib/http.ts`, `/home/josh/Code/AGILE3D-Demo/libs/utils-network/src/lib/http.spec.ts`
- Acceptance criteria:
  - [ ] Helpers enforce 3s frame timeout and `[250,750]` backoff; abort support.
  - [ ] Range support detected and logged; failures flagged.
- Test plan:
  - Unit: mock fetch tests for timing, retries, abort.
  - Manual: Call verify against CDN sample path.
- Risks/assumptions:
  - CORS for HEAD/Range enabled as per §8.
- Estimates:
  - est_impl_tokens: 1500
  - max_changes: files=2, loc=250

### Unit U08: FrameStreamService — Cadence, Prefetch, Miss Accounting
- Goal: Implement 10 Hz playback with prefetch and miss handling.
- Scope:
  - `start/pause` control; 100 ms tick; prefetch=3; concurrency=2–3; miss on late/absent frame; auto-loop.
  - Emit `currentFrame$`, `bufferLevel$`, `errors$`, `status$`; banner event after 3 misses.
- Traceability:
  - Micro sections: ["4. FrameStreamService", "12. WBS — Epic B(2)(3)(4)"]
- Dependencies: [U06, U07]
- Inputs required: manifest URL, activeBranch, timeouts/retries
- Files to read: `/home/josh/Code/AGILE3D-Demo/apps/web/src/app/shared/models/manifest.ts`
- Files to edit or create: `/home/josh/Code/AGILE3D-Demo/apps/web/src/app/services/frame-stream/frame-stream.service.ts`, `/home/josh/Code/AGILE3D-Demo/apps/web/src/app/services/frame-stream/frame-stream.service.spec.ts`, `/home/josh/Code/AGILE3D-Demo/apps/web/src/app/app.module.ts`
- Acceptance criteria:
  - [ ] Tick jitter ≤±5 ms on average over 60 s; sustained 10 Hz.
  - [ ] After 3 consecutive misses, service pauses and emits banner event.
- Test plan:
  - Unit: scheduler and queue behavior with virtual timers; miss accounting cases.
  - Manual: Console-subscribe to observables; verify loop and pause.
- Risks/assumptions:
  - Browser timer throttling in background tabs; document visibility handling may be deferred.
- Estimates:
  - est_impl_tokens: 2400
  - max_changes: files=3, loc=350

### Unit U09: Points Parser Worker (assets-based)
- Goal: Parse `.bin` ArrayBuffer into `Float32Array` positions with metadata via an assets-served Worker.
- Scope:
  - Implement `src/assets/workers/point-cloud-worker.js`; load using `new Worker('/assets/workers/point-cloud-worker.js')`.
  - Validate buffer size; return transferable buffers and `{pointCount}`.
- Traceability:
  - Micro sections: ["4. Points Parser Worker", "12. WBS — Epic C(1)"]
- Dependencies: []
- Inputs required: sample `.bin` frames
- Files to read: `/home/josh/Code/AGILE3D-Demo/angular.json`
- Files to edit or create: `/home/josh/Code/AGILE3D-Demo/apps/web/src/assets/workers/point-cloud-worker.js`, `/home/josh/Code/AGILE3D-Demo/apps/web/src/app/workers/point-cloud-worker.spec.ts`, `/home/josh/Code/AGILE3D-Demo/angular.json`
- Acceptance criteria:
  - [ ] Angular assets include `src/assets/workers/**` so the Worker URL resolves in dev/prod builds.
  - [ ] Worker parses buffers and returns transferable `Float32Array` plus `{pointCount}`.
- Test plan:
  - Unit: spec spins up `Worker('/assets/workers/point-cloud-worker.js')` with mocked buffers; asserts counts and transfer.
  - Manual: Parse 3 sample frames; validate counts.
- Risks/assumptions:
  - Angular build serves assets at `/assets/**`; no special builder config needed.
- Estimates:
  - est_impl_tokens: 1700
  - max_changes: files=3, loc=250

### Unit U10: SceneDataService — Buffer Reuse and Filters
- Goal: Apply frames to THREE.BufferGeometry with in-place reuse and filtering.
- Scope:
  - Reallocate only on growth; support Z-up yaw; apply score and label filters.
- Traceability:
  - Micro sections: ["4. SceneDataService", "12. WBS — Epic C(2)(5)"]
- Dependencies: [U09]
- Inputs required: activeBranch id, score threshold, label mask
- Files to read: `/home/josh/Code/AGILE3D-Demo/apps/web/src/app/services/scene-data/**` (to be created)
- Files to edit or create: `/home/josh/Code/AGILE3D-Demo/apps/web/src/app/services/scene-data/scene-data.service.ts`, `/home/josh/Code/AGILE3D-Demo/apps/web/src/app/services/scene-data/scene-data.service.spec.ts`
- Acceptance criteria:
  - [ ] Geometry patches without reallocation when `pointCount` stable.
  - [ ] Filters correctly include classes vehicle/pedestrian/cyclist with default score ≥0.7.
- Test plan:
  - Unit: buffer reuse checks; filter correctness with synthetic data.
  - Manual: Toggle filters and observe bbox updates in later UoW.
- Risks/assumptions:
  - Dequantization only if header present as per spec.
- Estimates:
  - est_impl_tokens: 2200
  - max_changes: files=2, loc=300

### Unit U11: Utils-Geometry — BBox Instancing
- Goal: Implement instanced geometry for bounding boxes for baseline and active branches.
- Scope:
  - Utility to create and update instanced meshes for box arrays.
- Traceability:
  - Micro sections: ["4. Scene & Rendering — BBox instancing util", "12. WBS — Epic C(3)"]
- Dependencies: []
- Inputs required: arrays of boxes for baseline/active
- Files to read: `/home/josh/Code/AGILE3D-Demo/libs/utils-geometry/**` (to be created)
- Files to edit or create: `/home/josh/Code/AGILE3D-Demo/libs/utils-geometry/src/lib/bbox-instancing.ts`, `/home/josh/Code/AGILE3D-Demo/libs/utils-geometry/src/lib/bbox-instancing.spec.ts`
- Acceptance criteria:
  - [ ] Can render ≥500 boxes at ≥55 fps on sample data.
  - [ ] API allows per-branch color/material.
- Test plan:
  - Unit: transforms and matrix buffers; perf budget via micro-bench (approximate).
  - Manual: Render both branches in DualViewer.
- Risks/assumptions:
  - GPU capability variability; tune instance count.
- Estimates:
  - est_impl_tokens: 1800
  - max_changes: files=2, loc=250

### Unit U12: DualViewerComponent — Synchronized Views
- Goal: Render two synchronized Three.js views for baseline and active branches.
- Scope:
  - Component with shared geometry, aligned cameras, and frame sync.
- Traceability:
  - Micro sections: ["4. DualViewerComponent", "10. Testing — E2E consistency", "12. WBS — Epic C(4)"]
- Dependencies: [U10, U11, U08]
- Inputs required: sharedGeometry, baselineBoxes[], activeBoxes[]
- Files to read: `/home/josh/Code/AGILE3D-Demo/apps/web/src/app/features/dual-viewer/**` (to be created)
- Files to edit or create: `/home/josh/Code/AGILE3D-Demo/apps/web/src/app/features/dual-viewer/dual-viewer.component.ts`, `/home/josh/Code/AGILE3D-Demo/apps/web/src/app/features/dual-viewer/dual-viewer.component.html`, `/home/josh/Code/AGILE3D-Demo/apps/web/src/app/features/dual-viewer/dual-viewer.component.scss`, `/home/josh/Code/AGILE3D-Demo/apps/web/src/app/features/dual-viewer/dual-viewer.component.spec.ts`
- Acceptance criteria:
  - [ ] Both panes update the same frame id each tick; camera controls remain consistent.
  - [ ] Sample data renders ≥55 fps average on a modern laptop.
- Test plan:
  - Unit: component sync logic; mock services.
  - Manual: Visual check with sample sequence loop autoplay.
- Risks/assumptions:
  - Resize handling and DPR clamp for Safari done in style/config.
- Estimates:
  - est_impl_tokens: 2600
  - max_changes: files=4, loc=350

### Unit U13: ErrorBannerComponent — Miss Handling UX
- Goal: Display banner after 3 consecutive misses with Retry and Keep Trying.
- Scope:
  - Listen to FrameStreamService status; implement backoff retries (3 s × 5 tries).
- Traceability:
  - Micro sections: ["4. ErrorBannerComponent", "10. Testing — Integration error flows", "7. Networking — retries" ]
- Dependencies: [U08]
- Inputs required: service status stream
- Files to read: `/home/josh/Code/AGILE3D-Demo/apps/web/src/app/features/error-banner/**` (to be created)
- Files to edit or create: `/home/josh/Code/AGILE3D-Demo/apps/web/src/app/features/error-banner/error-banner.component.ts`, `/home/josh/Code/AGILE3D-Demo/apps/web/src/app/features/error-banner/error-banner.component.html`, `/home/josh/Code/AGILE3D-Demo/apps/web/src/app/features/error-banner/error-banner.component.scss`, `/home/josh/Code/AGILE3D-Demo/apps/web/src/app/features/error-banner/error-banner.component.spec.ts`
- Acceptance criteria:
  - [ ] Banner appears after 3 misses; Retry resumes; Keep Trying auto-retries 5 times with 3 s spacing.
  - [ ] Reduced-motion preference respected (no distracting animations).
- Test plan:
  - Unit: component logic with simulated service events.
  - Manual: Throttle network to induce misses and verify flows.
- Risks/assumptions:
  - Accessibility contrast and focus order verified.
- Estimates:
  - est_impl_tokens: 2000
  - max_changes: files=4, loc=300

### Unit U14: MetricsService — Client Telemetry
- Goal: Send sampled metrics to same-origin `/metrics` with throttle and opt-out.
- Scope:
  - Implement queue with retry/backoff; sample every 5 s and on error/miss; honor `?metrics=off` and config flag.
- Traceability:
  - Micro sections: ["1. Observability", "6. API Contracts — POST /metrics", "12. WBS — Epic E(1)(2)(4)"]
- Dependencies: [U16]
- Inputs required: metrics URL, sampleSec, sessionId
- Files to read: `/home/josh/Code/AGILE3D-Demo/apps/web/src/app/services/metrics/**` (to be created)
- Files to edit or create: `/home/josh/Code/AGILE3D-Demo/apps/web/src/app/services/metrics/metrics.service.ts`, `/home/josh/Code/AGILE3D-Demo/apps/web/src/app/services/metrics/metrics.service.spec.ts`
- Acceptance criteria:
  - [ ] Client throttle ≤1 event/5 s plus all errors/misses.
  - [ ] Payload matches schema; 5xx retried with backoff.
- Test plan:
  - Unit: throttle/backoff logic; schema serialization.
  - Manual: Verify network requests in dev tools.
- Risks/assumptions:
  - No PII; UA included; opt-out honored.
- Estimates:
  - est_impl_tokens: 1800
  - max_changes: files=2, loc=300

### Unit U15: Metrics Backend Stub (Dev Only)
- Goal: Provide minimal same-origin `/metrics` endpoint for local/staging.
- Scope:
  - Implement tiny HTTP server or serverless function stub that logs JSON; apply size caps (≤5 KB) and schema validation.
- Traceability:
  - Micro sections: ["6. API Contracts — POST /metrics", "8. Observability", "9. Security", "12. WBS — Epic E(3)"]
- Dependencies: []
- Inputs required: port/base URL
- Files to read: `/home/josh/Code/AGILE3D-Demo/tools/metrics-stub/**` (to be created)
- Files to edit or create: `/home/josh/Code/AGILE3D-Demo/tools/metrics-stub/server.ts`, `/home/josh/Code/AGILE3D-Demo/tools/metrics-stub/package.json`, `/home/josh/Code/AGILE3D-Demo/tools/metrics-stub/README.md`
- Acceptance criteria:
  - [ ] Dev: listens at `http://localhost:8787/metrics`; accepts valid payloads 200; rejects invalid 400; local throttle 429.
  - [ ] No credentials; CORS restricted to localhost in dev.
- Test plan:
  - Unit: minimal schema tests via supertest (if Node); or manual curl tests.
  - Manual: Observe logs and note 30-day retention guidance.
- Risks/assumptions:
  - Staging/prod may route via CloudFront→APIGW→Lambda→S3 JSONL; acceptable to skip in demo.
- Estimates:
  - est_impl_tokens: 1600
  - max_changes: files=3, loc=250

### Unit U16: ConfigModule and runtime-config.json
- Goal: Load `runtime-config.json` at boot and expose typed `get()` with defaults.
- Scope:
  - Implement module/service; merge precedence: env defaults < runtime-config.json < query flags.
- Traceability:
  - Micro sections: ["7. Configuration and Secrets"]
- Dependencies: []
- Inputs required: runtime-config.json content per plan
- Files to read: `/home/josh/Code/AGILE3D-Demo/apps/web/src/app/app.module.ts`
- Files to edit or create: `/home/josh/Code/AGILE3D-Demo/apps/web/src/app/services/config/config.module.ts`, `/home/josh/Code/AGILE3D-Demo/apps/web/src/app/services/config/config.service.ts`, `/home/josh/Code/AGILE3D-Demo/apps/web/src/assets/runtime-config.json`, `/home/josh/Code/AGILE3D-Demo/apps/web/src/app/services/config/config.service.spec.ts`
- Acceptance criteria:
  - [ ] Values reflect precedence; query `?metrics=off` disables MetricsService.
  - [ ] runtime-config.json includes: manifestBaseUrl, sequences [v_1784_1828,p_7513_7557,c_7910_7954], branches ["DSVT_Voxel","CP_Pillar_032","CP_Pillar_048","CP_Voxel_024","DSVT_Voxel_016"], timeouts/retries/prefetch/concurrency, scoreDefault=0.7, labelsDefault, metrics.
  - [ ] Baseline branch default is `DSVT_Voxel`; Active selectable set aligns with config.
- Test plan:
  - Unit: precedence tests and typing.
  - Manual: Toggle flags at runtime and confirm effect.
- Risks/assumptions:
  - Asset served with app; cache-busting handled by build.
- Estimates:
  - est_impl_tokens: 2000
  - max_changes: files=4, loc=300

### Unit U17: Upload Scripts for Sequences (AWS S3 + CloudFront)
- Goal: Provide cross-platform scripts to upload sequences with correct headers and invalidate manifests.
- Scope:
  - Implement `upload_sequences.sh` and `upload_sequences.ps1` using awscli v2.
  - Frames: `aws s3 sync sequences/ s3://<BUCKET>/sequences --cache-control "public,max-age=31536000,immutable"`.
  - Manifests: set `max-age=300`; CloudFront invalidation for `"/sequences/*" "/**/manifest.json"`.
- Traceability:
  - Micro sections: ["8. Delivery", "12. WBS — Epic F(4)", "16. Appendices — CDN headers"]
- Dependencies: [U04]
- Inputs required: STAGING_BUCKET, PROD_BUCKET, CLOUDFRONT_DISTRIBUTION_ID (env vars)
- Files to read: `/home/josh/Code/AGILE3D-Demo/tools/scripts/**` (to be created)
- Files to edit or create: `/home/josh/Code/AGILE3D-Demo/tools/scripts/upload_sequences.sh`, `/home/josh/Code/AGILE3D-Demo/tools/scripts/upload_sequences.ps1`
- Acceptance criteria:
  - [ ] Frames uploaded with 1-year immutable cache; manifests uploaded with 300 s TTL.
  - [ ] Invalidation command executed for the distribution ID provided.
  - [ ] No credentials in repo; scripts read from env.
- Test plan:
  - Manual: Dry-run (echo commands) then stage to STAGING_BUCKET; verify headers via `aws s3api head-object`.
- Risks/assumptions:
  - IAM permissions configured externally.
- Estimates:
  - est_impl_tokens: 1200
  - max_changes: files=2, loc=200

### Unit U18: CDN/CORS Config Templates (CloudFront + S3)
- Goal: Provide template config files documenting headers, CORS, and TTL.
- Scope:
  - Author `infra/cdn/headers.json` and README with examples from plan for S3 + CloudFront.
- Traceability:
  - Micro sections: ["8. Delivery", "9. Security and Privacy Controls", "16. Appendices — CDN headers", "12. WBS — Epic F(1)(2)(3)"]
- Dependencies: []
- Inputs required: Prod/Staging domains, distribution IDs
- Files to read: `/home/josh/Code/AGILE3D-Demo/infra/cdn/**` (to be created)
- Files to edit or create: `/home/josh/Code/AGILE3D-Demo/infra/cdn/headers.json`, `/home/josh/Code/AGILE3D-Demo/infra/cdn/README.md`
- Acceptance criteria:
  - [ ] Templates include: Cache-Control 1y immutable for `*.bin`, 300 s for `*.json` manifests; Accept-Ranges exposed.
  - [ ] CORS Allow-Origin for staging/prod domains and `http://localhost:4200`; methods GET,HEAD,OPTIONS; expose `Accept-Ranges,Content-Length,Content-Range`.
  - [ ] Document signed URL toggle when (>1k req/min OR >75 GB/day).
- Test plan:
  - Manual: Validate headers via curl against staged objects; document steps.
- Risks/assumptions:
  - IaC implementation deferred.
- Estimates:
  - est_impl_tokens: 900
  - max_changes: files=2, loc=150

### Unit U19: E2E Tests — Basic Streaming and UX
- Goal: Add Playwright tests for autoplay loop, dual-view consistency, and error banner.
- Scope:
  - Write spec to load sample, verify both panes same frame id, toggle filters, and induce misses.
- Traceability:
  - Micro sections: ["10. Testing Strategy — E2E", "12. WBS — Epic G(2)"]
- Dependencies: [U12, U13, U06, U08]
- Inputs required: Playwright config, sample sequence
- Files to read: `/home/josh/Code/AGILE3D-Demo/apps/web/e2e/**` (to be discovered)
- Files to edit or create: `/home/josh/Code/AGILE3D-Demo/apps/web/e2e/tests/streaming.spec.ts`
- Acceptance criteria:
  - [ ] Test passes locally and in CI shard; asserts autoplay loop and banner flow.
  - [ ] Filters update bbox counts as expected.
- Test plan:
  - Unit: n/a; E2E only.
  - Manual: Visual review of recorded trace.
- Risks/assumptions:
  - Stability of timers in headless mode.
- Estimates:
  - est_impl_tokens: 1600
  - max_changes: files=1, loc=200

### Unit U20: Performance Soak Harness
- Goal: Implement a 15-min soak test to validate perf/memory budgets.
- Scope:
  - Add Playwright or harness script to measure fps, drops, mem growth, fetch p95 latency.
- Traceability:
  - Micro sections: ["6. NFRs", "10. Testing — Performance/Soak", "12. WBS — Epic G(3)"]
- Dependencies: [U12, U08]
- Inputs required: sample or CDN-hosted sequence
- Files to read: `/home/josh/Code/AGILE3D-Demo/apps/web/e2e/tests/**` (to be created)
- Files to edit or create: `/home/josh/Code/AGILE3D-Demo/apps/web/e2e/tests/soak.spec.ts`
- Acceptance criteria:
  - [ ] Over 15 min: mem growth <50 MB; frame drops <0.5%; avg render ≥55 fps; p95 fetch ≤150 ms.
- Test plan:
  - E2E: collect metrics via JS APIs and network timing.
  - Manual: Compare against acceptance thresholds.
- Risks/assumptions:
  - Machine variability; document baseline hardware.
- Estimates:
  - est_impl_tokens: 1400
  - max_changes: files=1, loc=200

### Unit U21: Safari Acceptance Profile
- Goal: Add Safari-profile run enforcing ≤50k pts and DPR clamp 1.5.
- Scope:
  - Configure E2E/browser flags and CSS media handling for reduced DPR on Safari.
- Traceability:
  - Micro sections: ["6. NFRs — Safari limits", "10. Testing — E2E Safari"]
- Dependencies: [U12]
- Inputs required: Playwright/WebKit config
- Files to read: `/home/josh/Code/AGILE3D-Demo/apps/web/e2e/**` (to be discovered)
- Files to edit or create: `/home/josh/Code/AGILE3D-Demo/apps/web/e2e/playwright.safari.config.ts`, `/home/josh/Code/AGILE3D-Demo/apps/web/src/styles.scss` (DPR clamp rule)
- Acceptance criteria:
  - [ ] Safari run uses ≤50k tier; visual fidelity acceptable; no crashes.
  - [ ] DPR capped at 1.5 via CSS/JS and verified by window.devicePixelRatio checks.
- Test plan:
  - E2E: dedicated job uses Safari profile against sample.
  - Manual: Inspect rendering and performance.
- Risks/assumptions:
  - WebKit headless availability and stability.
- Estimates:
  - est_impl_tokens: 1200
  - max_changes: files=2, loc=150

## Open Questions
- None.

> [!tip] Persistence
> Write this note to: 01-Projects/<Project-Name>/Planning/Work-Decomposer-Output.md
> Overwrite if the file already exists.
