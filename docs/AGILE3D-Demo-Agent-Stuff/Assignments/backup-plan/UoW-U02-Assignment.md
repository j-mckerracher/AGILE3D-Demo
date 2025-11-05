---
tags: [assignment, uow, agent/work-assigner]
unit_id: "U02"
project: "[[01-Projects/AGILE3D-Demo]]"
status: "ready"
created: "2025-10-26"
links:
  se_work_log: "[[SE-Log-U02]]"
---

# UoW Assignment — U02

- Project: [[01-Projects/AGILE3D-Demo]]
- SE Work Log: [[SE-Log-U02]]
- Daily note: [[2025-10-26]]

## Task Overview
Remove all 3D rendering, visualization, and simulation services to eliminate dependencies on Three.js. This is the second cleanup task, targeting core infrastructure that powered the interactive 3D demo.

## Success Criteria
- [ ] All specified service directories completely removed from `src/app/core/services/`
- [ ] `viewer-style-adapter.service.ts` and `.spec.ts` deleted from `src/app/core/theme/`
- [ ] No import statements referencing deleted services remain in codebase
- [ ] State and runtime services retained (verified via `ls -la src/app/core/services/`)
- [ ] `npm run lint` completes without errors related to missing services

## Constraints and Guardrails
- No scope creep; delete only listed directories and files
- ≤5 files modified, ≤400 LOC total
- No secrets; use placeholders if needed
- Do not commit unless explicitly instructed

## Dependencies
[[U01]]

## Files to Read First
- `src/app/core/services/**/*` (to understand structure)
- `src/app/core/theme/**/*` (to locate viewer-style-adapter)
- `src/app/core/theme/theme.service.ts` (to verify no hard dependency on viewer-style-adapter)

## Files to Edit or Create
**DELETE:**
- `src/app/core/services/rendering/`
- `src/app/core/services/controls/`
- `src/app/core/services/visualization/`
- `src/app/core/services/data/`
- `src/app/core/services/simulation/`
- `src/app/core/services/metrics/`
- `src/app/core/theme/viewer-style-adapter.service.ts`
- `src/app/core/theme/viewer-style-adapter.service.spec.ts`

## Implementation Steps
1. List service directories: `ls -la src/app/core/services/`
2. Search for imports of deleted services: `grep -r 'render-loop\|camera-control\|bbox-instancing\|detection-diff\|scene-data\|scene-tier-manager\|paper-data\|simulation\|synthetic-detection-variation\|metrics-history\|viewer-style-adapter' src/ --include='*.ts' --include='*.html'`
3. Document any import references found outside deleted files
4. Delete each service directory: `rm -rf src/app/core/services/{dirname}/`
5. Delete viewer-style-adapter files: `rm -f src/app/core/theme/viewer-style-adapter.service.ts src/app/core/theme/viewer-style-adapter.service.spec.ts`
6. Verify state and runtime services exist: `ls -la src/app/core/services/` (should show only `state/` and `runtime/`)
7. Re-run grep to confirm no stray service imports: `grep -r 'render-loop\|camera-control\|bbox-instancing\|scene-data\|simulation\|metrics-history\|viewer-style-adapter' src/`
8. Run `npm run lint` and fix any import-related errors

## Tests
- Manual: Verify directories deleted via `ls -la src/app/core/services/`
- Manual: Verify state and runtime services still exist in `src/app/core/services/`
- Automated: `grep -r 'render-loop\|camera-control\|bbox-instancing\|scene-data\|simulation\|metrics-history\|viewer-style-adapter' src/ --include='*.ts'` (expect 0 matches)
- Automated: `npm run lint` (expect 0 errors about missing services)
- Manual: Review git status to confirm deletions staged

## Commands to Run
```bash
npm run lint
```

## Artifacts to Return
- Summary of directories deleted (count)
- Confirmation that state/ and runtime/ services retained
- Any broken import references found and fixed (file list)
- Lint output confirming no errors
- Git status output showing staged deletions

## Minimal Context Excerpts
> Source: Work-Decomposer-Output.md § 12.1 Epic 1: Repository Cleanup, Task 1.2
> **Scope:** Delete rendering (render-loop, etc.), controls (camera-control, etc.), visualization (bbox-instancing, detection-diff, etc.), data (scene-data, scene-tier-manager, paper-data, etc.), simulation, metrics, and viewer-style-adapter services. Verify no broken imports remain.
> **Acceptance:** All services removed, state/runtime retained, no import errors, lint passes.

## Follow-ups if Blocked
- If service structure differs from expected, escalate with actual directory listing
- If state or runtime services contain 3D-specific code, flag for review in U04
- If imports found outside deleted files, provide file names and line numbers for review before fixing

---

> [!tip] Persistence
> Save as: `01-Projects/AGILE3D-Demo/Assignments/UoW-U02-Assignment.md`
> Link from: SE-Log-U02 and [[2025-10-26]] daily note
