---
tags: [assignment, uow, agent/work-assigner]
unit_id: "U01"
project: "[[01-Projects/AGILE3D-Demo]]"
status: "ready"
created: "2025-10-26"
links:
  se_work_log: "[[SE-Log-U01]]"
---

# UoW Assignment — U01

- Project: [[01-Projects/AGILE3D-Demo]]
- SE Work Log: [[SE-Log-U01]]
- Daily note: [[2025-10-26]]

## Task Overview
Remove all 3D-specific feature components from the codebase to eliminate interactive demo functionality. This is the first cleanup task in the backup video-only branch, preparing the codebase for VideoLandingComponent as the sole UI feature.

## Success Criteria
- [ ] All seven specified feature directories completely removed from filesystem
- [ ] No import statements referencing deleted components remain in codebase
- [ ] `npm run lint` completes without errors related to missing modules
- [ ] File count verification: `src/app/features/` contains only `header`, `hero`, `footer`, `skip-link`, `theme-toggle`, `legend`, `error-banner`

## Constraints and Guardrails
- No scope creep; delete only listed directories
- ≤5 files modified, ≤400 LOC total
- No secrets; use placeholders if needed
- Do not commit unless explicitly instructed

## Dependencies
None

## Files to Read First
- `src/app/features/**/*` (to understand structure)
- `src/app/app.ts` (to identify imports)

## Files to Edit or Create
**DELETE:**
- `src/app/features/dual-viewer/`
- `src/app/features/scene-viewer/`
- `src/app/features/camera-controls/`
- `src/app/features/metrics-dashboard/`
- `src/app/features/current-configuration/`
- `src/app/features/control-panel/`
- `src/app/features/main-demo/`

## Implementation Steps
1. List all feature directories to confirm targets: `ls -la src/app/features/`
2. Search for imports of deleted components: `grep -r 'dual-viewer\|scene-viewer\|camera-controls\|metrics-dashboard\|current-configuration\|control-panel\|main-demo' src/ --include='*.ts' --include='*.html'`
3. Document any import references found (if any remain beyond deleted files)
4. Delete each feature directory: `rm -rf src/app/features/{dirname}/`
5. Verify deletion: `ls -la src/app/features/` (should only show non-3D features)
6. Re-run grep to confirm no stray imports: `grep -r 'dual-viewer\|scene-viewer\|camera-controls\|metrics-dashboard\|current-configuration\|control-panel\|main-demo' src/`
7. Run `npm run lint` and fix any import-related errors
8. Stage deletions with git (if using version control)

## Tests
- Manual: Verify directories deleted via `ls -la src/app/features/`
- Automated: `grep -r 'dual-viewer\|scene-viewer\|camera-controls\|metrics-dashboard\|current-configuration\|control-panel\|main-demo' src/ --include='*.ts'` (expect 0 matches)
- Automated: `npm run lint` (expect 0 errors about missing components)
- Manual: Review git status to confirm deletions staged

## Commands to Run
```bash
npm run lint
```

## Artifacts to Return
- Summary of directories deleted (count)
- Any broken import references found and fixed (file list)
- Lint output confirming no errors
- Git status output showing staged deletions

## Minimal Context Excerpts
> Source: Work-Decomposer-Output.md § 12.1 Epic 1: Repository Cleanup, Task 1.1
> **Scope:** Delete dual-viewer, scene-viewer, camera-controls, metrics-dashboard, current-configuration, control-panel, main-demo feature directories. Verify no broken imports remain.
> **Acceptance:** All directories removed, no import errors, lint passes with 0 errors about missing components.

## Follow-ups if Blocked
- If directory structure differs from expected, escalate with actual directory listing
- If imports found outside deleted files, provide file names and line numbers for review before fixing

---

> [!tip] Persistence
> Save as: `01-Projects/AGILE3D-Demo/Assignments/UoW-U01-Assignment.md`
> Link from: SE-Log-U01 and [[2025-10-26]] daily note
