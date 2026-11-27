import { invoke } from '@tauri-apps/api/core';
import type { ApiErrorEnvelope } from '@/types';

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8765/api/v1';
const SESSION_TOKEN_STORAGE_KEY = 'checkpoint_session_token';

export class CheckpointApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: Record<string, unknown>;
  public readonly isNetworkError: boolean;

  constructor(
    message: string,
    options: {
      status?: number;
      code?: string;
      details?: Record<string, unknown>;
      isNetworkError?: boolean;
    } = {},
  ) {
    super(message);
    this.name = 'CheckpointApiError';
    this.status = options.status ?? 0;
    this.code = options.code ?? 'UNKNOWN_ERROR';
    this.details = options.details;
    this.isNetworkError = options.isNetworkError ?? false;
  }

  public get isAuthError(): boolean {
    return this.status === 401 || this.status === 403 || this.code === 'UNAUTHORIZED';
  }

  public get isDuplicateError(): boolean {
    return this.status === 409 || this.code === 'DUPLICATE_ENTITY';
  }

  public get isRateLimitError(): boolean {
    return this.status === 429 || this.code === 'RATE_LIMIT_EXCEEDED';
  }

  public get isExternalProviderError(): boolean {
    return (
      this.status === 502 ||
      this.status === 503 ||
      this.code.startsWith('IGDB_') ||
      this.code === 'EXTERNAL_API_ERROR'
    );
  }
}

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export interface BackendStatusInfo {
  status: 'initializing' | 'ready' | 'error';
  port: number | null;
  baseUrl: string;
  message: string;
}

export async function getTauriBackendStatus(): Promise<BackendStatusInfo | null> {
  if (!isTauriRuntime()) return null;
  try {
    return await invoke<BackendStatusInfo>('get_backend_status');
  } catch (err) {
    console.warn('Failed to query backend status via Tauri IPC:', err);
    return null;
  }
}

export async function restartTauriBackend(): Promise<{ baseUrl: string; token: string | null } | null> {
  if (!isTauriRuntime()) return null;
  try {
    const config = await invoke<{ baseUrl: string; token: string | null }>('restart_backend');
    if (config?.baseUrl) {
      apiClient.updateConfig(config.baseUrl, config.token);
    }
    return config;
  } catch (err) {
    console.error('Failed to restart backend via Tauri IPC:', err);
    throw err;
  }
}

interface TauriLocalApiConfig {
  baseUrl: string;
  token: string | null;
}

class CheckpointApiClient {
  private baseUrl: string;
  private authToken: string | null = null;
  private initPromise: Promise<void> | null = null;

  public updateConfig(baseUrl: string, token: string | null): void {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    if (token) {
      this.authToken = token;
    }
  }

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL;
    if (typeof window !== 'undefined') {
      const savedSessionToken = window.sessionStorage.getItem(SESSION_TOKEN_STORAGE_KEY);
      if (savedSessionToken) {
        this.authToken = savedSessionToken;
      } else if (import.meta.env.DEV && import.meta.env.VITE_CHECKPOINT_TOKEN) {
        this.authToken = String(import.meta.env.VITE_CHECKPOINT_TOKEN);
      }
    }
  }

  public async initializeSession(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      if (isTauriRuntime()) {
        try {
          const cfg = await invoke<TauriLocalApiConfig>('wait_for_backend_ready', { timeoutMs: 25000 });
          if (cfg?.baseUrl) {
            this.baseUrl = cfg.baseUrl.replace(/\/+$/, '');
          }
          if (cfg?.token) {
            this.authToken = cfg.token;
          }
        } catch {
          try {
            const cfg = await invoke<TauriLocalApiConfig>('get_local_api_config');
            if (cfg?.baseUrl) {
              this.baseUrl = cfg.baseUrl.replace(/\/+$/, '');
            }
            if (cfg?.token && !this.authToken) {
              this.authToken = cfg.token;
            }
          } catch {
            // Non-fatal fallback to environment config
          }
        }
      }
    })();

    return this.initPromise;
  }

  public setAuthToken(token: string | null, persistInSession = false): void {
    const trimmed = token?.trim() || null;
    this.authToken = trimmed;
    if (typeof window !== 'undefined') {
      if (persistInSession && trimmed) {
        window.sessionStorage.setItem(SESSION_TOKEN_STORAGE_KEY, trimmed);
      } else if (!trimmed) {
        window.sessionStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
      }
    }
  }

  public hasAuthToken(): boolean {
    return Boolean(this.authToken);
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public resolveApiAssetUrl(pathOrUrl: string): string {
    if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
      return pathOrUrl;
    }
    const origin = this.baseUrl.replace(/\/api\/v1\/?$/, '');
    if (pathOrUrl.startsWith('/api/v1/')) {
      return `${origin}${pathOrUrl}`;
    }
    const normalizedPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
    return `${this.baseUrl}${normalizedPath}`;
  }

  public isLocalBackendAsset(pathOrUrl: string | null | undefined): boolean {
    if (!pathOrUrl) return false;
    if (pathOrUrl.startsWith('/api/v1/')) return true;
    const origin = this.baseUrl.replace(/\/api\/v1\/?$/, '');
    return pathOrUrl.startsWith(origin);
  }

  private buildHeaders(customHeaders?: HeadersInit, hasJsonBody = false): Headers {
    const headers = new Headers(customHeaders);
    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/json');
    }
    if (hasJsonBody && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    if (this.authToken && !headers.has('X-Checkpoint-Token')) {
      headers.set('X-Checkpoint-Token', this.authToken);
    }
    return headers;
  }

  public async request<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
    path: string,
    options: {
      body?: unknown;
      params?: Record<string, string | number | boolean | null | undefined>;
      signal?: AbortSignal;
      timeoutMs?: number;
    } = {},
  ): Promise<T> {
    await this.initializeSession();

    const url = new URL(`${this.baseUrl}${path}`);
    if (options.params) {
      for (const [k, v] of Object.entries(options.params)) {
        if (v !== undefined && v !== null && v !== '') {
          url.searchParams.set(k, String(v));
        }
      }
    }

    const controller = new AbortController();
    const timeoutMs = options.timeoutMs ?? 12000;
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

    const onExternalAbort = () => controller.abort();
    if (options.signal) {
      if (options.signal.aborted) {
        controller.abort();
      } else {
        options.signal.addEventListener('abort', onExternalAbort, { once: true });
      }
    }

    try {
      const hasBody = options.body !== undefined;
      const response = await fetch(url.toString(), {
        method,
        headers: this.buildHeaders(undefined, hasBody),
        body: hasBody ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        let code = `HTTP_${response.status}`;
        let message = response.statusText || 'Request failed';
        let details: Record<string, unknown> | undefined;

        try {
          const parsed = (await response.json()) as Partial<ApiErrorEnvelope> & {
            detail?: string;
          };
          if (parsed?.error) {
            code = parsed.error.code || code;
            message = parsed.error.message || message;
            details = parsed.error.details;
          } else if (typeof parsed?.detail === 'string') {
            message = parsed.detail;
          }
        } catch {
          // Ignore non-JSON error payloads
        }

        throw new CheckpointApiError(message, {
          status: response.status,
          code,
          details,
        });
      }

      if (response.status === 204) {
        return undefined as T;
      }

      return (await response.json()) as T;
    } catch (err) {
      if (err instanceof CheckpointApiError) {
        throw err;
      }
      if (err instanceof DOMException && err.name === 'AbortError') {
        if (options.signal?.aborted) {
          throw err;
        }
        throw new CheckpointApiError('Request timed out reaching local backend.', {
          status: 0,
          code: 'TIMEOUT',
          isNetworkError: true,
        });
      }
      throw new CheckpointApiError(
        err instanceof Error ? err.message : 'Unable to reach local backend service.',
        {
          status: 0,
          code: 'BACKEND_UNAVAILABLE',
          isNetworkError: true,
        },
      );
    } finally {
      window.clearTimeout(timeoutId);
      if (options.signal) {
        options.signal.removeEventListener('abort', onExternalAbort);
      }
    }
  }

  public get<T>(
    path: string,
    params?: Record<string, string | number | boolean | null | undefined>,
    signal?: AbortSignal,
    timeoutMs?: number,
  ): Promise<T> {
    return this.request<T>('GET', path, { params, signal, timeoutMs });
  }

  public post<T>(path: string, body?: unknown, signal?: AbortSignal, timeoutMs?: number): Promise<T> {
    return this.request<T>('POST', path, { body, signal, timeoutMs });
  }

  public patch<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    return this.request<T>('PATCH', path, { body, signal });
  }

  public put<T>(path: string, body?: unknown, signal?: AbortSignal, timeoutMs?: number): Promise<T> {
    return this.request<T>('PUT', path, { body, signal, timeoutMs });
  }

  public delete<T = void>(path: string, signal?: AbortSignal): Promise<T> {
    return this.request<T>('DELETE', path, { signal });
  }

  public async fetchAuthenticatedBlob(urlOrPath: string, signal?: AbortSignal): Promise<Blob> {
    await this.initializeSession();
    const resolved = this.resolveApiAssetUrl(urlOrPath);
    const response = await fetch(resolved, {
      method: 'GET',
      headers: this.buildHeaders({ Accept: 'image/*,*/*' }),
      signal,
    });
    if (!response.ok) {
      throw new CheckpointApiError(`Failed to load cached asset (${response.status})`, {
        status: response.status,
        code: `HTTP_${response.status}`,
      });
    }
    return response.blob();
  }
}

export const apiClient = new CheckpointApiClient();
