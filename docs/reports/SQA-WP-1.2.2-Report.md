# SQA Report: WP-1.2.2 Scene Data & Parsing Infrastructure

Date: 2025-10-17
Status: Partial PASS (with 1 blocking issue for production build)

Scope (PRD mapping)
- FR-1.8/FR-1.11: Scene registry and JSON-only extensibility
- NFR-1.6/NFR-1.7: Asset budgets (per-scene and total, compressed)
- NFR-1.9: Quality tiers (100k/50k) and path mapping; auto-tier acknowledged stub
- NFR-4.2/NFR-4.5: Error handling (HTTP failures, worker timeouts/invalid inputs)
- NFR-5.2: Data separated from code (no raw point arrays in JSON)

Evidence index (evidence/wp-1.2.2)
- unit-tests.txt (Karma run log; browser capture issue)
- dist-tree.txt (production build tree)
- no-embedded-assets.txt (heuristic check of JS bundles)
- asset-sizes.csv, asset-sizes.txt (gzip/brotli sizes)

Summary of results
1) T1 Registry (FR-1.8/FR-1.11): PASS (by inspection)
   - src/assets/scenes/registry.json lists 4 scenes, including parking_lot_01.
   - JSON-only extensibility validated (no code changes required; registry drives discovery).

2) T2 Metadata & separation (NFR-5.2): PASS (by inspection)
   - Scene metadata JSON present per scene, required fields present; no raw point arrays in JSON (bins are separate).

3) T3 Worker parsing & caching (design inspection): PASS (by code inspection)
   - Worker exists at src/assets/workers/point-cloud-worker.js; uses transferables; stride alignment validation present.
   - SceneDataService uses worker with timeout and caches by cacheKey.

4) T4 Worker timeout & termination (design inspection): PASS (by code inspection)
   - WORKER_TIMEOUT_MS=10000; terminateWorker() called on timeout path; errors surfaced with clear messages.

5) T5 Tier manager mapping (NFR-1.9): PASS (tests present)
   - scene-tier-manager.service.spec.ts validates getTierPath("_100k.bin"→"_50k.bin"), cache keys, manual setTier.

6) T6 Production build & asset serving: FAIL (blocking)
   - Build succeeded (dist/agile3d-demo/browser/*), but assets directory not present.
   - Root cause: angular.json “assets” includes only public/**. src/assets is not configured for copy.
   - Impact: metadata and .bin files won’t be served in production (FR-1.8/FR-1.11, NFR-5.2).

7) T7 No embedded assets in JS: PASS (heuristic)
   - No scene .bin filenames found in dist JS; large-number grep shows only typical constants.

8) T8 Asset budgets (NFR-1.6/NFR-1.7): PASS
   - Per-file compressed sizes (brotli, gzip) ≤ 2.5MB.
   - TOTAL compressed across all scenes/tiers ≈ 6.53MB (≤ 8MB).
   - See asset-sizes.csv for details.

9) T9 Non-blocking parsing (manual): NOT EXECUTED
   - Requires browser profiling; harness not committed per plan.

10) T10 Extensibility (parking_lot_01) runtime: PARTIAL (by inspection)
   - Registry lists scene; runtime verification blocked by T6 (assets not copied to dist).

Test execution notes
- Unit test runner (Karma) compiled successfully but failed to capture FirefoxHeadless in this environment (see unit-tests.txt). The suite includes robust unit tests already; functional assertions above rely on code inspection and existing specs.

Blocking issue (BUG)
- Title: Production build does not copy src/assets, breaking scene asset serving (FR-1.11, NFR-5.2)
- Component: Build configuration (angular.json)
- Steps:
  1) npm run build:prod
  2) Inspect dist/agile3d-demo/browser → assets directory missing
- Expected: dist contains assets/scenes/**/* copied and served
- Actual: No assets directory in dist; metadata/bin unreachable at runtime
- Suggested fix:
  - In angular.json build.options.assets, include:
    [
      "src/assets",
      "src/favicon.ico",
      { "glob": "**/*", "input": "public" }
    ]
  - Mirror assets entries for test options if needed.
- Severity: Critical (blocks runtime features depending on assets)
- Priority: High

Recommendation
- Overall WP-1.2.2: APPROVE WITH CHANGES
  - Approve data layer, worker infra, tier mapping, and budgets
  - Require fix for angular.json assets configuration before marking WP as fully ship-ready

Next actions
- Apply assets fix in angular.json; rebuild and verify dist contains src/assets
- Re-attempt T6 and T10 runtime checks; optionally run Karma in ChromeHeadless or configure Firefox path
- Optional: add explicit unit tests for stride-misalignment and worker-timeout with a FakeWorker harness
