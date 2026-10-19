import { StreamedStream, ResolvedStreamInfo } from '../types';

const RESOLVER_STORAGE_KEY = 'stoned_sports_resolver_url';
// Active live Cloudflare Tunnel resolver instance
export const DEFAULT_CLOUDFLARE_RESOLVER = 'https://revolutionary-dust-kilometers-mom.trycloudflare.com';

/**
 * Returns the currently active resolver host URL.
 * Defaults to the live Cloudflare Tunnel: https://revolutionary-dust-kilometers-mom.trycloudflare.com
 */
export function getResolverBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(RESOLVER_STORAGE_KEY);
    if (saved && saved.trim()) {
      return saved.trim().replace(/\/+$/, '');
    }
  }
  const envUrl = (import.meta.env.VITE_STREAMED_RESOLVER_URL || '').trim();
  if (envUrl) {
    return envUrl.replace(/\/+$/, '');
  }
  return DEFAULT_CLOUDFLARE_RESOLVER;
}

/**
 * Persists a user-defined resolver host URL.
 */
export function setResolverBaseUrl(url: string): void {
  if (typeof window !== 'undefined') {
    const cleaned = url.trim().replace(/\/+$/, '');
    if (!cleaned) {
      localStorage.removeItem(RESOLVER_STORAGE_KEY);
    } else {
      localStorage.setItem(RESOLVER_STORAGE_KEY, cleaned);
    }
  }
}

/**
 * Test connectivity to the streamed-pk-resolver host.
 * Tests /api/sports or /health endpoint.
 */
export async function checkResolverHealth(baseUrl: string): Promise<{ ok: boolean; message: string; latencyMs?: number }> {
  const target = baseUrl.trim().replace(/\/+$/, '');
  if (!target) {
    return { ok: false, message: 'No resolver URL specified.' };
  }

  const startTime = performance.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    // 1. Try /api/sports (Lunatic16/streamed-pk-resolver standard catalog route)
    const sportsRes = await fetch(`${target}/api/sports`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    }).catch(() => null);

    const latencyMs = Math.round(performance.now() - startTime);

    if (sportsRes && sportsRes.ok) {
      clearTimeout(timeout);
      return { 
        ok: true, 
        message: `Connected to streamed-pk-resolver! Live catalog and GOAT unlock ready (${latencyMs}ms).`,
        latencyMs 
      };
    }

    // 2. Try /health
    const healthRes = await fetch(`${target}/health`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    }).catch(() => null);

    clearTimeout(timeout);

    if (healthRes && healthRes.ok) {
      return { 
        ok: true, 
        message: `Connected to resolver service (${latencyMs}ms).`,
        latencyMs 
      };
    }

    return {
      ok: false,
      message: `Host responded with status ${sportsRes?.status || healthRes?.status || 'unreachable'}. Make sure your container is running.`,
      latencyMs,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Connection failed';
    return { ok: false, message: `Could not reach ${target}: ${msg}` };
  }
}

// In-memory cache for resolved stream URLs
const streamCache = new Map<string, ResolvedStreamInfo>();

export interface ResolveStreamOptions {
  matchId?: string;
  forceFresh?: boolean;
  signal?: AbortSignal;
}

/**
 * Resolves a live sports stream using the official Lunatic16/streamed-pk-resolver API:
 * 
 * 1. Sends POST /api/resolve with { source, id, stream, matchId }
 * 2. Obtains the unwrapped, referer-aware relay URL (/api/hls?url=...&referer=...)
 * 3. Enforces HTTPS to prevent mixed content blocking on secure web clients
 * 4. Ensures all media chunks are served without WEBP wrappers or CORS errors
 */
export async function resolveSportStream(
  stream: StreamedStream,
  options?: ResolveStreamOptions
): Promise<ResolvedStreamInfo> {
  const cleanEmbed = (stream.embedUrl || '').trim();
  const cacheKey = `${stream.source}-${stream.streamNo || 1}-${cleanEmbed}`;

  if (!options?.forceFresh && streamCache.has(cacheKey)) {
    return streamCache.get(cacheKey)!;
  }

  const resolverBase = getResolverBaseUrl();
  const streamNo = Number(stream.streamNo) || 1;
  const sourceName = (stream.source || 'admin').toLowerCase();
  const sourceId = stream.id || '';

  // 1. Direct check: If embedUrl is already a direct .m3u8
  if (cleanEmbed.includes('.m3u8')) {
    let streamUrl = resolverBase
      ? `${resolverBase}/api/hls?url=${encodeURIComponent(cleanEmbed)}&referer=${encodeURIComponent('https://embed.st/')}`
      : cleanEmbed;

    if (resolverBase.startsWith('https://') || (typeof window !== 'undefined' && window.location.protocol === 'https:')) {
      streamUrl = streamUrl.replace(/^http:\/\//i, 'https://');
    }

    const info: ResolvedStreamInfo = {
      success: true,
      streamUrl,
      isDirectHls: true,
      source: stream.source,
      streamNo,
    };
    streamCache.set(cacheKey, info);
    return info;
  }

  // 2. Query Lunatic16/streamed-pk-resolver: POST /api/resolve
  if (resolverBase) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7000);

      const resolvePayload: Record<string, unknown> = {
        source: sourceName,
        stream: streamNo,
      };

      if (sourceId) {
        resolvePayload.id = sourceId;
      }
      if (options?.matchId) {
        resolvePayload.matchId = options.matchId;
      }

      const res = await fetch(`${resolverBase}/api/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(resolvePayload),
        signal: options?.signal || controller.signal,
      });

      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();

        // Successful Lunatic16 resolve shape: { ok: true, m3u8, referer, relay }
        if (data.ok && (data.relay || data.m3u8)) {
          let playableRelayUrl = data.relay || data.m3u8;

          // If relay URL points to internal localhost:3000, rewrite with external resolverBase
          if (playableRelayUrl.startsWith('http://localhost') || playableRelayUrl.startsWith('http://127.0.0.1')) {
            try {
              const parsedRelay = new URL(playableRelayUrl);
              playableRelayUrl = `${resolverBase}${parsedRelay.pathname}${parsedRelay.search}`;
            } catch {
              // Keep original if parsing fails
            }
          }

          // Enforce HTTPS on relay URL to prevent mixed content blocking
          if (resolverBase.startsWith('https://') || (typeof window !== 'undefined' && window.location.protocol === 'https:')) {
            playableRelayUrl = playableRelayUrl.replace(/^http:\/\//i, 'https://');
          }

          const info: ResolvedStreamInfo = {
            success: true,
            streamUrl: playableRelayUrl,
            backupUrl: data.m3u8,
            isDirectHls: true,
            source: stream.source,
            streamNo,
            headers: {
              Referer: data.referer || 'https://embed.st/',
            },
          };
          streamCache.set(cacheKey, info);
          return info;
        }
      }
    } catch (err) {
      console.warn('[sportsStreamResolver] POST /api/resolve failed or timed out:', err);
    }

    // 3. Slot-Mode Tune-in Fallback: /api/hls?source=...&id=...&stream=...
    // As documented in Lunatic16/streamed-pk-resolver:
    // Slot mode runs a fresh GOAT unlock at request time and proxies the media playlist
    if (sourceName && sourceId) {
      let slotRelayUrl = `${resolverBase}/api/hls?source=${encodeURIComponent(sourceName)}&id=${encodeURIComponent(sourceId)}&stream=${streamNo}`;
      if (resolverBase.startsWith('https://') || (typeof window !== 'undefined' && window.location.protocol === 'https:')) {
        slotRelayUrl = slotRelayUrl.replace(/^http:\/\//i, 'https://');
      }

      const slotInfo: ResolvedStreamInfo = {
        success: true,
        streamUrl: slotRelayUrl,
        isDirectHls: true,
        source: stream.source,
        streamNo,
      };
      streamCache.set(cacheKey, slotInfo);
      return slotInfo;
    }
  }

  // 4. Safe Embed Mirror Fallback
  const safeEmbedUrl = resolverBase
    ? `${resolverBase}/proxy/embed?url=${encodeURIComponent(cleanEmbed)}`
    : cleanEmbed;

  const fallbackInfo: ResolvedStreamInfo = {
    success: true,
    streamUrl: safeEmbedUrl,
    isDirectHls: false,
    source: stream.source,
    streamNo,
    error: 'Playing via ad-stripped embed mirror.',
  };

  return fallbackInfo;
}
