---
tags: [assignment, uow, agent/work-assigner]
unit_id: "U04"
project: "[[01-Projects/AGILE3D-Demo]]"
status: "ready"
created: "2025-10-31"
links:
  se_work_log: "[[SE-Log-U04]]"
---

# UoW Assignment — U04

- Project: [[01-Projects/AGILE3D-Demo]]
- SE Work Log: [[SE-Log-U04]]
- Daily note: [[2025-10-31]]

## Task Overview
Implement writers for point clouds (binary .bin), detections (JSON per-branch), and manifest metadata to emit the complete frame and manifest output tree per contract. This unit finalizes the converter pipeline, producing deterministic, ordered outputs ready for CDN upload and web app consumption.

## Success Criteria
- [ ] Output directory tree matches plan: `frames/*.bin`, `*.gt.json`, `*.det.{branch}.json`, `manifest.json`
- [ ] Manifest validates against schema and includes all branches; frame ordering and counts deterministic
- [ ] Spot-checked 3 frames confirm consistent AABB ranges and correct point/detection counts
- [ ] All files written successfully with no data loss or corruption

## Constraints and Guardrails
- No scope creep; modify only listed files
- ≤3 files, ≤350 LOC total
- No secrets; use environment variables if needed
- No commits unless explicitly instructed

## Dependencies
- [[U03]] (Downsampling and Quantization—must be completed before this unit starts)

## Files to Read First
- `/home/josh/Code/AGILE3D-Demo/tools/converter/models.py` (frame/detection data models from U02–U03)
- `/home/josh/Code/AGILE3D-Demo/tools/converter/pkl2web.py` (CLI integration points)
- Micro-level plan §6 "API and Message Contracts" for manifest schema specification

## Files to Edit or Create
- `/home/josh/Code/AGILE3D-Demo/tools/converter/io/writers.py` (new module with binary and JSON writers)
- `/home/josh/Code/AGILE3D-Demo/tools/converter/schemas/manifest.py` (new module with manifest schema and validation)
- `/home/josh/Code/AGILE3D-Demo/tools/converter/pkl2web.py` (wire writers into pipeline; call with frame list and output config)

## Implementation Steps
1. In `schemas/manifest.py`, define manifest data model:
   - Dataclass/dict for `SequenceManifest` with fields:
     - `version` (string, e.g., "1.0")
     - `sequenceId` (string)
     - `fps` (int, default 10)
     - `classMap` (dict mapping label→id, e.g., {"vehicle": 0, "pedestrian": 1, "cyclist": 2})
     - `branches` (list of branch names)
     - `frames` (list of `FrameRef` dicts with id, pointCount, urls)
   - Implement `validate_manifest(manifest)` to ensure all required fields present and types correct
   - Implement `to_json(manifest)` for serialization

2. In `writers.py`, implement point cloud writer:
   - `write_points_bin(points, output_path)`:
     - Write point cloud as float32 binary (raw bytes, no header)
     - If quantized, prepend header: [mode (uint8), bbox_min (3×float32), bbox_max (3×float32), point_count (uint32)]
     - Ensure byte order is deterministic (native endianness or explicit)
     - Return metadata: {file_size, pointCount, header_size}

3. In `writers.py`, implement detection writers:
   - `write_detections_json(detections, output_path, branch_name)`:
     - Write detections as JSON array of objects: [{id, label, score, bbox (x,y,z,l,w,h,yaw), ...}]
     - Sort deterministically by id or frame order
     - Validate bbox format matches schema (6-DOF bounding box in frame coordinates)
   - `write_gt_json(ground_truth, output_path)`:
     - Same as detections but for ground-truth; include confidence=1.0 implicitly

4. In `writers.py`, implement manifest writer:
   - `write_manifest(manifest, output_path)`:
     - Call `validate_manifest()`
     - Serialize via `to_json()` and write with 2-space indentation
     - Ensure JSON is valid and parseable

5. In `pkl2web.py`:
   - In `emit` subroutine (currently stubbed), iterate over converted frames:
     - For each frame, call `write_points_bin(frame.points, f"{out_dir}/frames/{frame.id}.bin")`
     - Call `write_gt_json(frame.gt_detections, f"{out_dir}/{frame.id}.gt.json")`
     - For each branch in branches, call `write_detections_json(frame.det[branch], f"{out_dir}/{frame.id}.det.{branch}.json")`
   - After all frames, build manifest from frame metadata and call `write_manifest(manifest, f"{out_dir}/manifest.json")`
   - Ensure output directory tree exists (create if needed)

6. Write unit tests in `/home/josh/Code/AGILE3D-Demo/tools/converter/tests/test_writers.py`:
   - `test_write_points_bin_valid`: writes synthetic points, reads back, verifies byte-for-byte match
   - `test_write_points_bin_with_quantization_header`: quantized frame with header, validates header structure
   - `test_write_detections_json_valid`: synthetic detections, validates JSON schema
   - `test_write_gt_json_valid`: ground-truth JSON, verifies structure
   - `test_write_manifest_valid`: complete manifest, validates against schema
   - `test_manifest_validation_fails_on_missing_fields`: manifest missing required field, validation fails
   - `test_output_tree_structure`: end-to-end: write 3 frames, verify directory tree and file counts

7. Validate by running CLI with all prior flags:
   - `python pkl2web.py --input-pkl <sample> --seq-id v_1784 --frames 0:3 --downsample 50k --quantize fp16 --branches branches.json --out-dir /tmp/test_output`
   - Verify output tree: `ls -la /tmp/test_output` shows `frames/`, manifest.json, .gt.json, .det.*.json files
   - Spot-check 1–2 binary files and JSON files for consistency

## Tests
- Unit:
  - `/home/josh/Code/AGILE3D-Demo/tools/converter/tests/test_writers.py`:
    - `test_write_points_bin_valid` — synthetic points → binary, read back matches
    - `test_write_points_bin_with_quantization_header` — header structure validated
    - `test_write_detections_json_valid` — detections JSON schema conformance
    - `test_write_gt_json_valid` — ground-truth JSON structure
    - `test_write_manifest_valid` — manifest against schema
    - `test_manifest_validation_fails_on_missing_fields` — negative case
    - `test_output_tree_structure` — end-to-end tree structure
- Manual:
  - Run full CLI pipeline with output to temp dir; verify:
    - Binary file sizes reasonable (frame_0.bin ~100 KB for 50k 4-byte points)
    - JSON files parse without errors (use `python -m json.tool`)
    - manifest.json lists all frames and branches
    - Spot-check 3 frames: AABB ranges make sense, detection counts match expected

## Commands to Run
```bash
cd /home/josh/Code/AGILE3D-Demo
python -m pytest tools/converter/tests/test_writers.py -v
python tools/converter/pkl2web.py \
  --input-pkl assets/data/model-outputs/sample/det/test/frame_0.pkl \
  --seq-id v_1784 \
  --frames 0:3 \
  --downsample 50k \
  --quantize fp16 \
  --branches tools/converter/branches.json \
  --out-dir /tmp/u04_test_output
ls -lR /tmp/u04_test_output
python -m json.tool /tmp/u04_test_output/manifest.json
```

## Artifacts to Return
- Unified diff for `writers.py`, `schemas/manifest.py`, and `pkl2web.py`
- Pytest output showing all tests passing
- Console output from manual CLI run and directory listing
- Sample manifest.json and one .bin/.json file pair (if not too large)

## Minimal Context Excerpts
> Source: [[micro-level-plan#6. API and Message Contracts]]
> POST {Base_URL}/metrics JSON { "ts": number, "sessionId": string, "seqId": string, "frameId": string, "event": "heartbeat"|"error"|"miss"|"play"|"pause", ... }
> FrameRef interface: { id: string; ts?: number; pointCount?: number; urls:{points:string; gt?:string; det?:Record<string,string>}; }
> SequenceManifest: { version:string; sequenceId:string; fps:number; classMap:Record<string,string>; branches:string[]; frames:FrameRef[]; }
>
> Source: [[Work-Decomposer-Output#Unit U04: Converter CLI — Emit Frames and Manifest]]
> Output tree matches plan: `frames/*.bin`, `*.gt.json`, `*.det.{branch}.json`, `manifest.json`.
> Manifest validates against schema and includes branches.
> Ensure ordering, counts, and filenames deterministic.

## Follow-ups if Blocked
- **Quantization header format unclear**: Document exact byte layout in code comment; example: `[mode_byte (1), bbox_min_x/y/z (3×4), bbox_max_x/y/z (3×4), point_count (4)] = 29 bytes header`
- **AABB computation unclear**: Compute from min/max across all point coordinates; store as float32 triplets in header for dequantization
- **JSON schema too vague**: Use provided FrameRef/SequenceManifest from micro-level plan §16; validate with simple field checks (no external schema lib required)
- **Filesystem sync concerns**: Use `os.makedirs()` with exist_ok=True; flush/sync before return if performance critical (defer if not measured)
