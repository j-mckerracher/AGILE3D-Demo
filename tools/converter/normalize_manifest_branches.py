#!/usr/bin/env python3
"""
Normalize manifest branches array to match actual detection branches in frames.

Usage:
  python tools/converter/normalize_manifest_branches.py --seq-dir "src/assets/data/sequences/v_1784_1828"

Behavior:
- Loads manifest.json from --seq-dir
- Extracts branch keys from frames[0].urls.det
- Updates top-level branches array to match exactly (sorted alphabetically)
- Saves manifest with minimal JSON formatting
"""
import argparse
import json
from pathlib import Path
from typing import Set


def normalize_manifest_branches(seq_dir: Path):
    """Normalize branches array in manifest.json to match frames[0].urls.det keys."""
    manifest_path = seq_dir / 'manifest.json'
    
    if not manifest_path.exists():
        raise FileNotFoundError(f'manifest.json not found at {manifest_path}')
    
    # Load manifest
    manifest = json.loads(manifest_path.read_text())
    frames = manifest.get('frames') or []
    
    if not frames:
        raise ValueError('manifest frames missing or empty')
    
    # Extract branch keys from first frame's det URLs
    first_frame = frames[0]
    urls = first_frame.get('urls', {})
    det_map = urls.get('det', {})
    
    if not det_map:
        print(f'Warning: No detection URLs found in frames[0].urls.det for {seq_dir}')
        return
    
    # Get all branch keys and sort alphabetically
    actual_branches = sorted(det_map.keys())
    
    # Get current branches for comparison
    current_branches = manifest.get('branches', [])
    
    print(f'Sequence: {manifest.get("sequenceId", "unknown")}')
    print(f'Current branches ({len(current_branches)}): {current_branches}')
    print(f'Actual branches ({len(actual_branches)}): {actual_branches}')
    
    # Check if update is needed
    if set(current_branches) == set(actual_branches):
        print('Branches already match - no update needed')
        return
    
    # Update branches array
    manifest['branches'] = actual_branches
    
    # Save manifest with minimal JSON formatting
    manifest_path.write_text(json.dumps(manifest, separators=(",", ":")))
    
    print(f'Updated branches array in {manifest_path}')
    print(f'Removed: {set(current_branches) - set(actual_branches)}')
    print(f'Added: {set(actual_branches) - set(current_branches)}')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--seq-dir', required=True, help='Sequence directory containing manifest.json')
    args = ap.parse_args()
    
    seq_dir = Path(args.seq_dir)
    normalize_manifest_branches(seq_dir)


if __name__ == '__main__':
    main()

