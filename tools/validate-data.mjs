#!/usr/bin/env node

import Ajv from 'ajv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ajv = new Ajv({ allErrors: true, strict: false });

// Paths
const SCHEMA_DIR = path.join(__dirname, '../assets/data/schemas');
const DATA_DIR = path.join(__dirname, '../assets/data');
const REPORT_FILE = path.join(__dirname, '../assets/data/validation-report.json');

// Schema and data file mappings
const validations = [
  {
    schemaFile: 'branch-config.schema.json',
    dataFile: 'agile3d-branches.json',
    isArray: true,
  },
  {
    schemaFile: 'baseline-performance.schema.json',
    dataFile: 'baseline-performance.json',
    isArray: false,
  },
  {
    schemaFile: 'accuracy-vs-contention.schema.json',
    dataFile: 'accuracy-vs-contention.json',
    isArray: false,
  },
  {
    schemaFile: 'pareto-frontier.schema.json',
    dataFile: 'pareto-frontier.json',
    isArray: false,
  },
];

const results = {
  timestamp: new Date().toISOString(),
  summary: {
    total: validations.length,
    passed: 0,
    failed: 0,
  },
  validations: [],
};

console.log('🔍 Starting data validation...\n');

for (const { schemaFile, dataFile, isArray } of validations) {
  const schemaPath = path.join(SCHEMA_DIR, schemaFile);
  const dataPath = path.join(DATA_DIR, dataFile);

  console.log(`Validating ${dataFile} against ${schemaFile}...`);

  try {
    // Load schema
    const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
    const schema = JSON.parse(schemaContent);

    // Load data
    const dataContent = fs.readFileSync(dataPath, 'utf-8');
    const data = JSON.parse(dataContent);

    // Compile schema
    const validate = ajv.compile(schema);

    // Validate data
    let valid;
    if (isArray && Array.isArray(data)) {
      // Validate each item in array
      valid = data.every((item, index) => {
        const itemValid = validate(item);
        if (!itemValid) {
          console.error(`  ❌ Item ${index} validation failed:`, ajv.errorsText(validate.errors));
        }
        return itemValid;
      });
    } else {
      valid = validate(data);
    }

    if (valid) {
      console.log(`  ✅ ${dataFile} is valid\n`);
      results.summary.passed++;
      results.validations.push({
        dataFile,
        schemaFile,
        status: 'PASS',
        errors: [],
      });
    } else {
      console.error(`  ❌ ${dataFile} validation failed:`, ajv.errorsText(validate.errors));
      console.error('  Errors:', JSON.stringify(validate.errors, null, 2), '\n');
      results.summary.failed++;
      results.validations.push({
        dataFile,
        schemaFile,
        status: 'FAIL',
        errors: validate.errors || [],
      });
    }
  } catch (error) {
    console.error(`  ❌ Error validating ${dataFile}:`, error.message, '\n');
    results.summary.failed++;
    results.validations.push({
      dataFile,
      schemaFile,
      status: 'ERROR',
      errors: [{ message: error.message }],
    });
  }
}

// Write validation report
fs.writeFileSync(REPORT_FILE, JSON.stringify(results, null, 2));

console.log('📊 Validation Summary:');
console.log(`  Total: ${results.summary.total}`);
console.log(`  Passed: ${results.summary.passed}`);
console.log(`  Failed: ${results.summary.failed}`);
console.log(`\n📄 Detailed report saved to: ${REPORT_FILE}`);

// Exit with error code if any validation failed
process.exit(results.summary.failed > 0 ? 1 : 0);
