"""
Unit tests for point cloud downsampling transforms.

Tests cover:
- Downsampling to 100k and 50k tiers
- Point count validation (±1%)
- Spatial distribution preservation
- Edge cases (already below target, empty frames)
"""

import unittest
import sys
from pathlib import Path
import numpy as np

# Add parent directory to path
converter_dir = Path(__file__).parent.parent
sys.path.insert(0, str(converter_dir))

from transforms.downsample import downsample_points, get_target_count  # noqa: E402


def create_test_frame(n_points: int, seed: int = 42) -> np.ndarray:
    """
    Create synthetic point cloud for testing.

    Args:
        n_points: Number of points to generate.
        seed: Random seed for reproducibility.

    Returns:
        Point cloud array (n_points, 4) with [x, y, z, intensity].
    """
    rng = np.random.default_rng(seed=seed)
    points = rng.standard_normal((n_points, 4)).astype(np.float32)
    points[:, 3] = rng.uniform(0, 1, n_points).astype(np.float32)  # Intensity [0, 1]
    return points


class TestDownsample100k(unittest.TestCase):
    """Test downsampling to 100k tier."""

    def test_downsample_100k_from_150k(self):
        """Test downsampling 150k points to 100k tier."""
        points = create_test_frame(150_000)
        downsampled, metadata = downsample_points(points, '100k')

        # Check final count is within ±1%
        self.assertEqual(downsampled.shape[1], 4)
        self.assertGreaterEqual(downsampled.shape[0], 99_000)
        self.assertLessEqual(downsampled.shape[0], 101_000)

        # Check metadata
        self.assertEqual(metadata['method'], 'random')
        self.assertEqual(metadata['target_tier'], '100k')
        self.assertEqual(metadata['target_count'], 100_000)
        self.assertEqual(metadata['original_count'], 150_000)
        self.assertTrue(metadata['within_spec'])

    def test_downsample_100k_from_200k(self):
        """Test downsampling 200k points to 100k tier."""
        points = create_test_frame(200_000, seed=123)
        downsampled, metadata = downsample_points(points, '100k')

        # Verify within ±1%
        self.assertGreaterEqual(downsampled.shape[0], 99_000)
        self.assertLessEqual(downsampled.shape[0], 101_000)
        self.assertTrue(metadata['within_spec'])
        self.assertAlmostEqual(
            metadata['reduction_ratio'],
            downsampled.shape[0] / 200_000,
            places=5
        )

    def test_downsample_already_at_target(self):
        """Test that exactly 100k points returns unchanged."""
        points = create_test_frame(100_000)
        downsampled, metadata = downsample_points(points, '100k')

        self.assertEqual(downsampled.shape[0], 100_000)
        self.assertEqual(metadata['method'], 'none')
        self.assertTrue(metadata['within_spec'])

    def test_downsample_below_target(self):
        """Test that <100k points returns unchanged."""
        points = create_test_frame(50_000)
        downsampled, metadata = downsample_points(points, '100k')

        self.assertEqual(downsampled.shape[0], 50_000)
        np.testing.assert_array_equal(downsampled, points)
        self.assertEqual(metadata['method'], 'none')
        self.assertEqual(metadata['reason'], 'original_count <= target_count')


class TestDownsample50k(unittest.TestCase):
    """Test downsampling to 50k tier."""

    def test_downsample_50k_from_150k(self):
        """Test downsampling 150k points to 50k tier."""
        points = create_test_frame(150_000, seed=456)
        downsampled, metadata = downsample_points(points, '50k')

        # Verify ±1%
        self.assertGreaterEqual(downsampled.shape[0], 49_500)
        self.assertLessEqual(downsampled.shape[0], 50_500)
        self.assertTrue(metadata['within_spec'])
        self.assertEqual(metadata['target_tier'], '50k')
        self.assertEqual(metadata['target_count'], 50_000)

    def test_downsample_50k_from_200k(self):
        """Test downsampling 200k points to 50k tier."""
        points = create_test_frame(200_000, seed=789)
        downsampled, metadata = downsample_points(points, '50k')

        self.assertGreaterEqual(downsampled.shape[0], 49_500)
        self.assertLessEqual(downsampled.shape[0], 50_500)
        self.assertTrue(metadata['within_spec'])

    def test_downsample_50k_from_75k(self):
        """Test downsampling 75k points to 50k tier."""
        points = create_test_frame(75_000)
        downsampled, metadata = downsample_points(points, '50k')

        self.assertGreaterEqual(downsampled.shape[0], 49_500)
        self.assertLessEqual(downsampled.shape[0], 50_500)


class TestDownsamplePreservesDistribution(unittest.TestCase):
    """Test that downsampling preserves spatial distribution."""

    def test_preserves_xyz_distribution(self):
        """Test that XYZ coordinates are similarly distributed."""
        # Create points with non-uniform distribution (e.g., along a line)
        rng = np.random.default_rng(seed=999)
        x = np.linspace(-100, 100, 150_000)
        y = rng.standard_normal(150_000)
        z = rng.standard_normal(150_000)
        intensity = rng.uniform(0, 1, 150_000)
        points = np.column_stack([x, y, z, intensity]).astype(np.float32)

        downsampled, metadata = downsample_points(points, '100k')

        # Compare distributions (basic checks)
        original_mean = points[:, :3].mean(axis=0)
        downsampled_mean = downsampled[:, :3].mean(axis=0)

        # Means should be close (within 5%)
        for i in range(3):
            self.assertAlmostEqual(
                original_mean[i],
                downsampled_mean[i],
                delta=0.05 * abs(original_mean[i]) + 0.1
            )

    def test_no_extreme_clustering(self):
        """Test that downsampling doesn't cluster at extremes."""
        # Create uniform distribution in unit cube
        rng = np.random.default_rng(seed=111)
        points = rng.uniform(-50, 50, (150_000, 3)).astype(np.float32)
        intensity = rng.uniform(0, 1, 150_000).astype(np.float32)
        points = np.column_stack([points, intensity])

        downsampled, _ = downsample_points(points, '100k')

        # Check that points aren't all clustered near min/max
        x_min_count = np.sum(downsampled[:, 0] < -45)
        x_max_count = np.sum(downsampled[:, 0] > 45)

        # Should have some points in interior, not all at extremes
        self.assertLess(x_min_count, downsampled.shape[0] * 0.1)
        self.assertLess(x_max_count, downsampled.shape[0] * 0.1)


class TestDownsampleDeterminism(unittest.TestCase):
    """Test that downsampling is deterministic with fixed seed."""

    def test_same_seed_same_result(self):
        """Test that same seed produces same downsampled points."""
        points = create_test_frame(150_000)

        # Downsample twice with same seed
        downsampled1, _ = downsample_points(points, '100k', seed=42)
        downsampled2, _ = downsample_points(points, '100k', seed=42)

        # Should be identical
        np.testing.assert_array_equal(downsampled1, downsampled2)

    def test_different_seed_different_result(self):
        """Test that different seeds produce different downsampled points."""
        points = create_test_frame(150_000)

        downsampled1, _ = downsample_points(points, '100k', seed=42)
        downsampled2, _ = downsample_points(points, '100k', seed=123)

        # Should not be identical (with extremely high probability)
        self.assertFalse(np.allclose(downsampled1, downsampled2))


class TestDownsampleShape(unittest.TestCase):
    """Test output shape preservation."""

    def test_maintains_4d_shape(self):
        """Test that (N, 4) input produces (M, 4) output."""
        points = create_test_frame(150_000)
        downsampled, _ = downsample_points(points, '100k')

        self.assertEqual(downsampled.ndim, 2)
        self.assertEqual(downsampled.shape[1], 4)

    def test_maintains_dtype(self):
        """Test that float32 is preserved."""
        points = create_test_frame(150_000)
        downsampled, _ = downsample_points(points, '100k')

        self.assertEqual(downsampled.dtype, np.float32)


class TestDownsampleErrors(unittest.TestCase):
    """Test error handling."""

    def test_invalid_tier(self):
        """Test that invalid tier raises ValueError."""
        points = create_test_frame(100_000)

        with self.assertRaises(ValueError):
            downsample_points(points, '75k')

    def test_invalid_shape(self):
        """Test that invalid shape raises ValueError."""
        # 1D array
        with self.assertRaises(ValueError):
            downsample_points(np.array([1, 2, 3]), '100k')

        # (N, 2) array (too few coordinates)
        points_2d = np.random.randn(100, 2).astype(np.float32)
        with self.assertRaises(ValueError):
            downsample_points(points_2d, '100k')

    def test_get_target_count(self):
        """Test get_target_count helper function."""
        self.assertEqual(get_target_count('100k'), 100_000)
        self.assertEqual(get_target_count('50k'), 50_000)

        with self.assertRaises(ValueError):
            get_target_count('75k')


if __name__ == '__main__':
    unittest.main()
