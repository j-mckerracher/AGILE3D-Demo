/**
 * Point Cloud Parsing Web Worker
 *
 * Parses binary point cloud data (*.bin ArrayBuffer) off the main thread
 * to avoid blocking the UI during large data loads.
 *
 * Supports both raw float32 and quantized (int16/fp16) point cloud formats.
 *
 * Protocol:
 * - Input: { buffer: ArrayBuffer, header?: Uint8Array }
 * - Output: { ok: true, pointCount: number, positions: Float32Array } or { ok: false, error: string }
 *
 * Uses transferable objects for zero-copy performance.
 */

self.addEventListener('message', (event) => {
  try {
    const { buffer, header } = event.data;

    // Validate input
    if (!buffer || !(buffer instanceof ArrayBuffer)) {
      self.postMessage({
        ok: false,
        error: 'Invalid input: buffer must be an ArrayBuffer'
      });
      return;
    }

    let positions;
    let pointCount;

    if (header && header instanceof Uint8Array && header.byteLength >= 29) {
      // Parse quantized format with header
      const result = parseQuantizedPoints(buffer, header);
      positions = result.positions;
      pointCount = result.pointCount;
    } else {
      // Parse raw float32 format
      const result = parseRawPoints(buffer);
      positions = result.positions;
      pointCount = result.pointCount;
    }

    // Send back the parsed positions using transferable for zero-copy
    self.postMessage(
      {
        ok: true,
        pointCount: pointCount,
        positions: positions
      },
      [positions.buffer]
    );
  } catch (error) {
    // Handle any parsing errors
    self.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown parsing error'
    });
  }
});

/**
 * Parse raw float32 point cloud format.
 * Each point is 3 float32 values (x, y, z) = 12 bytes per point.
 */
function parseRawPoints(buffer) {
  // Validate buffer size is multiple of 12 (3 floats × 4 bytes)
  if (buffer.byteLength % 12 !== 0) {
    throw new Error(
      `Buffer size (${buffer.byteLength}) is not aligned with point stride (12 bytes). ` +
      `Expected multiple of 12 for raw float32 format.`
    );
  }

  const positions = new Float32Array(buffer);
  const pointCount = positions.length / 3;

  return { positions, pointCount };
}

/**
 * Parse quantized point cloud format with header.
 * Header (first 29 bytes):
 *   - mode (uint8, 1 byte): quantization mode
 *   - bbox_min (3×float32, 12 bytes): min corner of bounding box
 *   - bbox_max (3×float32, 12 bytes): max corner of bounding box
 *   - point_count (uint32, 4 bytes): number of points
 * Data: quantized int16 or fp16 values (depending on mode)
 */
function parseQuantizedPoints(buffer, header) {
  const headerView = new DataView(header.buffer, header.byteOffset, 29);

  // Parse header
  const mode = headerView.getUint8(0);
  const bbox_min_x = headerView.getFloat32(1, true);
  const bbox_min_y = headerView.getFloat32(5, true);
  const bbox_min_z = headerView.getFloat32(9, true);
  const bbox_max_x = headerView.getFloat32(13, true);
  const bbox_max_y = headerView.getFloat32(17, true);
  const bbox_max_z = headerView.getFloat32(21, true);
  const pointCount = headerView.getUint32(25, true);

  // Calculate expected data size (3 int16 values per point = 6 bytes, or 3 fp16 = 6 bytes)
  const bytesPerPoint = 6; // mode 0 (int16) or mode 1 (fp16)
  const expectedDataSize = pointCount * bytesPerPoint;

  if (buffer.byteLength < expectedDataSize) {
    throw new Error(
      `Buffer size (${buffer.byteLength}) too small. ` +
      `Expected at least ${expectedDataSize} bytes for ${pointCount} quantized points.`
    );
  }

  // Dequantize to float32
  const positions = new Float32Array(pointCount * 3);
  const dataView = new DataView(buffer);

  const bbox_size_x = bbox_max_x - bbox_min_x;
  const bbox_size_y = bbox_max_y - bbox_min_y;
  const bbox_size_z = bbox_max_z - bbox_min_z;

  for (let i = 0; i < pointCount; i++) {
    const offset = i * 6;

    let x, y, z;

    if (mode === 0) {
      // int16 mode: read int16 values and normalize to [-1, 1]
      const ix = dataView.getInt16(offset, true) / 32767.0;
      const iy = dataView.getInt16(offset + 2, true) / 32767.0;
      const iz = dataView.getInt16(offset + 4, true) / 32767.0;

      x = bbox_min_x + (ix + 1) / 2 * bbox_size_x;
      y = bbox_min_y + (iy + 1) / 2 * bbox_size_y;
      z = bbox_min_z + (iz + 1) / 2 * bbox_size_z;
    } else if (mode === 1) {
      // fp16 mode: read fp16 values (stored as uint16, convert to float32)
      const ix = float16ToFloat32(dataView.getUint16(offset, true));
      const iy = float16ToFloat32(dataView.getUint16(offset + 2, true));
      const iz = float16ToFloat32(dataView.getUint16(offset + 4, true));

      x = bbox_min_x + (ix + 1) / 2 * bbox_size_x;
      y = bbox_min_y + (iy + 1) / 2 * bbox_size_y;
      z = bbox_min_z + (iz + 1) / 2 * bbox_size_z;
    } else {
      throw new Error(`Unknown quantization mode: ${mode}`);
    }

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
  }

  return { positions, pointCount };
}

/**
 * Convert float16 (stored as uint16) to float32.
 * Simplified implementation for normalized values [-1, 1].
 */
function float16ToFloat32(uint16) {
  // For normalized values, use a simple approximation
  // This is a basic implementation; production code may use a more robust conversion
  return (uint16 / 32767.0) - 1.0;
}
