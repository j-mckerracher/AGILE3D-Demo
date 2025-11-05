---
tags: [assignment, uow, agent/work-assigner]
unit_id: "U21"
project: "[[01-Projects/AGILE3D-Demo]]"
status: "ready"
created: "2025-11-01"
links:
  se_work_log: "[[SE-Log-U21]]"
---

# UoW Assignment — U21

- Project: [[01-Projects/AGILE3D-Demo]]
- SE Work Log: [[SE-Log-U21]]
- Daily note: [[2025-11-01]]

## Task Overview
Add Safari-specific E2E test profile enforcing ≤50k point tier and DPR clamped to ≤1.5. Ensures visual fidelity and performance on Apple devices.

## Success Criteria
- [ ] Safari run uses ≤50k tier; visual fidelity acceptable; no crashes
- [ ] DPR capped at 1.5 via CSS/JS and verified by window.devicePixelRatio checks

## Constraints and Guardrails
- ≤2 files, ≤150 LOC
- Use Playwright WebKit profile
- No commits unless explicitly instructed

## Dependencies
- [[U12]] (DualViewerComponent)

## Files to Edit or Create
- `apps/web/e2e/playwright.safari.config.ts`
- `apps/web/src/styles.scss` (add DPR clamp rule)

## Implementation Steps
1. Create Playwright config with WebKit browser and Safari viewport
2. Configure test to use 50k point tier via runtime-config override
3. Add CSS rule to clamp DPR: `@media (min-resolution: 2dppx) { ... }`
4. Verify window.devicePixelRatio ≤ 1.5 in tests

## Commands to Run
```bash
npx playwright test --config apps/web/e2e/playwright.safari.config.ts
```

## Artifacts to Return
- Unified diff for both files
- Test output showing Safari profile execution
- Screenshot of DPR clamp verification
