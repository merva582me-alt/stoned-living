import React, { useState, useEffect } from 'react';
import {
  Play,
  Plus,
  Check,
  Heart,
  X,
  Star,
  Cannabis,
  Info,
  ExternalLink,
  Users,
  Building2,
  Tag,
  Clock,
  DollarSign,
  Globe,
  Sparkles,
  Tv,
  Shield
} from 'lucide-react';

function getAgeRating(detail: any): { rating: string; label: string } {
  if (!detail) return { rating: 'PG-13', label: 'Parents Strongly Cautioned (13+)' };

  if (detail.adult) {
    return { rating: '18+', label: 'Adults Only' };
  }

  // Check movie release_dates certification
  if (detail.release_dates?.results && Array.isArray(detail.release_dates.results)) {
    const usEntry = detail.release_dates.results.find((r: any) => r.iso_3166_1 === 'US') || detail.release_dates.results[0];
    if (usEntry?.release_dates && Array.isArray(usEntry.release_dates)) {
      for (const rd of usEntry.release_dates) {
        if (rd.certification && typeof rd.certification === 'string' && rd.certification.trim() !== '') {
          const cert = rd.certification.trim().toUpperCase();
          if (cert === 'R') return { rating: 'R', label: 'Restricted (17+)' };
          if (cert === 'PG-13') return { rating: 'PG-13', label: 'Parents Cautioned (13+)' };
          if (cert === 'PG') return { rating: 'PG', label: 'Parental Guidance' };
          if (cert === 'G') return { rating: 'G', label: 'General Audiences (All Ages)' };
          if (cert === 'NC-17') return { rating: 'NC-17', label: 'Adults Only (18+)' };
          return { rating: cert, label: `Rated ${cert}` };
        }
      }
    }
  }

  // Check TV content_ratings
  if (detail.content_ratings?.results && Array.isArray(detail.content_ratings.results)) {
    const usTv = detail.content_ratings.results.find((r: any) => r.iso_3166_1 === 'US') || detail.content_ratings.results[0];
    if (usTv?.rating && typeof usTv.rating === 'string' && usTv.rating.trim() !== '') {
      const rating = usTv.rating.trim().toUpperCase();
      if (rating === 'TV-MA') return { rating: 'TV-MA', label: 'Mature Audiences (17+)' };
      if (rating === 'TV-14') return { rating: 'TV-14', label: 'Parents Cautioned (14+)' };
      if (rating === 'TV-PG') return { rating: 'TV-PG', label: 'Parental Guidance' };
      if (rating === 'TV-G' || rating === 'TV-Y') return { rating: rating, label: 'All Ages' };
      if (rating === 'TV-Y7') return { rating: 'TV-Y7', label: 'Older Children (7+)' };
      return { rating: rating, label: `Rated ${rating}` };
    }
  }

  // Fallback rating based on genres or adult content
  const genres: number[] = Array.isArray(detail.genres)
    ? detail.genres.map((g: any) => (typeof g === 'number' ? g : g.id))
    : Array.isArray(detail.genre_ids) ? detail.genre_ids : [];

  const isHorrorOrDark = genres.some((id: number) => [27, 80, 53].includes(id));
  const isFamily = genres.some((id: number) => [10751, 16].includes(id));

  if (isHorrorOrDark) {
    return detail.title ? { rating: 'R', label: 'Restricted (17+)' } : { rating: 'TV-MA', label: 'Mature Audiences (17+)' };
  }
  if (isFamily) {
    return { rating: 'PG', label: 'Parental Guidance' };
  }

  return detail.title ? { rating: 'PG-13', label: 'Parents Cautioned (13+)' } : { rating: 'TV-14', label: 'Parents Cautioned (14+)' };
}
import { MediaItem, CastMember, CrewMember } from '../types';
import { fetchMediaDetail } from '../services/api';
import { StrainDatabase } from '../data/strainDatabase';
import { getEffectiveMediaType, isAnimeItem, formatMediaStatus } from '../utils/mediaUtils';

interface MediaDetailsModalProps {
  item: MediaItem;
  onClose: () => void;
  onPlay: (item: MediaItem) => void;
  onToggleWatchlist: (item: MediaItem) => void;
  inWatchlist?: boolean;
  onSelectMedia?: (item: MediaItem) => void;
}

export const MediaDetailsModal: React.FC<MediaDetailsModalProps> = ({
  item,
  onClose,
  onPlay,
  onToggleWatchlist,
  inWatchlist = false,
  onSelectMedia
}) => {
  const mediaType = getEffectiveMediaType(item);
  const [fullDetail, setFullDetail] = useState<MediaItem | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'cast' | 'details' | 'similar'>('overview');

  // Prevent background page scrolling while modal is open
  useEffect(() => {
    const originalBodyStyle = document.body.style.overflow;
    const originalDocStyle = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalBodyStyle || '';
      document.documentElement.style.overflow = originalDocStyle || '';
    };
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Fetch complete details from TMDB when modal mounts or item changes
  useEffect(() => {
    let isMounted = true;
    setLoadingDetail(true);
    fetchMediaDetail(mediaType, item.id).then((data) => {
      if (isMounted) {
        if (data) {
          setFullDetail(data);
        }
        setLoadingDetail(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [item.id, mediaType]);

  const detail = fullDetail || item;

  const title = detail.title || detail.name || 'Untitled';
  const originalTitle = detail.original_title || detail.original_name;
  const releaseDate = detail.release_date || detail.first_air_date || '';
  const year = releaseDate ? new Date(releaseDate).getFullYear() : '';

  const backdropUrl = detail.backdrop_path
    ? `https://image.tmdb.org/t/p/original${detail.backdrop_path}`
    : 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1600&auto=format&fit=crop&q=80';

  const posterUrl = detail.poster_path
    ? `https://image.tmdb.org/t/p/w500${detail.poster_path}`
    : 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&auto=format&fit=crop&q=80';

  // Cast & Crew
  const castList: CastMember[] =
    detail.credits?.cast ||
    detail.aggregate_credits?.cast ||
    detail.cast ||
    [];

  const crewList: CrewMember[] =
    detail.credits?.crew ||
    detail.aggregate_credits?.crew ||
    detail.crew ||
    [];

  const directors = crewList.filter((c) => c.job === 'Director' || c.job === 'Co-Director');
  const writers = crewList.filter((c) => c.job === 'Screenplay' || c.job === 'Writer' || c.department === 'Writing').slice(0, 4);

  // Format financial values
  const formatMoney = (amount?: number) => {
    if (!amount || amount === 0) return 'N/A';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
  };

  // Recommendations / Similar
  const recommendationsList: MediaItem[] = [
    ...(detail.recommendations?.results || []),
    ...(detail.similar?.results || [])
  ].filter((v, idx, self) => self.findIndex((t) => t.id === v.id) === idx).slice(0, 10);

  // Keywords
  const keywordsList =
    detail.keywords?.keywords ||
    detail.keywords?.results ||
    [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-1.5 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto overscroll-contain animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-6xl bg-[#0a0f0c] border border-emerald-500/30 rounded-2xl sm:rounded-3xl overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.95)] max-h-[92dvh] sm:max-h-[95vh] flex flex-col my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close details"
          className="absolute top-3 right-3 sm:top-4 sm:right-4 z-30 p-2.5 rounded-full bg-black/70 hover:bg-emerald-950 text-white border border-emerald-500/40 transition-all shadow-lg"
        >
          <X className="w-5 h-5 text-emerald-400" />
        </button>

        {/* Hero Backdrop & Quick Actions Header */}
        <div className="relative min-h-[220px] sm:h-52 md:h-56 lg:h-60 w-full shrink-0 flex flex-col justify-between p-3.5 sm:p-6 overflow-hidden">
          <img src={backdropUrl} alt={title} className="absolute inset-0 w-full h-full object-cover opacity-60 pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f0c] via-[#0a0f0c]/60 to-transparent pointer-events-none" />

          {/* Top Rating & Media Badges */}
          <div className="relative z-10 flex flex-wrap items-center gap-1.5 sm:gap-2 pr-10">
            <span className="bg-gradient-to-r from-emerald-600 to-green-700 text-white font-extrabold text-[10px] sm:text-xs px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full uppercase tracking-wider border border-emerald-400/40 shadow-md">
              {isAnimeItem(detail || item)
                ? (getEffectiveMediaType(detail || item) === 'movie' ? '🌸 Anime Film' : '🌸 Anime Series')
                : (getEffectiveMediaType(detail || item) === 'movie' ? '🎬 Feature Film' : '📺 TV Series')}
            </span>
            <span className="bg-black/70 backdrop-blur-md text-amber-400 font-extrabold text-[10px] sm:text-xs px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full border border-amber-500/40 flex items-center gap-1 shadow-md">
              <Star className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-amber-400" />
              {detail.vote_average?.toFixed(1) || '8.2'}
              {detail.vote_count ? <span className="text-zinc-400 text-[9px] hidden xs:inline">({detail.vote_count.toLocaleString()})</span> : null}
            </span>
            {detail.status && (
              <span className="bg-black/70 backdrop-blur-md text-emerald-300 font-semibold text-[10px] sm:text-xs px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full border border-emerald-500/30">
                {formatMediaStatus(detail.status)}
              </span>
            )}
          </div>

          {/* Floating Action Bar */}
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-end justify-between gap-2.5 sm:gap-3 pt-2">
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-3xl md:text-4xl font-black text-white tracking-tight drop-shadow-md leading-tight">
                {title} {year ? <span className="text-zinc-400 font-normal text-sm sm:text-2xl">({year})</span> : null}
              </h1>
              {detail.tagline && (
                <p className="text-emerald-400 text-[11px] sm:text-sm font-semibold italic mt-0.5 sm:mt-1 drop-shadow line-clamp-1">
                  "{detail.tagline}"
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => {
                  onClose();
                  onPlay(detail);
                }}
                className="flex items-center gap-1.5 sm:gap-2 bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-400 hover:from-emerald-400 hover:to-green-300 text-black font-black text-xs sm:text-sm px-4 sm:px-7 py-2 sm:py-3.5 rounded-xl sm:rounded-2xl shadow-[0_0_25px_rgba(16,185,129,0.6)] transition-all hover:scale-105"
              >
                <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-black" />
                <span>STREAM NOW</span>
              </button>

              <button
                onClick={() => onToggleWatchlist(detail)}
                className={`p-2 sm:p-3.5 rounded-xl sm:rounded-2xl border transition-all ${
                  inWatchlist
                    ? 'bg-emerald-500/30 text-emerald-300 border-emerald-500'
                    : 'bg-black/60 text-white border-white/20 hover:border-emerald-400'
                }`}
                title={inWatchlist ? 'Remove from Stash' : 'Add to Stash Watchlist'}
              >
                {inWatchlist ? <Check className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" /> : <Plus className="w-4 h-4 sm:w-5 sm:h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs Header */}
        <div className="border-b border-emerald-500/20 bg-[#070b08] px-4 sm:px-8 py-2 flex items-center gap-1 sm:gap-3 overflow-x-auto scrollbar-none shrink-0">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
              activeTab === 'overview'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Info className="w-4 h-4 text-emerald-400" />
            <span>Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('cast')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
              activeTab === 'cast'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Users className="w-4 h-4 text-emerald-400" />
            <span>Cast & Crew ({castList.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('details')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
              activeTab === 'details'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Building2 className="w-4 h-4 text-emerald-400" />
            <span>Production & Financials</span>
          </button>

          {recommendationsList.length > 0 && (
            <button
              onClick={() => setActiveTab('similar')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                activeTab === 'similar'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>More Like This ({recommendationsList.length})</span>
            </button>
          )}
        </div>

        {/* Tab Body Content */}
        <div className="p-3.5 sm:p-6 space-y-4 sm:space-y-5 flex-1 min-h-0 overflow-y-auto pb-12 sm:pb-8">
          {loadingDetail && (
            <div className="flex items-center justify-center py-4 gap-2 text-emerald-400 text-xs font-semibold animate-pulse">
              <Sparkles className="w-4 h-4 animate-spin" />
              <span>Fetching live TMDB cast & crew data...</span>
            </div>
          )}

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="flex flex-col md:flex-row gap-5 md:gap-6 items-start">
              {/* Left Poster */}
              <div className="w-32 sm:w-40 md:w-48 max-w-[200px] shrink-0 aspect-[2/3] rounded-2xl overflow-hidden border border-emerald-500/30 shadow-2xl bg-zinc-900 mx-auto md:mx-0">
                <img src={posterUrl} alt={title} className="w-full h-full object-cover" />
              </div>

              {/* Right Synopsis & Highlights */}
              <div className="flex-1 min-w-0 space-y-4">
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-white mb-2 flex items-center gap-2">
                    <span>Storyline Overview</span>
                  </h3>
                  <p className="text-zinc-100 text-sm sm:text-base leading-relaxed font-normal">{detail.overview || 'No overview available for this title.'}</p>
                </div>

                {/* Stoned.living Weed Sommelier Pairing */}
                {(() => {
                  const pairingInfo = detail.strain_pairing
                    ? {
                        strain_name: detail.strain_pairing.split('(')[0]?.trim() || detail.strain_pairing,
                        strain_pairing: detail.strain_pairing,
                        strain_type: detail.strain_type || 'Hybrid',
                        thc: detail.thc || '24% THC',
                        flavor: detail.flavor || 'Citrus & Sweet Pine',
                        couchlock_score: detail.couchlock_score || 92,
                        chill_vibe: detail.chill_vibe || 'Elevated Session Vibe',
                        terpenes: detail.terpenes || 'Myrcene & Caryophyllene',
                        sommelier_note: detail.sommelier_note || `Pair with ${detail.strain_pairing}. Enjoy deep immersion, vivid visuals, and optimal chill vibes during streaming.`
                      }
                    : StrainDatabase.getPairingForMedia(detail);

                  const couchlockScore = pairingInfo.couchlock_score || 90;

                  return (
                    <div className="bg-gradient-to-br from-emerald-950/90 via-[#0a140f] to-green-950/90 border border-emerald-500/40 p-4 rounded-2xl shadow-xl space-y-3 relative overflow-hidden group">
                      {/* Ambient Glow Accent */}
                      <div className="absolute -right-10 -bottom-10 w-36 h-36 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

                      {/* Top Header Row */}
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <Cannabis className="w-5 h-5 text-emerald-400 animate-pulse shrink-0" />
                          <span className="text-xs font-black text-emerald-300 uppercase tracking-widest">
                            Recommended Strain Pairing
                          </span>
                        </div>
                        {pairingInfo.chill_vibe && (
                          <span className="text-[10px] font-bold text-emerald-300 bg-emerald-900/60 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                            ✨ {pairingInfo.chill_vibe}
                          </span>
                        )}
                      </div>

                      {/* Primary Strain Badge & Spec Grid */}
                      <div className="bg-black/40 border border-emerald-500/20 p-3 rounded-xl space-y-2">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div>
                            <h4 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
                              <span>{pairingInfo.strain_name || pairingInfo.strain_pairing}</span>
                              {pairingInfo.strain_type && (
                                <span className="text-[10px] font-mono font-bold text-amber-300 bg-amber-950/80 border border-amber-500/40 px-2 py-0.5 rounded-md">
                                  {pairingInfo.strain_type}
                                </span>
                              )}
                            </h4>
                          </div>
                          {pairingInfo.thc && (
                            <span className="text-xs font-black text-emerald-400 bg-emerald-950 border border-emerald-500/40 px-2.5 py-1 rounded-lg">
                              ⚡ {pairingInfo.thc.includes('THC') ? pairingInfo.thc : `${pairingInfo.thc} THC`}
                            </span>
                          )}
                        </div>

                        {/* Couchlock Synergy Bar */}
                        <div className="space-y-1 pt-1">
                          <div className="flex justify-between items-center text-[10px] font-mono">
                            <span className="text-zinc-400">Couchlock Synergy Match</span>
                            <span className="text-amber-400 font-bold">{couchlockScore}%</span>
                          </div>
                          <div className="w-full bg-zinc-900 rounded-full h-2 overflow-hidden border border-emerald-900/40">
                            <div
                              className="bg-gradient-to-r from-emerald-500 via-green-400 to-amber-400 h-full rounded-full transition-all duration-500"
                              style={{ width: `${couchlockScore}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Flavor & Terpenes Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {pairingInfo.flavor && (
                          <div className="bg-black/30 border border-emerald-900/40 p-2.5 rounded-xl">
                            <span className="text-[10px] text-zinc-400 font-bold block uppercase tracking-wider">Aroma & Flavor Profile</span>
                            <span className="text-emerald-200 font-semibold block text-[11px] mt-0.5">
                              🍓 {pairingInfo.flavor}
                            </span>
                          </div>
                        )}
                        {pairingInfo.terpenes && (
                          <div className="bg-black/30 border border-emerald-900/40 p-2.5 rounded-xl">
                            <span className="text-[10px] text-zinc-400 font-bold block uppercase tracking-wider">Terpene Spectrum</span>
                            <span className="text-emerald-300 font-mono text-[11px] block mt-0.5">
                              🧪 {pairingInfo.terpenes}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Sommelier Pairing Rationale Note */}
                      {pairingInfo.sommelier_note && (
                        <div className="bg-black/50 p-3 rounded-xl border border-emerald-500/20">
                          <p className="text-[11px] sm:text-xs text-zinc-200 leading-relaxed italic">
                            "{pairingInfo.sommelier_note}"
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Quick Info Grid */}
                {(() => {
                  const ageRatingInfo = getAgeRating(detail);
                  const isMultiEpisode =
                    mediaType === 'tv' ||
                    Boolean(detail.number_of_episodes && detail.number_of_episodes > 1) ||
                    Boolean(detail.number_of_seasons && detail.number_of_seasons > 0) ||
                    Boolean(detail.episode_run_time && detail.episode_run_time.length > 0);

                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                      {!isMultiEpisode && (
                        <div className="bg-[#101713] p-2.5 rounded-xl border border-emerald-900/50">
                          <span className="text-zinc-500 block text-[10px] font-bold uppercase tracking-wider">Runtime</span>
                          <span className="text-white font-extrabold flex items-center gap-1.5 mt-0.5">
                            <Clock className="w-3.5 h-3.5 text-emerald-400" />
                            {detail.runtime ? `${detail.runtime} mins` : '120 mins'}
                          </span>
                        </div>
                      )}

                      {mediaType === 'tv' && (
                        <div className="bg-[#101713] p-2.5 rounded-xl border border-emerald-900/50">
                          <span className="text-zinc-500 block text-[10px] font-bold uppercase tracking-wider">Seasons & Episodes</span>
                          <span className="text-white font-extrabold flex items-center gap-1.5 mt-0.5">
                            <Tv className="w-3.5 h-3.5 text-emerald-400" />
                            {detail.number_of_seasons || 1} Seasons ({detail.number_of_episodes || 12} eps)
                          </span>
                        </div>
                      )}

                      <div className="bg-[#101713] p-2.5 rounded-xl border border-emerald-900/50">
                        <span className="text-zinc-500 block text-[10px] font-bold uppercase tracking-wider">Original Language</span>
                        <span className="text-white font-extrabold flex items-center gap-1.5 mt-0.5">
                          <Globe className="w-3.5 h-3.5 text-emerald-400" />
                          {detail.original_language?.toUpperCase() || 'EN'}
                        </span>
                      </div>

                      <div className="bg-[#101713] p-2.5 rounded-xl border border-emerald-900/50 flex items-center justify-between portrait:hidden">
                        <div>
                          <span className="text-zinc-500 block text-[10px] font-bold uppercase tracking-wider">Age Rating</span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Shield className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-300 font-extrabold text-sm">{ageRatingInfo.rating}</span>
                          </div>
                        </div>
                        <span className="bg-emerald-950/80 border border-emerald-500/30 text-emerald-300 font-extrabold text-[10px] px-2 py-0.5 rounded-md text-right max-w-[110px] truncate">
                          {ageRatingInfo.label}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* TAB 2: CAST & CREW */}
          {activeTab === 'cast' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-emerald-400" />
                  <span>Full Cast & Characters ({castList.length})</span>
                </h3>

                {castList.length === 0 ? (
                  <p className="text-zinc-400 text-xs italic">No cast information available for this item.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {castList.map((actor) => (
                      <div
                        key={`${actor.id}_${actor.character}`}
                        className="bg-[#101713] border border-emerald-900/40 rounded-xl p-3 flex flex-col items-center text-center hover:border-emerald-500/40 transition group"
                      >
                        <img
                          src={
                            actor.profile_path
                              ? `https://image.tmdb.org/t/p/w185${actor.profile_path}`
                              : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'
                          }
                          alt={actor.name}
                          className="w-20 h-20 rounded-full object-cover mb-2 ring-2 ring-emerald-500/30 group-hover:scale-105 transition-transform"
                        />
                        <h4 className="font-bold text-xs text-white group-hover:text-emerald-400 transition-colors line-clamp-1">
                          {actor.name}
                        </h4>
                        <p className="text-[11px] text-zinc-400 line-clamp-1 mt-0.5">{actor.character || 'Role Unspecified'}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {crewList.length > 0 && (
                <div>
                  <h3 className="text-base font-bold text-white mb-4">Key Crew Members ({crewList.length})</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {crewList.slice(0, 12).map((member) => (
                      <div key={`${member.id}_${member.job}`} className="bg-[#101713] border border-emerald-900/30 p-2.5 rounded-xl flex items-center gap-3">
                        <img
                          src={
                            member.profile_path
                              ? `https://image.tmdb.org/t/p/w185${member.profile_path}`
                              : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80'
                          }
                          alt={member.name}
                          className="w-10 h-10 rounded-full object-cover ring-1 ring-emerald-500/30 shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="font-bold text-xs text-white truncate">{member.name}</p>
                          <p className="text-[10px] text-emerald-400 font-medium truncate">{member.job}</p>
                          <p className="text-[9px] text-zinc-500 truncate">{member.department}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: PRODUCTION & FINANCIALS */}
          {activeTab === 'details' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {detail.budget !== undefined && (
                  <div className="bg-[#101713] p-4 rounded-xl border border-emerald-900/50">
                    <span className="text-zinc-500 block text-[10px] font-bold uppercase tracking-wider">Production Budget</span>
                    <span className="text-white font-black text-lg flex items-center gap-1.5 mt-1">
                      <DollarSign className="w-4 h-4 text-emerald-400" />
                      {formatMoney(detail.budget)}
                    </span>
                  </div>
                )}

                {detail.revenue !== undefined && (
                  <div className="bg-[#101713] p-4 rounded-xl border border-emerald-900/50">
                    <span className="text-zinc-500 block text-[10px] font-bold uppercase tracking-wider">Worldwide Box Office</span>
                    <span className="text-emerald-400 font-black text-lg flex items-center gap-1.5 mt-1">
                      <DollarSign className="w-4 h-4 text-emerald-400" />
                      {formatMoney(detail.revenue)}
                    </span>
                  </div>
                )}

                <div className="bg-[#101713] p-4 rounded-xl border border-emerald-900/50">
                  <span className="text-zinc-500 block text-[10px] font-bold uppercase tracking-wider">Original Name / Title</span>
                  <span className="text-white font-bold text-sm block mt-1">{originalTitle || title}</span>
                </div>
              </div>

              {/* Production Companies */}
              {detail.production_companies && detail.production_companies.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-white mb-3 uppercase tracking-wider">Production Companies</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {detail.production_companies.map((company) => (
                      <div key={company.id} className="bg-[#101713] p-3 rounded-xl border border-emerald-900/40 flex items-center gap-3">
                        {company.logo_path ? (
                          <div className="w-10 h-10 p-1 bg-white/90 rounded-lg flex items-center justify-center shrink-0">
                            <img
                              src={`https://image.tmdb.org/t/p/w185${company.logo_path}`}
                              alt={company.name}
                              className="max-h-full max-w-full object-contain"
                            />
                          </div>
                        ) : (
                          <div className="w-10 h-10 bg-emerald-950 rounded-lg flex items-center justify-center shrink-0 border border-emerald-500/30">
                            <Building2 className="w-5 h-5 text-emerald-400" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-bold text-xs text-white truncate">{company.name}</p>
                          {company.origin_country && <p className="text-[10px] text-zinc-400">{company.origin_country}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Networks (For TV Shows & Anime) */}
              {detail.networks && detail.networks.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-white mb-3 uppercase tracking-wider">Broadcasting Networks</h3>
                  <div className="flex flex-wrap gap-3">
                    {detail.networks.map((net) => (
                      <div key={net.id} className="bg-[#101713] p-2.5 px-4 rounded-xl border border-emerald-900/40 flex items-center gap-3">
                        {net.logo_path ? (
                          <img
                            src={`https://image.tmdb.org/t/p/w185${net.logo_path}`}
                            alt={net.name}
                            className="h-6 object-contain bg-white/90 px-1.5 py-0.5 rounded"
                          />
                        ) : null}
                        <span className="font-bold text-xs text-white">{net.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Keywords / Tags */}
              {keywordsList.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Keywords & Related Tags</span>
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {keywordsList.map((kw) => (
                      <span
                        key={kw.id}
                        className="bg-[#101713] text-zinc-300 border border-emerald-900/50 text-[10px] font-semibold px-2.5 py-1 rounded-lg"
                      >
                        #{kw.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: MORE LIKE THIS / RECOMMENDATIONS */}
          {activeTab === 'similar' && (
            <div className="space-y-2.5 sm:space-y-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>Recommended Titles Based On {title}</span>
              </h3>

              <div className="grid grid-cols-5 gap-2 sm:gap-2.5">
                {recommendationsList.map((rec) => (
                  <div
                    key={rec.id}
                    onClick={() => {
                      if (onSelectMedia) {
                        onSelectMedia(rec);
                      } else {
                        setFullDetail(null);
                        setActiveTab('overview');
                        fetchMediaDetail(rec.media_type || getEffectiveMediaType(rec), rec.id).then((d) => d && setFullDetail(d));
                      }
                    }}
                    className="group bg-[#101713] border border-emerald-900/40 hover:border-emerald-400/60 rounded-lg sm:rounded-xl overflow-hidden cursor-pointer transition hover:-translate-y-0.5 hover:shadow-lg flex flex-col"
                  >
                    <div className="aspect-[2/3] w-full relative bg-zinc-900 shrink-0">
                      <img
                        src={
                          rec.poster_path
                            ? `https://image.tmdb.org/t/p/w342${rec.poster_path}`
                            : 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=300&auto=format&fit=crop&q=80'
                        }
                        alt={rec.title || rec.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                      <div className="absolute top-1 right-1 bg-black/80 text-amber-400 text-[9px] font-bold px-1 py-0.5 rounded border border-amber-500/30 flex items-center gap-0.5">
                        <Star className="w-2.5 h-2.5 fill-amber-400" />
                        {rec.vote_average?.toFixed(1) || '7.5'}
                      </div>
                    </div>
                    <div className="p-1.5 sm:p-2 min-w-0 flex flex-col justify-center">
                      <h4 className="font-bold text-[10px] sm:text-xs text-white truncate group-hover:text-emerald-400 transition-colors leading-tight">
                        {rec.title || rec.name}
                      </h4>
                      <p className="text-[9px] sm:text-[10px] text-zinc-400 mt-0.5">
                        {rec.release_date?.slice(0, 4) || rec.first_air_date?.slice(0, 4) || 'Recommended'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
