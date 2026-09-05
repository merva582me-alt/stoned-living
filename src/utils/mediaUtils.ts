import { MediaItem } from '../types';

/**
 * Accurately determines whether a media item is a TV show or a movie.
 */
export function getEffectiveMediaType(item: Partial<MediaItem> | any): 'tv' | 'movie' {
  if (!item) return 'movie';

  // Explicit check
  if (item.media_type === 'tv') return 'tv';
  if (item.media_type === 'movie') return 'movie';

  // TV signals
  if (
    item.first_air_date ||
    item.number_of_seasons !== undefined ||
    item.number_of_episodes !== undefined ||
    (Array.isArray(item.seasons) && item.seasons.length > 0) ||
    (item.name && !item.title)
  ) {
    return 'tv';
  }

  // Movie signals
  if (item.release_date || item.title) {
    return 'movie';
  }

  return item.name ? 'tv' : 'movie';
}

/**
 * Checks if a media item is Japanese Animation (Anime).
 */
export function isAnimeItem(item: Partial<MediaItem> | any): boolean {
  if (!item) return false;

  if (item.is_anime) return true;

  const isJapanese =
    item.original_language === 'ja' ||
    (Array.isArray(item.origin_country) && item.origin_country.includes('JP')) ||
    (Array.isArray(item.production_countries) && item.production_countries.some((c: any) => c.iso_3166_1 === 'JP'));

  const isAnimation =
    (Array.isArray(item.genre_ids) && item.genre_ids.includes(16)) ||
    (Array.isArray(item.genres) && item.genres.some((g: any) => g.id === 16 || (typeof g.name === 'string' && g.name.toLowerCase() === 'animation')));

  return Boolean(isJapanese && isAnimation);
}

/**
 * Checks if a media item is appropriate (filters out porn, adult, ecchi, hentai, and erotic content).
 */
export function isAppropriateMedia(item: Partial<MediaItem> | any): boolean {
  if (!item) return false;

  // Explicit adult flag from TMDB
  if (item.adult === true) return false;

  const titleStr = String(item.title || item.original_title || item.name || item.original_name || '').toLowerCase();
  const overviewStr = String(item.overview || '').toLowerCase();
  const combinedText = `${titleStr} ${overviewStr}`;

  // Forbidden porn, hentai, ecchi, adult keywords
  const forbiddenKeywords = [
    'hentai',
    'ecchi',
    'erotica',
    'erotic',
    'porn',
    'porno',
    'succubus',
    'borderline porn',
    'h-anime',
    'nsfw',
    'lewd',
    'explicit sexual',
    'uncensored nudity',
    'smut',
    'harem ecchi',
    '18+',
    'erotic anime',
    'hentai anime',
    'adult animation'
  ];

  for (const kw of forbiddenKeywords) {
    if (combinedText.includes(kw)) {
      return false;
    }
  }

  // Check genres
  if (Array.isArray(item.genres)) {
    for (const g of item.genres) {
      const gName = String(g.name || '').toLowerCase();
      if (gName.includes('ecchi') || gName.includes('hentai') || gName.includes('erotica') || gName.includes('adult')) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Checks if a media item is originally in English language.
 */
export function isEnglishMedia(item: Partial<MediaItem> | any): boolean {
  if (!item) return false;
  // If original language is specified, require 'en'
  if (item.original_language && item.original_language !== 'en') {
    return false;
  }
  return true;
}

/**
 * Prioritizes new release dates (2026, 2025, 2024...) in descending order.
 */
export function prioritizeNewReleases(items: MediaItem[]): MediaItem[] {
  return [...items].sort((a, b) => {
    const dateA = a.release_date || a.first_air_date || '1970-01-01';
    const dateB = b.release_date || b.first_air_date || '1970-01-01';
    return new Date(dateB).getTime() - new Date(dateA).getTime();
  });
}

/**
 * Cleans, filters, deduplicates, and optionally sorts media items for carousels.
 */
export function cleanAndFilterMediaList(
  items: any[],
  options: { englishOnly?: boolean; prioritizeNew?: boolean } = {}
): MediaItem[] {
  if (!Array.isArray(items)) return [];

  const { englishOnly = false, prioritizeNew = false } = options;
  const seen = new Set<number>();
  const filtered: MediaItem[] = [];

  for (const item of items) {
    if (!item || !item.id || seen.has(item.id)) continue;
    if (!isAppropriateMedia(item)) continue;
    if (englishOnly && !isEnglishMedia(item)) continue;

    seen.add(item.id);
    filtered.push(item as MediaItem);
  }

  return prioritizeNew ? prioritizeNewReleases(filtered) : filtered;
}

/**
 * Returns formatted media status (e.g. 'New Release' for 'Released').
 */
export function formatMediaStatus(status?: string): string {
  if (!status) return '';
  if (status.trim().toLowerCase() === 'released') {
    return 'New Release';
  }
  return status;
}

/**
 * Returns the exact display badge label (e.g. 'ANIME', 'ANIME MOVIE', 'TV', 'MOVIE').
 */
export function getMediaBadgeLabel(item: Partial<MediaItem> | any): string {
  const type = getEffectiveMediaType(item);
  const anime = isAnimeItem(item);

  if (anime) {
    return type === 'movie' ? 'ANIME MOVIE' : 'ANIME';
  }
  return type === 'tv' ? 'TV' : 'MOVIE';
}
