
# General Plan

Frontend requirements (extracted)
- Transport and session
  - Establish a secure streaming connection (wss:// initially; WebRTC optional later).
  - Feature flag to enable “streaming mode” and fallback to current static assets if disabled/unavailable.
  - Capability handshake; carry short‑lived auth token; exponential backoff reconnect.

- Decode, threading, and data contracts
  - Decoder Web Worker to reassemble chunked binary frames and output transferable ArrayBuffers.
  - Initial frame payload: positions only (Float32 xyz). Later: quantized + meshoptimizer, colors, detections, deltas.
  - Strict zero‑copy between worker and main thread; bounded queues; timeouts and error signaling.

- Rendering integration
  - Maintain a single live THREE.Points with a preallocated BufferGeometry (DynamicDrawUsage) and adjustable drawRange.
  - Per-frame updates only mutate the position attribute array and set needsUpdate; no reallocation.
  - Continue using existing DualViewer/SceneViewer; pass the live Points as sharedPoints so both viewers render the same buffer.

- Detections stream (optional phase 1.5)
  - Subscribe to a detections$ stream and update SceneViewer meshes using buildClassBatches or updateInstancedMesh.
  - Preserve current metadata-based detections as fallback when streaming detections absent.

- Adaptivity and UX
  - Minimal status UI: connected/connecting/error, fps/incoming bitrate, point count (LOD).
  - Pause/resume stream; auto-fallback to static if stream fails.
  - Later: send ROI/LOD hints (camera frustum) to server.

- Performance, resilience, and telemetry
  - Decode budget <10 ms/frame for 50k points; render stays 30–60 FPS.
  - Backpressure handling (drop frames vs queue growth); reconnect within 3 s.
  - Client metrics: decode time, dropped frames, bandwidth; small overlay or console logs.

Organized implementation steps (assignable to an AI agent)
1) Streaming mode scaffolding
- Add app config + query param support (e.g., ?stream=true).
- Introduce a StreamingModeService (or extend Debug/Capability) to expose isStreaming$.

2) Stream service (main thread, no decoding)
- Create src/app/core/services/stream/pointcloud-stream.service.ts:
  - API: connect({url, token}): Observable<{points: THREE.Points, stats}>; disconnect(); status$; stats$.
  - Open wss, perform simple handshake, heartbeats, backoff reconnect.
  - Route binary frames to a Worker; receive decoded buffers back; publish to renderer.

3) Decoder Worker
- Create src/assets/workers/pcs-decoder.worker.js:
  - Chunk reassembly (sequence numbers, frameId), sanity checks.
  - v1: parse header, map payload to Float32Array positions, postMessage with transfer list.
  - Error/timeout handling; bounded in-flight buffers; unit tests with golden vectors.
  - Placeholder hooks for meshoptimizer WASM (added later).

4) Dynamic geometry and Points lifecycle
- In pointcloud-stream.service:
  - Preallocate a Float32Array for max points (configurable).
  - Create ONE THREE.BufferGeometry with position attribute (DynamicDrawUsage) + THREE.Points.
  - On each decoded frame: copy into the existing typed array, update drawRange/count, set attribute.needsUpdate.
  - Expose the live Points via BehaviorSubject.

5) Wire into MainDemoComponent (streaming vs static)
- If streaming mode: skip SceneDataService.loadPointsObject; call streamService.connect(); set this.sharedPoints from stream; subscribe to detections$ (when available).
- Else: keep current static code path.
- Ensure DualViewer receives inputPoints (existing prop) and continues to pass geometry to SceneViewer.

6) Detections integration (phase 1.5)
- Extend worker and protocol to include a DET block (JSON or compact binary).
- In MainDemoComponent, on detections$: update baselineDetections/agile3dDetections.
- Prefer updateInstancedMesh when counts stable; rebuild with buildClassBatches otherwise.

7) Status and controls UI
- Add a lightweight StreamStatusComponent (connected/connecting/error, fps, bitrate, pointCount, pause/resume).
- Mount in DualViewer or MainDemo template; respect reduced motion and accessibility roles.

8) Performance and resilience hardening
- Ensure all decoding stays in Worker; use NgZone.runOutsideAngular for stream updates.
- Add simple backpressure policy (drop latest or oldest) to avoid UI stalls.
- Triple buffering option behind a flag if copies cause jank.
- Memory audits to prevent typed-array churn; no re-creation of attributes.

9) Security plumbing
- Sanitize all worker inputs; guard against malformed frames.

10) Testing and tooling
- Unit tests: worker frame parsing (happy path, chunk loss, bad header), stream service state machine.
- Integration test: mock WebSocket server sending 10 Hz synthetic frames; verify smooth updates and FPS.
- Diagnostics: dev overlay toggle; console timing markers.

11) Progressive enhancements (later, optional)
- Swap raw Float32 POS with quantized+meshoptimizer blocks; load WASM decoder in worker.
- Add simple P-frames (adds/deletes) to cut bandwidth; implement drawRange and sparse update logic.
- ROI/LOD feedback: SceneViewer sends camera frustum to stream service; stream service forwards to server.

Acceptance criteria (frontend)
- With streaming mode on and a mock server: 10 Hz at 50k points renders smoothly, no GC spikes, ≥30 FPS.
- Reconnect within 3 s after a simulated network drop; manual pause/resume works.
- Feature flag off: current static asset path remains unchanged.
- No attribute or geometry reallocation during steady-state streaming; memory stable over 10 minutes.

# Detailed Plan

Detailed frontend retrofit plan (streaming point-cloud “video”)

Scope
- Add streaming mode (WebSocket, binary frames).
- Worker-based decode and reassembly.
- Dynamic BufferGeometry updates to render live point clouds.
- Optional streamed detections later.
- Status UI, resilience, basic telemetry.

1) Streaming mode gating
- Add a feature flag via query param (?stream=true) and app config.

```ts
// streaming-mode.service.ts (pseudocode)
class StreamingModeService {
  isStreaming$: BehaviorSubject<boolean> = new BehaviorSubject(false);

  initFromLocation(location: Location): void {
    const params = new URLSearchParams(location.search);
    this.isStreaming$.next(params.get('stream') === 'true');
  }
}
```
Integrate in app bootstrap (call initFromLocation once).

2) Stream service (main thread) and geometry lifecycle
- File: src/app/core/services/stream/pointcloud-stream.service.ts
- Responsibilities: connect to wss, manage worker, own ONE live THREE.Points, expose status and stats.

```ts
// pointcloud-stream.service.ts (pseudocode)
@Injectable({ providedIn: 'root' })
class PointcloudStreamService {
  private ws?: WebSocket;
  private worker?: Worker;
  private backoffMs = 500;
  private maxBackoffMs = 8000;
  private reconnect = true;

  status$ = new BehaviorSubject<'idle'|'connecting'|'connected'|'error'|'closed'>('idle');
  stats$  = new BehaviorSubject<{fps:number; bitrateKbps:number; pointCount:number; dropped:number}>({fps:0, bitrateKbps:0, pointCount:0, dropped:0});
  points$ = new BehaviorSubject<THREE.Points|null>(null);

  private geometry?: THREE.BufferGeometry;
  private positions!: Float32Array; // preallocated shared view
  private maxPoints = 100_000;

  connect(url: string, channelId: string): void {
    this.reconnect = true;
    this.openSocket(url, channelId);
  }

  disconnect(): void {
    this.reconnect = false;
    this.ws?.close();
    this.worker?.terminate();
    this.ws = undefined; this.worker = undefined;
    this.status$.next('closed');
  }

  private openSocket(url: string, channelId: string): void {
    this.status$.next('connecting');
    const wsUrl = `${url}?channel=${encodeURIComponent(channelId)}`;
    this.ws = new WebSocket(wsUrl);
    this.ws.binaryType = 'arraybuffer';

    if (!this.worker) {
      this.worker = new Worker('/assets/workers/pcs-decoder.worker.js');
      this.worker.onmessage = (ev) => this.onWorkerMessage(ev.data);
      this.worker.postMessage({type:'init', cfg:{maxPoints:this.maxPoints}});
    }

    this.ws.onopen = () => {
      this.status$.next('connected');
      this.backoffMs = 500;
      // Optionally send a HELLO/capabilities message
      // this.ws?.send(encodeHello({version:1, attrs:['pos']}));
    };

    this.ws.onmessage = (ev) => {
      // Forward chunks to worker; zero-copy transfer where possible
      if (ev.data instanceof ArrayBuffer) {
        this.worker?.postMessage({type:'chunk', buf:ev.data}, [ev.data]); // transfer
      } else if (typeof ev.data === 'string') {
        this.worker?.postMessage({type:'ctrl', text:ev.data});
      }
    };

    this.ws.onerror = () => { this.status$.next('error'); };

    this.ws.onclose = () => {
      this.status$.next('closed');
      if (this.reconnect) {
        setTimeout(() => this.openSocket(url, channelId), this.backoffMs);
        this.backoffMs = Math.min(this.backoffMs * 2, this.maxBackoffMs);
      }
    };
  }

  private ensureGeometry(): void {
    if (this.geometry) return;
    this.positions = new Float32Array(this.maxPoints * 3);
    this.geometry = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(this.positions, 3);
    // @ts-ignore
    posAttr.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('position', posAttr);
    const material = new THREE.PointsMaterial({ color: 0x888888, size: 0.05 });
    const points = new THREE.Points(this.geometry, material);
    this.points$.next(points);
  }

  private onWorkerMessage(msg: any): void {
    switch (msg.type) {
      case 'frame': {
        // msg: { positions: Float32Array, count: number, stats:{decodeMs, bitrateKbps,fps} }
        this.ensureGeometry();
        const count = Math.min(msg.count, this.maxPoints);
        // Copy decoded positions into preallocated buffer
        this.positions.set(msg.positions.subarray(0, count * 3), 0);
        const geom = this.geometry!;
        const attr = geom.getAttribute('position') as THREE.BufferAttribute;
        attr.needsUpdate = true;
        geom.setDrawRange(0, count);
        this.stats$.next({
          fps: msg.stats.fps ?? 0,
          bitrateKbps: msg.stats.bitrateKbps ?? 0,
          pointCount: count,
          dropped: msg.stats.dropped ?? 0
        });
        break;
      }
      case 'detections': {
        // Forward via an EventEmitter or a separate subject if needed later
        break;
      }
      case 'error': {
        this.status$.next('error');
        break;
      }
    }
  }
}
```
3) Decoder Web Worker: chunk reassembly + raw positions (v1)
- File: src/assets/workers/pcs-decoder.worker.js
- v1 protocol: header 4+1+2+4+8+4 (PCS1, ver, flags, frameId, tsNs, posCount), then POS block (posCount*3*4 bytes float32). Add chunking with (frameId, chunkIndex, chunkCount, payload).

```js
// pcs-decoder.worker.js (pseudocode)
const STATE = {
  frames: new Map(), // frameId -> {chunks:[], got:0, total:0, totalLen:0}
  lastFpsTick: performance.now(),
  framesThisSecond: 0,
  bitrateBytes: 0,
  dropped: 0,
};
let maxPoints = 100000;

self.onmessage = (ev) => {
  const msg = ev.data;
  if (msg.type === 'init') {
    maxPoints = msg.cfg?.maxPoints ?? maxPoints;
    return;
  }
  if (msg.type === 'chunk') {
    try { handleChunk(msg.buf); } catch (e) { postError(e); }
  } else if (msg.type === 'ctrl') {
    // Optional: handle server control messages
  }
};

function handleChunk(buf) {
  // Assume chunk header: [u32 frameId][u16 ci][u16 cc][u32 payloadLen][payload...]
  const dv = new DataView(buf, 0, 12);
  const frameId  = dv.getUint32(0, true);
  const ci       = dv.getUint16(4, true);
  const cc       = dv.getUint16(6, true);
  const payLen   = dv.getUint32(8, true);
  const payload  = buf.slice(12, 12 + payLen);

  let f = STATE.frames.get(frameId);
  if (!f) {
    f = { chunks: new Array(cc), got: 0, total: cc, totalLen: 0 };
    STATE.frames.set(frameId, f);
  }
  if (f.chunks[ci]) {
    // duplicate; ignore
    return;
  }
  f.chunks[ci] = payload;
  f.got++;
  f.totalLen += payLen;
  STATE.bitrateBytes += buf.byteLength;

  if (f.got === f.total) {
    // Stitch
    const full = new Uint8Array(f.totalLen);
    let off = 0;
    for (let i=0;i<f.chunks.length;i++) {
      const c = new Uint8Array(f.chunks[i]);
      full.set(c, off);
      off += c.byteLength;
    }
    STATE.frames.delete(frameId);
    decodeFullFrame(full.buffer);
    tickFps();
  }
}

function decodeFullFrame(buffer) {
  // Parse frame header: magic(4), ver(u8), flags(u16), frameId(u32), tsNs(u64), posCount(u32)
  const dv = new DataView(buffer);
  if (dv.getUint8(0) !== 0x50 || dv.getUint8(1) !== 0x43 || dv.getUint8(2) !== 0x53 || dv.getUint8(3) !== 0x31) {
    throw new Error('Bad magic');
  }
  const ver = dv.getUint8(4);
  const posCount = dv.getUint32(4 + 1 + 2 + 4 + 8, true);
  const headerLen = 4 + 1 + 2 + 4 + 8 + 4;
  const maxCount = Math.min(posCount, maxPoints);
  // v1 raw POS: float32 xyz
  const posBytes = maxCount * 3 * 4;
  const posBuf = buffer.slice(headerLen, headerLen + posBytes);
  const positions = new Float32Array(posBuf); // already native endian
  // Emit with transfer
  self.postMessage({ type: 'frame', positions, count: maxCount, stats: currentStats() }, [positions.buffer]);
}

function tickFps() {
  STATE.framesThisSecond++;
  const now = performance.now();
  if (now - STATE.lastFpsTick >= 1000) {
    // Reset every second
    STATE.framesThisSecond = 0;
    STATE.bitrateBytes = 0;
    STATE.lastFpsTick = now;
  }
}

function currentStats() {
  const now = performance.now();
  const elapsed = now - STATE.lastFpsTick;
  const fps = elapsed > 0 ? Math.round((STATE.framesThisSecond * 1000) / elapsed) : 0;
  const bitrateKbps = Math.round((STATE.bitrateBytes * 8) / Math.max(elapsed, 1));
  return { fps, bitrateKbps, dropped: STATE.dropped };
}

function postError(e) {
  self.postMessage({ type: 'error', error: (e && e.message) || 'worker error' });
}
```
4) Wire streaming into MainDemoComponent
- If streaming mode: skip static asset pipeline, subscribe to stream, pass live Points to DualViewer via existing inputPoints.

```ts
// main-demo.component.ts (pseudocode snippet)
export class MainDemoComponent implements OnInit, OnDestroy {
  constructor(
    private stream: PointcloudStreamService,
    private streamingMode: StreamingModeService,
    /* existing deps ... */
  ) {}

  sharedPoints?: THREE.Points;
  private subs: Subscription[] = [];

  async ngOnInit() {
    const sSub = this.streamingMode.isStreaming$.subscribe((isStreaming) => {
      if (isStreaming) {
        // Connect to streamer
        this.stream.connect('wss://your-host/pointstream', 'scene:mixed_urban_01');
        this.subs.push(
          this.stream.points$.subscribe((pts) => {
            if (pts) this.sharedPoints = pts;
          })
        );
        // Skip SceneDataService.loadPointsObject(...)
      } else {
        // Existing static path (unchanged)
        this.loadScene(this.stateService.currentScene$.value);
      }
    });
    this.subs.push(sSub);
  }

  ngOnDestroy() { this.subs.forEach(s => s.unsubscribe()); }
}
```
Ensure DualViewer already accepts `inputPoints`; no change needed beyond binding `[inputPoints]="sharedPoints"`.

5) Optional streamed detections (phase 1.5)
- Protocol: add a DET block (temporary JSON string) after POS. Worker posts `{type:'detections', items:[Detection...]}`.
- In MainDemo, subscribe to a `detections$` from stream service and set `baselineDetections` / `agile3dDetections`. Prefer `updateInstancedMesh` when counts match.

```ts
// applying detections (pseudocode)
this.subs.push(
  this.stream.detections$.subscribe((items) => {
    this.baselineDetections = items; // or separate streams per algo
    // SceneViewer will rebuild batches via ngOnChanges
  })
);
```
6) Status and controls UI
- File: src/app/shared/components/stream-status/stream-status.component.ts
- Minimal panel showing status$, fps, bitrate, point count; pause/resume by calling stream.disconnect()/connect().

```ts
// stream-status.component.ts (pseudocode)
@Component({ selector:'app-stream-status', /* template omitted */ })
class StreamStatusComponent {
  status$ = this.stream.status$;
  stats$  = this.stream.stats$;

  constructor(private stream: PointcloudStreamService) {}

  pause() { this.stream.disconnect(); }
  resume() { this.stream.connect('wss://your-host/pointstream', 'scene:mixed_urban_01'); }
}
```
7) Performance and resilience hardening
- Keep decoding in Worker; stream updates run outside Angular.
- Backpressure: in worker, if multiple frames are assembling, keep latest by evicting oldest incomplete frames when `frames.size > N` (e.g., 2).
- Double/triple buffering (optional): recycle 2–3 preallocated ArrayBuffers and swap references instead of copying—requires careful attribute binding; start with copy into a single preallocated array for simplicity.
- GC safety: never recreate BufferAttribute or Geometry during streaming; only mutate data and set `needsUpdate`.

```ts
// ensure outside Angular (pseudocode)
this.ngZone.runOutsideAngular(() => {
  this.stream.connect('wss://...', 'scene:...');
});
```
8) Testing scaffolds
- Mock streamer (dev-only) sending 10 Hz frames of raw Float32 xyz to validate end-to-end updates.
- Worker unit tests: bad magic, partial chunks, out-of-order chunks, large posCount clamp.

```ts
// mock frame encode (pseudocode)
function encodeFrameFloat32(frameId: number, pos: Float32Array): ArrayBuffer {
  const headerLen = 4+1+2+4+8+4;
  const buf = new ArrayBuffer(headerLen + pos.byteLength);
  const dv = new DataView(buf);
  // 'PCS1'
  dv.setUint8(0, 0x50); dv.setUint8(1, 0x43); dv.setUint8(2, 0x53); dv.setUint8(3, 0x31);
  dv.setUint8(4, 1); // ver
  // flags=0, frameId, tsNs=0 for tests
  dv.setUint16(5, 0, true);
  dv.setUint32(7, frameId, true);
  dv.setBigUint64(11, 0n, true);
  dv.setUint32(19, pos.length / 3, true);
  new Uint8Array(buf, headerLen).set(new Uint8Array(pos.buffer, pos.byteOffset, pos.byteLength));
  return buf;
}
```
9) Progressive enhancements (later)
- Swap raw POS with quantized + meshoptimizer: load WASM in worker; decode into a temp buffer, then copy into shared output before postMessage(transfer).
- Simple P-frames: add ADD/DEL blocks; in main thread, when count decreases/increases, update `setDrawRange`; for sparse updates, consider mapping only changed segments (advanced).
- ROI feedback: SceneViewer publishes camera/frustum periodically to StreamService; StreamService sends text control messages over wss.

10) Acceptance criteria (frontend)
- 10 Hz, 50k points stream renders smoothly (≥30 FPS) without geometry/attribute re-creation.
- Reconnect within ≤3 s after transport loss; pause/resume works.
- Streaming off: static asset path behaves exactly as today.
- Stats panel shows non-zero fps/bitrate and correct pointCount; no memory growth in 10‑minute soak.

Notes
- No authentication handling is included per request (removed the token-in-connect requirement).
- All file and class names are suggestions aligned with the current project structure; adapt naming as needed.