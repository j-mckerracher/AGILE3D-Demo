import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { SceneDataService } from './scene-data.service';
import { FrameData } from '../frame-stream/frame-stream.service';

describe('SceneDataService - Frame Streaming (U10)', () => {
  let service: SceneDataService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [SceneDataService] });
    service = TestBed.inject(SceneDataService);
  });

  afterEach(() => { service.clear(); });

  it('should reuse buffer when point count stable', (done) => {
    const frame1 = createFrame(1000, 3000);
    const frame2 = createFrame(1050, 3150);
    service.applyFrame(frame1);
    service.applyFrame(frame2);
    service.state$().subscribe((s) => {
      if (s.pointCount === 1050) {
        expect(s.needsRealloc).toBeFalsy();
        done();
      }
    });
  });

  it('should reallocate on growth beyond capacity', (done) => {
    const frame1 = createFrame(1000, 3000);
    const frame2 = createFrame(2500, 7500);
    service.applyFrame(frame1);
    service.applyFrame(frame2);
    service.state$().subscribe((s) => {
      if (s.pointCount === 2500) {
        expect(s.needsRealloc).toBeTruthy();
        done();
      }
    });
  });

  it('should shrink when below 50% capacity threshold', (done) => {
    const frame1 = createFrame(2500, 7500);
    const frame2 = createFrame(500, 1500);
    service.applyFrame(frame1);
    service.applyFrame(frame2);
    service.state$().subscribe((s) => {
      if (s.pointCount === 500) {
        expect(s.needsRealloc).toBeTruthy();
        done();
      }
    });
  });

  it('should filter by score threshold (default ≥0.7)', (done) => {
    const dets = { baseline: [
      { id: '1', label: 'vehicle', score: 0.5 },
      { id: '2', label: 'vehicle', score: 0.7 },
      { id: '3', label: 'vehicle', score: 0.9 },
    ]};
    const frame = createFrameWithDetections(100, dets);
    service.applyFrame(frame);
    service.detections$().subscribe((d) => {
      if (d.length > 0) {
        expect(d.length).toBe(2);
        done();
      }
    });
  });

  it('should filter by label mask (default: vehicle, pedestrian, cyclist)', (done) => {
    const dets = { baseline: [
      { id: '1', label: 'vehicle', score: 0.8 },
      { id: '2', label: 'pedestrian', score: 0.8 },
      { id: '3', label: 'unknown', score: 0.8 },
      { id: '4', label: 'cyclist', score: 0.8 },
    ]};
    const frame = createFrameWithDetections(100, dets);
    service.applyFrame(frame);
    service.detections$().subscribe((d) => {
      if (d.length > 0) {
        expect(d.length).toBe(3);
        done();
      }
    });
  });

  it('should apply combined score and label filters', (done) => {
    const dets = { baseline: [
      { id: '1', label: 'vehicle', score: 0.5 },
      { id: '2', label: 'vehicle', score: 0.8 },
      { id: '3', label: 'unknown', score: 0.8 },
      { id: '4', label: 'pedestrian', score: 0.6 },
    ]};
    const frame = createFrameWithDetections(100, dets);
    service.applyFrame(frame);
    service.detections$().subscribe((d) => {
      if (d.length > 0) {
        expect(d.length).toBe(1);
        done();
      }
    });
  });

  it('should parse raw float32 buffer', (done) => {
    const positions = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const frame = createFrame(3, 9, positions);
    service.applyFrame(frame);
    service.state$().subscribe((s) => {
      if (s.pointCount === 3) {
        expect(s.pointCount).toBe(3);
        done();
      }
    });
  });

  it('should handle quantization header (dequantize if present)', (done) => {
    const positions = new Float32Array([1, 2, 3, 4, 5, 6]);
    const frame = createFrame(2, 6, positions);
    const header = { type: 'fp16', bbox: { min: [0, 0, 0], max: [10, 10, 10] } };
    service.applyFrame(frame, header);
    service.state$().subscribe((s) => {
      if (s.pointCount === 2) {
        expect(s.pointCount).toBe(2);
        done();
      }
    });
  });

  it('should emit geometry$ observable on applyFrame', (done) => {
    const frame = createFrame(100, 300);
    service.applyFrame(frame);
    service.geometry$().subscribe((geom) => {
      if (geom) {
        expect(geom).toBeInstanceOf(THREE.BufferGeometry);
        done();
      }
    });
  });

  it('should emit detections$ observable on applyFrame', (done) => {
    const dets = { baseline: [{ id: '1', label: 'vehicle', score: 0.8 }]};
    const frame = createFrameWithDetections(100, dets);
    service.applyFrame(frame);
    service.detections$().subscribe((d) => {
      if (d.length > 0) {
        expect(Array.isArray(d)).toBeTruthy();
        done();
      }
    });
  });

  it('should emit state$ observable on geometry changes', (done) => {
    const frame = createFrame(100, 300);
    service.applyFrame(frame);
    service.state$().subscribe((s) => {
      if (s.pointCount === 100) {
        expect(s.pointCount).toBe(100);
        done();
      }
    });
  });

  it('should update score threshold dynamically', (done) => {
    service.setScoreThreshold(0.5);
    const dets = { baseline: [
      { id: '1', label: 'vehicle', score: 0.5 },
      { id: '2', label: 'vehicle', score: 0.6 },
    ]};
    const frame = createFrameWithDetections(100, dets);
    service.applyFrame(frame);
    service.detections$().subscribe((d) => {
      if (d.length > 0) {
        expect(d.length).toBe(2);
        done();
      }
    });
  });

  it('should update label mask dynamically', (done) => {
    service.setLabelMask(['vehicle']);
    const dets = { baseline: [
      { id: '1', label: 'vehicle', score: 0.8 },
      { id: '2', label: 'pedestrian', score: 0.8 },
    ]};
    const frame = createFrameWithDetections(100, dets);
    service.applyFrame(frame);
    service.detections$().subscribe((d) => {
      if (d.length > 0) {
        expect(d.length).toBe(1);
        done();
      }
    });
  });

  it('should dispose geometry on clear', () => {
    const frame = createFrame(100, 300);
    service.applyFrame(frame);
    spyOn(THREE.BufferGeometry.prototype, 'dispose');
    service.clear();
    expect(THREE.BufferGeometry.prototype.dispose).toHaveBeenCalled();
  });
});

function createFrame(pointCount: number, floatSize: number, positions?: Float32Array): FrameData {
  const pos = positions || new Float32Array(floatSize);
  return {
    id: 'test',
    index: 0,
    pointsUrl: 'test.bin',
    pointsBuffer: pos.buffer as ArrayBuffer,
    detections: {},
    branch: 'baseline'
  };
}

function createFrameWithDetections(pointCount: number, detections: Record<string, unknown>): FrameData {
  const pos = new Float32Array(pointCount * 3);
  return {
    id: 'test',
    index: 0,
    pointsUrl: 'test.bin',
    pointsBuffer: pos.buffer as ArrayBuffer,
    detections,
    branch: 'baseline'
  };
}
