import express, { Request, Response } from 'express';

/**
 * Minimal HTTP server stub for local/staging metrics collection.
 * Listens at http://localhost:8787/metrics
 * Validates JSON payloads (≤5 KB), logs metrics, and enforces rate limiting.
 */

const app = express();
const PORT = 8787;
const MAX_PAYLOAD_SIZE = 5 * 1024; // 5 KB in bytes
const THROTTLE_LIMIT = 10; // max 10 requests per minute
const THROTTLE_WINDOW = 60 * 1000; // 1 minute in ms

// Track request counts for throttling per IP
const requestCounts: Record<string, { count: number; resetTime: number }> = {};

/**
 * Middleware to parse raw body and track payload size
 */
app.use(express.json({ limit: '5KB' }));

/**
 * CORS middleware: restrict to localhost
 */
app.use((req: Request, res: Response, next: Function) => {
  const origin = req.get('origin');
  // Allow localhost on any port for dev flexibility
  if (origin && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

/**
 * Error handler for payload too large
 */
app.use((err: any, req: Request, res: Response, next: Function) => {
  if (err.status === 413 || err.message.includes('entity too large')) {
    return res.status(400).json({
      error: `Payload exceeds max size: ${MAX_PAYLOAD_SIZE} bytes`,
    });
  }
  next(err);
});

/**
 * Throttling middleware: track request rate per client IP
 */
app.use((req: Request, res: Response, next: Function) => {
  const clientIp = req.ip || 'unknown';
  const now = Date.now();
  const record = requestCounts[clientIp];

  if (!record || now > record.resetTime) {
    // New window or first request
    requestCounts[clientIp] = { count: 1, resetTime: now + THROTTLE_WINDOW };
    next();
  } else if (record.count < THROTTLE_LIMIT) {
    record.count++;
    next();
  } else {
    // Rate limit exceeded
    res.status(429).json({
      error: 'Too many requests',
      retryAfter: Math.ceil((record.resetTime - now) / 1000),
    });
  }
});

/**
 * POST /metrics endpoint
 * Validates JSON payload and logs metrics
 */
app.post('/metrics', (req: Request, res: Response) => {
  try {
    const payload = req.body;

    // Validate that payload is an object
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'Invalid payload: must be a JSON object' });
    }

    // Validate required fields (minimal schema)
    if (!('ts' in payload) || !('event' in payload)) {
      return res.status(400).json({
        error: 'Invalid payload: missing required fields (ts, event)',
      });
    }

    // Check payload size in bytes
    const payloadSize = Buffer.byteLength(JSON.stringify(payload));
    if (payloadSize > MAX_PAYLOAD_SIZE) {
      return res.status(400).json({
        error: `Payload exceeds max size: ${payloadSize} > ${MAX_PAYLOAD_SIZE} bytes`,
      });
    }

    // Log valid payload with timestamp (no PII)
    const logEntry = {
      timestamp: new Date().toISOString(),
      event: payload.event,
      ts: payload.ts,
      size: payloadSize,
    };
    console.log('[METRICS]', JSON.stringify(logEntry));

    // Return 200 OK
    return res.status(200).json({ status: 'ok', received: payload.event });
  } catch (err) {
    // Handle JSON parse errors
    return res.status(400).json({ error: 'Failed to parse JSON' });
  }
});

/**
 * Health check endpoint
 */
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'healthy' });
});

/**
 * Start server
 */
app.listen(PORT, () => {
  console.log(`Metrics server listening on http://localhost:${PORT}/metrics`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
