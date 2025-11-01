# Metrics Stub Server

Minimal HTTP server for local metrics collection at `http://localhost:8787/metrics`.

## Setup

```bash
npm install
npm start
```

## Endpoints

**POST /metrics** – Submit metrics payload
- Required fields: `ts` (number), `event` (string)
- Max size: 5 KB
- Response: 200 on success, 400 on validation failure, 429 on rate limit

**GET /health** – Health check; returns `{"status": "healthy"}`

## Examples

Success:
```bash
curl -X POST http://localhost:8787/metrics \
  -H "Content-Type: application/json" \
  -d '{"ts": 1729352400000, "event": "heartbeat"}'
# {"status": "ok", "received": "heartbeat"}
```

Invalid (missing required field):
```bash
curl -X POST http://localhost:8787/metrics \
  -H "Content-Type: application/json" \
  -d '{"invalid": "payload"}'
# 400: {"error": "Invalid payload: missing required fields (ts, event)"}
```

Oversized:
```bash
curl -X POST http://localhost:8787/metrics -d '{"ts": 1, "event": "x", "data": "...6KB..."}'
# 400: {"error": "Payload exceeds max size: 5120 bytes"}
```

## Features

- **Validation**: JSON schema (ts, event required), max 5 KB payload
- **Rate Limiting**: 10 requests/min per client IP, returns 429 after limit
- **CORS**: Restricted to localhost (any port)
- **Logging**: Logs valid payloads with ISO timestamp, no PII
- **No Credentials**: No authentication or secrets stored

## Payload Schema

```json
{
  "ts": 1729352400000,
  "event": "heartbeat",
  "duration": 1250,
  "path": "/dashboard"
}
```

Only `ts` and `event` are required; additional fields OK if within size limit.

## Development

```bash
npm run dev    # Hot-reload with ts-node-dev
npm start      # Production mode
```

## Rate Limiting Behavior

- Limit: 10 requests per 60-second window per client IP
- Response: 429 with `retryAfter` field (seconds until reset)
