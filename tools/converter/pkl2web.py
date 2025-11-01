#!/usr/bin/env python3
"""
PKL to Web Converter CLI

Converts pickled point cloud and detection data into web-consumable formats:
- Binary point cloud frames
- JSON ground truth and detection manifests
- Quantized/downsampled variants

Usage:
    python pkl2web.py --input-pkl data.pkl --out-dir ./output --seq-id v_1784 \\
        --frames 0:100 --downsample 100k --branches branches.json
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Optional

try:
    from readers.pkl_reader import read_pkl as read_pkl_impl
    from models import FrameData
    from transforms.downsample import downsample_points
    from transforms.quantize import quantize_points
    from output import write_points_bin, write_detections_json, write_gt_json, write_manifest
    from schemas.manifest import SequenceManifest, FrameRef
except ImportError:
    # Fallback for when run as script - add current directory to path
    sys.path.insert(0, str(Path(__file__).parent))
    from readers.pkl_reader import read_pkl as read_pkl_impl  # type: ignore
    from models import FrameData  # type: ignore
    from transforms.downsample import downsample_points  # type: ignore
    from transforms.quantize import quantize_points  # type: ignore
    from output import write_points_bin, write_detections_json, write_gt_json, write_manifest  # type: ignore
    from schemas.manifest import SequenceManifest, FrameRef  # type: ignore


def create_parser() -> argparse.ArgumentParser:
    """Create and return the argument parser for the CLI."""
    parser = argparse.ArgumentParser(
        prog='pkl2web',
        description='Convert pickled point cloud data to web-consumable formats.',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --input-pkl data.pkl --out-dir ./output --seq-id v_1784 \\
      --frames 0:100 --downsample 100k --branches branches.json
  %(prog)s --input-pkl data.pkl --out-dir ./output --seq-id p_7513 \\
      --frames 0:50 --downsample 50k --quantize fp16 --branches config.json
        """.strip()
    )

    # Required arguments
    parser.add_argument(
        '--input-pkl',
        required=True,
        type=str,
        help='Path to input PKL file containing point cloud and detection data.'
    )

    parser.add_argument(
        '--out-dir',
        required=True,
        type=str,
        help='Output directory for generated frames, manifests, and metadata.'
    )

    parser.add_argument(
        '--seq-id',
        required=True,
        type=str,
        help='Sequence identifier (e.g., v_1784, p_7513, c_7910).'
    )

    parser.add_argument(
        '--frames',
        required=True,
        type=str,
        help='Frame range in format start:end (inclusive, 0-indexed).'
    )

    parser.add_argument(
        '--branches',
        required=True,
        type=str,
        help='Path to JSON file specifying branch configurations and names.'
    )

    # Optional arguments
    parser.add_argument(
        '--downsample',
        choices=['100k', '50k'],
        default='100k',
        help='Target point cloud size: 100k (default) or 50k points per frame.'
    )

    parser.add_argument(
        '--quantize',
        choices=['off', 'fp16', 'int16'],
        default='off',
        help='Quantization method: off (default, float32), fp16, or int16.'
    )

    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Validate arguments and report output structure without writing files.'
    )

    return parser


def validate_args(args: argparse.Namespace) -> Optional[str]:
    """
    Validate parsed arguments.

    Args:
        args: Parsed arguments from argparse.

    Returns:
        Error message if validation fails, None if valid.
    """
    # Check input PKL exists
    input_pkl = Path(args.input_pkl)
    if not input_pkl.exists():
        return f"Input PKL file not found: {input_pkl}"
    if not input_pkl.is_file():
        return f"Input PKL path is not a file: {input_pkl}"

    # Check branches file exists
    branches_file = Path(args.branches)
    if not branches_file.exists():
        return f"Branches file not found: {branches_file}"
    if not branches_file.is_file():
        return f"Branches path is not a file: {branches_file}"

    # Validate frames format
    try:
        frame_parts = args.frames.split(':')
        if len(frame_parts) != 2:
            return "Frames must be in format 'start:end' (e.g., '0:100')"
        start, end = int(frame_parts[0]), int(frame_parts[1])
        if start < 0 or end < 0:
            return "Frame indices must be non-negative"
        if start > end:
            return "Frame start must be <= end"
    except ValueError:
        return f"Invalid frame range: {args.frames}. Expected format 'start:end' with integers."

    return None


def read_pkl(input_path: str) -> FrameData:
    """
    Read and parse PKL file.

    Args:
        input_path: Path to input PKL file.

    Returns:
        FrameData object with frames and metadata.

    Raises:
        FileNotFoundError: If file does not exist.
        ValueError: If file format is invalid.
    """
    return read_pkl_impl(input_path)


def convert_frames(
    pkl_data: FrameData,
    seq_id: str,
    frames_range: tuple,
    downsample: str,
    quantize: str,
    dry_run: bool = False
) -> dict:
    """
    Convert PKL frames to target format.

    Filters frames by range and prepares conversion structure.
    In dry-run mode, prints frame summaries.

    Args:
        pkl_data: Parsed PKL data (FrameData object).
        seq_id: Sequence identifier.
        frames_range: Tuple of (start, end) frame indices (inclusive).
        downsample: Target point count ('100k' or '50k').
        quantize: Quantization method ('off', 'fp16', 'int16').
        dry_run: If True, print summaries instead of converting.

    Returns:
        Dictionary with converted frame data structure.
    """
    frame_start, frame_end = frames_range

    # Filter frames by range
    selected_frames = [
        frame for idx, frame in enumerate(pkl_data.frames)
        if frame_start <= idx <= frame_end
    ]

    # Apply transforms (downsampling and quantization)
    for frame in selected_frames:
        transform_metadata = {}

        # Apply downsampling
        if downsample in ('100k', '50k'):
            try:
                frame.points, ds_meta = downsample_points(frame.points, downsample)
                frame.point_count = frame.points.shape[0]
                transform_metadata['downsample'] = ds_meta
            except Exception as e:
                if not dry_run:
                    raise
                print(f"[DRY-RUN] Warning: Downsampling failed: {e}", file=sys.stderr)

        # Apply quantization
        if quantize != 'off':
            try:
                frame.points, q_meta = quantize_points(frame.points, quantize)
                transform_metadata['quantize'] = q_meta
            except Exception as e:
                if not dry_run:
                    raise
                print(f"[DRY-RUN] Warning: Quantization failed: {e}", file=sys.stderr)

        # Store transform metadata
        frame.transform_metadata = transform_metadata

    if dry_run:
        # Print frame summaries
        print(f"[DRY-RUN] Sequence: {seq_id}")
        print(f"[DRY-RUN] Frames: {frame_start}:{frame_end} ({len(selected_frames)} total)")
        print(f"[DRY-RUN] Downsample: {downsample}, Quantize: {quantize}")
        print()
        for frame in selected_frames:
            det_counts = ", ".join(
                f"{count} ({branch})"
                for branch, dets in sorted(frame.detections.items())
                for count in [len(dets)]
            ) or "0 detections"
            print(f"  Frame {frame.frame_id}: {frame.point_count:,} points, {det_counts}")

    return {
        "frames": selected_frames,
        "manifest": {
            "version": "1.0",
            "sequenceId": seq_id,
            "frames": []
        }
    }


def load_branches(branches_path: str) -> list[str]:
    """
    Load branch identifiers from JSON configuration file.

    Args:
        branches_path: Path to branches.json file.

    Returns:
        List of branch IDs/names.

    Raises:
        IOError: If file cannot be read.
    """
    try:
        with open(branches_path, 'r') as f:
            config = json.load(f)

        # Handle both dict format (branches key) and list format
        if isinstance(config, dict) and 'branches' in config:
            return [b.get('branch_id', b.get('name', str(i)))
                    for i, b in enumerate(config['branches'])]
        elif isinstance(config, list):
            return [b.get('branch_id', b.get('name', str(i)))
                    for i, b in enumerate(config)]
        else:
            return []

    except (IOError, json.JSONDecodeError) as e:
        raise IOError(f"Failed to load branches from {branches_path}: {e}") from e


def emit_output(converted_data: dict, output_dir: str, seq_id: str,
                dry_run: bool = False) -> None:
    """
    Write converted data to output directory.

    Creates directory structure:
      {output_dir}/
        frames/
          {frame_id}.bin
        {frame_id}.gt.json
        {frame_id}.det.{branch}.json
        manifest.json

    Args:
        converted_data: Dictionary with 'frames' list and 'manifest' dict.
        output_dir: Output directory path.
        seq_id: Sequence identifier.
        dry_run: If True, report structure without writing files.

    Raises:
        IOError: If write operations fail.
    """
    out_path = Path(output_dir)

    if dry_run:
        print(f"[DRY-RUN] Would emit output to: {output_dir}")
        print(f"[DRY-RUN] Manifest path: {out_path / 'manifest.json'}")
        print(f"[DRY-RUN] Frames directory: {out_path / 'frames'}")
        print(f"[DRY-RUN] Frame count: {len(converted_data.get('frames', []))}")
        return

    # Create output directory
    out_path.mkdir(parents=True, exist_ok=True)

    # Extract frames from converted data
    frames = converted_data.get('frames', [])
    if not frames:
        raise ValueError("No frames in converted data")

    # Build list of FrameRef objects
    frame_refs = []

    # Process each frame
    for frame in frames:
        frame_id = frame.frame_id

        # Write point cloud binary
        bin_path = out_path / 'frames' / f'{frame_id}.bin'
        write_points_bin(frame.points, bin_path, mode=0)

        # Write ground truth detections
        if frame.ground_truth:
            gt_path = out_path / f'{frame_id}.gt.json'
            write_gt_json(frame.ground_truth, gt_path)

        # Write per-branch detections
        det_urls = {}
        for branch_name, detections in frame.detections.items():
            if detections:
                det_path = out_path / f'{frame_id}.det.{branch_name}.json'
                write_detections_json(detections, det_path, branch_name)
                det_urls[branch_name] = f'{frame_id}.det.{branch_name}.json'

        # Build FrameRef for manifest
        frame_ref = FrameRef(
            id=frame_id,
            point_count=frame.point_count,
            ts=None,
            urls={
                'points': f'frames/{frame_id}.bin',
                'gt': f'{frame_id}.gt.json' if frame.ground_truth else None,
                'det': det_urls if det_urls else None,
            }
        )
        frame_refs.append(frame_ref)

    # Build and write manifest
    manifest_data = converted_data.get('manifest', {})
    manifest = SequenceManifest(
        version=manifest_data.get('version', '1.0'),
        sequence_id=seq_id,
        fps=10,
        class_map={
            'vehicle': '0',
            'pedestrian': '1',
            'cyclist': '2',
        },
        branches=list(frame.detections.keys()) if frames else [],
        frames=frame_refs,
    )

    manifest_path = out_path / 'manifest.json'
    write_manifest(manifest, manifest_path)


def main() -> int:
    """
    Main entry point for the CLI.

    Returns:
        0 on success, 1 on error.
    """
    parser = create_parser()
    args = parser.parse_args()

    # Validate arguments
    validation_error = validate_args(args)
    if validation_error:
        print(f"Error: {validation_error}", file=sys.stderr)
        return 1

    try:
        # Read PKL file
        pkl_data = read_pkl(args.input_pkl)

        # Parse frame range
        frame_start, frame_end = map(int, args.frames.split(':'))

        # Convert frames (with dry-run support for summaries)
        converted = convert_frames(
            pkl_data,
            args.seq_id,
            (frame_start, frame_end),
            args.downsample,
            args.quantize,
            dry_run=args.dry_run
        )

        # Emit output
        emit_output(converted, args.out_dir, args.seq_id, args.dry_run)

        print(f"✓ Conversion complete: {args.seq_id}")
        return 0

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
