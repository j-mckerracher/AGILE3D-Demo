# Macro-Level Plan — Use Real Data

## 1) Requirement Clarification

1. Goals and Major Capabilities
   - Enable {Demo_Reviewers} and {Internal_Stakeholders} to select a scenario and play real LiDAR frames at 10–20 Hz.
   - Show side-by-side comparison: {Baseline_Branch} vs {Active_Branch}; allow tuning (e.g., SLO/contention/voxel size) and visualize bbox diffs and metrics.
   - Provide small curated sequences for demo; include minimal offline local sample for development.

2. In-Scope (This Increment)
   - Per-frame point streaming (10–20 Hz) with small prefetch window.
   - Multi-branch detections (fixed baseline + selectable active branch).
   - Controls: play/pause/seek (frame-aligned), error skipping/tolerance.
   - Score threshold and label toggles for detections.
   - Basic telemetry (bytes, buffer level, fetch latency, fps, frame drops, HTTP errors).

3. Out-of-Scope (This Increment)
   - Image/camera fusion, training/inference, annotation tools.
   - Full dataset browsing, user uploads/downloads.
   - Mobile/tablet polish.

4. Non-Functional Requirements (NFRs)
   - Performance: render loop at 60 fps; smooth frame updates at 10–20 Hz; ≤16 ms update/render budget per frame.
   - Data size: ≤100k points per frame (full), ≤50k fallback; first frame visible ≤2 s on broadband.
   - Compatibility: Desktop Chrome/Edge/Firefox (latest 2); Safari best-effort.
   - Scale: ~200 concurrent sessions; CDN cache-hit ≥90% for frame binaries; manifests short-TTL.
   - Availability/Reliability: 99.9% uptime; frame fetch error rate <0.5%; soft‑pause after 3 consecutive misses.
   - Security/Privacy: no PII; restrict CORS to demo origin; unsigned URLs initially with optional signed-URL toggle.
   - Accessibility: keyboard controls, visible focus, WCAG AA contrast, honors prefers-reduced-motion; English only.
   - Observability: console logging + Beacon to /metrics; no PII.

5. Constraints and Interoperability
   - Timeline: ~7–10 working days (+1–2 days licensing review).
   - Cost: egress budget $25–$50/month; per-session cap ≤300 MB; limit concurrent fetches (≤4) and sequence count.
   - Hosting/Ops: {Object_Storage}=S3, {CDN}=CloudFront; staging + prod; IaC optional (recommended); CI uploads.
   - App Stack: {Web_Framework}=Angular 17 + TypeScript; {3D_Engine}=Three.js; workers under /assets/workers; no IndexedDB caching in v1 (memory-only).
   - Legal: host only derived/decimated subsets with attribution; internal approval gate; takedown process documented.

6. Dependencies and Reuse
   - Inputs: PKL ground-truth and detection artifacts supplied (ordered by frame_id); label map documentation provided by data owner.
   - Reuse: reference scripts for conversion/visualization; existing app services/utilities for scene and instancing.
   - Provisioning: infra owner to deliver {Object_Storage}+{CDN} setup, DNS/CORS/cache headers, CI job for uploads.
   - Testing: unit (converter/schema/label map), e2e (stream/seek/skip), perf & 15‑min soak (no memory growth).

7. Risks and Mitigations (Macro)
   - Coordinate frame/yaw mismatch: validate on a 10-frame sanity sequence; explicit signoff before mass conversion.
   - Payload spikes: if >100k pts or >3 MB/bin, downsample or skip frame; log decision.
   - Memory growth: cap prefetch (3–6), reuse buffers; soak test growth <50 MB/15 min.
   - Licensing: keep curated subsets small; maintain revoke list; 24h takedown SLA.
   - Unexpected egress: CloudFront alarms; per-IP rate limits; shorter manifest TTL; enable signed URLs if surging.

8. Success Criteria (Traceable to NFRs)
   - First frame within 2 s; sustained smooth 10–20 Hz playback; render loop remains at ~60 fps on target hardware.
   - Side-by-side baseline vs active branch with working filters and frame-aligned seek.
   - CDN cache-hit ≥90% for binaries across demo runs; <0.5% frame fetch error rate; auto-pause after 3 misses with banner.
   - 15‑min soak without memory growth >50 MB; per-session egress ≤300 MB.

9. Specified Requirements (Now Resolved)
   - Sequences: v_1784–1828 (Vehicles/highway), p_7513–7557 (Pedestrians/sidewalk), c_7910–7954 (Mixed intersection); each ships both full (≤100k pts) and fallback (≤50k pts) tiers.
   - Branches: Baseline=DSVT_Voxel; Active={CP_Pillar_032, CP_Pillar_048, CP_Voxel_024, DSVT_Voxel_016}; side‑by‑side = Baseline vs selected active.
   - UI defaults: score threshold 0.7; vehicle/pedestrian/cyclist enabled; playback 10 Hz default (20 Hz on "High Performance").
   - Broadband test: ≥50 Mbps down, ≤40 ms RTT, ≤20 ms jitter, ≤0.5% loss; 1920×1080.
   - Reference hardware: i7‑12700/16GB + RTX 3060 12GB (Chrome); Apple M2 Pro 16GB (Safari best‑effort).
   - Safari acceptance: WebGL1/2 auto‑detect; ≥30 fps minimum (45 fps preferred); ≤50k pts; DPR clamp 1.5; instanced only; fallback banner if unsupported.
   - Timeouts/retries: manifest 5s, frame 3s; 2 retries (250ms, 750ms backoff); "miss" = non‑2xx/3xx, network error, timeout, or late arrival.
   - Cache policy: manifest TTL 300s; frame binaries immutable 1 year; Range‑GET enabled.
   - Memory budgets: ≤350 MB (Chrome/Edge/Firefox), ≤250 MB (Safari); prefetch window 3 frames default (2–3 Safari), 4–6 on "High Performance".
   - Signed URLs: start public; global toggle via CloudFront behavior on /sequences/* if abuse (>1k req/min or >50–100 GB/day); per‑sequence possible via path, but start global.
   - CORS: origins = https://agile3d-demo.example.org, https://staging.agile3d-demo.example.org, http://localhost:4200; Methods: GET, HEAD, OPTIONS; Allow-Headers: Accept, Range, Content-Type; Expose-Headers: Accept-Ranges, Content-Length, Content-Range; Max-Age=86400; credentials=false.
   - Metrics: same‑origin POST /metrics; JSON fields {ts, sessionId, seqId, frameId, event, bytes, latencyMs, fps, buffer, misses, ua}; sample 1/5s + every error/miss; store JSONL in CloudWatch Logs or S3; 30d retention; opt‑out via ?metrics=off.
   - UX: autoplay loops (no seek UI); on loop wrap, reset prefetch from frame 1; no keyboard shortcuts; honor prefers‑reduced‑motion.
   - Error handling: pause after 3 misses; banner with "Streaming paused after 3 missed frames. Check connection and Retry." and buttons {Retry, Keep Trying}; auto‑dismiss and resume on first successful frame.

---

## 2) Questions (to unblock Meso-Level Architecture)

Requirements & Scope
1) None—sequences, tiers, branches, side-by-side behavior, and UI defaults received and recorded.

NFRs & Acceptance
2) Confirm if 20 Hz “High Performance” mode should also increase prefetch and concurrency automatically or remain user-rate only.
3) Clarify whether first-frame ≤2 s applies to Safari best‑effort with ≤50k pts and DPR clamp 1.5.

Security & Ops
4) Confirm operational thresholds for enabling signed URLs are exactly (>1k req/min OR >50–100 GB/day), and whether both staging/prod switch together.
5) Confirm S3 and CloudFront CORS can be configured identically with the specified Allow/Expose headers and Max-Age=86400; any env-specific deviations?

Data & Formats
6) Quantization default: keep off initially (Float32) and enable per-sequence after validation, or enable by default for fallback tier only?
7) .bin compression: proceed with br disabled by default; enable if ≥10% size reduction with <5% CPU overhead—confirm this threshold.

Playback & UX
8) Looping semantics: on loop wrap, reset prefetch from frame 1 (confirmed); should metrics reset session counters at loop or continue accumulating?
9) Reduced-motion: when enabled, should we force 10 Hz and lower point count (fallback tier) automatically?

CDN & CI
10) Provide bucket/distribution names and final domain(s) to embed in manifests; confirm CI upload trigger (manual vs on-tag) and rollback steps.

Testing & Signoff
11) Soak test pass/fail: besides <50 MB growth/15 min, set thresholds for frame drops (<0.5%), average fps, and 95th‑percentile fetch latency.
12) Signoff roles: designate approver(s) for yaw/axis sanity and licensing review prior to publish.
