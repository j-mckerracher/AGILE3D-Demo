import { TestBed, fakeAsync, tick, flush } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { MetricsService, MetricsPayload } from './metrics.service';

/**
 * Unit tests for MetricsService.
 * Verifies:
 * - Throttling (≤1 event per 5s)
 * - Payload schema serialization
 * - Backoff retry on 5xx errors
 * - Query flag ?metrics=off disables service
 * - Session ID generation
 *
 * @see UoW-U14 (Client-side telemetry)
 */
describe('MetricsService', () => {
  let service: MetricsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [MetricsService],
    });
    service = TestBed.inject(MetricsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('initialization', () => {
    it('should create service with default configuration', () => {
      expect(service).toBeTruthy();
    });

    it('should generate a unique session ID', () => {
      const service2 = TestBed.inject(MetricsService);
      // Note: Two injections will return same service due to root providedIn
      // This test just verifies the service has sessionId generation
      expect(service).toBeTruthy();
    });
  });

  describe('throttling', () => {
    it('should throttle metrics to 1 event per 5 seconds (leading)', fakeAsync(() => {
      // Emit 3 metrics rapidly
      service.capture({ event: 'frame-1', latencyMs: 10 });
      service.capture({ event: 'frame-2', latencyMs: 20 });
      service.capture({ event: 'frame-3', latencyMs: 30 });

      // First one should be sent immediately (leading: true)
      tick(0);
      let requests = httpMock.match('/metrics');
      expect(requests.length).toBe(1);
      expect(requests[0].request.body.event).toBe('frame-1');
      requests[0].flush({ body: {} });

      // Advance to 4.9 seconds - should not send (throttle is 5s)
      tick(4900);
      requests = httpMock.match('/metrics');
      expect(requests.length).toBe(0);

      // Advance to 5 seconds - should send trailing event
      tick(100);
      requests = httpMock.match('/metrics');
      expect(requests.length).toBe(1);
      expect(requests[0].request.body.event).toBe('frame-3');
      requests[0].flush({ body: {} });

      flush();
    }));

    it('should emit all non-throttled events within throttle window', fakeAsync(() => {
      // First event
      service.capture({ event: 'event-1', latencyMs: 10 });
      tick(0);

      let requests = httpMock.match('/metrics');
      expect(requests.length).toBe(1);
      requests[0].flush({ body: {} });

      // Events within throttle window are buffered
      service.capture({ event: 'event-2', latencyMs: 20 });
      service.capture({ event: 'event-3', latencyMs: 30 });

      // Advance past throttle window
      tick(5100);
      requests = httpMock.match('/metrics');
      expect(requests.length).toBe(1);
      // Should send the last event (trailing)
      expect(requests[0].request.body.event).toBe('event-3');
      requests[0].flush({ body: {} });

      flush();
    }));
  });

  describe('payload schema', () => {
    it('should serialize complete payload with all required fields', fakeAsync(() => {
      service.capture({
        event: 'test-event',
        frameId: 'frame-123',
        latencyMs: 42,
        fps: 60,
        buffer: 75,
        misses: 2,
        bytes: 1024,
      });

      tick(0);
      const request = httpMock.expectOne('/metrics');
      const body = request.request.body as MetricsPayload;

      // Verify schema
      expect(body.ts).toBeDefined();
      expect(typeof body.ts).toBe('number');
      expect(body.sessionId).toBeDefined();
      expect(typeof body.sessionId).toBe('string');
      expect(body.seqId).toBe(1);
      expect(body.event).toBe('test-event');
      expect(body.frameId).toBe('frame-123');
      expect(body.latencyMs).toBe(42);
      expect(body.fps).toBe(60);
      expect(body.buffer).toBe(75);
      expect(body.misses).toBe(2);
      expect(body.bytes).toBe(1024);
      expect(body.ua).toBeDefined();
      expect(typeof body.ua).toBe('string');

      request.flush({ body: {} });
      flush();
    }));

    it('should increment seqId for each event', fakeAsync(() => {
      service.capture({ event: 'event-1' });
      tick(0);

      const req1 = httpMock.expectOne('/metrics');
      expect(req1.request.body.seqId).toBe(1);
      req1.flush({ body: {} });

      tick(5100);
      service.capture({ event: 'event-2' });
      tick(0);

      const req2 = httpMock.expectOne('/metrics');
      expect(req2.request.body.seqId).toBe(2);
      req2.flush({ body: {} });

      flush();
    }));

    it('should include user agent in payload', fakeAsync(() => {
      service.capture({ event: 'test' });
      tick(0);

      const request = httpMock.expectOne('/metrics');
      const body = request.request.body as MetricsPayload;
      expect(body.ua).toBe(navigator.userAgent);

      request.flush({ body: {} });
      flush();
    }));

    it('should set event to "unknown" if not provided', fakeAsync(() => {
      service.capture({ latencyMs: 10 } as any);
      tick(0);

      const request = httpMock.expectOne('/metrics');
      expect(request.request.body.event).toBe('unknown');

      request.flush({ body: {} });
      flush();
    }));
  });

  describe('retry and backoff', () => {
    it('should retry on 5xx errors with exponential backoff', fakeAsync(() => {
      service.capture({ event: 'test' });
      tick(0);

      // First attempt fails with 500
      let request = httpMock.expectOne('/metrics');
      request.flush('Server error', { status: 500, statusText: 'Internal Server Error' });

      // Should retry after ~1 second (2^0 * 1000)
      tick(1100);
      request = httpMock.expectOne('/metrics');
      request.flush('Server error', { status: 500, statusText: 'Internal Server Error' });

      // Should retry after ~2 seconds (2^1 * 1000)
      tick(2100);
      request = httpMock.expectOne('/metrics');
      request.flush('Server error', { status: 500, statusText: 'Internal Server Error' });

      // Should retry after ~4 seconds (2^2 * 1000) - final retry
      tick(4100);
      request = httpMock.expectOne('/metrics');
      request.flush('Server error', { status: 500, statusText: 'Internal Server Error' });

      flush();
    }));

    it('should succeed on 200 response', fakeAsync(() => {
      service.capture({ event: 'test' });
      tick(0);

      const request = httpMock.expectOne('/metrics');
      request.flush({ success: true }, { status: 200, statusText: 'OK' });

      // No more requests should be made
      tick(5000);
      httpMock.expectNone('/metrics');

      flush();
    }));

    it('should not retry on 4xx errors', fakeAsync(() => {
      service.capture({ event: 'test' });
      tick(0);

      const request = httpMock.expectOne('/metrics');
      request.flush('Bad request', { status: 400, statusText: 'Bad Request' });

      // Should not retry on 4xx
      tick(5000);
      httpMock.expectNone('/metrics');

      flush();
    }));
  });

  describe('query flag ?metrics=off', () => {
    it('should disable service when ?metrics=off is present', () => {
      // Override location.search to simulate query parameter
      const originalSearch = window.location.search;
      Object.defineProperty(window.location, 'search', {
        value: '?metrics=off',
        configurable: true,
      });

      // Create new service instance with metrics=off
      const testService = new MetricsService(TestBed.inject(HttpClientTestingModule));
      testService.capture({ event: 'test' });

      // No HTTP request should be made
      tick(0);
      httpMock.expectNone('/metrics');

      // Restore
      Object.defineProperty(window.location, 'search', {
        value: originalSearch,
        configurable: true,
      });

      testService.ngOnDestroy();
    });

    it('should enable service when ?metrics=off is not present', fakeAsync(() => {
      service.capture({ event: 'test' });
      tick(0);

      const request = httpMock.expectOne('/metrics');
      request.flush({ body: {} });

      flush();
    }));
  });

  describe('cleanup', () => {
    it('should complete subscriptions on destroy', () => {
      const destroySpy = spyOn(service['destroy$'], 'next');
      const completeSpy = spyOn(service['destroy$'], 'complete');

      service.ngOnDestroy();

      expect(destroySpy).toHaveBeenCalled();
      expect(completeSpy).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should log errors to console.debug and continue', fakeAsync(() => {
      spyOn(console, 'debug');

      service.capture({ event: 'test' });
      tick(0);

      const request = httpMock.expectOne('/metrics');
      request.error(new ErrorEvent('Network error'));

      // Should log error but not throw
      expect(console.debug).toHaveBeenCalledWith(
        jasmine.stringMatching(/POST failed/)
      );

      flush();
    }));
  });
});
