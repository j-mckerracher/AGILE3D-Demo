#!/usr/bin/env python3
"""
Convert sequence data from assets/data/sequences/ to scene metadata format.

This script reads the manifest.json files and frame data from the sequences
directory and converts them into the SceneMetadata format expected by the
Angular application.
"""

import json
import struct
import os
from pathlib import Path
from typing import List, Dict, Tuple, Any
import sys


def load_point_cloud(bin_path: str) -> Tuple[List[Tuple[float, float, float]], Tuple[float, float, float], Tuple[float, float, float]]:
    """
    Load point cloud from binary file and calculate bounds.

    Returns:
        (points, min_bounds, max_bounds)
    """
    with open(bin_path, 'rb') as f:
        data = f.read()

    total_bytes = len(data)
    bytes_per_float = 4
    stride = 3  # x, y, z

    # Parse all points
    points = []
    num_points = total_bytes // (bytes_per_float * stride)

    for i in range(num_points):
        offset = i * stride * bytes_per_float
        x, y, z = struct.unpack('fff', data[offset:offset + stride * bytes_per_float])
        points.append((x, y, z))

    # Calculate bounds
    if points:
        xs = [p[0] for p in points]
        ys = [p[1] for p in points]
        zs = [p[2] for p in points]

        min_bounds = (min(xs), min(ys), min(zs))
        max_bounds = (max(xs), max(ys), max(zs))
    else:
        min_bounds = (0.0, 0.0, 0.0)
        max_bounds = (0.0, 0.0, 0.0)

    return points, min_bounds, max_bounds


def convert_box_to_detection(box: Dict, index: int) -> Dict:
    """
    Convert a ground truth box to Detection format.

    Box format: {x, y, z, dx, dy, dz, heading}
    Detection format: {id, class, center, dimensions, yaw, confidence}
    """
    # Infer class based on dimensions
    # Rough heuristics: vehicles are larger, pedestrians/cyclists are smaller
    dx, dy, dz = box['dx'], box['dy'], box['dz']
    volume = dx * dy * dz

    if volume > 10:  # Large object, likely vehicle
        det_class = 'vehicle'
    elif dz < 2.0:  # Short object
        det_class = 'cyclist'
    else:
        det_class = 'pedestrian'

    return {
        'id': f'gt_{index:04d}',
        'class': det_class,
        'center': [box['x'], box['y'], box['z']],
        'dimensions': {
            'width': dx,
            'length': dy,
            'height': dz
        },
        'yaw': box['heading'],
        'confidence': 1.0  # Ground truth has perfect confidence
    }


def count_classes(detections: List[Dict]) -> Dict[str, int]:
    """Count detections by class."""
    counts = {'vehicle': 0, 'pedestrian': 0, 'cyclist': 0}
    for det in detections:
        counts[det['class']] += 1
    return counts


def convert_sequence_to_metadata(sequence_dir: Path, frame_id: str = '000000') -> Dict[str, Any]:
    """
    Convert a sequence to SceneMetadata format using a specific frame.

    Args:
        sequence_dir: Path to sequence directory
        frame_id: Frame ID to use (default: '000000')

    Returns:
        SceneMetadata dictionary
    """
    sequence_id = sequence_dir.name

    # Load manifest
    manifest_path = sequence_dir / 'manifest.json'
    with open(manifest_path) as f:
        manifest = json.load(f)

    # Find the frame
    frame = next((f for f in manifest['frames'] if f['id'] == frame_id), None)
    if not frame:
        raise ValueError(f"Frame {frame_id} not found in {sequence_id}")

    # Load point cloud and calculate bounds
    points_bin_path = sequence_dir / frame['urls']['points']
    points, min_bounds, max_bounds = load_point_cloud(str(points_bin_path))

    print(f"  Loaded {len(points)} points, bounds: {min_bounds} to {max_bounds}")

    # Load ground truth
    gt_path = sequence_dir / frame['urls']['gt']
    with open(gt_path) as f:
        gt_data = json.load(f)

    # Convert boxes to detections
    ground_truth = [convert_box_to_detection(box, i) for i, box in enumerate(gt_data['boxes'])]

    # Count by class
    class_counts = count_classes(ground_truth)
    print(f"  Ground truth: {len(ground_truth)} objects - {class_counts}")

    # Determine scene complexity based on object count
    total_objects = len(ground_truth)
    if total_objects < 20:
        complexity = 'light'
    elif total_objects < 50:
        complexity = 'medium'
    else:
        complexity = 'heavy'

    # Create predictions dict with branches
    # For now, we'll use the ground truth as a base for DSVT_Voxel
    # and create synthetic variations for AGILE3D branches
    predictions = {
        'DSVT_Voxel': ground_truth.copy(),
    }

    # Add AGILE3D branch predictions (use same detections, will be varied by app)
    for branch in manifest.get('branches', []):
        if branch.startswith('CP_Pillar'):
            predictions[f'AGILE3D_{branch}'] = ground_truth.copy()

    # Determine optimal branch (typically mid-range resolution)
    optimal_branch = 'CP_Pillar_038'
    if 'CP_Pillar_038' not in manifest.get('branches', []):
        optimal_branch = manifest.get('branches', ['CP_Pillar_032'])[0]

    # Create scene name based on sequence ID
    scene_name = sequence_id.replace('_', ' ').title()

    # Build metadata
    metadata = {
        'scene_id': sequence_id,
        'name': scene_name,
        'description': f'Scene from sequence {sequence_id}, frame {frame_id}',
        'pointsBin': f'../../data/sequences/{sequence_id}/frames/{frame_id}.bin',
        'pointCount': len(points),
        'pointStride': 3,
        'bounds': {
            'min': list(min_bounds),
            'max': list(max_bounds)
        },
        'ground_truth': ground_truth,
        'predictions': predictions,
        'metadata': {
            'vehicleCount': class_counts['vehicle'],
            'pedestrianCount': class_counts['pedestrian'],
            'cyclistCount': class_counts['cyclist'],
            'complexity': complexity,
            'optimalBranch': optimal_branch
        }
    }

    return metadata


def create_registry(scenes: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Create scene registry from metadata list."""
    registry_entries = []

    for scene in scenes:
        entry = {
            'scene_id': scene['scene_id'],
            'name': scene['name'],
            'description': scene.get('description', ''),
            'complexity': scene['metadata']['complexity'],
            'pointCount': scene['pointCount'],
            'hasFallback': False  # We don't have fallback versions yet
        }
        registry_entries.append(entry)

    return {
        'version': '1.0',
        'scenes': registry_entries
    }


def main():
    """Main conversion logic."""
    repo_root = Path(__file__).parent.parent
    sequences_dir = repo_root / 'assets' / 'data' / 'sequences'
    scenes_dir = repo_root / 'assets' / 'scenes'

    print(f"Converting sequences from: {sequences_dir}")
    print(f"Output directory: {scenes_dir}")

    # Create scenes directory if it doesn't exist
    scenes_dir.mkdir(parents=True, exist_ok=True)

    # Find all sequence directories
    sequence_dirs = [d for d in sequences_dir.iterdir() if d.is_dir()]

    if not sequence_dirs:
        print("ERROR: No sequence directories found!")
        return 1

    print(f"\nFound {len(sequence_dirs)} sequences")

    # Convert each sequence
    all_metadata = []
    for seq_dir in sorted(sequence_dirs):
        print(f"\nProcessing {seq_dir.name}...")

        try:
            metadata = convert_sequence_to_metadata(seq_dir)

            # Create scene directory
            scene_dir = scenes_dir / metadata['scene_id']
            scene_dir.mkdir(exist_ok=True)

            # Write metadata.json
            metadata_path = scene_dir / 'metadata.json'
            with open(metadata_path, 'w') as f:
                json.dump(metadata, f, indent=2)

            print(f"  ✓ Wrote {metadata_path}")

            all_metadata.append(metadata)

        except Exception as e:
            print(f"  ✗ Error: {e}")
            import traceback
            traceback.print_exc()

    # Create registry
    if all_metadata:
        registry = create_registry(all_metadata)
        registry_path = scenes_dir / 'registry.json'

        with open(registry_path, 'w') as f:
            json.dump(registry, f, indent=2)

        print(f"\n✓ Wrote registry: {registry_path}")
        print(f"  Total scenes: {len(all_metadata)}")

    print("\n✓ Conversion complete!")
    return 0


if __name__ == '__main__':
    sys.exit(main())
