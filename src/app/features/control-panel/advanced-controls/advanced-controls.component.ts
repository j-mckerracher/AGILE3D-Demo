/**
 * Advanced Controls Component
 *
 * Provides fine-grained controls for AGILE3D branch selection parameters.
 * Hidden by default, revealed via "Advanced" toggle button.
 *
 * Features (WP-2.2.2, FR-2.7–2.9):
 * - Encoding format selector (voxel/pillar)
 * - Detection head selector (anchor/center)
 * - Feature extractor selector (transformer/sparse_cnn/2d_cnn)
 * - Reactive form with 100ms debounce and deep distinct comparison
 * - Toggle visibility with ESC key handler
 * - ARIA attributes for accessibility
 * - Angular Material tooltips
 *
 * @see PRD FR-2.7 (Advanced toggle)
 * @see PRD FR-2.8 (Advanced control options)
 * @see PRD FR-2.9 (Tooltips)
 * @see WP-2.2.2 (Advanced Controls implementation)
 */

import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  OnDestroy,
  HostListener,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { StateService } from '../../../core/services/state/state.service';
import { AdvancedKnobs } from '../../../core/models/config-and-metrics';

@Component({
  selector: 'app-advanced-controls',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatTooltipModule,
    MatIconModule,
    MatExpansionModule,
  ],
  templateUrl: './advanced-controls.component.html',
  styleUrls: ['./advanced-controls.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdvancedControlsComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly stateService = inject(StateService);
  private readonly destroy$ = new Subject<void>();

  /** Keep track of last knobs emitted by StateService to suppress redundant set calls */
  private lastKnobs: AdvancedKnobs | undefined;

  /** Advanced controls form group */
  protected readonly form: FormGroup;

  /** Advanced section visibility state */
  protected showAdvanced = false;

  /** Tooltip content (PRD §9.1) */
  protected readonly tooltips = {
    encodingFormat: 'Voxel vs Pillar encoding affects feature layout and latency.',
    detectionHead: 'Anchor-based vs Center-based detection strategy.',
    featureExtractor: 'Backbone network type used for 3D features.',
  };

  public constructor() {
    // Create reactive form matching AdvancedKnobs interface
    this.form = this.fb.group({
      encodingFormat: ['pillar', Validators.required],
      detectionHead: ['center', Validators.required],
      featureExtractor: ['2d_cnn', Validators.required],
    });
  }

  public ngOnInit(): void {
    // Initialize form from StateService (one-time)
    this.stateService.advancedKnobs$
      .pipe(takeUntil(this.destroy$))
      .subscribe((knobs) => {
        this.lastKnobs = knobs;
        this.form.patchValue(knobs, { emitEvent: false });
      });

    // Wire form changes to state with debounce and distinct
    this.form.valueChanges
      .pipe(
        debounceTime(100),
        distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
        takeUntil(this.destroy$)
      )
      .subscribe((knobs: AdvancedKnobs) => {
        // Prevent redundant emissions if unchanged vs last known state value
        if (this.lastKnobs && JSON.stringify(this.lastKnobs) === JSON.stringify(knobs)) {
          return;
        }
        this.lastKnobs = knobs;
        this.stateService.setAdvancedKnobs(knobs);
      });
  }

  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Toggle advanced controls visibility.
   * Preserves form values when collapsed (no form destruction).
   */
  protected toggleAdvanced(): void {
    this.showAdvanced = !this.showAdvanced;
    console.log('[AdvancedControls] toggled', { showAdvanced: this.showAdvanced });
  }

  /**
   * Handle ESC key to close advanced section.
   * Implements keyboard accessibility requirement (NFR-3.4).
   */
  @HostListener('keydown.escape')
  protected onEscapeKey(): void {
    if (this.showAdvanced) {
      console.log('[AdvancedControls] ESC pressed, closing advanced section');
      this.showAdvanced = false;
    }
  }
}
