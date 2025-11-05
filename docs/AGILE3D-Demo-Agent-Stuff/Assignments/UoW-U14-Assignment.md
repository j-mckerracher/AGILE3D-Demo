---
tags: [assignment, uow, agent/work-assigner]
unit_id: "U14"
project: "[[01-Projects/AGILE3D-Demo]]"
status: "ready"
created: "2025-11-01"
links:
  se_work_log: "[[SE-Log-U14]]"
---

# UoW Assignment — U14

- Project: [[01-Projects/AGILE3D-Demo]]
- SE Work Log: [[SE-Log-U14]]
- Daily note: [[2025-11-01]]

## Task Overview
Implement a client-side telemetry service that sends sampled metrics to the backend `/metrics` endpoint with throttling (≤1 event per 5s) and opt-out support. Metrics include frame id, latency, buffer state, misses, fps, and user agent.

## Success Criteria
- [ ] Client throttle ≤1 event/5s plus all errors/misses
- [ ] Payload matches schema; 5xx retried with backoff
- [ ] Query flag `?metrics=off` disables service; config flag respected
- [ ] Unit tests verify throttle/backoff logic and schema serialization
- [ ] Manual test verifies network requests in DevTools

## Constraints and Guardrails
- ≤2 files, ≤300 LOC total
- No PII; UA included; opt-out honored
- Use RxJS for observable-based queuing
- No commits unless explicitly instructed

## Dependencies
- [[U16]] (ConfigModule)

## Files to Edit or Create
- `apps/web/src/app/services/metrics/metrics.service.ts`
- `apps/web/src/app/services/metrics/metrics.service.spec.ts`

## Implementation Steps
1. Inject ConfigService; read `metrics.enabled`, `metrics.url`, `metrics.sampleSec`
2. Create queue with RxJS; throttle to 1 event per `sampleSec` (default 5s)
3. Serialize payload: {ts, sessionId, seqId, frameId, event, bytes, latencyMs, fps, buffer, misses, ua}
4. POST to `/metrics`; retry 5xx with backoff
5. Honor `?metrics=off` query flag to skip entirely

## Commands to Run
```bash
npm test -- metrics.service.spec.ts --watch=false
ng serve # then check DevTools Network tab for POST /metrics
```

## Artifacts to Return
- Unified diff for both files
- Test output showing throttle verification
- DevTools screenshot showing POST requests
