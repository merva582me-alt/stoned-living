import React, { useState, useEffect, useRef } from 'react';
import { Tv, ChevronDown, Play, Loader2, Check } from 'lucide-react';
import { MediaItem, Episode, Season } from '../types';
import { fetchTvSeason } from '../services/api';

interface EpisodesModalProps {
  isOpen: boolean;
  media: MediaItem;
  currentSeason: number;
  currentEpisode: number;
  onSelectEpisode: (season: number, episode: number) => void;
  onClose: () => void;
}

export const EpisodesModal: React.FC<EpisodesModalProps> = ({
  isOpen,
  media,
  currentSeason,
  currentEpisode,
  onSelectEpisode,
  onClose,
}) => {
  const [selectedSeason, setSelectedSeason] = useState<number>(currentSeason);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSeasonDropdownOpen, setIsSeasonDropdownOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const modalContentRef = useRef<HTMLDivElement>(null);

  // Sync selected season when currentSeason prop changes
  useEffect(() => {
    setSelectedSeason(currentSeason);
  }, [currentSeason, isOpen]);

  // Available seasons list (filter out specials season 0 unless it's the only one)
  const availableSeasons: Season[] = React.useMemo(() => {
    if (media.seasons && media.seasons.length > 0) {
      const regular = media.seasons.filter((s) => s.season_number > 0);
      return regular.length > 0 ? regular : media.seasons;
    }
    const count = media.number_of_seasons || 1;
    return Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      season_number: i + 1,
      name: `Season ${i + 1}`,
      overview: '',
      poster_path: null,
      air_date: '',
      episode_count: 10,
    }));
  }, [media.seasons, media.number_of_seasons]);

  // Fetch episodes whenever selectedSeason or media.id changes
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    setLoading(true);

    fetchTvSeason(media.id, selectedSeason)
      .then((seasonData) => {
        if (!isMounted) return;
        if (seasonData?.episodes && seasonData.episodes.length > 0) {
          setEpisodes(seasonData.episodes);
        } else {
          // Fallback episode generation if TMDb returned empty
          const targetSeasonMeta = availableSeasons.find((s) => s.season_number === selectedSeason);
          const epCount = targetSeasonMeta?.episode_count || 8;
          const fallbackEpisodes: Episode[] = Array.from({ length: epCount }, (_, i) => ({
            id: selectedSeason * 1000 + (i + 1),
            episode_number: i + 1,
            season_number: selectedSeason,
            name: `Episode ${i + 1}`,
            overview: `Season ${selectedSeason}, Episode ${i + 1} of ${media.title || media.name || 'series'}.`,
            still_path: null,
            air_date: media.first_air_date || '',
            vote_average: media.vote_average || 8.0,
            runtime: media.episode_run_time?.[0] || 45,
          }));
          setEpisodes(fallbackEpisodes);
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setEpisodes([]);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, media.id, media.title, media.name, media.first_air_date, media.vote_average, media.episode_run_time, selectedSeason, availableSeasons]);

  // Close season dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsSeasonDropdownOpen(false);
      }
    };
    if (isSeasonDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSeasonDropdownOpen]);

  // Close modal on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      {/* Modal Dialog Container matching Screenshot 3 */}
      <div
        ref={modalContentRef}
        className="relative w-full max-w-4xl max-h-[88vh] bg-[#0c100e] border border-zinc-800/90 rounded-2xl sm:rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.95)] flex flex-col overflow-hidden text-white"
      >
        {/* Top Pull Handle */}
        <div className="pt-3 pb-1 flex justify-center">
          <div className="w-12 h-1 bg-zinc-600 rounded-full" />
        </div>

        {/* Modal Header */}
        <div className="px-5 sm:px-6 pt-2 pb-4 flex items-center justify-between border-b border-zinc-800/60 shrink-0">
          <div className="flex items-center gap-3">
            {/* Stacked Episodes Icon matching Screenshot 2 & 3 */}
            <div className="w-8 h-8 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <rect x="6" y="2" width="16" height="16" rx="2" fill="currentColor" fillOpacity="0.15" stroke="currentColor" />
                <path d="M2 6v12a2 2 0 0 0 2 2h12" />
                <polygon points="12 7 17 10 12 13 12 7" fill="currentColor" />
              </svg>
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight leading-tight">
                Episodes
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Select an episode to watch.
              </p>
            </div>
          </div>

          {/* Season Selector Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsSeasonDropdownOpen(!isSeasonDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-zinc-200 hover:text-white border border-zinc-800 transition cursor-pointer text-xs font-semibold shadow-sm"
            >
              <Tv className="w-3.5 h-3.5 text-zinc-400" />
              <span>Season {selectedSeason}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-200 ${isSeasonDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isSeasonDropdownOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-44 rounded-xl bg-[#141a16] border border-zinc-800 shadow-2xl py-1.5 z-30 max-h-60 overflow-y-auto no-scrollbar">
                {availableSeasons.map((s) => {
                  const isCur = s.season_number === selectedSeason;
                  return (
                    <button
                      key={s.id || s.season_number}
                      type="button"
                      onClick={() => {
                        setSelectedSeason(s.season_number);
                        setIsSeasonDropdownOpen(false);
                      }}
                      className={`w-full px-3.5 py-2 text-left text-xs font-medium flex items-center justify-between transition cursor-pointer ${
                        isCur
                          ? 'bg-emerald-500/15 text-[#00df82] font-bold'
                          : 'text-zinc-300 hover:bg-zinc-800/80 hover:text-white'
                      }`}
                    >
                      <span>{s.name || `Season ${s.season_number}`}</span>
                      {isCur && <Check className="w-3.5 h-3.5 text-[#00df82]" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal Scrollable Body: Episode Grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 no-scrollbar">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-zinc-400">
              <Loader2 className="w-7 h-7 text-[#00df82] animate-spin" />
              <span className="text-xs font-medium">Loading Season {selectedSeason} episodes...</span>
            </div>
          ) : episodes.length === 0 ? (
            <div className="py-16 text-center text-zinc-500 text-sm">
              No episodes found for Season {selectedSeason}.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {episodes.map((ep) => {
                const isPlaying = selectedSeason === currentSeason && ep.episode_number === currentEpisode;
                const thumbUrl = ep.still_path
                  ? `https://image.tmdb.org/t/p/w500${ep.still_path}`
                  : media.backdrop_path
                  ? `https://image.tmdb.org/t/p/w780${media.backdrop_path}`
                  : media.poster_path
                  ? `https://image.tmdb.org/t/p/w500${media.poster_path}`
                  : null;

                const formattedDate = formatDate(ep.air_date);
                const runtimeStr = ep.runtime ? `${ep.runtime} min` : null;

                return (
                  <div
                    key={ep.id || ep.episode_number}
                    onClick={() => {
                      onSelectEpisode(selectedSeason, ep.episode_number);
                      onClose();
                    }}
                    className={`group relative flex flex-col rounded-xl overflow-hidden cursor-pointer select-none transition-all duration-200 ${
                      isPlaying
                        ? 'ring-2 ring-[#00df82] bg-emerald-950/20 shadow-[0_0_20px_rgba(0,223,130,0.2)]'
                        : 'hover:bg-zinc-900/60 border border-zinc-900 hover:border-zinc-800'
                    }`}
                  >
                    {/* Thumbnail Image Container */}
                    <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800/80 group-hover:border-zinc-700 transition">
                      {thumbUrl ? (
                        <img
                          src={thumbUrl}
                          alt={ep.name}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#0c1510] to-[#060a08] text-zinc-600 text-xs font-mono">
                          No Preview
                        </div>
                      )}

                      {/* Play Hover Overlay */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="w-10 h-10 rounded-full bg-[#00df82] text-black flex items-center justify-center shadow-lg transition-transform transform scale-90 group-hover:scale-100">
                          <Play className="w-4 h-4 fill-current ml-0.5" />
                        </div>
                      </div>

                      {/* Currently Playing Badge */}
                      {isPlaying && (
                        <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-md bg-[#00df82] text-black text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-md">
                          <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" />
                          <span>Playing</span>
                        </div>
                      )}
                    </div>

                    {/* Metadata Section */}
                    <div className="p-2.5 flex-1 flex flex-col justify-between">
                      <div>
                        {/* Episode Number and Name */}
                        <h3
                          className={`text-xs sm:text-sm font-bold line-clamp-1 transition-colors ${
                            isPlaying
                              ? 'text-[#00df82]'
                              : 'text-white group-hover:text-[#00df82]'
                          }`}
                        >
                          {ep.episode_number}. {ep.name || `Episode ${ep.episode_number}`}
                        </h3>

                        {/* Date and Runtime */}
                        {(formattedDate || runtimeStr) && (
                          <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 mt-0.5 font-mono">
                            {formattedDate && <span>{formattedDate}</span>}
                            {formattedDate && runtimeStr && <span>·</span>}
                            {runtimeStr && <span>{runtimeStr}</span>}
                          </div>
                        )}

                        {/* Synopsis Overview */}
                        {ep.overview && (
                          <p className="text-[11px] text-zinc-400/90 mt-1 line-clamp-2 leading-relaxed">
                            {ep.overview}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer: Full-Width Close Button matching Screenshot 3 */}
        <div className="p-4 sm:p-5 border-t border-zinc-800/60 bg-[#090d0b] shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-zinc-800/90 hover:bg-zinc-700 text-white font-bold text-xs sm:text-sm transition cursor-pointer text-center"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
