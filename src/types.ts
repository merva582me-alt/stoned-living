export type MediaType = 'movie' | 'tv' | 'person' | 'collection';

export interface Genre {
  id: number;
  name: string;
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  order?: number;
}

export interface CrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
  profile_path: string | null;
}

export interface Video {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;
  official: boolean;
}

export interface MediaItem {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  genre_ids?: number[];
  genres?: Genre[];
  media_type: 'movie' | 'tv';
  runtime?: number;
  episode_run_time?: number[];
  tagline?: string;
  status?: string;
  imdb_id?: string;
  budget?: number;
  revenue?: number;
  number_of_seasons?: number;
  number_of_episodes?: number;
  seasons?: Season[];
  production_companies?: { id: number; name: string; logo_path: string | null; origin_country?: string }[];
  production_countries?: { iso_3166_1: string; name: string }[];
  spoken_languages?: { english_name: string; name: string }[];
  created_by?: { id: number; name: string; profile_path: string | null }[];
  networks?: { id: number; name: string; logo_path: string | null }[];
  last_air_date?: string;
  original_language?: string;
  keywords?: { keywords?: { id: number; name: string }[]; results?: { id: number; name: string }[] };
  credits?: { cast: CastMember[]; crew: CrewMember[] };
  aggregate_credits?: { cast: CastMember[]; crew: CrewMember[] };
  cast?: CastMember[];
  crew?: CrewMember[];
  videos?: { results: Video[] };
  recommendations?: { results: MediaItem[] };
  similar?: { results: MediaItem[] };
  // AniList metadata (anime only)
  anilist_id?: number;
  airing_status?: string;
  anilist_studios?: string[];
  is_anime?: boolean;
  // Sports metadata
  sport_category?: string;
  channel_id?: string;
  sports_provider?: string;
  is_live?: boolean;
  // Stoned.living custom metadata
  couchlock_score?: number; // 0 - 100
  chill_vibe?: string;
  strain_name?: string;
  strain_pairing?: string; // e.g. "Granddaddy Purple", "Sour Diesel"
  strain_type?: string; // e.g. "Indica", "Sativa", "Hybrid"
  thc?: string;
  flavor?: string;
  terpenes?: string; // e.g. "Myrcene & Caryophyllene"
  sommelier_note?: string; // Sommelier pairing note
}

export interface Season {
  id: number;
  season_number: number;
  name: string;
  overview: string;
  poster_path: string | null;
  air_date: string;
  episode_count: number;
  episodes?: Episode[];
}

export interface Episode {
  id: number;
  episode_number: number;
  season_number: number;
  name: string;
  overview: string;
  still_path: string | null;
  air_date: string;
  vote_average: number;
  runtime?: number;
  guest_stars?: CastMember[];
}

export interface ActorDetail {
  id: number;
  name: string;
  biography: string;
  birthday: string | null;
  place_of_birth: string | null;
  profile_path: string | null;
  known_for_department: string;
  combined_credits?: {
    cast: MediaItem[];
    crew: MediaItem[];
  };
  images?: {
    profiles: { file_path: string }[];
  };
  external_ids?: {
    imdb_id?: string;
    instagram_id?: string;
    twitter_id?: string;
  };
}

export interface CollectionDetail {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  parts: MediaItem[];
}

export interface WatchHistoryItem {
  id: string; // unique key
  mediaId: number;
  mediaType: 'movie' | 'tv';
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  season?: number;
  episode?: number;
  episodeTitle?: string;
  progressSeconds: number;
  durationSeconds: number;
  progressPercent: number;
  updatedAt: string;
}

export interface CustomList {
  id: string;
  title: string;
  description: string;
  itemCount: number;
  isPrivate: boolean;
  items: MediaItem[];
  createdAt: string;
}

export interface UserSettings {
  language: string;
  autoplay: boolean;
  nextEpisode: boolean;
  defaultVolume: number;
  subtitleLanguage: string;
  autoSubtitles: boolean;
  theme?: 'dark' | 'midnight';
  accentColor?: 'emerald' | 'red' | 'cyan' | 'violet';
  autoplayNext?: boolean;
  autoSkipIntro?: boolean;
  darkCanvasMode?: boolean;
  smokeEffects?: boolean;
}

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  avatar: string;
  role: 'user' | 'vip' | 'admin';
  favorites: number[]; // media IDs
  watchlist: number[]; // media IDs
  stashDetails?: Record<number, MediaItem>; // Full cached media items saved to stash
  ratings: Record<number, number>; // media ID -> rating 1-10
  watchHistory: WatchHistoryItem[];
  customLists: CustomList[];
  settings: UserSettings;
}

export interface Comment {
  id: string;
  mediaId: number;
  mediaType: 'movie' | 'tv';
  season?: number;
  episode?: number;
  userId: string;
  username: string;
  userAvatar: string;
  userRole?: string;
  text: string;
  createdAt: string;
  likes: number;
  strainBadge?: string;
}

export interface WeedStrainMatch {
  id: string;
  strainName: string;
  strainType: 'Indica' | 'Sativa' | 'Hybrid';
  thcPercent: string;
  moodEffect: string;
  description: string;
  recommendedGenres: string[];
  recommendedMovies: MediaItem[];
}

export interface AdminStats {
  totalUsers: number;
  activeStreamsNow: number;
  totalComments: number;
  cacheHitRatio: number;
  tmdbApiStatus: 'Connected' | 'Fallback Mode' | 'Rate Limited';
  systemUptime: string;
}

export interface SiteSettings {
  announcementText: string;
  announcementActive: boolean;
  featuredHeroIds: number[];
  maintenanceMode: boolean;
  customLogoUrl?: string;
}

export interface AdvanceFilters {
  sortBy: string;
  year: string;
  minRating: number;
  maxRating: number;
  companyId: string;
  language: string;
}

export const DEFAULT_ADVANCE_FILTERS: AdvanceFilters = {
  sortBy: 'popularity.desc',
  year: '',
  minRating: 0,
  maxRating: 10,
  companyId: '',
  language: 'en'
};

export interface PaginatedMediaResult {
  results: MediaItem[];
  page: number;
  totalPages: number;
  totalResults: number;
}

// ── Streamed.pk Official Sports API Types ──
export interface APIMatch {
  id: string;
  title: string;
  category: string;
  date: number; // Unix timestamp in ms
  poster?: string;
  popular?: boolean;
  teams?: {
    home?: {
      name: string;
      badge: string;
    };
    away?: {
      name: string;
      badge: string;
    };
  };
  sources: {
    source: string;
    id: string;
  }[];
}

export interface StreamedStream {
  id: string;
  streamNo: number;
  language: string;
  hd: boolean;
  embedUrl: string;
  source: string;
}

export interface SportCategory {
  id: string;
  name: string;
}

export interface ResolvedStreamInfo {
  success: boolean;
  streamUrl: string;
  backupUrl?: string;
  isDirectHls: boolean;
  source: string;
  streamNo?: number;
  headers?: Record<string, string>;
  error?: string;
}


