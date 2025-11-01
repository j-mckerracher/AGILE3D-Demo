"""
Unit tests for pkl2web CLI argument parsing and validation.

Tests cover:
- Required argument enforcement
- Optional argument defaults
- Argument validation (file existence, frame format, etc.)
- Error handling and non-zero exit codes
"""

import unittest
import tempfile
import sys
import pickle
import json
from pathlib import Path
from unittest.mock import patch

# Add parent directory to path to import pkl2web
sys.path.insert(0, str(Path(__file__).parent.parent))

import pkl2web


class TestArgumentParsing(unittest.TestCase):
    """Test argument parser creation and basic parsing."""

    def setUp(self):
        """Set up test fixtures."""
        self.parser = pkl2web.create_parser()

    def test_parser_created(self):
        """Test that parser is created without error."""
        self.assertIsNotNone(self.parser)

    def test_help_contains_all_required_args(self):
        """Test that --help output includes all required arguments."""
        help_text = self.parser.format_help()
        required_args = [
            '--input-pkl',
            '--out-dir',
            '--seq-id',
            '--frames',
            '--branches'
        ]
        for arg in required_args:
            self.assertIn(arg, help_text,
                         f"Help text missing required argument: {arg}")

    def test_help_contains_optional_args(self):
        """Test that --help output includes optional arguments."""
        help_text = self.parser.format_help()
        optional_args = [
            '--downsample',
            '--quantize',
            '--dry-run'
        ]
        for arg in optional_args:
            self.assertIn(arg, help_text,
                         f"Help text missing optional argument: {arg}")

    def test_missing_required_input_pkl(self):
        """Test that missing --input-pkl fails."""
        with self.assertRaises(SystemExit):
            self.parser.parse_args([
                '--out-dir', '/tmp',
                '--seq-id', 'v_1784',
                '--frames', '0:10',
                '--branches', '/tmp/branches.json'
            ])

    def test_missing_required_out_dir(self):
        """Test that missing --out-dir fails."""
        with self.assertRaises(SystemExit):
            self.parser.parse_args([
                '--input-pkl', '/tmp/data.pkl',
                '--seq-id', 'v_1784',
                '--frames', '0:10',
                '--branches', '/tmp/branches.json'
            ])

    def test_missing_required_seq_id(self):
        """Test that missing --seq-id fails."""
        with self.assertRaises(SystemExit):
            self.parser.parse_args([
                '--input-pkl', '/tmp/data.pkl',
                '--out-dir', '/tmp',
                '--frames', '0:10',
                '--branches', '/tmp/branches.json'
            ])

    def test_missing_required_frames(self):
        """Test that missing --frames fails."""
        with self.assertRaises(SystemExit):
            self.parser.parse_args([
                '--input-pkl', '/tmp/data.pkl',
                '--out-dir', '/tmp',
                '--seq-id', 'v_1784',
                '--branches', '/tmp/branches.json'
            ])

    def test_missing_required_branches(self):
        """Test that missing --branches fails."""
        with self.assertRaises(SystemExit):
            self.parser.parse_args([
                '--input-pkl', '/tmp/data.pkl',
                '--out-dir', '/tmp',
                '--seq-id', 'v_1784',
                '--frames', '0:10'
            ])


class TestArgumentDefaults(unittest.TestCase):
    """Test default values for optional arguments."""

    def setUp(self):
        """Set up test fixtures with temporary files."""
        self.temp_dir = tempfile.TemporaryDirectory()
        self.temp_path = Path(self.temp_dir.name)

        # Create dummy PKL and branches files
        self.pkl_file = self.temp_path / 'data.pkl'
        self.branches_file = self.temp_path / 'branches.json'
        self.pkl_file.touch()
        self.branches_file.touch()

        self.parser = pkl2web.create_parser()

    def tearDown(self):
        """Clean up temporary files."""
        self.temp_dir.cleanup()

    def test_default_downsample_100k(self):
        """Test that --downsample defaults to 100k."""
        args = self.parser.parse_args([
            '--input-pkl', str(self.pkl_file),
            '--out-dir', str(self.temp_path),
            '--seq-id', 'v_1784',
            '--frames', '0:10',
            '--branches', str(self.branches_file)
        ])
        self.assertEqual(args.downsample, '100k')

    def test_default_quantize_off(self):
        """Test that --quantize defaults to 'off'."""
        args = self.parser.parse_args([
            '--input-pkl', str(self.pkl_file),
            '--out-dir', str(self.temp_path),
            '--seq-id', 'v_1784',
            '--frames', '0:10',
            '--branches', str(self.branches_file)
        ])
        self.assertEqual(args.quantize, 'off')

    def test_default_dry_run_false(self):
        """Test that --dry-run defaults to False."""
        args = self.parser.parse_args([
            '--input-pkl', str(self.pkl_file),
            '--out-dir', str(self.temp_path),
            '--seq-id', 'v_1784',
            '--frames', '0:10',
            '--branches', str(self.branches_file)
        ])
        self.assertFalse(args.dry_run)

    def test_downsample_50k_option(self):
        """Test --downsample 50k option."""
        args = self.parser.parse_args([
            '--input-pkl', str(self.pkl_file),
            '--out-dir', str(self.temp_path),
            '--seq-id', 'v_1784',
            '--frames', '0:10',
            '--downsample', '50k',
            '--branches', str(self.branches_file)
        ])
        self.assertEqual(args.downsample, '50k')

    def test_quantize_fp16_option(self):
        """Test --quantize fp16 option."""
        args = self.parser.parse_args([
            '--input-pkl', str(self.pkl_file),
            '--out-dir', str(self.temp_path),
            '--seq-id', 'v_1784',
            '--frames', '0:10',
            '--quantize', 'fp16',
            '--branches', str(self.branches_file)
        ])
        self.assertEqual(args.quantize, 'fp16')

    def test_quantize_int16_option(self):
        """Test --quantize int16 option."""
        args = self.parser.parse_args([
            '--input-pkl', str(self.pkl_file),
            '--out-dir', str(self.temp_path),
            '--seq-id', 'v_1784',
            '--frames', '0:10',
            '--quantize', 'int16',
            '--branches', str(self.branches_file)
        ])
        self.assertEqual(args.quantize, 'int16')

    def test_dry_run_flag(self):
        """Test --dry-run flag sets True."""
        args = self.parser.parse_args([
            '--input-pkl', str(self.pkl_file),
            '--out-dir', str(self.temp_path),
            '--seq-id', 'v_1784',
            '--frames', '0:10',
            '--dry-run',
            '--branches', str(self.branches_file)
        ])
        self.assertTrue(args.dry_run)

    def test_invalid_downsample_choice(self):
        """Test that invalid --downsample choice fails."""
        with self.assertRaises(SystemExit):
            self.parser.parse_args([
                '--input-pkl', str(self.pkl_file),
                '--out-dir', str(self.temp_path),
                '--seq-id', 'v_1784',
                '--frames', '0:10',
                '--downsample', '75k',
                '--branches', str(self.branches_file)
            ])

    def test_invalid_quantize_choice(self):
        """Test that invalid --quantize choice fails."""
        with self.assertRaises(SystemExit):
            self.parser.parse_args([
                '--input-pkl', str(self.pkl_file),
                '--out-dir', str(self.temp_path),
                '--seq-id', 'v_1784',
                '--frames', '0:10',
                '--quantize', 'float32',
                '--branches', str(self.branches_file)
            ])


class TestArgumentValidation(unittest.TestCase):
    """Test semantic validation of arguments."""

    def setUp(self):
        """Set up test fixtures with temporary files."""
        self.temp_dir = tempfile.TemporaryDirectory()
        self.temp_path = Path(self.temp_dir.name)

        # Create dummy PKL and branches files
        self.pkl_file = self.temp_path / 'data.pkl'
        self.branches_file = self.temp_path / 'branches.json'
        self.pkl_file.touch()
        self.branches_file.touch()

    def tearDown(self):
        """Clean up temporary files."""
        self.temp_dir.cleanup()

    def test_nonexistent_input_pkl_fails(self):
        """Test that nonexistent input PKL file fails validation."""
        parser = pkl2web.create_parser()
        args = parser.parse_args([
            '--input-pkl', '/nonexistent/data.pkl',
            '--out-dir', str(self.temp_path),
            '--seq-id', 'v_1784',
            '--frames', '0:10',
            '--branches', str(self.branches_file)
        ])
        error = pkl2web.validate_args(args)
        self.assertIsNotNone(error)
        self.assertIn('not found', error)

    def test_nonexistent_branches_fails(self):
        """Test that nonexistent branches file fails validation."""
        parser = pkl2web.create_parser()
        args = parser.parse_args([
            '--input-pkl', str(self.pkl_file),
            '--out-dir', str(self.temp_path),
            '--seq-id', 'v_1784',
            '--frames', '0:10',
            '--branches', '/nonexistent/branches.json'
        ])
        error = pkl2web.validate_args(args)
        self.assertIsNotNone(error)
        self.assertIn('not found', error)

    def test_valid_args_pass(self):
        """Test that valid arguments pass validation."""
        parser = pkl2web.create_parser()
        args = parser.parse_args([
            '--input-pkl', str(self.pkl_file),
            '--out-dir', str(self.temp_path),
            '--seq-id', 'v_1784',
            '--frames', '0:100',
            '--branches', str(self.branches_file)
        ])
        error = pkl2web.validate_args(args)
        self.assertIsNone(error)

    def test_invalid_frame_format_no_colon(self):
        """Test that frames without colon fails."""
        parser = pkl2web.create_parser()
        args = parser.parse_args([
            '--input-pkl', str(self.pkl_file),
            '--out-dir', str(self.temp_path),
            '--seq-id', 'v_1784',
            '--frames', '0-100',
            '--branches', str(self.branches_file)
        ])
        error = pkl2web.validate_args(args)
        self.assertIsNotNone(error)
        self.assertIn('format', error.lower())

    def test_invalid_frame_format_non_integer(self):
        """Test that non-integer frames fail."""
        parser = pkl2web.create_parser()
        args = parser.parse_args([
            '--input-pkl', str(self.pkl_file),
            '--out-dir', str(self.temp_path),
            '--seq-id', 'v_1784',
            '--frames', 'a:b',
            '--branches', str(self.branches_file)
        ])
        error = pkl2web.validate_args(args)
        self.assertIsNotNone(error)
        self.assertIn('integer', error.lower())

    def test_invalid_frame_range_start_greater_than_end(self):
        """Test that start > end fails."""
        parser = pkl2web.create_parser()
        args = parser.parse_args([
            '--input-pkl', str(self.pkl_file),
            '--out-dir', str(self.temp_path),
            '--seq-id', 'v_1784',
            '--frames', '100:50',
            '--branches', str(self.branches_file)
        ])
        error = pkl2web.validate_args(args)
        self.assertIsNotNone(error)
        self.assertIn('start', error.lower())

    def test_invalid_frame_negative_start(self):
        """Test that negative frame index fails."""
        parser = pkl2web.create_parser()
        # argparse will reject "-1:100" as it interprets -1 as a flag
        with self.assertRaises(SystemExit):
            parser.parse_args([
                '--input-pkl', str(self.pkl_file),
                '--out-dir', str(self.temp_path),
                '--seq-id', 'v_1784',
                '--frames', '-1:100',
                '--branches', str(self.branches_file)
            ])

    def test_valid_frame_range(self):
        """Test that valid frame ranges pass."""
        parser = pkl2web.create_parser()
        test_cases = ['0:10', '0:100', '50:100', '1:1']
        for frames in test_cases:
            args = parser.parse_args([
                '--input-pkl', str(self.pkl_file),
                '--out-dir', str(self.temp_path),
                '--seq-id', 'v_1784',
                '--frames', frames,
                '--branches', str(self.branches_file)
            ])
            error = pkl2web.validate_args(args)
            self.assertIsNone(error, f"Valid frame range {frames} failed: {error}")


class TestMainFunction(unittest.TestCase):
    """Test main() function and exit codes."""

    def setUp(self):
        """Set up test fixtures with temporary files."""
        self.temp_dir = tempfile.TemporaryDirectory()
        self.temp_path = Path(self.temp_dir.name)

        # Create valid PKL file with minimal frame data
        self.pkl_file = self.temp_path / 'data.pkl'
        import numpy as np
        minimal_pkl = [{
            'frame_id': '000000',
            'points': np.array([[0, 0, 0, 0]], dtype=np.float32)
        }]
        with open(self.pkl_file, 'wb') as f:
            pickle.dump(minimal_pkl, f)

        # Create valid branches JSON file
        self.branches_file = self.temp_path / 'branches.json'
        branches_config = {'DSVT_Voxel': {}}
        with open(self.branches_file, 'w') as f:
            json.dump(branches_config, f)

    def tearDown(self):
        """Clean up temporary files."""
        self.temp_dir.cleanup()

    def test_main_with_valid_args(self):
        """Test that main() returns 0 with valid arguments."""
        with patch.object(sys, 'argv', [
            'pkl2web.py',
            '--input-pkl', str(self.pkl_file),
            '--out-dir', str(self.temp_path),
            '--seq-id', 'v_1784',
            '--frames', '0:10',
            '--branches', str(self.branches_file),
            '--dry-run'
        ]):
            exit_code = pkl2web.main()
            self.assertEqual(exit_code, 0)

    def test_main_with_invalid_args_returns_nonzero(self):
        """Test that main() returns non-zero with invalid arguments."""
        with patch.object(sys, 'argv', [
            'pkl2web.py',
            '--input-pkl', '/nonexistent/data.pkl',
            '--out-dir', str(self.temp_path),
            '--seq-id', 'v_1784',
            '--frames', '0:10',
            '--branches', str(self.branches_file)
        ]):
            exit_code = pkl2web.main()
            self.assertNotEqual(exit_code, 0)

    def test_main_with_missing_required_arg(self):
        """Test that main() handles missing required arguments."""
        with patch.object(sys, 'argv', [
            'pkl2web.py',
            '--input-pkl', str(self.pkl_file),
            '--out-dir', str(self.temp_path),
            '--seq-id', 'v_1784'
            # Missing --frames and --branches
        ]):
            with self.assertRaises(SystemExit):
                pkl2web.main()


if __name__ == '__main__':
    unittest.main()
