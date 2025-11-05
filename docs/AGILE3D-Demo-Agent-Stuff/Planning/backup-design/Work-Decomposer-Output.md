{
    "plan_title": "AGILE3D Demo - Backup Video-Only Version: Work Decomposition",
    "context_budget_tokens": 6000,
    "units": [
      {
        "id": "U01",
        "title": "Delete 3D Feature Components",
        "goal": "Remove all 3D-specific feature components from the codebase to eliminate interactive demo functionality",
        "scope": [
          "Delete dual-viewer feature directory and all files",
          "Delete scene-viewer feature directory and all files",
          "Delete camera-controls feature directory and all files",
          "Delete metrics-dashboard feature directory and all files",
          "Delete current-configuration feature directory and all files",
          "Delete control-panel feature directory and all files",
          "Delete main-demo feature directory and all files",
          "Verify no broken imports remain from deleted components"
        ],
        "traceability": {
          "micro_sections": ["§12.1 Epic 1: Repository Cleanup, Task 1.1"],
          "meso_refs": ["§2 Approved Meso-Level Plan: Remove 3D point cloud code"]
        },
        "dependencies": [],
        "inputs_required": [],
        "files_to_read": [
          "src/app/features/**/*"
        ],
        "files_to_edit_or_create": [
          "DELETE: src/app/features/dual-viewer/",
          "DELETE: src/app/features/scene-viewer/",
          "DELETE: src/app/features/camera-controls/",
          "DELETE: src/app/features/metrics-dashboard/",
          "DELETE: src/app/features/current-configuration/",
          "DELETE: src/app/features/control-panel/",
          "DELETE: src/app/features/main-demo/"
        ],
        "acceptance_criteria": [
          "All specified feature directories completely removed from filesystem",
          "No import statements referencing deleted components remain in codebase",
          "npm run lint completes without errors related to missing modules",
          "File count reduction verified (check src/app/features/ contains only header, hero, footer, skip-link, theme-toggle, legend, error-banner)"
        ],
        "test_plan": [
          "Manual: Verify directories deleted via ls -la src/app/features/",
          "Automated: Run grep -r 'dual-viewer\\|scene-viewer\\|camera-controls\\|metrics-dashboard\\|current-configuration\\|control-panel\\|main-demo' src/ to find stray imports",
          "Automated: npm run lint (expect 0 errors about missing components)",
          "Manual: Review git status to confirm deletions staged"
        ],
        "risk_assumptions": [
          "Assumes no other modules have hard dependencies on these components outside of routing",
          "Assumes deletions won't break existing tests (tests will be fixed in U04)",
          "Risk: Shared utilities in deleted directories may be referenced elsewhere (mitigation: search imports first)"
        ],
        "est_impl_tokens": 1500,
        "max_changes": {
          "files": 50,
          "loc": 0
        }
      },
      {
        "id": "U02",
        "title": "Delete 3D Core Services",
        "goal": "Remove all 3D rendering, visualization, and simulation services to eliminate dependencies on Three.js",
        "scope": [
          "Delete rendering services directory (render-loop, etc.)",
          "Delete controls services directory (camera-control, etc.)",
          "Delete visualization services directory (bbox-instancing, detection-diff, etc.)",
          "Delete data services directory (scene-data, scene-tier-manager, paper-data, etc.)",
          "Delete simulation services directory (simulation, synthetic-detection-variation, etc.)",
          "Delete metrics services directory (metrics-history, etc.)",
          "Delete viewer-style-adapter service from theme directory",
          "Verify no broken service imports remain"
        ],
        "traceability": {
          "micro_sections": ["§12.1 Epic 1: Repository Cleanup, Task 1.2"],
          "meso_refs": ["§2 Approved Meso-Level Plan: Remove 3D dependencies"]
        },
        "dependencies": [],
        "inputs_required": [],
        "files_to_read": [
          "src/app/core/services/**/*",
          "src/app/core/theme/**/*"
        ],
        "files_to_edit_or_create": [
          "DELETE: src/app/core/services/rendering/",
          "DELETE: src/app/core/services/controls/",
          "DELETE: src/app/core/services/visualization/",
          "DELETE: src/app/core/services/data/",
          "DELETE: src/app/core/services/simulation/",
          "DELETE: src/app/core/services/metrics/",
          "DELETE: src/app/core/theme/viewer-style-adapter.service.ts",
          "DELETE: src/app/core/theme/viewer-style-adapter.service.spec.ts"
        ],
        "acceptance_criteria": [
          "All specified service directories completely removed",
          "viewer-style-adapter service files deleted",
          "No import statements referencing deleted services remain",
          "State and runtime services retained (may be needed for config/theme)",
          "npm run lint completes without errors related to missing services"
        ],
        "test_plan": [
          "Manual: Verify directories deleted via ls -la src/app/core/services/",
          "Automated: Run grep -r 'render-loop\\|camera-control\\|bbox-instancing\\|scene-data\\|simulation\\|metrics-history\\|viewer-style-adapter' src/ --exclude-dir=node_modules",
          "Automated: npm run lint (expect 0 errors about missing services)",
          "Manual: Verify state/ and runtime/ services still exist (if needed)"
        ],
        "risk_assumptions": [
          "Assumes state and runtime services are not 3D-specific and may be reused",
          "Assumes theme.service.ts can function without viewer-style-adapter",
          "Risk: StateService may have 3D-specific code (mitigation: review in U04)"
        ],
        "est_impl_tokens": 1500,
        "max_changes": {
          "files": 40,
          "loc": 0
        }
      },
      {
        "id": "U03",
        "title": "Delete 3D Assets and Remove Dependencies",
        "goal": "Remove 3D scene assets and Three.js dependencies from package.json to minimize bundle size",
        "scope": [
          "Delete assets/scenes/ directory (3D scene data)",
          "Delete assets/workers/ directory (web workers for 3D processing)",
          "Remove 'three' package from package.json dependencies",
          "Remove 'angular-three' package from package.json dependencies",
          "Remove '@types/three' package from package.json devDependencies",
          "Run npm install to regenerate package-lock.json",
          "Verify no Three.js references in dependency tree"
        ],
        "traceability": {
          "micro_sections": ["§12.1 Epic 1: Repository Cleanup, Tasks 1.3, 1.4", "§1.3 Removed Dependencies"],
          "meso_refs": ["§2 Key Architectural Decisions: No 3D rendering"]
        },
        "dependencies": [],
        "inputs_required": [],
        "files_to_read": [
          "package.json",
          "src/assets/**/*"
        ],
        "files_to_edit_or_create": [
          "DELETE: src/assets/scenes/",
          "DELETE: src/assets/workers/",
          "EDIT: package.json"
        ],
        "acceptance_criteria": [
          "assets/scenes/ and assets/workers/ directories deleted",
          "package.json no longer contains 'three', 'angular-three', '@types/three'",
          "package-lock.json regenerated successfully",
          "npm ls three returns 'npm ERR! missing: three' (confirms removal)",
          "Total node_modules size reduced (Three.js is ~1MB)",
          "Retained Angular dependencies: @angular/core, @angular/common, @angular/router, rxjs, zone.js"
        ],
        "test_plan": [
          "Manual: ls -la src/assets/ (should show only data/ directory)",
          "Automated: grep -E '\"(three|angular-three)\"' package.json (should return no matches)",
          "Automated: npm ls three 2>&1 | grep 'npm ERR! missing' (confirms not installed)",
          "Automated: npm install (should complete without errors)",
          "Manual: Check node_modules size before/after (expect ~1-2MB reduction)"
        ],
        "risk_assumptions": [
          "Assumes no other dependencies transitively depend on Three.js",
          "Assumes assets/data/ is not 3D-specific and should be retained (contains config)",
          "Risk: npm install may fail if lockfile corruption occurs (mitigation: delete node_modules and retry)"
        ],
        "est_impl_tokens": 1000,
        "max_changes": {
          "files": 3,
          "loc": 10
        }
      },
      {
        "id": "U04",
        "title": "Verify Build and Fix Import Errors",
        "goal": "Ensure codebase compiles successfully after 3D code removal and fix any remaining broken imports or tests",
        "scope": [
          "Run npm run build to identify compilation errors",
          "Fix any broken imports in remaining files (app.ts, shared components, etc.)",
          "Remove or update barrel exports (index.ts files) that reference deleted modules",
          "Delete 3D-related spec files that test deleted components/services",
          "Update any TypeScript interfaces/models that reference deleted types",
          "Run npm run lint and fix any linting errors",
          "Run npm test to verify no test failures from deleted code",
          "Document all fixes made for traceability"
        ],
        "traceability": {
          "micro_sections": ["§12.1 Epic 1: Repository Cleanup, Tasks 1.5, 1.6"],
          "meso_refs": ["§2 Constraints: Retain existing build/test/lint infrastructure"]
        },
        "dependencies": ["U01", "U02", "U03"],
        "inputs_required": [],
        "files_to_read": [
          "src/app/app.ts",
          "src/app/**/*.spec.ts",
          "src/app/**/index.ts",
          "src/app/core/models/**/*.ts"
        ],
        "files_to_edit_or_create": [
          "EDIT: src/app/app.ts (remove deleted component imports)",
          "EDIT: src/app/app.html (remove deleted component selectors)",
          "DELETE: src/app/**/*.spec.ts (for deleted components/services)",
          "EDIT: To be discovered during build (broken imports)",
          "EDIT: src/app/core/models/*.ts (if referencing deleted types)"
        ],
        "acceptance_criteria": [
          "npm run build completes with exit code 0 (no TypeScript errors)",
          "npm run lint completes with exit code 0 (no ESLint errors)",
          "npm test completes with exit code 0 (no failing tests)",
          "No import statements referencing deleted 3D code remain",
          "All barrel exports (index.ts) updated to remove deleted modules",
          "Build output size reduced compared to baseline (due to removed dependencies)",
          "Zero console warnings about missing modules during build"
        ],
        "test_plan": [
          "Automated: npm run build (expect success)",
          "Automated: npm run lint (expect 0 errors)",
          "Automated: npm test (expect all tests pass)",
          "Automated: grep -r 'from.*three' src/ --include='*.ts' (should return 0 matches)",
          "Manual: Review build output in dist/ to verify no Three.js bundles",
          "Performance: Measure build time (should be faster without 3D compilation)"
        ],
        "risk_assumptions": [
          "Assumes majority of imports are in deleted files; remaining fixes should be minimal (<10 files)",
          "Assumes no shared utilities in deleted directories are critical to retained code",
          "Risk: app.ts may have complex dependencies on deleted components (mitigation: simplify to minimal shell per §4.2)",
          "Risk: Tests may fail due to missing test utilities (mitigation: delete affected tests)"
        ],
        "est_impl_tokens": 2000,
        "max_changes": {
          "files": 15,
          "loc": 100
        }
      },
      {
        "id": "U05",
        "title": "Create VideoLandingComponent with Inline Configuration",
        "goal": "Implement the new VideoLandingComponent as the primary feature, displaying an embedded video with responsive layout and error handling",
        "scope": [
          "Create video-landing/ directory under src/app/features/",
          "Implement VideoLandingComponent TypeScript class with inline videoConfig constant (Option A)",
          "Add preconnect link to video host domain in ngOnInit for performance",
          "Implement onIframeLoad and onIframeError event handlers",
          "Create HTML template with responsive 16:9 aspect ratio container",
          "Add iframe with correct attributes: title, src, allow, referrerpolicy, loading=lazy",
          "Add fallback error message with direct video link",
          "Create SCSS stylesheet with BEM methodology for responsive design",
          "Add visually-hidden heading for accessibility",
          "Use OnPush change detection for performance"
        ],
        "traceability": {
          "micro_sections": ["§12.1 Epic 2: Implement VideoLandingComponent, Tasks 2.1-2.6", "§4.1 VideoLandingComponent", "§4.1 Public Interface"],
          "meso_refs": ["§2 Key Architectural Decisions: Iframe embed from external video platform", "§2 NFRs: Responsive, Privacy"]
        },
        "dependencies": ["U04"],
        "inputs_required": [
          "VIDEO_ID (YouTube video ID; use placeholder 'dQw4w9WgXcQ' if not provided)"
        ],
        "files_to_read": [
          "src/app/features/header/header.component.ts (reference for standalone component pattern)"
        ],
        "files_to_edit_or_create": [
          "CREATE: src/app/features/video-landing/video-landing.component.ts",
          "CREATE: src/app/features/video-landing/video-landing.component.html",
          "CREATE: src/app/features/video-landing/video-landing.component.scss"
        ],
        "acceptance_criteria": [
          "VideoLandingComponent renders with standalone: true and ChangeDetectionStrategy.OnPush",
          "Iframe element present with src='https://www.youtube-nocookie.com/embed/{VIDEO_ID}'",
          "Iframe has title attribute 'AGILE3D Demo Overview' for accessibility",
          "Iframe has allow attribute including 'picture-in-picture; encrypted-media'",
          "Iframe has referrerpolicy='strict-origin-when-cross-origin' for privacy",
          "Iframe has loading='lazy' for performance",
          "Responsive container maintains 16:9 aspect ratio on mobile (320px) and desktop (1920px)",
          "Preconnect link added to DOM for 'https://www.youtube-nocookie.com'",
          "onIframeLoad sets iframeLoaded = true",
          "onIframeError sets errorState = true and shows fallback message",
          "Fallback message includes link to video URL with rel='noopener noreferrer'",
          "Heading present with visually-hidden class (accessibility)",
          "No console errors when component renders",
          "SCSS follows BEM naming: .video-landing, .video-landing__container, .video-landing__iframe, etc.",
          "Performance: Component loads in <500ms (no heavy initialization)"
        ],
        "test_plan": [
          "Manual: Start dev server (npm start), navigate to / route (will fail until U08)",
          "Manual: Temporarily add VideoLandingComponent to app.ts to preview",
          "Manual: Resize browser window to verify responsive behavior (16:9 maintained)",
          "Manual: Use DevTools to simulate iframe error (block iframe load) and verify fallback appears",
          "Manual: Check DOM for preconnect link with href='https://www.youtube-nocookie.com'",
          "Manual: Verify iframe src contains 'youtube-nocookie.com' and VIDEO_ID",
          "Accessibility: Tab through page with keyboard, verify heading announced by screen reader (optional)"
        ],
        "risk_assumptions": [
          "Assumes user accepts Option A (inline constant) for video URL configuration",
          "Assumes YouTube privacy-enhanced embed is acceptable (youtube-nocookie.com)",
          "Assumes no autoplay required (NFR specifies no autoplay)",
          "Risk: VIDEO_ID not provided (mitigation: use placeholder 'dQw4w9WgXcQ' with clear TODO comment)",
          "Risk: CSP may block iframe during testing (mitigation: defer CSP config to U12, test without CSP first)"
        ],
        "est_impl_tokens": 2500,
        "max_changes": {
          "files": 3,
          "loc": 250
        }
      },
      {
        "id": "U06",
        "title": "Create VideoLandingComponent Unit Tests",
        "goal": "Write comprehensive unit tests for VideoLandingComponent to achieve ≥70% code coverage and validate all functionality",
        "scope": [
          "Create video-landing.component.spec.ts with Jasmine/Karma setup",
          "Test: Component creation (should be truthy)",
          "Test: Iframe renders with correct src containing 'youtube-nocookie.com'",
          "Test: Iframe has correct title attribute",
          "Test: Iframe has correct allow attribute including 'picture-in-picture'",
          "Test: Iframe has correct referrerpolicy attribute",
          "Test: Iframe has loading='lazy' attribute",
          "Test: iframeLoaded set to true on load event",
          "Test: errorState set to true on iframe error event",
          "Test: Fallback message displayed when errorState is true",
          "Test: Accessible heading present with visually-hidden class",
          "Configure test to import VideoLandingComponent standalone",
          "Ensure tests run in isolation without requiring full app bootstrap"
        ],
        "traceability": {
          "micro_sections": ["§12.1 Epic 2: Implement VideoLandingComponent, Task 2.8", "§10.2 Unit Tests"],
          "meso_refs": ["§2 Constraints: Retain existing build/test/lint infrastructure"]
        },
        "dependencies": ["U05"],
        "inputs_required": [],
        "files_to_read": [
          "src/app/features/video-landing/video-landing.component.ts",
          "src/app/features/video-landing/video-landing.component.html",
          "src/app/features/header/header.component.spec.ts (reference for standalone component tests)"
        ],
        "files_to_edit_or_create": [
          "CREATE: src/app/features/video-landing/video-landing.component.spec.ts"
        ],
        "acceptance_criteria": [
          "All 10+ test cases pass when running npm test",
          "Code coverage for VideoLandingComponent ≥70% (lines, branches, functions)",
          "Tests use TestBed.configureTestingModule with imports: [VideoLandingComponent]",
          "Tests properly await async TestBed.configureTestingModule()",
          "Tests call fixture.detectChanges() before assertions",
          "No test flakiness (tests pass consistently on 3+ consecutive runs)",
          "Tests complete in <5 seconds total",
          "All critical paths covered: creation, iframe rendering, load/error events, accessibility"
        ],
        "test_plan": [
          "Automated: npm test (run all tests, expect 100% pass rate)",
          "Automated: npm test -- --code-coverage (verify ≥70% coverage for video-landing.component.ts)",
          "Manual: Review coverage report in coverage/index.html, check uncovered lines",
          "Automated: npm test -- --watch=false --browsers=ChromeHeadless (CI mode)",
          "Flakiness test: Run npm test 3 times consecutively, expect same results"
        ],
        "risk_assumptions": [
          "Assumes Jasmine/Karma already configured in existing project (per micro-plan §1.2)",
          "Assumes ChromeHeadless available for CI testing",
          "Risk: Iframe events may not trigger in test environment (mitigation: manually dispatch events)",
          "Risk: Coverage tool may not detect dynamic template bindings (mitigation: focus on TS coverage)"
        ],
        "est_impl_tokens": 2000,
        "max_changes": {
          "files": 1,
          "loc": 150
        }
      },
      {
        "id": "U08",
        "title": "Update App Routes and Simplify App Shell",
        "goal": "Configure routing to load VideoLandingComponent at root path and simplify AppComponent to minimal shell with only router outlet",
        "scope": [
          "Update app.routes.ts to route '' (root) to VideoLandingComponent",
          "Update wildcard route '**' to redirect to ''",
          "Add title: 'AGILE3D Demo' to root route",
          "Simplify app.ts (AppComponent) to remove Header, Hero, Footer imports",
          "Update app.html template to contain only <router-outlet></router-outlet>",
          "Remove skip-link if no longer needed (or retain for accessibility to main content)",
          "Verify no other routes reference deleted components",
          "Test manual navigation to / route loads VideoLandingComponent"
        ],
        "traceability": {
          "micro_sections": ["§12.1 Epic 3: Update Routing and App Shell, Tasks 3.1-3.3", "§4.2 AppComponent (Modified)", "§4.3 App Routes (Modified)"],
          "meso_refs": ["§2 Key Architectural Decisions: Minimal client layering"]
        },
        "dependencies": ["U05"],
        "inputs_required": [],
        "files_to_read": [
          "src/app/app.routes.ts",
          "src/app/app.ts",
          "src/app/app.html"
        ],
        "files_to_edit_or_create": [
          "EDIT: src/app/app.routes.ts (change route to VideoLandingComponent)",
          "EDIT: src/app/app.ts (remove Header/Hero/Footer imports, simplify to RouterOutlet only)",
          "EDIT: src/app/app.html (change to '<router-outlet></router-outlet>' only)"
        ],
        "acceptance_criteria": [
          "app.routes.ts has route { path: '', component: VideoLandingComponent, pathMatch: 'full' }",
          "app.routes.ts has wildcard route { path: '**', redirectTo: '' }",
          "app.ts imports only: Component, RouterOutlet (no Header/Hero/Footer)",
          "app.html contains only '<router-outlet></router-outlet>' (or '<router-outlet />')",
          "npm run build succeeds with no errors",
          "Manual test: Navigate to http://localhost:4200/, verify VideoLandingComponent renders",
          "Manual test: Navigate to http://localhost:4200/invalid-path, verify redirect to root",
          "Page title in browser tab shows 'AGILE3D Demo' (or configured title)",
          "No console errors or warnings in browser DevTools"
        ],
        "test_plan": [
          "Automated: npm run build (verify compilation success)",
          "Manual: npm start, open http://localhost:4200/",
          "Manual: Verify VideoLandingComponent visible (iframe rendered)",
          "Manual: Navigate to http://localhost:4200/foo, verify redirect to root",
          "Manual: Check browser DevTools Console for errors (expect 0)",
          "Manual: Check Network tab, verify iframe request to youtube-nocookie.com",
          "Accessibility: Verify skip-link still functional if retained"
        ],
        "risk_assumptions": [
          "Assumes VideoLandingComponent is standalone and can be lazy-loaded if needed in future",
          "Assumes no need for Header/Hero/Footer in minimal backup version (per micro-plan §4.2)",
          "Risk: Users may expect header/footer (mitigation: document minimal design in README)",
          "Assumption: SkipLinkComponent removed or updated to target #main-content in VideoLandingComponent"
        ],
        "est_impl_tokens": 1500,
        "max_changes": {
          "files": 3,
          "loc": 30
        }
      },
      {
        "id": "U10",
        "title": "Update Documentation",
        "goal": "Document the backup video-only branch purpose, setup, and video URL change process in README.md",
        "scope": [
          "Add '## Backup Video-Only Branch' section to README.md",
          "Document branch purpose: deadline-safe fallback for NSF demo",
          "Document what was removed: 3D rendering, control panel, metrics, simulation",
          "Document what remains: Single VideoLandingComponent with iframe embed",
          "Add '### Quick Start' subsection with setup steps (clone, checkout, npm ci, npm start)",
          "Add '### Changing the Video URL' subsection with instructions for Option A (inline) and Option B (config.json) if implemented",
          "Add '### Build and Deployment' subsection with npm run build:prod, Netlify/Vercel deploy commands",
          "Add '### Acceptance Checklist' subsection mirroring §15 Definition of Done",
          "Add troubleshooting tips: CSP issues, cache issues, Brotli installation",
          "Link to micro-level plan document if hosted in repository"
        ],
        "traceability": {
          "micro_sections": ["§12.1 Epic 4: Documentation Updates, Tasks 4.1-4.4", "§13 Runbooks and Developer Onboarding"],
          "meso_refs": ["§2 Approved Meso-Level Plan summary"]
        },
        "dependencies": ["U05"],
        "inputs_required": [],
        "files_to_read": [
          "README.md"
        ],
        "files_to_edit_or_create": [
          "EDIT: README.md"
        ],
        "acceptance_criteria": [
          "README.md has dedicated 'Backup Video-Only Branch' section",
          "Section explains purpose: fallback for NSF demo without 3D dependencies",
          "Quick Start instructions included: git clone, checkout backup-video-only, npm ci, npm start",
          "Video URL change process documented with file paths and line numbers",
          "Build/deploy instructions included: npm run build:prod, hosting platform deployment",
          "Acceptance checklist included matching §15 Definition of Done",
          "Troubleshooting section covers: CSP, caching, Brotli, iframe errors",
          "Documentation clear enough for new developer to set up in <15 minutes",
          "Markdown formatting valid (no broken links, proper headers, code blocks)"
        ],
        "test_plan": [
          "Manual: Read through README.md from perspective of new developer",
          "Manual: Follow Quick Start instructions on fresh clone, verify successful setup",
          "Manual: Follow 'Changing Video URL' instructions, verify URL changes correctly",
          "Manual: Verify all code blocks have correct syntax highlighting (```bash, ```typescript, etc.)",
          "Manual: Check for broken internal links (if any)",
          "Automated: Run markdown linter if available (e.g., markdownlint)"
        ],
        "risk_assumptions": [
          "Assumes README.md exists and can be edited (not replacing entire file)",
          "Assumes user wants documentation in README vs separate docs/ folder",
          "Risk: README becomes too long with multiple branches documented (mitigation: use clear section headers)",
          "Assumption: Micro-level plan will be committed to repository for reference"
        ],
        "est_impl_tokens": 1500,
        "max_changes": {
          "files": 1,
          "loc": 150
        }
      },
      {
        "id": "U11",
        "title": "Configure CI/CD Pipeline",
        "goal": "Create GitHub Actions workflow for automated build, test, lint, and deployment to hosting platform",
        "scope": [
          "Create .github/workflows/ directory if not exists",
          "Create .github/workflows/backup-video-only.yml workflow file",
          "Configure triggers: push and pull_request on backup-video-only branch",
          "Add job: build-and-deploy running on ubuntu-latest",
          "Add steps: checkout (actions/checkout@v4), setup Node.js 20.x (actions/setup-node@v4 with cache: npm)",
          "Add step: npm ci (clean install dependencies)",
          "Add step: npm run lint (fail on errors)",
          "Add step: npm run format:check (Prettier conformance; add script to package.json if missing)",
          "Add step: npm test (unit tests with coverage)",
          "Add step: npm run build:prod (production build with compression)",
          "Add step: npm audit --audit-level=high (continue-on-error: true for logging)",
          "Add step: Deploy to Netlify (conditional on main branch push, uses netlify/actions/cli)",
          "Use GitHub Secrets for NETLIFY_AUTH_TOKEN and NETLIFY_SITE_ID",
          "Document required secrets in README.md"
        ],
        "traceability": {
          "micro_sections": ["§12.1 Epic 6: CI/CD Configuration, Tasks 6.1, 6.3", "§11.1 Pipeline Stages"],
          "meso_refs": ["§2 Constraints: Retain existing build/test/lint infrastructure"]
        },
        "dependencies": ["U09"],
        "inputs_required": [
          "NETLIFY_AUTH_TOKEN (GitHub Secret)",
          "NETLIFY_SITE_ID (GitHub Secret)"
        ],
        "files_to_read": [
          "package.json (to verify all scripts exist: lint, format:check, test, build:prod)"
        ],
        "files_to_edit_or_create": [
          "CREATE: .github/workflows/backup-video-only.yml",
          "EDIT: package.json (add format:check script if missing)"
        ],
        "acceptance_criteria": [
          ".github/workflows/backup-video-only.yml exists with valid YAML syntax",
          "Workflow triggers on push and pull_request to backup-video-only branch",
          "All required steps present: checkout, setup Node, npm ci, lint, format:check, test, build:prod, audit, deploy",
          "Node.js version pinned to 20.x with npm cache enabled",
          "Deploy step conditional on: github.ref == 'refs/heads/backup-video-only' && github.event_name == 'push'",
          "Netlify deploy uses: netlify/actions/cli@master with args: deploy --prod --dir=dist/agile3d-demo/browser",
          "Secrets NETLIFY_AUTH_TOKEN and NETLIFY_SITE_ID referenced in env",
          "npm audit uses continue-on-error: true (logs but doesn't fail build)",
          "Workflow completes in <5 minutes on typical commit",
          "All steps pass on sample push to backup-video-only branch"
        ],
        "test_plan": [
          "Manual: Push .github/workflows/backup-video-only.yml to branch",
          "Manual: Trigger workflow via push to backup-video-only branch",
          "Manual: Monitor GitHub Actions tab, verify all steps complete successfully",
          "Manual: Check workflow logs for each step (checkout, install, lint, test, build, deploy)",
          "Manual: Verify build:prod step creates .br files (check logs for 'Compressed: ...')",
          "Manual: Verify deploy step uploads to Netlify (check Netlify dashboard for new deployment)",
          "Error test: Introduce lint error, push, verify workflow fails at lint step",
          "Error test: Introduce test failure, push, verify workflow fails at test step"
        ],
        "risk_assumptions": [
          "Assumes GitHub Actions enabled for repository",
          "Assumes Netlify secrets will be added to GitHub repository settings",
          "Risk: Brotli not available in ubuntu-latest (mitigation: add 'sudo apt-get install -y brotli' step before build:prod)",
          "Risk: Netlify deploy may fail on first run if site not initialized (mitigation: create site manually in Netlify dashboard first)",
          "Assumption: format:check script defined as 'prettier --check \"src/**/*.{ts,html,scss}\"' in package.json"
        ],
        "est_impl_tokens": 2000,
        "max_changes": {
          "files": 2,
          "loc": 80
        }
      }
    ],
    "open_questions": [
      {
        "question": "What is the final YouTube VIDEO_ID or Vimeo video URL for the AGILE3D demo?",
        "blocks_units": ["U05", "U12"],
        "user_answer": "unknown"
      },
      {
        "question": "Should we implement Option A (inline constant) or Option B (config.json with ConfigService) for video URL configuration?",
        "blocks_units": ["U05", "U07"],
        "user_answer": "Option A"
      },
      {
        "question": "Which hosting platform should be used: Netlify (recommended), Vercel, or GitHub Pages?",
        "blocks_units": ["U12"],
        "user_answer": "Vercel. But I am going to do the work to host it."
      },
      {
        "question": "Should the Header, Hero, and Footer components be completely removed from the app shell (per §4.2) or optionally integrated into VideoLandingComponent?",
        "blocks_units": ["U08"],
        "user_answer": "no"
      }
    ]
  }