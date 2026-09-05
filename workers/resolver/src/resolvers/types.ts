/**
 * Shared types for resolver modules
 */

export interface ResolveParams {
  /** Media type: movie, tv, or anime */
  type: 'movie' | 'tv' | 'anime';
  /** TMDb ID */
  id: string;
  /** Season number (TV/Anime only) */
  season?: number;
  /** Episode number (TV/Anime only) */
  episode?: number;
  /** AniList ID (Anime only — preferred over TMDb id for anime resolvers) */
  anilistId?: string;
}

export interface SportResolveParams {
  /** Provider identifier: "streamed" | "daddylive" */
  provider: string;
  /** Channel / event ID from the provider */
  channelId: string;
}

export interface ResolveResult {
  url: string;
  provider: string;
}

export interface SportEvent {
  id: string;
  title: string;
  sport_category: string;
  provider: string;
  thumbnail?: string;
  is_live: boolean;
}
