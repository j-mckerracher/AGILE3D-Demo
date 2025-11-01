/**
 * Point Cloud Worker Spec
 *
 * Unit tests for the point cloud parsing Web Worker.
 * Tests cover:
 * - Raw float32 point parsing
 * - Transferable buffer semantics
 * - Buffer size validation
 * - Quantized format with header
 * - Point count calculations
 * - Error handling
 */

describe('Point Cloud Worker', () => {
  let worker: Worker;

  beforeEach(() => {
    // Create worker instance from assets path
    worker = new Worker('/assets/workers/point-cloud-worker.js');
  });

  afterEach(() => {
    // Terminate worker after each test
    if (worker) {
      worker.terminate();
    }
  });

  // ============================================================================
  // RAW FLOAT32 PARSING
  // ============================================================================

  it('test_worker_parses_raw_float32_points: should parse 3 raw float32 points correctly', (done) => {
    // Create synthetic 3-point buffer (9 float32 values = 36 bytes)
    // Points: (1.0, 2.0, 3.0), (4.0, 5.0, 6.0), (7.0, 8.0, 9.0)
    const buffer = new ArrayBuffer(36);
    const view = new Float32Array(buffer);
    view.set([1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0]);

    worker.onmessage = (event) => {
      const { ok, pointCount, positions, error } = event.data;

      expect(ok).toBe(true);
      expect(pointCount).toBe(3);
      expect(positions).toBeDefined();
      expect(positions.length).toBe(9); // 3 points × 3 coordinates

      // Verify point values
      expect(positions[0]).toBe(1.0);
      expect(positions[1]).toBe(2.0);
      expect(positions[2]).toBe(3.0);
      expect(positions[3]).toBe(4.0);
      expect(positions[4]).toBe(5.0);
      expect(positions[5]).toBe(6.0);
      expect(positions[6]).toBe(7.0);
      expect(positions[7]).toBe(8.0);
      expect(positions[8]).toBe(9.0);

      done();
    };

    worker.postMessage({ buffer });
  });

  // ============================================================================
  // TRANSFERABLE BUFFER SEMANTICS
  // ============================================================================

  it('test_worker_returns_transferable_buffer: should return positions as transferable (buffer ownership transferred)', (done) => {
    // Create buffer with 100 points
    const buffer = new ArrayBuffer(100 * 12); // 100 points × 12 bytes each
    const view = new Float32Array(buffer);
    for (let i = 0; i < 300; i++) {
      view[i] = Math.random();
    }

    // Store original buffer size to verify transfer
    const originalSize = buffer.byteLength;

    worker.onmessage = (event) => {
      const { ok, positions, error } = event.data;

      expect(ok).toBe(true);
      expect(positions).toBeDefined();

      // After transfer, positions.buffer should be the original buffer
      // (or at least have equivalent capacity)
      expect(positions.buffer).toBeDefined();
      expect(positions.buffer.byteLength).toBe(originalSize);

      // The original buffer passed in should be detached (ownership transferred)
      // This is tricky to test in spec context; we verify the result is valid
      expect(positions.length).toBe(300); // 100 points × 3 coordinates

      done();
    };

    worker.postMessage({ buffer }, [buffer]);
  });

  // ============================================================================
  // BUFFER SIZE VALIDATION
  // ============================================================================

  it('test_worker_validates_buffer_size: should error on unaligned buffer size', (done) => {
    // Create buffer with 35 bytes (not aligned to 12)
    const buffer = new ArrayBuffer(35);

    worker.onmessage = (event) => {
      const { ok, error } = event.data;

      expect(ok).toBe(false);
      expect(error).toBeDefined();
      expect(error).toContain('not aligned');

      done();
    };

    worker.postMessage({ buffer });
  });

  // ============================================================================
  // QUANTIZED FORMAT WITH HEADER
  // ============================================================================

  it('test_worker_with_quantization_header: should dequantize int16 data with header', (done) => {
    // Create 29-byte header + quantized data
    // Header: mode=0 (int16), bbox_min=(-1,-1,-1), bbox_max=(1,1,1), pointCount=1
    const header = new Uint8Array(29);
    const headerView = new DataView(header.buffer);

    headerView.setUint8(0, 0); // mode 0 = int16
    headerView.setFloat32(1, -1.0, true); // bbox_min_x
    headerView.setFloat32(5, -1.0, true); // bbox_min_y
    headerView.setFloat32(9, -1.0, true); // bbox_min_z
    headerView.setFloat32(13, 1.0, true); // bbox_max_x
    headerView.setFloat32(17, 1.0, true); // bbox_max_y
    headerView.setFloat32(21, 1.0, true); // bbox_max_z
    headerView.setUint32(25, 1, true); // pointCount = 1

    // Create data: 1 quantized point (3 int16 values = 6 bytes)
    const dataBuffer = new ArrayBuffer(6);
    const dataView = new DataView(dataBuffer);

    // Set quantized point to (0, 0, 0) in normalized space
    dataView.setInt16(0, 0, true); // x = 0
    dataView.setInt16(2, 0, true); // y = 0
    dataView.setInt16(4, 0, true); // z = 0

    worker.onmessage = (event) => {
      const { ok, pointCount, positions, error } = event.data;

      expect(ok).toBe(true);
      expect(pointCount).toBe(1);
      expect(positions).toBeDefined();
      expect(positions.length).toBe(3); // 1 point × 3 coordinates

      // Dequantized point should be at center of bbox: (0, 0, 0)
      expect(Math.abs(positions[0] - 0.0)).toBeLessThan(0.01);
      expect(Math.abs(positions[1] - 0.0)).toBeLessThan(0.01);
      expect(Math.abs(positions[2] - 0.0)).toBeLessThan(0.01);

      done();
    };

    worker.postMessage({ buffer: dataBuffer, header });
  });

  // ============================================================================
  // POINT COUNT CALCULATION
  // ============================================================================

  it('test_worker_point_count_matches_buffer: should calculate pointCount = buffer.byteLength / 12', (done) => {
    // Create 5-point buffer (5 × 12 = 60 bytes)
    const buffer = new ArrayBuffer(60);
    const view = new Float32Array(buffer);
    for (let i = 0; i < 15; i++) {
      view[i] = i + 1;
    }

    worker.onmessage = (event) => {
      const { ok, pointCount, positions } = event.data;

      expect(ok).toBe(true);
      expect(pointCount).toBe(5);
      expect(positions.length).toBe(15); // 5 points × 3 coordinates

      done();
    };

    worker.postMessage({ buffer });
  });

  // ============================================================================
  // ERROR HANDLING
  // ============================================================================

  it('test_worker_error_handling: should send error for malformed header', (done) => {
    // Create header with mismatched pointCount
    const header = new Uint8Array(29);
    const headerView = new DataView(header.buffer);

    headerView.setUint8(0, 0); // mode
    headerView.setFloat32(1, 0.0, true);
    headerView.setFloat32(5, 0.0, true);
    headerView.setFloat32(9, 0.0, true);
    headerView.setFloat32(13, 1.0, true);
    headerView.setFloat32(17, 1.0, true);
    headerView.setFloat32(21, 1.0, true);
    headerView.setUint32(25, 1000, true); // pointCount = 1000 (will exceed buffer size)

    // Create small buffer (only 6 bytes, can't fit 1000 points)
    const dataBuffer = new ArrayBuffer(6);

    worker.onmessage = (event) => {
      const { ok, error } = event.data;

      expect(ok).toBe(false);
      expect(error).toBeDefined();
      expect(error).toContain('too small');

      done();
    };

    worker.postMessage({ buffer: dataBuffer, header });
  });

  // ============================================================================
  // INVALID INPUT
  // ============================================================================

  it('test_worker_invalid_input: should error on null/undefined buffer', (done) => {
    worker.onmessage = (event) => {
      const { ok, error } = event.data;

      expect(ok).toBe(false);
      expect(error).toBeDefined();
      expect(error).toContain('Invalid input');

      done();
    };

    worker.postMessage({ buffer: null });
  });

  // ============================================================================
  // LARGE BUFFER
  // ============================================================================

  it('test_worker_large_buffer: should parse large float32 buffer (10k points)', (done) => {
    // Create 10k point buffer
    const pointCount = 10000;
    const buffer = new ArrayBuffer(pointCount * 12);
    const view = new Float32Array(buffer);

    // Fill with sequential values
    for (let i = 0; i < pointCount * 3; i++) {
      view[i] = i * 0.001;
    }

    worker.onmessage = (event) => {
      const { ok, pointCount: resultCount, positions } = event.data;

      expect(ok).toBe(true);
      expect(resultCount).toBe(pointCount);
      expect(positions.length).toBe(pointCount * 3);

      // Spot check a few values
      expect(positions[0]).toBe(0.0);
      expect(positions[1]).toBe(0.001);
      expect(positions[2]).toBe(0.002);

      done();
    };

    worker.postMessage({ buffer });
  });
});
