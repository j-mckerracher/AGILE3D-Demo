---
tags: [assignment, uow, agent/work-assigner]
unit_id: "U16"
project: "[[01-Projects/AGILE3D-Demo]]"
status: "ready"
created: "2025-11-01"
links:
  se_work_log: "[[SE-Log-U16]]"
---

# UoW Assignment — U16

- Project: [[01-Projects/AGILE3D-Demo]]
- SE Work Log: [[SE-Log-U16]]
- Daily note: [[2025-11-01]]

## Task Overview
Implement a configuration service that loads `runtime-config.json` at app boot and exposes typed `get()` with defaults. Precedence: env defaults < runtime-config.json < query flags. Enables runtime configuration without rebuilding.

## Success Criteria
- [ ] Values reflect precedence; query `?metrics=off` disables MetricsService
- [ ] runtime-config.json includes: manifestBaseUrl, sequences, branches, timeouts, retries, prefetch, concurrency, scoreDefault, labelsDefault, metrics
- [ ] Baseline branch default is `DSVT_Voxel`; Active selectable set aligns with config
- [ ] Unit tests verify precedence and typing
- [ ] Manual test toggles flags at runtime and confirms effect

## Constraints and Guardrails
- ≤4 files, ≤300 LOC total
- Asset served with app; cache-busting handled by build
- Typed service (TypeScript interfaces for all config keys)
- No commits unless explicitly instructed

## Dependencies
- None

## Files to Edit or Create
- `apps/web/src/app/services/config/config.module.ts`
- `apps/web/src/app/services/config/config.service.ts`
- `apps/web/src/assets/runtime-config.json`
- `apps/web/src/app/services/config/config.service.spec.ts`

## Implementation Steps
1. Define TypeScript interfaces for config schema
2. Load `runtime-config.json` via HTTP at APP_INITIALIZER
3. Merge with environment defaults and query parameters
4. Expose `config.get(key: string, defaultValue?: any)` method
5. Register ConfigModule in AppModule

## Commands to Run
```bash
npm test -- config.service.spec.ts --watch=false
ng serve
# In browser: console.log(config.get('manifestBaseUrl'))
```

## Artifacts to Return
- Unified diff for all 4 files
- Test output showing precedence tests
- runtime-config.json example
