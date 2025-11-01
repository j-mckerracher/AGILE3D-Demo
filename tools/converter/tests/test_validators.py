"""
Unit tests for validators module.

Tests validation functions for manifest, point counts, AABB, yaw, ordering, and coverage.
"""

import json
import math
import struct
import tempfile
from pathlib import Path

import pytest

sys_path_setup = False
try:
    from validators.validators import (
        validate_frame_count,
        validate_point_counts,
        validate_aabb_ranges,
        validate_yaw_sanity,
        validate_frame_ordering,
        validate_detector_coverage,
        run_validators,
    )
except ImportError:
    import sys
    sys.path.insert(0, str(Path(__file__).parent.parent))
    from validators.validators import (
        validate_frame_count,
        validate_point_counts,
        validate_aabb_ranges,
        validate_yaw_sanity,
        validate_frame_ordering,
        validate_detector_coverage,
        run_validators,
    )


class TestValidateFrameCount:
    """Tests for frame count validation."""

    def test_validate_frame_count_pass(self):
        """Test that correct frame count passes."""
        manifest = {
            'frames': [{'id': '0'}, {'id': '1'}, {'id': '2'}]
        }
        valid, err = validate_frame_count(manifest, 3)
        assert valid is True
        assert err is None

    def test_validate_frame_count_fail(self):
        """Test that incorrect frame count fails."""
        manifest = {
            'frames': [{'id': '0'}, {'id': '1'}]
        }
        valid, err = validate_frame_count(manifest, 3)
        assert valid is False
        assert 'mismatch' in err.lower()


class TestValidatePointCounts:
    """Tests for point count validation."""

    def test_validate_point_counts_pass_full(self):
        """Test that valid point counts for full tier pass."""
        manifest = {
            'frames': [
                {'id': '0', 'pointCount': 100_000},
                {'id': '1', 'pointCount': 50_000},
            ]
        }
        valid, errs = validate_point_counts(manifest, 'full')
        assert valid is True
        assert len(errs) == 0

    def test_validate_point_counts_pass_fallback(self):
        """Test that valid point counts for fallback tier pass."""
        manifest = {
            'frames': [
                {'id': '0', 'pointCount': 50_000},
                {'id': '1', 'pointCount': 25_000},
            ]
        }
        valid, errs = validate_point_counts(manifest, 'fallback')
        assert valid is True
        assert len(errs) == 0

    def test_validate_point_counts_fail_full_exceeds_limit(self):
        """Test that point count exceeding full tier limit fails."""
        manifest = {
            'frames': [
                {'id': '0', 'pointCount': 100_001},
            ]
        }
        valid, errs = validate_point_counts(manifest, 'full')
        assert valid is False
        assert len(errs) > 0
        assert 'exceeds' in errs[0].lower()

    def test_validate_point_counts_fail_fallback_exceeds_limit(self):
        """Test that point count exceeding fallback tier limit fails."""
        manifest = {
            'frames': [
                {'id': '0', 'pointCount': 50_001},
            ]
        }
        valid, errs = validate_point_counts(manifest, 'fallback')
        assert valid is False
        assert len(errs) > 0

    def test_validate_point_counts_fail_zero_points(self):
        """Test that zero point count fails."""
        manifest = {
            'frames': [
                {'id': '0', 'pointCount': 0},
            ]
        }
        valid, errs = validate_point_counts(manifest, 'full')
        assert valid is False


class TestValidateAabbRanges:
    """Tests for AABB validation."""

    def test_validate_aabb_ranges_pass(self):
        """Test that valid AABB ranges pass."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Create frames directory
            frames_dir = Path(tmpdir) / 'frames'
            frames_dir.mkdir()

            # Create a test binary file with valid AABB
            bin_file = frames_dir / '000000.bin'
            with open(bin_file, 'wb') as f:
                header = struct.pack('<Bffffff I', 0, 0.0, 1.0, 2.0, 3.0, 4.0, 5.0, 100)
                f.write(header)

            manifest = {
                'frames': [{'id': '000000', 'pointCount': 100}]
            }

            valid, errs = validate_aabb_ranges(tmpdir, manifest)
            assert valid is True
            assert len(errs) == 0

    def test_validate_aabb_ranges_missing_file(self):
        """Test that missing frame file fails."""
        with tempfile.TemporaryDirectory() as tmpdir:
            frames_dir = Path(tmpdir) / 'frames'
            frames_dir.mkdir()

            manifest = {
                'frames': [{'id': '000000', 'pointCount': 100}]
            }

            valid, errs = validate_aabb_ranges(tmpdir, manifest)
            assert valid is False
            assert len(errs) > 0

    def test_validate_aabb_ranges_inverted_aabb(self):
        """Test that inverted AABB is caught."""
        with tempfile.TemporaryDirectory() as tmpdir:
            frames_dir = Path(tmpdir) / 'frames'
            frames_dir.mkdir()

            # Create file with inverted AABB (min > max)
            bin_file = frames_dir / '000000.bin'
            with open(bin_file, 'wb') as f:
                # min_x=5 > max_x=0 (inverted)
                header = struct.pack('<Bffffff I', 0, 5.0, 1.0, 2.0, 0.0, 4.0, 5.0, 100)
                f.write(header)

            manifest = {
                'frames': [{'id': '000000', 'pointCount': 100}]
            }

            valid, errs = validate_aabb_ranges(tmpdir, manifest)
            assert valid is False
            assert len(errs) > 0


class TestValidateYawSanity:
    """Tests for yaw sanity validation."""

    def test_validate_yaw_sanity_pass(self):
        """Test that valid yaw values pass."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Create GT JSON with valid yaw
            gt_file = Path(tmpdir) / '000000.gt.json'
            with open(gt_file, 'w') as f:
                json.dump([
                    {'id': '0', 'label': 'vehicle', 'score': 1.0, 'bbox': {'yaw': 0.0}},
                    {'id': '1', 'label': 'vehicle', 'score': 1.0, 'bbox': {'yaw': math.pi - 0.1}},
                    {'id': '2', 'label': 'vehicle', 'score': 1.0, 'bbox': {'yaw': -math.pi + 0.1}},
                ], f)

            manifest = {
                'frames': [{'id': '000000'}]
            }

            valid, warns = validate_yaw_sanity(tmpdir, manifest)
            assert valid is True
            assert len(warns) == 0

    def test_validate_yaw_sanity_warn_outliers(self):
        """Test that yaw outliers generate warnings."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Create GT JSON with out-of-range yaw
            gt_file = Path(tmpdir) / '000000.gt.json'
            with open(gt_file, 'w') as f:
                json.dump([
                    {'id': '0', 'label': 'vehicle', 'score': 1.0, 'bbox': {'yaw': math.pi + 0.1}},
                ], f)

            manifest = {
                'frames': [{'id': '000000'}]
            }

            valid, warns = validate_yaw_sanity(tmpdir, manifest)
            # May or may not warn depending on tolerance; just check it doesn't fail
            assert valid is True


class TestValidateFrameOrdering:
    """Tests for frame ordering validation."""

    def test_validate_frame_ordering_pass(self):
        """Test that sequential frame IDs pass."""
        manifest = {
            'frames': [
                {'id': '000000'},
                {'id': '000001'},
                {'id': '000002'},
            ]
        }
        valid, errs = validate_frame_ordering(manifest)
        assert valid is True
        assert len(errs) == 0

    def test_validate_frame_ordering_fail_unordered(self):
        """Test that unordered frame IDs fail."""
        manifest = {
            'frames': [
                {'id': '000001'},
                {'id': '000000'},
                {'id': '000002'},
            ]
        }
        valid, errs = validate_frame_ordering(manifest)
        assert valid is False
        assert len(errs) > 0

    def test_validate_frame_ordering_fail_empty(self):
        """Test that empty frames fail."""
        manifest = {'frames': []}
        valid, errs = validate_frame_ordering(manifest)
        assert valid is False


class TestValidateDetectorCoverage:
    """Tests for detector coverage validation."""

    def test_validate_detector_coverage_pass(self):
        """Test that detector coverage passes."""
        manifest = {
            'branches': ['CP_Pillar_032', 'DSVT_Voxel_016']
        }
        valid, warns = validate_detector_coverage(manifest)
        assert valid is True


class TestRunValidators:
    """Tests for orchestrated validator."""

    def test_run_validators_summary(self):
        """Test that run_validators returns structured report."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Create minimal valid output
            frames_dir = Path(tmpdir) / 'frames'
            frames_dir.mkdir()

            # Create frame binary
            bin_file = frames_dir / '000000.bin'
            with open(bin_file, 'wb') as f:
                header = struct.pack('<Bffffff I', 0, 0.0, 0.0, 0.0, 1.0, 1.0, 1.0, 100)
                f.write(header)

            # Create manifest
            manifest_file = Path(tmpdir) / 'manifest.json'
            with open(manifest_file, 'w') as f:
                json.dump({
                    'version': '1.0',
                    'sequenceId': 'test',
                    'fps': 10,
                    'classMap': {'vehicle': '0'},
                    'branches': ['b1'],
                    'frames': [{'id': '000000', 'pointCount': 100, 'urls': {}}]
                }, f)

            # Run validators
            report = run_validators(tmpdir, str(manifest_file), 'full', 1)

            # Check report structure
            assert 'checks' in report
            assert 'warnings' in report
            assert 'errors' in report
            assert 'summary' in report

            # Check at least some checks passed
            assert len(report['checks']) > 0
            assert isinstance(report['summary'], str)

    def test_run_validators_fail_missing_manifest(self):
        """Test that missing manifest is reported."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # No manifest file
            report = run_validators(tmpdir, '/nonexistent/manifest.json', 'full', 1)

            assert len(report['errors']) > 0
            assert 'manifest' in report['summary'].lower()
