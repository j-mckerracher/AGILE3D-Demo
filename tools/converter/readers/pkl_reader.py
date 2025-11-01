"""
PKL file reader for OpenPCDet detection outputs.

Loads pickled detection results and maps to internal frame/detection models.
Tolerates schema variations and unknown fields per additive versioning.
"""

import pickle
from pathlib import Path
from typing import Any, Optional
import numpy as np
import sys

# Import models from parent directory
sys.path.insert(0, str(Path(__file__).parent.parent))
from models import Detection, Frame, FrameData  # type: ignore


def read_pkl(input_path: str) -> FrameData:
    """
    Read and parse a PKL file containing OpenPCDet detection results.

    Extracts point clouds, ground truth, and per-branch detections.
    Gracefully handles missing optional fields and unknown attributes.

    Args:
        input_path: Path to input PKL file.

    Returns:
        FrameData with frames list and metadata.

    Raises:
        FileNotFoundError: If PKL file does not exist.
        ValueError: If PKL structure is invalid or missing critical fields.
    """
    pkl_file = Path(input_path)
    if not pkl_file.exists():
        raise FileNotFoundError(f"PKL file not found: {input_path}")
    if not pkl_file.is_file():
        raise ValueError(f"PKL path is not a file: {input_path}")

    try:
        with open(pkl_file, 'rb') as f:
            data = pickle.load(f)
    except Exception as e:
        raise ValueError(f"Failed to load PKL file: {e}") from e

    # Normalize data structure: expect list of frames or dict with 'results' key
    frames_data = _extract_frames_list(data)
    if not frames_data:
        raise ValueError("PKL file contains no frame data")

    # Map to internal Frame objects
    frames = []
    for frame_idx, frame_dict in enumerate(frames_data):
        frame = _parse_frame(frame_dict, frame_idx)
        frames.append(frame)

    return FrameData(frames=frames, metadata={"source": str(pkl_file)})


def _extract_frames_list(data: Any) -> list[dict]:
    """
    Extract frames list from various PKL structure formats.

    Handles:
    - Direct list of frame dicts
    - Dict with 'results' key containing frames
    - Other structures

    Args:
        data: Loaded pickle data.

    Returns:
        List of frame dictionaries.

    Raises:
        ValueError: If structure cannot be parsed.
    """
    if isinstance(data, list):
        # Direct list format
        return data
    elif isinstance(data, dict):
        # Try common keys for detection results
        for key in ['results', 'frames', 'data', 'predictions']:
            if key in data and isinstance(data[key], list):
                return data[key]
        # If dict has frame-like structure, wrap as single element list
        if _is_frame_dict(data):
            return [data]

    raise ValueError(
        f"Cannot parse PKL structure. Expected list of frames or dict with "
        f"'results' key. Got: {type(data)}"
    )


def _is_frame_dict(obj: Any) -> bool:
    """Check if object looks like a frame dictionary."""
    if not isinstance(obj, dict):
        return False
    # Should have at least points and some detection fields
    return 'points' in obj or 'boxes_lidar' in obj or 'gt_boxes' in obj


def _parse_frame(frame_dict: dict, frame_idx: int) -> Frame:
    """
    Parse a single frame dictionary to Frame object.

    Extracts points, ground truth, and detections with defensive field access.

    Args:
        frame_dict: Raw frame data from PKL.
        frame_idx: Frame index for ID if not in dict.

    Returns:
        Parsed Frame object.

    Raises:
        ValueError: If critical fields missing.
    """
    # Extract frame ID
    frame_id = getattr(frame_dict, 'frame_id', None) or frame_dict.get(
        'frame_id', f'{frame_idx:06d}'
    )
    if not isinstance(frame_id, str):
        frame_id = str(frame_id)

    # Extract points (critical)
    points = getattr(frame_dict, 'points', None)
    if points is None:
        points = frame_dict.get('points')
    if points is None:
        raise ValueError(f"Frame {frame_id} missing 'points' field")
    if not isinstance(points, np.ndarray):
        points = np.array(points, dtype=np.float32)
    if points.ndim != 2 or points.shape[1] < 3:
        raise ValueError(
            f"Frame {frame_id} points shape invalid: {points.shape}. "
            f"Expected (N, >=3)"
        )

    point_count = points.shape[0]

    # Extract ground truth detections
    gt_boxes = getattr(frame_dict, 'gt_boxes', None)
    if gt_boxes is None:
        gt_boxes = frame_dict.get('gt_boxes')

    gt_names = getattr(frame_dict, 'gt_names', None)
    if gt_names is None:
        gt_names = frame_dict.get('gt_names')
    if gt_names is None:
        gt_names = frame_dict.get('name')
    ground_truth = _parse_detections(
        boxes=gt_boxes,
        labels=gt_names,
        scores=None,
        frame_id=frame_id,
        is_gt=True
    )

    # Extract predicted detections (may be multiple branches)
    # Single-branch format: boxes_lidar, score, pred_labels
    det_boxes = getattr(frame_dict, 'boxes_lidar', None)
    if det_boxes is None:
        det_boxes = frame_dict.get('boxes_lidar')
    if det_boxes is None:
        det_boxes = frame_dict.get('pred_boxes')

    det_scores = getattr(frame_dict, 'score', None)
    if det_scores is None:
        det_scores = frame_dict.get('score')
    if det_scores is None:
        det_scores = frame_dict.get('scores')

    det_labels = getattr(frame_dict, 'pred_labels', None)
    if det_labels is None:
        det_labels = frame_dict.get('pred_labels')
    if det_labels is None:
        det_labels = frame_dict.get('pred_names')

    detections_by_branch = {}
    if det_boxes is not None:
        # Single branch (no explicit branch name)
        branch_name = getattr(frame_dict, 'branch', 'default')
        if not isinstance(branch_name, str):
            branch_name = str(branch_name)
        dets = _parse_detections(
            boxes=det_boxes,
            labels=det_labels,
            scores=det_scores,
            frame_id=frame_id,
            is_gt=False
        )
        if dets:
            detections_by_branch[branch_name] = dets

    return Frame(
        frame_id=frame_id,
        points=points,
        point_count=point_count,
        ground_truth=ground_truth,
        detections=detections_by_branch
    )


def _parse_detections(
    boxes: Optional[np.ndarray],
    labels: Optional[np.ndarray],
    scores: Optional[np.ndarray],
    frame_id: str,
    is_gt: bool = False
) -> list[Detection]:
    """
    Parse detection boxes to Detection objects.

    Handles 7-DOF format: [x, y, z, length, width, height, yaw].

    Args:
        boxes: Nx7 array of bounding boxes.
        labels: N array of class labels (strings or ints).
        scores: N array of confidence scores (optional).
        frame_id: Frame identifier for logging.
        is_gt: If True, scores are None.

    Returns:
        List of Detection objects.
    """
    if boxes is None or len(boxes) == 0:
        return []

    if not isinstance(boxes, np.ndarray):
        boxes = np.array(boxes, dtype=np.float32)

    # Ensure 2D
    if boxes.ndim == 1:
        boxes = boxes.reshape(1, -1)

    if boxes.shape[1] < 7:
        # Fewer than 7 DOF; log warning and skip
        return []

    # Extract labels; default to 'unknown' if missing
    if labels is None:
        labels = ['unknown'] * len(boxes)
    elif not isinstance(labels, (list, np.ndarray)):
        labels = [labels] * len(boxes)
    elif isinstance(labels, np.ndarray):
        labels = labels.tolist()

    # Extract scores; default to 1.0 if GT or missing
    if scores is None:
        scores = [1.0 if is_gt else 0.0] * len(boxes)
    elif not isinstance(scores, (list, np.ndarray)):
        scores = [scores] * len(boxes)
    elif isinstance(scores, np.ndarray):
        scores = scores.tolist()

    detections = []
    for idx, (box, label, score) in enumerate(
        zip(boxes, labels, scores)
    ):
        det = _box_to_detection(
            box, label, score, frame_id, idx, is_gt
        )
        if det:
            detections.append(det)

    return detections


def _box_to_detection(
    box: np.ndarray,
    label: Any,
    score: float,
    frame_id: str,
    det_idx: int,
    is_gt: bool
) -> Optional[Detection]:
    """
    Convert a single 7-DOF box to Detection object.

    Args:
        box: [x, y, z, length, width, height, yaw]
        label: Class label (string or int).
        score: Confidence score.
        frame_id: Frame ID for logging.
        det_idx: Detection index within frame.
        is_gt: If True, confidence is 1.0 (ignored arg).

    Returns:
        Detection object, or None if invalid.
    """
    try:
        # Extract components
        center = (float(box[0]), float(box[1]), float(box[2]))
        length = float(box[3])
        width = float(box[4])
        height = float(box[5])
        yaw = float(box[6])

        # Normalize label
        class_name = _normalize_class_name(label)

        # Create detection
        return Detection(
            id=f"{frame_id}_{det_idx}",
            class_name=class_name,
            center=center,
            dimensions={
                'length': length,
                'width': width,
                'height': height
            },
            yaw=yaw,
            confidence=1.0 if is_gt else float(score)
        )
    except (ValueError, IndexError, TypeError):
        # Skip malformed detection
        return None


def _normalize_class_name(label: Any) -> str:
    """
    Normalize class label to lowercase standard form.

    Maps common OpenPCDet labels to standard web format.

    Args:
        label: Raw label from detection.

    Returns:
        Normalized lowercase class name.
    """
    if label is None:
        return 'unknown'

    # Convert to string and normalize
    label_str = str(label).lower().strip()

    # Map common aliases
    mapping = {
        'car': 'vehicle',
        'car_': 'vehicle',
        'truck': 'vehicle',
        'bus': 'vehicle',
        'person': 'pedestrian',
        'person_': 'pedestrian',
        'cyclist': 'cyclist',
        'bicycle': 'cyclist'
    }

    for key, value in mapping.items():
        if label_str.startswith(key):
            return value

    # Return as-is if not in mapping (lowercase)
    return label_str
