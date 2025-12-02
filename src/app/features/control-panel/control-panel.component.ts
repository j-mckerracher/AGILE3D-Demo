/**
 * Control Panel Component
 *
 * Implements WP-2.2.1 Primary controls (scene selector, voxel size, contention, latency SLO).
 *
 * PRD: FR-2.1–2.6 (primary); NFR-1.3 (<=100ms control updates), NFR-3.x (a11y)
 */

import { Component, ChangeDetectionStrategy, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, combineLatest } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';

import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatSliderModule } from '@angular/material/slider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';

import { StateService } from '../../core/services/state/state.service';
import { SceneId, VoxelSize } from '../../core/models/config-and-metrics';

interface PrimaryControls {
  scene: SceneId;
  voxelSize: VoxelSize;
  contention: number;
  sloMs: number;
  baselineBranch: string;
  activeBranch: string;
}

@Component({
  selector: 'app-control-panel',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonToggleModule,
    MatSliderModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatSelectModule,
  ],
  templateUrl: './control-panel.component.html',
  styleUrls: ['./control-panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ControlPanelComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  protected readonly primaryForm: FormGroup;
  protected availableBranches: string[] = [];
  protected baselineOptions: string[] = [];
  protected agileOptions: string[] = [];

  protected readonly tooltips = {
    scene: 'Select traffic scenario type: vehicle-heavy, pedestrian-heavy, or mixed',
    voxelSize: 'Point cloud spatial resolution (0.16m=fine, 0.64m=coarse)',
    contention: 'GPU resource contention percentage (0-100%)',
    sloMs: 'Target latency Service Level Objective (100-500ms)',
  } as const;

  private readonly stateService = inject(StateService);

  public constructor() {
    const fb = inject(FormBuilder);
    this.primaryForm = fb.group({
      scene: ['pedestrian-heavy', Validators.required],
      voxelSize: [0.32, Validators.required],
      contention: [38, [Validators.required, Validators.min(0), Validators.max(100)]],
      sloMs: [350, [Validators.required, Validators.min(100), Validators.max(500)]],
      baselineBranch: ['DSVT_Voxel_020', Validators.required],
      activeBranch: ['CP_Pillar_032', Validators.required],
    });
  }

  public ngOnInit(): void {
    // Initialize from StateService
    combineLatest([
      this.stateService.scene$,
      this.stateService.voxelSize$,
      this.stateService.contention$,
      this.stateService.sloMs$,
      this.stateService.baselineBranch$,
      this.stateService.activeBranch$,
      this.stateService.availableBranches$,
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([scene, voxelSize, contention, sloMs, baselineBranch, activeBranch, branches]) => {
        this.updateBranchOptions(branches);
        this.primaryForm.patchValue(
          { scene, voxelSize, contention, sloMs, baselineBranch, activeBranch },
          { emitEvent: false }
        );
      });

    // Push debounced changes to state
    this.primaryForm.valueChanges
      .pipe(
        debounceTime(100),
        distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
        takeUntil(this.destroy$)
      )
      .subscribe((v: PrimaryControls) => {
        if (v?.scene) this.stateService.setScene(v.scene);
        if (typeof v?.voxelSize === 'number') this.stateService.setVoxelSize(v.voxelSize);
        if (typeof v?.contention === 'number') this.stateService.setContention(v.contention);
        if (typeof v?.sloMs === 'number') this.stateService.setSlo(v.sloMs);
        if (typeof v?.baselineBranch === 'string') this.stateService.setBaselineBranch(v.baselineBranch);
        if (typeof v?.activeBranch === 'string') this.stateService.setActiveBranch(v.activeBranch);
      });
  }

  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private updateBranchOptions(branches: string[]): void {
    this.availableBranches = branches;
    const baseline = branches.filter((branch) => branch.startsWith('DSVT'));
    const agile = branches.filter((branch) => !branch.startsWith('DSVT'));
    this.baselineOptions = baseline.length > 0 ? baseline : branches;
    this.agileOptions = agile.length > 0 ? agile : branches;
  }
}
