/**
 * Control Panel Component (Primary + Advanced Controls)
 *
 * Implements WP-2.2.1 Primary controls (scene selector, voxel size, contention, latency SLO)
 * and embeds WP-2.2.2 Advanced controls (hidden by default inside child component).
 *
 * PRD: FR-2.1–2.6 (primary), FR-2.7–2.9 (advanced); NFR-1.3 (<=100ms control updates), NFR-3.x (a11y)
 */

import { Component, ChangeDetectionStrategy, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, combineLatest } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';

import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatSliderModule } from '@angular/material/slider';
import { MatTooltipModule } from '@angular/material/tooltip';

import { StateService } from '../../core/services/state/state.service';
import { SceneId, VoxelSize } from '../../core/models/config-and-metrics';
import { AdvancedControlsComponent } from './advanced-controls/advanced-controls.component';

interface PrimaryControls { scene: SceneId; voxelSize: VoxelSize; contention: number; sloMs: number }

@Component({
  selector: 'app-control-panel',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonToggleModule,
    MatSliderModule,
    MatTooltipModule,
    AdvancedControlsComponent,
  ],
  template: `
    <div class="control-panel-container">
      <header class="panel-header">
        <h2 class="panel-title">Control Panel</h2>
        <p class="panel-subtitle">Configure AGILE3D simulation parameters</p>
      </header>

      <!-- Primary Controls Section (WP-2.2.1) -->
      <section class="primary-controls" aria-label="Primary controls">
        <form [formGroup]="primaryForm" class="primary-grid" (submit)="$event.preventDefault()">
          <!-- Scene selector -->
          <div class="control-group scene-group">
            <fieldset>
              <legend id="scene-legend" class="control-label">Scene</legend>
              <mat-button-toggle-group
                aria-labelledby="scene-legend"
                formControlName="scene"
                class="scene-toggle-group">
              <mat-button-toggle
                value="vehicle-heavy"
                matTooltip="Vehicle-heavy traffic scenario"
                aria-label="Select vehicle-heavy scene">
                Vehicle-Heavy
              </mat-button-toggle>
              <mat-button-toggle
                value="pedestrian-heavy"
                matTooltip="Pedestrian-heavy traffic scenario"
                aria-label="Select pedestrian-heavy scene">
                Pedestrian-Heavy
              </mat-button-toggle>
              <mat-button-toggle
                value="mixed"
                matTooltip="Mixed traffic scenario"
                aria-label="Select mixed scene">
                Mixed
              </mat-button-toggle>
            </mat-button-toggle-group>
            </fieldset>
          </div>

          <!-- Voxel size slider -->
          <div class="control-group voxel-group">
            <fieldset>
              <legend id="voxel-legend" class="control-label">Voxel size</legend>
              <mat-slider
                class="full-width"
                [min]="0.16"
                [max]="0.64"
                [step]="0.08"
                [discrete]="true"
                aria-labelledby="voxel-legend"
                matTooltip="Spatial resolution (smaller is finer, higher accuracy but slower)">
                <input matSliderThumb formControlName="voxelSize" />
              </mat-slider>
              <div class="value-label" aria-hidden="true">{{ primaryForm.value.voxelSize }} m</div>
            </fieldset>
          </div>

          <!-- Contention slider with labeled markers -->
          <div class="control-group contention-group">
            <fieldset>
              <legend id="contention-legend" class="control-label">Contention</legend>
              <mat-slider
                class="full-width"
                [min]="0"
                [max]="100"
                [step]="1"
                aria-labelledby="contention-legend"
                matTooltip="GPU resource contention percentage">
                <input matSliderThumb formControlName="contention" />
              </mat-slider>
              <div class="tick-labels" aria-hidden="true">
                <span class="tick">0%</span>
                <span class="tick">38%</span>
                <span class="tick">45%</span>
                <span class="tick">64%</span>
                <span class="tick">67%</span>
              </div>
              <div class="value-label" aria-live="polite">{{ primaryForm.value.contention }}%</div>
            </fieldset>
          </div>

          <!-- Latency SLO slider -->
          <div class="control-group slo-group">
            <fieldset>
              <legend id="slo-legend" class="control-label">Latency SLO</legend>
              <mat-slider
                class="full-width"
                [min]="100"
                [max]="500"
                [step]="10"
                aria-labelledby="slo-legend"
                matTooltip="Target latency Service Level Objective in milliseconds">
                <input matSliderThumb formControlName="sloMs" />
              </mat-slider>
              <div class="value-label" aria-live="polite">{{ primaryForm.value.sloMs }} ms</div>
            </fieldset>
          </div>
        </form>
      </section>

      <!-- Advanced Controls Section (WP-2.2.2) -->
      <section class="advanced-controls-section" aria-label="Advanced controls">
        <app-advanced-controls />
      </section>
    </div>
  `,
  styles: [
    `
      :host { display: block; width: 100%; }
      .control-panel-container { display: flex; flex-direction: column; gap: 24px; padding: 24px; }
      .panel-header { display: flex; flex-direction: column; gap: 4px; }
      .panel-title { margin: 0; font-size: 24px; font-weight: 700; }
      .panel-subtitle { margin: 0; font-size: 14px; opacity: 0.8; }

      .primary-controls { padding: 16px; border-radius: 6px; }
      .primary-grid { display: grid; grid-template-columns: 1fr; gap: 16px; }
      @media (min-width: 920px) {
        .primary-grid { grid-template-columns: 1fr 1fr; }
        .scene-group { grid-column: 1 / -1; }
      }

      .control-group { display: flex; flex-direction: column; gap: 8px; padding: 8px; }
      .scene-group { padding: 12px; }
      .control-label { font-weight: 600; }
      fieldset { border: 0; padding: 0; margin: 0; }
      legend.control-label { margin-bottom: 8px; }
      .scene-toggle-group { margin-bottom: 4px; }
      .full-width { width: 100%; }
      .value-label { font-size: 12px; opacity: 0.8; }

      .tick-labels { display: flex; justify-content: space-between; font-size: 10px; opacity: 0.7; margin-top: 2px; }
      .tick { display: inline-block; width: auto; }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ControlPanelComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  protected readonly primaryForm: FormGroup;

  protected readonly tooltips = {
    scene: 'Select traffic scenario type: vehicle-heavy, pedestrian-heavy, or mixed',
    voxelSize: 'Point cloud spatial resolution (0.16m=fine, 0.64m=coarse)',
    contention: 'GPU resource contention percentage (0-100%)',
    sloMs: 'Target latency Service Level Objective (100-500ms)'
  } as const;

  private readonly stateService = inject(StateService);

  public constructor() {
    const fb = inject(FormBuilder);
    this.primaryForm = fb.group({
      scene: ['mixed', Validators.required],
      voxelSize: [0.32, Validators.required],
      contention: [38, [Validators.required, Validators.min(0), Validators.max(100)]],
      sloMs: [350, [Validators.required, Validators.min(100), Validators.max(500)]],
    });
  }

  public ngOnInit(): void {
    // Initialize from StateService
    combineLatest([
      this.stateService.scene$,
      this.stateService.voxelSize$,
      this.stateService.contention$,
      this.stateService.sloMs$,
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([scene, voxelSize, contention, sloMs]) => {
        this.primaryForm.patchValue(
          { scene, voxelSize, contention, sloMs },
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
      });
  }

  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
