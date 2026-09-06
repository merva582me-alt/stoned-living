/**
 * Streamed.pk Resolver
 * Official API: https://streamed.pk/docs
 *
 * Matches:  GET https://streamed.pk/api/matches/live
 *           → [{ id, title, category, sources:[{source,id}], teams, popular }]
 *
 * Streams:  GET https://streamed.pk/api/stream/{source}/{id}
 *           → [{ url, headers: { Referer } }]
 *           Each item has an HLS url + required Referer header.
 */

import type { SportResolveParams, SportEvent } from './types.js';

const BASE     = 'https://streamed.pk';
const API_BASE = `${BASE}/api`;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  'Referer':    BASE,
  'Origin':     BASE,
  'Accept':     'application/json'
};

interface StreamedSource {
  source: string;
  id:     string;
}

interface StreamedMatch {
  id:       string;
  title:    string;
  category: string;
  poster?:  string;
  popular?: boolean;
  sources:  StreamedSource[];
}

interface StreamedStream {
  url:      string;
  headers?: { Referer?: string; [k: string]: string | undefined };
}

function normaliseSportCategory(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes('football') || lower.includes('soccer')) return 'Football';
  if (lower.includes('basketball') || lower.includes('nba'))  return 'Basketball';
  if (lower.includes('ufc') || lower.includes('mma'))         return 'UFC / MMA';
  if (lower.includes('tennis'))                               return 'Tennis';
  if (lower.includes('baseball') || lower.includes('mlb'))    return 'Baseball';
  if (lower.includes('hockey') || lower.includes('nhl'))      return 'Hockey';
  if (lower.includes('golf'))                                 return 'Golf';
  if (lower.includes('cricket'))                              return 'Cricket';
  if (lower.includes('f1') || lower.includes('formula'))      return 'Motorsport';
  if (lower.includes('boxing'))                               return 'Boxing';
  if (lower.includes('rugby') || lower.includes('afl'))       return 'Rugby / AFL';
  if (lower.includes('darts'))                                return 'Darts';
  if (lower.includes('motor') || lower.includes('nascar'))    return 'Motorsport';
  return raw || 'Sports';
}

export async function fetchStreamedEvents(): Promise<SportEvent[]> {
  try {
    const res = await fetch(`${API_BASE}/matches/live`, { headers: HEADERS });
    if (!res.ok) return [];
    const matches = await res.json() as StreamedMatch[];
    if (!Array.isArray(matches)) return [];
    return matches.map((m) => ({
      id:             m.id,
      title:          m.title,
      sport_category: normaliseSportCategory(m.category),
      provider:       'streamed',
      thumbnail:      m.poster
        ? (m.poster.startsWith('http') ? m.poster : `${BASE}${m.poster}`)
        : undefined,
      is_live: true
    }));
  } catch {
    return [];
  }
}

export async function resolveStreamed(params: SportResolveParams): Promise<string | null> {
  const { channelId } = params;
  try {
    // Get live matches to find the sources for this match ID
    const matchRes = await fetch(`${API_BASE}/matches/live`, { headers: HEADERS });
    if (!matchRes.ok) return null;
    const matches = await matchRes.json() as StreamedMatch[];
    const match = matches.find((m) => m.id === channelId);
    if (!match?.sources?.length) return null;

    // Try each source until one returns a valid HLS URL
    for (const src of match.sources) {
      try {
        const streamRes = await fetch(`${API_BASE}/stream/${src.source}/${src.id}`, { headers: HEADERS });
        if (!streamRes.ok) continue;
        const streams = await streamRes.json() as StreamedStream[];
        if (!Array.isArray(streams) || streams.length === 0) continue;
        // Return the first stream with a valid HLS URL
        const stream = streams.find((s) => s.url && s.url.includes('.m3u8'));
        if (stream?.url) return stream.url;
      } catch { /* try next source */ }
    }
    return null;
  } catch {
    return null;
  }
}
