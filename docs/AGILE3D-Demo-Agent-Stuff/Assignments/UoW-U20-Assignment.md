---
tags: [assignment, uow, agent/work-assigner]
unit_id: "U20"
project: "[[01-Projects/AGILE3D-Demo]]"
status: "ready"
created: "2025-11-01"
links:
  se_work_log: "[[SE-Log-U20]]"
---

# UoW Assignment — U20

- Project: [[01-Projects/AGILE3D-Demo]]
- SE Work Log: [[SE-Log-U20]]
- Daily note: [[2025-11-01]]

## Task Overview
Implement a 15-minute soak test using Playwright to measure performance and memory budgets. Collects fps, memory growth, frame drops, and fetch latency p95 metrics.

## Success Criteria
- [ ] Over 15 min: mem growth <50 MB; frame drops <0.5%; avg render ≥55 fps; p95 fetch ≤150 ms

## Constraints and Guardrails
- ≤1 file, ≤200 LOC
- Document baseline hardware
- Metrics collected via JS APIs and network timing
- No commits unless explicitly instructed

## Dependencies
- [[U12]] (DualViewerComponent)
- [[U08]] (FrameStreamService)

## Files to Edit or Create
- `apps/web/e2e/tests/soak.spec.ts`

## Implementation Steps
1. Start app and playback for 15 minutes (900 frames at 10 Hz)
2. Collect memory snapshots every minute via `performance.memory`
3. Measure FPS via requestAnimationFrame
4. Track frame drops (missed frames)
5. Measure fetch latency from network timing API

## Commands to Run
```bash
npx playwright test apps/web/e2e/tests/soak.spec.ts --headed
```

## Artifacts to Return
- Unified diff for the file
- Test output with metrics summary
- Performance baseline document
