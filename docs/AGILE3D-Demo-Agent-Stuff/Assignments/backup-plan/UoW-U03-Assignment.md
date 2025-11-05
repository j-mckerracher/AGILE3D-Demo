---
tags: [assignment, uow, agent/work-assigner]
unit_id: "U03"
project: "[[01-Projects/AGILE3D-Demo]]"
status: "ready"
created: "2025-10-26"
links:
  se_work_log: "[[SE-Log-U03]]"
---

# UoW Assignment — U03

- Project: [[01-Projects/AGILE3D-Demo]]
- SE Work Log: [[SE-Log-U03]]
- Daily note: [[2025-10-26]]

## Task Overview
Remove 3D scene assets and Three.js dependencies from package.json to minimize bundle size. This is the final cleanup task, eliminating all 3D-related npm packages and static assets.

## Success Criteria
- [ ] `src/assets/scenes/` directory completely deleted
- [ ] `src/assets/workers/` directory completely deleted
- [ ] `package.json` no longer contains `three`, `angular-three`, or `@types/three`
- [ ] `package-lock.json` regenerated successfully via `npm install`
- [ ] `npm ls three` returns error confirming Three.js not installed
- [ ] `src/assets/` directory contains only `data/` (config, not 3D scene data)
- [ ] Node_modules size reduced by ~1-2MB (Three.js removal)

## Constraints and Guardrails
- Only edit `package.json` and delete asset directories
- ≤5 files modified, ≤400 LOC total
- No secrets; use placeholders if needed
- Do not commit unless explicitly instructed

## Dependencies
[[U01]], [[U02]]

## Files to Read First
- `package.json` (identify three, angular-three, @types/three entries)
- `src/assets/` (verify directory structure)

## Files to Edit or Create
**DELETE:**
- `src/assets/scenes/`
- `src/assets/workers/`

**EDIT:**
- `package.json` (remove three, angular-three, @types/three)

## Implementation Steps
1. Review current `package.json` to locate dependencies: `grep -E '"(three|angular-three)"' package.json`
2. Review devDependencies: `grep -E '"@types/three"' package.json`
3. Verify asset structure: `ls -la src/assets/`
4. Delete asset directories: `rm -rf src/assets/scenes/ src/assets/workers/`
5. Edit `package.json` and remove the three dependency lines (keep formatting clean)
6. Edit `package.json` and remove the angular-three dependency line
7. Edit `package.json` and remove the @types/three devDependency line
8. Delete `package-lock.json`: `rm package-lock.json`
9. Run `npm install` to regenerate lockfile and install remaining dependencies
10. Verify Three.js removal: `npm ls three 2>&1 | head -5` (should show error)

## Tests
- Manual: `ls -la src/assets/` (should show only `data/` directory)
- Automated: `grep -E '"(three|angular-three|@types/three)"' package.json` (expect 0 matches)
- Automated: `npm ls three 2>&1 | grep 'npm ERR! missing'` (confirms removal)
- Automated: `npm install` completes without errors
- Manual: Verify `package-lock.json` updated with timestamp
- Manual: Check `npm install` output for removed packages

## Commands to Run
```bash
npm install
npm ls three
```

## Artifacts to Return
- Diff of `package.json` showing three/angular-three/@types/three removed
- Output of `npm ls three` confirming removal
- Node_modules directory size before/after (optional but helpful)
- Confirmation that `src/assets/` contains only `data/`
- Git status showing deletions and `package.json`/`package-lock.json` changes

## Minimal Context Excerpts
> Source: Work-Decomposer-Output.md § 12.1 Epic 1: Repository Cleanup, Tasks 1.3, 1.4
> **Scope:** Delete assets/scenes/ and assets/workers/ directories. Remove three, angular-three, @types/three from package.json. Run npm install to regenerate package-lock.json.
> **Acceptance:** Directories deleted, dependencies removed, npm install succeeds, Three.js confirmed absent, ~1MB reduction in node_modules.

## Follow-ups if Blocked
- If other dependencies transitively depend on Three.js, escalate with `npm ls three` output
- If `npm install` fails, check for lockfile corruption and try deleting `node_modules` and `package-lock.json`
- If assets structure differs from expected, provide actual `ls -la src/assets/` output

---

> [!tip] Persistence
> Save as: `01-Projects/AGILE3D-Demo/Assignments/UoW-U03-Assignment.md`
> Link from: SE-Log-U03 and [[2025-10-26]] daily note
