/**
 * stoned-resolver — Cloudflare Worker
 *
 * Routes:
 *   GET /api/resolve
 *       ?type=movie|tv|anime  &id=<tmdbId>  [&season=N]  [&episode=N]  [&anilist_id=<id>]
 *       → { url: string, provider: string }  |  HTTP 502 { error: string }
 *
 *   GET /api/resolve
 *       ?source=sports  &provider=streamed|daddylive  &id=<channelId>
 *       → { url: string, provider: string }  |  HTTP 502 { error: string }
 *
 *   GET /api/sports/events
 *       [?provider=streamed|daddylive|all]
 *       → SportEvent[]
 *
 *   GET /api/health
 *       [?resolver=vidsrc|vidlink|vidcore|vidup|streamed|daddylive]
 *       → { status: "ok", resolver?: string, ts: string }
 */

import { resolveVidSrc }     from './resolvers/vidsrc.js';
import { resolveVidLink }    from './resolvers/vidlink.js';
import { resolveVidCore }    from './resolvers/vidcore.js';
import { resolveVidUp }      from './resolvers/vidup.js';
import { resolveStreamed, fetchStreamedEvents }     from './resolvers/streamed.js';
import { resolveDaddyLive, fetchDaddyLiveEvents }   from './resolvers/daddylive.js';
import type { ResolveParams, SportResolveParams, ResolveResult, SportEvent } from './resolvers/types.js';

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

const ALLOWED_ORIGINS = new Set([
  'https://stoned.living',
  'https://www.stoned.living'
]);

function corsHeaders(origin: string | null): HeadersInit {
  // Allow the Pages preview domains and the production origin.
  // In dev/CI mode allow all origins.
  const allowedOrigin =
    origin && (ALLOWED_ORIGINS.has(origin) || origin.endsWith('.stoned-living.pages.dev'))
      ? origin
      : '*';

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  };
}

function jsonResponse(data: unknown, status = 200, origin: string | null = null): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin)
    }
  });
}

// ---------------------------------------------------------------------------
// Cloudflare Cache API — 5-minute TTL for resolved media manifests
//                        30-second TTL for live sport streams
// ---------------------------------------------------------------------------

const CACHE_TTL_MEDIA  = 300;   // 5 minutes (VOD — stream URLs are stable)
const CACHE_TTL_SPORTS = 30;    // 30 seconds (live — tokens rotate frequently)

function mediaCacheKey(params: ResolveParams): Request {
  const key = `https://stoned-resolver.internal/cache/media/${params.type}/${params.id}/${params.season ?? 1}/${params.episode ?? 1}`;
  return new Request(key);
}

function sportsCacheKey(params: SportResolveParams): Request {
  const key = `https://stoned-resolver.internal/cache/sports/${params.provider}/${params.channelId}`;
  return new Request(key);
}

async function getCached(cacheReq: Request): Promise<string | null> {
  try {
    const cache = caches.default;
    const cached = await cache.match(cacheReq);
    if (cached) {
      const data = await cached.json() as { url?: string };
      return data?.url ?? null;
    }
  } catch { /* Cache API unavailable in local wrangler dev */ }
  return null;
}

async function setCached(cacheReq: Request, url: string, ttl: number): Promise<void> {
  try {
    const cache = caches.default;
    const res = new Response(JSON.stringify({ url }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `public, max-age=${ttl}`
      }
    });
    await cache.put(cacheReq, res);
  } catch { /* Cache API unavailable in local wrangler dev */ }
}

// ---------------------------------------------------------------------------
// Fallback chain — media (movies / TV / anime)
// ---------------------------------------------------------------------------

async function resolveMedia(params: ResolveParams): Promise<ResolveResult | null> {
  // Check edge cache first
  const cacheReq = mediaCacheKey(params);
  const cached = await getCached(cacheReq);
  if (cached) return { url: cached, provider: 'cache' };

  const resolvers: Array<{ name: string; fn: (p: ResolveParams) => Promise<string | null> }> = [
    { name: 'vidsrc',  fn: resolveVidSrc  },
    { name: 'vidlink', fn: resolveVidLink },
    { name: 'vidcore', fn: resolveVidCore },
    { name: 'vidup',   fn: resolveVidUp   }
  ];

  for (const { name, fn } of resolvers) {
    try {
      const url = await fn(params);
      if (url) {
        // Store in edge cache before returning
        await setCached(cacheReq, url, CACHE_TTL_MEDIA);
        return { url, provider: name };
      }
    } catch {
      // Silent — try next provider
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Fallback chain — sports
// ---------------------------------------------------------------------------

async function resolveSports(params: SportResolveParams): Promise<ResolveResult | null> {
  // Check edge cache (short TTL for live streams)
  const cacheReq = sportsCacheKey(params);
  const cached = await getCached(cacheReq);
  if (cached) return { url: cached, provider: 'cache' };

  const ordered =
    params.provider === 'daddylive'
      ? [
          { name: 'daddylive', fn: resolveDaddyLive },
          { name: 'streamed',  fn: resolveStreamed  }
        ]
      : [
          { name: 'streamed',  fn: resolveStreamed  },
          { name: 'daddylive', fn: resolveDaddyLive }
        ];

  for (const { name, fn } of ordered) {
    try {
      const url = await fn(params);
      if (url) {
        await setCached(cacheReq, url, CACHE_TTL_SPORTS);
        return { url, provider: name };
      }
    } catch {
      // Silent — try next
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

async function handleResolve(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const origin = req.headers.get('Origin');

  const source = searchParams.get('source');

  // ── Sports resolve ────────────────────────────────────────────────────────
  if (source === 'sports') {
    const provider = searchParams.get('provider') || 'streamed';
    const channelId = searchParams.get('id');
    if (!channelId) {
      return jsonResponse({ error: 'Missing required param: id' }, 400, origin);
    }

    const result = await resolveSports({ provider, channelId });
    if (!result) return jsonResponse({ error: 'No live stream found' }, 502, origin);
    return jsonResponse(result, 200, origin);
  }

  // ── Media resolve ─────────────────────────────────────────────────────────
  const rawType = searchParams.get('type');
  const id      = searchParams.get('id');
  const anilistId = searchParams.get('anilist_id') ?? undefined;

  if (!rawType || !id) {
    return jsonResponse({ error: 'Missing required params: type, id' }, 400, origin);
  }
  if (rawType !== 'movie' && rawType !== 'tv' && rawType !== 'anime') {
    return jsonResponse({ error: 'Invalid type — must be movie, tv, or anime' }, 400, origin);
  }

  const type = rawType as 'movie' | 'tv' | 'anime';
  const season  = parseInt(searchParams.get('season')  ?? '1', 10) || 1;
  const episode = parseInt(searchParams.get('episode') ?? '1', 10) || 1;

  const params: ResolveParams = { type, id, season, episode, anilistId };

  const result = await resolveMedia(params);
  if (!result) return jsonResponse({ error: 'No stream found for this title' }, 502, origin);
  return jsonResponse(result, 200, origin);
}

async function handleSportsEvents(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const origin = req.headers.get('Origin');
  const provider = searchParams.get('provider') || 'all';

  let events: SportEvent[] = [];

  if (provider === 'streamed' || provider === 'all') {
    const ev = await fetchStreamedEvents().catch(() => []);
    events = events.concat(ev);
  }
  if (provider === 'daddylive' || provider === 'all') {
    const ev = await fetchDaddyLiveEvents().catch(() => []);
    events = events.concat(ev);
  }

  return jsonResponse(events, 200, origin);
}

async function handleHealth(req: Request): Promise<Response> {
  const origin = req.headers.get('Origin');
  const resolver = new URL(req.url).searchParams.get('resolver');
  return jsonResponse({ status: 'ok', ...(resolver ? { resolver } : {}), ts: new Date().toISOString() }, 200, origin);
}

// ---------------------------------------------------------------------------
// Main fetch handler
// ---------------------------------------------------------------------------

export default {
  async fetch(req: Request): Promise<Response> {
    const { pathname } = new URL(req.url);
    const origin = req.headers.get('Origin');

    // CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (req.method !== 'GET') {
      return jsonResponse({ error: 'Method not allowed' }, 405, origin);
    }

    if (pathname === '/api/resolve')        return handleResolve(req);
    if (pathname === '/api/sports/events')  return handleSportsEvents(req);
    if (pathname === '/api/health')         return handleHealth(req);

    return jsonResponse({ error: 'Not found' }, 404, origin);
  }
} satisfies ExportedHandler;
