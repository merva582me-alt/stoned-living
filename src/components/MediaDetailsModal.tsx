import React, { useState, useEffect, useMemo } from 'react';
import {
  Play,
  Bookmark,
  Check,
  X,
  Star,
  Cannabis,
  Clock,
  Calendar,
  ChevronDown,
  Eye,
  EyeOff
} from 'lucide-react';
import { MediaItem, CastMember, Episode } from '../types';
import { fetchMediaDetail, fetchCredits, fetchRecommendations, fetchTvSeason } from '../services/api';
import { toggleWatchlist, isItemInWatchlist } from '../services/storage';
import { MediaCard } from './MediaCard';
import { toast } from 'sonner';

interface MediaDetailsModalProps {
  item: MediaItem;
  onClose: () => void;
  onPlay: (item: MediaItem, season?: number, episode?: number) => void;
  onSelectMedia?: (item: MediaItem) => void;
}

function formatAirDate(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export const MediaDetailsModal: React.FC<MediaDetailsModalProps> = ({
  item,
  onClose,
  onPlay,
  onSelectMedia,
}) => {
  const isTv = item.media_type === 'tv' || Boolean(item.first_air_date);
  const effectiveType: 'movie' | 'tv' = isTv ? 'tv' : 'movie';

  const [detail, setDetail] = useState<MediaItem>(item);
  const [cast, setCast] = useState<CastMember[]>([]);
  const [totalCastCount, setTotalCastCount] = useState<number>(0);
  const [recommendations, setRecommendations] = useState<MediaItem[]>([]);
  const [inWatchlist, setInWatchlist] = useState(() => isItemInWatchlist(item.id));
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);
  const [loading, setLoading] = useState(true);

  // ── Episodic State for TV Series (Screenshots 1 - 3) ──
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [seasonEpisodes, setSeasonEpisodes] = useState<Episode[]>([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState<boolean>(false);
  const [showAllEpisodes, setShowAllEpisodes] = useState<boolean>(false);
  const [hideSpoilers, setHideSpoilers] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    Promise.all([
      fetchMediaDetail(effectiveType, item.id),
      fetchCredits(effectiveType, item.id),
      fetchRecommendations(effectiveType, item.id)
    ]).then(([d, c, r]) => {
      if (!mounted) return;
      if (d) setDetail(d);
      setCast(c.cast);
      setTotalCastCount(c.totalCastCount);
      setRecommendations(r);
      setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, [item.id, effectiveType]);

  // Available seasons list
  const availableSeasons: { season_number: number; name: string }[] = useMemo(() => {
    if (detail.seasons && detail.seasons.length > 0) {
      const regular = detail.seasons
        .filter((s) => s.season_number > 0)
        .map((s) => ({ season_number: s.season_number, name: s.name || `Season ${s.season_number}` }));
      if (regular.length > 0) return regular;
      return detail.seasons.map((s) => ({ season_number: s.season_number, name: s.name || `Season ${s.season_number}` }));
    }
    if (detail.number_of_seasons && detail.number_of_seasons > 0) {
      return Array.from({ length: detail.number_of_seasons }, (_, i) => ({
        season_number: i + 1,
        name: `Season ${i + 1}`,
      }));
    }
    return [{ season_number: 1, name: 'Season 1' }];
  }, [detail.seasons, detail.number_of_seasons]);

  // Fetch episodes when selectedSeason or detail.id changes
  useEffect(() => {
    const isActuallyTv = detail.media_type === 'tv' || Boolean(detail.first_air_date) || Boolean(detail.number_of_seasons);
    if (!isActuallyTv) return;

    let active = true;
    setLoadingEpisodes(true);

    fetchTvSeason(detail.id, selectedSeason)
      .then((seasonData) => {
        if (!active) return;
        setSeasonEpisodes(seasonData?.episodes || []);
        setLoadingEpisodes(false);
      })
      .catch((err) => {
        console.warn('Error fetching TV season episodes:', err);
        if (active) setLoadingEpisodes(false);
      });

    return () => {
      active = false;
    };
  }, [detail.id, detail.media_type, detail.first_air_date, detail.number_of_seasons, selectedSeason]);

  // Lock background body and HTML scroll completely while card is open
  useEffect(() => {
    const origBodyOverflow = document.body.style.overflow;
    const origHtmlOverflow = document.documentElement.style.overflow;
    const origBodyTouchAction = document.body.style.touchAction;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    return () => {
      document.body.style.overflow = origBodyOverflow;
      document.documentElement.style.overflow = origHtmlOverflow;
      document.body.style.touchAction = origBodyTouchAction;
    };
  }, []);

  const isActuallyTv = detail.media_type === 'tv' || Boolean(detail.first_air_date) || Boolean(detail.number_of_seasons);
  const title = detail.title || detail.name || 'Untitled';
  const releaseYear = (detail.release_date || detail.first_air_date)?.split('-')[0] || '2026';
  const rating = (detail.vote_average || 8.0).toFixed(1);
  const runtimeMinutes = detail.runtime || (detail.episode_run_time?.[0]) || 120;
  const hours = Math.floor(runtimeMinutes / 60);
  const mins = runtimeMinutes % 60;
  const runtimeFormatted = hours > 0 ? `${hours}H ${mins}M` : `${mins}M`;

  // TV stats string matching Screenshot 1 (e.g. S14E2426)
  const totalSeasonsCount = detail.number_of_seasons || availableSeasons.length || 1;
  const totalEpisodesCount = detail.number_of_episodes || seasonEpisodes.length || 1;
  const tvStatsFormatted = `S${totalSeasonsCount}E${totalEpisodesCount}`;

  const backdropUrl = detail.backdrop_path
    ? (detail.backdrop_path.startsWith('http') ? detail.backdrop_path : `https://image.tmdb.org/t/p/original${detail.backdrop_path}`)
    : detail.poster_path
    ? (detail.poster_path.startsWith('http') ? detail.poster_path : `https://image.tmdb.org/t/p/original${detail.poster_path}`)
    : '';

  const handleToggleList = () => {
    const res = toggleWatchlist(detail);
    setInWatchlist(res.inList);
    toast(res.inList ? 'Added to your List' : 'Removed from your List');
  };

  const visibleEpisodes = showAllEpisodes ? seasonEpisodes : seasonEpisodes.slice(0, 6);

  return (
    <div 
      onClick={onClose}
      onWheel={(e) => {
        // Prevent background scroll when hovering backdrop
        if (e.target === e.currentTarget) {
          e.preventDefault();
        }
      }}
      onTouchMove={(e) => {
        if (e.target === e.currentTarget) {
          e.preventDefault();
        }
      }}
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-hidden overscroll-none animate-fadeIn select-none"
    >
      {/* Modal Dialog Card (Screenshots 1 - 4) */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl rounded-3xl bg-[#090e0b] border border-emerald-500/25 overflow-hidden shadow-[0_25px_80px_rgba(0,0,0,0.95)] my-auto max-h-[92vh] flex flex-col overscroll-contain select-text"
      >
        {/* Top Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-30 w-9 h-9 rounded-full bg-black/60 hover:bg-black/90 backdrop-blur-md border border-white/20 text-white flex items-center justify-center transition cursor-pointer hover:scale-105"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Smooth Internal Scrollable Container (Only card scrolls, never background) */}
        <div className="overflow-y-auto overscroll-contain no-scrollbar flex-1 scroll-smooth">
          {/* ── Top Half: 16:9 Backdrop with Overlay Billboard (Screenshot 1) ── */}
          <div className="relative aspect-video w-full overflow-hidden bg-black select-none">
            {backdropUrl && (
              <img
                src={backdropUrl}
                alt={title}
                className="w-full h-full object-cover object-center filter brightness-[0.85]"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#090e0b] via-[#090e0b]/40 to-transparent" />

            {/* Backdrop Center / Bottom Overlay Content */}
            <div className="absolute inset-0 p-6 sm:p-8 flex flex-col justify-end">
              {detail.tagline && (
                <p className="text-xs sm:text-sm text-zinc-300 italic mb-1.5 drop-shadow">
                  &ldquo;{detail.tagline}&rdquo;
                </p>
              )}
              <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight uppercase drop-shadow-[0_4px_16px_rgba(0,0,0,0.9)]">
                {title}
              </h2>

              {/* Action Buttons: [ ▶ Play Now ]   [ 📁 Add to List ] */}
              <div className="pt-4 flex items-center gap-3">
                <button
                  onClick={() => onPlay(detail, isActuallyTv ? selectedSeason : undefined, isActuallyTv ? 1 : undefined)}
                  className="px-6 py-2.5 rounded-full bg-white hover:bg-zinc-200 text-black font-extrabold text-xs sm:text-sm flex items-center gap-2 shadow-2xl transition-all cursor-pointer hover:scale-105"
                >
                  <Play className="w-4 h-4 fill-black ml-0.5" />
                  <span>Play Now</span>
                </button>

                <button
                  onClick={handleToggleList}
                  className="px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-semibold text-xs sm:text-sm flex items-center gap-2 backdrop-blur-md border border-white/20 transition-all cursor-pointer hover:scale-105"
                >
                  {inWatchlist ? <Check className="w-4 h-4 text-emerald-400" /> : <Bookmark className="w-4 h-4" />}
                  <span>{inWatchlist ? 'In List' : 'Add to List'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* ── Bottom Half: Details, Casts, Season Episodes, Similar (Screenshots 1 - 3) ── */}
          <div className="p-6 sm:p-8 space-y-6">
            {/* Rating & Series Stats Row (Matching Screenshot 1) */}
            <div className="flex items-center gap-3 text-sm font-semibold text-zinc-400">
              <div className="flex items-baseline gap-1">
                <span className="text-red-500 font-black text-2xl">{rating}</span>
                <span className="text-zinc-500 text-xs">/ 10</span>
              </div>
              <span>·</span>
              <span className="text-white font-medium">{releaseYear}</span>
              <span>·</span>
              <span className="text-white font-medium">{isActuallyTv ? tvStatsFormatted : runtimeFormatted}</span>
              {detail.strain_pairing && (
                <>
                  <span>·</span>
                  <span className="text-emerald-400 font-medium">🌿 {detail.strain_pairing}</span>
                </>
              )}
            </div>

            {/* Overview / Synopsis with ...see more */}
            <div>
              <p className={`text-xs sm:text-sm text-zinc-300 leading-relaxed font-normal ${!synopsisExpanded ? 'line-clamp-3' : ''}`}>
                {detail.overview || 'Stream this title in 4K resolution on Stoned.living.'}
              </p>
              {detail.overview && detail.overview.length > 180 && (
                <button
                  onClick={() => setSynopsisExpanded(!synopsisExpanded)}
                  className="text-xs text-red-400 hover:text-red-300 font-bold mt-1 cursor-pointer transition"
                >
                  {synopsisExpanded ? 'see less' : '...see more'}
                </button>
              )}
            </div>

            {/* Casts Section (Circular headshots matching Screenshot 2) */}
            {cast.length > 0 && (
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  Casts
                </h3>
                <div className="flex items-center gap-3.5 overflow-x-auto no-scrollbar py-1">
                  {cast.slice(0, 7).map((actor) => (
                    <div key={actor.id} className="flex flex-col items-center w-16 shrink-0 text-center">
                      <div className="w-14 h-14 rounded-full overflow-hidden bg-zinc-800 border border-zinc-700 shadow-md mb-1.5">
                        {actor.profile_path ? (
                          <img
                            src={actor.profile_path}
                            alt={actor.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center font-bold text-zinc-400 text-xs">
                            {actor.name.charAt(0)}
                          </div>
                        )}
                      </div>
                      <span className="text-[11px] font-semibold text-zinc-200 truncate w-full">
                        {actor.name.split(' ')[0]}
                      </span>
                    </div>
                  ))}

                  {/* +N Badge */}
                  {totalCastCount > 7 && (
                    <div className="flex flex-col items-center w-14 shrink-0 text-center">
                      <div className="w-14 h-14 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-red-400 font-bold text-xs shadow-md mb-1.5">
                        +{totalCastCount - 7}
                      </div>
                      <span className="text-[10px] text-zinc-400">more</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Season & Episode Selector (Screenshots 2 & 3) ── */}
            {isActuallyTv && (
              <div className="space-y-4 pt-4 border-t border-zinc-900/80">
                {/* Season Dropdown & Hide Spoilers Toggle Row */}
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  {/* Custom Styled Season Dropdown */}
                  <div className="relative inline-block">
                    <select
                      value={selectedSeason}
                      onChange={(e) => {
                        setSelectedSeason(Number(e.target.value));
                        setShowAllEpisodes(false);
                      }}
                      className="appearance-none bg-[#121915] border border-zinc-800 hover:border-emerald-500/50 rounded-xl pl-4 pr-10 py-2 text-xs sm:text-sm font-bold text-white shadow-md cursor-pointer outline-none focus:border-emerald-400 transition"
                    >
                      {availableSeasons.map((s) => (
                        <option key={s.season_number} value={s.season_number} className="bg-[#0e1411] text-white">
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-zinc-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>

                  {/* Hide Spoilers Toggle */}
                  <button
                    type="button"
                    onClick={() => setHideSpoilers(!hideSpoilers)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-white transition cursor-pointer select-none py-1.5 px-3 rounded-lg hover:bg-zinc-800/60"
                    title={hideSpoilers ? 'Show spoilers' : 'Hide spoilers'}
                  >
                    {hideSpoilers ? (
                      <EyeOff className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Eye className="w-4 h-4 text-zinc-400" />
                    )}
                    <span className={hideSpoilers ? 'text-emerald-400 font-bold' : ''}>Hide Spoilers</span>
                  </button>
                </div>

                {/* Episodes Grid (3 Columns matching Screenshots 2 & 3) */}
                {loadingEpisodes ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 pt-1">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="space-y-2">
                        <div className="aspect-video w-full rounded-xl bg-zinc-900/80 animate-pulse border border-zinc-800" />
                        <div className="h-4 w-3/4 rounded bg-zinc-900 animate-pulse" />
                        <div className="h-3 w-1/2 rounded bg-zinc-900 animate-pulse" />
                      </div>
                    ))}
                  </div>
                ) : seasonEpisodes.length > 0 ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 pt-1">
                      {visibleEpisodes.map((ep) => {
                        const epRating = ep.vote_average || 0;
                        return (
                          <div
                            key={ep.id}
                            className="group/ep flex flex-col cursor-pointer"
                            onClick={() => {
                              onClose();
                              onPlay(detail, selectedSeason, ep.episode_number);
                            }}
                          >
                            {/* 16:9 Thumbnail Card */}
                            <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800/80 group-hover/ep:border-zinc-700 shadow-lg group-hover/ep:scale-[1.02] transition-all">
                              {ep.still_path ? (
                                <img
                                  src={`https://image.tmdb.org/t/p/w500${ep.still_path}`}
                                  alt={ep.name}
                                  className={`w-full h-full object-cover transition-all duration-300 ${
                                    hideSpoilers ? 'filter blur-md scale-105 opacity-60' : 'group-hover/ep:scale-105'
                                  }`}
                                  loading="lazy"
                                />
                              ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900/90 text-zinc-500 text-xs font-semibold p-2 text-center">
                                  <Play className="w-6 h-6 mb-1 text-zinc-600" />
                                  <span>Episode {ep.episode_number}</span>
                                </div>
                              )}

                              {/* Gradient bottom shadow */}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

                              {/* Rating Circle Badge in Top Right (Matching Screenshots) */}
                              {epRating > 0 && (
                                <div
                                  className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black backdrop-blur-md bg-black/75 border-2 shadow-lg ${
                                    epRating >= 8.0
                                      ? 'border-[#00df82] text-emerald-300'
                                      : epRating >= 5.5
                                      ? 'border-amber-500 text-amber-300'
                                      : 'border-red-500 text-red-400'
                                  }`}
                                >
                                  {epRating.toFixed(1)}
                                </div>
                              )}

                              {/* Center Play Icon Hover Overlay */}
                              <div className="absolute inset-0 bg-black/35 opacity-0 group-hover/ep:opacity-100 transition-opacity flex items-center justify-center">
                                <div className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-2xl transition-transform transform scale-90 group-hover/ep:scale-100">
                                  <Play className="w-4 h-4 fill-black ml-0.5" />
                                </div>
                              </div>
                            </div>

                            {/* Metadata Below Card */}
                            <div className="mt-2.5">
                              <h4 className="font-bold text-xs sm:text-sm text-white group-hover/ep:text-emerald-400 transition-colors line-clamp-1">
                                {ep.episode_number}. {ep.name}
                              </h4>
                              <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 mt-1 font-medium">
                                {ep.air_date && <span>{formatAirDate(ep.air_date)}</span>}
                                {ep.air_date && (ep.runtime || detail.episode_run_time?.[0]) && <span>·</span>}
                                {ep.runtime ? (
                                  <span>{ep.runtime} min</span>
                                ) : detail.episode_run_time?.[0] ? (
                                  <span>{detail.episode_run_time[0]} min</span>
                                ) : null}
                              </div>
                              <p className="text-[11px] text-zinc-400 leading-relaxed mt-1.5 line-clamp-2">
                                {hideSpoilers
                                  ? 'Synopsis concealed to prevent spoilers.'
                                  : ep.overview || 'No synopsis provided for this episode.'}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Show More / Show Less Button (Screenshot 3) */}
                    {seasonEpisodes.length > 6 && (
                      <div className="flex justify-center pt-2">
                        <button
                          type="button"
                          onClick={() => setShowAllEpisodes(!showAllEpisodes)}
                          className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold text-zinc-300 hover:text-white bg-[#121915] hover:bg-zinc-800 border border-zinc-800/80 transition cursor-pointer"
                        >
                          <span>{showAllEpisodes ? 'Show Less' : 'Show More'}</span>
                          <ChevronDown
                            className={`w-3.5 h-3.5 transition-transform ${showAllEpisodes ? 'rotate-180' : ''}`}
                          />
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-8 text-center text-xs text-zinc-500 bg-[#0c1410] rounded-2xl border border-zinc-900">
                    No episodes found for this season.
                  </div>
                )}
              </div>
            )}

            {/* You May Also Like (Screenshot 4) */}
            {recommendations.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-zinc-900">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  You may also like
                </h3>
                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                  {recommendations.map((rec) => (
                    <div 
                      key={rec.id} 
                      className="w-32 shrink-0"
                      onClick={() => {
                        if (onSelectMedia) {
                          onSelectMedia(rec);
                        } else {
                          setDetail(rec);
                        }
                      }}
                    >
                      <MediaCard
                        item={rec}
                        onOpenDetails={(m) => {
                          if (onSelectMedia) onSelectMedia(m);
                          else setDetail(m);
                        }}
                        onPlay={(m) => onPlay(m)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
