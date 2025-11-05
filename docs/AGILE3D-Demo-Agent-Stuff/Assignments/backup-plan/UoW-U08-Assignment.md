---
tags: [assignment, uow, agent/work-assigner]
unit_id: "U08"
project: "[[01-Projects/AGILE3D-Demo]]"
status: "ready"
created: "2025-10-27"
links:
  se_work_log: "[[SE-Log-U08]]"
---

# UoW Assignment — U08

- Project: [[01-Projects/AGILE3D-Demo]]
- SE Work Log: [[SE-Log-U08]]
- Daily note: [[2025-10-27]]

## Task Overview
Configure routing to load VideoLandingComponent at root path and simplify AppComponent to minimal shell with only router outlet. This establishes the new navigation structure for the backup video-only branch.

## Success Criteria
- [ ] `app.routes.ts` has route `{ path: '', component: VideoLandingComponent, pathMatch: 'full' }`
- [ ] `app.routes.ts` has wildcard route `{ path: '**', redirectTo: '' }`
- [ ] `app.ts` imports only: `Component`, `RouterOutlet` (no Header/Hero/Footer)
- [ ] `app.html` contains only `<router-outlet></router-outlet>` (or self-closing variant)
- [ ] `npm run build` succeeds with no errors
- [ ] Manual test: Navigate to `http://localhost:4200/`, verify VideoLandingComponent renders
- [ ] Manual test: Navigate to `http://localhost:4200/invalid-path`, verify redirect to root
- [ ] Page title in browser tab shows 'AGILE3D Demo' (or configured title from route)
- [ ] No console errors or warnings in browser DevTools

## Constraints and Guardrails
- ≤3 files modified (app.routes.ts, app.ts, app.html)
- ≤30 LOC total changes
- No scope creep; only update routing and component imports
- Do not commit unless explicitly instructed

## Dependencies
[[U05]]

## Files to Read First
- `src/app/app.routes.ts` (current routing configuration)
- `src/app/app.ts` (AppComponent class and imports)
- `src/app/app.html` (AppComponent template)

## Files to Edit or Create
**EDIT:**
- `src/app/app.routes.ts` (update route to VideoLandingComponent, add wildcard redirect)
- `src/app/app.ts` (remove Header/Hero/Footer imports, keep only Component and RouterOutlet)
- `src/app/app.html` (replace with `<router-outlet></router-outlet>`)

## Implementation Steps
1. Open `src/app/app.routes.ts` and review current routes
2. Import `VideoLandingComponent` at top: `import { VideoLandingComponent } from './features/video-landing/video-landing.component';`
3. Update root route to: `{ path: '', component: VideoLandingComponent, pathMatch: 'full', title: 'AGILE3D Demo' }`
4. Update wildcard route to: `{ path: '**', redirectTo: '' }`
5. Remove any routes for deleted components (dual-viewer, scene-viewer, etc.)
6. Save `app.routes.ts`
7. Open `src/app/app.ts` and review imports
8. Remove imports for: Header component, Hero component, Footer component
9. Remove from component declarations/imports any references to deleted components
10. Verify imports include `Component` and `RouterOutlet`
11. If component uses standalone: ensure RouterOutlet is in imports array
12. Save `app.ts`
13. Open `src/app/app.html` and replace content with single line: `<router-outlet></router-outlet>`
14. Save `app.html`
15. Run `npm run build` and verify no errors

## Tests
- Automated: `npm run build` (verify compilation success, expect exit code 0)
- Manual: `npm start`, open `http://localhost:4200/`
- Manual: Verify VideoLandingComponent visible (iframe rendered with video embed)
- Manual: Navigate to `http://localhost:4200/foo`, verify redirect to root
- Manual: Check browser DevTools Console for errors (expect 0)
- Manual: Check Network tab, verify iframe request to `youtube-nocookie.com`
- Accessibility: Verify skip-link still functional if retained (optional)

## Commands to Run
```bash
npm run build
npm start
```

## Artifacts to Return
- Diff/summary of `app.routes.ts` changes (route definitions)
- Diff/summary of `app.ts` changes (removed imports, cleaned component)
- Diff/summary of `app.html` changes (simplified template)
- Build output confirming success
- Screenshot of VideoLandingComponent rendering at root path (optional)
- Verification of redirect behavior (navigation to invalid path redirects to root)

## Minimal Context Excerpts
> Source: Work-Decomposer-Output.md § 12.1 Epic 3: Update Routing and App Shell, Tasks 3.1-3.3 and § 4.2 AppComponent (Modified), § 4.3 App Routes (Modified)
> **Scope:** Update app.routes.ts to route '' to VideoLandingComponent, add wildcard redirect. Simplify app.ts to remove Header/Hero/Footer. Update app.html to contain only router-outlet. Retain skip-link if needed for accessibility.
> **Acceptance:** Routes updated, build succeeds, VideoLandingComponent renders at /, redirect works, no console errors, title shown in browser tab.

## Follow-ups if Blocked
- If app.routes.ts structure differs from expected, provide current route definitions
- If VideoLandingComponent import fails, verify file path and export (check `src/app/features/video-landing/video-landing.component.ts`)
- If build fails after changes, provide full error message and affected file paths
- If skip-link needs to be retained for accessibility, escalate with current skip-link implementation

---

> [!tip] Persistence
> Save as: `01-Projects/AGILE3D-Demo/Assignments/UoW-U08-Assignment.md`
> Link from: SE-Log-U08 and [[2025-10-27]] daily note
