import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { SequenceManifest, Detection, LABEL_MAP } from '../../models/sequence.models';

interface GTBox {
  x: number;
  y: number;
  z: number;
  dx: number;
  dy: number;
  dz: number;
  heading: number;
  label: number;
}

interface GTFile {
  boxes: GTBox[];
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

  mapGTToDetections(frameId: string, boxes: GTBox[]): Detection[] {
    return boxes
      .map((box, i) => {
        const detectionClass = LABEL_MAP[box.label];
        if (!detectionClass) {
          console.warn(`[SequenceDataService] Unknown label ${box.label} in frame ${frameId}`);
          return null;
        }
        return {
          id: `${i}-${frameId}`,
          class: detectionClass,
          center: [box.x, box.y, box.z] as [number, number, number],
          dimensions: {
            width: box.dx,
            length: box.dy,
            height: box.dz
          },
          yaw: box.heading,
          confidence: 1.0
        };
      })
      .filter((d): d is Detection => d !== null);
  }
}
