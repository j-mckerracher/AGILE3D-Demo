#!/usr/bin/env node

/**
 * Asset Budget Validation Script
 *
 * Validates that scene assets meet size requirements:
 * - NFR-1.6: Total compressed assets ≤ 8MB
 * - NFR-1.7: Per-scene compressed assets ≤ 2.5MB
 *
 * Uses Brotli compression to simulate production serving.
 * Generates validation report for CI/CD integration.
 *
 * Usage:
 *   node tools/validate-asset-budgets.mjs
 *
 * Exit codes:
 *   0 - All budgets met
 *   1 - Budget violations detected
 *
 * @see WP-1.2.2 Scene Data & Parsing Infrastructure
 * @see NFR-1.6, NFR-1.7
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { brotliCompressSync, constants } from 'zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

// Budget thresholds (in bytes)
const MAX_SCENE_SIZE_MB = 2.5;
const MAX_TOTAL_SIZE_MB = 8.0;
const MAX_SCENE_SIZE_BYTES = MAX_SCENE_SIZE_MB * 1024 * 1024;
const MAX_TOTAL_SIZE_BYTES = MAX_TOTAL_SIZE_MB * 1024 * 1024;

/**
 * Format bytes as human-readable string.
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Compress data with Brotli.
 */
function compressWithBrotli(data) {
  return brotliCompressSync(data, {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: 11, // Max compression
    },
  });
}

/**
 * Get all .bin files in a directory.
 */
function getBinFiles(dir) {
  try {
    return readdirSync(dir)
      .filter((file) => file.endsWith('.bin'))
      .map((file) => join(dir, file));
  } catch (error) {
    return [];
  }
}

/**
 * Calculate compressed size for a file.
 */
function getCompressedSize(filePath) {
  try {
    const data = readFileSync(filePath);
    const compressed = compressWithBrotli(data);
    return {
      original: data.length,
      compressed: compressed.length,
      ratio: (compressed.length / data.length) * 100,
    };
  } catch (error) {
    console.error(`Error processing ${filePath}: ${error.message}`);
    return { original: 0, compressed: 0, ratio: 0 };
  }
}

/**
 * Validate scene assets.
 */
function validateScene(sceneDir) {
  const sceneName = sceneDir.split('/').pop();
  const binFiles = getBinFiles(sceneDir);

  if (binFiles.length === 0) {
    return {
      sceneName,
      files: [],
      totalOriginal: 0,
      totalCompressed: 0,
      passed: true,
      warning: 'No .bin files found',
    };
  }

  const fileResults = binFiles.map((file) => {
    const fileName = file.split('/').pop();
    const sizes = getCompressedSize(file);
    return {
      fileName,
      ...sizes,
    };
  });

  const totalOriginal = fileResults.reduce((sum, f) => sum + f.original, 0);
  const totalCompressed = fileResults.reduce((sum, f) => sum + f.compressed, 0);
  const passed = totalCompressed <= MAX_SCENE_SIZE_BYTES;

  return {
    sceneName,
    files: fileResults,
    totalOriginal,
    totalCompressed,
    passed,
    exceedsBy: passed ? 0 : totalCompressed - MAX_SCENE_SIZE_BYTES,
  };
}

/**
 * Main validation function.
 */
function validateAssets() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║         Asset Budget Validation (Brotli Compression)      ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  const scenesDir = join(PROJECT_ROOT, 'src', 'assets', 'scenes');
  const sceneDirs = readdirSync(scenesDir)
    .map((name) => join(scenesDir, name))
    .filter((path) => {
      try {
        return statSync(path).isDirectory();
      } catch {
        return false;
      }
    });

  const results = sceneDirs.map(validateScene);

  // Print individual scene results
  console.log('Scene-by-Scene Analysis:');
  console.log('─'.repeat(80));

  let allPassed = true;

  results.forEach((result) => {
    const status = result.passed ? '✓' : '✗';
    const statusColor = result.passed ? '' : '';

    console.log(`\n${status} ${result.sceneName}`);

    if (result.warning) {
      console.log(`  ⚠ ${result.warning}`);
      return;
    }

    result.files.forEach((file) => {
      console.log(
        `  ${file.fileName.padEnd(35)} ${formatBytes(file.original).padStart(12)} → ${formatBytes(file.compressed).padStart(12)} (${file.ratio.toFixed(1)}%)`
      );
    });

    console.log(`  ${'Total:'.padEnd(35)} ${formatBytes(result.totalOriginal).padStart(12)} → ${formatBytes(result.totalCompressed).padStart(12)}`);
    console.log(`  Budget: ${formatBytes(result.totalCompressed)} / ${formatBytes(MAX_SCENE_SIZE_BYTES)}`);

    if (!result.passed) {
      console.log(`  ⚠ EXCEEDS BUDGET by ${formatBytes(result.exceedsBy)}`);
      allPassed = false;
    }
  });

  // Calculate total
  const grandTotalOriginal = results.reduce((sum, r) => sum + r.totalOriginal, 0);
  const grandTotalCompressed = results.reduce((sum, r) => sum + r.totalCompressed, 0);
  const totalPassed = grandTotalCompressed <= MAX_TOTAL_SIZE_BYTES;

  console.log('\n' + '═'.repeat(80));
  console.log('\nOverall Summary:');
  console.log('─'.repeat(80));
  console.log(`Total Original Size:   ${formatBytes(grandTotalOriginal)}`);
  console.log(`Total Compressed Size: ${formatBytes(grandTotalCompressed)}`);
  console.log(`Total Budget:          ${formatBytes(MAX_TOTAL_SIZE_BYTES)}`);
  console.log(`Compression Ratio:     ${((grandTotalCompressed / grandTotalOriginal) * 100).toFixed(1)}%`);

  if (!totalPassed) {
    const exceeds = grandTotalCompressed - MAX_TOTAL_SIZE_BYTES;
    console.log(`\n✗ TOTAL BUDGET EXCEEDED by ${formatBytes(exceeds)}`);
    allPassed = false;
  }

  // Create validation report
  const report = {
    timestamp: new Date().toISOString(),
    budgets: {
      perSceneMB: MAX_SCENE_SIZE_MB,
      totalMB: MAX_TOTAL_SIZE_MB,
    },
    scenes: results.map((r) => ({
      sceneName: r.sceneName,
      files: r.files,
      totalOriginalBytes: r.totalOriginal,
      totalCompressedBytes: r.totalCompressed,
      totalCompressedMB: r.totalCompressed / (1024 * 1024),
      passed: r.passed,
      exceedsByBytes: r.exceedsBy || 0,
    })),
    summary: {
      totalScenesChecked: results.length,
      totalOriginalBytes: grandTotalOriginal,
      totalCompressedBytes: grandTotalCompressed,
      totalCompressedMB: grandTotalCompressed / (1024 * 1024),
      compressionRatio: (grandTotalCompressed / grandTotalOriginal) * 100,
      allScenesPassed: results.every((r) => r.passed),
      totalBudgetPassed: totalPassed,
      overallPassed: allPassed && totalPassed,
    },
  };

  const reportPath = join(PROJECT_ROOT, 'src', 'assets', 'data', 'validation-report.json');
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n✓ Validation report saved to: ${reportPath}`);

  // Final status
  console.log('\n' + '═'.repeat(80));
  if (allPassed && totalPassed) {
    console.log('✓ All asset budgets met!');
    console.log('═'.repeat(80) + '\n');
    return 0;
  } else {
    console.log('✗ Asset budget validation FAILED');
    console.log('═'.repeat(80) + '\n');
    return 1;
  }
}

// Run validation
const exitCode = validateAssets();
process.exit(exitCode);
