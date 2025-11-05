---
tags: [assignment, uow, agent/work-assigner]
unit_id: "U07"
project: "[[01-Projects/AGILE3D-Demo]]"
status: "completed"
created: "2025-11-01"
completed: "2025-11-01"
links:
  se_work_log: "[[SE-Log-U07]]"
---

# UoW Assignment — U07

- Project: [[01-Projects/AGILE3D-Demo]]
- SE Work Log: [[SE-Log-U07]]
- Daily note: [[2025-11-01]]

## Task Overview
Implement reusable HTTP utilities for the web app: `fetchWithTimeoutAndRetry` to handle frame downloads with 3-second timeout and retry backoff, and `verifyRangeGet` to probe CDN support for HTTP Range requests (required for efficient streaming). These utilities abstract common networking concerns and enable both FrameStreamService and ManifestService to share consistent timeout/retry behavior.

## Success Criteria
- [ ] `fetchWithTimeoutAndRetry` enforces 3s frame timeout and `[250,750]` ms backoff; supports AbortController
- [ ] `verifyRangeGet(url)` detects Range support via HEAD request + range probe; returns {supportsRange: boolean}
- [ ] Both functions integrate cleanly with AbortSignal for cancellation
- [ ] Unit tests cover normal fetch, timeout, retries, abort, and Range detection
- [ ] Manual test verifies fetch against sample CDN path or local mock

## Constraints and Guardrails
- No scope creep; modify only listed files
- ≤2 files, ≤250 LOC total
- No secrets; use environment variables if needed
- Export as standalone functions or utility class (document choice in code)
- No commits unless explicitly instructed

## Dependencies
- None (utility library, no dependencies on other UoWs)

## Files to Read First
- `/home/josh/Code/AGILE3D-Demo/libs/utils-network/**` (directory structure for nx library)
- Micro-level plan §7 "Networking" for timeout/retry/Range-GET specs
- Micro-level plan §8 "Delivery" for CDN behavior expectations

## Files to Edit or Create
- `/home/josh/Code/AGILE3D-Demo/libs/utils-network/src/lib/http.ts` (new network utilities)
- `/home/josh/Code/AGILE3D-Demo/libs/utils-network/src/lib/http.spec.ts` (new tests)

## Implementation Steps
1. In `http.ts`, implement `fetchWithTimeoutAndRetry`:
   - Signature: `fetchWithTimeoutAndRetry(url: string, options?: {timeoutMs?: number; retryBackoff?: number[]; signal?: AbortSignal}): Promise<Response>`
   - Use native `fetch(url, {signal: AbortSignal})` to enable timeout/abort
   - Implement timeout via AbortController + setTimeout (create new AbortController for each attempt)
   - On timeout or network error, retry with backoff delays from `retryBackoff` (default `[250, 750]`)
   - If all retries exhausted, throw final error (include error context: attempt count, last error)
   - Respect caller's `signal` (abort from caller takes precedence)
   - Return successful Response object or throw on final failure

2. In `http.ts`, implement `verifyRangeGet`:
   - Signature: `verifyRangeGet(url: string, signal?: AbortSignal): Promise<{supportsRange: boolean; contentLength?: number}>`
   - Send HEAD request to `url` with `Range: bytes=0-0` header (or probe with GET range)
   - Check response headers: `Accept-Ranges: bytes` (or `Content-Range` presence)
   - Log detection result (warn if Range not supported, especially for high-bandwidth use)
   - Return boolean and optional content-length for planning
   - Handle errors gracefully (return `{supportsRange: false}` if probe fails)

3. Write unit tests in `http.spec.ts`:
   - `test_fetchWithTimeoutAndRetry_success`: mock successful fetch, returns response
   - `test_fetchWithTimeoutAndRetry_timeout_first_attempt`: timeout fires on first request, retry happens
   - `test_fetchWithTimeoutAndRetry_timeout_all_retries`: all attempts timeout, final error thrown
   - `test_fetchWithTimeoutAndRetry_network_error_retry`: network error triggers retry with backoff
   - `test_fetchWithTimeoutAndRetry_abort_signal_respected`: caller passes AbortSignal, fetch aborted mid-flight
   - `test_fetchWithTimeoutAndRetry_custom_backoff`: custom retry delays used
   - `test_verifyRangeGet_supports_range`: HEAD response includes `Accept-Ranges: bytes`, returns true
   - `test_verifyRangeGet_no_range_support`: response missing Range header, returns false
   - `test_verifyRangeGet_error_handling`: HEAD request fails, gracefully returns false
   - `test_verifyRangeGet_returns_content_length`: response includes Content-Length, returned in result

4. Implement timeout via AbortController pattern:
   - For each fetch attempt:
     ```
     const controller = new AbortController();
     const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
     try {
       const response = await fetch(url, {signal: controller.signal});
       clearTimeout(timeoutId);
       return response;
     } catch (err) {
       clearTimeout(timeoutId);
       if (err.name === 'AbortError') throw new TimeoutError(...);
       throw err;
     }
     ```

5. Export utilities:
   - Export `fetchWithTimeoutAndRetry` and `verifyRangeGet` as named exports from `http.ts`
   - Update library barrel export (`index.ts`) if needed

6. Validate by manual testing:
   - Create simple test harness (or add to existing test suite)
   - Call `fetchWithTimeoutAndRetry` against sample CDN URL or local mock server
   - Verify timeout triggers and retries occur (check console logs or performance timing)
   - Call `verifyRangeGet` against sample path; verify detection result

## Tests
- Unit:
  - `/home/josh/Code/AGILE3D-Demo/libs/utils-network/src/lib/http.spec.ts`:
    - `test_fetchWithTimeoutAndRetry_success` — fetch succeeds, returns response
    - `test_fetchWithTimeoutAndRetry_timeout_first_attempt` — first attempt times out, retry triggered
    - `test_fetchWithTimeoutAndRetry_timeout_all_retries` — all attempts timeout, final error
    - `test_fetchWithTimeoutAndRetry_network_error_retry` — network error triggers retry with backoff
    - `test_fetchWithTimeoutAndRetry_abort_signal_respected` — caller AbortSignal honored
    - `test_fetchWithTimeoutAndRetry_custom_backoff` — custom retry delays used
    - `test_verifyRangeGet_supports_range` — Accept-Ranges header present, returns true
    - `test_verifyRangeGet_no_range_support` — missing header, returns false
    - `test_verifyRangeGet_error_handling` — HEAD fails, gracefully returns false
    - `test_verifyRangeGet_returns_content_length` — Content-Length included in result
- Manual:
  - Call `fetchWithTimeoutAndRetry` against sample or mock URL; verify timeout and retry delays
  - Call `verifyRangeGet` against sample CDN path; log detection result

## Commands to Run
```bash
cd /home/josh/Code/AGILE3D-Demo
npm test -- libs/utils-network/src/lib/http.spec.ts --watch=false
# Or if using nx:
nx test utils-network --watch=false
```

## Artifacts to Return
- Unified diff for `http.ts` and `http.spec.ts`
- Jest/Karma test output showing all tests passing
- Example console output from manual fetch test (log timeout/retry sequence)
- Range verification result (logged output showing detection)

## Minimal Context Excerpts
> Source: [[micro-level-plan#7. Networking]]
> Networking: manifest timeout 5s; frame timeout 3s; retries=2 with 250 ms and 750 ms backoff; prefetch=3; concurrency=2–3; "miss" includes late arrival.
> 
> Source: [[micro-level-plan#8. Delivery]]
> Frames: immutable 1 year; manifest TTL 300 s; Range‑GET enabled.
>
> Source: [[Work-Decomposer-Output#Unit U07: Utils-Network]]
> Implement `fetchWithTimeoutAndRetry` and `verifyRangeGet(url)` (HEAD+range probe).
> Helpers enforce 3s frame timeout and `[250,750]` backoff; abort support.
> Range support detected and logged; failures flagged.

## Follow-ups if Blocked
- **AbortController API unclear**: AbortController standard for cancelling fetch; set timeout with `setTimeout(() => controller.abort(), ms)` to trigger timeout via AbortError
- **Retry logic timing unclear**: Use simple array of backoff delays; wait each delay before next attempt; example: [250, 750] means retry #1 waits 250ms, retry #2 waits 750ms
- **Range-GET probe details unclear**: Send HEAD request with `Range: bytes=0-0` header, check response for `Accept-Ranges: bytes` or `Content-Range` header presence
- **Mock fetch for tests unclear**: Use Jest `fetch.mockResolvedValue()` or library like `node-fetch` + mock; control timing with fake timers (`jest.useFakeTimers()`)
