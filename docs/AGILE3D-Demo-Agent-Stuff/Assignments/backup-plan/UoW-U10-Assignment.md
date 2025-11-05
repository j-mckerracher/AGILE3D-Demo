---
tags: [assignment, uow, agent/work-assigner]
unit_id: "U10"
project: "[[01-Projects/AGILE3D-Demo]]"
status: "ready"
created: "2025-10-27"
links:
  se_work_log: "[[SE-Log-U10]]"
---

# UoW Assignment — U10

- Project: [[01-Projects/AGILE3D-Demo]]
- SE Work Log: [[SE-Log-U10]]
- Daily note: [[2025-10-27]]

## Task Overview
Document the backup video-only branch purpose, setup, and video URL change process in README.md. This ensures new developers can quickly onboard and understand the simplified architecture.

## Success Criteria
- [ ] README.md has dedicated 'Backup Video-Only Branch' section
- [ ] Section explains purpose: fallback for NSF demo without 3D dependencies
- [ ] Quick Start instructions included: `git clone`, checkout branch, `npm ci`, `npm start`
- [ ] Video URL change process documented with file paths and line numbers
- [ ] Build/deploy instructions included: `npm run build:prod`, hosting platform deployment
- [ ] Acceptance checklist included matching Definition of Done criteria
- [ ] Troubleshooting section covers: CSP, caching, Brotli, iframe errors
- [ ] Documentation clear enough for new developer to set up in <15 minutes
- [ ] Markdown formatting valid (no broken links, proper headers, code blocks)

## Constraints and Guardrails
- ≤1 file modified (README.md)
- ≤150 LOC total additions
- No scope creep; only document backup branch specifics
- Avoid duplicating general project documentation (link to it instead)
- Do not commit unless explicitly instructed

## Dependencies
[[U05]]

## Files to Read First
- `README.md` (current documentation structure)
- `src/app/features/video-landing/video-landing.component.ts` (to reference VIDEO_ID location)
- `package.json` (to verify build scripts exist)

## Files to Edit or Create
**EDIT:**
- `README.md` (add Backup Video-Only Branch section)

## Implementation Steps
1. Open README.md and locate where to insert Backup Video-Only Branch section (typically after main intro or in a separate section)
2. Add section heading: `## Backup Video-Only Branch` (use ## for consistency with existing structure)
3. Add subsection: `### Purpose` - explain this is a deadline-safe fallback for NSF demo, no 3D dependencies
4. Add subsection: `### What Was Removed` - list: 3D rendering, control panel, metrics dashboard, simulation, camera controls
5. Add subsection: `### What Remains` - explain: Single VideoLandingComponent with embedded video iframe
6. Add subsection: `### Quick Start` with ordered steps:
   - `git clone <repo-url>`
   - `git checkout backup-video-only` (or applicable branch name)
   - `npm ci` (clean install)
   - `npm start`
   - Open `http://localhost:4200`
7. Add subsection: `### Changing the Video URL` with instructions:
   - File path: `src/app/features/video-landing/video-landing.component.ts`
   - Line number where videoConfig is defined
   - Instructions for editing VIDEO_ID value (use placeholder or actual)
   - Example of updated config
8. Add subsection: `### Build and Deployment` with:
   - `npm run build:prod` command
   - Output location: `dist/agile3d-demo/browser/`
   - Deployment to Vercel (or selected platform) instructions
   - Environment variable setup if needed
9. Add subsection: `### Acceptance Checklist` with checklist items:
   - Build completes without errors
   - Tests pass
   - Lint passes
   - Video displays in iframe
   - Responsive layout works (mobile, tablet, desktop)
   - Error fallback appears when iframe blocked
   - No console errors
10. Add subsection: `### Troubleshooting` with common issues:
    - CSP blocks iframe: solution
    - Cache issues: clear browser cache or hard refresh
    - Brotli not installed: `sudo apt-get install -y brotli`
    - Iframe shows error: check video URL and internet connection
11. Add link to micro-level plan document if hosted in repository
12. Verify Markdown syntax (headers, code blocks, links)
13. Save README.md

## Tests
- Manual: Read through README.md from perspective of new developer
- Manual: Follow Quick Start instructions on fresh clone, verify successful setup
- Manual: Follow 'Changing Video URL' instructions, verify URL changes correctly in source
- Manual: Verify all code blocks have correct syntax highlighting (````bash`, ````typescript`, etc.)
- Manual: Check for broken internal links (if any)
- Automated: Run Markdown linter if available (e.g., `markdownlint` or similar)

## Commands to Run
```bash
npm ci
npm start
```

## Artifacts to Return
- Diff/summary of README.md additions (sections added)
- Verification that Quick Start instructions work on fresh clone
- Confirmation that video URL change instructions are accurate
- Markdown validation report (if linter available)
- Screenshot of rendered README in GitHub/GitLab (showing formatting)

## Minimal Context Excerpts
> Source: Work-Decomposer-Output.md § 12.1 Epic 4: Documentation Updates, Tasks 4.1-4.4 and § 13 Runbooks and Developer Onboarding
> **Scope:** Add 'Backup Video-Only Branch' section to README. Document purpose, removed/retained features, quick start, video URL change process, build/deploy, acceptance checklist, troubleshooting.
> **Acceptance:** Clear section explaining branch purpose, Quick Start <15 minutes, video URL change documented with paths, build/deploy instructions, troubleshooting tips, valid Markdown formatting.

## Follow-ups if Blocked
- If README structure differs significantly from expected, provide current outline
- If micro-level plan not yet committed to repository, escalate with decision on documentation location
- If deployment platform details unclear, provide platform name and escalate for specific deploy instructions
- If Brotli installation steps differ on target platform, provide OS and escalate for corrected instructions

---

> [!tip] Persistence
> Save as: `01-Projects/AGILE3D-Demo/Assignments/UoW-U10-Assignment.md`
> Link from: SE-Log-U10 and [[2025-10-27]] daily note
