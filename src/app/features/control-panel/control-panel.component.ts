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
import { Subject, combineLatest, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';

import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';

import { StateService } from '../../core/services/state/state.service';
import { FrameStreamService } from '../../core/services/frame-stream/frame-stream.service';
import { SceneId, VoxelSize } from '../../core/models/config-and-metrics';
import { AdvancedControlsComponent } from './advanced-controls/advanced-controls.component';

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
    MatButtonModule,
    MatIconModule,
    MatSliderModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatSelectModule,
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
                class="scene-toggle-group"
              >
                <mat-button-toggle
                  value="vehicle-heavy"
                  matTooltip="Vehicle-heavy traffic scenario"
                  aria-label="Select vehicle-heavy scene"
                >
                  Vehicle-Heavy
                </mat-button-toggle>
                <mat-button-toggle
                  value="pedestrian-heavy"
                  matTooltip="Pedestrian-heavy traffic scenario"
                  aria-label="Select pedestrian-heavy scene"
                >
                  Pedestrian-Heavy
                </mat-button-toggle>
                <mat-button-toggle
                  value="mixed"
                  matTooltip="Mixed traffic scenario"
                  aria-label="Select mixed scene"
                >
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
                matTooltip="Spatial resolution (smaller is finer, higher accuracy but slower)"
              >
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
                matTooltip="GPU resource contention percentage"
              >
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
                matTooltip="Target latency Service Level Objective in milliseconds"
              >
                <input matSliderThumb formControlName="sloMs" />
              </mat-slider>
              <div class="value-label" aria-live="polite">{{ primaryForm.value.sloMs }} ms</div>
            </fieldset>
          </div>

          <!-- Baseline branch selector -->
          <div class="control-group baseline-branch-group">
            <mat-form-field appearance="fill" class="full-width">
              <mat-label>Baseline branch</mat-label>
              <mat-select
                formControlName="baselineBranch"
                [disabled]="baselineOptions.length === 0"
                aria-label="Select baseline detection branch"
              >
                <mat-option *ngFor="let branch of baselineOptions" [value]="branch">
                  {{ branch }}
                </mat-option>
              </mat-select>
            </mat-form-field>
          </div>

          <!-- AGILE3D branch selector -->
          <div class="control-group agile-branch-group">
            <mat-form-field appearance="fill" class="full-width">
              <mat-label>AGILE3D branch</mat-label>
              <mat-select
                formControlName="activeBranch"
                [disabled]="agileOptions.length === 0"
                aria-label="Select AGILE3D detection branch"
              >
                <mat-option *ngFor="let branch of agileOptions" [value]="branch">
                  {{ branch }}
                </mat-option>
              </mat-select>
            </mat-form-field>
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
      :host {
        display: block;
        width: 100%;
      }
      .control-panel-container {
        display: flex;
        flex-direction: column;
        gap: 24px;
        padding: 24px;
      }
      .panel-header {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .panel-title {
        margin: 0;
        font-size: 24px;
        font-weight: 700;
      }
      .panel-subtitle {
        margin: 0;
        font-size: 14px;
        opacity: 0.8;
      }

      .primary-controls {
        padding: 16px;
        border-radius: 6px;
      }
      .primary-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 16px;
      }
      @media (min-width: 920px) {
        .primary-grid {
          grid-template-columns: 1fr 1fr;
        }
        .scene-group {
          grid-column: 1 / -1;
        }
      }

      .control-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 8px;
      }
      .scene-group {
        padding: 12px;
      }
      .control-label {
        font-weight: 600;
      }
      fieldset {
        border: 0;
        padding: 0;
        margin: 0;
      }
      legend.control-label {
        margin-bottom: 8px;
      }
      .scene-toggle-group {
        margin-bottom: 4px;
      }
      .full-width {
        width: 100%;
      }
      .value-label {
        font-size: 12px;
        opacity: 0.8;
      }

      .tick-labels {
        display: flex;
        justify-content: space-between;
        font-size: 10px;
        opacity: 0.7;
        margin-top: 2px;
      }
      .tick {
        display: inline-block;
        width: auto;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ControlPanelComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  protected readonly primaryForm: FormGroup;
  protected availableBranches: string[] = [];
  protected baselineOptions: string[] = [];
  protected agileOptions: string[] = [];

  // Playback controls state
  protected isPlaying = false;
  protected isPaused = false;
  protected currentFrameIndex = 0;
  protected totalFrames = 0;
  private statusSubscription?: Subscription;
  private frameSubscription?: Subscription;

  protected readonly tooltips = {
    scene: 'Select traffic scenario type: vehicle-heavy, pedestrian-heavy, or mixed',
    voxelSize: 'Point cloud spatial resolution (0.16m=fine, 0.64m=coarse)',
    contention: 'GPU resource contention percentage (0-100%)',
    sloMs: 'Target latency Service Level Objective (100-500ms)',
  } as const;

  private readonly stateService = inject(StateService);
  private readonly frameStream = inject(FrameStreamService);

  public constructor() {
    const fb = inject(FormBuilder);
    this.primaryForm = fb.group({
      scene: ['mixed', Validators.required],
      voxelSize: [0.32, Validators.required],
      contention: [38, [Validators.required, Validators.min(0), Validators.max(100)]],
      sloMs: [350, [Validators.required, Validators.min(100), Validators.max(500)]],
      baselineBranch: ['DSVT_Pillar_030', Validators.required],
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

    // Subscribe to playback status
    this.statusSubscription = this.frameStream.status$.subscribe(status => {
      this.isPlaying = status === 'playing';
      this.isPaused = status === 'paused';
    });

    // Subscribe to current frame for counter and slider
    this.frameSubscription = this.frameStream.currentFrame$.subscribe(frame => {
      if (frame) {
        this.currentFrameIndex = frame.index;
      }
    });

    // Get total frames from manifest
    this.totalFrames = this.frameStream.getTotalFrames();
  }

  public ngOnDestroy(): void {
    this.statusSubscription?.unsubscribe();
    this.frameSubscription?.unsubscribe();
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

  // Playback control methods
  protected onPlayPause(): void {
    if (this.isPlaying) {
      this.frameStream.pause();
    } else if (this.isPaused) {
      this.frameStream.resume();
    } else {
      // If stopped, start from beginning
      this.frameStream.start();
    }
  }

  protected onSeek(frameIndex: number): void {
    // Pause during manual seeking
    if (this.isPlaying) {
      this.frameStream.pause();
    }
    this.frameStream.seek(frameIndex);
  }

  protected onStepForward(): void {
    const nextIndex = Math.min(this.currentFrameIndex + 1, this.totalFrames - 1);
    this.frameStream.seek(nextIndex);
  }

  protected onStepBackward(): void {
    const prevIndex = Math.max(this.currentFrameIndex - 1, 0);
    this.frameStream.seek(prevIndex);
  }
}
