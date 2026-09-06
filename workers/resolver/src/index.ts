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

import { resolveVidSrc }  from './resolvers/vidsrc.js';
import { resolveVidLink } from './resolvers/vidlink.js';
import { resolveVidCore } from './resolvers/vidcore.js';
import { resolveVidUp }   from './resolvers/vidup.js';
import {
  fetchStreamedEvents,
  fetchStreamedToday,
  fetchStreamedBySport,
  fetchStreamedSports,
  fetchStreamedStreams
} from './resolvers/streamed.js';
import type { ResolveParams, ResolveResult, SportEvent } from './resolvers/types.js';

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
// Fallback chain — media (movies / TV / anime)
// ---------------------------------------------------------------------------

async function resolveMedia(params: ResolveParams): Promise<ResolveResult | null> {
  // Media embeds are handled client-side via iframes — worker only needed for legacy HLS
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
  const origin  = req.headers.get('Origin');
  const rawType = searchParams.get('type');
  const id      = searchParams.get('id');
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

// GET /api/sports/events          — live matches
// GET /api/sports/today           — all today's matches
// GET /api/sports/categories      — list of sport categories
// GET /api/sports/by-sport?sport= — matches for a sport
async function handleSportsEvents(req: Request): Promise<Response> {
  const { pathname, searchParams } = new URL(req.url);
  const origin = req.headers.get('Origin');

  if (pathname === '/api/sports/today') {
    const events = await fetchStreamedToday().catch(() => []);
    return jsonResponse(events, 200, origin);
  }
  if (pathname === '/api/sports/categories') {
    const sports = await fetchStreamedSports().catch(() => []);
    return jsonResponse(sports, 200, origin);
  }
  if (pathname === '/api/sports/by-sport') {
    const sport = searchParams.get('sport') || 'football';
    const events = await fetchStreamedBySport(sport).catch(() => []);
    return jsonResponse(events, 200, origin);
  }
  // Default: live
  const events = await fetchStreamedEvents().catch(() => [] as SportEvent[]);
  return jsonResponse(events, 200, origin);
}

// GET /api/sports/streams?sources=alpha:id1,bravo:id2
async function handleSportsStreams(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const origin = req.headers.get('Origin');
  const rawSources = searchParams.get('sources') || '';

  const sources = rawSources
    .split(',')
    .map((s) => { const [source, id] = s.split(':'); return { source, id }; })
    .filter((s) => s.source && s.id);

  if (sources.length === 0) {
    return jsonResponse({ error: 'Missing required param: sources' }, 400, origin);
  }

  const streams = await fetchStreamedStreams(sources).catch(() => []);
  return jsonResponse(streams, 200, origin);
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

    if (pathname === '/api/resolve')          return handleResolve(req);
    if (pathname === '/api/sports/streams')   return handleSportsStreams(req);
    if (pathname.startsWith('/api/sports/'))  return handleSportsEvents(req);
    if (pathname === '/api/health')           return handleHealth(req);

    return jsonResponse({ error: 'Not found' }, 404, origin);
  }
} satisfies ExportedHandler;
