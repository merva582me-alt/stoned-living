import { UserProfile, WatchHistoryItem, CustomList, MediaItem } from '../types';

const STORAGE_KEY_USER = 'blunt_pics_user_profile_v2';
const STORAGE_KEY_HISTORY = 'blunt_pics_watch_history_v1';
const STORAGE_KEY_FAVORITES = 'blunt_pics_favorites_v1';
const STORAGE_KEY_WATCHLIST = 'blunt_pics_watchlist_v1';

export const DEFAULT_USER: UserProfile = {
  id: 'guest_user',
  username: 'VIP Guest',
  email: 'viewer@stoned.living',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
  role: 'vip',
  favorites: [],
  watchlist: [],
  stashDetails: {},
  ratings: {},
  watchHistory: [],
  customLists: [],
  settings: {
    autoplayNext: true,
    autoSkipIntro: false,
    darkCanvasMode: true,
    smokeEffects: true,
  }
};

/**
 * Deduplicates and converts raw watchlist items into clean numeric IDs
 */
export function sanitizeWatchlist(rawWatchlist: any[]): number[] {
  if (!Array.isArray(rawWatchlist)) return [];
  const uniqueIds = new Set<number>();
  for (const item of rawWatchlist) {
    if (typeof item === 'number' && !isNaN(item) && item > 0) {
      uniqueIds.add(item);
    } else if (typeof item === 'string') {
      const parsed = parseInt(item, 10);
      if (!isNaN(parsed) && parsed > 0) {
        uniqueIds.add(parsed);
      }
    } else if (item && typeof item === 'object' && item.id) {
      const parsed = parseInt(String(item.id), 10);
      if (!isNaN(parsed) && parsed > 0) {
        uniqueIds.add(parsed);
      }
    }
  }
  return Array.from(uniqueIds);
}

export function loadUserProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USER);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_USER,
        ...parsed,
        watchlist: sanitizeWatchlist(parsed.watchlist || []),
        stashDetails: parsed.stashDetails || {},
        settings: {
          ...DEFAULT_USER.settings,
          ...(parsed.settings || {})
        }
      };
    }
    // Clear legacy v1 data if present
    localStorage.removeItem('blunt_pics_user_profile_v1');
  } catch (e) {
    console.warn('Storage read error:', e);
  }
  return DEFAULT_USER;
}

export function saveUserProfile(user: UserProfile) {
  try {
    const cleanUser: UserProfile = {
      ...user,
      watchlist: sanitizeWatchlist(user.watchlist || []),
      stashDetails: user.stashDetails || {}
    };
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(cleanUser));
  } catch (e) {
    console.warn('Storage write error:', e);
  }
}

export function updateWatchHistory(item: Omit<WatchHistoryItem, 'id' | 'updatedAt'>): UserProfile {
  const profile = loadUserProfile();
  const history = profile.watchHistory || [];
  
  const targetMediaId = Number(item.mediaId);
  if (isNaN(targetMediaId) || targetMediaId <= 0) {
    return profile;
  }

  // Find existing history entry for this media item (movie, show, or anime)
  const existingIndex = history.findIndex(
    (h) => Number(h.mediaId) === targetMediaId
  );

  const updatedItem: WatchHistoryItem = {
    ...item,
    mediaId: targetMediaId,
    id: `h_${targetMediaId}_${item.season || 0}_${item.episode || 0}`,
    updatedAt: new Date().toISOString()
  };

  if (existingIndex >= 0) {
    history.splice(existingIndex, 1);
  }
  history.unshift(updatedItem);

  // Keep max 50 recent items
  profile.watchHistory = history.slice(0, 50);
  saveUserProfile(profile);
  return profile;
}

export function toggleFavorite(mediaId: number): boolean {
  return false;
}

export function toggleWatchlist(mediaInput: MediaItem | number): { inList: boolean; updatedProfile: UserProfile } {
  const profile = loadUserProfile();
  const mediaId = typeof mediaInput === 'number' ? mediaInput : Number(mediaInput.id);
  
  if (isNaN(mediaId) || mediaId <= 0) {
    return { inList: false, updatedProfile: profile };
  }

  const currentList = sanitizeWatchlist(profile.watchlist || []);
  const stashDetails = { ...(profile.stashDetails || {}) };
  const existingIndex = currentList.indexOf(mediaId);

  let inList = false;

  if (existingIndex >= 0) {
    // Remove item and its cached stash details
    currentList.splice(existingIndex, 1);
    delete stashDetails[mediaId];
    inList = false;
  } else {
    // Add item and save full media metadata to stash details
    currentList.push(mediaId);
    inList = true;

    if (typeof mediaInput === 'object' && mediaInput.id) {
      stashDetails[mediaId] = {
        id: Number(mediaInput.id),
        title: mediaInput.title || mediaInput.name || 'Untitled',
        name: mediaInput.name || mediaInput.title || 'Untitled',
        overview: mediaInput.overview || '',
        poster_path: mediaInput.poster_path || null,
        backdrop_path: mediaInput.backdrop_path || null,
        vote_average: mediaInput.vote_average || 8.0,
        vote_count: mediaInput.vote_count || 100,
        popularity: mediaInput.popularity || 10,
        media_type: mediaInput.media_type || (mediaInput.name ? 'tv' : 'movie'),
        first_air_date: mediaInput.first_air_date,
        release_date: mediaInput.release_date
      };
    }
  }

  const updatedProfile: UserProfile = {
    ...profile,
    watchlist: currentList,
    stashDetails
  };

  saveUserProfile(updatedProfile);
  return { inList, updatedProfile };
}

