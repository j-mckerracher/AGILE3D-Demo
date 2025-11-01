"""
Unit tests for point cloud quantization transforms.

Tests cover:
- Three quantization modes (off, fp16, int16)
- Round-trip quantization/dequantization
- Precision validation
- Error handling
"""

import unittest
import sys
from pathlib import Path
import numpy as np

# Add parent directory to path
converter_dir = Path(__file__).parent.parent
sys.path.insert(0, str(converter_dir))

from transforms.quantize import (  # noqa: E402
    quantize_points,
    dequantize_points,
    compute_quantization_error,
)


def create_test_frame(n_points: int = 10_000, seed: int = 42) -> np.ndarray:
    """
    Create synthetic point cloud for testing.

    Args:
        n_points: Number of points.
        seed: Random seed.

    Returns:
        Point cloud array (n_points, 4) with [x, y, z, intensity].
    """
    rng = np.random.default_rng(seed=seed)
    # Create points in realistic LiDAR range: ±100m
    points = rng.uniform(-100, 100, (n_points, 3)).astype(np.float32)
    intensity = rng.uniform(0, 1, n_points).astype(np.float32)
    return np.column_stack([points, intensity])


class TestQuantizeOff(unittest.TestCase):
    """Test 'off' quantization mode (no quantization)."""

    def test_off_returns_unchanged(self):
        """Test that mode='off' returns points unchanged."""
        points = create_test_frame(1000)
        quantized, metadata = quantize_points(points, 'off')

        np.testing.assert_array_equal(quantized, points)
        self.assertEqual(metadata['mode'], 'off')
        self.assertEqual(metadata['dtype'], 'float32')

    def test_off_preserves_dtype(self):
        """Test that dtype remains float32."""
        points = create_test_frame(1000)
        quantized, _ = quantize_points(points, 'off')

        self.assertEqual(quantized.dtype, np.float32)

    def test_off_metadata(self):
        """Test metadata for off mode."""
        points = create_test_frame(1000)
        _, metadata = quantize_points(points, 'off')

        self.assertEqual(metadata['bytes_per_point'], 16)  # 4 coords × 4 bytes
        self.assertEqual(metadata['compression'], 1.0)


class TestQuantizeFP16(unittest.TestCase):
    """Test 'fp16' quantization mode."""

    def test_fp16_converts_dtype(self):
        """Test that quantization converts to float16."""
        points = create_test_frame(1000)
        quantized, metadata = quantize_points(points, 'fp16')

        self.assertEqual(quantized.dtype, np.float16)
        self.assertEqual(metadata['mode'], 'fp16')
        self.assertEqual(metadata['dtype'], 'float16')

    def test_fp16_shape_preserved(self):
        """Test that shape is preserved."""
        points = create_test_frame(1000)
        quantized, _ = quantize_points(points, 'fp16')

        self.assertEqual(quantized.shape, points.shape)

    def test_fp16_compression_ratio(self):
        """Test compression ratio (50% reduction)."""
        points = create_test_frame(1000)
        _, metadata = quantize_points(points, 'fp16')

        self.assertEqual(metadata['bytes_per_point'], 8)  # 4 coords × 2 bytes
        self.assertEqual(metadata['compression'], 0.5)

    def test_fp16_roundtrip(self):
        """Test quantize and dequantize round-trip."""
        points = create_test_frame(100)
        quantized, metadata = quantize_points(points, 'fp16')
        dequantized = dequantize_points(quantized, metadata)

        # fp16 has ~0.1% precision, so we expect small errors
        self.assertEqual(dequantized.dtype, np.float32)
        self.assertEqual(dequantized.shape, points.shape)

        # Check error metrics
        error_stats = compute_quantization_error(points, dequantized)
        # fp16 typical error for moderate ranges
        self.assertLess(error_stats['rmse'], 0.1)  # RMS error < 0.1m

    def test_fp16_precision_loss(self):
        """Test quantization precision characteristics."""
        points = create_test_frame(1000)
        quantized, metadata = quantize_points(points, 'fp16')
        dequantized = dequantize_points(quantized, metadata)

        error_stats = compute_quantization_error(points, dequantized)

        # Most points should have small errors
        max_error = error_stats['max_error']
        mean_error = error_stats['mean_error']

        # Max error should be less than 1 meter for typical ranges
        self.assertLess(max_error, 1.0)
        # Mean error should be much smaller
        self.assertLess(mean_error, max_error / 2)


class TestQuantizeInt16(unittest.TestCase):
    """Test 'int16' quantization mode."""

    def test_int16_converts_dtype(self):
        """Test that quantization converts to int16 for spatial dims."""
        points = create_test_frame(1000)
        quantized, metadata = quantize_points(points, 'int16')

        # Should be int16 (3D) or structured array with int16/uint16 fields (4D)
        if quantized.dtype.names:
            # Structured array case (4D with intensity)
            self.assertIn('x', quantized.dtype.names)
            self.assertIn('y', quantized.dtype.names)
            self.assertIn('z', quantized.dtype.names)
            self.assertIn('intensity', quantized.dtype.names)
        else:
            # Regular array case (3D without intensity)
            self.assertEqual(quantized.dtype, np.int16)
        self.assertEqual(metadata['mode'], 'int16')

    def test_int16_shape_preserved(self):
        """Test that shape is preserved."""
        points = create_test_frame(1000)
        quantized, _ = quantize_points(points, 'int16')

        self.assertEqual(quantized.shape[0], points.shape[0])

    def test_int16_includes_bbox(self):
        """Test that bbox metadata is included."""
        points = create_test_frame(1000)
        quantized, metadata = quantize_points(points, 'int16')

        self.assertIn('bbox_min', metadata)
        self.assertIn('bbox_max', metadata)
        self.assertEqual(len(metadata['bbox_min']), 3)
        self.assertEqual(len(metadata['bbox_max']), 3)

    def test_int16_roundtrip(self):
        """Test quantize and dequantize round-trip for int16."""
        points = create_test_frame(100)
        quantized, metadata = quantize_points(points, 'int16')
        dequantized = dequantize_points(quantized, metadata)

        # int16 should have better precision than fp16 for normalized range
        self.assertEqual(dequantized.dtype, np.float32)
        self.assertEqual(dequantized.shape, points.shape)

        error_stats = compute_quantization_error(points, dequantized)
        # int16 normalization typically gives ~mm precision
        self.assertLess(error_stats['rmse'], 0.01)  # < 1cm RMS

    def test_int16_bbox_validity(self):
        """Test that bbox min < max."""
        points = create_test_frame(1000)
        _, metadata = quantize_points(points, 'int16')

        bbox_min = np.array(metadata['bbox_min'])
        bbox_max = np.array(metadata['bbox_max'])

        for i in range(3):
            self.assertLess(bbox_min[i], bbox_max[i])

    def test_int16_intensity_scale(self):
        """Test intensity scaling metadata."""
        points = create_test_frame(1000)
        _, metadata = quantize_points(points, 'int16')

        if metadata.get('intensity_scale'):
            self.assertEqual(metadata['intensity_scale'], 65535)


class TestDequantizeErrors(unittest.TestCase):
    """Test dequantization error handling."""

    def test_dequantize_unknown_mode(self):
        """Test dequantization with unknown mode raises error."""
        quantized = np.zeros((10, 4), dtype=np.int16)
        bad_metadata = {'mode': 'unknown'}

        with self.assertRaises(ValueError):
            dequantize_points(quantized, bad_metadata)

    def test_dequantize_missing_bbox(self):
        """Test dequantization of int16 without bbox raises error."""
        quantized = np.zeros((10, 4), dtype=np.int16)
        bad_metadata = {'mode': 'int16'}  # Missing bbox_min/max

        with self.assertRaises((KeyError, TypeError)):
            dequantize_points(quantized, bad_metadata)


class TestQuantizeErrors(unittest.TestCase):
    """Test quantization error handling."""

    def test_invalid_mode(self):
        """Test that invalid mode raises ValueError."""
        points = create_test_frame(100)

        with self.assertRaises(ValueError):
            quantize_points(points, 'uint8')

    def test_int16_3d_points_ok(self):
        """Test that int16 works with 3D points (no intensity)."""
        points_3d = np.random.randn(100, 3).astype(np.float32)
        quantized, metadata = quantize_points(points_3d, 'int16')

        self.assertEqual(quantized.shape[0], 100)
        self.assertEqual(metadata['mode'], 'int16')

    def test_int16_2d_points_fails(self):
        """Test that int16 with <3D points raises error."""
        points_2d = np.random.randn(100, 2).astype(np.float32)

        with self.assertRaises(ValueError):
            quantize_points(points_2d, 'int16')


class TestQuantizationError(unittest.TestCase):
    """Test error computation function."""

    def test_error_stats_sanity(self):
        """Test that error stats make sense."""
        original = create_test_frame(100)
        quantized, metadata = quantize_points(original, 'fp16')
        dequantized = dequantize_points(quantized, metadata)

        error_stats = compute_quantization_error(original, dequantized)

        # max_error >= mean_error
        self.assertGreaterEqual(error_stats['max_error'], error_stats['mean_error'])
        # RMSE should be between mean and max
        self.assertLessEqual(error_stats['rmse'], error_stats['max_error'])

    def test_error_shape_mismatch(self):
        """Test error on shape mismatch."""
        a = np.random.randn(100, 4).astype(np.float32)
        b = np.random.randn(50, 4).astype(np.float32)

        with self.assertRaises(ValueError):
            compute_quantization_error(a, b)

    def test_error_tolerance(self):
        """Test error tolerance check."""
        original = create_test_frame(100)
        quantized, metadata = quantize_points(original, 'fp16')
        dequantized = dequantize_points(quantized, metadata)

        error_stats = compute_quantization_error(original, dequantized)

        # fp16 max error typically > 1mm but < 1m
        if error_stats['max_error'] > 0.001:
            self.assertFalse(error_stats['within_tolerance_1mm'])


if __name__ == '__main__':
    unittest.main()
