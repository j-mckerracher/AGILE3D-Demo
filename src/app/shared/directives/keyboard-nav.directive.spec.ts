/**
 * Keyboard Navigation Directive - Unit Tests
 */

import { Component, DebugElement } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { KeyboardNavDirective } from './keyboard-nav.directive';

@Component({
  template: `
    <div
      appKeyboardNav
      [navItems]="navItems"
      [orientation]="orientation"
      [wrap]="wrap"
      [homeEndKeys]="homeEndKeys"
    >
      <button class="nav-item">Item 1</button>
      <button class="nav-item">Item 2</button>
      <button class="nav-item">Item 3</button>
      <button class="nav-item" disabled>Item 4 (disabled)</button>
    </div>
  `,
})
class TestComponent {
  public navItems = '.nav-item';
  public orientation: 'horizontal' | 'vertical' | 'both' = 'horizontal';
  public wrap = true;
  public homeEndKeys = true;
}

describe('KeyboardNavDirective', () => {
  let component: TestComponent;
  let fixture: ComponentFixture<TestComponent>;
  let directiveElement: DebugElement;
  let buttons: HTMLButtonElement[];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [KeyboardNavDirective],
      declarations: [TestComponent],
    });

    fixture = TestBed.createComponent(TestComponent);
    component = fixture.componentInstance;
    directiveElement = fixture.debugElement.query(By.directive(KeyboardNavDirective));
    fixture.detectChanges();

    // Get enabled buttons only
    const nodeList = directiveElement.nativeElement.querySelectorAll('.nav-item:not([disabled])');
    buttons = Array.from(nodeList) as HTMLButtonElement[];
  });

  describe('Initialization', () => {
    it('should create directive', () => {
      const directive = directiveElement.injector.get(KeyboardNavDirective);
      expect(directive).toBeTruthy();
    });

    it('should set tabindex="0" on first item', () => {
      expect(buttons[0]?.getAttribute('tabindex')).toBe('0');
    });

    it('should set tabindex="-1" on other items', () => {
      expect(buttons[1]?.getAttribute('tabindex')).toBe('-1');
      expect(buttons[2]?.getAttribute('tabindex')).toBe('-1');
    });

    it('should exclude disabled items', () => {
      const disabledButton = directiveElement.nativeElement.querySelector('button[disabled]');
      expect(disabledButton).toBeTruthy();
      expect(buttons.length).toBe(3); // Should only have 3 enabled buttons
    });
  });

  describe('Horizontal Navigation', () => {
    beforeEach(() => {
      component.orientation = 'horizontal';
      fixture.detectChanges();
    });

    it('should move focus right with ArrowRight', () => {
      buttons[0]?.focus();
      const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });
      spyOn(event, 'preventDefault');

      directiveElement.nativeElement.dispatchEvent(event);
      fixture.detectChanges();

      expect(event.preventDefault).toHaveBeenCalled();
      expect(buttons[1]?.getAttribute('tabindex')).toBe('0');
      expect(buttons[0]?.getAttribute('tabindex')).toBe('-1');
    });

    it('should move focus left with ArrowLeft', () => {
      buttons[1]?.focus();
      buttons[1]?.setAttribute('tabindex', '0');
      const event = new KeyboardEvent('keydown', { key: 'ArrowLeft' });
      spyOn(event, 'preventDefault');

      directiveElement.nativeElement.dispatchEvent(event);
      fixture.detectChanges();

      expect(event.preventDefault).toHaveBeenCalled();
      expect(buttons[0]?.getAttribute('tabindex')).toBe('0');
    });

    it('should wrap to beginning when at end', () => {
      buttons[2]?.focus();
      buttons[2]?.setAttribute('tabindex', '0');
      const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });

      directiveElement.nativeElement.dispatchEvent(event);
      fixture.detectChanges();

      expect(buttons[0]?.getAttribute('tabindex')).toBe('0');
    });

    it('should not move focus with ArrowUp/Down in horizontal mode', () => {
      buttons[0]?.focus();
      const eventDown = new KeyboardEvent('keydown', { key: 'ArrowDown' });
      spyOn(eventDown, 'preventDefault');

      directiveElement.nativeElement.dispatchEvent(eventDown);
      fixture.detectChanges();

      expect(eventDown.preventDefault).not.toHaveBeenCalled();
    });
  });

  describe('Vertical Navigation', () => {
    beforeEach(() => {
      component.orientation = 'vertical';
      fixture.detectChanges();
    });

    it('should move focus down with ArrowDown', () => {
      buttons[0]?.focus();
      const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });
      spyOn(event, 'preventDefault');

      directiveElement.nativeElement.dispatchEvent(event);
      fixture.detectChanges();

      expect(event.preventDefault).toHaveBeenCalled();
      expect(buttons[1]?.getAttribute('tabindex')).toBe('0');
    });

    it('should move focus up with ArrowUp', () => {
      buttons[1]?.focus();
      buttons[1]?.setAttribute('tabindex', '0');
      const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });
      spyOn(event, 'preventDefault');

      directiveElement.nativeElement.dispatchEvent(event);
      fixture.detectChanges();

      expect(event.preventDefault).toHaveBeenCalled();
      expect(buttons[0]?.getAttribute('tabindex')).toBe('0');
    });
  });

  describe('Home/End Keys', () => {
    it('should move to first item with Home key', () => {
      buttons[2]?.focus();
      buttons[2]?.setAttribute('tabindex', '0');
      const event = new KeyboardEvent('keydown', { key: 'Home' });
      spyOn(event, 'preventDefault');

      directiveElement.nativeElement.dispatchEvent(event);
      fixture.detectChanges();

      expect(event.preventDefault).toHaveBeenCalled();
      expect(buttons[0]?.getAttribute('tabindex')).toBe('0');
    });

    it('should move to last item with End key', () => {
      buttons[0]?.focus();
      const event = new KeyboardEvent('keydown', { key: 'End' });
      spyOn(event, 'preventDefault');

      directiveElement.nativeElement.dispatchEvent(event);
      fixture.detectChanges();

      expect(event.preventDefault).toHaveBeenCalled();
      expect(buttons[2]?.getAttribute('tabindex')).toBe('0');
    });

    it('should not handle Home/End when homeEndKeys is false', () => {
      component.homeEndKeys = false;
      fixture.detectChanges();

      buttons[0]?.focus();
      const event = new KeyboardEvent('keydown', { key: 'Home' });
      spyOn(event, 'preventDefault');

      directiveElement.nativeElement.dispatchEvent(event);
      fixture.detectChanges();

      expect(event.preventDefault).not.toHaveBeenCalled();
    });
  });

  describe('Wrap Behavior', () => {
    it('should not wrap when wrap is false', () => {
      component.wrap = false;
      fixture.detectChanges();

      buttons[2]?.focus();
      buttons[2]?.setAttribute('tabindex', '0');
      const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });

      directiveElement.nativeElement.dispatchEvent(event);
      fixture.detectChanges();

      // Should stay on last item
      expect(buttons[2]?.getAttribute('tabindex')).toBe('0');
    });
  });
});
