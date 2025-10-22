import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ErrorBannerComponent } from './error-banner.component';
import { By } from '@angular/platform-browser';

describe('ErrorBannerComponent (WP-2.3.2)', () => {
  let component: ErrorBannerComponent;
  let fixture: ComponentFixture<ErrorBannerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ErrorBannerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ErrorBannerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Accessibility', () => {
    it('should have role="alert" for screen readers', () => {
      const banner = fixture.debugElement.query(By.css('.error-banner'));
      expect(banner.nativeElement.getAttribute('role')).toBe('alert');
    });

    it('should have aria-live="assertive" for immediate announcement', () => {
      const banner = fixture.debugElement.query(By.css('.error-banner'));
      expect(banner.nativeElement.getAttribute('aria-live')).toBe('assertive');
    });

    it('should have aria-atomic="true"', () => {
      const banner = fixture.debugElement.query(By.css('.error-banner'));
      expect(banner.nativeElement.getAttribute('aria-atomic')).toBe('true');
    });

    it('should have accessible dismiss button with aria-label', () => {
      component.showDismiss = true;
      fixture.detectChanges();

      const dismissBtn = fixture.debugElement.query(By.css('.error-dismiss'));
      expect(dismissBtn).toBeTruthy();
      expect(dismissBtn.nativeElement.getAttribute('aria-label')).toBe(
        'Dismiss error notification'
      );
    });
  });

  describe('Content Rendering', () => {
    it('should display default title and message', () => {
      const title = fixture.debugElement.query(By.css('.error-title'));
      const message = fixture.debugElement.query(By.css('.error-message'));

      expect(title.nativeElement.textContent).toBe('Error');
      expect(message.nativeElement.textContent).toBe('Something went wrong.');
    });

    it('should display custom title and message', () => {
      component.title = 'Custom Error';
      component.message = 'Custom message text';
      fixture.detectChanges();

      const title = fixture.debugElement.query(By.css('.error-title'));
      const message = fixture.debugElement.query(By.css('.error-message'));

      expect(title.nativeElement.textContent).toBe('Custom Error');
      expect(message.nativeElement.textContent).toBe('Custom message text');
    });

    it('should render action links when provided', () => {
      component.links = [
        { label: 'Help', href: 'https://example.com/help' },
        { label: 'Docs', href: 'https://example.com/docs' },
      ];
      fixture.detectChanges();

      const links = fixture.debugElement.queryAll(By.css('.error-link'));
      expect(links.length).toBe(2);
      expect(links[0]!.nativeElement.textContent).toContain('Help');
      expect(links[0]!.nativeElement.href).toBe('https://example.com/help');
      expect(links[1]!.nativeElement.textContent).toContain('Docs');
    });

    it('should not render links section when empty', () => {
      component.links = [];
      fixture.detectChanges();

      const linksContainer = fixture.debugElement.query(By.css('.error-links'));
      expect(linksContainer).toBeNull();
    });

    it('should add target="_blank" and rel attributes to links', () => {
      component.links = [{ label: 'External', href: 'https://external.com' }];
      fixture.detectChanges();

      const link = fixture.debugElement.query(By.css('.error-link'));
      expect(link.nativeElement.getAttribute('target')).toBe('_blank');
      expect(link.nativeElement.getAttribute('rel')).toBe('noopener noreferrer');
    });
  });

  describe('Dismiss Functionality', () => {
    it('should show dismiss button when showDismiss is true', () => {
      component.showDismiss = true;
      fixture.detectChanges();

      const dismissBtn = fixture.debugElement.query(By.css('.error-dismiss'));
      expect(dismissBtn).toBeTruthy();
    });

    it('should hide dismiss button when showDismiss is false', () => {
      component.showDismiss = false;
      fixture.detectChanges();

      const dismissBtn = fixture.debugElement.query(By.css('.error-dismiss'));
      expect(dismissBtn).toBeNull();
    });

    it('should emit dismissed event when button is clicked', () => {
      component.showDismiss = true;
      fixture.detectChanges();

      spyOn(component.dismissed, 'emit');

      const dismissBtn = fixture.debugElement.query(By.css('.error-dismiss'));
      dismissBtn.nativeElement.click();

      expect(component.dismissed.emit).toHaveBeenCalled();
    });

    it('should call onDismiss() when dismiss button is clicked', () => {
      component.showDismiss = true;
      fixture.detectChanges();

      spyOn(component, 'onDismiss');

      const dismissBtn = fixture.debugElement.query(By.css('.error-dismiss'));
      dismissBtn.nativeElement.click();

      expect(component.onDismiss).toHaveBeenCalled();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should have dismiss button focusable', () => {
      component.showDismiss = true;
      fixture.detectChanges();

      const dismissBtn = fixture.debugElement.query(By.css('.error-dismiss'));
      expect(dismissBtn.nativeElement.tabIndex).toBeGreaterThanOrEqual(0);
    });

    it('should have links keyboard accessible', () => {
      component.links = [{ label: 'Test', href: 'https://test.com' }];
      fixture.detectChanges();

      const link = fixture.debugElement.query(By.css('.error-link'));
      expect(link.nativeElement.tabIndex).toBeGreaterThanOrEqual(-1);
    });
  });
});
