import { useEffect, useState } from 'react';
import { apiClient } from '@/services/api';

const MAX_BLOB_CACHE_SIZE = 60;
const blobUrlCache = new Map<string, string>();
const inFlightRequests = new Map<string, Promise<string>>();

function getCachedBlobUrl(key: string): string | undefined {
  const existing = blobUrlCache.get(key);
  if (existing) {
    blobUrlCache.delete(key);
    blobUrlCache.set(key, existing);
  }
  return existing;
}

function storeBlobUrl(key: string, objectUrl: string): void {
  if (blobUrlCache.has(key)) {
    const prev = blobUrlCache.get(key);
    if (prev && prev !== objectUrl) {
      URL.revokeObjectURL(prev);
    }
    blobUrlCache.delete(key);
  }
  blobUrlCache.set(key, objectUrl);

  while (blobUrlCache.size > MAX_BLOB_CACHE_SIZE) {
    const oldestKey = blobUrlCache.keys().next().value;
    if (!oldestKey) break;
    const oldestUrl = blobUrlCache.get(oldestKey);
    blobUrlCache.delete(oldestKey);
    if (oldestUrl) {
      URL.revokeObjectURL(oldestUrl);
    }
  }
}

export function clearArtworkBlobCache(): void {
  for (const url of blobUrlCache.values()) {
    URL.revokeObjectURL(url);
  }
  blobUrlCache.clear();
  inFlightRequests.clear();
}

export interface AuthenticatedImageResult {
  resolvedSrc: string | null;
  isLoading: boolean;
  hasError: boolean;
}

interface AsyncBlobResult {
  cacheKey: string;
  resolvedSrc: string | null;
  hasError: boolean;
}

/**
 * Safely resolves local authenticated artwork URLs (/api/v1/artwork/cache/...) via
 * authenticated fetch-to-Blob with bounded LRU caching & URL.revokeObjectURL cleanup,
 * while passing external CDN URLs directly for lazy browser loading.
 */
export function useAuthenticatedImage(src: string | null | undefined): AuthenticatedImageResult {
  const isLocalBackend = apiClient.isLocalBackendAsset(src);
  const cacheKey = src && isLocalBackend ? apiClient.resolveApiAssetUrl(src) : null;
  const cachedHit = cacheKey ? getCachedBlobUrl(cacheKey) : undefined;

  const [asyncResult, setAsyncResult] = useState<AsyncBlobResult | null>(null);

  useEffect(() => {
    if (!cacheKey || cachedHit) {
      return;
    }

    let cancelled = false;
    const abortController = new AbortController();

    let pending = inFlightRequests.get(cacheKey);
    if (!pending) {
      pending = apiClient
        .fetchAuthenticatedBlob(cacheKey, abortController.signal)
        .then((blob) => {
          const objUrl = URL.createObjectURL(blob);
          storeBlobUrl(cacheKey, objUrl);
          return objUrl;
        })
        .finally(() => {
          inFlightRequests.delete(cacheKey);
        });
      inFlightRequests.set(cacheKey, pending);
    }

    pending
      .then((objUrl) => {
        if (!cancelled) {
          setAsyncResult({ cacheKey, resolvedSrc: objUrl, hasError: false });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAsyncResult({ cacheKey, resolvedSrc: null, hasError: true });
        }
      });

    return () => {
      cancelled = true;
      if (!inFlightRequests.has(cacheKey)) {
        abortController.abort();
      }
    };
  }, [cacheKey, cachedHit]);

  if (!src) {
    return { resolvedSrc: null, isLoading: false, hasError: false };
  }
  if (!cacheKey) {
    return { resolvedSrc: src, isLoading: false, hasError: false };
  }
  if (cachedHit) {
    return { resolvedSrc: cachedHit, isLoading: false, hasError: false };
  }
  if (asyncResult && asyncResult.cacheKey === cacheKey) {
    return {
      resolvedSrc: asyncResult.resolvedSrc,
      isLoading: false,
      hasError: asyncResult.hasError,
    };
  }
  return { resolvedSrc: null, isLoading: true, hasError: false };
}
