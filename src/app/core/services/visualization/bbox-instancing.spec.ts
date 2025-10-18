import * as THREE from 'three';
import {
  buildClassBatches,
  updateInstancedMesh,
  disposeClassBatches,
  getInstanceMetadata,
  ClassColors,
} from './bbox-instancing';
import { Detection } from '../../models/scene.models';

describe('BBox Instancing Utilities', () => {
  let colors: ClassColors;

  beforeEach(() => {
    colors = {
      vehicle: new THREE.Color(0x3b82f6),
      pedestrian: new THREE.Color(0xef4444),
      cyclist: new THREE.Color(0xf97316),
    };
  });

  describe('buildClassBatches', () => {
    it('should create separate InstancedMesh for each class', () => {
      const detections: Detection[] = [
        {
          id: 'v1',
          class: 'vehicle',
          center: [0, 0, 0],
          dimensions: { width: 2, length: 4, height: 1.5 },
          yaw: 0,
          confidence: 0.95,
        },
        {
          id: 'p1',
          class: 'pedestrian',
          center: [5, 5, 0],
          dimensions: { width: 0.5, length: 0.5, height: 1.8 },
          yaw: 0,
          confidence: 0.88,
        },
        {
          id: 'c1',
          class: 'cyclist',
          center: [10, 10, 0],
          dimensions: { width: 0.6, length: 1.8, height: 1.2 },
          yaw: 0,
          confidence: 0.8,
        },
      ];

      const batches = buildClassBatches(detections, colors);

      expect(batches.vehicle).toBeTruthy();
      expect(batches.pedestrian).toBeTruthy();
      expect(batches.cyclist).toBeTruthy();

      expect(batches.vehicle?.count).toBe(1);
      expect(batches.pedestrian?.count).toBe(1);
      expect(batches.cyclist?.count).toBe(1);
    });

    it('should group multiple detections of same class', () => {
      const detections: Detection[] = [
        {
          id: 'v1',
          class: 'vehicle',
          center: [0, 0, 0],
          dimensions: { width: 2, length: 4, height: 1.5 },
          yaw: 0,
          confidence: 0.95,
        },
        {
          id: 'v2',
          class: 'vehicle',
          center: [5, 5, 0],
          dimensions: { width: 2, length: 4, height: 1.5 },
          yaw: Math.PI / 4,
          confidence: 0.9,
        },
      ];

      const batches = buildClassBatches(detections, colors);

      expect(batches.vehicle).toBeTruthy();
      expect(batches.vehicle?.count).toBe(2);
      expect(batches.pedestrian).toBeNull();
      expect(batches.cyclist).toBeNull();
    });

    it('should return null for classes with no detections', () => {
      const detections: Detection[] = [
        {
          id: 'v1',
          class: 'vehicle',
          center: [0, 0, 0],
          dimensions: { width: 2, length: 4, height: 1.5 },
          yaw: 0,
          confidence: 0.95,
        },
      ];

      const batches = buildClassBatches(detections, colors);

      expect(batches.vehicle).toBeTruthy();
      expect(batches.pedestrian).toBeNull();
      expect(batches.cyclist).toBeNull();
    });

    it('should set correct instance colors based on class', () => {
      const detections: Detection[] = [
        {
          id: 'v1',
          class: 'vehicle',
          center: [0, 0, 0],
          dimensions: { width: 2, length: 4, height: 1.5 },
          yaw: 0,
          confidence: 0.95,
        },
      ];

      const batches = buildClassBatches(detections, colors);
      const mesh = batches.vehicle;

      expect(mesh).toBeTruthy();
      expect(mesh?.instanceColor).toBeTruthy();

      const color = new THREE.Color();
      mesh?.getColorAt(0, color);
      expect(color.equals(colors.vehicle)).toBe(true);
    });

    it('should apply correct transformations to instances', () => {
      const detections: Detection[] = [
        {
          id: 'v1',
          class: 'vehicle',
          center: [1, 2, 3],
          dimensions: { width: 2, length: 4, height: 1.5 },
          yaw: Math.PI / 2,
          confidence: 0.95,
        },
      ];

      const batches = buildClassBatches(detections, colors);
      const mesh = batches.vehicle;

      expect(mesh).toBeTruthy();

      const matrix = new THREE.Matrix4();
      mesh?.getMatrixAt(0, matrix);

      // Extract position from matrix
      const position = new THREE.Vector3();
      position.setFromMatrixPosition(matrix);

      expect(position.x).toBeCloseTo(1, 5);
      expect(position.y).toBeCloseTo(2, 5);
      expect(position.z).toBeCloseTo(3, 5);
    });

    it('should use wireframe material with transparency', () => {
      const detections: Detection[] = [
        {
          id: 'v1',
          class: 'vehicle',
          center: [0, 0, 0],
          dimensions: { width: 2, length: 4, height: 1.5 },
          yaw: 0,
          confidence: 0.95,
        },
      ];

      const batches = buildClassBatches(detections, colors);
      const mesh = batches.vehicle;
      const material = mesh?.material as THREE.MeshBasicMaterial;

      expect(material.wireframe).toBe(true);
      expect(material.transparent).toBe(true);
    });

    it('should filter detections by diff mode (tp only)', () => {
      const detections: Detection[] = [
        {
          id: 'v1',
          class: 'vehicle',
          center: [0, 0, 0],
          dimensions: { width: 2, length: 4, height: 1.5 },
          yaw: 0,
          confidence: 0.95,
        },
        {
          id: 'v2',
          class: 'vehicle',
          center: [5, 5, 0],
          dimensions: { width: 2, length: 4, height: 1.5 },
          yaw: 0,
          confidence: 0.8,
        },
      ];

      const diffClassification = new Map([
        ['v1', 'tp' as const],
        ['v2', 'fp' as const],
      ]);

      const batches = buildClassBatches(detections, colors, 'tp', diffClassification);

      expect(batches.vehicle?.count).toBe(1);
      expect(batches.vehicle?.userData['detections'][0].id).toBe('v1');
    });

    it('should apply reduced opacity for FP detections in fp mode', () => {
      const detections: Detection[] = [
        {
          id: 'v1',
          class: 'vehicle',
          center: [0, 0, 0],
          dimensions: { width: 2, length: 4, height: 1.5 },
          yaw: 0,
          confidence: 0.95,
        },
      ];

      const diffClassification = new Map([['v1', 'fp' as const]]);
      const batches = buildClassBatches(detections, colors, 'fp', diffClassification);

      const material = batches.vehicle?.material as THREE.MeshBasicMaterial;
      expect(material.opacity).toBeCloseTo(0.4, 5);
    });

    it('should store detection metadata in userData', () => {
      const detections: Detection[] = [
        {
          id: 'v1',
          class: 'vehicle',
          center: [0, 0, 0],
          dimensions: { width: 2, length: 4, height: 1.5 },
          yaw: 0,
          confidence: 0.95,
        },
      ];

      const batches = buildClassBatches(detections, colors);
      const mesh = batches.vehicle;

      expect(mesh?.userData['detections']).toEqual(detections);
      expect(mesh?.userData['classType']).toBe('vehicle');
    });
  });

  describe('updateInstancedMesh', () => {
    it('should update existing mesh with new detection data', () => {
      const initialDetections: Detection[] = [
        {
          id: 'v1',
          class: 'vehicle',
          center: [0, 0, 0],
          dimensions: { width: 2, length: 4, height: 1.5 },
          yaw: 0,
          confidence: 0.95,
        },
      ];

      const batches = buildClassBatches(initialDetections, colors);
      const mesh = batches.vehicle!;

      const updatedDetections: Detection[] = [
        {
          id: 'v1',
          class: 'vehicle',
          center: [5, 5, 5],
          dimensions: { width: 3, length: 5, height: 2 },
          yaw: Math.PI,
          confidence: 0.98,
        },
      ];

      const result = updateInstancedMesh(mesh, updatedDetections, colors.vehicle);

      expect(result).toBe(true);

      const matrix = new THREE.Matrix4();
      mesh.getMatrixAt(0, matrix);

      const position = new THREE.Vector3();
      position.setFromMatrixPosition(matrix);

      expect(position.x).toBeCloseTo(5, 5);
      expect(position.y).toBeCloseTo(5, 5);
      expect(position.z).toBeCloseTo(5, 5);
    });

    it('should return false if detection count changes', () => {
      const initialDetections: Detection[] = [
        {
          id: 'v1',
          class: 'vehicle',
          center: [0, 0, 0],
          dimensions: { width: 2, length: 4, height: 1.5 },
          yaw: 0,
          confidence: 0.95,
        },
      ];

      const batches = buildClassBatches(initialDetections, colors);
      const mesh = batches.vehicle!;

      const updatedDetections: Detection[] = [
        {
          id: 'v1',
          class: 'vehicle',
          center: [0, 0, 0],
          dimensions: { width: 2, length: 4, height: 1.5 },
          yaw: 0,
          confidence: 0.95,
        },
        {
          id: 'v2',
          class: 'vehicle',
          center: [5, 5, 0],
          dimensions: { width: 2, length: 4, height: 1.5 },
          yaw: 0,
          confidence: 0.9,
        },
      ];

      const result = updateInstancedMesh(mesh, updatedDetections, colors.vehicle);

      expect(result).toBe(false);
    });
  });

  describe('disposeClassBatches', () => {
    it('should dispose geometry and materials', () => {
      const detections: Detection[] = [
        {
          id: 'v1',
          class: 'vehicle',
          center: [0, 0, 0],
          dimensions: { width: 2, length: 4, height: 1.5 },
          yaw: 0,
          confidence: 0.95,
        },
      ];

      const batches = buildClassBatches(detections, colors);
      const geometry = batches.vehicle?.geometry;
      const material = batches.vehicle?.material as THREE.Material;

      const geometryDisposeSpy = spyOn(geometry!, 'dispose');
      const materialDisposeSpy = spyOn(material, 'dispose');

      disposeClassBatches(batches);

      expect(geometryDisposeSpy).toHaveBeenCalled();
      expect(materialDisposeSpy).toHaveBeenCalled();
    });
  });

  describe('getInstanceMetadata', () => {
    it('should extract metadata from raycast intersection', () => {
      const detections: Detection[] = [
        {
          id: 'v1',
          class: 'vehicle',
          center: [0, 0, 0],
          dimensions: { width: 2, length: 4, height: 1.5 },
          yaw: 0,
          confidence: 0.95,
        },
      ];

      const batches = buildClassBatches(detections, colors);
      const mesh = batches.vehicle!;

      // Mock raycast intersection
      const intersection: THREE.Intersection = {
        distance: 10,
        point: new THREE.Vector3(),
        object: mesh,
        instanceId: 0,
        face: null,
      };

      const metadata = getInstanceMetadata(intersection);

      expect(metadata).toBeDefined();
      expect(metadata?.detection.id).toBe('v1');
      expect(metadata?.classType).toBe('vehicle');
      expect(metadata?.instanceIndex).toBe(0);
      expect(metadata?.meshName).toBe('bbox-vehicle');
    });

    it('should return undefined for invalid instanceId', () => {
      const detections: Detection[] = [
        {
          id: 'v1',
          class: 'vehicle',
          center: [0, 0, 0],
          dimensions: { width: 2, length: 4, height: 1.5 },
          yaw: 0,
          confidence: 0.95,
        },
      ];

      const batches = buildClassBatches(detections, colors);
      const mesh = batches.vehicle!;

      const intersection: THREE.Intersection = {
        distance: 10,
        point: new THREE.Vector3(),
        object: mesh,
        instanceId: 99, // Out of range
        face: null,
      };

      const metadata = getInstanceMetadata(intersection);

      expect(metadata).toBeUndefined();
    });

    it('should return undefined for missing instanceId', () => {
      const detections: Detection[] = [
        {
          id: 'v1',
          class: 'vehicle',
          center: [0, 0, 0],
          dimensions: { width: 2, length: 4, height: 1.5 },
          yaw: 0,
          confidence: 0.95,
        },
      ];

      const batches = buildClassBatches(detections, colors);
      const mesh = batches.vehicle!;

      const intersection: THREE.Intersection = {
        distance: 10,
        point: new THREE.Vector3(),
        object: mesh,
        // instanceId is undefined
        face: null,
      };

      const metadata = getInstanceMetadata(intersection);

      expect(metadata).toBeUndefined();
    });
  });
});
