---
tags: [assignment, uow, agent/work-assigner]
unit_id: "U18"
project: "[[01-Projects/AGILE3D-Demo]]"
status: "ready"
created: "2025-11-01"
links:
  se_work_log: "[[SE-Log-U18]]"
---

# UoW Assignment — U18

- Project: [[01-Projects/AGILE3D-Demo]]
- SE Work Log: [[SE-Log-U18]]
- Daily note: [[2025-11-01]]

## Task Overview
Provide template configuration files documenting CDN headers, CORS policies, and TTL rules for S3 + CloudFront deployment. Includes cache settings (1y immutable for frames, 300s for manifests), CORS Allow-Origin for staging/prod/localhost, and guidance on signed URLs.

## Success Criteria
- [ ] Templates include: Cache-Control 1y immutable for `*.bin`, 300s for `*.json` manifests; Accept-Ranges exposed
- [ ] CORS Allow-Origin for staging/prod domains and `http://localhost:4200`; methods GET,HEAD,OPTIONS; expose `Accept-Ranges,Content-Length,Content-Range`
- [ ] Document signed URL toggle when (>1k req/min OR >75 GB/day)

## Constraints and Guardrails
- ≤2 files, ≤150 LOC total
- Templates as JSON + README documentation
- No IaC; deferred to ops
- No commits unless explicitly instructed

## Dependencies
- None

## Files to Edit or Create
- `infra/cdn/headers.json`
- `infra/cdn/README.md`

## Implementation Steps
1. Document cache policies for frames and manifests
2. Document CORS headers and methods
3. Provide examples for CloudFront behavior policies
4. Document signed URL threshold and setup guidance

## Commands to Run
```bash
curl -I https://cdn.example.com/sequences/v_1784_1828/frames/0.bin
# Verify: Cache-Control: public, max-age=31536000, immutable
```

## Artifacts to Return
- Unified diff for both files
- Example curl output showing headers
