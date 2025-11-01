"""
Unit tests for writers module.

Tests point cloud binary writer, detection JSON writer, and manifest writer.
"""

import json
import struct
import tempfile
from pathlib import Path

import numpy as np
import pytest

from models import Detection, Frame
from output import (
    write_points_bin,
    write_detections_json,
    write_gt_json,
    write_manifest,
    compute_aabb,
)
from schemas.manifest import SequenceManifest, FrameRef, validate_manifest


class TestComputeAABB:
    """Tests for AABB computation."""

    def test_compute_aabb_valid(self):
        """Test AABB computation with valid points."""
        points = np.array([
            [0.0, 0.0, 0.0, 1.0],
            [1.0, 2.0, 3.0, 1.0],
            [0.5, 1.5, 1.5, 1.0],
        ], dtype=np.float32)

        min_corner, max_corner = compute_aabb(points)

        assert min_corner == (0.0, 0.0, 0.0)
        assert max_corner == (1.0, 2.0, 3.0)

    def test_compute_aabb_empty(self):
        """Test AABB with empty point cloud."""
        points = np.zeros((0, 4), dtype=np.float32)

        min_corner, max_corner = compute_aabb(points)

        assert min_corner == (0.0, 0.0, 0.0)
        assert max_corner == (0.0, 0.0, 0.0)

    def test_compute_aabb_single_point(self):
        """Test AABB with single point."""
        points = np.array([[2.5, 3.5, 4.5, 1.0]], dtype=np.float32)

        min_corner, max_corner = compute_aabb(points)

        assert min_corner == (2.5, 3.5, 4.5)
        assert max_corner == (2.5, 3.5, 4.5)


class TestWritePointsBin:
    """Tests for point cloud binary writer."""

    def test_write_points_bin_valid(self):
        """Test writing point cloud to binary file."""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / 'test.bin'
            points = np.array([
                [0.0, 0.0, 0.0, 1.0],
                [1.0, 1.0, 1.0, 1.0],
                [2.0, 2.0, 2.0, 1.0],
            ], dtype=np.float32)

            result = write_points_bin(points, output_path, mode=0)

            assert output_path.exists()
            assert result['point_count'] == 3
            assert result['header_size'] == 29
            assert result['file_size'] > 0

    def test_write_points_bin_header_structure(self):
        """Test quantization header structure."""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / 'test.bin'
            points = np.array([
                [0.0, 1.0, 2.0, 1.0],
                [3.0, 4.0, 5.0, 1.0],
            ], dtype=np.float32)

            write_points_bin(points, output_path, mode=1)

            # Read header
            with open(output_path, 'rb') as f:
                header = f.read(29)

            # Unpack header
            mode, min_x, min_y, min_z, max_x, max_y, max_z, count = struct.unpack(
                '<BfffFff I', header
            )

            assert mode == 1
            assert min_x == 0.0
            assert min_y == 1.0
            assert min_z == 2.0
            assert max_x == 3.0
            assert max_y == 4.0
            assert max_z == 5.0
            assert count == 2

    def test_write_points_bin_roundtrip(self):
        """Test writing and reading back point cloud data."""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / 'test.bin'
            original_points = np.array([
                [1.1, 2.2, 3.3, 4.4],
                [5.5, 6.6, 7.7, 8.8],
            ], dtype=np.float32)

            write_points_bin(original_points, output_path, mode=0)

            # Read back (skip header)
            with open(output_path, 'rb') as f:
                f.seek(29)  # Skip header
                read_points = np.fromfile(f, dtype=np.float32).reshape(-1, 3)

            # Compare xyz (skip intensity)
            np.testing.assert_array_almost_equal(
                original_points[:, :3],
                read_points,
                decimal=6
            )

    def test_write_points_bin_creates_parent_dir(self):
        """Test that parent directory is created if missing."""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / 'subdir' / 'nested' / 'test.bin'
            points = np.array([[0.0, 0.0, 0.0, 1.0]], dtype=np.float32)

            write_points_bin(points, output_path)

            assert output_path.exists()
            assert output_path.parent.exists()


class TestWriteDetectionsJson:
    """Tests for detection JSON writer."""

    def test_write_detections_json_valid(self):
        """Test writing detections to JSON file."""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / 'dets.json'
            detections = [
                Detection(
                    id='0',
                    class_name='vehicle',
                    center=(1.0, 2.0, 3.0),
                    dimensions={'length': 5.0, 'width': 2.0, 'height': 2.0},
                    yaw=0.5,
                    confidence=0.9
                ),
                Detection(
                    id='1',
                    class_name='pedestrian',
                    center=(4.0, 5.0, 6.0),
                    dimensions={'length': 0.5, 'width': 0.5, 'height': 1.7},
                    yaw=0.0,
                    confidence=0.95
                ),
            ]

            result = write_detections_json(detections, output_path)

            assert output_path.exists()
            assert result['detection_count'] == 2
            assert result['file_size'] > 0

            # Verify JSON structure
            with open(output_path, 'r') as f:
                data = json.load(f)

            assert len(data) == 2
            assert data[0]['id'] == '0'
            assert data[0]['label'] == 'vehicle'
            assert data[0]['score'] == 0.9

    def test_write_detections_json_deterministic_order(self):
        """Test that detections are sorted by id for determinism."""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / 'dets.json'
            detections = [
                Detection('2', 'vehicle', (0, 0, 0), {}, 0.0, 0.9),
                Detection('0', 'vehicle', (0, 0, 0), {}, 0.0, 0.9),
                Detection('1', 'vehicle', (0, 0, 0), {}, 0.0, 0.9),
            ]

            write_detections_json(detections, output_path)

            with open(output_path, 'r') as f:
                data = json.load(f)

            ids = [d['id'] for d in data]
            assert ids == ['0', '1', '2']

    def test_write_detections_json_empty(self):
        """Test writing empty detections list."""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / 'empty.json'

            result = write_detections_json([], output_path)

            assert output_path.exists()
            assert result['detection_count'] == 0

            with open(output_path, 'r') as f:
                data = json.load(f)

            assert data == []


class TestWriteGtJson:
    """Tests for ground truth JSON writer."""

    def test_write_gt_json_valid(self):
        """Test writing ground truth to JSON file."""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / 'gt.json'
            gt = [
                Detection('0', 'vehicle', (0, 0, 0), {'length': 5}, 0.0),
                Detection('1', 'pedestrian', (1, 1, 1), {'length': 0.5}, 0.0),
            ]

            result = write_gt_json(gt, output_path)

            assert output_path.exists()
            assert result['detection_count'] == 2

            # GT should have confidence=1.0
            with open(output_path, 'r') as f:
                data = json.load(f)

            assert data[0]['score'] == 1.0  # None becomes 1.0


class TestWriteManifest:
    """Tests for manifest writer."""

    def test_write_manifest_valid(self):
        """Test writing valid manifest to JSON file."""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / 'manifest.json'
            manifest = SequenceManifest(
                version='1.0',
                sequence_id='test_seq',
                fps=10,
                class_map={'vehicle': '0'},
                branches=['branch1'],
                frames=[
                    FrameRef(
                        id='0',
                        point_count=1000,
                        urls={'points': 'frames/0.bin'}
                    )
                ]
            )

            result = write_manifest(manifest, output_path)

            assert output_path.exists()
            assert result['file_size'] > 0
            assert result['valid'] is True

            # Verify JSON structure
            with open(output_path, 'r') as f:
                data = json.load(f)

            assert data['version'] == '1.0'
            assert data['sequenceId'] == 'test_seq'
            assert data['fps'] == 10
            assert len(data['frames']) == 1

    def test_write_manifest_validation_fails(self):
        """Test that invalid manifest raises error."""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / 'manifest.json'
            manifest = SequenceManifest(
                version='1.0',
                sequence_id='test',
                fps=0,  # Invalid: must be > 0
                branches=['b1'],
                frames=[FrameRef(id='0', urls={'points': 'test'})]
            )

            with pytest.raises(IOError):
                write_manifest(manifest, output_path)

    def test_write_manifest_json_indent(self):
        """Test that manifest is formatted with 2-space indent."""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / 'manifest.json'
            manifest = SequenceManifest(
                version='1.0',
                sequence_id='test',
                fps=10,
                branches=['b'],
                frames=[FrameRef(id='0', urls={'points': 'f.bin'})]
            )

            write_manifest(manifest, output_path)

            with open(output_path, 'r') as f:
                content = f.read()

            # Check for 2-space indentation
            assert '  "version"' in content or '  "sequenceId"' in content


class TestManifestValidation:
    """Tests for manifest validation."""

    def test_validate_manifest_valid(self):
        """Test validation of valid manifest."""
        manifest = SequenceManifest(
            version='1.0',
            sequence_id='test',
            fps=10,
            branches=['b1'],
            frames=[FrameRef(id='0', urls={'points': 'test'})]
        )

        is_valid, error_msg = validate_manifest(manifest)

        assert is_valid is True
        assert error_msg is None

    def test_validate_manifest_missing_version(self):
        """Test validation fails without version."""
        manifest = SequenceManifest(
            version='',
            sequence_id='test',
            fps=10,
            branches=['b'],
            frames=[FrameRef(id='0', urls={'points': 'test'})]
        )

        is_valid, error_msg = validate_manifest(manifest)

        assert is_valid is False
        assert 'version' in error_msg.lower()

    def test_validate_manifest_missing_sequence_id(self):
        """Test validation fails without sequence_id."""
        manifest = SequenceManifest(
            version='1.0',
            sequence_id='',
            fps=10,
            branches=['b'],
            frames=[FrameRef(id='0', urls={'points': 'test'})]
        )

        is_valid, error_msg = validate_manifest(manifest)

        assert is_valid is False
        assert 'sequence_id' in error_msg.lower()

    def test_validate_manifest_invalid_fps(self):
        """Test validation fails with invalid fps."""
        manifest = SequenceManifest(
            version='1.0',
            sequence_id='test',
            fps=-1,
            branches=['b'],
            frames=[FrameRef(id='0', urls={'points': 'test'})]
        )

        is_valid, error_msg = validate_manifest(manifest)

        assert is_valid is False
        assert 'fps' in error_msg.lower()

    def test_validate_manifest_empty_frames(self):
        """Test validation fails with empty frames."""
        manifest = SequenceManifest(
            version='1.0',
            sequence_id='test',
            fps=10,
            branches=['b'],
            frames=[]
        )

        is_valid, error_msg = validate_manifest(manifest)

        assert is_valid is False
        assert 'frames' in error_msg.lower()


class TestOutputTreeStructure:
    """End-to-end tests for output directory structure."""

    def test_output_tree_structure_complete(self):
        """Test that all expected files are created."""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir)

            # Create mock frame data
            frame = Frame(
                frame_id='0',
                points=np.array([[0, 0, 0, 1], [1, 1, 1, 1]], dtype=np.float32),
                point_count=2,
                ground_truth=[
                    Detection('0', 'vehicle', (0, 0, 0), {'l': 5}, 0.0)
                ],
                detections={
                    'branch1': [
                        Detection('0', 'vehicle', (0, 0, 0), {'l': 5}, 0.9)
                    ]
                }
            )

            # Write outputs
            write_points_bin(frame.points, output_path / 'frames' / '0.bin')
            write_gt_json(frame.ground_truth, output_path / '0.gt.json')
            write_detections_json(
                frame.detections['branch1'],
                output_path / '0.det.branch1.json'
            )

            manifest = SequenceManifest(
                version='1.0',
                sequence_id='test',
                fps=10,
                branches=['branch1'],
                frames=[
                    FrameRef(
                        id='0',
                        point_count=2,
                        urls={
                            'points': 'frames/0.bin',
                            'gt': '0.gt.json',
                            'det': {'branch1': '0.det.branch1.json'}
                        }
                    )
                ]
            )
            write_manifest(manifest, output_path / 'manifest.json')

            # Verify structure
            assert (output_path / 'frames' / '0.bin').exists()
            assert (output_path / '0.gt.json').exists()
            assert (output_path / '0.det.branch1.json').exists()
            assert (output_path / 'manifest.json').exists()

            # Verify manifest content
            with open(output_path / 'manifest.json', 'r') as f:
                manifest_data = json.load(f)

            assert manifest_data['sequenceId'] == 'test'
            assert len(manifest_data['frames']) == 1
            assert manifest_data['frames'][0]['id'] == '0'
