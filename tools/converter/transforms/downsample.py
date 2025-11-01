"""
Point cloud downsampling transforms.

Provides uniform random sampling to reduce point counts to target tiers
(100k or 50k points) while preserving spatial distribution.
"""

from typing import Tuple
import numpy as np


def downsample_points(
    points: np.ndarray,
    target_tier: str,
    seed: int = 42
) -> Tuple[np.ndarray, dict]:
    """
    Downsample a point cloud to target tier.

    Uses uniform random sampling to preserve spatial distribution without
    clustering bias. If the input already meets the target, returns unchanged.

    Args:
        points: Input point cloud, shape (N, 3) or (N, 4) with dtype float32.
            Typically [x, y, z, intensity] or [x, y, z].
        target_tier: Target downsample tier: '100k' (100,000) or '50k' (50,000).
        seed: Random seed for reproducibility. Defaults to 42.

    Returns:
        Tuple of:
            - downsampled_points: Resampled array (M, 3|4) where M <= target
            - metadata: Dict with downsampling stats:
              - method: 'random'
              - target_tier: Target tier string
              - target_count: Target point count
              - original_count: Original point count
              - final_count: Actual final count
              - reduction_ratio: final_count / original_count
              - within_spec: Boolean, True if within ±1%

    Raises:
        ValueError: If target_tier is invalid or points array shape invalid.
    """
    # Parse target tier
    tier_map = {'100k': 100_000, '50k': 50_000}
    if target_tier not in tier_map:
        raise ValueError(f"Invalid tier: {target_tier}. Choose from {list(tier_map.keys())}")
    target_count = tier_map[target_tier]

    # Validate input
    if points.ndim != 2 or points.shape[1] < 3:
        raise ValueError(
            f"Points must be (N, 3+) array. Got shape {points.shape}"
        )

    original_count = points.shape[0]

    # If already at or below target, no downsampling needed
    if original_count <= target_count:
        metadata = {
            'method': 'none',
            'target_tier': target_tier,
            'target_count': target_count,
            'original_count': original_count,
            'final_count': original_count,
            'reduction_ratio': 1.0,
            'within_spec': True,
            'reason': 'original_count <= target_count'
        }
        return points, metadata

    # Perform uniform random sampling
    rng = np.random.default_rng(seed=seed)
    indices = rng.choice(original_count, size=target_count, replace=False)
    indices.sort()  # Preserve spatial locality
    downsampled = points[indices]

    # Validate within ±1% of target
    final_count = downsampled.shape[0]
    tolerance = 0.01 * target_count
    within_spec = abs(final_count - target_count) <= tolerance

    metadata = {
        'method': 'random',
        'target_tier': target_tier,
        'target_count': target_count,
        'original_count': original_count,
        'final_count': final_count,
        'reduction_ratio': final_count / original_count,
        'within_spec': within_spec,
        'tolerance_pct': 1.0
    }

    return downsampled, metadata


def get_target_count(tier: str) -> int:
    """
    Get integer point count for a tier string.

    Args:
        tier: Tier string ('100k' or '50k').

    Returns:
        Integer point count.

    Raises:
        ValueError: If tier is invalid.
    """
    tier_map = {'100k': 100_000, '50k': 50_000}
    if tier not in tier_map:
        raise ValueError(f"Invalid tier: {tier}. Choose from {list(tier_map.keys())}")
    return tier_map[tier]
