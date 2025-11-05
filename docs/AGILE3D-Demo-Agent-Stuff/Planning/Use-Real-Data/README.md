# Use Real Data Integration Plan (Agile3D Demo)

Author inputs (from Pengcheng):
- Frames: per-frame point clouds (.bin/.npy/.ply/.pcd) with [x,y,z,(intensity, elongation)]. XYZ is sufficient.
- Frame metadata: timestamps, frame IDs, point counts.
- Detection schema (PKL): boxes_lidar = [x, y, z, dx, dy, dz, heading], plus score, pred_labels, frame_id, metadata, name.
- GT keys: dict_keys(['sample_idx','points','frame_id','gt_boxes','lidar_aug_matrix','use_lead_xyz','metadata','batch_size']).
- Detection keys: dict_keys(['name','score','boxes_lidar','pred_labels','frame_id','metadata']).
- 39,987 frames in order (GT and detections).
- Local sample detections: /home/josh/Code/AGILE3D-Demo/assets/data/model-outputs.
- Reference scripts:
  - Visualizer: /home/josh/Code/adaptive-3d-openpcdet/tools/demo_waymo_from_pkl.py
  - Export snippets: /home/josh/Code/adaptive-3d-openpcdet/tools/export_data_dict.py


A) What must change

1) Code changes (browser app)
- Scene data model: move from one-shot scene file to a sequenced frame stream.
  - Extend SceneMetadata to allow either pointsBin or frames[] manifest:
    - frames: [{ id, ts, pointCount, urls: { points, gt, det: { [branchId]: url } } }].
- SceneDataService:
  - Add loadFrame(frame): fetch ArrayBuffer of points, parse in worker, and update an existing BufferAttribute (reuse the same THREE.Points; do NOT recreate per frame).
  - Add detection deserializer from the web-facing JSON (derived from PKL): map boxes_lidar → Detection:
    - center = [x,y,z]
    - dimensions = { width: dx, length: dy, height: dz }
    - yaw = heading
    - confidence = score
    - class from pred_labels mapping {1:vehicle, 2:pedestrian, 3:cyclist} (confirm label map).
- New FrameStreamService:
  - Controls playback (play/pause/seek), target FPS (10–20Hz), prefetch window (e.g., 3–6 frames), backpressure/cancellation via AbortController.
  - Emits currentFrame$ that SceneDataService consumes.
- DualViewerComponent:
  - Accept input of sharedGeometry + currentFrame detections for baseline and active branch.
  - Wire to FrameStreamService; re-render on frame tick.
- SceneViewerComponent:
  - Already supports sharedPointGeometry; ensure geometry attribute replacement path handles different point counts.
  - Tooltip confidence/labels already supported; add optional score threshold input.
- PaperDataService/SimulationService:
  - Keep branch selection from paper JSON; add a mapping method to pick detections for active branch for currentFrame.
- BBox instancing utilities:
  - Keep yaw about +Z (OpenPCDet convention). Verify Z-up alignment in Three.js; adjust if needed.

2) Planning changes
- Phase 1: add WP-1.2.3 Real Data Ingestion & Conversion (Waymo/nuScenes)
  - Deliverables: converter CLI, manifest schema, 3 curated sequences (vehicle-heavy, pedestrian-heavy, mixed), validation report (counts, ranges, yaw sanity).
- Phase 2: add WP-2.1.5 Frame Streaming & Playback (10–20Hz, prefetch, seek) and WP-2.2.x Score/Label Filters.
- Phase 3: add WP-3.2.x CDN & CORS (S3+CloudFront), range-GET and cache header validation; error handling & offline fallback; legal/licensing review.


B) What must be added

1) Code to add
- Offline converter (pkl2web.py):
  - Input: large GT chunks and detection PKLs.
  - Output per curated sequence:
    - frames/<frameId>.bin     # Float32Array [x,y,z] (optional FP16/int16 quantization)
    - frames/<frameId>.gt.json # { boxes:[{x,y,z,dx,dy,dz,heading,label}] }
    - frames/<frameId>.det.<branchId>.json # { boxes:[{x,y,z,dx,dy,dz,heading,score,label}] }
    - manifest.json            # sequenced index with urls and basic metadata
  - Options: downsample to ≤100k points (and 50k fallback), quantize/BR compress, slice by frame ranges.
- New FrameStreamService (Angular): fetch-next with prefetch window; abort stale fetches on seek; keep buffer small to bound memory.
- Scene changes: update SceneDataService to patch positions buffer per frame and cache only a small moving window.
- Simple detection label mapper and confidence threshold filtering.
- Minimal local sample under src/assets/data/streams/<sequence>/ for dev; prod will use S3/CloudFront.

2) Planning to add
- Data volume policy: ship only small curated sequences (e.g., 30–60 frames each) with full (≤100k pts) + fallback (≤50k pts) tiers.
- Hosting plan: S3 Standard + CloudFront, immutable caching for binary, short caching for manifests, CORS limited to site origin, optional signed URLs.
- Validation tasks: orientation (yaw), coordinate sanity, counts, frame rate timing under jitter, memory stability (15 min), 3D diff visual spot-check.


C) Answers to operational questions

1) How will the large amount of data be used?
- Not streamed in entirety. An offline pipeline will curate short sequences and convert to web artifacts.
- Browser streams per-frame .bin and per-frame detection JSON at 10–20Hz with 2–6 frame prefetch. Points buffer is reused each frame to avoid allocations.
- Downsampling/quantization reduces payload; fallback tier ensures performance on modest GPUs.

2) Should data be stored in the website’s local assets folder?
- Only tiny samples for local development. Production data should be on CDN (CloudFront), not packaged in the app, to keep bundles small and cacheable.

3) Can it be streamed from AWS? Feasibility (cost/latency)
- Yes: S3 + CloudFront is the recommended setup.
  - Storage (2–5 GB curated sequences): ~$0.05–$0.12/month.
  - Egress: ~$0.08–$0.12/GB via CloudFront. A 100–300 MB session costs ~$0.01–$0.03; 1,000 sessions ≈ $8–$36. Feasible.
  - Latency: Edge distribution + small chunked requests with prefetch works well. Enable gzip/br for JSON; evaluate br for .bin (benefit may be minor unless quantized).

4) Other critical considerations
- Licensing: Waymo/nuScenes redistribution limitations — only host permitted derived subsets; confirm Terms or obtain permission.
- Coordinate frames: confirm LiDAR frame used in OpenPCDet; ensure Three.js world axes match; validate yaw rotation about +Z.
- Memory/perf: always reuse Points object and BufferAttribute; clamp DPR; limit prefetch; cancel in-flight fetches on seek; avoid large caches.
- Error handling: tolerate missing frames; show last-good frame or skip; telemetry for missing objects.
- Security/CORS: limit origins, immutable cache headers for frame binaries, signed URLs if needed.
- Reproducibility: version manifests and include source offsets/ranges to regenerate.


Schemas & Formats

Manifest (per sequence)
```json path=null start=null
{
  "version": "1.0.0",
  "sequenceId": "waymo_v_1784_1982",
  "fps": 10,
  "classMap": {"1": "vehicle", "2": "pedestrian", "3": "cyclist"},
  "branches": ["DSVT_Voxel", "CP_Pillar_032", "CP_Pillar_048", "CP_Voxel_024"],
  "frames": [
    {
      "id": "1784",
      "ts": 1730265600.123,
      "pointCount": 99872,
      "urls": {
        "points": "https://cdn/site/sequences/waymo_v_1784_1982/frames/1784.bin",
        "gt": "https://cdn/site/sequences/waymo_v_1784_1982/frames/1784.gt.json",
        "det": {
          "DSVT_Voxel": ".../1784.det.DSVT_Voxel.json",
          "CP_Pillar_032": ".../1784.det.CP_Pillar_032.json"
        }
      }
    }
  ]
}
```

Detection JSON (per frame, per branch)
```json path=null start=null
{
  "boxes": [
    {"x":0.3,"y":12.1,"z":-1.2,"dx":4.5,"dy":1.8,"dz":1.6,"heading":1.57,"score":0.92,"label":1}
  ]
}
```

GT JSON (per frame)
```json path=null start=null
{
  "boxes": [
    {"x":0.3,"y":12.1,"z":-1.2,"dx":4.5,"dy":1.8,"dz":1.6,"heading":1.57,"label":1}
  ]
}
```

Binary points (.bin)
- Float32Array of [x,y,z] per point. Optional FP16 (Uint16 with scale/offset header) or int16 quantization.
- Optional simple header (JSON 128B) describing quantization parameters; otherwise raw float32.

Cloud/CDN headers (examples)
```json path=null start=null
{
  "headers": [
    { "source": "/sequences/(.*)\\.bin", "headers": [
      { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
    ]},
    { "source": "/sequences/(.*)\\.json", "headers": [
      { "key": "Cache-Control", "value": "public, max-age=3600" },
      { "key": "Access-Control-Allow-Origin", "value": "https://demo.example.com" }
    ]}
  ]
}
```


Proposed code artifacts

Python converter (pkl2web.py – outline)
```python path=null start=null
import argparse, json, os, pickle, numpy as np
from pathlib import Path

LABEL_MAP = {1: 'vehicle', 2: 'pedestrian', 3: 'cyclist'}

def save_points_bin(points_xyz: np.ndarray, out: Path):
    out.parent.mkdir(parents=True, exist_ok=True)
    points_xyz.astype(np.float32).tofile(out)

def det_to_json(entry, out: Path):
    boxes = entry['boxes_lidar']  # N x 7
    scores = entry.get('score')
    labels = entry.get('pred_labels')
    ds = []
    for i, b in enumerate(boxes):
        d = {
            'x': float(b[0]), 'y': float(b[1]), 'z': float(b[2]),
            'dx': float(b[3]), 'dy': float(b[4]), 'dz': float(b[5]),
            'heading': float(b[6]), 'score': float(scores[i]) if scores is not None else 1.0,
            'label': int(labels[i]) if labels is not None else 1,
        }
        ds.append(d)
    out.parent.mkdir(parents=True, exist_ok=True)
    json.dump({'boxes': ds}, open(out, 'w'))

def gt_to_json(entry, out: Path):
    boxes = entry['gt_boxes'][0][:, :7]  # shape [M,7]
    labels = entry.get('gt_names')
    ds = []
    for i, b in enumerate(boxes):
        d = {'x': float(b[0]), 'y': float(b[1]), 'z': float(b[2]), 'dx': float(b[3]), 'dy': float(b[4]), 'dz': float(b[5]), 'heading': float(b[6]), 'label': int(labels[i]) if labels is not None else 1}
        ds.append(d)
    out.parent.mkdir(parents=True, exist_ok=True)
    json.dump({'boxes': ds}, open(out, 'w'))

# Build manifest with frame -> urls mapping
```

TypeScript service changes (interfaces)
```ts path=null start=null
export interface FrameRef {
  id: string; ts?: number; pointCount?: number;
  urls: { points: string; gt?: string; det?: Record<string,string>; };
}
export interface SequenceManifest {
  version: string; sequenceId: string; fps: number; branches: string[]; frames: FrameRef[];
}
```


Directory layout (CDN)
```
sequences/
  waymo_v_1784_1982/
    manifest.json
    frames/
      1784.bin
      1784.gt.json
      1784.det.DSVT_Voxel.json
      1784.det.CP_Pillar_032.json
      1785.bin
      ...
```


Work packages & acceptance criteria

WP-1.2.3 Real Data Ingestion & Conversion (2–3d)
- Build pkl2web converter; emit 3 curated sequences with full/fallback tiers.
- Validate schema; produce validation report (counts, AABB ranges, yaw sanity, frame ordering).
- Output size targets: per sequence 50–150MB compressed; total ≤ 0.8–1.5GB hosted.

WP-2.1.5 Frame Streaming & Playback (2–3d)
- Implement FrameStreamService with prefetch (3–6 frames), play/pause/seek, rate 10–20Hz.
- Update SceneDataService to reuse Points and BufferAttribute; no per-frame object churn.
- Meet <16ms update/render per frame on target hardware; no memory growth over 15 min.

WP-2.2.x Score/Label Filters (0.5–1d)
- UI slider for score threshold; label toggles; wires into detection deserializer.

WP-3.2.x CDN & CORS (0.5–1d)
- S3 + CloudFront configured with immutable caching for .bin, short caching for JSON, CORS restricted to site.
- Range-GET tested; preload/prefetch policies verified.

Risk register & mitigations
- Licensing: only derived/decimated subsets; consult dataset terms; keep sample sequences minimal.
- Payload spikes: cap per-frame point counts; add fallback tier; prefetch window small; quantization toggle.
- Axis mismatch: add early visual sanity tests; if z-up mismatch, rotate accordingly once in loader.
- Egress budgets: cap session size via sequence length; instrument total bytes downloaded.


Next steps / Action items
- Decide representative sequences (frame ranges) for each scenario; confirm class label map.
- Implement pkl2web converter and generate a tiny local sample (5–10 frames) for wiring.
- Add FrameStreamService, wire DualViewer to sequence manifest, and validate playback.
- Stand up S3+CloudFront; upload curated sequences; configure headers/CORS; test on staging.
- Add UI controls (score threshold, pause/play/seek); QA for memory/perf.
