/**
 * VidUp Resolver
 * Docs:   https://vidup.to/#documentation
 * Source: https://github.com/sharoon7171/vidup-stream-solver
 *
 * API:
 *   Movie:   GET https://vidup.to/api/stream/movie/{tmdbId}
 *   TV:      GET https://vidup.to/api/stream/tv/{tmdbId}/{season}/{episode}
 *   Returns: { url: string } or { sources: [{file: string}] }
 */

import type { ResolveParams } from './types.js';

const BASE = 'https://vidup.to';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  'Referer': BASE,
  'Origin': BASE,
  'Accept': 'application/json, text/plain, */*'
};

function extractM3u8(text: string): string | null {
  const re = /(https?:\/\/[^\s"'<>\\]+\.m3u8[^\s"'<>\\]*)/;
  const m = text.match(re);
  return m ? m[1] : null;
}

function parseSourcesJson(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;
  if (typeof obj.url    === 'string' && obj.url.includes('.m3u8'))    return obj.url;
  if (typeof obj.file   === 'string' && obj.file.includes('.m3u8'))   return obj.file;
  if (typeof obj.src    === 'string' && obj.src.includes('.m3u8'))    return obj.src;
  if (typeof obj.hls    === 'string' && obj.hls.includes('.m3u8'))    return obj.hls;
  if (typeof obj.stream === 'string' && obj.stream.includes('.m3u8')) return obj.stream;
  if (Array.isArray(obj.sources)) {
    for (const s of obj.sources) {
      const r = parseSourcesJson(s);
      if (r) return r;
    }
  }
  if (Array.isArray(obj.streams)) {
    for (const s of obj.streams) {
      const r = parseSourcesJson(s);
      if (r) return r;
    }
  }
  if (typeof obj.data   === 'object') return parseSourcesJson(obj.data);
  if (typeof obj.result === 'object') return parseSourcesJson(obj.result);
  return null;
}

export async function resolveVidUp(params: ResolveParams): Promise<string | null> {
  const { type, id, season = 1, episode = 1 } = params;

  // Primary: JSON API
  const apiUrl =
    type === 'movie'
      ? `${BASE}/api/stream/movie/${id}`
      : `${BASE}/api/stream/tv/${id}/${season}/${episode}`;

  try {
    const res = await fetch(apiUrl, { headers: HEADERS, redirect: 'follow' });
    if (res.ok) {
      const json = await res.json();
      const m3u8 = parseSourcesJson(json);
      if (m3u8) return m3u8;
      if (typeof json === 'string' && json.includes('.m3u8')) return json;
    }
  } catch { /* fall through */ }

  // Fallback: embed page scrape
  const embedUrl =
    type === 'movie'
      ? `${BASE}/e/${id}`
      : `${BASE}/e/${id}?s=${season}&e=${episode}`;

  try {
    const res = await fetch(embedUrl, { headers: HEADERS, redirect: 'follow' });
    if (res.ok) {
      const html = await res.text();
      const m3u8 = extractM3u8(html);
      if (m3u8) return m3u8;
    }
  } catch { /* fall through */ }

  return null;
}
