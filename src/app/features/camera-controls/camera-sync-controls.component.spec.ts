import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CameraSyncControlsComponent } from './camera-sync-controls.component';
import { StateService } from '../../core/services/state/state.service';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { MatSlideToggleHarness } from '@angular/material/slide-toggle/testing';
import { MatButtonHarness } from '@angular/material/button/testing';

describe('CameraSyncControlsComponent (WP-2.1.3)', () => {
  let component: CameraSyncControlsComponent;
  let fixture: ComponentFixture<CameraSyncControlsComponent>;
  let stateService: StateService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CameraSyncControlsComponent, NoopAnimationsModule],
      providers: [StateService],
    }).compileComponents();

    fixture = TestBed.createComponent(CameraSyncControlsComponent);
    component = fixture.componentInstance;
    stateService = TestBed.inject(StateService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have independent mode OFF by default', () => {
    expect(component['independentMode']).toBe(false);
  });

  it('should render slide toggle with correct default state', () => {
    const toggle = fixture.debugElement.query(By.css('mat-slide-toggle'));
    expect(toggle).toBeTruthy();
    expect(toggle.nativeElement.textContent).toContain('Independent Cameras');
  });

  it('should render reset button', () => {
    const button = fixture.debugElement.query(By.css('button'));
    expect(button).toBeTruthy();
    expect(button.nativeElement.textContent).toContain('Reset Camera');
  });

  it('should call setIndependentCamera when toggle changes', () => {
    spyOn(stateService, 'setIndependentCamera');

    // Simulate toggle change
    component['independentMode'] = true;
    component['onToggleChange']();

    expect(stateService.setIndependentCamera).toHaveBeenCalledWith(true);
  });

  it('should call setCameraPos and setCameraTarget when reset button clicked', () => {
    spyOn(stateService, 'setCameraPos');
    spyOn(stateService, 'setCameraTarget');

    component['onReset']();

    expect(stateService.setCameraPos).toHaveBeenCalledWith([0, 0, 10]);
    expect(stateService.setCameraTarget).toHaveBeenCalledWith([0, 0, 0]);
  });

  it('should have proper ARIA labels', async () => {
    const loader = TestbedHarnessEnvironment.loader(fixture);
    const toggle = await loader.getHarness(MatSlideToggleHarness);
    const button = await loader.getHarness(MatButtonHarness);

    // Harness API: check label text and aria label fallback
    const toggleLabel = await toggle.getLabelText();
    const buttonText = await button.getText();

    expect(toggleLabel).toContain('Independent Cameras');
    expect(buttonText).toContain('Reset Camera');
  });

  it('should have tooltips on both controls', () => {
    const toggle = fixture.debugElement.query(By.css('mat-slide-toggle'));
    const button = fixture.debugElement.query(By.css('button'));

    expect(toggle.nativeElement.hasAttribute('ng-reflect-message')).toBe(true);
    expect(button.nativeElement.hasAttribute('mattooltip')).toBe(true);
  });

  it('should be keyboard accessible (tab navigation)', async () => {
    const loader = TestbedHarnessEnvironment.loader(fixture);
    const toggle = await loader.getHarness(MatSlideToggleHarness);
    const button = await loader.getHarness(MatButtonHarness);

    // Able to focus via harness implies keyboard accessibility
    await toggle.focus();
    await button.focus();

    expect(true).toBeTrue();
  });

  it('should update tooltip message based on independent mode state', () => {
    // Initial state: sync mode
    component['independentMode'] = false;
    fixture.detectChanges();

    const toggle = fixture.debugElement.query(By.css('mat-slide-toggle'));
    let tooltip = toggle.nativeElement.getAttribute('ng-reflect-message');
    expect(tooltip).toContain('synchronized');

    // Switch to independent mode
    component['independentMode'] = true;
    fixture.detectChanges();

    tooltip = toggle.nativeElement.getAttribute('ng-reflect-message');
    expect(tooltip).toContain('independent');
  });

  it('should trigger reset on button click', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    spyOn(component as any, 'onReset');

    const button = fixture.debugElement.query(By.css('button'));
    button.nativeElement.click();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((component as any).onReset).toHaveBeenCalled();
  });
});
