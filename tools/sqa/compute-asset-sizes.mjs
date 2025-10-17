#!/usr/bin/env node
/**
 * Compute compressed sizes (gzip, brotli) for scene binary assets.
 * Outputs CSV at evidence/wp-1.2.2/asset-sizes.csv
 */
import { readdirSync, statSync, writeFileSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { gzipSync, constants as zconsts } from 'zlib';
import zlib from 'zlib';

const ROOT = process.cwd();
const SCENES_DIR = join(ROOT, 'src', 'assets', 'scenes');
const OUT_DIR = join(ROOT, 'evidence', 'wp-1.2.2');
const OUT_CSV = join(OUT_DIR, 'asset-sizes.csv');

function listSceneBinFiles(dir) {
  const dirs = readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory());
  const files = [];
  for (const d of dirs) {
    const sceneDir = join(dir, d.name);
    const entries = readdirSync(sceneDir, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isFile()) continue;
      if (/_((50|100)k)\.bin$/.test(e.name)) {
        files.push(join(sceneDir, e.name));
      }
    }
  }
  return files;
}

function brotliCompress(buf) {
  return zlib.brotliCompressSync(buf, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
    },
  });
}

function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const files = listSceneBinFiles(SCENES_DIR);
  let total = 0;
  let totalGz = 0;
  let totalBr = 0;
  let csv = 'file,bytes,gzip_bytes,brotli_bytes\n';
  for (const f of files) {
    const raw = readFileSync(f);
    const stat = statSync(f);
    const gz = gzipSync(raw, { level: zconsts.Z_BEST_COMPRESSION });
    const br = brotliCompress(raw);
    total += stat.size;
    totalGz += gz.length;
    totalBr += br.length;
    csv += `${f},${stat.size},${gz.length},${br.length}\n`;
  }
  csv += `TOTAL,${total},${totalGz},${totalBr}\n`;
  writeFileSync(OUT_CSV, csv);
  console.log(`Wrote ${OUT_CSV}`);
  console.log(csv);
}

main();
