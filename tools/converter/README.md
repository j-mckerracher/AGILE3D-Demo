# PKL to Web Converter

Converts pickled point cloud and detection data into web-consumable formats for the AGILE3D Demo.

## Overview

The converter transforms source data from PKL format into:
- Binary point cloud frames (`.bin`)
- Ground truth annotations (`.gt.json`)
- Per-branch detection results (`.det.{branch}.json`)
- Manifest file (`manifest.json`)

Supports downsampling and quantization variants for optimized web delivery.

## Installation

### Prerequisites

- Python 3.11+ (tested with Python 3.13.7)
- NumPy 1.24+ (required for PKL loading and array operations)

### Setup Dependencies

```bash
# Install required packages (from requirements.txt)
pip3 install -r tools/converter/requirements.txt

# Or install individually
pip3 install 'numpy>=1.24.0'

# On Ubuntu/Debian
apt-get install python3-numpy
```

### Setup

```bash
# Clone and enter repository
cd /path/to/AGILE3D-Demo

# Run the CLI directly
python3 tools/converter/pkl2web.py --help
```

## Usage

### Basic Example

```bash
python3 tools/converter/pkl2web.py \
  --input-pkl /path/to/data.pkl \
  --out-dir ./output \
  --seq-id v_1784 \
  --frames 0:100 \
  --downsample 100k \
  --branches config/branches.json
```

### Command-Line Arguments

#### Required Arguments

- `--input-pkl PATH` — Path to input PKL file
- `--out-dir PATH` — Output directory for frames and manifests
- `--seq-id ID` — Sequence identifier (e.g., `v_1784`, `p_7513`, `c_7910`)
- `--frames START:END` — Frame range in format `start:end` (inclusive, 0-indexed)
- `--branches PATH` — Path to JSON file specifying branch configurations

#### Optional Arguments

- `--downsample {100k|50k}` — Target point count (default: `100k`)
- `--quantize {off|fp16|int16}` — Quantization method (default: `off` for float32)
- `--dry-run` — Validate arguments and report output structure without writing files

### Help

```bash
python3 tools/converter/pkl2web.py --help
```

## Project Structure

```
tools/converter/
├── pkl2web.py              # Main CLI entrypoint
├── __init__.py             # Package marker
├── README.md               # This file
├── tests/
│   ├── __init__.py
│   └── test_args.py        # Unit tests for argument parsing and validation
```

## Architecture

### Data Models (`models.py`)

Defines the internal representation of frames and detections:

- **Detection**: Single bounding box (GT or prediction)
  - `id`, `class_name`, `center` (x, y, z), `dimensions`, `yaw`, `confidence`
- **Frame**: Single frame with point cloud and detections
  - `frame_id`, `points` (Nx4), `point_count`, `ground_truth`, `detections`
- **FrameData**: Container for all frames
  - `frames[]`, `metadata`, properties: `frame_count`, `total_points`

### PKL Reader (`readers/pkl_reader.py`)

Loads OpenPCDet detection results and maps to internal models:

- **`read_pkl(path)`** — Entry point
  - Loads pickle file safely
  - Tolerates schema variations (missing optional fields, extra unknown fields)
  - Returns FrameData with parsed frames
  - Normalizes class names: `Car` → `vehicle`, `Person` → `pedestrian`, `Cyclist` → `cyclist`
  - Converts 7-DOF boxes [x, y, z, length, width, height, yaw] to Detection objects

### Integration with CLI

- `pkl2web.py` calls `read_pkl()` to load data
- In `--dry-run` mode, prints frame summaries:
  ```
  Frame 000000: 1,200 points, 42 (DSVT_Voxel), 35 (CP_Pillar_032)
  Frame 000001: 1,150 points, 38 (DSVT_Voxel), 32 (CP_Pillar_032)
  ```

## Development

### Running Tests

```bash
# Run all tests
python3 -m unittest discover tools/converter/tests -v

# Run argument parsing tests
python3 -m unittest tools.converter.tests.test_args -v

# Run PKL reader tests
python3 -m unittest tools.converter.tests.test_pkl_reader -v

# Run specific test class
python3 -m unittest tools.converter.tests.test_pkl_reader.TestPKLReaderValidDetection -v
```

### Testing Coverage

**Argument Parsing Tests (test_args.py):**
- ✓ Required argument enforcement (all 5 required args)
- ✓ Optional argument defaults (downsample, quantize, dry-run)
- ✓ Argument validation (file existence, frame format, ranges)
- ✓ Error handling (non-zero exit codes)
- ✓ Help text generation
- ✓ Main function entry point
- **28 unit tests, 100% pass rate**

**PKL Reader Tests (test_pkl_reader.py):**
- ✓ Reading valid detection PKL files (multiple frames)
- ✓ Frame count and structure validation
- ✓ Ground truth extraction and class normalization
- ✓ Detection confidence scores preservation
- ✓ Tolerate extra unknown fields (schema drift)
- ✓ Handle missing optional fields gracefully
- ✓ File not found error handling
- ✓ Corrupted PKL error handling
- **10 unit tests, 100% pass rate**

**Total Test Coverage:**
- 38 unit tests across both modules
- 100% pass rate
- Covers parsing, validation, PKL loading, schema mapping, and error handling

## Implementation Roadmap (Epic A)

1. **✓ U01** — CLI skeleton & args parsing (COMPLETE)
2. **✓ U02** — PKL read & schema mapping (COMPLETE)
3. **U03** — Downsample/fallback tiers
4. **U04** — Emit manifest/frames
5. **U05** — Validation report
6. **U06** — Sample sequence (10 frames)

## Notes

- Frame ranges are **inclusive** and **0-indexed**
- Examples: `0:10` includes frames 0–10 (11 frames total)
- Use `--dry-run` to validate arguments without writing files
- Invalid arguments return non-zero exit codes for CI integration

## License

See repository LICENSE file.
