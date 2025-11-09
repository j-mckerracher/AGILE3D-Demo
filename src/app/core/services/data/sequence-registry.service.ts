import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, Observable } from 'rxjs';
import { shareReplay } from 'rxjs/operators';
import { SceneId } from '../../models/config-and-metrics';

export interface SequenceRegistryEntry {
  sceneId: SceneId;
  sequenceId: string;
  title?: string;
  basePath: string;
  manifestUrl: string;
  defaultBaselineBranch?: string;
  defaultActiveBranch?: string;
}

interface SequenceRegistryDefaults {
  sequenceId?: string;
  baselineBranch?: string;
  activeBranch?: string;
}

interface SequenceRuntimeConfig {
  defaults?: SequenceRegistryDefaults;
  sequences: SequenceRegistryEntry[];
}

@Injectable({ providedIn: 'root' })
export class SequenceRegistryService {
  private readonly http = inject(HttpClient);

  private config$?: Observable<SequenceRuntimeConfig>;
  private cachedConfig?: SequenceRuntimeConfig;

  private loadConfig(): Observable<SequenceRuntimeConfig> {
    if (!this.config$) {
      this.config$ = this.http
        .get<SequenceRuntimeConfig>('assets/runtime-config.json')
        .pipe(shareReplay(1));
    }
    return this.config$;
  }

  private async ensureConfig(): Promise<SequenceRuntimeConfig> {
    if (!this.cachedConfig) {
      this.cachedConfig = await firstValueFrom(this.loadConfig());
    }
    return this.cachedConfig;
  }

  public async listSequences(): Promise<SequenceRegistryEntry[]> {
    const config = await this.ensureConfig();
    return config.sequences;
  }

  public async getDefaults(): Promise<SequenceRegistryDefaults> {
    const config = await this.ensureConfig();
    return config.defaults ?? {};
  }

  public async findBySequenceId(sequenceId: string): Promise<SequenceRegistryEntry | undefined> {
    const config = await this.ensureConfig();
    return config.sequences.find((seq) => seq.sequenceId === sequenceId);
  }

  public async findBySceneId(sceneId: SceneId): Promise<SequenceRegistryEntry | undefined> {
    const config = await this.ensureConfig();
    return config.sequences.find((seq) => seq.sceneId === sceneId);
  }
}
