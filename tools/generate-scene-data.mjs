#!/usr/bin/env node

/**
 * Generate Synthetic Point Cloud Scene Data
 *
 * Creates binary point cloud files (.bin) and metadata JSON for demo scenes.
 * Generates realistic-looking 3D point clouds with appropriate distributions
 * for vehicle-heavy, pedestrian-heavy, and mixed urban scenarios.
 *
 * Usage:
 *   node tools/generate-scene-data.mjs
 *
 * Output:
 *   - src/assets/scenes/{scene_id}/metadata.json
 *   - src/assets/scenes/{scene_id}/{scene_id}_100k.bin
 *   - src/assets/scenes/{scene_id}/{scene_id}_50k.bin
 *
 * @see WP-1.2.2 Scene Data & Parsing Infrastructure
 */

import { writeFileSync, mkdirSync } from 'fs';
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
 * Generate synthetic point cloud data.
 *
 * Creates a realistic point cloud with ground plane, buildings, and objects.
 *
 * @param {number} pointCount - Number of points to generate
 * @param {Object} bounds - Scene bounds {min: [x,y,z], max: [x,y,z]}
 * @param {string} sceneType - Type of scene ('vehicle', 'pedestrian', 'mixed')
 * @returns {Float32Array} Point positions [x,y,z, x,y,z, ...]
 */
function generatePointCloud(pointCount, bounds, sceneType) {
  const positions = new Float32Array(pointCount * 3);
  const [minX, minY, minZ] = bounds.min;
  const [maxX, maxY, maxZ] = bounds.max;

  for (let i = 0; i < pointCount; i++) {
    const idx = i * 3;

    // Generate points with realistic distribution
    // 60% ground plane, 30% vertical structures, 10% objects
    const rand = Math.random();

    if (rand < 0.6) {
      // Ground plane
      positions[idx] = randomFloat(minX, maxX);
      positions[idx + 1] = randomFloat(minY, maxY);
      positions[idx + 2] = randomFloat(minZ, minZ + 0.5);
    } else if (rand < 0.9) {
      // Vertical structures (buildings, poles)
      positions[idx] = randomFloat(minX, maxX);
      positions[idx + 1] = randomFloat(minY, maxY);
      positions[idx + 2] = randomFloat(minZ, maxZ);
    } else {
      // Objects (vehicles, pedestrians)
      positions[idx] = randomFloat(minX, maxX);
      positions[idx + 1] = randomFloat(minY, maxY);
      positions[idx + 2] = randomFloat(minZ + 0.5, minZ + 3.0);
    }
  }

  return positions;
}

/**
 * Generate detection annotations.
 *
 * @param {string} sceneType - Type of scene
 * @param {Object} bounds - Scene bounds
 * @returns {Array} Array of Detection objects
 */
function generateDetections(sceneType, bounds) {
  const detections = [];
  const [minX, minY, minZ] = bounds.min;
  const [maxX, maxY] = bounds.max;

  let vehicleCount = 0;
  let pedestrianCount = 0;
  let cyclistCount = 0;

  // Generate different counts based on scene type
  switch (sceneType) {
    case 'vehicle':
      vehicleCount = 15;
      pedestrianCount = 3;
      cyclistCount = 1;
      break;
    case 'pedestrian':
      vehicleCount = 2;
      pedestrianCount = 20;
      cyclistCount = 3;
      break;
    case 'mixed':
      vehicleCount = 8;
      pedestrianCount = 10;
      cyclistCount = 4;
      break;
  }

  // Generate vehicles
  for (let i = 0; i < vehicleCount; i++) {
    detections.push({
      id: generateUUID(),
      class: 'vehicle',
      center: [
        randomFloat(minX + 5, maxX - 5),
        randomFloat(minY + 5, maxY - 5),
        minZ + 0.8,
      ],
      dimensions: {
        width: randomFloat(1.6, 2.0),
        length: randomFloat(4.0, 5.0),
        height: randomFloat(1.4, 1.8),
      },
      yaw: randomFloat(-Math.PI, Math.PI),
      confidence: randomFloat(0.85, 0.99),
    });
  }

  // Generate pedestrians
  for (let i = 0; i < pedestrianCount; i++) {
    detections.push({
      id: generateUUID(),
      class: 'pedestrian',
      center: [
        randomFloat(minX + 2, maxX - 2),
        randomFloat(minY + 2, maxY - 2),
        minZ + 0.9,
      ],
      dimensions: {
        width: randomFloat(0.5, 0.7),
        length: randomFloat(0.5, 0.7),
        height: randomFloat(1.6, 1.85),
      },
      yaw: randomFloat(-Math.PI, Math.PI),
      confidence: randomFloat(0.80, 0.98),
    });
  }

  // Generate cyclists
  for (let i = 0; i < cyclistCount; i++) {
    detections.push({
      id: generateUUID(),
      class: 'cyclist',
      center: [
        randomFloat(minX + 2, maxX - 2),
        randomFloat(minY + 2, maxY - 2),
        minZ + 1.0,
      ],
      dimensions: {
        width: randomFloat(0.6, 0.8),
        length: randomFloat(1.6, 1.9),
        height: randomFloat(1.6, 1.8),
      },
      yaw: randomFloat(-Math.PI, Math.PI),
      confidence: randomFloat(0.75, 0.96),
    });
  }

  return detections;
}

/**
 * Create a scene with metadata and point cloud files.
 *
 * @param {Object} sceneConfig - Scene configuration
 */
function createScene(sceneConfig) {
  const { sceneId, name, description, sceneType, bounds } = sceneConfig;

  console.log(`\nGenerating scene: ${sceneId}`);

  // Create scene directory
  const sceneDir = join(PROJECT_ROOT, 'src', 'assets', 'scenes', sceneId);
  mkdirSync(sceneDir, { recursive: true });

  // Generate detections
  const groundTruth = generateDetections(sceneType, bounds);

  // Generate predictions (simulate two models)
  const predictions = {
    DSVT_Voxel: generateDetections(sceneType, bounds).map((det) => ({
      ...det,
      confidence: det.confidence * 0.95, // Slightly lower confidence
    })),
    AGILE3D_CP_Pillar_032: generateDetections(sceneType, bounds).map((det) => ({
      ...det,
      confidence: det.confidence * 0.97,
    })),
  };

  // Count objects
  const vehicleCount = groundTruth.filter((d) => d.class === 'vehicle').length;
  const pedestrianCount = groundTruth.filter(
    (d) => d.class === 'pedestrian'
  ).length;
  const cyclistCount = groundTruth.filter((d) => d.class === 'cyclist').length;

  // Determine complexity
  const totalObjects = vehicleCount + pedestrianCount + cyclistCount;
  let complexity = 'medium';
  if (totalObjects < 10) complexity = 'low';
  else if (totalObjects > 20) complexity = 'high';

  // Determine optimal branch
  let optimalBranch = 'AGILE3D_CP_Pillar_032';
  if (sceneType === 'vehicle') optimalBranch = 'DSVT_Voxel';

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
      complexity,
      optimalBranch,
    },
  };

  // Write metadata JSON
  const metadataPath = join(sceneDir, 'metadata.json');
  writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  console.log(`  ✓ Wrote ${metadataPath}`);

  // Generate 100k point cloud
  const points100k = generatePointCloud(100000, bounds, sceneType);
  const bin100kPath = join(sceneDir, `${sceneId}_100k.bin`);
  writeFileSync(bin100kPath, Buffer.from(points100k.buffer));
  console.log(
    `  ✓ Wrote ${bin100kPath} (${(points100k.buffer.byteLength / 1024).toFixed(1)} KB)`
  );

  // Generate 50k fallback point cloud
  const points50k = generatePointCloud(50000, bounds, sceneType);
  const bin50kPath = join(sceneDir, `${sceneId}_50k.bin`);
  writeFileSync(bin50kPath, Buffer.from(points50k.buffer));
  console.log(
    `  ✓ Wrote ${bin50kPath} (${(points50k.buffer.byteLength / 1024).toFixed(1)} KB)`
  );
}

// Scene configurations
const scenes = [
  {
    sceneId: 'vehicle_heavy_01',
    name: 'Highway Traffic Scene',
    description: 'Dense highway traffic with multiple vehicles',
    sceneType: 'vehicle',
    bounds: {
      min: [-50, -50, -2],
      max: [50, 50, 10],
    },
  },
  {
    sceneId: 'pedestrian_heavy_01',
    name: 'Busy Sidewalk Scene',
    description: 'Urban sidewalk with heavy pedestrian traffic',
    sceneType: 'pedestrian',
    bounds: {
      min: [-40, -40, -2],
      max: [40, 40, 8],
    },
  },
  {
    sceneId: 'mixed_urban_01',
    name: 'Mixed Urban Intersection',
    description: 'Urban intersection with vehicles, pedestrians, and cyclists',
    sceneType: 'mixed',
    bounds: {
      min: [-45, -45, -2],
      max: [45, 45, 12],
    },
  },
];

// Generate all scenes
console.log('Generating synthetic scene data...');
scenes.forEach((scene) => createScene(scene));
console.log('\n✓ All scenes generated successfully!');
