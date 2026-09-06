import { MediaItem, Season, Comment, SiteSettings } from '../types';
import { StrainDatabase } from '../data/strainDatabase';
import { MOCK_MOVIES } from '../data/mockTmdbData';
import {
  cleanAndFilterMediaList
} from '../utils/mediaUtils';

// TMDb credentials — env vars baked in at build time, with hardcoded fallback
const TMDB_KEY = import.meta.env.VITE_TMDB_API_KEY || 'fca9ca111889a84810f0801d89ac9c61';
const TMDB_READ_TOKEN = import.meta.env.VITE_TMDB_READ_TOKEN as string;

// Base TMDb URL builder — all requests go directly to TMDb (no Express backend)
function tmdbUrl(path: string, params: Record<string, string> = {}): string {
  const base: Record<string, string> = {
    include_adult: 'false',
    language: 'en-US',
    ...(TMDB_KEY ? { api_key: TMDB_KEY } : {})
  };
  const qs = new URLSearchParams({ ...base, ...params }).toString();
  return `https://api.themoviedb.org/3${path}?${qs}`;
}

function tmdbHeaders(): HeadersInit {
  return TMDB_READ_TOKEN
    ? { Authorization: `Bearer ${TMDB_READ_TOKEN}` }
    : {};
}

// ---------------------------------------------------------------------------
// Strain enrichment helpers
// ---------------------------------------------------------------------------

function enrichItemClient(item: any) {
  if (!item) return item;
  const pairing = StrainDatabase.getPairingForMedia(item);
  const formattedStatus =
    item.status && String(item.status).trim().toLowerCase() === 'released'
      ? 'New Release'
      : item.status;
  return { ...item, status: formattedStatus, ...pairing };
}

export function enrichListClient(
  results: any[],
  options: { englishOnly?: boolean; prioritizeNew?: boolean } = {}
) {
  if (!Array.isArray(results)) return [];
  const cleaned = cleanAndFilterMediaList(results, options);
  return cleaned.map((item) => enrichItemClient(item));
}

// ---------------------------------------------------------------------------
// In-memory + localStorage cache
// ---------------------------------------------------------------------------

const apiCache = new Map<string, Promise<any>>();
const syncCache = new Map<string, any>();

function getLocalStorageCache(key: string): any {
  try {
    const raw = localStorage.getItem(`stoned_cache_v2_${key}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.data && parsed?.timestamp && Date.now() - parsed.timestamp < 86400000) {
        return parsed.data;
      }
    }
  } catch (_) { /* quota / SSR */ }
  return null;
}

function setLocalStorageCache(key: string, data: any) {
  try {
    localStorage.setItem(`stoned_cache_v2_${key}`, JSON.stringify({ timestamp: Date.now(), data }));
  } catch (_) { /* quota */ }
}

async function fetchTmdb<T>(url: string): Promise<T> {
  try {
    const res = await fetch(url, { headers: tmdbHeaders() });
    if (!res.ok) throw new Error(`TMDb HTTP ${res.status}`);
    const data = await res.json();
    if (data && Array.isArray(data.results)) {
      data.results = enrichListClient(data.results);
    }
    syncCache.set(url, data);
    setLocalStorageCache(url, data);
    apiCache.delete(url);
    return data as T;
  } catch (err) {
    apiCache.delete(url);
    throw err;
  }
}

async function cachedFetch<T>(url: string): Promise<T> {
  if (syncCache.has(url)) return syncCache.get(url) as T;

  const local = getLocalStorageCache(url);
  if (local) {
    syncCache.set(url, local);
    // Background revalidate
    fetchTmdb<T>(url).catch(() => {});
    return local as T;
  }

  if (apiCache.has(url)) return apiCache.get(url)!;

  const p = fetchTmdb<T>(url);
  apiCache.set(url, p);
  return p;
}

// ---------------------------------------------------------------------------
// Public API functions
// ---------------------------------------------------------------------------

export async function fetchTrending(type: 'all' | 'movie' | 'tv' = 'all', time = 'day') {
  try {
    const extra: Record<string, string> =
      type === 'movie' || type === 'tv' ? { with_original_language: 'en' } : {};
    const url = tmdbUrl(`/trending/${type}/${time}`, extra);
    const data = await cachedFetch<any>(url);
    const raw = (data.results || []).map((item: any) => ({
      ...item,
      media_type: item.media_type || (item.first_air_date ? 'tv' : 'movie')
    }));
    const cleaned = cleanAndFilterMediaList(raw, {
      englishOnly: type === 'movie' || type === 'tv',
      prioritizeNew: true
    });
    return cleaned as MediaItem[];
  } catch (_) {
    return [] as MediaItem[];
  }
}

export async function fetchMediaDetail(type: 'movie' | 'tv', id: number) {
  try {
    const url = tmdbUrl(`/${type}/${id}`, {
      append_to_response: 'credits,videos,recommendations,similar,external_ids,keywords,aggregate_credits,release_dates,content_ratings'
    });
    const data = await cachedFetch<MediaItem>(url);
    if (data) {
      data.media_type = data.media_type || type;
      return data;
    }
  } catch (_) { /* fall through */ }
  return null;
}

export async function fetchTvSeason(tvId: number, seasonNumber: number) {
  try {
    const url = tmdbUrl(`/tv/${tvId}/season/${seasonNumber}`);
    return await cachedFetch<Season>(url);
  } catch (_) {
    return null;
  }
}

export async function searchMedia(query: string) {
  try {
    const url = tmdbUrl('/search/multi', { query });
    const data = await cachedFetch<any>(url);
    const raw = (data.results || []).map((item: any) => ({
      ...item,
      media_type: item.media_type || (item.first_air_date ? 'tv' : 'movie')
    }));
    const cleaned = cleanAndFilterMediaList(raw, { englishOnly: false });
    return cleaned as MediaItem[];
  } catch (_) {
    return [] as MediaItem[];
  }
}

export async function fetchCategoryList(
  type: 'movie' | 'tv',
  category: string,
  params: Record<string, string> = {}
) {
  try {
    const extra: Record<string, string> =
      !params.with_original_language ? { with_original_language: 'en' } : {};
    const url = tmdbUrl(`/${type}/${category}`, { ...extra, ...params });
    const data = await cachedFetch<any>(url);
    const raw = (data.results || []).map((item: any) => ({ ...item, media_type: item.media_type || type }));
    const cleaned = cleanAndFilterMediaList(raw, { englishOnly: true, prioritizeNew: true });
    return cleaned as MediaItem[];
  } catch (_) {
    return [] as MediaItem[];
  }
}

export async function discoverMedia(
  type: 'movie' | 'tv',
  genreId?: number,
  sortBy = 'popularity.desc'
) {
  try {
    const params: Record<string, string> = { sort_by: sortBy, with_original_language: 'en' };
    if (genreId) params.with_genres = String(genreId);
    const url = tmdbUrl(`/discover/${type}`, params);
    const data = await cachedFetch<any>(url);
    const raw = (data.results || []).map((item: any) => ({ ...item, media_type: item.media_type || type }));
    const cleaned = cleanAndFilterMediaList(raw, { englishOnly: true, prioritizeNew: true });
    return cleaned as MediaItem[];
  } catch (_) {
    return [] as MediaItem[];
  }
}

export async function discoverMediaAdvanced(
  type: 'movie' | 'tv',
  params: Record<string, string> = {}
) {
  try {
    const isAnime =
      params.with_genres?.includes('16') && params.with_original_language === 'ja';
    const extra: Record<string, string> =
      !isAnime && !params.with_original_language ? { with_original_language: 'en' } : {};
    const url = tmdbUrl(`/discover/${type}`, { ...extra, ...params });
    const data = await cachedFetch<any>(url);
    const raw = (data.results || []).map((item: any) => ({ ...item, media_type: item.media_type || type }));
    const cleaned = cleanAndFilterMediaList(raw, {
      englishOnly: !isAnime,
      prioritizeNew: !isAnime
    });
    return cleaned as MediaItem[];
  } catch (_) {
    return [] as MediaItem[];
  }
}

export async function fetchTopRated(type: 'movie' | 'tv') {
  try {
    const url = tmdbUrl(`/${type}/top_rated`, { with_original_language: 'en' });
    const data = await cachedFetch<any>(url);
    const raw = (data.results || []).map((item: any) => ({ ...item, media_type: item.media_type || type }));
    const cleaned = cleanAndFilterMediaList(raw, { englishOnly: true, prioritizeNew: false });
    return cleaned as MediaItem[];
  } catch (_) {
    return [] as MediaItem[];
  }
}

export async function fetchAnime(
  type: 'tv' | 'movie' = 'tv',
  extraParams: Record<string, string> = {}
) {
  try {
    const params: Record<string, string> = {
      with_genres: '16',
      with_original_language: 'ja',
      sort_by: 'popularity.desc',
      ...extraParams
    };
    const url = tmdbUrl(`/discover/${type}`, params);
    const data = await cachedFetch<any>(url);
    const raw = (data.results || []).map((item: any) => ({
      ...item,
      media_type: type,
      is_anime: true
    }));
    const cleaned = cleanAndFilterMediaList(raw, { englishOnly: false, prioritizeNew: false });
    return cleaned as MediaItem[];
  } catch (_) {
    return [] as MediaItem[];
  }
}

export async function fetchSearch(query: string, page = 1) {
  try {
    const url = tmdbUrl('/search/multi', { query, page: String(page) });
    const data = await cachedFetch<any>(url);
    const raw = (data.results || []).map((item: any) => ({
      ...item,
      media_type: item.media_type || (item.first_air_date ? 'tv' : 'movie')
    }));
    const cleaned = cleanAndFilterMediaList(raw, { englishOnly: false });
    return cleaned as MediaItem[];
  } catch (_) {
    return [] as MediaItem[];
  }
}

export async function fetchComments(mediaType: 'movie' | 'tv', mediaId: number): Promise<Comment[]> {
  // Comments are stored locally (no backend server)
  try {
    const stored = localStorage.getItem(`stoned_comments_${mediaType}_${mediaId}`);
    if (stored) return JSON.parse(stored);
  } catch (_) { /* ignore */ }
  return [
    {
      id: 'c1',
      mediaId,
      mediaType,
      userId: 'u1',
      username: 'ChronicCinephile',
      userAvatar:
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
      userRole: 'vip',
      text: 'Absolute masterpiece for a weekend session! High-definition audio and killer visual vibes.',
      createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
      likes: 12,
      strainBadge: 'Granddaddy Purple 🌿'
    }
  ];
}

export async function postComment(payload: {
  mediaId: number;
  mediaType: 'movie' | 'tv';
  text: string;
  username?: string;
  userAvatar?: string;
  strainBadge?: string;
  season?: number;
  episode?: number;
}): Promise<Comment> {
  const newComment: Comment = {
    id: `c_${Date.now()}`,
    mediaId: payload.mediaId,
    mediaType: payload.mediaType,
    userId: `u_${Date.now()}`,
    username: payload.username || 'Stoner VIP',
    userAvatar:
      payload.userAvatar ||
      'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80',
    userRole: 'vip',
    text: payload.text,
    createdAt: new Date().toISOString(),
    likes: 1,
    strainBadge: payload.strainBadge || ''
  };

  try {
    const key = `stoned_comments_${payload.mediaType}_${payload.mediaId}`;
    const existing: Comment[] = JSON.parse(localStorage.getItem(key) || '[]');
    existing.unshift(newComment);
    localStorage.setItem(key, JSON.stringify(existing));
  } catch (_) { /* quota */ }

  return newComment;
}

export async function fetchAiStrainMatch(strainOrMood: string, genrePreference?: string) {
  // AI matchmaker is not available on static deployment — return an offline result
  const randomIndex = Math.floor(Math.random() * StrainDatabase.STRAINS.length);
  const recommendation = StrainDatabase.STRAINS[randomIndex];
  const mediaSample = MOCK_MOVIES[Math.floor(Math.random() * MOCK_MOVIES.length)];
  return {
    success: true,
    recommendation: {
      strainName: recommendation.name,
      strainType: recommendation.type,
      thcContent: recommendation.thc,
      effects: [recommendation.vibeCategory, 'Euphoric', 'Relaxing'],
      flavorNotes: recommendation.flavor.split('&').map((f: string) => f.trim()),
      reasoning: `Based on your request "${strainOrMood}", ${recommendation.name} (${recommendation.type}) provides the perfect balance of relaxation and mental clarity for watching movies.`,
      suggestedTitle: mediaSample.title,
      suggestedType: 'movie',
      suggestedMediaId: mediaSample.id,
      suggestedOverview: mediaSample.overview,
      suggestedPoster: mediaSample.poster_path
    }
  };
}

export async function fetchSiteSettings(): Promise<SiteSettings> {
  try {
    const stored = localStorage.getItem('stoned_site_settings_v1');
    if (stored) return JSON.parse(stored) as SiteSettings;
  } catch (_) { /* ignore */ }

  return {
    announcementText: '🌿 WELCOME TO STONED.LIVING 4K STREAMING — TAP A MOVIE & ENJOY THE CHILL SESSIONS!',
    announcementActive: true,
    featuredHeroIds: [11130, 157336, 545611, 693134, 60625],
    maintenanceMode: false
  };
}

export async function saveSiteSettings(newSettings: Partial<SiteSettings>): Promise<SiteSettings> {
  const current = await fetchSiteSettings();
  const updated: SiteSettings = { ...current, ...newSettings };
  try {
    localStorage.setItem('stoned_site_settings_v1', JSON.stringify(updated));
  } catch (_) { /* quota */ }
  return updated;
}
