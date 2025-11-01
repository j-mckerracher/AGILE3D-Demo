import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

/**
 * Runtime configuration schema.
 * Defines all configurable application settings.
 */
export interface RuntimeConfig {
  manifestBaseUrl: string;
  sequences: string[];
  branches: string[];
  timeouts: {
    fetchManifest: number;
    fetchFrame: number;
  };
  retries: number;
  prefetch: number;
  concurrency: number;
  scoreDefault: number;
  labelsDefault: boolean;
  metrics: boolean;
}

/**
 * Default environment configuration values.
 */
const ENVIRONMENT_DEFAULTS: RuntimeConfig = {
  manifestBaseUrl: 'http://localhost:3000',
  sequences: [],
  branches: ['DSVT_Voxel'],
  timeouts: {
    fetchManifest: 30000,
    fetchFrame: 20000,
  },
  retries: 3,
  prefetch: 2,
  concurrency: 4,
  scoreDefault: 0.5,
  labelsDefault: true,
  metrics: true,
};

/**
 * ConfigService: Load and expose runtime configuration with precedence.
 *
 * Precedence: environment defaults < runtime-config.json < query flags
 *
 * Query flag format: ?key=value (comma-separated for arrays, 'true'/'false' for booleans)
 * Examples:
 *   ?metrics=false
 *   ?branches=DSVT_Voxel,PointPillar
 *   ?scoreDefault=0.7
 */
@Injectable({
  providedIn: 'root',
})
export class ConfigService {
  private readonly config: RuntimeConfig = { ...ENVIRONMENT_DEFAULTS };
  private readonly http: HttpClient = inject(HttpClient);

  /**
   * Initialize configuration by loading runtime-config.json.
   * Called via APP_INITIALIZER during app bootstrap.
   */
  public async initialize(): Promise<void> {
    try {
      const runtimeConfig = await firstValueFrom(
        this.http.get<Partial<RuntimeConfig>>('/assets/runtime-config.json')
      );
      // Merge runtime config over environment defaults
      Object.assign(this.config, runtimeConfig);
    } catch (error) {
      console.warn('Failed to load runtime-config.json, using environment defaults', error);
      // Silently fail; use environment defaults
    }

    // Apply query parameters (highest precedence)
    this.applyQueryFlags();
  }

  /**
   * Get a configuration value with optional default.
   * Supports nested keys using dot notation (e.g., 'timeouts.fetchManifest').
   *
   * @param key - Configuration key (supports nested access via dots)
   * @param defaultValue - Value to return if key not found
   * @returns Configuration value or default
   */
  public get<T = unknown>(key: string, defaultValue?: T): T | undefined {
    const keys = key.split('.');
    let value: unknown = this.config;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = (value as Record<string, unknown>)[k];
      } else {
        return defaultValue;
      }
    }

    return value as T | undefined;
  }

  /**
   * Apply query string parameters to override configuration.
   * Parses URL query string and applies typed overrides.
   */
  private applyQueryFlags(): void {
    const params = new URLSearchParams(window.location.search);

    params.forEach((value, key) => {
      const typedValue = this.parseQueryValue(value);
      this.setConfigValue(key, typedValue);
    });
  }

  /**
   * Parse a query parameter value to the appropriate type.
   */
  private parseQueryValue(value: string): string | number | boolean | string[] {
    // Boolean parsing
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;

    // Number parsing
    if (!isNaN(Number(value))) return Number(value);

    // Array parsing (comma-separated)
    if (value.includes(',')) return value.split(',').map((v) => v.trim());

    // String
    return value;
  }

  /**
   * Set a config value by key (supports nested keys via dots).
   */
  private setConfigValue(key: string, value: string | number | boolean | string[]): void {
    const keys = key.split('.');
    let obj: Record<string, unknown> = this.config as unknown as Record<string, unknown>;

    // Navigate to parent object
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (k && !(k in obj)) {
        obj[k] = {};
      }
      if (k) {
        obj = obj[k] as Record<string, unknown>;
      }
    }

    // Set the final key
    const lastKey = keys[keys.length - 1];
    if (lastKey) {
      obj[lastKey] = value;
    }
  }
}
