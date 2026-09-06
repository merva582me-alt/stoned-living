/**
 * Streamed.pk Resolver
 * Official API: https://streamed.pk/docs
 *
 * Matches:
 *   GET /api/matches/live          — currently live matches
 *   GET /api/matches/all-today     — all matches today
 *   GET /api/matches/all           — all matches
 *   GET /api/matches/{sport}       — matches for a specific sport
 *   GET /api/sports                — list of all sport categories
 *
 * Streams: GET /api/stream/{source}/{id}
 *   → Stream[]  (id, streamNo, language, hd, embedUrl, source)
 *
 * Images:
 *   Badge:  /api/images/badge/{badge}.webp
 *   Poster: /api/images/poster/{home}/{away}.webp
 */

import type { SportEvent } from './types.js';

const BASE     = 'https://streamed.pk';
const API_BASE = `${BASE}/api`;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  'Referer':    BASE,
  'Origin':     BASE,
  'Accept':     'application/json'
};

// ---------------------------------------------------------------------------
// Types matching the official API spec
// ---------------------------------------------------------------------------

interface APIMatchSource {
  source: string;
  id:     string;
}

interface APIMatch {
  id:       string;
  title:    string;
  category: string;
  date:     number;
  poster?:  string;
  popular:  boolean;
  teams?: {
    home?: { name: string; badge: string };
    away?: { name: string; badge: string };
  };
  sources: APIMatchSource[];
}

export interface StreamedStream {
  id:       string;
  streamNo: number;
  language: string;
  hd:       boolean;
  embedUrl: string;
  source:   string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normaliseSportCategory(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower === 'football' || lower === 'soccer')       return 'Football';
  if (lower === 'basketball' || lower === 'nba')        return 'Basketball';
  if (lower === 'mma' || lower === 'ufc')               return 'UFC / MMA';
  if (lower === 'boxing')                               return 'Boxing';
  if (lower === 'tennis')                               return 'Tennis';
  if (lower === 'baseball' || lower === 'mlb')          return 'Baseball';
  if (lower === 'hockey' || lower === 'nhl')            return 'Hockey';
  if (lower === 'golf')                                 return 'Golf';
  if (lower === 'cricket')                              return 'Cricket';
  if (lower.includes('motor') || lower === 'f1')        return 'Motorsport';
  if (lower === 'rugby' || lower === 'afl')             return 'Rugby / AFL';
  if (lower === 'darts')                                return 'Darts';
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function getPosterUrl(match: APIMatch): string | undefined {
  if (match.teams?.home?.badge && match.teams?.away?.badge) {
    return `${API_BASE}/images/poster/${match.teams.home.badge}/${match.teams.away.badge}.webp`;
  }
  if (match.poster) {
    return `${BASE}${match.poster}.webp`;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Helper: convert APIMatch[] → SportEvent[]
// ---------------------------------------------------------------------------

function matchesToEvents(matches: APIMatch[], isLive: boolean): (SportEvent & { sources: APIMatchSource[]; date: number })[] {
  if (!Array.isArray(matches)) return [];
  return matches.map((m) => ({
    id:             m.id,
    title:          m.title,
    sport_category: normaliseSportCategory(m.category),
    provider:       'streamed',
    thumbnail:      getPosterUrl(m),
    is_live:        isLive,
    sources:        m.sources,
    date:           m.date,
    teams:          m.teams
  } as any));
}

// ---------------------------------------------------------------------------
// Public: fetch live events
// ---------------------------------------------------------------------------

export async function fetchStreamedEvents(): Promise<SportEvent[]> {
  try {
    const res = await fetch(`${API_BASE}/matches/live`, { headers: HEADERS });
    if (!res.ok) return [];
    return matchesToEvents(await res.json() as APIMatch[], true);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Public: fetch today's matches (live + upcoming today)
// ---------------------------------------------------------------------------

export async function fetchStreamedToday(): Promise<any[]> {
  try {
    const res = await fetch(`${API_BASE}/matches/all-today`, { headers: HEADERS });
    if (!res.ok) return [];
    return matchesToEvents(await res.json() as APIMatch[], false);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Public: fetch matches for a specific sport
// ---------------------------------------------------------------------------

export async function fetchStreamedBySport(sport: string): Promise<any[]> {
  try {
    const res = await fetch(`${API_BASE}/matches/${sport}`, { headers: HEADERS });
    if (!res.ok) return [];
    const matches = await res.json() as APIMatch[];
    // Mark live if date is within the last 4 hours or future within 1 hour
    const now = Date.now();
    return matchesToEvents(matches, false).map((m: any) => ({
      ...m,
      is_live: m.date >= now - 4 * 3600000 && m.date <= now + 3600000
    }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Public: fetch all sport categories
// ---------------------------------------------------------------------------

export async function fetchStreamedSports(): Promise<{ id: string; name: string }[]> {
  try {
    const res = await fetch(`${API_BASE}/sports`, { headers: HEADERS });
    if (!res.ok) return [];
    const data = await res.json() as { id: string; name: string }[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Public: fetch streams for a match — returns array of embed-ready streams
// ---------------------------------------------------------------------------

export async function fetchStreamedStreams(
  sources: APIMatchSource[]
): Promise<StreamedStream[]> {
  const all: StreamedStream[] = [];
  for (const src of sources) {
    try {
      const res = await fetch(`${API_BASE}/stream/${src.source}/${src.id}`, { headers: HEADERS });
      if (!res.ok) continue;
      const streams = await res.json() as StreamedStream[];
      if (Array.isArray(streams)) all.push(...streams.filter((s) => s.embedUrl));
    } catch { /* try next source */ }
  }
  return all;
}
