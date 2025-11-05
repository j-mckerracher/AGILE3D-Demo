---
tags: [assignment, uow, agent/work-assigner]
unit_id: "U06"
project: "[[01-Projects/AGILE3D-Demo]]"
status: "completed"
created: "2025-11-01"
completed: "2025-11-01"
links:
  se_work_log: "[[SE-Log-U06]]"
---

# UoW Assignment — U06

- Project: [[01-Projects/AGILE3D-Demo]]
- SE Work Log: [[SE-Log-U06]]
- Daily note: [[2025-11-01]]

## Task Overview
Implement typed TypeScript models for sequence manifests and a service to fetch/parse manifests from the CDN with robust timeout and retry semantics. This unit provides the web app's interface to converter-generated metadata, enabling frame streaming to discover available sequences and frame URLs.

## Success Criteria
- [ ] Fetch uses `manifestMs=5000` timeout and `[250,750]` ms retry backoff per config
- [ ] Parsed models align with §16 interfaces (FrameRef, SequenceManifest) from micro-level plan
- [ ] Invalid schema triggers error stream; app can respond gracefully
- [ ] Unit tests cover normal fetch, timeouts, retries, and invalid payloads
- [ ] Manual test loads sample manifest from assets via `ng serve` successfully

## Constraints and Guardrails
- No scope creep; modify only listed files
- ≤4 files, ≤300 LOC total
- No secrets; use config from ConfigModule (U16)
- Use native fetch or Angular HttpClient consistently (document choice in code)
- No commits unless explicitly instructed

## Dependencies
- [[U05]] (Sample data generation—completed)
- [[U16]] (ConfigModule—may run in parallel; config values available at boot)

## Files to Read First
- `/home/josh/Code/AGILE3D-Demo/apps/web/src/environments/**` (existing environment config structure)
- `/home/josh/Code/AGILE3D-Demo/apps/web/src/app/app.module.ts` (module structure)
- Micro-level plan §6 "API and Message Contracts" for SequenceManifest schema
- Micro-level plan §16 "Appendices — Example TypeScript interfaces"

## Files to Edit or Create
- `/home/josh/Code/AGILE3D-Demo/apps/web/src/app/shared/models/manifest.ts` (new FrameRef, SequenceManifest types)
- `/home/josh/Code/AGILE3D-Demo/apps/web/src/app/services/scene-data/manifest.service.ts` (new service)
- `/home/josh/Code/AGILE3D-Demo/apps/web/src/app/services/scene-data/manifest.service.spec.ts` (new tests)
- `/home/josh/Code/AGILE3D-Demo/apps/web/src/app/app.module.ts` (register service in DI)

## Implementation Steps
1. Create TypeScript interfaces in `manifest.ts`:
   - `FrameRef`: {id: string; ts?: number; pointCount?: number; urls: {points: string; gt?: string; det?: Record<string, string>}}
   - `SequenceManifest`: {version: string; sequenceId: string; fps: number; classMap: Record<string, string>; branches: string[]; frames: FrameRef[]}
   - `ManifestFetchConfig`: {timeoutMs: number; retryBackoff: number[]; baseUrl: string}
   - Export from `shared/models/manifest.ts`

2. Implement `ManifestService` in `manifest.service.ts`:
   - Inject `HttpClient` (or use fetch; pick one consistently)
   - Constructor accepts config: `ManifestFetchConfig`
   - Public method: `fetchManifest(sequenceId: string): Observable<SequenceManifest>`
     - Construct URL: `{baseUrl}/{sequenceId}/manifest.json` (e.g., `https://cdn.example.com/sequences/v_1784_1828/manifest.json`)
     - Implement retry logic: use RxJS `retry({count: retryBackoff.length, delay: (err, count) => timer(retryBackoff[count-1])})`
     - Implement timeout: use `timeout(timeoutMs)` operator
     - Parse JSON; validate against SequenceManifest schema (check required fields, types)
     - On schema error, throw and emit error stream (caller subscribes to error path)
   - Private method: `validateManifest(data: unknown): SequenceManifest`
     - Check: version string, sequenceId string, fps number, classMap object, branches array, frames array
     - Each frame must have id, urls.points; ts, pointCount optional
     - Throw TypeError if validation fails
   - Observable interface: returns `Observable<SequenceManifest> | Observable<never>` on error

3. Register in `app.module.ts`:
   - Add `ManifestService` to providers (or inject via factory if config needed)
   - Ensure service is available app-wide

4. Write unit tests in `manifest.service.spec.ts`:
   - `test_fetchManifest_success`: mock fetch/HttpClient, returns valid manifest, observable emits once
   - `test_fetchManifest_timeout`: timeout timer fires before response, error stream triggered
   - `test_fetchManifest_retry_succeeds_on_second_attempt`: first request fails, second retries after 250ms backoff, succeeds
   - `test_fetchManifest_retry_exhausted`: all retries fail, final error emitted
   - `test_fetchManifest_invalid_schema`: response missing required field, validation fails, error stream
   - `test_validateManifest_success`: synthetic valid manifest passes validation
   - `test_validateManifest_fail_missing_required_field`: manifest missing `version`, throws
   - `test_retry_backoff_timing`: verify delays [250, 750] applied correctly (mock timers)

5. Validate by manual testing:
   - Start `ng serve`
   - Inject `ManifestService` in browser console (or component)
   - Call `manifestService.fetchManifest('v_1784_1828').subscribe(...)`
   - Verify manifest loads from `apps/web/src/assets/data/streams/v_1784_1828/full/manifest.json` (or appropriate tier)
   - Log result and inspect structure
   - Intentionally trigger timeout by using very short `timeoutMs` and confirm error handling

## Tests
- Unit:
  - `/home/josh/Code/AGILE3D-Demo/apps/web/src/app/services/scene-data/manifest.service.spec.ts`:
    - `test_fetchManifest_success` — valid response, emits SequenceManifest
    - `test_fetchManifest_timeout` — response too slow, error on timeout
    - `test_fetchManifest_retry_succeeds_on_second_attempt` — first fails, retry at 250ms, succeeds
    - `test_fetchManifest_retry_exhausted` — all retries consumed, final error
    - `test_fetchManifest_invalid_schema` — response missing required field, validation error
    - `test_validateManifest_success` — synthetic valid, passes
    - `test_validateManifest_fail_missing_required_field` — missing version, throws
    - `test_retry_backoff_timing` — [250, 750] delays verified with virtual timers
- Manual:
  - `ng serve` and load app in browser
  - Inject service and call `fetchManifest('v_1784_1828')` via console
  - Verify manifest fetches from assets and logs structure
  - Confirm timeout/retry behavior with network throttling or overridden short timeout

## Commands to Run
```bash
cd /home/josh/Code/AGILE3D-Demo/apps/web
npm test -- manifest.service.spec.ts --watch=false
ng serve
# In browser console:
# ng.probe(document.body).injector.get(ManifestService).fetchManifest('v_1784_1828').subscribe(m => console.log(m))
```

## Artifacts to Return
- Unified diff for `manifest.ts`, `manifest.service.ts`, `manifest.service.spec.ts`, and `app.module.ts`
- Jest/Karma test output showing all tests passing
- Screenshot or console log of manual test result
- Example parsed manifest structure (serialized to JSON for inspection)

## Minimal Context Excerpts
> Source: [[micro-level-plan#4. Detailed Module — FrameStreamService inputs]]
> FrameStreamService depends on manifest URL and sequence id from config; uses SequenceManifest/FrameRef models to discover frames.
>
> Source: [[micro-level-plan#6. API and Message Contracts]]
> FrameRef interface: { id: string; ts?: number; pointCount?: number; urls:{points:string; gt?:string; det?:Record<string,string>}; }
> SequenceManifest: { version:string; sequenceId:string; fps:number; classMap:Record<string,string>; branches:string[]; frames:FrameRef[]; }
>
> Source: [[Work-Decomposer-Output#Unit U06: Manifest Loader Service and Models]]
> Fetch uses `manifestMs=5000` timeout and `[250,750]` retry backoff.
> Parsed models align with §16 interfaces; invalid schema → error stream.

## Follow-ups if Blocked
- **Config values for timeout/backoff not yet available**: U16 (ConfigModule) provides `config.get('timeouts.manifestMs')` and `config.get('retries')` at app boot; inject ConfigService into ManifestService, read at init
- **HttpClient vs fetch ambiguity**: Pick HttpClient (Angular standard); simpler testing with HttpTestingController
- **Schema validation too strict**: Use lenient validation (allow extra fields, only check required fields and types); document in code comment
- **Asset serving path unclear**: Sample manifests at `apps/web/src/assets/data/streams/{sequenceId}/{tier}/manifest.json`; Angular dev server serves `/assets/` → `src/assets/`
