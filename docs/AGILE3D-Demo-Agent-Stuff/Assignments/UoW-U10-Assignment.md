---
tags:
  - assignment
  - uow
  - agent/work-assigner
unit_id: U10
project: "[[01-Projects/AGILE3D-Demo]]"
status: done
created: 2025-11-01
links:
  se_work_log: "[[SE-Log-U10]]"
---

# UoW Assignment — U10

- Project: [[01-Projects/AGILE3D-Demo]]
- SE Work Log: [[SE-Log-U10]]
- Daily note: [[2025-11-01]]

## Task Overview
Implement a scene data management service that applies parsed point clouds to THREE.BufferGeometry with in-place attribute reuse (reallocate only on growth), applies score and label filters to detection data, and manages coordinate system transformations (Z-up yaw). This service bridges frame data from FrameStreamService to the 3D renderer, optimizing memory and rendering performance.

## Success Criteria
- [ ] Geometry patches without reallocation when `pointCount` stable (≤10% variance)
- [ ] Filters correctly include classes vehicle/pedestrian/cyclist with default score ≥0.7
- [ ] Coordinate transformations (Z-up yaw) applied consistently to bounding boxes
- [ ] Unit tests verify buffer reuse, filter correctness, and transformations with synthetic data
- [ ] Manual test toggles filters and observes bbox/point count updates

## Constraints and Guardrails
- No scope creep; modify only listed files
- ≤2 files, ≤300 LOC total
- No secrets; config from ConfigModule (U16)
- Use THREE.js r16x API; standard BufferAttribute patterns
- Dequantization only if header present (per U04/U09 spec)
- No commits unless explicitly instructed

## Dependencies
- [[U09]] (Points Parser Worker—must be completed)

## Files to Read First
- `/home/josh/Code/AGILE3D-Demo/apps/web/src/app/services/scene-data/**` (to be created)
- THREE.js documentation for BufferGeometry and BufferAttribute
- Micro-level plan §4 "SceneDataService" for API and filtering logic
- Micro-level plan §5 "Data Model" for coordinate system (Z-up yaw) spec

## Files to Edit or Create
- `/home/josh/Code/AGILE3D-Demo/apps/web/src/app/services/scene-data/scene-data.service.ts` (new service)
- `/home/josh/Code/AGILE3D-Demo/apps/web/src/app/services/scene-data/scene-data.service.spec.ts` (new tests)

## Implementation Steps
1. Define interfaces for scene data management:
   - `FilterConfig`: {scoreThreshold: number; labelMask: Set<string>}
   - `GeometryState`: {pointCount: number; maxCapacity: number; needsRealloc: boolean}
   - `DetectionData`: {id: string; label: string; score: number; bbox: {x,y,z,l,w,h,yaw}; ...}

2. Implement `SceneDataService` in `scene-data.service.ts`:
   - Constructor: inject `ConfigService`
   - Properties:
     - `geometry: THREE.BufferGeometry` — shared geometry for points (optional, create on demand)
     - `positionAttribute: BufferAttribute` — points buffer (reused)
     - `filterConfig: FilterConfig` — current filters
     - `state: GeometryState` — current capacity and point count
   - Public methods:
     - `setActiveBranch(branchId: string): void` — store for detection queries
     - `setScoreThreshold(score: number): void` — update filter
     - `setLabelMask(labels: string[]): void` — update filter
     - `applyFrame(frameData: FrameData, quantHeader?: Header): void`:
       - Parse points (dequantize if header present)
       - Reallocate BufferAttribute only if pointCount > current capacity or shrinks >50%
       - Update position attribute in-place
       - Parse detections for active branch; apply filters
       - Emit observable with updated state and filtered detections
   - Public observables:
     - `geometry$: Observable<THREE.BufferGeometry>` — emits when geometry ready
     - `detections$: Observable<DetectionData[]>` — emits filtered detections each frame
     - `state$: Observable<GeometryState>` — emits realloc events and capacity changes
   - Private methods:
     - `parsePoints(buffer: ArrayBuffer, quantHeader?: Header): {positions: Float32Array; pointCount: number}`
       - If quantHeader: dequantize int16/fp16 to float32 per bbox
       - Otherwise: parse raw float32
     - `transformYaw(yaw: number): number` — convert Z-up yaw to frame coordinate system
     - `filterDetections(detections: DetectionData[], filterConfig: FilterConfig): DetectionData[]`
       - Keep detections where label ∈ labelMask AND score ≥ scoreThreshold
     - `reallocateGeometry(newCapacity: number): void`
       - Create new BufferAttribute with capacity
       - Copy existing positions if reusing data
       - Update geometry.attributes.position

3. Buffer reuse logic:
   - Track `maxCapacity` (allocated size) and `pointCount` (current)
   - On new frame:
     - If pointCount fits in maxCapacity: reuse (set `needsRealloc = false`)
     - If pointCount > maxCapacity: reallocate to `maxCapacity = pointCount * 1.2` (20% headroom)
     - If pointCount < maxCapacity * 0.5: shrink to `maxCapacity = pointCount * 1.2` to free memory
     - Emit state observable on realloc

4. Filter and transform logic:
   - Default filters: score ≥ 0.7, labels {vehicle, pedestrian, cyclist}
   - For each detection:
     - Check score against threshold
     - Check label against mask
     - Transform yaw if needed (document frame orientation assumption)
   - Emit filtered array via detections$ observable

5. Write unit tests in `scene-data.service.spec.ts`:
   - `test_geometry_reuse_stable_point_count`: 1000 points, apply new frame with 1050 points, no realloc
   - `test_geometry_realloc_on_growth`: 1000 → 2500 points, reallocate triggered
   - `test_geometry_shrink_below_threshold`: 2500 → 500 points (50% threshold), shrink reallocation
   - `test_filter_by_score_threshold`: detections with scores [0.5, 0.7, 0.9], filter ≥0.7 keeps [0.7, 0.9]
   - `test_filter_by_label_mask`: detections [vehicle, pedestrian, other], filter keeps [vehicle, pedestrian]
   - `test_combined_filters`: score + label filters applied together
   - `test_points_parsing_raw`: synthetic float32 buffer, parsed to positions array
   - `test_points_parsing_quantized`: buffer with quantization header, dequantized correctly
   - `test_yaw_transform`: Z-up yaw conversion applied (or identity if no transform needed)
   - `test_observable_emissions`: applyFrame() emits geometry$, detections$, state$ observables

6. Validate by manual testing:
   - Inject service and subscribe to observables
   - Apply synthetic frame data with known points and detections
   - Toggle filter thresholds; verify detection counts change
   - Verify buffer reuse: apply large then small frame; check realloc event
   - Verify position data visible in geometry attribute

## Tests
- Unit:
  - `/home/josh/Code/AGILE3D-Demo/apps/web/src/app/services/scene-data/scene-data.service.spec.ts`:
    - `test_geometry_reuse_stable_point_count` — stable count, no realloc
    - `test_geometry_realloc_on_growth` — growth triggers realloc
    - `test_geometry_shrink_below_threshold` — shrink triggers realloc
    - `test_filter_by_score_threshold` — score filter applied
    - `test_filter_by_label_mask` — label filter applied
    - `test_combined_filters` — score + label combined
    - `test_points_parsing_raw` — raw float32 parsing
    - `test_points_parsing_quantized` — quantized dequantization
    - `test_yaw_transform` — yaw coordinate transform
    - `test_observable_emissions` — observables emit correctly
- Manual:
  - Inject service; subscribe to observables
  - Apply frame with synthetic points and detections
  - Toggle filters; verify detection count changes
  - Test buffer reuse with varying point counts
  - Inspect geometry attribute data

## Commands to Run
```bash
cd /home/josh/Code/AGILE3D-Demo/apps/web
npm test -- scene-data.service.spec.ts --watch=false
ng serve
# In browser console:
# const svc = ng.probe(document.body).injector.get(SceneDataService);
# svc.detections$.subscribe(d => console.log('Filtered detections:', d.length));
# svc.state$.subscribe(s => console.log('State:', s));
```

## Artifacts to Return
- Unified diff for `scene-data.service.ts` and `scene-data.service.spec.ts`
- Jest/Karma test output showing all tests passing
- Console log from manual test showing observable emissions and filter toggles
- Memory profiling screenshot (optional) showing buffer reuse behavior

## Minimal Context Excerpts
> Source: [[micro-level-plan#4. SceneDataService]]
> Purpose: load/parse points in Worker, patch THREE.BufferAttribute in-place, deserialize detections, filter by score/labels.
> API: setActiveBranch(id), setScoreThreshold(n), setLabelMask(mask), applyFrame(FrameData).
> Edge cases: handle varying point counts (realloc only when needed); Z-up yaw; dequantize if header present.
>
> Source: [[micro-level-plan#3. Session Inputs Summary]]
> Score≥0.7 default; classes vehicle/pedestrian/cyclist enabled.
>
> Source: [[Work-Decomposer-Output#Unit U10: SceneDataService]]
> Geometry patches without reallocation when `pointCount` stable.
> Filters correctly include classes vehicle/pedestrian/cyclist with default score ≥0.7.

## Follow-ups if Blocked
- **THREE.js BufferAttribute unclear**: Use `new THREE.BufferAttribute(new Float32Array(capacity * 3), 3)` for position; call `geometry.setAttribute('position', attr)` and `geometry.computeVertexNormals()` for lighting
- **Buffer reuse threshold vague**: Use 50% shrink threshold and 20% growth headroom; reallocate if new size > current capacity or < 50% of capacity
- **Quantization dequantization unclear**: If header present (29 bytes), read bbox bounds; normalize quantized int16 [-32768, 32767] or fp16 to [-1, 1]; scale by bbox: `value = bbox_min + (normalized + 1) / 2 * (bbox_max - bbox_min)`
- **Yaw transformation unclear**: Document frame coordinate system; if Z-up, may need rotation; if already aligned, no transform needed (identity)
- **Detection filtering logic unclear**: Keep detection if `score >= scoreThreshold AND label IN labelMask`; use Set lookup for label mask (O(1))
