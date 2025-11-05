---
tags:
  - assignment
  - uow
  - agent/work-assigner
unit_id: U11
project: "[[01-Projects/AGILE3D-Demo]]"
status: done
created: 2025-11-01
links:
  se_work_log: "[[SE-Log-U11]]"
---

# UoW Assignment — U11

- Project: [[01-Projects/AGILE3D-Demo]]
- SE Work Log: [[SE-Log-U11]]
- Daily note: [[2025-11-01]]

## Task Overview
Implement THREE.js instanced geometry utilities for efficient rendering of hundreds of bounding boxes (≥500) at ≥55 fps. Supports per-branch coloring (baseline vs active branch) and matrix buffer updates without geometry reallocation.

## Success Criteria
- [ ] Can render ≥500 bounding boxes at ≥55 fps on sample data
- [ ] API allows per-branch color/material configuration
- [ ] Instanced rendering uses matrix transformation buffers (no geometry duplication)
- [ ] Unit tests verify transform matrices and performance budgets
- [ ] Manual test renders both branches in DualViewer (U12)

## Constraints and Guardrails
- No scope creep; modify only listed files
- ≤2 files, ≤250 LOC total
- Use THREE.js InstancedBufferGeometry and InstancedBufferAttribute
- No commits unless explicitly instructed

## Dependencies
- None (geometry utility library)

## Files to Edit or Create
- `/home/josh/Code/AGILE3D-Demo/libs/utils-geometry/src/lib/bbox-instancing.ts` (new)
- `/home/josh/Code/AGILE3D-Demo/libs/utils-geometry/src/lib/bbox-instancing.spec.ts` (new)

## Implementation Steps
1. Implement `createInstancedBboxGeometry(boxCount: number)`:
   - Create single box geometry (unit cube, 1×1×1)
   - Set up InstancedBufferGeometry with per-instance matrix buffer
   - Return mesh ready for rendering 500+ boxes

2. Implement `updateInstanceMatrices(boxes: {x,y,z,l,w,h,yaw}[], matrices: Float32Array)`:
   - Convert each box to 4×4 transformation matrix
   - Store in instance buffer for GPU update

3. Write performance tests and validate ≥55 fps render time

## Commands to Run
```bash
cd /home/josh/Code/AGILE3D-Demo
npm test -- libs/utils-geometry/src/lib/bbox-instancing.spec.ts --watch=false
```

## Artifacts to Return
- Unified diff for both files
- Test output showing ≥500 box performance
