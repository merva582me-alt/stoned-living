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
 * Checks if a match is "NFL vs RedZone" or syndicated RedZone content to exclude
 */
export function isNflRedzone(match: APIMatch): boolean {
  if (!match) return false;
  const title = (match.title || '').trim().toLowerCase();
  if (
    title === 'nfl vs redzone' ||
    title.includes('nfl vs redzone') ||
    title === 'redzone' ||
    title.includes('nfl redzone')
  ) {
    return true;
  }
  const home = (match.teams?.home?.name || '').toLowerCase();
  const away = (match.teams?.away?.name || '').toLowerCase();
  if (home.includes('redzone') || away.includes('redzone')) {
    return true;
  }
  return false;
}

const KNOWN_247_CHANNEL_PATTERNS = [
  /sky sports golf/i,
  /tennis channel/i,
  /rally\s*(tv|channel)/i,
  /nhl network/i,
  /nfl network/i,
  /fox league/i,
  /fox cricket/i,
  /willow cricket/i,
];

/**
 * Identifies continuous 24/7 sports television broadcast networks
 */
export function is247TvChannel(match: APIMatch): boolean {
  if (!match) return false;
  const title = (match.title || '').trim();

  // 1. Explicit match against verified 24/7 broadcast television networks
  if (KNOWN_247_CHANNEL_PATTERNS.some((pattern) => pattern.test(title))) {
    return true;
  }

  // 2. Continuous feeds without head-to-head opponents that are network feeds
  const hasOpponents = Boolean(match.teams?.home?.name && match.teams?.away?.name);
  if (!hasOpponents) {
    if (
      /\b(channel|network|sky sports|fox league|fox cricket|willow cricket)\b/i.test(title) &&
      !/championship|grand prix|session|day \d+|round \d+|stage \d+|freeway 500/i.test(title)
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Fetch all currently live matches across sports
 */
export async function fetchLiveMatches(): Promise<APIMatch[]> {
  const data = await safeFetch<APIMatch[]>('/api/matches/live');
  return (Array.isArray(data) ? data : []).filter((m) => !isNflRedzone(m));
}

/**
 * Fetch all matches scheduled for today
 */
export async function fetchTodayMatches(): Promise<APIMatch[]> {
  const data = await safeFetch<APIMatch[]>('/api/matches/all-today');
  return (Array.isArray(data) ? data : []).filter((m) => !isNflRedzone(m));
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
  return (Array.isArray(data) ? data : []).filter((m) => !isNflRedzone(m));
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
