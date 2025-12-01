/**
 * generate-real-data.mjs
 *
 * Extracts real test data from LookupTable.xlsx and generates:
 * - src/assets/data/baseline.json (DSVT-Voxel-020)
 * - src/assets/data/branches.json (4 CenterPoint Pillar models)
 *
 * Usage: npm run gen:real-data
 */

import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXCEL_PATH = path.join(__dirname, '../LookupTable.xlsx');
const BASELINE_OUTPUT = path.join(__dirname, '../src/assets/data/baseline.json');
const BRANCHES_OUTPUT = path.join(__dirname, '../src/assets/data/branches.json');

/**
 * Parse detailed AP string to extract LEVEL_2 AP values
 * Format: "VEHICLE_LEVEL_1/AP: 0.6515 \nVEHICLE_LEVEL_1/APH: 0.6449 \nVEHICLE_LEVEL_2/AP: 0.5740 ..."
 */
function parseDetailedAP(apString) {
  const vehicleL2Match = apString.match(/VEHICLE_LEVEL_2\/AP:\s*([\d.]+)/);
  const pedestrianL2Match = apString.match(/PEDESTRIAN_LEVEL_2\/AP:\s*([\d.]+)/);
  const cyclistL2Match = apString.match(/CYCLIST_LEVEL_2\/AP:\s*([\d.]+)/);

  return {
    vehicleL2: vehicleL2Match ? parseFloat(vehicleL2Match[1]) * 100 : null,
    pedestrianL2: pedestrianL2Match ? parseFloat(pedestrianL2Match[1]) * 100 : null,
    cyclistL2: cyclistL2Match ? parseFloat(cyclistL2Match[1]) * 100 : null,
  };
}

/**
 * Derive scene-specific accuracy from detailed AP breakdown
 */
function deriveSceneAccuracy(vehicleL2, pedestrianL2, cyclistL2) {
  return {
    'vehicle-heavy': vehicleL2 * 0.7 + pedestrianL2 * 0.15 + cyclistL2 * 0.15,
    'pedestrian-heavy': pedestrianL2 * 0.7 + vehicleL2 * 0.15 + cyclistL2 * 0.15,
    mixed: vehicleL2 * 0.4 + pedestrianL2 * 0.3 + cyclistL2 * 0.3,
  };
}

/**
 * Calculate contention multipliers from CP models
 * Returns average multipliers for 20%, 50%, 90% contention
 */
function calculateContentionMultipliers(cpModels) {
  const multipliers = { light: [], moderate: [], intense: [] };

  cpModels.forEach((model) => {
    const base = model.testLat0;
    if (base && model.testLat20 && model.testLat50 && model.testLat90) {
      multipliers.light.push(model.testLat20 / base);
      multipliers.moderate.push(model.testLat50 / base);
      multipliers.intense.push(model.testLat90 / base);
    }
  });

  const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;

  return {
    light: avg(multipliers.light),
    moderate: avg(multipliers.moderate),
    intense: avg(multipliers.intense),
  };
}

/**
 * Main data extraction function
 */
function extractData() {
  console.log('Reading Excel file...');
  const workbook = XLSX.readFile(EXCEL_PATH);

  // Sheet 1: Latency and contention data
  const sheet1 = workbook.Sheets[workbook.SheetNames[0]];
  const sheet1Data = XLSX.utils.sheet_to_json(sheet1, { header: 1 });

  // Sheet 2: Detailed model information
  const sheet2 = workbook.Sheets[workbook.SheetNames[1]];
  const sheet2Data = XLSX.utils.sheet_to_json(sheet2, { header: 1 });

  console.log('Extracting CenterPoint Pillar models...');

  // Extract CP Pillar models (rows 1-4 in Sheet 1, indices 0-3 in Sheet 2)
  const cpModels = [];
  for (let i = 1; i <= 4; i++) {
    const row1 = sheet1Data[i];
    const row2 = sheet2Data[i]; // Sheet 2 has header, so indices align

    const branchName = row1[1]?.toString().replace("',", '').replace("'", '');
    const voxelSize = parseFloat(row2[2]);
    const index = parseInt(row2[0]);

    cpModels.push({
      branchName,
      voxelSize,
      index,
      // Test set latencies (0%, 20%, 50%, 90%)
      testLat0: parseFloat(row1[12]),
      testLat0Std: parseFloat(row1[13]),
      testLat20: parseFloat(row1[14]),
      testLat20Std: parseFloat(row1[15]),
      testLat50: parseFloat(row1[16]),
      testLat50Std: parseFloat(row1[17]),
      testLat90: parseFloat(row1[18]),
      testLat90Std: parseFloat(row1[19]),
      // Test set accuracy
      testL1Acc: parseFloat(row1[21]),
      testL2Acc: parseFloat(row1[20]),
      // Detailed AP breakdown from Sheet 2
      detailedAP: row2[17],
    });
  }

  console.log('Extracting DSVT-Voxel-020 baseline...');

  // Extract DSVT-Voxel-020 (row 63 in Sheet 1)
  const dsvtRow = sheet1Data[63];
  const dsvtBaseline = {
    branchName: dsvtRow[1]?.toString().replace("',", '').replace("'", ''),
    testLat0: parseFloat(dsvtRow[12]),
    testL1Acc: parseFloat(dsvtRow[21]),
    testL2Acc: parseFloat(dsvtRow[20]),
  };

  console.log('Calculating contention multipliers...');
  const multipliers = calculateContentionMultipliers(cpModels);
  console.log('  Light (20%):', multipliers.light.toFixed(3));
  console.log('  Moderate (50%):', multipliers.moderate.toFixed(3));
  console.log('  Intense (90%):', multipliers.intense.toFixed(3));

  // Extrapolate baseline latencies
  const baselineStdMultiplier = 0.04; // 4% of mean as std estimate
  const baseline = {
    branch_id: 'DSVT_Voxel_020',
    name: 'DSVT Voxel 0.20m (Baseline)',
    controlKnobs: {
      encodingFormat: 'voxel',
      spatialResolution: 0.2,
      spatialEncoding: 'DV',
      featureExtractor: 'transformer',
      detectionHead: 'center',
    },
    performance: {
      memoryFootprint: 8.5,
      latency: {
        noContention: {
          mean: parseFloat(dsvtBaseline.testLat0.toFixed(2)),
          std: parseFloat((dsvtBaseline.testLat0 * baselineStdMultiplier).toFixed(2)),
        },
        lightContention: {
          mean: parseFloat((dsvtBaseline.testLat0 * multipliers.light).toFixed(2)),
          std: parseFloat((dsvtBaseline.testLat0 * multipliers.light * baselineStdMultiplier).toFixed(2)),
        },
        moderateContention: {
          mean: parseFloat((dsvtBaseline.testLat0 * multipliers.moderate).toFixed(2)),
          std: parseFloat((dsvtBaseline.testLat0 * multipliers.moderate * baselineStdMultiplier).toFixed(2)),
        },
        intenseContention: {
          mean: parseFloat((dsvtBaseline.testLat0 * multipliers.intense).toFixed(2)),
          std: parseFloat((dsvtBaseline.testLat0 * multipliers.intense * baselineStdMultiplier).toFixed(2)),
        },
      },
      accuracy: {
        'vehicle-heavy': parseFloat(dsvtBaseline.testL2Acc.toFixed(2)),
        'pedestrian-heavy': parseFloat(dsvtBaseline.testL2Acc.toFixed(2)),
        mixed: parseFloat(dsvtBaseline.testL2Acc.toFixed(2)),
      },
    },
    modelFamily: 'DSVT',
  };

  console.log('Generating branch configurations...');
  const branches = cpModels.map((model) => {
    const { vehicleL2, pedestrianL2, cyclistL2 } = parseDetailedAP(model.detailedAP);
    const accuracy = deriveSceneAccuracy(vehicleL2, pedestrianL2, cyclistL2);

    const branchId = `CP_Pillar_${Math.round(model.voxelSize * 100).toString().padStart(3, '0')}`;

    return {
      branch_id: branchId,
      name: `CenterPoint Pillar ${model.voxelSize}m`,
      controlKnobs: {
        encodingFormat: 'pillar',
        spatialResolution: model.voxelSize,
        spatialEncoding: 'HV',
        featureExtractor: 'sparse_cnn',
        detectionHead: 'anchor',
      },
      performance: {
        memoryFootprint: 4.0 - (model.voxelSize - 0.24) * 0.5, // Smaller voxels = more memory
        latency: {
          noContention: {
            mean: parseFloat(model.testLat0.toFixed(2)),
            std: parseFloat(model.testLat0Std.toFixed(2)),
          },
          lightContention: {
            mean: parseFloat(model.testLat20.toFixed(2)),
            std: parseFloat(model.testLat20Std.toFixed(2)),
          },
          moderateContention: {
            mean: parseFloat(model.testLat50.toFixed(2)),
            std: parseFloat(model.testLat50Std.toFixed(2)),
          },
          intenseContention: {
            mean: parseFloat(model.testLat90.toFixed(2)),
            std: parseFloat(model.testLat90Std.toFixed(2)),
          },
        },
        accuracy: {
          'vehicle-heavy': parseFloat(accuracy['vehicle-heavy'].toFixed(2)),
          'pedestrian-heavy': parseFloat(accuracy['pedestrian-heavy'].toFixed(2)),
          mixed: parseFloat(accuracy.mixed.toFixed(2)),
        },
      },
      modelFamily: 'CenterPoint',
    };
  });

  return { baseline, branches };
}

/**
 * Main execution
 */
function main() {
  try {
    const { baseline, branches } = extractData();

    console.log('\nWriting baseline.json...');
    fs.writeFileSync(BASELINE_OUTPUT, JSON.stringify(baseline, null, 2));
    console.log(`✓ Written to ${BASELINE_OUTPUT}`);

    console.log('\nWriting branches.json...');
    const branchesData = { branches };
    fs.writeFileSync(BRANCHES_OUTPUT, JSON.stringify(branchesData, null, 2));
    console.log(`✓ Written to ${BRANCHES_OUTPUT}`);

    console.log('\n=== Summary ===');
    console.log(`Baseline: ${baseline.name}`);
    console.log(`  Latency (0%): ${baseline.performance.latency.noContention.mean}ms`);
    console.log(`  Latency (90%): ${baseline.performance.latency.intenseContention.mean}ms`);
    console.log(`  Accuracy: ${baseline.performance.accuracy.mixed}%`);
    console.log(`\nBranches: ${branches.length}`);
    branches.forEach((b) => {
      console.log(`  ${b.name}:`);
      console.log(`    Latency (0%): ${b.performance.latency.noContention.mean}ms`);
      console.log(`    Latency (90%): ${b.performance.latency.intenseContention.mean}ms`);
      console.log(`    Accuracy: ${b.performance.accuracy.mixed.toFixed(2)}%`);
    });

    console.log('\n✓ Data generation complete!');
    console.log('Next step: npm run validate:data');
  } catch (error) {
    console.error('Error generating data:', error);
    process.exit(1);
  }
}

main();
