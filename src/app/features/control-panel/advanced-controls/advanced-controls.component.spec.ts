/**
 * Advanced Controls Component Unit Tests
 *
 * Tests WP-2.2.2 requirements:
 * - Hidden by default, revealed via toggle (FR-2.7)
 * - Form initialization from StateService
 * - Debounced form changes (100ms)
 * - Distinct emission prevention
 * - ESC key handler
 * - ARIA attributes for accessibility
 * - Tooltips present
 * - Value preservation when toggled
 *
 * @see WP-2.2.2 (Advanced Controls implementation)
 * @see PRD FR-2.7–2.9 (Advanced controls requirements)
 */

import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { AdvancedControlsComponent } from './advanced-controls.component';
import { StateService } from '../../../core/services/state/state.service';
import { AdvancedKnobs } from '../../../core/models/config-and-metrics';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { MatSelectHarness } from '@angular/material/select/testing';
import { MatTooltipHarness } from '@angular/material/tooltip/testing';

describe('AdvancedControlsComponent (WP-2.2.2)', () => {
  let component: AdvancedControlsComponent;
  let fixture: ComponentFixture<AdvancedControlsComponent>;
  let stateService: StateService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdvancedControlsComponent, ReactiveFormsModule, NoopAnimationsModule],
      providers: [StateService],
    }).compileComponents();

    fixture = TestBed.createComponent(AdvancedControlsComponent);
    component = fixture.componentInstance;
    stateService = TestBed.inject(StateService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // FR-2.7: Advanced section hidden by default
  describe('visibility toggle (FR-2.7)', () => {
    it('should be hidden by default', () => {
      expect(component['showAdvanced']).toBe(false);

      const panel = fixture.nativeElement.querySelector('.advanced-panel');
      expect(panel).toBeTruthy();
      expect(panel.classList.contains('visible')).toBe(false);
    });

    it('should reveal advanced section when toggle is clicked', () => {
      const toggleButton = fixture.nativeElement.querySelector('.advanced-toggle');
      expect(toggleButton).toBeTruthy();

      toggleButton.click();
      fixture.detectChanges();

      expect(component['showAdvanced']).toBe(true);
      const panel = fixture.nativeElement.querySelector('.advanced-panel');
      expect(panel.classList.contains('visible')).toBe(true);
    });

    it('should toggle visibility on multiple clicks', () => {
      const toggleButton = fixture.nativeElement.querySelector('.advanced-toggle');

      // Click 1: Show
      toggleButton.click();
      fixture.detectChanges();
      expect(component['showAdvanced']).toBe(true);

      // Click 2: Hide
      toggleButton.click();
      fixture.detectChanges();
      expect(component['showAdvanced']).toBe(false);

      // Click 3: Show again
      toggleButton.click();
      fixture.detectChanges();
      expect(component['showAdvanced']).toBe(true);
    });

    it('should preserve form values when toggled (no form destruction)', () => {
      // Set custom values
      component['form'].patchValue({
        encodingFormat: 'voxel',
        detectionHead: 'anchor',
        featureExtractor: 'transformer',
      });

      // Toggle visibility
      component['toggleAdvanced']();
      fixture.detectChanges();

      // Toggle back
      component['toggleAdvanced']();
      fixture.detectChanges();

      // Values should be preserved
      const formValue = component['form'].value;
      expect(formValue.encodingFormat).toBe('voxel');
      expect(formValue.detectionHead).toBe('anchor');
      expect(formValue.featureExtractor).toBe('transformer');
    });
  });

  // FR-2.8: Form initialization and wiring
  describe('form initialization (FR-2.8)', () => {
    it('should initialize form from StateService advancedKnobs$', fakeAsync(() => {
      // StateService defaults: pillar, center, 2d_cnn
      tick(); // Allow initial subscription to complete

      const formValue = component['form'].value;
      expect(formValue).toEqual({
        encodingFormat: 'pillar',
        detectionHead: 'center',
        featureExtractor: '2d_cnn',
      });
    }));

    it('should patch form value when StateService advancedKnobs$ emits', fakeAsync(() => {
      tick(); // Allow initial subscription

      // Update state
      const newKnobs: AdvancedKnobs = {
        encodingFormat: 'voxel',
        detectionHead: 'anchor',
        featureExtractor: 'sparse_cnn',
      };
      stateService.setAdvancedKnobs(newKnobs);
      tick();

      const formValue = component['form'].value;
      expect(formValue).toEqual(newKnobs);
    }));
  });

  // FR-2.8: Debounced form changes
  describe('form value changes with debounce', () => {
    it('should emit to StateService after 100ms debounce', fakeAsync(() => {
      const spy = spyOn(stateService, 'setAdvancedKnobs');
      tick(); // Allow initial subscription

      // Change form value
      component['form'].patchValue({ encodingFormat: 'voxel' });

      // Should not emit immediately
      expect(spy).not.toHaveBeenCalled();

      // Wait 100ms for debounce
      tick(100);

      // Now should have emitted
      expect(spy).toHaveBeenCalledWith({
        encodingFormat: 'voxel',
        detectionHead: 'center',
        featureExtractor: '2d_cnn',
      });
    }));

    it('should debounce rapid form changes and emit only final value', fakeAsync(() => {
      const spy = spyOn(stateService, 'setAdvancedKnobs');
      tick(); // Allow initial subscription

      // Rapid fire changes within 100ms window
      component['form'].patchValue({ encodingFormat: 'voxel' });
      tick(20);
      component['form'].patchValue({ detectionHead: 'anchor' });
      tick(20);
      component['form'].patchValue({ featureExtractor: 'transformer' });

      // Still within debounce window - should not have emitted yet
      expect(spy).not.toHaveBeenCalled();

      // Wait for debounce
      tick(100);

      // Should emit only once with final values
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith({
        encodingFormat: 'voxel',
        detectionHead: 'anchor',
        featureExtractor: 'transformer',
      });
    }));
  });

  // FR-2.8: Distinct emission prevention
  describe('distinct emission prevention', () => {
    it('should not emit to StateService if values are unchanged', fakeAsync(() => {
      const spy = spyOn(stateService, 'setAdvancedKnobs');
      tick(); // Allow initial subscription

      // Set same values as defaults
      component['form'].patchValue({
        encodingFormat: 'pillar',
        detectionHead: 'center',
        featureExtractor: '2d_cnn',
      });
      tick(100);

      // Should not emit because values are the same (deep equality)
      expect(spy).not.toHaveBeenCalled();
    }));
  });

  // NFR-3.4: Keyboard accessibility
  describe('keyboard accessibility (NFR-3.4)', () => {
    it('should close advanced section on ESC key press', () => {
      // Show advanced section
      component['showAdvanced'] = true;
      fixture.detectChanges();
      expect(component['showAdvanced']).toBe(true);

      // Simulate ESC key press
      component['onEscapeKey']();

      expect(component['showAdvanced']).toBe(false);
    });

    it('should not respond to ESC if already closed', () => {
      // Ensure section is closed
      component['showAdvanced'] = false;

      // Simulate ESC key press
      component['onEscapeKey']();

      // Should still be false (no change)
      expect(component['showAdvanced']).toBe(false);
    });
  });

  // NFR-3.4: ARIA attributes
  describe('ARIA attributes (NFR-3.4)', () => {
    it('should have aria-expanded="false" when closed', () => {
      component['showAdvanced'] = false;
      fixture.detectChanges();

      const toggleButton = fixture.nativeElement.querySelector('.advanced-toggle');
      expect(toggleButton.getAttribute('aria-expanded')).toBe('false');
    });

    it('should have aria-expanded="true" when open', () => {
      component['showAdvanced'] = true;
      fixture.detectChanges();

      const toggleButton = fixture.nativeElement.querySelector('.advanced-toggle');
      expect(toggleButton.getAttribute('aria-expanded')).toBe('true');
    });

    it('should have aria-controls pointing to advanced-panel', () => {
      const toggleButton = fixture.nativeElement.querySelector('.advanced-toggle');
      expect(toggleButton.getAttribute('aria-controls')).toBe('advanced-panel');
    });

    it('should have aria-hidden on panel when closed', () => {
      component['showAdvanced'] = false;
      fixture.detectChanges();

      const panel = fixture.nativeElement.querySelector('#advanced-panel');
      expect(panel.getAttribute('aria-hidden')).toBe('true');
    });

    it('should not have aria-hidden on panel when open', () => {
      component['showAdvanced'] = true;
      fixture.detectChanges();

      const panel = fixture.nativeElement.querySelector('#advanced-panel');
      expect(panel.getAttribute('aria-hidden')).toBe('false');
    });

    it('should have aria-label on all form controls', () => {
      component['showAdvanced'] = true;
      fixture.detectChanges();

      const encodingSelect = fixture.nativeElement.querySelector(
        'mat-select[formControlName="encodingFormat"]'
      );
      const detectionSelect = fixture.nativeElement.querySelector(
        'mat-select[formControlName="detectionHead"]'
      );
      const extractorSelect = fixture.nativeElement.querySelector(
        'mat-select[formControlName="featureExtractor"]'
      );

      expect(encodingSelect.getAttribute('aria-label')).toContain('encoding format');
      expect(detectionSelect.getAttribute('aria-label')).toContain('detection head');
      expect(extractorSelect.getAttribute('aria-label')).toContain('feature extractor');
    });
  });

  // FR-2.9: Tooltips
  describe('tooltips (FR-2.9)', () => {
    it('should expose tooltips for all controls via harness', async () => {
      component['showAdvanced'] = true;
      fixture.detectChanges();
      const loader = TestbedHarnessEnvironment.loader(fixture);

      const tooltips = await loader.getAllHarnesses(MatTooltipHarness);
      // Expect at least 3 tooltip directives (one per select)
      expect(tooltips.length).toBeGreaterThanOrEqual(3);

      const messages: string[] = [];
      for (const t of tooltips) {
        try {
          await t.show();
          messages.push(await t.getTooltipText());
          await t.hide();
          // eslint-disable-next-line no-empty
        } catch {}
      }
      const joined = messages.join(' | ').toLowerCase();
      expect(joined).toContain('encoding');
      expect(joined).toContain('detection');
      expect(joined).toContain('feature');
    });

    it('should have correct tooltip content', () => {
      expect(component['tooltips'].encodingFormat).toBe(
        'Voxel vs Pillar encoding affects feature layout and latency.'
      );
      expect(component['tooltips'].detectionHead).toBe(
        'Anchor-based vs Center-based detection strategy.'
      );
      expect(component['tooltips'].featureExtractor).toBe(
        'Backbone network type used for 3D features.'
      );
    });
  });

  // FR-2.8: Form control options
  describe('form control options (FR-2.8)', () => {
    it('should have correct encoding format options', async () => {
      component['showAdvanced'] = true;
      fixture.detectChanges();
      const loader = TestbedHarnessEnvironment.loader(fixture);
      const select = await loader.getHarness(
        MatSelectHarness.with({ selector: 'mat-select[formControlName="encodingFormat"]' })
      );
      await select.open();
      const options = await select.getOptions();
      expect(options.length).toBe(2);
      const texts = await Promise.all(options.map((o) => o.getText()));
      expect(texts).toContain('Voxel');
      expect(texts).toContain('Pillar');
    });

    it('should have correct detection head options', async () => {
      component['showAdvanced'] = true;
      fixture.detectChanges();
      const loader = TestbedHarnessEnvironment.loader(fixture);
      const select = await loader.getHarness(
        MatSelectHarness.with({ selector: 'mat-select[formControlName="detectionHead"]' })
      );
      await select.open();
      const options = await select.getOptions();
      expect(options.length).toBe(2);
      const texts = await Promise.all(options.map((o) => o.getText()));
      expect(texts).toContain('Anchor-based');
      expect(texts).toContain('Center-based');
    });

    it('should have correct feature extractor options', async () => {
      component['showAdvanced'] = true;
      fixture.detectChanges();
      const loader = TestbedHarnessEnvironment.loader(fixture);
      const select = await loader.getHarness(
        MatSelectHarness.with({ selector: 'mat-select[formControlName="featureExtractor"]' })
      );
      await select.open();
      const options = await select.getOptions();
      expect(options.length).toBe(3);
      const texts = await Promise.all(options.map((o) => o.getText()));
      expect(texts).toContain('Transformer');
      expect(texts).toContain('Sparse CNN');
      expect(texts).toContain('2D CNN');
    });
  });

  // Component lifecycle
  describe('lifecycle', () => {
    it('should cleanup subscriptions on destroy', () => {
      const destroySpy = spyOn(component['destroy$'], 'next');
      const completeSpy = spyOn(component['destroy$'], 'complete');

      component.ngOnDestroy();

      expect(destroySpy).toHaveBeenCalled();
      expect(completeSpy).toHaveBeenCalled();
    });
  });
});
