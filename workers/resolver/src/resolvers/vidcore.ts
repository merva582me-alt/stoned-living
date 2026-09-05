/**
 * VidCore Resolver
 *
 * Ported from: https://github.com/sharoon7171/vidcore-hls-scraper-resolver
 *
 * Flow:
 *   1. Build embed URL → https://vidcore.cc/embed/movie/<tmdbId>
 *                     or https://vidcore.cc/embed/tv/<tmdbId>/<season>/<episode>
 *   2. Fetch the page, locate the JSON API call or inline sources object in the script
 *   3. Follow the sources API endpoint that returns a JSON with file/url/.m3u8
 *   4. Return the .m3u8 URL
 */

import type { ResolveParams } from './types.js';

const BASE = 'https://vidcore.cc';
const ALT_BASE = 'https://player.vidcore.xyz';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  'Referer': BASE
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractM3u8(html: string): string | null {
  const re = /(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/;
  const m = html.match(re);
  return m ? m[1] : null;
}

function extractApiPath(html: string): string | null {
  // VidCore embeds a JS call like: getSources('/api/sources?id=...') or fetch('/api/...')
  const patterns = [
    /['"`](\/?api\/(?:sources|stream|media)[^'"`\s]+)['"`]/i,
    /fetch\s*\(\s*['"`]([^'"`]+)['"`]/i,
    /getSources\s*\(\s*['"`]([^'"`]+)['"`]/i
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return m[1];
  }
  return null;
}

function parseSourcesJson(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;

  if (typeof obj.file === 'string' && obj.file.includes('.m3u8')) return obj.file;
  if (typeof obj.url  === 'string' && obj.url.includes('.m3u8'))  return obj.url;
  if (typeof obj.src  === 'string' && obj.src.includes('.m3u8'))  return obj.src;

  if (Array.isArray(obj.sources)) {
    for (const s of obj.sources) {
      const src = s as Record<string, unknown>;
      if (typeof src.file === 'string' && src.file.includes('.m3u8')) return src.file;
      if (typeof src.url  === 'string' && src.url.includes('.m3u8'))  return src.url;
    }
  }
  if (typeof obj.data === 'object') return parseSourcesJson(obj.data);
  return null;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function resolveVidCore(params: ResolveParams): Promise<string | null> {
  const { type, id, season = 1, episode = 1 } = params;

  const embedUrl =
    type === 'movie'
      ? `${BASE}/embed/movie/${id}`
      : `${BASE}/embed/tv/${id}/${season}/${episode}`;

  try {
    const res = await fetch(embedUrl, { headers: HEADERS, redirect: 'follow' });
    if (!res.ok) return null;
    const html = await res.text();

    // ── Strategy 1: locate inline API endpoint and fetch it ────────────────
    const apiPath = extractApiPath(html);
    if (apiPath) {
      const apiUrl = apiPath.startsWith('http') ? apiPath : `${BASE}${apiPath.startsWith('/') ? '' : '/'}${apiPath}`;
      try {
        const apiRes = await fetch(apiUrl, {
          headers: { ...HEADERS, Accept: 'application/json' },
          redirect: 'follow'
        });
        if (apiRes.ok) {
          const json = await apiRes.json();
          const m3u8 = parseSourcesJson(json);
          if (m3u8) return m3u8;
        }
      } catch { /* fall through */ }
    }

    // ── Strategy 2: try alternate domain ───────────────────────────────────
    const altUrl =
      type === 'movie'
        ? `${ALT_BASE}/embed/movie/${id}`
        : `${ALT_BASE}/embed/tv/${id}/${season}/${episode}`;

    try {
      const altRes = await fetch(altUrl, { headers: { ...HEADERS, Referer: ALT_BASE }, redirect: 'follow' });
      if (altRes.ok) {
        const altHtml = await altRes.text();
        const m3u8 = extractM3u8(altHtml);
        if (m3u8) return m3u8;
      }
    } catch { /* fall through */ }

    // ── Strategy 3: scan raw HTML for .m3u8 ────────────────────────────────
    return extractM3u8(html);

  } catch {
    return null;
  }
}
