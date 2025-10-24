# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Common Development Commands

### Development Server
```bash
npm start                     # Start dev server at http://localhost:4200
```

### Building
```bash
npm run build                 # Development build → dist/agile3d-demo/
npm run build:prod            # Production build (optimized, minified)
npm run watch                 # Watch mode for continuous builds
```

### Testing
```bash
# Unit tests (Jasmine + Karma)
npm test                      # Headless Chrome, single run (CI mode)

# Watch mode during development
ng test                       # Opens browser with live reload

# Run specific test file
ng test --include='**/state.service.spec.ts'
ng test --include='src/app/core/services/**/*.spec.ts'

# Custom browser configurations
ng test --browsers=ChromeHeadless
ng test --browsers=FirefoxHeadless
```

### Code Quality
```bash
npm run lint                  # Run ESLint
npm run lint:fix              # Auto-fix linting issues
npm run format                # Format code with Prettier
```

### Data Tools
```bash
# Scene data management
npm run validate:data         # Validate scene JSON/binary data integrity
npm run gen:scenes            # Generate all scene data files
npm run gen:scene             # Generate a single scene (interactive)
npm run add:scene:parking     # Add parking lot scene example

# Manual tool invocation
node tools/validate-data.mjs
node tools/generate-scene-data.mjs
node tools/validate-asset-budgets.mjs
```

## High-Level Architecture

### Core Framework
- **Angular 20** with **standalone components** (no NgModules)
- **Three.js 0.179** via **angular-three** for 3D rendering
- **TypeScript 5.9** in strict mode
- **RxJS 7.8** for reactive state management

### State Management Pattern
**StateService** is the single source of truth for application state:
- Exposes `BehaviorSubject` instances for all UI controls (scene, voxel size, contention, latency SLO, camera position/target)
- Provides derived observables with debouncing and distinctUntilChanged
- All UI changes flow: Component → StateService → Derived Observables → Downstream Services/Components

**SimulationService** derives metrics from state:
- Selects optimal AGILE3D branch based on `SystemParams` + `AdvancedKnobs`
- Computes baseline and AGILE3D metrics via `PaperDataService` branch configs
- Uses memoization caches for branch selection and metrics calculations
- Exposes reactive streams: `activeBranch$`, `baselineMetrics$`, `agileMetrics$`, `comparison$`

### 3D Rendering Architecture

#### Shared Geometry (WP-2.1.1)
**Critical constraint**: Both viewers share a **single** `THREE.Points` instance to avoid GPU buffer duplication:
- `SceneDataService.loadPointsObject()` creates one `THREE.Points` with one `BufferGeometry`
- `DualViewerComponent` extracts the geometry and passes it to both `SceneViewerComponent` instances
- Each viewer uses the same geometry in its own Three.js scene (different camera, same mesh)
- **Never clone or duplicate point cloud geometries**

#### Detection Visualization
- Per-class instanced meshes (`InstancedMesh`) for bounding boxes (vehicle/pedestrian/cyclist)
- Shared `BoxGeometry(1,1,1)` scaled via matrix transforms
- Raycasting for hover tooltips on detections

#### Worker-Based Parsing
- Point cloud `.bin` files parsed in Web Worker (`src/assets/workers/parse-point-cloud.worker.ts`)
- Transferable ArrayBuffers for zero-copy data transfer
- Fallback to main thread if worker unavailable

#### Camera Synchronization
- `CameraControlService` manages bidirectional camera sync between viewers
- Feedback loop prevention via value change guards in `StateService`
- Independent camera mode toggle supported via `StateService.independentCamera$`

### Metrics & History
- `MetricsHistoryService` maintains a ring buffer of last 10 comparison samples
- Auto-clears on scene changes
- Drives sparkline visualizations with <100ms update latency

### Scene Data Loading
- `SceneDataService`: Loads metadata JSON, fetches `.bin` files, manages caching
- `PaperDataService`: Loads AGILE3D branch configs and baseline data from JSON
- `SceneTierManagerService`: Automatic tier selection (100k vs 50k points) based on GPU capability

## Key Development Patterns

### Component Architecture
- **Standalone components** everywhere (no `@NgModule`)
- **OnPush change detection** wherever possible
- **Async pipe** for observable subscriptions in templates
- **Explicit member accessibility** (`public`/`private`/`protected`) enforced by ESLint

### RxJS Patterns
```typescript
// Standard cleanup pattern
private destroy$ = new Subject<void>();

ngOnInit(): void {
  this.service.data$
    .pipe(takeUntil(this.destroy$))
    .subscribe(data => { /* ... */ });
}

ngOnDestroy(): void {
  this.destroy$.next();
  this.destroy$.complete();
}
```

- Use `shareReplay(1)` for derived observables that are shared
- Use `distinctUntilChanged()` to prevent redundant emissions
- Debounce user input streams (80-100ms) before state updates

### TypeScript Constraints
- **Strict mode enabled**: `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`
- **No `any` types**: `@typescript-eslint/no-explicit-any` is an error
- **JSDoc on all public methods**: Include `@param`, `@returns`, `@throws` where applicable
- **Explicit return types** encouraged (ESLint warns if missing)

### Testing Requirements
- **≥70% coverage** for services
- **≥60% coverage** for components
- Use `fakeAsync` + `tick()` for testing debounced observables
- Use `TestBed.inject()` for service dependencies
- Use `firstValueFrom()` or `take(1)` to avoid hanging subscriptions

Example:
```typescript
it('debounces contention$ emissions', fakeAsync(() => {
  const emissions: number[] = [];
  service.contention$.pipe(take(3)).subscribe(v => emissions.push(v));
  
  service.setContention(10);
  service.setContention(20);
  tick(100); // Wait for debounce
  
  expect(emissions[0]).toBe(20); // Only final value emitted
}));
```

## Architectural Constraints

### State Management
1. **StateService is the single source of truth** for all control panel values and camera state
2. **Never bypass StateService** to update UI state directly in components
3. **SimulationService derivations are pure**: branch selection and metrics calculation depend only on inputs (no side effects)

### 3D Rendering
1. **Shared geometry is mandatory**: Both viewers must use the same `THREE.Points.geometry` instance
2. **No geometry cloning**: Never call `.clone()` on point cloud geometries
3. **Service-managed lifecycle**: `SceneDataService` owns geometry disposal

### Scene Data
1. **JSON-only scene additions** (FR-1.11): New scenes added without code changes by updating `registry.json` and adding metadata/bin files
2. **Asset budget**: ≤2.5MB per scene (Brotli compressed), ≤8MB total
3. **Validate budgets** before committing: `node tools/validate-asset-budgets.mjs`

### Accessibility (WCAG 2.2 AA)
1. **Keyboard navigation**: All interactive elements must be keyboard accessible
2. **prefers-reduced-motion**: Respect via `ReducedMotionService` and `ViewerStyleAdapterService`
3. **ARIA attributes**: Use `role`, `aria-label`, `aria-live`, `aria-expanded` appropriately
4. **Color-blind safe**: Detection visualizations use distinct shapes (circle/square/diamond) in addition to color

### Performance Targets
- **60fps sustained** in both 3D viewers during interaction
- **<100ms UI update latency** from state change to visual rendering
- **<500ms scene switch** (measured via `InstrumentationService` Performance API marks)

## File Size and Function Limits

- **Maximum 50 lines per function**
- **Maximum 300 lines per file**

These limits are documented but not currently enforced by ESLint. If working on large files, consider refactoring into smaller modules or using helper functions.

## Debug and QA Hooks

### URL Parameters
```bash
# Enable debug mode (FPS overlay, verbose logging)
http://localhost:4200?debug=true

# Force WebGL unsupported error (test error banner)
http://localhost:4200?webgl=0

# Force fallback tier (50k points instead of 100k)
http://localhost:4200?tier=fallback

# Combine hooks
http://localhost:4200?debug=true&tier=fallback
```

### Performance Instrumentation
```javascript
// In browser console:
performance.getEntriesByType('measure')
  .filter(e => e.name.startsWith('scene-switch:'))
// Returns: [{ name: 'scene-switch:initial', duration: 387.2 }, ...]
```

## Important Notes

### Testing Specifics
- Tests run in **ChromeHeadlessNoSandbox** by default (see `karma.conf.js`)
- Coverage reports output to `./coverage/agile3d-demo/`
- Use `fakeAsync` + `tick()` for any service using debounced observables (StateService, SimulationService)

### Adding New Scenes
1. Create directory: `src/assets/scenes/{scene_id}/`
2. Add `metadata.json` (include ground_truth, predictions, bounds)
3. Add point cloud binaries: `{scene_id}_100k.bin`, `{scene_id}_50k.bin`
4. Update `src/assets/scenes/registry.json`
5. Validate: `node tools/validate-asset-budgets.mjs`
6. Test: Scene appears in selector automatically (no code changes)

### Code Review Checklist
- [ ] All public methods have JSDoc comments
- [ ] RxJS subscriptions cleaned up with `takeUntil`
- [ ] OnPush change detection used where applicable
- [ ] No `any` types (use proper interfaces)
- [ ] Tests cover new functionality (≥70% services, ≥60% components)
- [ ] ARIA attributes on new interactive elements
- [ ] prefers-reduced-motion respected for animations
- [ ] Lint and format pass: `npm run lint && npm run format`
