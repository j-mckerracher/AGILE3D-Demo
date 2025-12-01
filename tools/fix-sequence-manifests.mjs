#!/usr/bin/env node
/**
 * Fix sequence manifest files to only list branches with actual detection files.
 *
 * This script:
 * 1. Scans each sequence directory for actual detection files
 * 2. Updates manifest.json to only list existing branches
 * 3. Removes references to non-existent detection files from frame URLs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const SEQUENCES_DIR = path.join(projectRoot, 'src/assets/data/sequences');

/**
 * Get all unique branch names from detection files in a directory
 */
function getAvailableBranches(framesDir) {
  if (!fs.existsSync(framesDir)) {
    console.error(`Frames directory not found: ${framesDir}`);
    return [];
  }

  const files = fs.readdirSync(framesDir);
  const branches = new Set();

  files.forEach(file => {
    // Match pattern: *.det.BRANCH_NAME.json
    const match = file.match(/\.det\.([^.]+)\.json$/);
    if (match) {
      branches.add(match[1]);
    }
  });

  return Array.from(branches).sort();
}

/**
 * Fix a single manifest file
 */
function fixManifest(sequenceDir) {
  const manifestPath = path.join(sequenceDir, 'manifest.json');
  const framesDir = path.join(sequenceDir, 'frames');

  console.log(`\nProcessing: ${path.basename(sequenceDir)}`);

  if (!fs.existsSync(manifestPath)) {
    console.error(`  Manifest not found: ${manifestPath}`);
    return false;
  }

  // Read current manifest
  const manifestContent = fs.readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(manifestContent);

  // Get actual available branches
  const availableBranches = getAvailableBranches(framesDir);
  console.log(`  Available branches: ${availableBranches.join(', ')}`);
  console.log(`  Manifest currently lists: ${manifest.branches.join(', ')}`);

  // Update top-level branches array
  const oldBranches = manifest.branches;
  manifest.branches = availableBranches;

  // Update each frame's detection URLs
  let framesUpdated = 0;
  manifest.frames.forEach((frame, index) => {
    if (!frame.urls || !frame.urls.det) {
      return;
    }

    const oldDet = frame.urls.det;
    const newDet = {};

    // Only keep detection URLs for branches that actually exist
    availableBranches.forEach(branch => {
      if (oldDet[branch]) {
        newDet[branch] = oldDet[branch];
      } else {
        // Construct expected path
        newDet[branch] = `frames/${frame.id}.det.${branch}.json`;
      }
    });

    frame.urls.det = newDet;
    framesUpdated++;
  });

  // Write updated manifest
  const updatedContent = JSON.stringify(manifest, null, 2);
  fs.writeFileSync(manifestPath, updatedContent + '\n', 'utf8');

  console.log(`  ✅ Updated ${framesUpdated} frames`);
  console.log(`  ✅ Removed ${oldBranches.length - availableBranches.length} non-existent branches`);

  return true;
}

/**
 * Main function
 */
function main() {
  console.log('='.repeat(60));
  console.log('Fixing sequence manifest files');
  console.log('='.repeat(60));

  if (!fs.existsSync(SEQUENCES_DIR)) {
    console.error(`Sequences directory not found: ${SEQUENCES_DIR}`);
    process.exit(1);
  }

  // Get all sequence directories
  const sequences = fs.readdirSync(SEQUENCES_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => path.join(SEQUENCES_DIR, dirent.name));

  console.log(`Found ${sequences.length} sequence(s)`);

  let successCount = 0;
  sequences.forEach(sequenceDir => {
    if (fixManifest(sequenceDir)) {
      successCount++;
    }
  });

  console.log('\n' + '='.repeat(60));
  console.log(`✅ Successfully updated ${successCount}/${sequences.length} manifests`);
  console.log('='.repeat(60));
}

main();
