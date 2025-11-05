---
tags: [assignment, uow, agent/work-assigner]
unit_id: "U04"
project: "[[01-Projects/AGILE3D-Demo]]"
status: "ready"
created: "2025-10-27"
links:
  se_work_log: "[[SE-Log-U04]]"
---

# UoW Assignment — U04

- Project: [[01-Projects/AGILE3D-Demo]]
- SE Work Log: [[SE-Log-U04]]
- Daily note: [[2025-10-27]]

## Task Overview
Ensure codebase compiles successfully after 3D code removal and fix any remaining broken imports or tests. This verification task catches dependencies missed in U01–U03 and validates the build system works correctly.

## Success Criteria
- [ ] `npm run build` completes with exit code 0 (no TypeScript errors)
- [ ] `npm run lint` completes with exit code 0 (no ESLint errors)
- [ ] `npm test` completes with exit code 0 (no failing tests)
- [ ] No import statements referencing deleted 3D code remain (`grep` returns 0 matches)
- [ ] All barrel exports (`index.ts` files) updated to remove deleted modules
- [ ] Build output size reduced compared to baseline (due to removed dependencies)
- [ ] Zero console warnings about missing modules during build

## Constraints and Guardrails
- Modify only files with broken imports (≤15 files per spec)
- ≤400 LOC total changes
- No scope creep; only fix import errors
- Do not commit unless explicitly instructed

## Dependencies
[[U01]], [[U02]], [[U03]]

## Files to Read First
- `src/app/app.ts` (primary entry point, likely has deleted imports)
- `src/app/app.html` (may reference deleted component selectors)
- `src/app/**/*.spec.ts` (tests for deleted components/services)
- `src/app/**/index.ts` (barrel exports referencing deleted modules)
- `src/app/core/models/**/*.ts` (interfaces referencing deleted types)

## Files to Edit or Create
**EDIT:**
- `src/app/app.ts` (remove deleted component imports)
- `src/app/app.html` (remove deleted component selectors)
- `src/app/**/index.ts` (remove barrel exports for deleted modules)
- `src/app/core/models/*.ts` (remove references to deleted types, if any)
- Other files as discovered during build (list all in artifacts)

**DELETE:**
- `src/app/**/*.spec.ts` (for deleted components/services, as identified)

## Implementation Steps
1. Run `npm run build` to identify TypeScript compilation errors
2. Document all build errors with file paths and line numbers
3. For each file with build errors, remove imports of deleted 3D components/services
4. For each `index.ts` barrel export, remove references to deleted modules
5. For deleted component/service spec files, delete them: `rm src/app/{path}/*.spec.ts`
6. Re-run `npm run build` and iterate until no errors
7. Run `npm run lint` and fix any linting errors (mostly auto-fixable)
8. Run `npm test` and handle failing tests (may need to delete test files for deleted code)
9. Verify no 3D imports remain: `grep -r 'from.*three\|import.*dual-viewer\|import.*scene-viewer' src/ --include='*.ts'` (expect 0 matches)
10. Document all fixes made

## Tests
- Automated: `npm run build` (expect exit code 0, no TypeScript errors)
- Automated: `npm run lint` (expect exit code 0, no ESLint errors)
- Automated: `npm test` (expect exit code 0, all tests pass)
- Automated: `grep -r 'from.*three' src/ --include='*.ts'` (should return 0 matches)
- Automated: `grep -r 'dual-viewer\|scene-viewer\|camera-controls\|metrics-dashboard\|current-configuration\|control-panel\|main-demo\|render-loop\|camera-control\|bbox-instancing\|scene-data\|simulation\|metrics-history' src/ --include='*.ts'` (should return 0 matches)
- Manual: Review build output size in `dist/` vs baseline

## Commands to Run
```bash
npm run build
npm run lint
npm test
```

## Artifacts to Return
- Summary of all files modified (path, brief description of fix)
- Summary of all spec files deleted
- Lint output confirming 0 errors
- Build output confirming successful compilation
- Test results showing all tests pass
- Git status showing all changes staged

## Minimal Context Excerpts
> Source: Work-Decomposer-Output.md § 12.1 Epic 1: Repository Cleanup, Tasks 1.5, 1.6
> **Scope:** Run build to identify errors. Fix broken imports in remaining files. Remove/update barrel exports. Delete 3D-related spec files. Update TypeScript interfaces. Run lint/test.
> **Acceptance:** Build succeeds, lint passes, tests pass, no 3D references remain, build size reduced.

## Follow-ups if Blocked
- If build fails with unknown errors, provide full error message and file path
- If tests fail but related to non-3D code, escalate with test failure details
- If multiple files need updates, prioritize by dependency graph (imports first, then barrels)
- If uncertain whether to delete or modify a spec file, escalate with file path and error context

---

> [!tip] Persistence
> Save as: `01-Projects/AGILE3D-Demo/Assignments/UoW-U04-Assignment.md`
> Link from: SE-Log-U04 and [[2025-10-27]] daily note
