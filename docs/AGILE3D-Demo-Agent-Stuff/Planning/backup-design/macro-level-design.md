# AGILE3D Demo — Backup Video-Only Version: Macro-Level Design

This document defines the plan for a dedicated backup branch that contains no 3D point cloud code or assets. The website shows a single externally hosted embedded video in place of the prior side-by-side 3D viewers. Control panel and metrics are removed for simplicity.

Clarifications applied
- Single video only (no dual layout)
- External hosting (e.g., YouTube/Vimeo)
- Hide control panel and metrics (non-interactive)
- No 3D code or assets present in this branch (no Three.js, workers, scenes, detections, simulation, etc.)
- No captions (we will not ship WebVTT/self-hosted tracks)

Goals
- Ship a minimal, stable site that visually communicates the demo via a single embedded video.
- Eliminate all 3D-related codepaths, assets, and dependencies from this branch to simplify build, QA, and deployment.
- Maintain clean, accessible markup and responsive layout.

Non-goals
- No 3D point cloud, detections, or synchronized viewers
- No control panel, metrics dashboard, or branch selection
- No runtime fallback toggles (no URL flags) — this branch is video-only by design
- No caption files (self-hosted) included; external platform captions (if any) are out of scope

High-level approach
- Remove all 3D + simulation code, assets, and tests from the repo in this branch.
- Replace the main route with a simple VideoLanding component that embeds a single external video.
- Remove 3D-related dependencies (three, angular-three, @types/three) from package.json.
- Update documentation to reflect the video-only design and where to change the video URL.

Architecture delta (from main branch)
- Previous: MainDemo orchestrated DualViewer (two SceneViewer instances) + ControlPanel + MetricsDashboard, backed by SceneDataService (worker parsing), SimulationService, and related services.
- New (backup branch): App routes directly to VideoLandingComponent; no other feature areas are present.

UI/UX specification (VideoLanding)
- Layout: a single responsive video area within a main region, centered, with an accessible heading (visually hidden is acceptable) and short description (optional).
- Video: external embed via iframe (YouTube/Vimeo) with no autoplay; use loading="lazy"; ensure title attribute; respect prefers-reduced-motion by not auto-playing.
- Accessibility: keyboard reachable; title attribute on iframe; role/aria labeling on section; color-contrast unaffected (minimal UI).
- Responsive: maintain 16:9 aspect ratio with a fluid container; width 100% up to a max content width.

Performance and privacy
- No heavy assets; only the external video iframe loads.
- Use iframe attributes like referrerpolicy and allow as appropriate for the chosen platform.
- Avoid autoplay by default to respect user control and reduced motion.

Concrete change list

Remove (delete) — code
- Features (3D and associated UI):
  - src/app/features/dual-viewer/
  - src/app/features/scene-viewer/
  - src/app/features/camera-controls/
  - src/app/features/metrics-dashboard/
  - src/app/features/current-configuration/
  - src/app/features/control-panel/
- Core services and themes used by 3D/simulation:
  - src/app/core/services/rendering/ (RenderLoopService)
  - src/app/core/services/controls/ (CameraControlService and specs)
  - src/app/core/services/visualization/ (bbox-instancing, detection-diff)
  - src/app/core/services/data/ (scene-data, paper-data, scene-tier-manager, specs)
  - src/app/core/services/simulation/ (simulation.service, synthetic-detection-variation.service, specs)
  - src/app/core/theme/viewer-style-adapter.service.ts
  - src/app/core/models/scene.models.ts (and any model files solely used by 3D/detections)
- Main demo container that wires the above:
  - src/app/features/main-demo/ (entire folder)

Remove (delete) — assets and workers
- src/assets/scenes/ (entire folder: metadata.json, *.bin, registry.json)
- src/assets/workers/point-cloud-worker.js

Modify — routing and app shell
- src/app/app.routes.ts: Route root path ('') to the new VideoLandingComponent.
- src/app/app.config.ts: No changes beyond removed imports (if any).
- src/main.ts: No changes.

Add — new component
- src/app/features/video-landing/video-landing.component.ts
  - Standalone component (OnPush) rendering a single video embed.
  - Contains a readonly string with the external embed URL (or a tiny JSON asset loaded via HttpClient if preferred later).
- src/app/features/video-landing/video-landing.component.html
  - Accessible section with h2 (can be visually hidden) and a responsive iframe container.
- src/app/features/video-landing/video-landing.component.scss
  - Styles to implement fluid aspect ratio and centering, minimal typography.

Dependencies and configuration
- package.json (dependencies): remove
  - three
  - angular-three
  - @types/three
- package.json (scripts): keep start/build/test/lint/format; they continue to work.
- angular.json: no special changes required (assets array can remain generic to src/assets; scenes folder is removed).

Testing
- Remove specs tied to deleted components/services.
- Add a minimal spec for VideoLandingComponent verifying:
  - Component renders
  - iframe is present with correct attributes (title, src binding)
- Optional: basic a11y smoke test (e.g., role=main present in template).

Documentation
- README: Add a “Backup (Video-Only) Branch” section with:
  - Purpose (deadline backup)
  - Where to change the video URL (in VideoLandingComponent)
  - How to run/build/deploy (npm start, npm run build)
  - Note that 3D functionality is intentionally removed in this branch

Security and compliance
- Do not ship secrets; video URL is public.
- External embed follows platform recommendations (e.g., YouTube embed with rel=0 behavior if desired; referrerpolicy; sandbox not typically used with standard embeds).

Rollback and branch strategy
- Keep this video-only version isolated in a dedicated branch.
- Main branch continues to host the 3D implementation.
- To switch back, deploy the main branch.

Timeline (estimate)
- Removal and cleanup: 2–4 hours (delete code, assets, deps, fix imports)
- VideoLanding component + routing: 1–2 hours
- Tests + README updates: 1 hour
- Buffer + QA: 1 hour
- Total: ~1 business day

Acceptance checklist
- [ ] All 3D and simulation code, assets, and workers are removed from repo
- [ ] No Three.js or angular-three dependencies remain
- [ ] Root route shows a single external video embed (no autoplay)
- [ ] No control panel or metrics in UI
- [ ] Build passes: npm run build
- [ ] Lint/format pass: npm run lint && npm run format
- [ ] Minimal tests pass

Implementation notes (details)
- Video embed example (YouTube):
  - Use a container to maintain 16:9 ratio (padding-top: 56.25%).
  - <iframe
      title="AGILE3D Demo Overview"
      src="https://www.youtube.com/embed/VIDEO_ID"
      loading="lazy"
      allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      referrerpolicy="strict-origin-when-cross-origin"
      allowfullscreen>
    </iframe>
- Avoid autoplay. Do not set ?autoplay=1 or allow=autoplay.
- If later you want to change the video, editing a single constant in VideoLandingComponent is sufficient.

Out-of-scope cleanup (optional if time remains)
- Remove Angular Material if not needed anywhere else to further slim bundle.
- Prune README sections that reference 3D-only workflows in this branch.