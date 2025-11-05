---
tags: [assignment, uow, agent/work-assigner]
unit_id: "U15"
project: "[[01-Projects/AGILE3D-Demo]]"
status: "ready"
created: "2025-11-01"
links:
  se_work_log: "[[SE-Log-U15]]"
---

# UoW Assignment — U15

- Project: [[01-Projects/AGILE3D-Demo]]
- SE Work Log: [[SE-Log-U15]]
- Daily note: [[2025-11-01]]

## Task Overview
Implement a minimal HTTP server stub for local/staging metrics collection. Listens at `http://localhost:8787/metrics`, validates JSON payloads (≤5 KB), logs metrics, and returns 200 on success or 400 on validation failure. CORS restricted to localhost in dev.

## Success Criteria
- [ ] Listens at `http://localhost:8787/metrics`; accepts valid payloads 200
- [ ] Rejects invalid/oversized payloads 400; applies local throttle 429
- [ ] No credentials; CORS restricted to localhost
- [ ] Logs payloads with timestamps; no PII exposure
- [ ] Manual curl tests verify endpoints

## Constraints and Guardrails
- ≤3 files, ≤250 LOC total
- Use Express.js or Fastify for simplicity
- No database; just log to console/file
- No commits unless explicitly instructed

## Dependencies
- None

## Files to Edit or Create
- `tools/metrics-stub/server.ts`
- `tools/metrics-stub/package.json`
- `tools/metrics-stub/README.md`

## Implementation Steps
1. Create Node.js HTTP server with POST `/metrics` endpoint
2. Parse JSON; validate schema (required fields); cap size ≤5 KB
3. Log valid payloads; reject invalid with 400
4. Set CORS headers for localhost:4200
5. Document local throttle behavior (429 after N requests/min)

## Commands to Run
```bash
cd tools/metrics-stub
npm install
npm start
# In another terminal:
curl -X POST http://localhost:8787/metrics -H "Content-Type: application/json" -d '{"ts": 123, "event": "heartbeat"}'
```

## Artifacts to Return
- Unified diff for all 3 files
- curl test results showing 200/400/429 responses
- Sample log output
