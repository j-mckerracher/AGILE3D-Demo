---
tags: [assignment, uow, agent/work-assigner]
unit_id: "U03"
project: "[[01-Projects/AGILE3D-Demo]]"
status: "ready"
created: "2025-10-31"
links:
  se_work_log: "[[SE-Log-U03]]"
---

# UoW Assignment — U03

- Project: [[01-Projects/AGILE3D-Demo]]
- SE Work Log: [[SE-Log-U03]]
- Daily note: [[2025-10-31]]

## Task Overview
Implement downsampling and optional quantization transforms for point clouds to support two deployment tiers (≤100k points full, ≤50k points fallback) and three quantization modes (off, fp16, int16). These transforms compress frames to manage bandwidth and memory constraints across device capabilities, particularly for Safari with strict limits.

## Success Criteria
- [ ] Output point counts respect selected tier within ±1% (e.g., 100k tier: 99k–101k points after downsampling)
- [ ] Quantization modes (off, fp16, int16) round-trip without crashes; metadata indicates mode used
- [ ] Downsampling preserves spatial distribution (no clustering bias toward min/max coordinates)
- [ ] Unit tests cover both transforms with synthetic and representative real frames

## Constraints and Guardrails
- No scope creep; modify only listed files
- ≤3 files, ≤300 LOC total
- No secrets; use environment variables if needed
- No commits unless explicitly instructed

## Dependencies
- [[U02]] (PKL Reader & Schema Mapping—must be completed before this unit starts)

## Files to Read First
- `/home/josh/Code/AGILE3D-Demo/tools/converter/models.py` (frame/detection models from U02)
- `/home/josh/Code/AGILE3D-Demo/tools/converter/pkl2web.py` (CLI integration points)
- Representative frames with >100k points to inform thresholds

## Files to Edit or Create
- `/home/josh/Code/AGILE3D-Demo/tools/converter/transforms/downsample.py` (new module)
- `/home/josh/Code/AGILE3D-Demo/tools/converter/transforms/quantize.py` (new module)
- `/home/josh/Code/AGILE3D-Demo/tools/converter/pkl2web.py` (wire transforms into pipeline via --downsample and --quantize flags)

## Implementation Steps
1. In `downsample.py`, implement `downsample_points(points, target_tier)`:
   - Accept point cloud (Nx3 or Nx4) and tier string ("100k" or "50k")
   - Use uniform random sampling or grid-based voxel decimation to reach tier
   - Return downsampled array and metadata with actual point count and reduction ratio
   - Validate output count within ±1% of tier target
   
2. In `quantize.py`, implement `quantize_points(points, mode, header=None)`:
   - mode ∈ {"off", "fp16", "int16"}; "off" returns points unchanged
   - For "fp16" and "int16": compute bounding box (AABB), normalize to [-1, 1], then quantize
   - Store quantization header with bbox and mode
   - Implement `dequantize_points(quantized, header)` for round-trip validation
   - Validate that dequantized ≈ original (within fixed-point precision)

3. In `pkl2web.py`:
   - Parse `--downsample {100k|50k}` and `--quantize {off|fp16|int16}` args
   - Integrate transforms into convert pipeline after PKL read, before writers
   - Apply downsample first (if specified), then quantize
   - Attach metadata (mode, tier, bbox) to frame for later use in manifest

4. Write unit tests in `/home/josh/Code/AGILE3D-Demo/tools/converter/tests/test_downsample.py` and `test_quantize.py`:
   - `test_downsample_100k_tier`: loads synthetic 150k-point frame, downsamples to 100k, verifies count within ±1%
   - `test_downsample_50k_tier`: same for 50k tier
   - `test_downsample_preserves_distribution`: histogram of original vs downsampled; no extreme clustering
   - `test_quantize_fp16_roundtrip`: quantize and dequantize, verify max error within fp16 precision
   - `test_quantize_int16_roundtrip`: same for int16
   - `test_quantize_off_passthrough`: mode="off" returns points unchanged

5. Validate integration by running CLI with both flags:
   - `python pkl2web.py --input-pkl <sample> --seq-id v_1784 --frames 0:5 --downsample 50k --quantize fp16 --dry-run`
   - Verify frame metadata includes tier and quantization mode

## Tests
- Unit:
  - `/home/josh/Code/AGILE3D-Demo/tools/converter/tests/test_downsample.py`:
    - `test_downsample_100k_tier` — synthetic 150k frame → 100k; within ±1%
    - `test_downsample_50k_tier` — synthetic 150k frame → 50k; within ±1%
    - `test_downsample_preserves_distribution` — no clustering bias
  - `/home/josh/Code/AGILE3D-Demo/tools/converter/tests/test_quantize.py`:
    - `test_quantize_fp16_roundtrip` — max error ≤ fp16 epsilon
    - `test_quantize_int16_roundtrip` — max error ≤ int16 precision
    - `test_quantize_off_passthrough` — mode "off" returns unchanged
- Manual:
  - `python tools/converter/pkl2web.py --input-pkl <real_frame> --seq-id v_1784 --frames 0:1 --downsample 50k --quantize fp16 --dry-run` and inspect frame metadata for tier and mode
  - Generate 3–5 sample frames with both tiers/modes; spot-check histograms or sample points for artifacts

## Commands to Run
```bash
cd /home/josh/Code/AGILE3D-Demo
python -m pytest tools/converter/tests/test_downsample.py -v
python -m pytest tools/converter/tests/test_quantize.py -v
python tools/converter/pkl2web.py --input-pkl assets/data/model-outputs/sample/det/test/frame_0.pkl --seq-id v_1784 --frames 0:1 --downsample 50k --quantize fp16 --dry-run
```

## Artifacts to Return
- Unified diff for `downsample.py`, `quantize.py`, and `pkl2web.py`
- Pytest output showing all tests passing
- Sample console output from manual CLI invocation with metadata

## Minimal Context Excerpts
> Source: [[micro-level-plan#2. Repository Structure and Conventions]]
> Converter: Python 3.11.x (Alt: 3.10/3.12)
>
> Source: [[Work-Decomposer-Output#Unit U03: Converter CLI — Downsampling and Quantization]]
> Scope: Add downsample `{100k|50k}` and quantize `{off|fp16|int16}` transforms. Ensure size thresholds and metadata validated.
> Acceptance: Output point counts respect selected tier within ±1%; Quantization modes round-trip without crashes; metadata indicates mode.
>
> Source: [[micro-level-plan#4. Detailed Module/Component Specifications — SceneDataService]]
> Edge cases: handle varying point counts (realloc only when needed); Z-up yaw; dequantize if header present

## Follow-ups if Blocked
- **Unclear quantization format**: Provide example quantization header layout (bbox bounds, mode byte, point count); document serialization format in code comments
- **Missing real >100k frame samples**: Create synthetic test fixtures with Nx3 float32 arrays; parametrize tests with multiple point counts (50k, 100k, 150k, 200k)
- **Downsampling algorithm choice unclear**: Use uniform random sampling for speed; document that alternative grid-based voxel decimation can be swapped in later if clustering occurs
