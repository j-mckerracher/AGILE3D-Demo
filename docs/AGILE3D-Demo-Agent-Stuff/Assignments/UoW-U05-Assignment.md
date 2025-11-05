---
tags: [assignment, uow, agent/work-assigner]
unit_id: "U05"
project: "[[01-Projects/AGILE3D-Demo]]"
status: "ready"
created: "2025-11-01"
links:
  se_work_log: "[[SE-Log-U05]]"
---

# UoW Assignment — U05

- Project: [[01-Projects/AGILE3D-Demo]]
- SE Work Log: [[SE-Log-U05]]
- Daily note: [[2025-11-01]]

## Task Overview
Implement validators for converter output integrity and create a shell script to generate a 10-frame sample dataset (both full and fallback tiers) into the web app's assets directory. This unit provides QA checks on the converter pipeline output and delivers a demo-ready sample for local development and E2E testing.

## Success Criteria
- [ ] Validator emits pass/fail summary report; non-fatal warnings allowed (e.g., sparse detections)
- [ ] Running `./generate_sample.sh` successfully places 10-frame sample in `/home/josh/Code/AGILE3D-Demo/apps/web/src/assets/data/streams/sample/` with manifest and all frames
- [ ] Sample includes both full (≤100k pts) and fallback (≤50k pts) tiers for at least one sequence
- [ ] Manifest in sample directory validates and can be loaded by web app in later UoWs

## Constraints and Guardrails
- No scope creep; modify only listed files
- ≤2 files, ≤250 LOC total
- No secrets; use environment variables for paths if needed
- Binary artifacts (*.bin) not committed to VCS; .gitignore applied
- No commits unless explicitly instructed

## Dependencies
- [[U04]] (Emit Frames and Manifest—must be completed before this unit starts)

## Files to Read First
- `/home/josh/Code/AGILE3D-Demo/tools/converter/pkl2web.py` (full CLI interface and flags)
- `/home/josh/Code/AGILE3D-Demo/tools/converter/models.py` and `schemas/manifest.py` (data models and validation)
- `/home/josh/Code/AGILE3D-Demo/apps/web/src/assets/` (directory structure to confirm)

## Files to Edit or Create
- `/home/josh/Code/AGILE3D-Demo/tools/converter/validators/validators.py` (new module with validator functions)
- `/home/josh/Code/AGILE3D-Demo/tools/converter/generate_sample.sh` (new shell script)

## Implementation Steps
1. In `validators/validators.py`, implement validators as functions:
   - `validate_frame_count(manifest, expected_count)`: assert manifest.frames length matches expected
   - `validate_point_counts(manifest)`: check each frame's pointCount > 0 and ≤ tier limit (100k or 50k)
   - `validate_aabb_ranges(frames_data)`: for each frame, compute AABB from points and compare to manifest; flag if wildly different
   - `validate_yaw_sanity(detections)`: check yaw values in [-π, π]; warn if outliers detected
   - `validate_frame_ordering(manifest)`: verify frame ids are sequential and filenames match pattern
   - `validate_detector_coverage(frames_data, branches)`: ensure all branches have detections (allow empty, warn if all empty)
   - Implement `run_validators(output_dir, manifest_path, tier)` to orchestrate all checks and return summary report:
     - Report format: dict with keys {checks: {name: pass/fail}, warnings: [...], errors: [...], summary: string}
   - Print summary and return exit code (0 if all pass, 1 if critical failures)

2. Create `generate_sample.sh`:
   - Define paths for input (PKL sources), output (web assets), and branches JSON
   - Hardcode sequences to generate: v_1784–1828 (take frames 0–9), p_7513–7557 (take frames 0–9), c_7910–7954 (take frames 0–9)
   - For each sequence:
     - Call pkl2web.py for full tier (100k): `python pkl2web.py --input-pkl <pkl> --seq-id <seq> --frames 0:10 --downsample 100k --quantize off --out-dir /tmp/full_tier`
     - Call pkl2web.py for fallback tier (50k): `python pkl2web.py --input-pkl <pkl> --seq-id <seq> --frames 0:10 --downsample 50k --quantize off --out-dir /tmp/fallback_tier`
     - Call validator on each output
     - Copy both tier outputs to assets directory under sequence id: `apps/web/src/assets/data/streams/<seq_id>/full/` and `<seq_id>/fallback/`
   - Create directory structure: `apps/web/src/assets/data/streams/{v_1784_1828,p_7513_7557,c_7910_7954}/{full,fallback}/`
   - After all sequences, create a composite manifest listing all sequences and tiers (simple JSON)
   - Exit code 0 on success, 1 on any validation failure

3. Write unit tests in `/home/josh/Code/AGILE3D-Demo/tools/converter/tests/test_validators.py`:
   - `test_validate_frame_count_pass`: synthetic manifest with expected count, passes
   - `test_validate_frame_count_fail`: manifest with wrong count, fails
   - `test_validate_point_counts_pass`: all frame point counts in valid range
   - `test_validate_point_counts_fail`: one frame exceeds 100k tier limit
   - `test_validate_aabb_ranges_pass`: computed AABBs match manifest (within tolerance)
   - `test_validate_yaw_sanity_pass`: all yaw values in [-π, π]
   - `test_validate_yaw_sanity_warn`: yaw outliers detected, returns warning
   - `test_validate_frame_ordering_pass`: frame ids sequential
   - `test_run_validators_summary`: orchestrated validator returns summary report with pass/fail counts

4. Validate by running script:
   - `cd /home/josh/Code/AGILE3D-Demo && bash tools/converter/generate_sample.sh`
   - Check exit code and console output
   - Verify sample directory exists and contains expected structure:
     - `ls -R apps/web/src/assets/data/streams/`
   - Spot-check one manifest: `python -m json.tool apps/web/src/assets/data/streams/v_1784_1828/full/manifest.json`
   - Verify .gitignore includes binary artifacts: `cat .gitignore | grep -i bin`

## Tests
- Unit:
  - `/home/josh/Code/AGILE3D-Demo/tools/converter/tests/test_validators.py`:
    - `test_validate_frame_count_pass` — synthetic manifest passes count check
    - `test_validate_frame_count_fail` — wrong count, fails
    - `test_validate_point_counts_pass` — all within limits
    - `test_validate_point_counts_fail` — one exceeds tier limit
    - `test_validate_aabb_ranges_pass` — computed vs manifest AABBs match
    - `test_validate_yaw_sanity_pass` — all yaw in [-π, π]
    - `test_validate_yaw_sanity_warn` — outliers, warning issued
    - `test_validate_frame_ordering_pass` — sequential frame ids
    - `test_run_validators_summary` — full orchestration returns report
- Manual:
  - Run `bash generate_sample.sh` and monitor console for progress and validation output
  - Verify sample tree: `ls -lR apps/web/src/assets/data/streams/v_1784_1828/`
  - Confirm manifest valid JSON and loadable
  - Check .gitignore includes binary patterns

## Commands to Run
```bash
cd /home/josh/Code/AGILE3D-Demo
python -m pytest tools/converter/tests/test_validators.py -v
bash tools/converter/generate_sample.sh
ls -lR apps/web/src/assets/data/streams/
python -m json.tool apps/web/src/assets/data/streams/v_1784_1828/full/manifest.json | head -30
cat .gitignore | grep -E '(\*\.bin|/assets/data/streams/sample)' || echo "Note: verify .gitignore entries manually"
```

## Artifacts to Return
- Unified diff for `validators.py` and `generate_sample.sh`
- Pytest output showing all validator tests passing
- Console output from `generate_sample.sh` showing successful generation and validation
- Sample directory listing: `ls -R apps/web/src/assets/data/streams/`
- One sample manifest.json (text, not binary)

## Minimal Context Excerpts
> Source: [[micro-level-plan#5. Data Model and Persistence]]
> No DB; client memory only (sliding window ≤3 frames). Caching: CDN immutable for frames; client no IndexedDB v1; manifest cache per HTTP TTL (300 s).
>
> Source: [[Work-Decomposer-Output#Unit U05: Converter CLI — Validation Report & Sample Generator]]
> Implement validators (counts, AABB, yaw sanity, ordering). Provide `generate_sample.sh` to emit 10-frame sample (full and fallback tiers) into assets path.
> Validator emits pass/fail summary; non-fatal warnings allowed. Running script places 10-frame sample in `/home/josh/Code/AGILE3D-Demo/apps/web/src/assets/data/streams/sample/` with manifest.

## Follow-ups if Blocked
- **Sample PKL paths unknown**: Confirm actual paths for v_1784–1828, p_7513–7557, c_7910–7954 sequences; update script with correct globs
- **Assets directory doesn't exist**: Create it via `mkdir -p` in script; allow idempotent re-runs
- **Quantization for sample unclear**: Use `--quantize off` for simplicity in sample; full/fallback distinction is only via --downsample tier
- **Validator output format vague**: Use simple dict/JSON with {checks: {name: bool}, warnings: [str], errors: [str]} and print as readable text summary
