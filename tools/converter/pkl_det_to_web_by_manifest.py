#!/usr/bin/env python3
"""
Convert detection PKL → per-frame web JSON by existing sequence manifest.

Usage (Windows pwsh examples, run from repo root):
  python tools/converter/pkl_det_to_web_by_manifest.py \
    --pkl "assets/data/dsvt_sampled_pillar030_det.pkl" \
    --branch DSVT_Pillar_030 \
    --seq-dir "src/assets/data/sequences/v_1784_1828" --score 0.7

Repeat for p_7513_7557 and c_7910_7954 and for CP_Pillar_032.

Behavior:
- Reads PKL with keys: frame_id, boxes_lidar, score, pred_labels (OpenPCDet style).
- Builds an index by str(frame_id).
- Loads manifest.json in --seq-dir, iterates frames and looks up by frames[i].origId (string).
- Writes frames/<id>.det.<branch>.json for each frame with {boxes:[...]}.
- Augments manifest frames[i].urls.det[branch] with the relative path.

Notes:
- Label map: 1 vehicle, 2 pedestrian, 3 cyclist.
- boxes_lidar order: [x,y,z,dx,dy,dz,heading].
- Keeps JSON minimal (separators=(",", ":")).
"""
import argparse, json, pickle, re
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

import numpy as np

LABEL_MAP = {1: 'vehicle', 2: 'pedestrian', 3: 'cyclist'}


def ensure_dir(p: Path):
    p.mkdir(parents=True, exist_ok=True)


def save_json(path: Path, obj: Any):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('w') as f:
        json.dump(obj, f, separators=(",", ":"), ensure_ascii=False)


def coerce_list(x):
    if x is None:
        return []
    if isinstance(x, (list, tuple)):
        return list(x)
    try:
        return list(x)
    except Exception:
        return [x]


def iter_pkl_records(pkl_path: Path) -> Iterable[Dict[str, Any]]:
    with pkl_path.open('rb') as f:
        data = pickle.load(f)
    # Case 1: list of dicts
    if isinstance(data, list) and (len(data) == 0 or isinstance(data[0], dict)):
        for rec in data:
            yield rec
        return
    # Case 2: dict of lists
    if isinstance(data, dict) and 'frame_id' in data:
        ids = coerce_list(data['frame_id'])
        n = len(ids)
        keys = [k for k, v in data.items() if hasattr(v, '__len__') and len(coerce_list(v)) == n]
        rows = {k: coerce_list(data[k]) for k in keys}
        for i in range(n):
            rec = {k: rows[k][i] for k in keys}
            yield rec
        return
    # Fallback single dict
    if isinstance(data, dict):
        yield data
        return
    raise ValueError(f'Unsupported PKL structure in {pkl_path}')


def to_str_frame_id(frame_id: Any) -> str:
    try:
        if isinstance(frame_id, (bytes, bytearray)):
            frame_id = frame_id.decode('utf-8', 'ignore')
        return str(frame_id).strip()
    except Exception:
        return str(frame_id)


def normalize_manifest_orig_id(value: Any) -> str:
    s = to_str_frame_id(value)
    # Try to extract inner segment if the string looks like [ 'segment-..._NNN' ]
    m = re.search(r"segment-[^'\"]+", s)
    if m:
        return m.group(0)
    return s


def extract_boxes7(x: Any) -> np.ndarray:
    arr = np.asarray(x)
    if arr.ndim != 2 or arr.shape[1] < 7:
        raise ValueError(f'boxes has shape {arr.shape}, expected (N,7)')
    return arr[:, :7]


def build_det_objs(boxes7: np.ndarray, scores: Optional[Any], labels: Optional[Any]):
    sc = np.asarray(scores) if scores is not None else None
    lb = np.asarray(labels) if labels is not None else None
    out = []
    for i in range(boxes7.shape[0]):
        o = {
            'x': float(boxes7[i,0]), 'y': float(boxes7[i,1]), 'z': float(boxes7[i,2]),
            'dx': float(boxes7[i,3]), 'dy': float(boxes7[i,4]), 'dz': float(boxes7[i,5]),
            'heading': float(boxes7[i,6])
        }
        if sc is not None and i < sc.shape[0]:
            o['score'] = float(sc[i])
        if lb is not None and i < lb.shape[0]:
            try:
                o['label'] = int(lb[i])
            except Exception:
                o['label'] = lb[i]
        out.append(o)
    return out


def build_index(pkl_path: Path) -> Dict[str, Dict[str, Any]]:
    idx: Dict[str, Dict[str, Any]] = {}
    for rec in iter_pkl_records(pkl_path):
        fid = to_str_frame_id(rec.get('frame_id'))
        if not fid:
            continue
        idx[fid] = rec
    return idx


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--pkl', required=True, help='Path to detection PKL file')
    ap.add_argument('--branch', required=True, help='Branch ID to write under urls.det')
    ap.add_argument('--seq-dir', required=True, help='Sequence directory containing manifest.json and frames/')
    ap.add_argument('--score', type=float, default=0.7, help='Score threshold (default 0.7)')
    args = ap.parse_args()

    pkl_path = Path(args.pkl)
    seq_dir = Path(args.seq_dir)
    manifest_path = seq_dir / 'manifest.json'
    frames_dir = seq_dir / 'frames'

    if not manifest_path.exists():
        raise FileNotFoundError(f'manifest.json not found at {manifest_path}')

    # Load manifest
    manifest = json.loads(manifest_path.read_text())
    frames = manifest.get('frames') or []
    if not frames:
        raise ValueError('manifest frames missing or empty')

    # Build detection index
    print(f'Indexing detections from {pkl_path} ...')
    det_idx = build_index(pkl_path)
    print(f'Indexed {len(det_idx)} records')

    wrote = 0
    missing = 0

    for f in frames:
        frame_id = f.get('id')
        orig = f.get('origId')
        if not frame_id or orig is None:
            continue

        # Try multiple forms to match frame_id
        keys_to_try = [to_str_frame_id(orig), normalize_manifest_orig_id(orig)]
        rec = None
        for k in keys_to_try:
            if k in det_idx:
                rec = det_idx[k]
                break
        if rec is None:
            # As a last resort, try exact string of orig (already stringified) without whitespace
            k2 = to_str_frame_id(orig).replace(' ', '')
            rec = det_idx.get(k2)
        if rec is None:
            missing += 1
            continue

        boxes = extract_boxes7(rec.get('boxes_lidar')) if rec.get('boxes_lidar') is not None else np.zeros((0,7))
        scores = rec.get('score')
        labels = rec.get('pred_labels') if rec.get('pred_labels') is not None else rec.get('name')
        det_objs = build_det_objs(boxes, scores, labels)
        # Apply score filtering here so files are already filtered
        score_thresh = float(args.score)
        det_objs = [d for d in det_objs if d.get('score', 1.0) >= score_thresh]

        out_rel = f"frames/{frame_id}.det.{args.branch}.json"
        out_path = seq_dir / out_rel
        save_json(out_path, {'boxes': det_objs})
        wrote += 1

        # Update manifest urls.det
        urls = f.setdefault('urls', {})
        det_map = urls.setdefault('det', {})
        det_map[args.branch] = out_rel

    # Save manifest
    manifest_path.write_text(json.dumps(manifest, separators=(",", ":")))

    print(f'Done. Wrote {wrote} det files. Missing matches: {missing}. Updated manifest: {manifest_path}')


if __name__ == '__main__':
    main()
