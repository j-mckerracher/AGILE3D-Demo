---
tags: [assignment, uow, agent/work-assigner]
unit_id: "U19"
project: "[[01-Projects/AGILE3D-Demo]]"
status: "ready"
created: "2025-11-01"
links:
  se_work_log: "[[SE-Log-U19]]"
---

# UoW Assignment — U19

- Project: [[01-Projects/AGILE3D-Demo]]
- SE Work Log: [[SE-Log-U19]]
- Daily note: [[2025-11-01]]

## Task Overview
Implement Playwright E2E tests verifying autoplay loop, dual-view consistency, filter toggling, and error banner flow. Tests run in CI and locally.

## Success Criteria
- [ ] Test passes locally and in CI shard; asserts autoplay loop and banner flow
- [ ] Filters update bbox counts as expected
- [ ] Both panes update same frame id each tick

## Constraints and Guardrails
- ≤1 file, ≤200 LOC
- Use Playwright; may need fixture server for sample data
- No commits unless explicitly instructed

## Dependencies
- [[U12]] (DualViewerComponent)
- [[U13]] (ErrorBannerComponent)
- [[U06]] (Manifest Loader)
- [[U08]] (FrameStreamService)

## Files to Edit or Create
- `apps/web/e2e/tests/streaming.spec.ts`

## Implementation Steps
1. Load sample manifest from assets
2. Verify autoplay starts and frames emit at 10 Hz
3. Verify both panes show same frame id
4. Toggle filters; verify bbox count changes
5. Induce network throttle; verify error banner appears

## Commands to Run
```bash
npm run e2e
# Or manually:
npx playwright test apps/web/e2e/tests/streaming.spec.ts
```

## Artifacts to Return
- Unified diff for the file
- Test output showing passed assertions
- Playwright trace screenshot (optional)
