---
tags: [assignment, uow, agent/work-assigner]
unit_id: "U09"
project: "[[01-Projects/AGILE3D-Demo]]"
status: "completed"
created: "2025-11-01"
completed: "2025-11-01"
links:
  se_work_log: "[[SE-Log-U09]]"
---

# UoW Assignment — U09

- Project: [[01-Projects/AGILE3D-Demo]]
- SE Work Log: [[SE-Log-U09]]
- Daily note: [[2025-11-01]]

## Task Overview
Implement a Web Worker to parse binary point cloud data (*.bin ArrayBuffer) into typed Float32Array positions and metadata, offloading heavy computation from the main thread. The worker is served from the web app's assets directory, enabling both dev and prod builds to resolve the Worker URL correctly.

## Success Criteria
- [ ] Angular assets include `src/assets/workers/**` so the Worker URL resolves at `/assets/workers/point-cloud-worker.js` in dev/prod builds
- [ ] Worker parses binary buffers and returns transferable `Float32Array` with metadata `{pointCount}`
- [ ] Buffer size validation prevents parsing corrupted/oversized data; graceful error handling
- [ ] Unit tests spin up Worker with mocked buffers; assert counts and transfer semantics
- [ ] Manual test parses 3 sample *.bin frames from U05; validates counts

## Constraints and Guardrails
- No scope creep; modify only listed files
- ≤3 files, ≤250 LOC total
- No secrets; use environment variables if needed
- Angular build serves assets at `/assets/**`; no special builder config needed
- Worker script is plain JavaScript (not TypeScript compiled in main bundle)
- No commits unless explicitly instructed

## Dependencies
- None (utility worker; depends only on sample .bin data from U05)

## Files to Read First
- `/home/josh/Code/AGILE3D-Demo/angular.json` (asset configuration)
- `/home/josh/Code/AGILE3D-Demo/apps/web/src/assets/` (existing directory structure)
- Micro-level plan §4 "Points Parser Worker" for binary format specification
- Micro-level plan §5 "Data Model" for quantization header format if present

## Files to Edit or Create
- `/home/josh/Code/AGILE3D-Demo/apps/web/src/assets/workers/point-cloud-worker.js` (new worker script)
- `/home/josh/Code/AGILE3D-Demo/apps/web/src/app/workers/point-cloud-worker.spec.ts` (new tests)
- `/home/josh/Code/AGILE3D-Demo/angular.json` (ensure assets glob includes workers)

## Implementation Steps
1. Verify Angular asset configuration in `angular.json`:
   - Check `projects.web.architect.build.options.assets` includes `src/assets` or glob pattern
   - If not present, add `"src/assets"` to assets array so Angular CLI copies to dist/
   - Verify both dev server (`ng serve`) and prod build (`ng build`) serve `/assets/**`

2. Create Worker script `point-cloud-worker.js`:
   - Add `self.onmessage` handler to receive `{buffer: ArrayBuffer, header?: Uint8Array}` from main thread
   - Parse binary format:
     - If header present (first 29 bytes from U04):
       - Read mode (uint8), bbox_min (3×float32), bbox_max (3×float32), point_count (uint32)
       - Parse remaining buffer as quantized int16 or fp16 (per mode)
       - Dequantize to float32 positions
     - If no header, parse buffer directly as float32 (raw points)
   - Validate buffer size: expect `pointCount * 4 * 3` bytes (or 2 bytes if quantized)
   - Handle errors gracefully (try/catch); send error message back to main thread
   - Create Float32Array for positions (transferable)
   - Send `{pointCount, positions: Float32Array}` back via `postMessage({...}, [positions.buffer])`

3. Implement buffer parser logic:
   - Use `DataView` for byte-level reading (handles endianness)
   - For raw float32:
     ```
     const dataView = new DataView(buffer);
     const positions = new Float32Array(buffer.byteLength / 4);
     for (let i = 0; i < buffer.byteLength; i += 4) {
       positions[i/4] = dataView.getFloat32(i, true); // little-endian
     }
     return {pointCount: positions.length / 3, positions};
     ```
   - For quantized (if header present):
     - Read bbox bounds and mode from header
     - Normalize int16/fp16 values to [-1, 1] range
     - Scale by bbox to get world coordinates
   - Validate point count matches header (if present)

4. Write unit tests in `point-cloud-worker.spec.ts`:
   - `test_worker_parses_raw_float32_points`: synthetic buffer with 3 points (9 float32 values), worker parses correctly
   - `test_worker_returns_transferable_buffer`: positions array is transferable; buffer ownership transferred
   - `test_worker_validates_buffer_size`: buffer too small or corrupt, error returned gracefully
   - `test_worker_with_quantization_header`: buffer with header, dequantizes and validates points
   - `test_worker_point_count_matches_buffer`: verify pointCount = buffer.byteLength / 12 (3 floats per point, 4 bytes each)
   - `test_worker_error_handling`: malformed header, worker sends error message not crash

5. Implement worker loader utility (optional, for use by SceneDataService in U10):
   - Simple helper to instantiate Worker: `new Worker('/assets/workers/point-cloud-worker.js')`
   - Wrapper to send buffer and await result with timeout

6. Validate by manual testing:
   - Build app: `ng build` (prod) or `ng serve` (dev)
   - Verify Worker URL resolves: check Network tab in DevTools for `/assets/workers/point-cloud-worker.js` 200 OK
   - Load 3 sample *.bin files from U05 sample data
   - Send each to Worker via `postMessage`; log results
   - Verify point counts match expected (50k or 100k depending on tier)

## Tests
- Unit:
  - `/home/josh/Code/AGILE3D-Demo/apps/web/src/app/workers/point-cloud-worker.spec.ts`:
    - `test_worker_parses_raw_float32_points` — synthetic 3-point buffer, parsed correctly
    - `test_worker_returns_transferable_buffer` — positions transferable, ownership transferred
    - `test_worker_validates_buffer_size` — oversized/undersized buffer, error returned
    - `test_worker_with_quantization_header` — header + quantized data, dequantized correctly
    - `test_worker_point_count_matches_buffer` — pointCount = buffer.byteLength / 12
    - `test_worker_error_handling` — malformed header, error message sent
- Manual:
  - `ng serve` or `ng build --configuration production`
  - Verify Worker script loads: check DevTools Network tab
  - Load 3 sample frames from U05; post buffers to Worker
  - Log results; verify point counts match expected values

## Commands to Run
```bash
cd /home/josh/Code/AGILE3D-Demo/apps/web
npm test -- point-cloud-worker.spec.ts --watch=false
ng serve
# In browser DevTools:
# - Check Network tab for /assets/workers/point-cloud-worker.js (200 OK)
# - Fetch sample .bin file
# - Create worker and post buffer
```

## Artifacts to Return
- Unified diff for `point-cloud-worker.js`, `point-cloud-worker.spec.ts`, and `angular.json`
- Jest/Karma test output showing all tests passing
- Network DevTools screenshot showing Worker script loaded (200 OK)
- Console log from manual test showing point counts and parsed results

## Minimal Context Excerpts
> Source: [[micro-level-plan#4. Points Parser Worker]]
> Input: ArrayBuffer (.bin), optional small JSON header.
> Output: Float32Array positions; metadata {pointCount}.
> Validate size thresholds; return transferable buffers.
>
> Source: [[Work-Decomposer-Output#Unit U09: Points Parser Worker (assets-based)]]
> Implement `src/assets/workers/point-cloud-worker.js`; load using `new Worker('/assets/workers/point-cloud-worker.js')`.
> Angular assets include `src/assets/workers/**` so the Worker URL resolves in dev/prod builds.
> Worker parses buffers and returns transferable `Float32Array` plus `{pointCount}`.

## Follow-ups if Blocked
- **Angular asset serving unclear**: Verify `angular.json` build options include `"src/assets"` in assets array; both `ng serve` and `ng build` will serve to `/assets/**`
- **Binary format details unclear**: Raw format is 3 float32 values per point (x, y, z), 4 bytes each = 12 bytes per point; total size = pointCount × 12
- **Quantization dequantization unclear**: If header present (29 bytes), read bbox bounds and quantization mode; normalize quantized int16/fp16 to [-1, 1], scale by bbox to world coordinates
- **Worker communication unclear**: Use `self.onmessage = (e) => { const {buffer, header} = e.data; ... self.postMessage({pointCount, positions}, [positions.buffer]); }` to transfer ownership
- **Transferable buffer concept unclear**: Transferable objects (like ArrayBuffer) change ownership; receiver gets exclusive access; improves performance by avoiding copy
