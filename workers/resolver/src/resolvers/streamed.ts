/**
 * Streamed.pk Resolver
 *
 * Ported from: https://github.com/sharoon7171/streamed-pk-hls-stream-resolver
 *
 * Event listing flow:
 *   GET https://streamed.su/api/matches/live  → JSON array of live matches
 *   Each match has: { id, title, category, sources: [{ source, id }] }
 *
 * Stream resolution flow:
 *   GET https://streamed.su/api/stream/<source>/<streamId>
 *   → JSON: { embedUrl } or { hls } or follow embed page for .m3u8
 */

import type { SportResolveParams, SportEvent } from './types.js';

const BASE        = 'https://streamed.su';
const API_BASE    = `${BASE}/api`;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  'Referer': BASE,
  'Origin': BASE
};

// ---------------------------------------------------------------------------
// Types from Streamed API
// ---------------------------------------------------------------------------

interface StreamedSource {
  source: string;
  id: string;
}

interface StreamedMatch {
  id: string;
  title: string;
  category: string;
  poster?: string;
  sources: StreamedSource[];
}

// ---------------------------------------------------------------------------
// Event listing
// ---------------------------------------------------------------------------

export async function fetchStreamedEvents(): Promise<SportEvent[]> {
  try {
    const res = await fetch(`${API_BASE}/matches/live`, {
      headers: { ...HEADERS, Accept: 'application/json' }
    });
    if (!res.ok) return [];

    const matches = await res.json() as StreamedMatch[];
    if (!Array.isArray(matches)) return [];

    return matches.map((m) => ({
      id: m.id,
      title: m.title,
      sport_category: normaliseSportCategory(m.category),
      provider: 'streamed',
      thumbnail: m.poster,
      is_live: true
    }));
  } catch {
    return [];
  }
}

function normaliseSportCategory(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes('football') || lower.includes('soccer')) return 'Football';
  if (lower.includes('basketball') || lower.includes('nba'))   return 'Basketball';
  if (lower.includes('ufc') || lower.includes('mma'))          return 'UFC / MMA';
  if (lower.includes('tennis'))                                return 'Tennis';
  if (lower.includes('baseball') || lower.includes('mlb'))     return 'Baseball';
  if (lower.includes('hockey') || lower.includes('nhl'))       return 'Hockey';
  if (lower.includes('golf'))                                  return 'Golf';
  if (lower.includes('cricket'))                               return 'Cricket';
  if (lower.includes('f1') || lower.includes('formula'))       return 'Motorsport';
  if (lower.includes('boxing'))                                return 'Boxing';
  return raw || 'Sports';
}

// ---------------------------------------------------------------------------
// Stream resolution
// ---------------------------------------------------------------------------

function extractM3u8(text: string): string | null {
  const re = /(https?:\/\/[^\s"'<>\\]+\.m3u8[^\s"'<>\\]*)/;
  const m = text.match(re);
  return m ? m[1] : null;
}

async function resolveStreamedSource(source: string, streamId: string): Promise<string | null> {
  // Strategy 1: JSON API endpoint
  try {
    const apiUrl = `${API_BASE}/stream/${source}/${streamId}`;
    const res = await fetch(apiUrl, {
      headers: { ...HEADERS, Accept: 'application/json' }
    });
    if (res.ok) {
      const data = await res.json() as Record<string, unknown>;
      // Direct HLS in response
      if (typeof data.hls === 'string' && data.hls.includes('.m3u8')) return data.hls;
      if (typeof data.url === 'string' && data.url.includes('.m3u8')) return data.url;

      // Embed URL to follow
      const embedUrl = typeof data.embedUrl === 'string' ? data.embedUrl
                     : typeof data.embed     === 'string' ? data.embed
                     : null;
      if (embedUrl) {
        const embedRes = await fetch(embedUrl.startsWith('//') ? `https:${embedUrl}` : embedUrl, {
          headers: HEADERS,
          redirect: 'follow'
        });
        if (embedRes.ok) {
          const html = await embedRes.text();
          const m3u8 = extractM3u8(html);
          if (m3u8) return m3u8;
        }
      }
    }
  } catch { /* fall through */ }

  // Strategy 2: direct embed page scrape
  try {
    const embedPage = `${BASE}/watch/${source}/${streamId}`;
    const res = await fetch(embedPage, { headers: HEADERS, redirect: 'follow' });
    if (res.ok) {
      const html = await res.text();
      const m3u8 = extractM3u8(html);
      if (m3u8) return m3u8;
    }
  } catch { /* fall through */ }

  return null;
}

export async function resolveStreamed(params: SportResolveParams): Promise<string | null> {
  const { channelId } = params;

  try {
    // Look up live match by ID to get sources list
    const res = await fetch(`${API_BASE}/matches/live`, {
      headers: { ...HEADERS, Accept: 'application/json' }
    });
    if (!res.ok) return null;

    const matches = await res.json() as StreamedMatch[];
    const match = matches.find((m) => m.id === channelId);
    if (!match || !match.sources?.length) return null;

    // Try each source until one resolves
    for (const src of match.sources) {
      const m3u8 = await resolveStreamedSource(src.source, src.id);
      if (m3u8) return m3u8;
    }
    return null;
  } catch {
    return null;
  }
}
