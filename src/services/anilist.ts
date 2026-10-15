/**
 * AniList GraphQL API service
 * Endpoint: https://graphql.anilist.co  (no API key required, ~90 req/min)
 *
 * Used exclusively by the Anime tab for richer anime-specific metadata
 * (studios, airing status, episode count, genres, seasonal data).
 * TMDb remains the data source for Movies and TV Shows.
 */

import type { MediaItem } from '../types';
import { isReleasedMedia } from '../utils/mediaUtils';

const ANILIST_ENDPOINT = 'https://graphql.anilist.co';

// ---------------------------------------------------------------------------
// localStorage cache — same stale-while-revalidate pattern as TMDb
// ---------------------------------------------------------------------------

const anilistSyncCache = new Map<string, any>();
const CACHE_TTL = 3600_000; // 1 hour fresh window
const CACHE_MAX_AGE = 86_400_000; // 24 hours max

function anilistCacheGet(key: string): any {
  if (anilistSyncCache.has(key)) return anilistSyncCache.get(key);
  try {
    const raw = localStorage.getItem(`stoned_anilist_v1_${key}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.data && parsed?.timestamp && Date.now() - parsed.timestamp < CACHE_MAX_AGE) {
        anilistSyncCache.set(key, parsed);
        return parsed;
      }
    }
  } catch (_) { /* quota / SSR */ }
  return null;
}

function anilistCacheSet(key: string, data: any) {
  const entry = { timestamp: Date.now(), data };
  anilistSyncCache.set(key, entry);
  try {
    localStorage.setItem(`stoned_anilist_v1_${key}`, JSON.stringify(entry));
  } catch (_) { /* quota */ }
}

// ---------------------------------------------------------------------------
// GQL query helper
// ---------------------------------------------------------------------------

async function gqlFetch<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(ANILIST_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query, variables })
  });
  if (!res.ok) throw new Error(`AniList HTTP ${res.status}`);
  const json = await res.json() as { data: T; errors?: unknown[] };
  if (json.errors?.length) throw new Error('AniList GraphQL error');
  return json.data;
}

async function cachedGqlFetch<T>(cacheKey: string, query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const cached = anilistCacheGet(cacheKey);
  if (cached) {
    // Background revalidate only if data is older than 1 hour
    if (Date.now() - cached.timestamp > CACHE_TTL) {
      gqlFetch<T>(query, variables).then((data) => anilistCacheSet(cacheKey, data)).catch(() => {});
    }
    return cached.data as T;
  }
  const data = await gqlFetch<T>(query, variables);
  anilistCacheSet(cacheKey, data);
  return data;
}

// ---------------------------------------------------------------------------
// GraphQL fragments
// ---------------------------------------------------------------------------

const MEDIA_FIELDS = `
  id
  title { romaji english }
  description(asHtml: false)
  coverImage { extraLarge large }
  bannerImage
  averageScore
  popularity
  episodes
  season
  seasonYear
  status
  genres
  studios(isMain: true) { nodes { name } }
  startDate { year month day }
  format
  isAdult
`;

// ---------------------------------------------------------------------------
// Mapper — AniList media → stoned.living MediaItem
// ---------------------------------------------------------------------------

type AniListMedia = {
  id: number;
  title: { romaji: string; english?: string };
  description?: string;
  coverImage: { extraLarge?: string; large?: string };
  bannerImage?: string;
  averageScore?: number;
  popularity?: number;
  episodes?: number;
  season?: string;
  seasonYear?: number;
  status?: string;
  genres?: string[];
  studios?: { nodes: { name: string }[] };
  startDate?: { year?: number; month?: number; day?: number };
  format?: string;
  isAdult?: boolean;
};

export function anilistToMediaItem(m: AniListMedia): MediaItem {
  const title = m.title.english || m.title.romaji;
  const year = m.startDate?.year;
  const month = m.startDate?.month;
  const day = m.startDate?.day;
  const dateStr = year
    ? `${year}-${String(month || 1).padStart(2, '0')}-${String(day || 1).padStart(2, '0')}`
    : undefined;
  const studios = m.studios?.nodes?.map((s) => s.name) ?? [];

  return {
    id: m.id,                               // AniList ID — used by vidsrc anime resolver
    title,
    name: title,
    overview: m.description?.replace(/<[^>]+>/g, '') ?? '',
    poster_path: m.coverImage?.extraLarge || m.coverImage?.large || null,
    backdrop_path: m.bannerImage || null,
    vote_average: m.averageScore ? m.averageScore / 10 : 0,
    vote_count: m.popularity ?? 0,
    popularity: m.popularity ?? 0,
    media_type: 'tv',
    release_date: dateStr,
    first_air_date: dateStr,
    genre_ids: [16],                        // TMDb animation genre ID
    status: m.status,
    // AniList-specific extensions
    ...({
      anilist_id: m.id,
      airing_status: m.status,
      anilist_studios: studios,
      is_anime: true
    } as Partial<MediaItem>)
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function fetchAniListTrending(): Promise<MediaItem[]> {
  try {
    const query = `
      query {
        Page(page: 1, perPage: 24) {
          media(sort: TRENDING_DESC, type: ANIME, isAdult: false) {
            ${MEDIA_FIELDS}
          }
        }
      }
    `;
    const data = await cachedGqlFetch<{ Page: { media: AniListMedia[] } }>('trending', query);
    return data.Page.media.map(anilistToMediaItem).filter(isReleasedMedia);
  } catch {
    return [];
  }
}

export async function fetchAniListSeasonal(
  season: 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL' = getCurrentSeason(),
  year: number = new Date().getFullYear()
): Promise<MediaItem[]> {
  try {
    const query = `
      query($season: MediaSeason, $year: Int) {
        Page(page: 1, perPage: 24) {
          media(season: $season, seasonYear: $year, type: ANIME, isAdult: false, sort: POPULARITY_DESC) {
            ${MEDIA_FIELDS}
          }
        }
      }
    `;
    const data = await cachedGqlFetch<{ Page: { media: AniListMedia[] } }>(`seasonal_${season}_${year}`, query, { season, year });
    return data.Page.media.map(anilistToMediaItem).filter(isReleasedMedia);
  } catch {
    return [];
  }
}

export async function fetchAniListSearch(query: string): Promise<MediaItem[]> {
  if (!query.trim()) return [];
  try {
    const gql = `
      query($search: String) {
        Page(page: 1, perPage: 20) {
          media(search: $search, type: ANIME, isAdult: false) {
            ${MEDIA_FIELDS}
          }
        }
      }
    `;
    // Search results are not cached (user-specific and short-lived)
    const data = await gqlFetch<{ Page: { media: AniListMedia[] } }>(gql, { search: query });
    return data.Page.media.map(anilistToMediaItem).filter(isReleasedMedia);
  } catch {
    return [];
  }
}

export async function fetchAniListDetails(id: number): Promise<MediaItem | null> {
  try {
    const query = `
      query($id: Int) {
        Media(id: $id, type: ANIME) {
          ${MEDIA_FIELDS}
        }
      }
    `;
    const data = await cachedGqlFetch<{ Media: AniListMedia }>(`details_${id}`, query, { id });
    return anilistToMediaItem(data.Media);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCurrentSeason(): 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL' {
  const month = new Date().getMonth() + 1;
  if (month <= 3)  return 'WINTER';
  if (month <= 6)  return 'SPRING';
  if (month <= 9)  return 'SUMMER';
  return 'FALL';
}
