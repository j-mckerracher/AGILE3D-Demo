---
tags: [assignment, uow, agent/work-assigner]
unit_id: "U06"
project: "[[01-Projects/AGILE3D-Demo]]"
status: "ready"
created: "2025-10-27"
links:
  se_work_log: "[[SE-Log-U06]]"
---

# UoW Assignment — U06

- Project: [[01-Projects/AGILE3D-Demo]]
- SE Work Log: [[SE-Log-U06]]
- Daily note: [[2025-10-27]]

## Task Overview
Write comprehensive unit tests for VideoLandingComponent to achieve ≥70% code coverage and validate all functionality. This test suite ensures the component behaves correctly across all user scenarios.

## Success Criteria
- [ ] All 10+ test cases pass when running `npm test`
- [ ] Code coverage for VideoLandingComponent ≥70% (lines, branches, functions)
- [ ] Tests use `TestBed.configureTestingModule` with `imports: [VideoLandingComponent]`
- [ ] Tests properly await async `TestBed.configureTestingModule()`
- [ ] Tests call `fixture.detectChanges()` before assertions
- [ ] No test flakiness (tests pass consistently on 3+ consecutive runs)
- [ ] Tests complete in <5 seconds total
- [ ] All critical paths covered: creation, iframe rendering, load/error events, accessibility

## Constraints and Guardrails
- ≤1 file created (spec file)
- ≤150 LOC total
- Standalone component test pattern (no module imports)
- Use Jasmine/Karma conventions already in codebase
- No external API calls or mocking services (component is self-contained)
- Do not commit unless explicitly instructed

## Dependencies
[[U05]]

## Files to Read First
- `src/app/features/video-landing/video-landing.component.ts` (component under test)
- `src/app/features/video-landing/video-landing.component.html` (template to verify rendering)
- `src/app/features/header/header.component.spec.ts` (reference for standalone component tests)

## Files to Edit or Create
**CREATE:**
- `src/app/features/video-landing/video-landing.component.spec.ts`

## Implementation Steps
1. Create spec file with Jasmine/Karma setup
2. Import `TestBed`, `ComponentFixture`, `DebugElement` from Angular testing utilities
3. Import `VideoLandingComponent` from component file
4. Create `describe('VideoLandingComponent', ...)` block
5. Define `beforeEach` async block:
   - Call `TestBed.configureTestingModule({ imports: [VideoLandingComponent] })`
   - Create fixture and component instance
6. Add test: "should create" - verify component is truthy
7. Add test: "should render iframe with correct src" - query iframe, check src contains youtube-nocookie.com and VIDEO_ID
8. Add test: "should render iframe with title attribute" - verify iframe.title === 'AGILE3D Demo Overview'
9. Add test: "should render iframe with allow attribute" - verify iframe.allow includes 'picture-in-picture'
10. Add test: "should render iframe with referrerpolicy attribute" - verify iframe.referrerPolicy === 'strict-origin-when-cross-origin'
11. Add test: "should render iframe with loading lazy attribute" - verify iframe.loading === 'lazy'
12. Add test: "should set iframeLoaded to true on load event" - dispatch load event, verify iframeLoaded === true
13. Add test: "should set errorState to true on error event" - dispatch error event, verify errorState === true
14. Add test: "should display fallback message when errorState is true" - set errorState, detectChanges, query error message element
15. Add test: "should have accessible heading" - query heading with visually-hidden class
16. Add test: "should add preconnect link to DOM" - verify link element with rel='preconnect' and href='https://www.youtube-nocookie.com'
17. Run coverage check and add tests for any uncovered branches

## Tests
- Automated: `npm test` (run all tests, expect 100% pass rate)
- Automated: `npm test -- --code-coverage` (verify ≥70% coverage for video-landing.component.ts)
- Manual: Review coverage report in `coverage/index.html`, check uncovered lines
- Automated: `npm test -- --watch=false --browsers=ChromeHeadless` (CI mode)
- Flakiness test: Run `npm test 3` times consecutively, expect same results

## Commands to Run
```bash
npm test
npm test -- --code-coverage
```

## Artifacts to Return
- New spec file: `video-landing.component.spec.ts`
- Test output showing all tests pass
- Coverage report summary (percentage for lines, branches, functions)
- Confirmation of no test flakiness (3 consecutive runs)
- Any uncovered lines documented for future refinement

## Minimal Context Excerpts
> Source: Work-Decomposer-Output.md § 12.1 Epic 2: Implement VideoLandingComponent, Task 2.8 and § 10.2 Unit Tests
> **Scope:** Create spec file with 10+ test cases. Test component creation, iframe rendering, load/error events, accessibility. Achieve ≥70% coverage. Use Jasmine/Karma with TestBed standalone pattern.
> **Acceptance:** All tests pass, ≥70% coverage, no flakiness, <5 seconds total, all critical paths covered.

## Follow-ups if Blocked
- If iframe events don't trigger in test environment, use `fixture.debugElement.query()` and manually dispatch events
- If coverage tool shows low coverage on template bindings, focus on TypeScript coverage (template coverage is secondary)
- If tests are flaky, check for async timing issues and add `fakeAsync`/`tick` if needed
- If coverage <70%, provide list of uncovered lines for review

---

> [!tip] Persistence
> Save as: `01-Projects/AGILE3D-Demo/Assignments/UoW-U06-Assignment.md`
> Link from: SE-Log-U06 and [[2025-10-27]] daily note
