/**
 * Point Cloud Parsing Web Worker
 *
 * Parses binary point cloud data (Float32Array) off the main thread
 * to avoid blocking the UI during large data loads.
 *
 * Protocol:
 * - Input: { arrayBuffer: ArrayBuffer, stride: number }
 * - Output: { ok: true, positions: Float32Array } or { ok: false, error: string }
 *
 * Uses transferable objects for zero-copy performance.
 */

self.addEventListener('message', (event) => {
  try {
    const { arrayBuffer, stride = 3 } = event.data;

    // Validate input
    if (!arrayBuffer || !(arrayBuffer instanceof ArrayBuffer)) {
      self.postMessage({
        ok: false,
        error: 'Invalid input: arrayBuffer must be an ArrayBuffer'
      });
      return;
    }

    if (typeof stride !== 'number' || stride <= 0) {
      self.postMessage({
        ok: false,
        error: 'Invalid input: stride must be a positive number'
      });
      return;
    }

    // Parse the buffer into Float32Array
    const positions = new Float32Array(arrayBuffer);

    // Validate stride alignment
    if (positions.length % stride !== 0) {
      self.postMessage({
        ok: false,
        error: `Data length (${positions.length}) is not aligned with stride (${stride})`
      });
      return;
    }

    // Send back the parsed positions using transferable for zero-copy
    self.postMessage(
      {
        ok: true,
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

// Signal that worker is ready
self.postMessage({ ok: true, ready: true });
