---
tags: [assignment, uow, agent/work-assigner]
unit_id: "U08"
project: "[[01-Projects/AGILE3D-Demo]]"
status: "completed"
created: "2025-11-01"
completed: "2025-11-01"
links:
  se_work_log: "[[SE-Log-U08]]"
---

# UoW Assignment — U08

- Project: [[01-Projects/AGILE3D-Demo]]
- SE Work Log: [[SE-Log-U08]]
- Daily note: [[2025-11-01]]

## Task Overview
Implement the core playback controller for the SPA: a service that maintains fixed 10 Hz cadence, prefetches frames with configurable concurrency (2–3), accounts for misses (late/absent frames), and emits observables for frame delivery, buffer state, errors, and status. After 3 consecutive misses, the service pauses and emits a banner event for UX feedback.

## Success Criteria
- [ ] Tick jitter ≤±5 ms on average over 60 seconds; sustained 10 Hz playback
- [ ] After 3 consecutive misses, service pauses and emits banner event (resumable via Retry)
- [ ] Prefetch queue maintained at size 3 (configurable); concurrent fetches 2–3 (bounded)
- [ ] Observables expose `currentFrame$`, `bufferLevel$`, `errors$`, `status$` for UI subscription
- [ ] Unit tests cover cadence stability, prefetch behavior, miss accounting, auto-loop
- [ ] Manual test confirms observable emissions and pause-on-3-misses flow

## Constraints and Guardrails
- No scope creep; modify only listed files
- ≤3 files, ≤350 LOC total
- No secrets; config from ConfigModule (U16)
- Use RxJS for Observable patterns (align with Angular standards)
- Jitter measurement optional if benchmark timing too variable
- No commits unless explicitly instructed

## Dependencies
- [[U06]] (Manifest Loader Service—must be completed)
- [[U07]] (Utils-Network helpers—must be completed)

## Files to Read First
- `/home/josh/Code/AGILE3D-Demo/apps/web/src/app/shared/models/manifest.ts` (FrameRef, SequenceManifest from U06)
- `/home/josh/Code/AGILE3D-Demo/libs/utils-network/src/lib/http.ts` (fetchWithTimeoutAndRetry from U07)
- Micro-level plan §4 "FrameStreamService" for pseudocode and requirements
- Micro-level plan §3 for networking config (timeouts, retries, prefetch, concurrency)

## Files to Edit or Create
- `/home/josh/Code/AGILE3D-Demo/apps/web/src/app/services/frame-stream/frame-stream.service.ts` (new service)
- `/home/josh/Code/AGILE3D-Demo/apps/web/src/app/services/frame-stream/frame-stream.service.spec.ts` (new tests)
- `/home/josh/Code/AGILE3D-Demo/apps/web/src/app/app.module.ts` (register service in DI)

## Implementation Steps
1. Define interface for FrameStreamService state and config:
   - `FrameStreamConfig`: {timeoutMs: number; retryBackoff: number[]; prefetch: number; concurrency: number; fps: number}
   - `FrameData`: {id: string; pointsUrl: string; detections: Record<string, unknown>; ...} (from FrameRef + parsed data)
   - `FrameStreamStatus`: enum {IDLE, LOADING, PLAYING, PAUSED, ERROR}

2. Implement `FrameStreamService` in `frame-stream.service.ts`:
   - Constructor: inject `ManifestService`, `HttpClient` (or utils), `ConfigService`
   - Public methods:
     - `start(manifestUrl: string, activeBranch: string): void` — initiate playback
     - `pause(): void` — pause playback (manual pause; different from miss-triggered pause)
     - `resume(): void` — resume from pause
     - `setActiveBranch(branch: string): void` — switch active branch mid-stream
   - Public observables:
     - `currentFrame$: Observable<FrameData>` — emits current frame each tick if ready
     - `bufferLevel$: Observable<number>` — emits prefetch queue size (0–3)
     - `errors$: Observable<Error>` — emits fetch/timeout errors
     - `status$: Observable<FrameStreamStatus>` — emits status changes
   - Internal state:
     - `frameIndex: number` — current frame id
     - `prefetchQueue: Map<number, Promise<FrameData>>` — pending fetches
     - `missCount: number` — consecutive miss counter
     - `tickSubscription: Subscription` — 100 ms timer
     - `inflight: number` — active fetch count

3. Implement tick loop (100 ms interval, 10 Hz):
   - Each tick:
     1. Check if current frame ready in prefetchQueue; if yes, emit via `currentFrame$`, increment frameIndex
     2. If frame not ready by deadline (frameIndex > lastEmitted), register miss; increment `missCount`
     3. If `missCount >= 3`, pause and emit banner event via `status$` (status = PAUSED_MISS); stop prefetching
     4. While prefetchQueue.size < prefetch AND inflight < concurrency AND frameIndex < manifest.frames.length:
        - Fetch next frame (points + detections for active branch)
        - Store in prefetchQueue; increment inflight; decrement on settle
     5. Emit `bufferLevel$` (prefetchQueue.size)
   - On pause: stop tick loop, clear prefetchQueue, reset miss counter
   - On resume: restart tick loop from current frameIndex
   - On loop end (frameIndex >= manifest.frames.length): reset frameIndex to 0, auto-loop

4. Fetch pipeline for each frame:
   - Use `fetchWithTimeoutAndRetry` from U07 for points (*.bin) and detections (*.det.{branch}.json)
   - Parallel fetch both; settle when both complete
   - Parse binary points and JSON detections; return merged FrameData
   - On any error, emit via `errors$` but don't block queue (continue with next frame)
   - For detections, filter by score threshold and label mask (from config or set by UI)

5. Write unit tests in `frame-stream.service.spec.ts`:
   - `test_start_initializes_playback`: start() called, tick loop begins, status$ emits LOADING
   - `test_cadence_10_hz`: tick every 100ms, verify frame emissions at 10 Hz (use virtual timers)
   - `test_tick_jitter_acceptable`: collect 100 ticks over 10s, measure jitter; ensure ≤±5ms on average
   - `test_prefetch_queue_size_3`: stream playing, prefetchQueue size stays ≤3
   - `test_concurrent_fetches_bounded`: max 3 inflight fetches tracked, no overflow
   - `test_miss_on_late_frame`: frame not ready by deadline, miss incremented
   - `test_pause_on_3_misses`: 3 consecutive misses, status$ emits PAUSED_MISS, tick stops
   - `test_resume_after_pause`: pause(), then resume(), tick restarts
   - `test_buffer_level_observable`: bufferLevel$ emits queue size each tick
   - `test_auto_loop_at_end`: frameIndex reaches manifest.frames.length, wraps to 0
   - `test_manual_pause_vs_miss_pause`: manual pause() different from miss-triggered pause
   - `test_active_branch_switch`: setActiveBranch(), next fetches use new branch

6. Validate by manual testing:
   - Start service with sample manifest from U05
   - Subscribe to observables in console:
     ```
     frameStreamService.currentFrame$.subscribe(f => console.log('Frame', f.id))
     frameStreamService.bufferLevel$.subscribe(b => console.log('Buffer:', b))
     frameStreamService.status$.subscribe(s => console.log('Status:', s))
     ```
   - Verify frames emit at ~10 Hz (100 ms apart)
   - Throttle network to induce misses; verify 3-miss pause flow
   - Verify auto-loop when reaching end

## Tests
- Unit:
  - `/home/josh/Code/AGILE3D-Demo/apps/web/src/app/services/frame-stream/frame-stream.service.spec.ts`:
    - `test_start_initializes_playback` — start() begins tick loop, status$ emits LOADING
    - `test_cadence_10_hz` — frames emitted every 100ms (virtual timers)
    - `test_tick_jitter_acceptable` — jitter ≤±5ms over 60s
    - `test_prefetch_queue_size_3` — queue maintained ≤3 concurrent fetches
    - `test_concurrent_fetches_bounded` — inflight ≤ concurrency config (2–3)
    - `test_miss_on_late_frame` — frame late by deadline, miss counter increments
    - `test_pause_on_3_misses` — 3 misses → pause, status$ emits PAUSED_MISS
    - `test_resume_after_pause` — pause() then resume() restarts cadence
    - `test_buffer_level_observable` — bufferLevel$ emits queue size
    - `test_auto_loop_at_end` — reaches end, wraps to frame 0
    - `test_manual_pause_vs_miss_pause` — pause() vs miss-triggered pause
    - `test_active_branch_switch` — setActiveBranch() used in next fetches
- Manual:
  - `ng serve`, inject service, subscribe to observables
  - Verify frame emissions at 10 Hz, buffer level changes, status transitions
  - Induce network throttle or long timeout to trigger 3-miss pause; verify banner event
  - Verify auto-loop

## Commands to Run
```bash
cd /home/josh/Code/AGILE3D-Demo/apps/web
npm test -- frame-stream.service.spec.ts --watch=false
ng serve
# In browser console:
# const svc = ng.probe(document.body).injector.get(FrameStreamService);
# svc.start('/assets/data/streams/v_1784_1828/full/manifest.json', 'DSVT_Voxel');
# svc.currentFrame$.subscribe(f => console.log('Frame:', f.id));
# svc.status$.subscribe(s => console.log('Status:', s));
```

## Artifacts to Return
- Unified diff for `frame-stream.service.ts`, `frame-stream.service.spec.ts`, and `app.module.ts`
- Jest/Karma test output showing all tests passing (especially jitter test result)
- Console log from manual test showing frame emissions and status transitions
- Screenshot or log of 3-miss pause flow

## Minimal Context Excerpts
> Source: [[micro-level-plan#4. FrameStreamService]]
> Purpose: fixed 10 Hz playback controller with prefetch=3, concurrency=2–3, cancellation and miss accounting.
> Behavior: start() begins cadence; pause() stops; automatic loop; on 3 misses → pause and emit banner event.
> Pseudocode: tick() checks prefetch queue, registers miss if deadline passed, fetches next, emits current frame.
>
> Source: [[micro-level-plan#3. Session Inputs Summary]]
> NFRs: smooth 10 Hz; render ~60 fps; ≤16 ms per-frame budget.
> Networking: frame timeout 3s; retries=2 with 250 ms and 750 ms backoff; prefetch=3; concurrency=2–3; "miss" includes late arrival.
>
> Source: [[Work-Decomposer-Output#Unit U08: FrameStreamService — Cadence, Prefetch, Miss Accounting]]
> Tick jitter ≤±5 ms on average over 60 s; sustained 10 Hz.
> After 3 consecutive misses, service pauses and emits banner event.

## Follow-ups if Blocked
- **Jitter measurement too complex**: Use `performance.now()` to track tick timing; compute differences; allow variance if test environment highly variable (document baseline hardware)
- **Observable architecture unclear**: Use RxJS `Subject` and `BehaviorSubject` for state; combine with `timer()` for tick loop; `merge()` for multi-source streams
- **Fetch pipeline error handling unclear**: Emit errors to `errors$` but continue prefetching (don't block queue); allow UI to display errors in parallel to playback
- **Auto-loop logic unclear**: After last frame emitted, check if frameIndex > manifest.frames.length; if so, reset frameIndex = 0 and continue tick
- **Config injection from U16 unclear**: ConfigService provides `config.get('prefetch')`, `config.get('concurrency')`, `config.get('timeouts.frameMs')`, `config.get('retries')` at boot; inject into service
