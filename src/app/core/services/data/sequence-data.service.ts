import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { SequenceManifest, Detection, LABEL_MAP } from '../../models/sequence.models';

export const DET_SCORE_THRESH = 0.7;

interface GTBox {
  x: number;
  y: number;
  z: number;
  dx: number;
  dy: number;
  dz: number;
  heading: number;
  label?: number;  // Optional - may not be present in Waymo data
}

interface GTFile {
  boxes: GTBox[];
}

interface DetBox {
  x: number;
  y: number;
  z: number;
  dx: number;
  dy: number;
  dz: number;
  heading: number;
  score?: number;
  label?: number;
}

interface DetFile {
  boxes: DetBox[];
}

@Injectable({
  providedIn: 'root'
})
export class SequenceDataService {
  constructor(private http: HttpClient) {}

  async loadManifest(seqId: string): Promise<SequenceManifest> {
    const url = `assets/data/sequences/${seqId}/manifest.json`;
    return firstValueFrom(this.http.get<SequenceManifest>(url));
  }

  async fetchPoints(seqId: string, url: string): Promise<ArrayBuffer> {
    const fullUrl = `assets/data/sequences/${seqId}/${url}`;
    return firstValueFrom(
      this.http.get(fullUrl, { responseType: 'arraybuffer' })
    );
  }

  async fetchGT(seqId: string, url: string): Promise<GTFile> {
    const fullUrl = `assets/data/sequences/${seqId}/${url}`;
    return firstValueFrom(this.http.get<GTFile>(fullUrl));
  }

  async fetchDet(seqId: string, url: string): Promise<DetFile> {
    const fullUrl = `assets/data/sequences/${seqId}/${url}`;
    return firstValueFrom(this.http.get<DetFile>(fullUrl));
  }

  mapGTToDetections(frameId: string, boxes: GTBox[]): Detection[] {
    return boxes.map((box, i) => {
      // If label is present, use it; otherwise default to 'vehicle'
      // Many Waymo sequences don't include labels in the GT boxes
      const detectionClass = box.label !== undefined ? LABEL_MAP[box.label] : 'vehicle';
      
      if (!detectionClass) {
        console.warn(`[SequenceDataService] Unknown label ${box.label} in frame ${frameId}, skipping`);
        return null;
      }
      
      return {
        id: `${i}-${frameId}`,
        class: detectionClass,
        center: [box.x, box.y, box.z] as [number, number, number],
        dimensions: {
          // Waymo uses dx=length (x-axis), dy=width (y-axis), dz=height (z-axis)
          // Our renderer expects width on X, length on Y. Swap dx/dy here.
          width: box.dy,
          length: box.dx,
          height: box.dz
        },
        // Waymo heading is yaw about +Z in radians; same convention as renderer
        yaw: box.heading,
        confidence: 1.0
      };
    }).filter((d): d is Detection => d !== null);
  }

  mapDetToDetections(branchId: string, boxes: DetBox[], scoreThresh: number = DET_SCORE_THRESH): Detection[] {
    return boxes
      .filter(box => (box.score ?? 1.0) >= scoreThresh)
      .map((box, i) => {
        const detectionClass = box.label !== undefined ? LABEL_MAP[box.label] : 'vehicle';
        
        if (!detectionClass) {
          console.warn(`[SequenceDataService] Unknown label ${box.label} in branch ${branchId}, skipping`);
          return null;
        }
        
        return {
          id: `${i}-${branchId}`,
          class: detectionClass,
          center: [box.x, box.y, box.z] as [number, number, number],
          dimensions: {
            // Same coordinate mapping as GT: swap dx/dy
            width: box.dy,
            length: box.dx,
            height: box.dz
          },
          yaw: box.heading,
          confidence: box.score ?? 1.0
        };
      }).filter((d): d is Detection => d !== null);
  }
}
