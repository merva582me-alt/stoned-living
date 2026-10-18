import { APIMatch, StreamedStream, SportCategory } from '../types';

const STREAMED_BASE = 'https://streamed.pk';

async function safeFetch<T>(endpoint: string): Promise<T | null> {
  try {
    const res = await fetch(`${STREAMED_BASE}${endpoint}`, {
      headers: {
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      console.warn(`[streamed.pk] HTTP ${res.status} from ${endpoint}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.error(`[streamed.pk] Error requesting ${endpoint}:`, err);
    return null;
  }
}

/**
 * Fetch all currently live matches across sports
 */
export async function fetchLiveMatches(): Promise<APIMatch[]> {
  const data = await safeFetch<APIMatch[]>('/api/matches/live');
  return Array.isArray(data) ? data : [];
}

/**
 * Fetch all matches scheduled for today
 */
export async function fetchTodayMatches(): Promise<APIMatch[]> {
  const data = await safeFetch<APIMatch[]>('/api/matches/all-today');
  return Array.isArray(data) ? data : [];
}

/**
 * Fetch all available sports categories
 */
export async function fetchSportsCategories(): Promise<SportCategory[]> {
  const data = await safeFetch<SportCategory[]>('/api/sports');
  if (Array.isArray(data) && data.length > 0) {
    return data;
  }
  // Standard fallback sports if API is cold
  return [
    { id: 'football', name: 'Football' },
    { id: 'basketball', name: 'Basketball' },
    { id: 'american-football', name: 'American Football' },
    { id: 'hockey', name: 'Hockey' },
    { id: 'baseball', name: 'Baseball' },
    { id: 'mma', name: 'MMA' },
    { id: 'boxing', name: 'Boxing' },
    { id: 'tennis', name: 'Tennis' },
    { id: 'motorsport', name: 'Motorsport' },
  ];
}

/**
 * Fetch matches for a specific sport category
 */
export async function fetchMatchesBySport(sportId: string): Promise<APIMatch[]> {
  if (!sportId || sportId === 'all') {
    return fetchTodayMatches();
  }
  const data = await safeFetch<APIMatch[]>(`/api/matches/${encodeURIComponent(sportId)}`);
  return Array.isArray(data) ? data : [];
}

export async function fetchStreams(source: string, sourceId: string): Promise<StreamedStream[]> {
  if (!source || !sourceId) return [];
  const data = await safeFetch<StreamedStream[]>(`/api/stream/${encodeURIComponent(source)}/${encodeURIComponent(sourceId)}`);
  return Array.isArray(data) ? data : [];
}

/**
 * Fetch and combine all available stream feeds across all sources for a match
 */
export async function fetchAllMatchStreams(
  sources: Array<{ source: string; id: string }>
): Promise<StreamedStream[]> {
  if (!sources || sources.length === 0) return [];

  const results = await Promise.allSettled(
    sources.map((s) => fetchStreams(s.source, s.id))
  );

  const allStreams: StreamedStream[] = [];
  const seenUrls = new Set<string>();

  results.forEach((res, index) => {
    if (res.status === 'fulfilled' && Array.isArray(res.value)) {
      const srcMeta = sources[index];
      const sourceName = srcMeta?.source ? srcMeta.source.toUpperCase() : `SRC ${index + 1}`;

      res.value.forEach((stream, sIdx) => {
        if (!stream.embedUrl) return;
        const cleanUrl = stream.embedUrl.trim();
        if (seenUrls.has(cleanUrl)) return;
        seenUrls.add(cleanUrl);

        allStreams.push({
          ...stream,
          embedUrl: cleanUrl,
          source: stream.source || sourceName,
          streamNo: stream.streamNo || (sIdx + 1),
        });
      });
    }
  });

  return allStreams;
}

/**
 * Helper to construct team badge image URL
 */
export function getTeamBadgeUrl(badgeId?: string): string | null {
  if (!badgeId) return null;
  if (badgeId.startsWith('http')) return badgeId;
  return `${STREAMED_BASE}/api/images/badge/${badgeId}.webp`;
}

/**
 * Helper to construct match poster URL
 */
export function getMatchPosterUrl(poster?: string): string | null {
  if (!poster) return null;
  if (poster.startsWith('http')) return poster;
  if (poster.startsWith('/api/images/')) {
    return `${STREAMED_BASE}${poster.endsWith('.webp') ? poster : `${poster}.webp`}`;
  }
  return `${STREAMED_BASE}/api/images/proxy/${poster}.webp`;
}
