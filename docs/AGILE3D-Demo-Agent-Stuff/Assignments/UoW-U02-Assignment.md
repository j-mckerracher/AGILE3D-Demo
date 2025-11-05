---
tags: [assignment, uow, agent/work-assigner]
unit_id: "U02"
project: "[[01-Projects/AGILE3D-Demo]]"
status: "ready"
created: "2025-10-31"
links:
  se_work_log: "[[SE-Log-U02]]"
---

# UoW Assignment — U02

- Project: [[01-Projects/AGILE3D-Demo]]
- SE Work Log: [[SE-Log-U02]]
- Daily note: [[2025-10-31]]

## Task Overview
Implement a PKL file reader and internal data models for frames and detections, then wire the reader into the CLI pipeline without emitting files. This unit establishes the schema mapping layer between raw detector outputs and the converter's internal representation, enabling downstream frame/manifest generation.

## Success Criteria
- [ ] PKL reader loads detection and ground-truth pkl files and returns in-memory structures matching the interfaces in §16 of the micro-level plan
- [ ] Unknown fields are tolerated (ignored) per additive versioning rule; no schema changes break older pkl variants
- [ ] `--dry-run` prints summary counts per frame (e.g., frame 0: 1250 points, 42 detections from branch X)
- [ ] Unit tests cover fixture PKL files with realistic data

## Constraints and Guardrails
- No scope creep; modify only listed files
- ≤3 files, ≤300 LOC total
- No secrets; use environment variables for paths if needed
- No commits unless explicitly instructed

## Dependencies
- [[U01]] (CLI skeleton and args parsing)

## Files to Read First
- `/home/josh/Code/AGILE3D-Demo/tools/converter/pkl2web.py` (from U01)
- `/home/josh/Code/AGILE3D-Demo/assets/data/model-outputs/**/*.pkl` (sample detection PKLs to inspect format)

## Files to Edit or Create
- `/home/josh/Code/AGILE3D-Demo/tools/converter/pkl2web.py` (wire reader into pipeline)
- `/home/josh/Code/AGILE3D-Demo/tools/converter/io/pkl_reader.py` (new PKL reader module)
- `/home/josh/Code/AGILE3D-Demo/tools/converter/models.py` (data models for frames and detections)

## Implementation Steps
1. Inspect sample PKL files (e.g., from `assets/data/model-outputs/**/det/test/*.pkl` and `adaptive-3d-openpcdet/output/`) to understand structure and key fields
2. Define Python dataclasses in `models.py` for `Frame`, `Detection`, and `FrameData` matching the micro-level spec (FrameRef interface)
3. Implement `pkl_reader.py` with `read_pkl(path)` function that:
   - Loads pickle safely (use `pickle.load`)
   - Extracts point clouds and bounding boxes from the expected schema
   - Tolerates extra fields (use `getattr(obj, 'field', default)`)
   - Returns `FrameData` or list of `Frame` objects
4. In `pkl2web.py`, update the `convert` subroutine to:
   - Call `pkl_reader.read_pkl()` for each frame
   - Populate internal cache structures
   - In `--dry-run` mode, print frame counts (points, detections per branch)
5. Write unit tests in `/home/josh/Code/AGILE3D-Demo/tools/converter/tests/test_pkl_reader.py` with fixture PKL data covering:
   - Normal case: loads and maps fields correctly
   - Missing optional fields: does not crash
   - Schema drift: ignores unknown fields

## Tests
- Unit:
  - `/home/josh/Code/AGILE3D-Demo/tools/converter/tests/test_pkl_reader.py`: 
    - `test_read_pkl_valid_detection` — loads detection pkl, verifies frame count and detection mapping
    - `test_read_pkl_tolerates_unknown_fields` — adds unexpected field to fixture, verifies no crash
    - `test_read_pkl_handles_missing_optional_fields` — fixture with sparse detection data, verifies graceful handling
- Manual:
  - Run `python tools/converter/pkl2web.py --input-pkl <sample.pkl> --seq-id v_1784 --frames 0:10 --dry-run` and verify summary output matches expected counts

## Commands to Run
```bash
cd /home/josh/Code/AGILE3D-Demo
python -m pytest tools/converter/tests/test_pkl_reader.py -v
python tools/converter/pkl2web.py --input-pkl assets/data/model-outputs/sample/det/test/frame_0.pkl --seq-id v_1784 --frames 0:1 --dry-run
```

## Artifacts to Return
- Unified diff for `pkl2web.py`, `pkl_reader.py`, and `models.py`
- Test output from `pytest` showing all passes
- Sample console output from `--dry-run` invocation

## Minimal Context Excerpts
> Source: [[micro-level-plan#4. Detailed Module/Component Specifications]]
> SceneDataService loads/parses points in Worker, patch THREE.BufferAttribute in-place, deserialize detections, filter by score/labels.
> 
> Source: [[micro-level-plan#16. Appendices — Example TypeScript interfaces]]
> Example interfaces for reference: `FrameRef { id: string; ts?: number; pointCount?: number; urls:{points:string; gt?:string; det?:Record<string,string>}; }`
> 
> Source: [[Work-Decomposer-Output#Unit U02: Converter CLI — PKL Read & Schema Mapping]]
> PKL schema stability; provide sample fixtures. Unknown fields tolerated (ignored) per additive versioning rule.

## Follow-ups if Blocked
- **Missing sample pkl paths**: Confirm exact globs and whether sample fixtures are pre-generated; if not, create synthetic fixtures with representative point counts and detection fields
- **Unclear pkl schema**: Inspect first 1–2 pkl files with `pickle` module to print structure; document assumptions in code comments
