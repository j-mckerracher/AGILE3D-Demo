---
tags: [assignment, uow, agent/work-assigner]
unit_id: "U05"
project: "[[01-Projects/AGILE3D-Demo]]"
status: "ready"
created: "2025-10-27"
links:
  se_work_log: "[[SE-Log-U05]]"
---

# UoW Assignment — U05

- Project: [[01-Projects/AGILE3D-Demo]]
- SE Work Log: [[SE-Log-U05]]
- Daily note: [[2025-10-27]]

## Task Overview
Implement the new VideoLandingComponent as the primary feature, displaying an embedded video with responsive layout and error handling. This is the core new functionality replacing the 3D demo.

## Success Criteria
- [ ] VideoLandingComponent renders with `standalone: true` and `ChangeDetectionStrategy.OnPush`
- [ ] Iframe element present with `src='https://www.youtube-nocookie.com/embed/{VIDEO_ID}'`
- [ ] Iframe has `title='AGILE3D Demo Overview'` for accessibility
- [ ] Iframe has `allow='picture-in-picture; encrypted-media'` (or more permissive as needed)
- [ ] Iframe has `referrerpolicy='strict-origin-when-cross-origin'` for privacy
- [ ] Iframe has `loading='lazy'` for performance
- [ ] Responsive container maintains 16:9 aspect ratio on mobile (320px) and desktop (1920px)
- [ ] Preconnect link added to DOM for `https://www.youtube-nocookie.com`
- [ ] `onIframeLoad` sets `iframeLoaded = true`
- [ ] `onIframeError` sets `errorState = true` and shows fallback message
- [ ] Fallback message includes link to video URL with `rel='noopener noreferrer'`
- [ ] Visually-hidden heading present for accessibility
- [ ] No console errors when component renders
- [ ] SCSS follows BEM naming: `.video-landing`, `.video-landing__container`, `.video-landing__iframe`, etc.
- [ ] Component loads in <500ms (no heavy initialization)

## Constraints and Guardrails
- ≤3 files created (component, template, styles)
- ≤250 LOC total
- Use inline videoConfig constant (Option A per decomposition)
- Use placeholder VIDEO_ID 'dQw4w9WgXcQ' if not provided; mark with TODO comment
- No secrets or sensitive data
- Do not commit unless explicitly instructed

## Dependencies
[[U04]]

## Files to Read First
- `src/app/features/header/header.component.ts` (reference for standalone component pattern)

## Files to Edit or Create
**CREATE:**
- `src/app/features/video-landing/video-landing.component.ts`
- `src/app/features/video-landing/video-landing.component.html`
- `src/app/features/video-landing/video-landing.component.scss`

## Implementation Steps
1. Create directory: `mkdir -p src/app/features/video-landing/`
2. Create TypeScript component with:
   - `@Component` decorator: `selector: 'app-video-landing'`, `standalone: true`, `changeDetection: ChangeDetectionStrategy.OnPush`
   - Inline `videoConfig` constant with `VIDEO_ID: 'dQw4w9WgXcQ'` (TODO: replace with actual)
   - Component class with `iframeLoaded = false`, `errorState = false`
   - `ngOnInit` method adding preconnect link to DOM
   - `onIframeLoad()` method setting `iframeLoaded = true`
   - `onIframeError()` method setting `errorState = true`
   - Constructor with `@Inject(DOCUMENT)` for preconnect manipulation
3. Create HTML template with:
   - Preconnect link in template or dynamically added (can use ngOnInit)
   - Visually-hidden heading `<h1 class="visually-hidden">AGILE3D Demo</h1>`
   - Main container div with 16:9 aspect ratio (use padding-bottom hack or aspect-ratio CSS)
   - Iframe with all required attributes
   - Fallback error message with link (hidden by default, shown when `errorState`)
4. Create SCSS stylesheet with:
   - `.video-landing` container with max-width
   - `.video-landing__container` with aspect ratio (16:9)
   - `.video-landing__iframe` with 100% dimensions
   - `.video-landing__error-message` for fallback UI
   - `.visually-hidden` utility class for accessible headings
   - Mobile-first responsive design
5. Test component renders without console errors
6. Verify iframe src contains youtube-nocookie.com and VIDEO_ID

## Tests
- Manual: Start dev server (`npm start`), temporarily add VideoLandingComponent to app.ts to preview
- Manual: Resize browser window to verify responsive behavior (16:9 maintained from 320px to 1920px)
- Manual: Use DevTools to simulate iframe error (block iframe load) and verify fallback appears
- Manual: Check DOM for preconnect link with `href='https://www.youtube-nocookie.com'`
- Manual: Verify iframe src contains `youtube-nocookie.com` and VIDEO_ID
- Accessibility: Tab through page with keyboard, verify heading announced by screen reader (optional)
- Manual: Open DevTools Console, verify 0 errors when component loads

## Commands to Run
```bash
npm start
npm run lint
```

## Artifacts to Return
- Three new files: `video-landing.component.ts`, `video-landing.component.html`, `video-landing.component.scss`
- Screenshot or description of component rendering in browser
- Verification that iframe src is correct
- Confirmation that preconnect link present in DOM
- Lint output showing 0 errors for new files
- TODO comment location if using placeholder VIDEO_ID

## Minimal Context Excerpts
> Source: Work-Decomposer-Output.md § 12.1 Epic 2: Implement VideoLandingComponent, Tasks 2.1-2.6 and § 4.1 VideoLandingComponent
> **Scope:** Create VideoLandingComponent with inline videoConfig. Implement responsive 16:9 iframe with preconnect, lazy loading, privacy headers. Add error handling and visually-hidden heading. Use BEM CSS.
> **Acceptance:** Standalone component, responsive layout, preconnect link, iframe with correct attributes, error fallback, accessibility support, <500ms load time.

## Follow-ups if Blocked
- If actual VIDEO_ID provided, replace placeholder in videoConfig
- If preconnect not rendering in DOM, verify DOCUMENT injection and ngOnInit logic
- If iframe event handlers not triggering, manually dispatch events in tests
- If responsive behavior breaks on specific viewport, provide viewport width and screenshot

---

> [!tip] Persistence
> Save as: `01-Projects/AGILE3D-Demo/Assignments/UoW-U05-Assignment.md`
> Link from: SE-Log-U05 and [[2025-10-27]] daily note
