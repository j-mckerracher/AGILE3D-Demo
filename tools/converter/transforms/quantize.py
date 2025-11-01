"""
Point cloud quantization transforms.

Provides three quantization modes:
- 'off': No quantization (float32, original)
- 'fp16': Half precision (float16, ~50% size reduction)
- 'int16': Normalized integer (bbox-based, ~50% size reduction)
"""

from typing import Tuple, Optional
import numpy as np


def quantize_points(
    points: np.ndarray,
    mode: str
) -> Tuple[np.ndarray, dict]:
    """
    Quantize a point cloud to reduce storage size.

    Supports three quantization modes with different tradeoffs between
    compression and precision.

    Args:
        points: Input point cloud, shape (N, 3|4), dtype float32.
            Typically [x, y, z, intensity] or [x, y, z].
        mode: Quantization mode: 'off', 'fp16', or 'int16'.
            - 'off': No quantization, return float32 unchanged
            - 'fp16': Convert to float16 (2 bytes per coord, ~0.1% precision loss)
            - 'int16': Normalize to bbox, quantize to int16 (more complex, better precision)

    Returns:
        Tuple of:
            - quantized_points: Quantized array (N, 3|4) with appropriate dtype
            - metadata: Dict with quantization info:
              - mode: Quantization mode used
              - dtype: NumPy dtype string
              - bytes_per_point: Storage size per point
              - bbox_min/max: (int16 only) Bounding box for denormalization

    Raises:
        ValueError: If mode is invalid or quantization fails.
    """
    if mode not in ('off', 'fp16', 'int16'):
        raise ValueError(f"Invalid quantization mode: {mode}. Choose from 'off', 'fp16', 'int16'")

    if mode == 'off':
        return quantize_off(points)
    elif mode == 'fp16':
        return quantize_fp16(points)
    elif mode == 'int16':
        return quantize_int16(points)


def quantize_off(points: np.ndarray) -> Tuple[np.ndarray, dict]:
    """
    No quantization: return float32 unchanged.

    Args:
        points: Input array.

    Returns:
        (points, metadata) with mode='off'.
    """
    metadata = {
        'mode': 'off',
        'dtype': 'float32',
        'bytes_per_point': 16,  # 4 coords × 4 bytes
        'compression': 1.0
    }
    return points, metadata


def quantize_fp16(points: np.ndarray) -> Tuple[np.ndarray, dict]:
    """
    Quantize to float16 (half precision).

    Converts each coordinate to float16, achieving ~50% size reduction with
    minimal precision loss for typical LiDAR ranges (-100 to +100m).

    Args:
        points: Input array (N, 3|4).

    Returns:
        (quantized_points, metadata).
    """
    if points.dtype != np.float32:
        points = points.astype(np.float32)

    quantized = points.astype(np.float16)

    metadata = {
        'mode': 'fp16',
        'dtype': 'float16',
        'bytes_per_point': 8,  # 4 coords × 2 bytes
        'compression': 0.5,
        'precision_loss_pct': 0.1,  # Approximate
        'suitable_range': '[-65504, 65504] (meters)'
    }

    return quantized, metadata


def quantize_int16(points: np.ndarray) -> Tuple[np.ndarray, dict]:
    """
    Quantize to int16 with bounding box normalization.

    Maps spatial coordinates (x, y, z) to normalized [-1, 1] range, then
    scales to int16 [-32768, 32767]. Intensity (if present) scaled to uint16.

    Provides good precision control at cost of additional metadata overhead.

    Args:
        points: Input array (N, 3|4).

    Returns:
        (quantized_points, metadata) with bbox info for dequantization.
    """
    if points.shape[1] < 3:
        raise ValueError("int16 quantization requires at least 3 spatial coords (x, y, z)")

    if points.dtype != np.float32:
        points = points.astype(np.float32)

    # Extract spatial coordinates (x, y, z)
    xyz = points[:, :3]
    has_intensity = points.shape[1] > 3
    intensity = points[:, 3] if has_intensity else None

    # Compute bounding box
    bbox_min = xyz.min(axis=0)
    bbox_max = xyz.max(axis=0)
    bbox_range = bbox_max - bbox_min

    # Avoid division by zero for degenerate dimensions
    bbox_range[bbox_range == 0] = 1.0

    # Normalize to [-1, 1]
    xyz_normalized = 2.0 * (xyz - bbox_min) / bbox_range - 1.0

    # Quantize to int16
    xyz_quantized = (xyz_normalized * 32767).astype(np.int16)

    # Handle intensity if present
    if has_intensity:
        # Assume intensity in [0, 1] range; map to [0, 65535]
        intensity_quantized = (intensity * 65535.0).clip(0, 65535).astype(np.uint16)
        # Create structured array with proper dtype for mixed int16/uint16
        quantized = np.empty(len(xyz_quantized), dtype=[('x', np.int16), ('y', np.int16), ('z', np.int16), ('intensity', np.uint16)])
        quantized['x'] = xyz_quantized[:, 0]
        quantized['y'] = xyz_quantized[:, 1]
        quantized['z'] = xyz_quantized[:, 2]
        quantized['intensity'] = intensity_quantized
    else:
        quantized = xyz_quantized

    metadata = {
        'mode': 'int16',
        'dtype': 'int16 (xyz) + uint16 (intensity)' if has_intensity else 'int16',
        'bytes_per_point': 8 if has_intensity else 6,  # int16=2×3 or 2×3+2=8
        'compression': 0.5,
        'bbox_min': bbox_min.tolist(),
        'bbox_max': bbox_max.tolist(),
        'intensity_scale': 65535 if has_intensity else None,
        'precision_mm': float((bbox_range.max() / 32767.0 * 1000).item())  # Approximate mm precision
    }

    return quantized, metadata


def dequantize_points(
    quantized: np.ndarray,
    metadata: dict
) -> np.ndarray:
    """
    Dequantize a point cloud back to float32.

    Reverses the quantization applied by quantize_points(). Used for
    round-trip validation and client-side decoding.

    Args:
        quantized: Quantized array.
        metadata: Metadata dict from quantize_points().

    Returns:
        Dequantized array in float32.

    Raises:
        ValueError: If metadata is missing required fields for dequantization.
    """
    mode = metadata.get('mode')

    if mode == 'off':
        return quantized.astype(np.float32)

    elif mode == 'fp16':
        return quantized.astype(np.float32)

    elif mode == 'int16':
        # Reverse normalization
        bbox_min = np.array(metadata['bbox_min'], dtype=np.float32)
        bbox_max = np.array(metadata['bbox_max'], dtype=np.float32)
        bbox_range = bbox_max - bbox_min
        bbox_range[bbox_range == 0] = 1.0

        # Check if structured array (4D) or regular array (3D)
        if quantized.dtype.names:
            # Structured array: extract fields
            xyz_int16 = np.column_stack([quantized['x'], quantized['y'], quantized['z']]).astype(np.int16)
            has_intensity = 'intensity' in quantized.dtype.names
        else:
            # Regular array: extract columns
            xyz_int16 = quantized[:, :3].astype(np.int16)
            has_intensity = quantized.shape[1] > 3

        # Denormalize from [-32767, 32767] to [-1, 1]
        xyz_normalized = xyz_int16.astype(np.float32) / 32767.0

        # Denormalize from [-1, 1] to original bbox
        xyz_float32 = (xyz_normalized + 1.0) / 2.0 * bbox_range + bbox_min

        # Handle intensity if present
        if has_intensity:
            if quantized.dtype.names:
                intensity_uint16 = quantized['intensity'].astype(np.uint16)
            else:
                intensity_uint16 = quantized[:, 3].astype(np.uint16)
            intensity_float32 = intensity_uint16.astype(np.float32) / 65535.0
            dequantized = np.column_stack([xyz_float32, intensity_float32])
        else:
            dequantized = xyz_float32

        return dequantized.astype(np.float32)

    else:
        raise ValueError(f"Unknown quantization mode: {mode}")


def compute_quantization_error(
    original: np.ndarray,
    dequantized: np.ndarray
) -> dict:
    """
    Compute quantization error metrics.

    Useful for validation and precision analysis.

    Args:
        original: Original float32 points.
        dequantized: Dequantized float32 points.

    Returns:
        Dict with error statistics:
        - max_error: Maximum absolute error
        - mean_error: Mean absolute error
        - rmse: Root mean squared error
        - within_tolerance: Boolean, True if all errors within threshold
    """
    if original.shape != dequantized.shape:
        raise ValueError("Shape mismatch between original and dequantized")

    error = np.abs(original - dequantized)
    max_error = float(error.max())
    mean_error = float(error.mean())
    rmse = float(np.sqrt((error ** 2).mean()))

    # Tolerance: 1mm (typical LiDAR precision)
    tolerance = 0.001  # meters
    within_tolerance = max_error <= tolerance

    return {
        'max_error': max_error,
        'mean_error': mean_error,
        'rmse': rmse,
        'within_tolerance_1mm': within_tolerance,
        'max_error_mm': max_error * 1000
    }
