"""
Data models for PKL to Web Converter.

Defines internal representation of frames, detections, and ground truth
that bridges the OpenPCDet detection format to web-consumable output.
"""

from dataclasses import dataclass, field
from typing import Optional
import numpy as np


@dataclass
class Detection:
    """Represents a single bounding box detection (GT or predicted)."""

    id: str
    """Unique detection identifier."""

    class_name: str
    """Class label: 'vehicle', 'pedestrian', or 'cyclist'."""

    center: tuple[float, float, float]
    """3D center position [x, y, z] in LiDAR frame."""

    dimensions: dict[str, float]
    """Bounding box dimensions: {'width': w, 'length': l, 'height': h}."""

    yaw: float
    """Rotation around Z axis in radians."""

    confidence: Optional[float] = None
    """Detection confidence score [0, 1]. None for ground truth."""


@dataclass
class Frame:
    """Represents a single frame with point cloud and detections."""

    frame_id: str
    """Frame identifier (e.g., '000000', '000001', or numeric string)."""

    points: np.ndarray
    """Point cloud array, shape (N, 4): [x, y, z, intensity]."""

    point_count: int
    """Number of points in this frame."""

    ground_truth: list[Detection] = field(default_factory=list)
    """Ground truth detections for this frame."""

    detections: dict[str, list[Detection]] = field(default_factory=dict)
    """Predictions per branch. Key: branch name, Value: list of detections."""

    transform_metadata: dict = field(default_factory=dict)
    """Metadata about applied transforms (downsampling, quantization)."""

    @property
    def detection_count(self) -> int:
        """Total number of detections across all branches."""
        return sum(len(dets) for dets in self.detections.values())


@dataclass
class FrameData:
    """Container for all frames and metadata from a PKL file."""

    frames: list[Frame]
    """List of frames extracted from PKL."""

    metadata: dict = field(default_factory=dict)
    """Optional metadata (e.g., coordinate system info, schema version)."""

    @property
    def frame_count(self) -> int:
        """Total number of frames."""
        return len(self.frames)

    @property
    def total_points(self) -> int:
        """Total points across all frames."""
        return sum(f.point_count for f in self.frames)
