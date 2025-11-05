# Meso-Level Plan — Use Real Data

Open Questions and Blocked Decisions
- None — traffic classified as Low (~50 concurrent sessions).

Received Inputs Summary (from Macro-Level Plan)
- Scope: Fixed 10 Hz playback of curated LiDAR sequences; side-by-side {Baseline_Branch}=DSVT_Voxel vs selectable {Active_Branch}∈{CP_Pillar_032, CP_Pillar_048, CP_Voxel_024, optional DSVT_Voxel_016}; UI defaults: score≥0.7, all classes enabled; autoplay, loop, no seek UI.
- Sequences: v_1784–1828 (vehicles/highway), p_7513–7557 (pedestrians/sidewalk), c_7910–7954 (mixed intersection); both tiers per sequence: full ≤100k points and fallback ≤50k points.
- NFRs: first frame ≤2 s (incl. Safari with ≤50k points, DPR≤1.5); render loop ~60 fps; smooth 10 Hz updates; ≤16 ms/frame budget; memory ≤350 MB (Chrome/Edge/Firefox), ≤250 MB (Safari); error rate <0.5%; pause after 3 consecutive “misses”.
- Traffic: Low (~50 concurrent sessions).
- Platform: Angular + TypeScript (mandated), Three.js; object storage + CDN for sequences; serverless POST /metrics; CORS restricted to {Prod_Domain}, {Staging_Domain}, and localhost:4200.
- Networking: timeouts/retries: manifest 5s, frames 3s, 2 retries (250ms, 750ms); prefetch window=3; concurrency=2–3; Range‑GET enabled at CDN.
- Security/Ops: unsigned URLs by default; prod-only signed URL toggle if (>1k req/min OR >75 GB/day); staging public; manifests TTL 300s; frames immutable 1 year; quantization OFF by default (enable per-sequence after validation); .bin br OFF by default (enable if size↓≥10% and p95 decode overhead <5 ms without stutter).
- Observability: same-origin POST /metrics with {ts, sessionId, seqId, frameId, event, bytes, latencyMs, fps, buffer, misses, ua}; sample 1/5s + every error/miss; 30‑day retention; opt‑out via ?metrics=off.

---

1. Architecture Overview and Rationale
- Pattern: Client–CDN architecture with a static Angular SPA, object storage-backed content served via {CDN}, minimal serverless metrics endpoint, and an offline data conversion pipeline.
  - Justification: Meets low-ops, fast global delivery, and cost targets; aligns with NFRs for first-frame latency, smooth playback at 10 Hz, and availability (99.9%) while avoiding heavyweight backend complexity.
- Supporting patterns:
  - Modular front-end (feature and service modules) with a dedicated streaming controller (pull-based prefetch at fixed cadence) and worker-based parsing.
  - Backpressure and cancellation via AbortController; immutable asset caching for frames; short-TTL manifests for agility.
- Alternatives and trade-offs:
  - Full backend API (microservices) vs static + minimal serverless: microservices add flexibility (auth, per-user control) but increase latency, cost, and complexity; chosen approach minimizes TTFB and ops.
  - Edge compute (e.g., functions at edge) for per-request transformation vs prebuilt artifacts: prebuilt artifacts ensure determinism and better CDN cacheability; edge processing adds cost and variability.
- Alignment to Macro Goals/NFRs: Avoids server bottlenecks; leverages CDN for ≥90% cache hits; supports 10 Hz updates with small prefetch and strict memory ceilings; observability via /metrics.

2. System Decomposition
- Tools/Offline
  - Converter CLI ({Converter_Runtime}=Python): pkl2web to emit frames/*.bin, *.gt.json, *.det.{branch}.json, manifest.json; includes validation report.
- Storage & Delivery
  - {Object_Storage}: sequences/{sequenceId}/frames and manifest.json; policies: immutable binaries, short-TTL JSON.
  - {CDN}: distribution over {CDN_Domain_Prod|CDN_Domain_Staging}; behaviors for cache headers, CORS, optional signed URLs (prod toggle).
- Web Client (Angular)
  - FrameStreamService: cadence controller (10 Hz), prefetch window=3, concurrency=2–3, cancel on loop boundary; emits currentFrame$.
  - SceneDataService: fetch/parse points (worker); patch-only BufferAttribute reuse; detection deserializer; score/label filters; Z-up yaw handling.
  - DualViewerComponent: renders baseline vs active; reads shared point geometry + per-branch detections.
  - ErrorBannerComponent: shows/pause after 3 misses; retry and auto-retry (every 3 s up to 5x).
  - MetricsService: samples telemetry (1/5s + errors) to POST /metrics; respectful of opt-out.
  - ConfigModule: env manifests base URL, branches, CORS domains; feature flags (quantization/compression per-sequence).
- Metrics API ({Serverless} behind {APIGateway|Edge_Router})
  - POST /metrics: validate payload, enrich with server timestamp and UA; write JSONL to {Log_Store|Object_Store}; 30‑day retention.
- Communications
  - Client→CDN: HTTPS GET (manifest/frames/JSON); Client→Metrics: HTTPS POST; all sync request/response. No pub/sub.
- C4 (Context)
```mermaid
flowchart LR
  User[Reviewer/Stakeholder] -->|Browser| SPA[Angular SPA]
  SPA -->|GET frames/manifest| CDN[{CDN}]
  CDN -->|Fetch-once| Storage[Object Storage]
  SPA -->|POST /metrics| MetricsAPI[Serverless Metrics API]
```
- C4 (Container)
```mermaid
flowchart LR
  subgraph Client
    A[Angular App]
    W[Web Worker: Points Parser]
  end
  subgraph Delivery
    C[{CDN}]
    S[(Object Storage)]
  end
  subgraph Telemetry
    G[API Gateway]
    L[(Logs/Object Store)]
    F[(Function Handler)]
  end
  A-->W
  A--GET-->C
  C--Cache miss-->S
  A--POST /metrics-->G--invoke-->F--append-->L
```

3. Data and Interface Design
- Domain Entities
  - SequenceManifest: {version, sequenceId, fps=10, classMap, branches[], frames[]}
  - FrameRef: {id, ts?, pointCount?, urls:{points, gt?, det?:Record<branchId,string>}}
  - Detection JSON (per-branch, per-frame): {boxes:[{x,y,z,dx,dy,dz,heading,score,label}]}
  - GT JSON (per-frame): {boxes:[{x,y,z,dx,dy,dz,heading,label}]}
  - Points Binary (.bin): Float32 [x,y,z]; optional quantization header when enabled.
- Contracts and Versioning
  - Manifest version field (semver); backward-compatible additions only; client guards unknown fields.
  - Branch IDs are strings and must match manifest.branches; classMap is authoritative for UI labels.
- Client Interfaces (TypeScript)
  - FrameStreamService API: start(), pause(), onFrame$, errors$, bufferLevel$.
  - SceneDataService API: loadManifest(url), setActiveBranch(id), setScoreThreshold(t), setLabelMask(mask), consumeFrame(frameRef).
  - MetricsService API: emit(event: TelemetryEvent), setOptOut(flag).
- Metrics API
  - Endpoint: same origin {Base_URL}/metrics
  - Method: POST, JSON; 200 OK on accept; 4xx on validation error; 429 on local rate-limit; 5xx retriable with backoff.
  - Payload: {ts, sessionId, seqId, frameId, event, bytes, latencyMs, fps, buffer, misses, ua}
  - Auth: none (demo); CORS restricted; WAF/ACLs at {CDN}/{APIGateway}.
- Caching & Indexing
  - CDN immutable caching for frames (.bin/.json det/gt); short-TTL manifests (300 s) to allow updates.
  - Client retains a sliding window (≤prefetch) in memory; no IndexedDB v1.
- Lifecycle/Retention
  - Sequences persisted in object storage (curated, small); metrics retained 30 days; manifests revocable via prefix switch and CDN invalidation.
- Error Semantics
  - “Miss” = non‑2xx/3xx, network error, timeout, or late arrival after display slot; after 3 consecutive, auto-pause + banner.
- Key Sequences
```mermaid
sequenceDiagram
  participant U as User
  participant A as Angular App
  participant C as CDN
  participant S as Object Storage
  participant M as Metrics API
  U->>A: Select Scenario (autoplay)
  A->>C: GET manifest.json (5s timeout)
  C-->>A: 200 manifest
  loop Prefetch (3 frames)
    A->>C: GET frame(N).bin (3s timeout)
    C-->>A: 200 bin (or miss)
    A->>C: GET frame(N).det.active.json
    C-->>A: 200 json (or miss)
    A->>M: POST metrics (sample)
  end
  A->>A: Patch BufferAttribute; render
  alt 3 consecutive misses
    A->>A: Pause playback
    A->>U: Show banner (Retry/Keep Trying)
  end
```

4. Technology Choices and Rationale
- Client
  - Mandated: {Web_Framework}=Angular + TypeScript; {3D_Engine}=Three.js.
  - Alternatives (not selected): React + Three.js (ecosystem breadth), Angular + Babylon.js (engine features); rejected due to mandate and existing code reuse.
- Metrics Backend
  - Option A (Recommended): {APIGateway} + {Serverless_Function} + {Log_Store} — minimal ops, auto-scale, low cost, native IAM.
  - Option B: {Edge_Function} (e.g., {FunctionsAtEdge}) — closer to user, but log aggregation and schema mgmt more complex.
  - Option C: {Container_Runtime} with {Node_Runtime} — more control, higher ops overhead, not needed for demo scale.
- Storage/CDN
  - Mandated: {Object_Storage} + {CDN}; alternatives (not selected): {Alt_Object_Storage}+{Alt_CDN}.
- Compression/Quantization
  - Default OFF (per Macro); enable per-sequence when benefit criteria met; client supports both via small header.
- Concurrency/Prefetch
  - Fixed cadence (10 Hz), prefetch=3, concurrency=2–3 for deterministic memory and bandwidth.

5. Integration Points
- {CDN} and {Object_Storage}
  - Protocol: HTTPS GET; CORS: Allow-Origin={Prod_Domain|Staging_Domain|http://localhost:4200}; Methods GET/HEAD/OPTIONS; Allow-Headers Accept, Range, Content-Type; Expose Accept-Ranges, Content-Length, Content-Range; Max-Age=86400.
  - Range‑GET enabled; client does not require ranges but benefits for partial retries.
  - Signed URLs: prod-only manual toggle when thresholds exceeded; staging remains public.
- Metrics API
  - Protocol: HTTPS POST JSON; Same-origin preferred; retry with backoff on 5xx/network; dedupe via (sessionId, seqId, frameId, event, ts).
  - Quotas/SLAs: best-effort; backpressure via sampling and client-side throttle.
- CI/CD
  - Manual upload initially; future on-tag→staging with manual promotion and CDN invalidation; manifest prefix rollback (vN→vN-1).

6. Deployment and Runtime Architecture
- Environments: dev (localhost), staging, prod.
- Configuration: Angular environment files and runtime-config JSON for {Manifest_Base_URL}, branches, CORS domains, and feature flags.
- Packaging/Deploy
  - SPA: built artifacts to {Static_Hosting}; assets under /assets (workers, local samples).
  - Sequences: uploaded to {Object_Storage} under sequences/{sequenceId}; immutable frames; manifests with TTL 300 s.
  - Metrics: deploy {Serverless_Function} with schema validation and logging; retention 30 days.
- Release Strategy: staging smoke tests → manual promotion to prod; CDN invalidations for manifest updates; no blue/green needed for SPA.
- Observability
  - Client metrics (/metrics), browser console (dev), optional RUM dashboard.
  - CDN logs and origin access logs; alarms on egress (>75 GB/day) and req/min (>1k) to trigger signed URLs.
  - Error budgets: <0.5% frame errors; 99.9% availability target.

7. Non-Functional Requirements Mapping
- Performance: immutable CDN caching for frames; short-TTL manifests; worker parsing and buffer reuse; fixed 10 Hz cadence; ≤16 ms/frame budget guarded by no re-allocation and instancing.
- Scalability: CDN edge distribution; stateless SPA; serverless metrics auto-scales; concurrency limited client-side (2–3) to bound impact.
- Availability: static hosting + CDN (high), minimal moving parts; retry/backoff; pause-after-3-misses behavior.
- Reliability: strict timeouts; miss semantics; deterministic prefetch window; loop reset behavior.
- Security/Privacy: CORS restricted; no credentials; optional signed URLs (prod toggle); no PII in metrics; WAF/ACLs.
- Accessibility: focus outlines; honors prefers-reduced-motion; simplified controls (no seek) and autoplay banner handling.
- Internationalization: English only (explicit); no i18n infra required v1.
- Maintainability: modular Angular services/components; ADRs; typed manifest/JSON schemas; per-sequence feature flags.
- Operability: simple CI/manual promote; observable metrics; clear rollback via manifest prefix and CDN invalidation.

8. Risks, Assumptions, and Open Questions
- Risks
  - Coordinate/yaw mismatch: Mitigate via 10-frame sanity check and explicit signoff pre-conversion.
  - Payload spikes: Downsample or skip>100k pts or >3 MB/bin; log action.
  - Memory growth: Soak test 15 min; cap prefetch; reuse buffers; alert if >50 MB growth.
  - Egress surges: Alarms; rate-limit; enable signed URLs (prod) as needed.
  - Safari limitations: Enforce ≤50k pts and DPR clamp; disable heavy features.
- Assumptions
  - 10 Hz fixed; no seek UI; autoplay and loop; metrics opt-out respected.
  - Same-origin /metrics available in staging/prod.
- Open Questions (blocked decisions)
  - Traffic classification (Low/Medium/High) — impacts test load profiles, alarm thresholds, and capacity planning.

9. Traceability Matrix
- Goal: 10 Hz playback, smooth rendering → FrameStreamService cadence + SceneDataService buffer reuse + worker parsing.
- Goal: side-by-side baseline vs active → DualViewerComponent + Simulation/Selection state.
- Goal: first frame ≤2 s → CDN caching + small prefetch + parallel fetch of first frame’s points/detections.
- Goal: memory ceilings → prefetch window 3, concurrency 2–3, buffer reuse, no large caches.
- Goal: observability → MetricsService + /metrics + sampling + CDN/origin logs.
- Goal: error handling (<0.5% misses, pause after 3) → timeout/retry policy + banner + pause/resume flow.
- Goal: security/CORS/signed URLs → CDN behaviors + CORS config + prod-only toggle.

10. Readiness for Micro-Level Planning
- Workstreams/Epics
  1) Converter CLI (pkl2web): schema mapping, validation report, emit three sequences (full+fallback); ADR for quantization/compression gating.
  2) Frame Streaming: FrameStreamService (10 Hz, prefetch=3, concurrency=2–3, cancellation), manifest loader, error/miss handling.
  3) Scene & UI: SceneDataService buffer patch path; DualViewer; Detection filters (score/labels); ErrorBanner; autoplay/loop.
  4) Telemetry: MetricsService with sampling; POST /metrics integration; opt‑out flag; session IDs.
  5) Infra: {Object_Storage}+{CDN} config (headers, CORS, Range‑GET, TTLs, signed URL toggle); staging/prod setup.
  6) CI/CD: manual upload scripts; manifest prefixing; CDN invalidation; rollback procedure.
  7) QA/Perf: unit/e2e; 15‑min soak; Safari acceptance; axis/yaw signoff.
- Entry Criteria: manifest schema frozen; sequence IDs/tier policy confirmed; CORS/headers configured in staging; metrics endpoint reachable.
- Exit Criteria: meets NFRs (first frame ≤2 s; <0.5% drops; avg render ≥55 fps; p95 frame fetch ≤150 ms; no memory growth >50 MB/15 min); three sequences playable and looping.
- Critical Path: Converter → sample sequence ready → streaming core → buffer reuse → DualViewer → error UI → metrics → infra hardening → QA.

11. Diagrams (supplemental)
- Data Flow (Conversion → Delivery → Playback)
```mermaid
flowchart LR
  P[PKL GT/Detections] --> Cnv[Converter CLI]
  Cnv -->|frames/*.bin, *.json, manifest.json| Obj[(Object Storage)]
  Obj --> CDN[{CDN}]
  CDN --> SPA[Angular SPA]
  SPA --> Metrics[/POST /metrics/]
```

12. Out of Scope for Meso-Level
- Code-level class diagrams, function signatures, detailed tests.
- Story-level acceptance criteria; per-component styling and UX polish.
- Secrets and environment-specific credential management.
