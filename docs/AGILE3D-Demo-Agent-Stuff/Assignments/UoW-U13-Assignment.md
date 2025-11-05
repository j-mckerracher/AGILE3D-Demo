---
tags: [assignment, uow, agent/work-assigner]
unit_id: "U13"
project: "[[01-Projects/AGILE3D-Demo]]"
status: "ready"
created: "2025-11-01"
links:
  se_work_log: "[[SE-Log-U13]]"
---

# UoW Assignment — U13

- Project: [[01-Projects/AGILE3D-Demo]]
- SE Work Log: [[SE-Log-U13]]
- Daily note: [[2025-11-01]]

## Task Overview
Implement an Angular component displaying a dismissible banner after 3 consecutive frame misses, with two action buttons: Retry (resumes immediately) and Keep Trying (auto-retries 5 times at 3-second intervals). Respects reduced-motion accessibility preference; no animations if disabled.

## Success Criteria
- [ ] Banner appears after 3 consecutive misses; Retry resumes; Keep Trying auto-retries 5×3s
- [ ] Reduced-motion preference respected (no animations)
- [ ] Accessibility: proper contrast, focus order, ARIA labels
- [ ] Unit tests verify component logic with simulated service events
- [ ] Manual test throttles network to trigger banner flow

## Constraints and Guardrails
- ≤4 files, ≤300 LOC total
- Listen to FrameStreamService status stream
- Implement retry backoff logic
- No commits unless explicitly instructed

## Dependencies
- [[U08]] (FrameStreamService)

## Files to Edit or Create
- `apps/web/src/app/features/error-banner/error-banner.component.ts`
- `apps/web/src/app/features/error-banner/error-banner.component.html`
- `apps/web/src/app/features/error-banner/error-banner.component.scss`
- `apps/web/src/app/features/error-banner/error-banner.component.spec.ts`

## Implementation Steps
1. Subscribe to `frameStreamService.status$` for PAUSED_MISS events
2. Show banner on 3-miss pause; track retry attempt count
3. Implement Retry button (pauses retry loop) and Keep Trying button (5×3s retries)
4. Respect reduced-motion via `prefers-reduced-motion` media query

## Commands to Run
```bash
npm test -- error-banner.component.spec.ts --watch=false
ng serve # then throttle network to trigger misses
```

## Artifacts to Return
- Unified diff for all 4 files
- Test output
- Manual test screenshot showing banner with buttons
