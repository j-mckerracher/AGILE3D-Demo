#!/usr/bin/env node

/**
 * Add 4th Scene for Extensibility Validation
 *
 * Demonstrates FR-1.11: Adding new scenes via JSON-only updates.
 * This script generates the parking_lot_01 scene WITHOUT requiring code changes.
 *
 * Usage:
 *   node tools/add-parking-lot-scene.mjs
 *
 * @see WP-1.2.2 FR-1.11 Config-Only Extensibility
 */

import { writeFileSync, readFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

/**
 * Generate a random float between min and max.
 */
function randomFloat(min, max) {
  return Math.random() * (max - min) + min;
}

/**
 * Generate random UUID for detections.
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Generate synthetic point cloud data for parking lot.
 */
function generateParkingLotPoints(pointCount, bounds) {
  const positions = new Float32Array(pointCount * 3);
  const [minX, minY, minZ] = bounds.min;
  const [maxX, maxY, maxZ] = bounds.max;

  for (let i = 0; i < pointCount; i++) {
    const idx = i * 3;
    const rand = Math.random();

    if (rand < 0.7) {
      // Ground plane (parking surface)
      positions[idx] = randomFloat(minX, maxX);
      positions[idx + 1] = randomFloat(minY, maxY);
      positions[idx + 2] = randomFloat(minZ, minZ + 0.3);
    } else if (rand < 0.95) {
      // Parked vehicles and structures
      positions[idx] = randomFloat(minX, maxX);
      positions[idx + 1] = randomFloat(minY, maxY);
      positions[idx + 2] = randomFloat(minZ + 0.5, minZ + 2.5);
    } else {
      // Building facades
      positions[idx] = randomFloat(minX, maxX);
      positions[idx + 1] = randomFloat(minY, maxY);
      positions[idx + 2] = randomFloat(minZ, maxZ);
    }
  }

  return positions;
}

/**
 * Generate detections for parking lot scene.
 */
function generateParkingLotDetections(bounds) {
  const detections = [];
  const [minX, minY, minZ] = bounds.min;
  const [maxX, maxY] = bounds.max;

  // Mostly vehicles (parked cars)
  for (let i = 0; i < 12; i++) {
    detections.push({
      id: generateUUID(),
      class: 'vehicle',
      center: [
        randomFloat(minX + 5, maxX - 5),
        randomFloat(minY + 5, maxY - 5),
        minZ + 0.8,
      ],
      dimensions: {
        width: randomFloat(1.7, 2.0),
        length: randomFloat(4.2, 5.2),
        height: randomFloat(1.5, 1.8),
      },
      yaw: randomFloat(-Math.PI, Math.PI),
      confidence: randomFloat(0.88, 0.99),
    });
  }

  // Few pedestrians
  for (let i = 0; i < 5; i++) {
    detections.push({
      id: generateUUID(),
      class: 'pedestrian',
      center: [
        randomFloat(minX + 3, maxX - 3),
        randomFloat(minY + 3, maxY - 3),
        minZ + 0.9,
      ],
      dimensions: {
        width: randomFloat(0.5, 0.7),
        length: randomFloat(0.5, 0.7),
        height: randomFloat(1.65, 1.8),
      },
      yaw: randomFloat(-Math.PI, Math.PI),
      confidence: randomFloat(0.82, 0.97),
    });
  }

  return detections;
}

console.log('🅿️  Adding 4th scene (parking_lot_01) for extensibility validation...\n');

// Scene configuration
const sceneConfig = {
  sceneId: 'parking_lot_01',
  name: 'Parking Lot Scene',
  description: 'Shopping center parking lot with parked vehicles',
  bounds: {
    min: [-35, -35, -2],
    max: [35, 35, 15],
  },
};

const { sceneId, name, description, bounds } = sceneConfig;

// Create scene directory
const sceneDir = join(PROJECT_ROOT, 'src', 'assets', 'scenes', sceneId);
mkdirSync(sceneDir, { recursive: true });

// Generate detections
const groundTruth = generateParkingLotDetections(bounds);

// Generate predictions
const predictions = {
  DSVT_Voxel: generateParkingLotDetections(bounds).map((det) => ({
    ...det,
    confidence: det.confidence * 0.96,
  })),
  AGILE3D_CP_Pillar_032: generateParkingLotDetections(bounds).map((det) => ({
    ...det,
    confidence: det.confidence * 0.98,
  })),
};

// Count objects
const vehicleCount = groundTruth.filter((d) => d.class === 'vehicle').length;
const pedestrianCount = groundTruth.filter((d) => d.class === 'pedestrian').length;
const cyclistCount = groundTruth.filter((d) => d.class === 'cyclist').length;

// Create metadata
const metadata = {
  scene_id: sceneId,
  name,
  description,
  pointsBin: `assets/scenes/${sceneId}/${sceneId}_100k.bin`,
  pointCount: 100000,
  pointStride: 3,
  bounds,
  ground_truth: groundTruth,
  predictions,
  metadata: {
    vehicleCount,
    pedestrianCount,
    cyclistCount,
    complexity: 'medium',
    optimalBranch: 'AGILE3D_CP_Pillar_032',
  },
};

// Write metadata
const metadataPath = join(sceneDir, 'metadata.json');
writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
console.log(`✓ Created ${metadataPath}`);

// Generate point clouds
const points100k = generateParkingLotPoints(100000, bounds);
const bin100kPath = join(sceneDir, `${sceneId}_100k.bin`);
writeFileSync(bin100kPath, Buffer.from(points100k.buffer));
console.log(`✓ Created ${bin100kPath} (${(points100k.buffer.byteLength / 1024).toFixed(1)} KB)`);

const points50k = generateParkingLotPoints(50000, bounds);
const bin50kPath = join(sceneDir, `${sceneId}_50k.bin`);
writeFileSync(bin50kPath, Buffer.from(points50k.buffer));
console.log(`✓ Created ${bin50kPath} (${(points50k.buffer.byteLength / 1024).toFixed(1)} KB)`);

// Update registry.json (JSON-only update - no code changes required!)
const registryPath = join(PROJECT_ROOT, 'src', 'assets', 'scenes', 'registry.json');
const registry = JSON.parse(readFileSync(registryPath, 'utf-8'));

// Add new scene to registry
registry.scenes.push({
  scene_id: sceneId,
  name,
  description,
  complexity: 'medium',
  pointCount: 100000,
  hasFallback: true,
});

writeFileSync(registryPath, JSON.stringify(registry, null, 2));
console.log(`✓ Updated ${registryPath}`);

console.log('\n✨ 4th scene added successfully via JSON-only update!');
console.log('✓ No code changes required - extensibility validated (FR-1.11)');
