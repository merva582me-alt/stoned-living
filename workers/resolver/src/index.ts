/**
 * stoned-resolver — Cloudflare Worker
 *
 * Routes:
 *   GET /api/resolve
 *       ?type=movie|tv|anime  &id=<tmdbId>  [&season=N]  [&episode=N]  [&anilist_id=<id>]
 *       → { url: string, provider: string }  |  HTTP 502 { error: string }
 *
 *   GET /api/health
 *       → { status: "ok", ts: string }
 *
 * Sports are handled entirely client-side by calling streamed.pk directly.
 */

import { resolveVidSrc }  from './resolvers/vidsrc.js';
import { resolveVidLink } from './resolvers/vidlink.js';
import { resolveVidCore } from './resolvers/vidcore.js';
import { resolveVidUp }   from './resolvers/vidup.js';
import type { ResolveParams, ResolveResult } from './resolvers/types.js';

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

const ALLOWED_ORIGINS = new Set([
  'https://stoned.living',
  'https://www.stoned.living'
]);

function corsHeaders(origin: string | null): HeadersInit {
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
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
  });
}

// ---------------------------------------------------------------------------
// Media resolver (legacy — client uses iframes directly now)
// ---------------------------------------------------------------------------

async function resolveMedia(params: ResolveParams): Promise<ResolveResult | null> {
  const resolvers: Array<{ name: string; fn: (p: ResolveParams) => Promise<string | null> }> = [
    { name: 'vidsrc',  fn: resolveVidSrc  },
    { name: 'vidlink', fn: resolveVidLink },
    { name: 'vidcore', fn: resolveVidCore },
    { name: 'vidup',   fn: resolveVidUp   }
  ];
  for (const { name, fn } of resolvers) {
    try {
      const url = await fn(params);
      if (url) return { url, provider: name };
    } catch { /* try next */ }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

async function handleResolve(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const origin    = req.headers.get('Origin');
  const rawType   = searchParams.get('type');
  const id        = searchParams.get('id');
  const anilistId = searchParams.get('anilist_id') ?? undefined;

  if (!rawType || !id) {
    return jsonResponse({ error: 'Missing required params: type, id' }, 400, origin);
  }
  if (rawType !== 'movie' && rawType !== 'tv' && rawType !== 'anime') {
    return jsonResponse({ error: 'Invalid type — must be movie, tv, or anime' }, 400, origin);
  }

  const type    = rawType as 'movie' | 'tv' | 'anime';
  const season  = parseInt(searchParams.get('season')  ?? '1', 10) || 1;
  const episode = parseInt(searchParams.get('episode') ?? '1', 10) || 1;

  const result = await resolveMedia({ type, id, season, episode, anilistId });
  if (!result) return jsonResponse({ error: 'No stream found for this title' }, 502, origin);
  return jsonResponse(result, 200, origin);
}

async function handleHealth(req: Request): Promise<Response> {
  const origin = req.headers.get('Origin');
  return jsonResponse({ status: 'ok', ts: new Date().toISOString() }, 200, origin);
}

// ---------------------------------------------------------------------------
// Sports proxy — forwards /api/sports/<path> to streamed.pk with required
// headers that browsers are not allowed to set (Referer, User-Agent).
// This fixes mobile browsers where direct fetch to streamed.pk fails.
// ---------------------------------------------------------------------------

async function handleSports(req: Request, pathname: string): Promise<Response> {
  const origin = req.headers.get('Origin');
  // Strip /api/sports prefix to get the streamed.pk path
  const streamedPath = pathname.replace(/^\/api\/sports/, '');
  const target = `https://streamed.pk${streamedPath}`;

  try {
    const upstream = await fetch(target, {
      headers: {
        'Referer':    'https://streamed.pk',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept':     'application/json, */*',
      },
      cf: { cacheTtl: 30, cacheEverything: false } as RequestInitCfProperties,
    });

    if (!upstream.ok) {
      return jsonResponse({ error: `streamed.pk returned ${upstream.status}` }, upstream.status, origin);
    }

    const body = await upstream.text();
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        ...corsHeaders(origin),
      },
    });
  } catch (err) {
    return jsonResponse({ error: 'Sports proxy fetch failed' }, 502, origin);
  }
}

// ---------------------------------------------------------------------------
// Main fetch handler
// ---------------------------------------------------------------------------

export default {
  async fetch(req: Request): Promise<Response> {
    const { pathname } = new URL(req.url);
    const origin = req.headers.get('Origin');

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (req.method !== 'GET') {
      return jsonResponse({ error: 'Method not allowed' }, 405, origin);
    }

    if (pathname === '/api/resolve')          return handleResolve(req);
    if (pathname === '/api/health')           return handleHealth(req);
    if (pathname.startsWith('/api/sports/'))  return handleSports(req, pathname);

    return jsonResponse({ error: 'Not found' }, 404, origin);
  }
} satisfies ExportedHandler;
