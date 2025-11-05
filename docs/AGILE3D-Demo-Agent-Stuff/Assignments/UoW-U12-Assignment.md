---
tags: [assignment, uow, agent/work-assigner]
unit_id: "U12"
project: "[[01-Projects/AGILE3D-Demo]]"
status: "ready"
created: "2025-11-01"
links:
  se_work_log: "[[SE-Log-U12]]"
---

# UoW Assignment — U12

- Project: [[01-Projects/AGILE3D-Demo]]
- SE Work Log: [[SE-Log-U12]]
- Daily note: [[2025-11-01]]

## Task Overview
Implement an Angular component rendering two synchronized Three.js views side-by-side for baseline and active branches. Each pane displays the same frame at the same time with shared point geometry but separate bounding box instances. Camera controls remain consistent across both views.

## Success Criteria
- [ ] Both panes update the same frame id each tick; camera controls consistent
- [ ] Sample data renders ≥55 fps average on modern laptop
- [ ] Responsive design and DPR clamp for Safari (≤1.5)
- [ ] Unit tests verify sync logic with mock services
- [ ] Manual test shows autoplay loop with both panes updating

## Constraints and Guardrails
- ≤4 files, ≤350 LOC total
- Use SceneDataService (U10) for geometry, FrameStreamService (U08) for timing
- Responsive HTML/SCSS; test on multiple devices
- No commits unless explicitly instructed

## Dependencies
- [[U10]] (SceneDataService)
- [[U11]] (BBox Instancing)
- [[U08]] (FrameStreamService)

## Files to Edit or Create
- `apps/web/src/app/features/dual-viewer/dual-viewer.component.ts`
- `apps/web/src/app/features/dual-viewer/dual-viewer.component.html`
- `apps/web/src/app/features/dual-viewer/dual-viewer.component.scss`
- `apps/web/src/app/features/dual-viewer/dual-viewer.component.spec.ts`

## Implementation Steps
1. Create component subscribing to `frameStreamService.currentFrame$`
2. Subscribe to `sceneDataService.geometry$` and `detections$`
3. Render two Three.js canvas elements side-by-side with shared geometry
4. Verify frame id sync, responsive layout, and performance ≥55 fps

## Commands to Run
```bash
cd /home/josh/Code/AGILE3D-Demo/apps/web
npm test -- dual-viewer.component.spec.ts --watch=false
ng serve
```

## Artifacts to Return
- Unified diff for all 4 files
- Test output showing sync verification
- Screenshot showing dual panes rendering
