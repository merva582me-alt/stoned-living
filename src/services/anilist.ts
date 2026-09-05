/**
 * AniList GraphQL API service
 * Endpoint: https://graphql.anilist.co  (no API key required, ~90 req/min)
 *
 * Used exclusively by the Anime tab for richer anime-specific metadata
 * (studios, airing status, episode count, genres, seasonal data).
 * TMDb remains the data source for Movies and TV Shows.
 */

import type { MediaItem } from '../types';

const ANILIST_ENDPOINT = 'https://graphql.anilist.co';

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
    release_date: year ? `${year}-01-01` : undefined,
    first_air_date: year ? `${year}-01-01` : undefined,
    genre_ids: [16],                        // TMDb animation genre ID
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
    const data = await gqlFetch<{ Page: { media: AniListMedia[] } }>(`
      query {
        Page(page: 1, perPage: 24) {
          media(sort: TRENDING_DESC, type: ANIME, isAdult: false) {
            ${MEDIA_FIELDS}
          }
        }
      }
    `);
    return data.Page.media.map(anilistToMediaItem);
  } catch {
    return [];
  }
}

export async function fetchAniListSeasonal(
  season: 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL' = getCurrentSeason(),
  year: number = new Date().getFullYear()
): Promise<MediaItem[]> {
  try {
    const data = await gqlFetch<{ Page: { media: AniListMedia[] } }>(`
      query($season: MediaSeason, $year: Int) {
        Page(page: 1, perPage: 24) {
          media(season: $season, seasonYear: $year, type: ANIME, isAdult: false, sort: POPULARITY_DESC) {
            ${MEDIA_FIELDS}
          }
        }
      }
    `, { season, year });
    return data.Page.media.map(anilistToMediaItem);
  } catch {
    return [];
  }
}

export async function fetchAniListSearch(query: string): Promise<MediaItem[]> {
  if (!query.trim()) return [];
  try {
    const data = await gqlFetch<{ Page: { media: AniListMedia[] } }>(`
      query($search: String) {
        Page(page: 1, perPage: 20) {
          media(search: $search, type: ANIME, isAdult: false) {
            ${MEDIA_FIELDS}
          }
        }
      }
    `, { search: query });
    return data.Page.media.map(anilistToMediaItem);
  } catch {
    return [];
  }
}

export async function fetchAniListDetails(id: number): Promise<MediaItem | null> {
  try {
    const data = await gqlFetch<{ Media: AniListMedia }>(`
      query($id: Int) {
        Media(id: $id, type: ANIME) {
          ${MEDIA_FIELDS}
        }
      }
    `, { id });
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
