"""
Unit tests for PKL reader module.

Tests cover:
- Reading valid detection PKL files
- Tolerating unknown/missing fields
- Schema drift (extra fields)
"""

import unittest
import tempfile
import pickle
from pathlib import Path
from unittest.mock import patch
import sys

import numpy as np

# Add parent directory to path
converter_dir = Path(__file__).parent.parent
sys.path.insert(0, str(converter_dir))

# Import after adding to path
from readers.pkl_reader import read_pkl, _parse_frame, _box_to_detection  # noqa: E402
from models import Detection, Frame, FrameData  # noqa: E402


class TestPKLReaderValidDetection(unittest.TestCase):
    """Test reading valid detection PKL files."""

    def setUp(self):
        """Create temporary directory for test files."""
        self.temp_dir = tempfile.TemporaryDirectory()
        self.temp_path = Path(self.temp_dir.name)

    def tearDown(self):
        """Clean up temporary files."""
        self.temp_dir.cleanup()

    def _create_fixture_pkl(self, num_frames: int = 3) -> str:
        """
        Create a realistic PKL fixture with multiple frames.

        Args:
            num_frames: Number of frames to generate.

        Returns:
            Path to created PKL file.
        """
        frames_data = []
        for frame_idx in range(num_frames):
            frame_dict = {
                'frame_id': f'{frame_idx:06d}',
                'points': np.random.randn(1000 + frame_idx * 100, 4).astype(np.float32),
                'gt_boxes': np.array([
                    [0, 0, 0, 3.5, 1.5, 1.5, 0.0],
                    [5, 5, 0, 3.5, 1.5, 1.5, 0.785]
                ], dtype=np.float32),
                'gt_names': np.array(['car', 'car']),
                'boxes_lidar': np.array([
                    [0.5, 0.5, 0.5, 3.4, 1.4, 1.4, 0.1],
                    [5.2, 5.1, 0.5, 3.5, 1.5, 1.5, 0.8],
                    [10, 10, 0, 2.0, 2.0, 2.0, 0.0]
                ], dtype=np.float32),
                'score': np.array([0.95, 0.87, 0.72], dtype=np.float32),
                'pred_labels': np.array(['car', 'car', 'pedestrian']),
            }
            frames_data.append(frame_dict)

        pkl_path = self.temp_path / 'test_fixture.pkl'
        with open(pkl_path, 'wb') as f:
            pickle.dump(frames_data, f)
        return str(pkl_path)

    def test_read_pkl_valid_detection(self):
        """Test loading a valid detection PKL with multiple frames."""
        pkl_path = self._create_fixture_pkl(num_frames=3)

        # Read PKL
        frame_data = read_pkl(pkl_path)

        # Verify structure
        self.assertIsInstance(frame_data, FrameData)
        self.assertEqual(len(frame_data.frames), 3)
        self.assertEqual(frame_data.frame_count, 3)

        # Verify first frame
        frame_0 = frame_data.frames[0]
        self.assertEqual(frame_0.frame_id, '000000')
        self.assertEqual(frame_0.point_count, 1000)
        self.assertEqual(len(frame_0.ground_truth), 2)
        self.assertGreater(len(frame_0.detections), 0)

        # Verify detections
        det_list = list(frame_0.detections.values())[0]
        self.assertEqual(len(det_list), 3)
        self.assertEqual(det_list[0].class_name, 'vehicle')
        self.assertAlmostEqual(det_list[0].confidence, 0.95, places=5)

    def test_read_pkl_frame_count_and_structure(self):
        """Test frame count and overall structure."""
        pkl_path = self._create_fixture_pkl(num_frames=5)
        frame_data = read_pkl(pkl_path)

        self.assertEqual(len(frame_data.frames), 5)
        self.assertIn('source', frame_data.metadata)

        for idx, frame in enumerate(frame_data.frames):
            self.assertEqual(frame.frame_id, f'{idx:06d}')
            self.assertGreater(frame.point_count, 0)
            self.assertIsInstance(frame.points, np.ndarray)

    def test_ground_truth_extraction(self):
        """Test that ground truth boxes are correctly extracted."""
        pkl_path = self._create_fixture_pkl(num_frames=1)
        frame_data = read_pkl(pkl_path)

        frame = frame_data.frames[0]
        gt = frame.ground_truth

        self.assertEqual(len(gt), 2)
        self.assertEqual(gt[0].class_name, 'vehicle')
        self.assertEqual(gt[1].class_name, 'vehicle')
        self.assertEqual(gt[0].confidence, 1.0)  # GT has confidence 1.0
        self.assertAlmostEqual(gt[1].yaw, 0.785, places=3)

    def test_detection_confidence_scores(self):
        """Test that detection scores are preserved."""
        pkl_path = self._create_fixture_pkl(num_frames=1)
        frame_data = read_pkl(pkl_path)

        frame = frame_data.frames[0]
        dets = list(frame.detections.values())[0]

        self.assertAlmostEqual(dets[0].confidence, 0.95, places=5)
        self.assertAlmostEqual(dets[1].confidence, 0.87, places=5)
        self.assertAlmostEqual(dets[2].confidence, 0.72, places=5)


class TestPKLReaderToleratesUnknownFields(unittest.TestCase):
    """Test that reader tolerates schema drift (extra fields)."""

    def setUp(self):
        """Create temporary directory."""
        self.temp_dir = tempfile.TemporaryDirectory()
        self.temp_path = Path(self.temp_dir.name)

    def tearDown(self):
        """Clean up."""
        self.temp_dir.cleanup()

    def test_tolerates_extra_fields(self):
        """Test that PKL with extra unknown fields doesn't crash."""
        # Create PKL with extra fields
        frame_dict = {
            'frame_id': '000000',
            'points': np.random.randn(100, 4).astype(np.float32),
            'gt_boxes': np.array([[0, 0, 0, 3.5, 1.5, 1.5, 0.0]], dtype=np.float32),
            'gt_names': np.array(['car']),
            'boxes_lidar': np.array([[0, 0, 0, 3.5, 1.5, 1.5, 0.0]], dtype=np.float32),
            'score': np.array([0.9]),
            'pred_labels': np.array(['car']),
            # Extra fields
            'custom_field': 'should be ignored',
            'metadata_v2': {'some': 'data'},
            'unknown_array': np.array([1, 2, 3])
        }

        pkl_path = self.temp_path / 'extra_fields.pkl'
        with open(pkl_path, 'wb') as f:
            pickle.dump([frame_dict], f)

        # Should not crash
        frame_data = read_pkl(str(pkl_path))
        self.assertEqual(len(frame_data.frames), 1)
        self.assertEqual(frame_data.frames[0].point_count, 100)

    def test_handles_missing_optional_fields(self):
        """Test sparse frame with missing optional fields."""
        # Minimal frame: only required points
        frame_dict = {
            'points': np.random.randn(50, 4).astype(np.float32),
            # No gt_boxes, no detections, etc.
        }

        pkl_path = self.temp_path / 'sparse.pkl'
        with open(pkl_path, 'wb') as f:
            pickle.dump([frame_dict], f)

        # Should handle gracefully
        frame_data = read_pkl(str(pkl_path))
        self.assertEqual(len(frame_data.frames), 1)
        self.assertEqual(frame_data.frames[0].point_count, 50)
        self.assertEqual(len(frame_data.frames[0].ground_truth), 0)
        self.assertEqual(len(frame_data.frames[0].detections), 0)

    def test_tolerates_missing_gt_names(self):
        """Test ground truth without label names."""
        frame_dict = {
            'frame_id': '000000',
            'points': np.random.randn(100, 4).astype(np.float32),
            'gt_boxes': np.array([[0, 0, 0, 3.5, 1.5, 1.5, 0.0]], dtype=np.float32),
            # Missing gt_names
            'boxes_lidar': np.array([[0, 0, 0, 3.5, 1.5, 1.5, 0.0]], dtype=np.float32),
            'score': np.array([0.9]),
            'pred_labels': np.array(['car']),
        }

        pkl_path = self.temp_path / 'no_gt_names.pkl'
        with open(pkl_path, 'wb') as f:
            pickle.dump([frame_dict], f)

        frame_data = read_pkl(str(pkl_path))
        self.assertEqual(len(frame_data.frames), 1)
        # GT should default to 'unknown' for missing labels
        self.assertEqual(frame_data.frames[0].ground_truth[0].class_name, 'unknown')


class TestClassNameNormalization(unittest.TestCase):
    """Test class name normalization."""

    def test_normalize_class_names(self):
        """Test that class names are normalized correctly."""
        frame_dict = {
            'points': np.random.randn(10, 4).astype(np.float32),
            'gt_boxes': np.array([[0, 0, 0, 3.5, 1.5, 1.5, 0.0]], dtype=np.float32),
            'gt_names': np.array(['Car']),  # Uppercase
            'boxes_lidar': np.array([
                [0, 0, 0, 3.5, 1.5, 1.5, 0.0],
                [5, 5, 0, 2.0, 2.0, 2.0, 0.0],
                [10, 10, 0, 1.5, 1.5, 1.5, 0.0]
            ], dtype=np.float32),
            'score': np.array([0.9, 0.8, 0.7]),
            'pred_labels': np.array(['Person', 'Cyclist', 'TRUCK']),
        }

        frame = _parse_frame(frame_dict, 0)

        # Check normalized names
        self.assertEqual(frame.ground_truth[0].class_name, 'vehicle')  # Car -> vehicle
        dets = list(frame.detections.values())[0]
        self.assertEqual(dets[0].class_name, 'pedestrian')  # Person -> pedestrian
        self.assertEqual(dets[1].class_name, 'cyclist')
        self.assertEqual(dets[2].class_name, 'vehicle')  # Truck -> vehicle


class TestFileNotFound(unittest.TestCase):
    """Test error handling for missing files."""

    def test_file_not_found_error(self):
        """Test that FileNotFoundError is raised for missing file."""
        with self.assertRaises(FileNotFoundError):
            read_pkl('/nonexistent/path/to/file.pkl')

    def test_invalid_pkl_format(self):
        """Test error handling for corrupted PKL."""
        with tempfile.TemporaryDirectory() as temp_dir:
            # Create invalid pickle file
            pkl_path = Path(temp_dir) / 'invalid.pkl'
            pkl_path.write_text('This is not valid pickle data')

            with self.assertRaises(ValueError):
                read_pkl(str(pkl_path))


if __name__ == '__main__':
    unittest.main()
