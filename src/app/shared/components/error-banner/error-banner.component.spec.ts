import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ErrorBannerComponent } from './error-banner.component';
import { By } from '@angular/platform-browser';
import { FrameStreamService, FrameStreamStatus } from '../../../core/services/frame-stream/frame-stream.service';
import { BehaviorSubject } from 'rxjs';

describe('ErrorBannerComponent (WP-2.3.2)', () => {
  let component: ErrorBannerComponent;
  let fixture: ComponentFixture<ErrorBannerComponent>;
  let mockFrameStreamService: jasmine.SpyObj<FrameStreamService>;
  let statusSubject: BehaviorSubject<FrameStreamStatus>;

  beforeEach(async () => {
    statusSubject = new BehaviorSubject<FrameStreamStatus>(FrameStreamStatus.IDLE);

    mockFrameStreamService = jasmine.createSpyObj<FrameStreamService>(
      'FrameStreamService',
      ['resume'],
      {
        status$: statusSubject.asObservable(),
      }
    );

    await TestBed.configureTestingModule({
      imports: [ErrorBannerComponent],
      providers: [
        { provide: FrameStreamService, useValue: mockFrameStreamService },
      ],
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

  describe('Frame Stream Integration (UoW-U13)', () => {
    it('should show banner when status changes to PAUSED_MISS', () => {
      statusSubject.next(FrameStreamStatus.PAUSED_MISS);
      fixture.detectChanges();

      expect(component.isVisible).toBe(true);
      expect(component.title).toBe('Playback Paused');
      expect(component.showRetryButtons).toBe(true);

      const banner = fixture.debugElement.query(By.css('.error-banner'));
      expect(banner).toBeTruthy();
    });

    it('should hide banner when status changes to PLAYING', () => {
      // First show the banner
      statusSubject.next(FrameStreamStatus.PAUSED_MISS);
      fixture.detectChanges();
      expect(component.isVisible).toBe(true);

      // Then hide it
      statusSubject.next(FrameStreamStatus.PLAYING);
      fixture.detectChanges();

      expect(component.isVisible).toBe(false);
      const banner = fixture.debugElement.query(By.css('.error-banner'));
      expect(banner).toBeNull();
    });

    it('should display retry buttons when PAUSED_MISS', () => {
      statusSubject.next(FrameStreamStatus.PAUSED_MISS);
      fixture.detectChanges();

      const retryBtn = fixture.debugElement.query(
        By.css('.btn-primary')
      );
      const keepTryingBtn = fixture.debugElement.query(
        By.css('.btn-secondary')
      );

      expect(retryBtn).toBeTruthy();
      expect(keepTryingBtn).toBeTruthy();
      expect(retryBtn.nativeElement.textContent).toContain('Retry');
      expect(keepTryingBtn.nativeElement.textContent).toContain('Keep Trying');
    });

    it('should call resume when Retry button is clicked', () => {
      statusSubject.next(FrameStreamStatus.PAUSED_MISS);
      fixture.detectChanges();

      const retryBtn = fixture.debugElement.query(By.css('.btn-primary'));
      retryBtn.nativeElement.click();

      expect(mockFrameStreamService.resume).toHaveBeenCalledTimes(1);
    });

    it('should call resume when onRetry is called', () => {
      component.onRetry();

      expect(mockFrameStreamService.resume).toHaveBeenCalledTimes(1);
    });

    it('should perform auto-retry 5 times with Keep Trying', fakeAsync(() => {
      component.onKeepTrying();

      // Initial retry
      expect(mockFrameStreamService.resume).toHaveBeenCalledTimes(1);

      // Simulate retries at 3-second intervals
      for (let i = 0; i < 4; i++) {
        tick(3000);
      }

      expect(mockFrameStreamService.resume).toHaveBeenCalledTimes(5);
    }));

    it('should initialize with isVisible = false', () => {
      expect(component.isVisible).toBe(false);
    });

    it('should reset retryAttempts when Keep Trying is called', () => {
      component.retryAttempts = 10; // Set to a non-zero value
      component.onKeepTrying();

      expect(component.retryAttempts).toBe(1); // After first retry
    });

    it('should handle dismiss during PAUSED_MISS state', () => {
      statusSubject.next(FrameStreamStatus.PAUSED_MISS);
      fixture.detectChanges();

      spyOn(component.dismissed, 'emit');

      const dismissBtn = fixture.debugElement.query(By.css('.error-dismiss'));
      dismissBtn.nativeElement.click();

      expect(component.isVisible).toBe(false);
      expect(component.dismissed.emit).toHaveBeenCalled();
    });

    it('should have proper ARIA labels for retry buttons', () => {
      statusSubject.next(FrameStreamStatus.PAUSED_MISS);
      fixture.detectChanges();

      const retryBtn = fixture.debugElement.query(By.css('.btn-primary'));
      const keepTryingBtn = fixture.debugElement.query(
        By.css('.btn-secondary')
      );

      expect(retryBtn.nativeElement.getAttribute('aria-label')).toBe(
        'Retry playback immediately'
      );
      expect(keepTryingBtn.nativeElement.getAttribute('aria-label')).toBe(
        'Keep trying playback with auto-retry'
      );
    });

    it('should have group role for retry buttons container', () => {
      statusSubject.next(FrameStreamStatus.PAUSED_MISS);
      fixture.detectChanges();

      const actionsGroup = fixture.debugElement.query(
        By.css('.error-actions')
      );

      expect(actionsGroup.nativeElement.getAttribute('role')).toBe('group');
      expect(actionsGroup.nativeElement.getAttribute('aria-label')).toBe(
        'Playback retry options'
      );
    });
  });

  describe('Reduced Motion (WP-2.3.2, NFR-3.7)', () => {
    it('should check reduced motion preference on initialization', () => {
      // The component already checks reduced motion in constructor
      expect(component.prefersReducedMotion).toBeDefined();
    });

    it('should respect prefers-reduced-motion media query', () => {
      // Create a mock for matchMedia
      const mockMatchMedia = jasmine
        .createSpy('matchMedia')
        .and.returnValue({ matches: true });
      spyOn(window, 'matchMedia').and.callFake(mockMatchMedia);

      // Create a new component to test the constructor
      const testComponent = new ErrorBannerComponent(mockFrameStreamService);

      // The component should have checked the media query
      expect(window.matchMedia).toHaveBeenCalledWith(
        '(prefers-reduced-motion: reduce)'
      );
    });
  });
});
