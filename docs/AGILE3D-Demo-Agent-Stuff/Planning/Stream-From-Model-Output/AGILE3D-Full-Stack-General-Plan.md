
Retrofit plan (low-cost WebSocket first, WebRTC optional later)
- Transport and protocol
  - Start with secure WebSocket (wss://) to a single streamer on your EC2 box; binary frames with a tiny header (frameId, ts, payloadType, lengths) and payload blocks (positions, optional colors, detections).
  - Add chunking/reassembly for 16–64 KB messages; later add quantization + meshoptimizer (I-frames) and simple deltas (adds/deletes) for P-frames.
- Frontend services and workers
  - Add src/app/core/services/stream/pointcloud-stream.service.ts
    - Connects to wss, capability handshake, backoff reconnect, exposes Observables: points$, detections$, stats$.
    - Runs outside Angular’s zone; sends ROI/LOD hints later.
  - Add src/assets/workers/pcs-decoder.worker.js
    - Reassembles chunks; decodes to Float32Array positions (and optional colors) using transferable ArrayBuffers; integrate meshoptimizer WASM later (place wasm in src/assets/codecs/).
- Rendering integration (minimal churn)
  - Keep DualViewer/SceneViewer intact; feed a live THREE.Points instance:
    - In pointcloud-stream.service, create a THREE.BufferGeometry once with preallocated Float32Array (max expected points), set DynamicDrawUsage.
    - On each frame from the worker, copy new data into the attribute array (no reallocation), update drawRange/count, set attribute.needsUpdate = true.
    - Expose this Points via a BehaviorSubject so MainDemoComponent can set sharedPoints for DualViewer (it already passes one Points instance to both viewers).
  - Detections: subscribe to detections$ and update baselineDetections/agile3dDetections; SceneViewer will rebuild instanced meshes (or use updateInstancedMesh when counts are stable).
- App wiring and feature flag
  - Add a “streaming mode” flag (env or query param). In MainDemoComponent:
    - If streaming: skip SceneDataService.loadPointsObject(); call streamService.connect(channelId); set this.sharedPoints from stream; subscribe to detections$.
    - Else: keep current static asset path as fallback.
- Protocol details (v1, simple)
  - Header (little-endian): magic(4)=‘PCS1’, version(u8)=1, flags(u16), frameId(u32), tsNs(u64), posCount(u32), attrMask(u16), blocks[…].
  - Blocks: POS(raw float32 xyz) initially; later POS_Q(meshopt), COL(RGB8), DET(JSON or binary); CRC32 trailer optional.
- Performance safeguards
  - Double/triple buffering in the worker to avoid blocking; throttle to 8–10 Hz initially; preallocate typed arrays; avoid attribute re-creation.
  - Use NgZone.runOutsideAngular; keep all decode in worker; only transfer ArrayBuffers.
- Error handling and UX
  - Connection status indicator and reconnect; small “stream quality” badge (LOD/fps); pause/resume button.
- Security
  - wss with JWT in query/header; short-lived tokens from a tiny auth endpoint; strict CORS; SG allows 443 only.
- Testing
  - Local mock streamer that sends synthetic frames at 10 Hz (raw Float32) to prove end-to-end; golden-vector tests for decoder; throttle/loss sims in browser devtools.
- Optional phase-ups
  - Add meshoptimizer decoder WASM in worker; switch POS to compressed; add basic P-frames (adds/deletes); add ROI/LOD negotiation; consider WebRTC DataChannel if NAT traversal becomes necessary.

Concrete implementation steps (order)
1) Add streaming mode toggle and service skeleton; return a live Points with a growing drawRange; feed synthetic frames from a timer to validate render updates.  
2) Wire real WebSocket: header + raw Float32 POS; integrate worker for reassembly and transferable arrays.  
3) Replace raw POS with quantized+meshopt; add simple deltas; introduce detections stream and use updateInstancedMesh when counts match.  
4) ROI/LOD feedback loop; metrics overlay; reconnection polish and e2e tests.

Acceptance criteria
- 10 Hz stream at 50k points updates smoothly (no GC jank), 30+ FPS render on a mid-range laptop.  
- Reconnect within 3 s after network flap; fallback to static assets when streaming unavailable.  
- Bandwidth under ~1–3 MB/s at 50k points with quantization; decode stays off main thread.