import { UserProfile, WatchHistoryItem, CustomList, MediaItem } from '../types';

const STORAGE_KEY_USER = 'blunt_pics_user_profile_v2';
const STORAGE_KEY_HISTORY = 'blunt_pics_watch_history_v1';
const STORAGE_KEY_FAVORITES = 'blunt_pics_favorites_v1';
const STORAGE_KEY_WATCHLIST = 'blunt_pics_watchlist_v1';

export const DEFAULT_USER: UserProfile = {
  id: 'guest_user',
  username: 'VIP Guest',
  email: 'viewer@stoned.living',
  avatar: 'https://images.unsplash.com/photo-1568644396922-5c3bfae12521?w=300&h=300&fit=crop&q=80',
  role: 'vip',
  favorites: [],
  watchlist: [],
  stashDetails: {},
  ratings: {},
  watchHistory: [],
  customLists: [],
  settings: {
    language: 'English',
    autoplay: true,
    nextEpisode: true,
    defaultVolume: 100,
    subtitleLanguage: 'English',
    autoSubtitles: false,
    theme: 'dark',
    accentColor: 'emerald',
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
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = localStorage.getItem(STORAGE_KEY_USER);
      if (raw) {
        const parsed = JSON.parse(raw);
        const isGuest = !parsed.id || parsed.id === 'guest_user';
        return {
          ...DEFAULT_USER,
          ...parsed,
          watchHistory: isGuest ? [] : deduplicateWatchHistory(parsed.watchHistory || []),
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
    }
  } catch (e) {
    console.warn('Storage read error:', e);
  }
  return DEFAULT_USER;
}

type ProfileSyncListener = (profile: UserProfile) => void;
let profileSyncListener: ProfileSyncListener | null = null;

export function registerProfileSyncListener(listener: ProfileSyncListener) {
  profileSyncListener = listener;
}

type AuthPromptListener = (item: MediaItem) => void;
let authPromptListener: AuthPromptListener | null = null;

export function registerAuthPromptListener(listener: AuthPromptListener) {
  authPromptListener = listener;
}

export function requestAuthForAction(item: MediaItem) {
  if (authPromptListener) {
    try {
      authPromptListener(item);
    } catch (e) {
      console.warn('Auth prompt listener error:', e);
    }
  }
}

export function isUserLoggedIn(): boolean {
  const profile = loadUserProfile();
  return Boolean(profile.id && profile.id !== 'guest_user');
}

export function saveUserProfile(user: UserProfile, syncToCloud: boolean = true) {
  try {
    const cleanUser: UserProfile = {
      ...user,
      watchlist: sanitizeWatchlist(user.watchlist || []),
      stashDetails: user.stashDetails || {}
    };
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(cleanUser));
    }
    if (syncToCloud && profileSyncListener) {
      try {
        profileSyncListener(cleanUser);
      } catch (err) {
        console.warn('Profile sync listener error:', err);
      }
    }
  } catch (e) {
    console.warn('Storage write error:', e);
  }
}

/**
 * Formats the remaining time of an episode or movie as "45m remaining" or "1h 20m remaining"
 */
export function formatRemainingTime(
  durationSeconds?: number,
  progressSeconds?: number,
  progressPercent?: number,
  mediaType: 'movie' | 'tv' = 'tv'
): string {
  // TV episodes are typically ~42-45 minutes (2520-2700s); movies ~110 minutes (6600s)
  const defaultDuration = mediaType === 'tv' ? 2520 : 6600;
  let total = durationSeconds && durationSeconds > 0 ? durationSeconds : defaultDuration;

  // Normalize legacy TV items saved with erroneous 7200s (2-hour) duration
  if (mediaType === 'tv' && total >= 7000) {
    total = 2520; // 42 minutes standard episode
  }

  let elapsed = 0;
  if (typeof progressSeconds === 'number' && progressSeconds >= 0) {
    elapsed = progressSeconds;
    // If progress was saved with legacy 120s placeholder on a 7200s duration, scale appropriately
    if (durationSeconds && durationSeconds >= 7000 && mediaType === 'tv' && elapsed === 120) {
      elapsed = 15;
    }
    if (elapsed > total) elapsed = total;
  } else if (typeof progressPercent === 'number' && progressPercent > 0) {
    elapsed = Math.round((progressPercent / 100) * total);
  }

  // Calculate remaining time
  const remainingSec = Math.max(0, total - elapsed);
  const remainingMinutes = Math.max(1, Math.round(remainingSec / 60));

  const hours = Math.floor(remainingMinutes / 60);
  const mins = remainingMinutes % 60;

  if (hours > 0) {
    return mins > 0 ? `${hours}h ${mins}m remaining` : `${hours}h remaining`;
  }
  return `${mins}m remaining`;
}

/**
 * Deduplicates watch history so each TV show or movie only ever appears ONCE.
 * For TV shows, keeps only the latest watched episode and updates in-place.
 * Also normalizes legacy records saved with the 2-hour placeholder.
 */
export function deduplicateWatchHistory(history: WatchHistoryItem[] = []): WatchHistoryItem[] {
  if (!Array.isArray(history)) return [];
  const map = new Map<string, WatchHistoryItem>();

  for (const rawItem of history) {
    if (!rawItem || !rawItem.mediaId) continue;
    const mediaId = Number(rawItem.mediaId);
    if (isNaN(mediaId) || mediaId <= 0) continue;

    // Normalize legacy 7200s duration on TV shows to accurate 42-45 minute runtimes
    let durationSeconds = rawItem.durationSeconds;
    let progressSeconds = rawItem.progressSeconds;
    if (rawItem.mediaType === 'tv' && (!durationSeconds || durationSeconds >= 7000)) {
      durationSeconds = 2520; // 42 minutes
      if (progressSeconds === 120 || progressSeconds > durationSeconds) {
        progressSeconds = 15;
      }
    } else if (!durationSeconds || durationSeconds <= 0) {
      durationSeconds = rawItem.mediaType === 'tv' ? 2520 : 6600;
    }

    const progressPercent = Math.min(
      99,
      Math.max(1, Math.round(((progressSeconds || 0) / durationSeconds) * 100))
    );

    const item: WatchHistoryItem = {
      ...rawItem,
      mediaId,
      id: `h_${mediaId}`,
      durationSeconds,
      progressSeconds: progressSeconds || 0,
      progressPercent
    };

    // Use unified key per media so each TV show or movie has exactly ONE entry in Continue Watching
    const key = `${item.mediaType || 'movie'}_${mediaId}`;
    const existing = map.get(key);

    if (!existing) {
      map.set(key, item);
    } else {
      const itemTime = new Date(item.updatedAt || 0).getTime();
      const existingTime = new Date(existing.updatedAt || 0).getTime();
      const itemEpisodeWeight = ((item.season || 1) * 1000) + (item.episode || 1);
      const existingEpisodeWeight = ((existing.season || 1) * 1000) + (existing.episode || 1);

      // Prefer newer update time; tie-break on higher season/episode
      if (itemTime > existingTime || (itemTime === existingTime && itemEpisodeWeight >= existingEpisodeWeight)) {
        map.set(key, item);
      }
    }
  }

  return Array.from(map.values())
    .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())
    .slice(0, 50);
}

/**
 * Intelligently merges local and cloud watch histories by media key without losing items,
 * keeping only the latest watched episode per TV show in-place.
 */
export function mergeWatchHistories(
  local: WatchHistoryItem[] = [],
  remote: WatchHistoryItem[] = []
): WatchHistoryItem[] {
  return deduplicateWatchHistory([...remote, ...local]);
}

export function updateWatchHistory(item: Omit<WatchHistoryItem, 'id' | 'updatedAt'>): UserProfile {
  const profile = loadUserProfile();
  // Do not track any playback progress until user is logged in
  if (!profile.id || profile.id === 'guest_user') {
    return profile;
  }
  const history = deduplicateWatchHistory(profile.watchHistory || []);
  
  const targetMediaId = Number(item.mediaId);
  if (isNaN(targetMediaId) || targetMediaId <= 0) {
    return profile;
  }

  // Find existing history entry for this media item (1 entry per show/movie)
  const existingIndex = history.findIndex((h) => Number(h.mediaId) === targetMediaId);

  const updatedItem: WatchHistoryItem = {
    ...item,
    mediaId: targetMediaId,
    posterPath: item.posterPath || null,
    backdropPath: item.backdropPath || null,
    season: item.season ?? 1,
    episode: item.episode ?? 1,
    id: `h_${targetMediaId}`,
    updatedAt: new Date().toISOString()
  };

  if (existingIndex >= 0) {
    // Replace the previous episode with the latest watched episode in-place
    history.splice(existingIndex, 1);
  }
  history.unshift(updatedItem);

  // Keep max 50 recent items
  profile.watchHistory = history.slice(0, 50);
  saveUserProfile(profile);
  return profile;
}

export function removeFromWatchHistory(mediaId: number, season?: number, episode?: number): UserProfile {
  const profile = loadUserProfile();
  const targetId = Number(mediaId);
  // Remove the media entry from watch history so it cleanly vanishes from Continue Watching
  const history = deduplicateWatchHistory(profile.watchHistory || []).filter((item) => {
    return Number(item.mediaId) !== targetId;
  });
  const updatedProfile: UserProfile = { ...profile, watchHistory: history };
  saveUserProfile(updatedProfile);
  return updatedProfile;
}

export function toggleFavorite(mediaId: number): { isFav: boolean; updatedProfile: UserProfile } {
  const profile = loadUserProfile();
  const targetId = Number(mediaId);
  if (isNaN(targetId) || targetId <= 0) {
    return { isFav: false, updatedProfile: profile };
  }
  const favs = [...(profile.favorites || [])];
  const idx = favs.indexOf(targetId);
  let isFav = false;
  if (idx >= 0) {
    favs.splice(idx, 1);
    isFav = false;
  } else {
    favs.push(targetId);
    isFav = true;
  }
  const updatedProfile: UserProfile = { ...profile, favorites: favs };
  saveUserProfile(updatedProfile);
  return { isFav, updatedProfile };
}

export function clearWatchHistory(): UserProfile {
  const profile = loadUserProfile();
  const updatedProfile: UserProfile = { ...profile, watchHistory: [] };
  saveUserProfile(updatedProfile);
  return updatedProfile;
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
        first_air_date: mediaInput.first_air_date || null,
        release_date: mediaInput.release_date || null
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

export function isItemInWatchlist(mediaId: number): boolean {
  const profile = loadUserProfile();
  return sanitizeWatchlist(profile.watchlist || []).includes(Number(mediaId));
}

