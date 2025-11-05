Session Inputs Received
- Macro-Level Plan (summary): Deliver a dedicated backup branch that removes all 3D code/assets/dependencies and presents a single externally hosted embedded video. No control panel, metrics, captions, or runtime toggles. Keep build/test/lint flows; minimal tests and documentation updates; target ~1 day.
- Constraints: External video hosting via {Video_Platform}; static hosting via {Static_Hosting_Option}; no observability; accessibility deprioritized; browser support: modern WebKit- and Chromium-based browsers.
- NFRs: Performance/privacy emphasis (small footprint, no autoplay), responsive layout.

Open Questions and Blocked Decisions
- Exact {Video_URL} (embed URL) and any provider parameters (blocks CSP allowlist and config value).
- Configuration approach for the video URL: inline constant vs static config.json (runtime swap not required; default inline unless requested).
- CSP specifics derived from the final embed URL (frame-src, img-src). Defaults provided below.
- Edge caching TTL preferences (HTML, assets, optional config.json). Defaults provided below; not blocking.

1. Architecture Overview and Rationale
- Selected architecture pattern(s) and justification
  - Static Client-Only Web App served via CDN/Static Hosting. Rationale: zero backend, minimal complexity, fastest delivery; aligns with video-only scope and macro plan.
  - Minimal client layering: {Presentation} + optional {Config_Adapter} supplying the embed URL.
- Alternatives considered and trade-offs
  - Keep existing frontend scaffold (pruned): +Lowest risk/change, +reuse CI; −slightly larger runtime than pure static.
  - Pure static HTML/CSS/JS: +Smallest footprint; −refactor cost and CI changes.
  - {SSG_Option} static export: +Clean structure/build artifacts; −setup overhead vs 1-day target.
- Alignment
  - Meets macro goals to remove 3D code/assets/deps, show a single external video, and retain existing build/test/lint with minimal change.

2. System Decomposition
- Modules/components
  - {Web_Client}: Renders the landing page with a responsive 16:9 embed; no autoplay; minimal CSS/JS.
  - {Config_Adapter} (optional): GETs a small static JSON (config.json) containing {Video_URL} and title; graceful fallback if load fails.
  - {Static_Assets_Bucket/CDN}: Serves HTML/CSS/JS (and optional config.json) with proper caching and TLS.
  - {External_Video_Platform}: Hosts the embedded player via iframe.
  - {CI_Pipeline}: Lint/build/test; publish static artifacts; atomic deploy/rollback.
- Communication styles
  - Sync: Browser → CDN (assets, optional config.json); Browser → {External_Video_Platform} (iframe).
- C4 Context
  ```mermaid path=null start=null
  C4Context
    title C4 Context
    Person(User, "End User")
    System_Boundary(App, "{Project_Name} Video-Only Site"){
      System(Web, "Static Web Client")
    }
    System_Ext(Video, "External Video Platform")
    Rel(User, Web, "HTTPS")
    Rel(Web, Video, "Iframe embed")
  ```
- C4 Container
  ```mermaid path=null start=null
  C4Container
    title C4 Container
    Container(Web, "{Web_Client}", "HTML/CSS/JS")
    Container(CDN, "{Static_Assets_Bucket/CDN}", "Static Hosting/CDN")
    Container(Config, "{Config_Adapter}", "Static JSON (optional)")
    Container(Video, "{External_Video_Platform}", "Hosted Player")
    Rel(User, CDN, "HTTPS")
    Rel(CDN, Web, "Serve assets")
    Rel(Web, Config, "GET /config.json (optional)")
    Rel(Web, Video, "iframe src")
  ```

3. Data and Interface Design
- Domain model and key entities
  - None (no business data). Optional configuration entity: {VideoConfig}.
- Core schemas (outline)
  - {VideoConfig}
    - title: string
    - embedUrl: string (provider embed URL)
    - provider: enum {Video_Platform_A|Video_Platform_B}
    - allow: string (e.g., "accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share")
    - referrerPolicy: string (e.g., "strict-origin-when-cross-origin")
- Storage models, indexing/caching, lifecycle/retention
  - Static artifacts only. If using config.json: cache with ETag and modest max-age (e.g., minutes); HTML no-cache or short TTL for fast rollbacks; assets fingerprinted and long-lived.
  - No PII storage; no server persistence.
- APIs/interfaces
  - Internal: Optional GET /config.json; version via schemaVersion field or filename if needed later.
  - Auth: None (public). Error handling: If config fetch fails, render fallback message with a direct link to {Video_URL}.
- End-to-end flows
  ```mermaid path=null start=null
  sequenceDiagram
    autonumber
    participant U as User
    participant C as CDN
    participant W as Web Client
    participant V as External Video
    U->>C: GET /
    C-->>U: 200 HTML
    U->>C: GET CSS/JS
    Note over W: Initialize page
    alt using config.json
      W->>C: GET /config.json
      C-->>W: 200 JSON
    end
    W->>V: iframe src=embedUrl
    V-->>W: Player UI loads (no autoplay)
  ```

4. Technology Choices and Rationale
- Primary runtime/language/framework
  - Option A: Keep current {Frontend_Framework} scaffold, delete 3D modules. +Low risk; +existing CI; −slightly larger runtime.
  - Option B: Pure static HTML/CSS/JS page. +Smallest footprint; −refactor/CI updates.
  - Option C: {SSG_Option} with static export. +Clean structure; −setup cost.
  - Recommendation: Option A for 1-day delivery; revisit B/C later if further trimming is desired.
- Persistence/storage
  - None. Static hosting via {Static_Hosting_Option} with global edge CDN.
- Caching
  - Immutable fingerprinted assets (Cache-Control: public, max-age=31536000, immutable).
  - HTML: no-cache or very short TTL. config.json (if used): short TTL (e.g., 5 minutes).
- Messaging/search
  - Not applicable.
- Integration approach
  - Iframe embed using provider-recommended privacy-enhanced domain if available; attributes: title, loading="lazy", allow (exclude autoplay), referrerpolicy.

5. Integration Points
- External systems and adapters
  - {External_Video_Platform} via iframe embed URL.
- Protocols, authentication/authorization, SLAs/quotas
  - HTTPS/TLS; no auth. Suggested CSP:
    - default-src 'self';
    - frame-src 'self' https://{Video_Embed_Domain};
    - script-src 'self';
    - style-src 'self' 'unsafe-inline' (only if needed by current scaffold);
    - img-src 'self' data: https://{Video_Embed_Domain};
    - connect-src 'self'.
- Fallback/degeneration strategies
  - If iframe fails or is blocked: display a message and a standard hyperlink to {Video_URL}.
- Data mapping/transformation, idempotency, retries
  - N/A beyond optional single retry for config.json fetch with user-friendly error on failure.

6. Deployment and Runtime Architecture
- Environments and configuration
  - {dev,test,prod}. If needed, per-env config.json holding embedUrl; otherwise inline constant per build.
- Packaging and deployment
  - Build static assets; deploy to {Static_Hosting_Option}. Use atomic deploys with instant rollback.
- CI/CD overview
  - Trunk-based; jobs: lint → minimal unit tests → build → upload artifacts → deploy. Artifacts versioned; retain last N for rollback.
- Observability
  - None per constraints (omitted).

7. Non-Functional Requirements Mapping
- Performance: Minimal JS/CSS; lazy iframe; CDN caching; avoid autoplay; guard asset size budget.
- Scalability: Fully static; CDN provides global scalability; no app servers.
- Availability/Reliability: Atomic deploys; fast rollback; no stateful services.
- Security: HTTPS; CSP frame-src limited to {Video_Embed_Domain}; reasonable referrerpolicy; no secrets.
- Privacy/Compliance: No first-party tracking; third-party embed follows provider behavior; document that third-party cookies may apply.
- Accessibility: Deprioritized for this plan; basic semantics retained but not gating.
- Maintainability: Single landing component; single change point for {Video_URL}; minimal code surface; acceptance checklist.
- Operability: Simple deploy/runbook; branch isolation; no runtime services.

8. Risks, Assumptions, and Open Questions
- Top risks
  - Provider embed domain/parameters change → Pin to current recommended pattern; document update steps.
  - CSP too strict blocks embed → Validate CSP in test; maintain a quick toggle to relax frame-src during diagnosis.
  - Regional blocking of the platform → Provide link fallback; contingency to swap provider if required.
- Assumptions
  - Static hosting with edge CDN is available; no SSR required.
  - No observability requirements at launch.
- Open questions and blocked decisions
  - Final {Video_URL} and any parameters.
  - Inline constant vs config.json for configuration.

9. Traceability Matrix
| Macro Goal/Requirement | Meso Component(s) | Coverage Notes |
|---|---|---|
| Single external embedded video | {Web_Client}, {External_Video_Platform} | Iframe embed with lazy load; no autoplay |
| Remove all 3D code/assets/deps | {CI_Pipeline} + repo cleanup | Delete 3D modules/assets/deps; build passes |
| Keep build/test/lint | {CI_Pipeline} | Existing steps retained; minimal unit tests added |
| Minimal, responsive layout | {Web_Client} | 16:9 fluid container; small CSS |
| Update documentation | {Documentation} | Where/how to change {Video_URL}; how to run/build/deploy |
| No observability | N/A | Explicitly excluded per constraints |

10. Readiness for Micro-Level Planning
- Prioritized workstreams/epics and milestones
  - WS1: Remove 3D code/assets/dependencies; fix imports/build.
  - WS2: Implement Video Landing (markup, styles, iframe attributes; no autoplay).
  - WS3: Decide and implement configuration approach (inline constant vs config.json).
  - WS4: Tests (render + attribute presence), minimal CI gate.
  - WS5: Documentation updates and acceptance checklist.
  - WS6: CSP and static hosting configuration; deploy.
- Entry/exit criteria
  - Entry: Confirm {Video_URL}; pick configuration approach; confirm {Static_Hosting_Option}.
  - Exit: All 3D artifacts removed; build/lint/tests pass; landing renders; CSP validated; docs updated; deployed with rollback available.
- Dependencies, sequencing, critical path
  - WS1 → WS2 → WS4 → WS5/WS6; WS3 parallel if config.json chosen.

11. Diagrams (as needed)
- Static data-flow
  ```mermaid path=null start=null
  flowchart LR
    A[User] --> B[CDN/Static Hosting]
    B --> C[HTML/CSS/JS]
    C -->|optional| D[config.json]
    C --> E[iframe -> External Video Platform]
    E --> C
  ```

12. Out of Scope for Meso-Level
- Code-level design, class-level details, function signatures, and test cases.
- Detailed acceptance criteria per story.
- Environment-specific secrets and per-service configuration minutiae.
