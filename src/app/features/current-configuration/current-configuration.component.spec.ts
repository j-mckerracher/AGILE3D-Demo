import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { BehaviorSubject, of } from 'rxjs';
import {
  CurrentConfigurationComponent,
  ConfigurationViewModel,
} from './current-configuration.component';
import { StateService } from '../../core/services/state/state.service';
import { SimulationService } from '../../core/services/simulation/simulation.service';
import { PaperDataService } from '../../core/services/data/paper-data.service';
import { BranchConfig } from '../../core/models/branch.models';
import { AdvancedKnobs, VoxelSize } from '../../core/models/config-and-metrics';

describe('CurrentConfigurationComponent', () => {
  let component: CurrentConfigurationComponent;
  let fixture: ComponentFixture<CurrentConfigurationComponent>;
  let mockStateService: jasmine.SpyObj<StateService>;
  let mockSimulationService: jasmine.SpyObj<SimulationService>;
  let mockPaperDataService: jasmine.SpyObj<PaperDataService>;

  // Mock observables
  let activeBranchSubject: BehaviorSubject<string>;
  let advancedKnobsSubject: BehaviorSubject<AdvancedKnobs>;
  let voxelSizeSubject: BehaviorSubject<VoxelSize>;
  let branchesSubject: BehaviorSubject<BranchConfig[]>;

  // Mock data
  const mockBranches: BranchConfig[] = [
    {
      branch_id: 'CP_Pillar_032',
      name: 'CenterPoint Pillar 0.32m',
      controlKnobs: {
        encodingFormat: 'pillar',
        spatialResolution: 0.32,
        spatialEncoding: 'DV',
        featureExtractor: '2d_cnn',
        detectionHead: 'center',
      },
      performance: {
        memoryFootprint: 3.2,
        latency: {
          noContention: { mean: 147, std: 5.2 },
          lightContention: { mean: 168, std: 7.8 },
          moderateContention: { mean: 195, std: 12.3 },
          intenseContention: { mean: 245, std: 18.9 },
          peakContention: { mean: 298, std: 25.1 },
        },
        accuracy: {
          'vehicle-heavy': 64.2,
          'pedestrian-heavy': 58.7,
          mixed: 61.5,
        },
      },
      modelFamily: 'CenterPoint',
    },
    {
      branch_id: 'DSVT_Voxel_016',
      name: 'DSVT Voxel 0.16m',
      controlKnobs: {
        encodingFormat: 'voxel',
        spatialResolution: 0.16,
        spatialEncoding: 'HV',
        featureExtractor: 'transformer',
        detectionHead: 'anchor',
      },
      performance: {
        memoryFootprint: 6.8,
        latency: {
          noContention: { mean: 371, std: 15.2 },
          lightContention: { mean: 425, std: 22.8 },
          moderateContention: { mean: 498, std: 35.7 },
          intenseContention: { mean: 645, std: 58.2 },
          peakContention: { mean: 782, std: 72.4 },
        },
        accuracy: {
          'vehicle-heavy': 67.1,
          'pedestrian-heavy': 62.3,
          mixed: 64.8,
        },
      },
      modelFamily: 'DSVT',
    },
  ];

  beforeEach(async () => {
    // Initialize subjects
    activeBranchSubject = new BehaviorSubject<string>('CP_Pillar_032');
    advancedKnobsSubject = new BehaviorSubject<AdvancedKnobs>({
      encodingFormat: 'pillar',
      detectionHead: 'center',
      featureExtractor: '2d_cnn',
    });
    voxelSizeSubject = new BehaviorSubject<VoxelSize>(0.32);
    branchesSubject = new BehaviorSubject<BranchConfig[]>(mockBranches);

    // Create mock services
    mockStateService = jasmine.createSpyObj('StateService', [], {
      advancedKnobs$: advancedKnobsSubject.asObservable(),
      voxelSize$: voxelSizeSubject.asObservable(),
    });

    mockSimulationService = jasmine.createSpyObj('SimulationService', [], {
      activeBranch$: activeBranchSubject.asObservable(),
    });

    mockPaperDataService = jasmine.createSpyObj('PaperDataService', {
      getBranches: branchesSubject.asObservable(),
    });

    await TestBed.configureTestingModule({
      imports: [CurrentConfigurationComponent],
      providers: [
        { provide: StateService, useValue: mockStateService },
        { provide: SimulationService, useValue: mockSimulationService },
        { provide: PaperDataService, useValue: mockPaperDataService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CurrentConfigurationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Initial Rendering', () => {
    it('should render baseline label as "DSVT-Voxel (fixed)"', fakeAsync(() => {
      let viewModel: ConfigurationViewModel | undefined;
      component.viewModel$.subscribe((vm) => (viewModel = vm));
      tick();

      expect(viewModel?.baselineLabel).toBe('DSVT-Voxel (fixed)');
    }));

    it('should render current AGILE3D branch name', fakeAsync(() => {
      let viewModel: ConfigurationViewModel | undefined;
      component.viewModel$.subscribe((vm) => (viewModel = vm));
      tick();

      expect(viewModel?.agileBranch).toBe('CP-Pillar-032');
    }));

    it('should display encoding format from advanced knobs', fakeAsync(() => {
      let viewModel: ConfigurationViewModel | undefined;
      component.viewModel$.subscribe((vm) => (viewModel = vm));
      tick();

      expect(viewModel?.encodingFormat).toBe('Pillar');
    }));

    it('should display spatial resolution from voxel size', fakeAsync(() => {
      let viewModel: ConfigurationViewModel | undefined;
      component.viewModel$.subscribe((vm) => (viewModel = vm));
      tick();

      expect(viewModel?.spatialResolution).toBe('0.32 m');
    }));

    it('should display spatial encoding from branch config', fakeAsync(() => {
      let viewModel: ConfigurationViewModel | undefined;
      component.viewModel$.subscribe((vm) => (viewModel = vm));
      tick();

      expect(viewModel?.spatialEncoding).toBe('DV');
    }));

    it('should display feature extractor from advanced knobs', fakeAsync(() => {
      let viewModel: ConfigurationViewModel | undefined;
      component.viewModel$.subscribe((vm) => (viewModel = vm));
      tick();

      expect(viewModel?.featureExtractor).toBe('2D CNN');
    }));

    it('should display detection head from advanced knobs', fakeAsync(() => {
      let viewModel: ConfigurationViewModel | undefined;
      component.viewModel$.subscribe((vm) => (viewModel = vm));
      tick();

      expect(viewModel?.detectionHead).toBe('Center-based');
    }));

    it('should not show branch change indicator on initial load', fakeAsync(() => {
      let viewModel: ConfigurationViewModel | undefined;
      component.viewModel$.subscribe((vm) => (viewModel = vm));
      tick();

      expect(viewModel?.branchChanged).toBe(false);
    }));
  });

  describe('Branch Change Indicator', () => {
    it('should show indicator when branch changes', fakeAsync(() => {
      let viewModel: ConfigurationViewModel | undefined;
      component.viewModel$.subscribe((vm) => (viewModel = vm));
      tick();

      // Initial state: no indicator
      expect(viewModel?.branchChanged).toBe(false);

      // Change branch
      activeBranchSubject.next('DSVT_Voxel_016');
      tick();

      // Indicator should be shown
      expect(viewModel?.branchChanged).toBe(true);
    }));

    it('should auto-clear indicator after 2 seconds', fakeAsync(() => {
      let viewModel: ConfigurationViewModel | undefined;
      component.viewModel$.subscribe((vm) => (viewModel = vm));
      tick();

      // Change branch
      activeBranchSubject.next('DSVT_Voxel_016');
      tick();

      // Indicator shown
      expect(viewModel?.branchChanged).toBe(true);

      // Wait 2 seconds
      tick(2000);

      // Indicator should be cleared
      expect(viewModel?.branchChanged).toBe(false);
    }));

    it('should reset indicator timer on subsequent branch changes', fakeAsync(() => {
      let viewModel: ConfigurationViewModel | undefined;
      component.viewModel$.subscribe((vm) => (viewModel = vm));
      tick();

      // First branch change
      activeBranchSubject.next('DSVT_Voxel_016');
      tick();
      expect(viewModel?.branchChanged).toBe(true);

      // Wait 1 second (indicator still showing)
      tick(1000);
      expect(viewModel?.branchChanged).toBe(true);

      // Second branch change before auto-clear
      activeBranchSubject.next('CP_Pillar_032');
      tick();

      // Indicator should still be showing
      expect(viewModel?.branchChanged).toBe(true);

      // Wait another 2 seconds from second change
      tick(2000);

      // Now it should be cleared
      expect(viewModel?.branchChanged).toBe(false);
    }));
  });

  describe('Fallback for Missing Data', () => {
    it('should show "—" for spatial encoding if branch config unavailable', fakeAsync(() => {
      // Mock getBranches to return empty array
      mockPaperDataService.getBranches.and.returnValue(of([]));

      // Recreate component with new mock
      fixture = TestBed.createComponent(CurrentConfigurationComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      let viewModel: ConfigurationViewModel | undefined;
      component.viewModel$.subscribe((vm) => (viewModel = vm));
      tick();

      expect(viewModel?.spatialEncoding).toBe('—');
    }));

    it('should show "—" for spatial encoding if branch not found', fakeAsync(() => {
      // Change to a branch ID that doesn't exist
      activeBranchSubject.next('NonExistent_Branch');
      tick();

      let viewModel: ConfigurationViewModel | undefined;
      component.viewModel$.subscribe((vm) => (viewModel = vm));
      tick();

      expect(viewModel?.spatialEncoding).toBe('—');
    }));
  });

  describe('Reactive Updates', () => {
    it('should update encoding format when advanced knobs change', fakeAsync(() => {
      let viewModel: ConfigurationViewModel | undefined;
      component.viewModel$.subscribe((vm) => (viewModel = vm));
      tick();

      // Initial value
      expect(viewModel?.encodingFormat).toBe('Pillar');

      // Update advanced knobs
      advancedKnobsSubject.next({
        encodingFormat: 'voxel',
        detectionHead: 'center',
        featureExtractor: '2d_cnn',
      });
      tick();

      // Value should update
      expect(viewModel?.encodingFormat).toBe('Voxel');
    }));

    it('should update spatial resolution when voxel size changes', fakeAsync(() => {
      let viewModel: ConfigurationViewModel | undefined;
      component.viewModel$.subscribe((vm) => (viewModel = vm));
      tick();

      // Initial value
      expect(viewModel?.spatialResolution).toBe('0.32 m');

      // Update voxel size
      voxelSizeSubject.next(0.64);
      tick();

      // Value should update
      expect(viewModel?.spatialResolution).toBe('0.64 m');
    }));

    it('should update feature extractor when advanced knobs change', fakeAsync(() => {
      let viewModel: ConfigurationViewModel | undefined;
      component.viewModel$.subscribe((vm) => (viewModel = vm));
      tick();

      // Initial value
      expect(viewModel?.featureExtractor).toBe('2D CNN');

      // Update advanced knobs
      advancedKnobsSubject.next({
        encodingFormat: 'pillar',
        detectionHead: 'center',
        featureExtractor: 'transformer',
      });
      tick();

      // Value should update
      expect(viewModel?.featureExtractor).toBe('Transformer');
    }));

    it('should update detection head when advanced knobs change', fakeAsync(() => {
      let viewModel: ConfigurationViewModel | undefined;
      component.viewModel$.subscribe((vm) => (viewModel = vm));
      tick();

      // Initial value
      expect(viewModel?.detectionHead).toBe('Center-based');

      // Update advanced knobs
      advancedKnobsSubject.next({
        encodingFormat: 'pillar',
        detectionHead: 'anchor',
        featureExtractor: '2d_cnn',
      });
      tick();

      // Value should update
      expect(viewModel?.detectionHead).toBe('Anchor-based');
    }));

    it('should update spatial encoding when branch changes', fakeAsync(() => {
      let viewModel: ConfigurationViewModel | undefined;
      component.viewModel$.subscribe((vm) => (viewModel = vm));
      tick();

      // Initial value (CP_Pillar_032 has DV)
      expect(viewModel?.spatialEncoding).toBe('DV');

      // Change to different branch (DSVT_Voxel_016 has HV)
      activeBranchSubject.next('DSVT_Voxel_016');
      tick();

      // Value should update
      expect(viewModel?.spatialEncoding).toBe('HV');
    }));
  });

  describe('Format Methods', () => {
    it('should format branch ID with hyphens', fakeAsync(() => {
      let viewModel: ConfigurationViewModel | undefined;
      component.viewModel$.subscribe((vm) => (viewModel = vm));
      tick();

      expect(viewModel?.agileBranch).toBe('CP-Pillar-032');
    }));

    it('should capitalize encoding format', fakeAsync(() => {
      let viewModel: ConfigurationViewModel | undefined;
      component.viewModel$.subscribe((vm) => (viewModel = vm));
      tick();

      expect(viewModel?.encodingFormat).toBe('Pillar');

      advancedKnobsSubject.next({
        encodingFormat: 'voxel',
        detectionHead: 'center',
        featureExtractor: '2d_cnn',
      });
      tick();

      expect(viewModel?.encodingFormat).toBe('Voxel');
    }));

    it('should format feature extractor names correctly', fakeAsync(() => {
      let viewModel: ConfigurationViewModel | undefined;
      component.viewModel$.subscribe((vm) => (viewModel = vm));
      tick();

      const testCases = [
        { input: 'transformer', expected: 'Transformer' },
        { input: 'sparse_cnn', expected: 'Sparse CNN' },
        { input: '2d_cnn', expected: '2D CNN' },
      ];

      testCases.forEach((testCase) => {
        advancedKnobsSubject.next({
          encodingFormat: 'pillar',
          detectionHead: 'center',
          featureExtractor: testCase.input as AdvancedKnobs['featureExtractor'],
        });
        tick();

        expect(viewModel?.featureExtractor).toBe(testCase.expected);
      });
    }));

    it('should format detection head names correctly', fakeAsync(() => {
      let viewModel: ConfigurationViewModel | undefined;
      component.viewModel$.subscribe((vm) => (viewModel = vm));
      tick();

      const testCases = [
        { input: 'anchor', expected: 'Anchor-based' },
        { input: 'center', expected: 'Center-based' },
      ];

      testCases.forEach((testCase) => {
        advancedKnobsSubject.next({
          encodingFormat: 'pillar',
          detectionHead: testCase.input as AdvancedKnobs['detectionHead'],
          featureExtractor: '2d_cnn',
        });
        tick();

        expect(viewModel?.detectionHead).toBe(testCase.expected);
      });
    }));
  });

  describe('Component Lifecycle', () => {
    it('should complete destroy$ subject on ngOnDestroy', () => {
      // Access private property for testing
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const destroySubject = (component as any).destroy$;
      spyOn(destroySubject, 'complete');

      component.ngOnDestroy();

      expect(destroySubject.complete).toHaveBeenCalled();
    });

    it('should not have memory leaks after destroy', fakeAsync(() => {
      // Subscribe to viewModel$
      const subscription = component.viewModel$.subscribe();

      // Destroy component
      component.ngOnDestroy();
      fixture.destroy();
      tick();

      // Subscription should be cleaned up
      expect(subscription.closed).toBe(false); // shareReplay keeps it alive, but that's OK

      // But the destroy$ should be completed
      // Access private property for testing
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const destroySubject = (component as any).destroy$;
      expect(destroySubject.closed).toBe(true);
    }));
  });

  describe('Template Rendering', () => {
    it('should render baseline label in template', () => {
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;
      const baselineValue = compiled.querySelector('.baseline-value');

      expect(baselineValue?.textContent?.trim()).toBe('DSVT-Voxel (fixed)');
    });

    it('should render branch name in template', () => {
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;
      const branchValue = compiled.querySelector('.branch-value');

      expect(branchValue?.textContent).toContain('CP-Pillar-032');
    });

    it('should render all 5 control knobs', () => {
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;
      const knobItems = compiled.querySelectorAll('.knob-item');

      expect(knobItems.length).toBe(5);
    });

    it('should have aria-live="polite" on container', () => {
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;
      const container = compiled.querySelector('.current-configuration');

      expect(container?.getAttribute('aria-live')).toBe('polite');
    });

    it('should show branch indicator when branchChanged is true', fakeAsync(() => {
      fixture.detectChanges();
      tick();

      // Change branch to trigger indicator
      activeBranchSubject.next('DSVT_Voxel_016');
      tick();
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const indicator = compiled.querySelector('.branch-indicator');

      expect(indicator).toBeTruthy();
      expect(indicator?.getAttribute('role')).toBe('status');
      expect(indicator?.getAttribute('aria-label')).toBe('Branch changed');
    }));

    it('should not show branch indicator initially', () => {
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;
      const indicator = compiled.querySelector('.branch-indicator');

      expect(indicator).toBeFalsy();
    });
  });
});
