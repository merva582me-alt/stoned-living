import React, { useMemo } from 'react';
import { Star, Cannabis, Info, ArrowLeft, Film, Tv, Calendar } from 'lucide-react';
import { MediaItem, UserProfile, SiteSettings } from '../types';
import { StrainDatabase } from '../data/strainDatabase';

interface WatchPlayerProps {
  media: MediaItem;
  user?: UserProfile;
  settings?: SiteSettings | null;
  initialSeason?: number;
  initialEpisode?: number;
  onClose: () => void;
  onSelectMedia: (item: MediaItem) => void;
  onUpdateUser?: (updated: UserProfile) => void;
}

export const WatchPlayer: React.FC<WatchPlayerProps> = ({
  media,
  initialSeason = 1,
  initialEpisode = 1,
  onClose,
}) => {
  const isTv =
    media.media_type === 'tv' ||
    Boolean(media.number_of_seasons) ||
    Boolean(media.first_air_date) ||
    (Boolean(media.name) && !media.title);
  const effectiveMediaType: 'movie' | 'tv' = isTv ? 'tv' : 'movie';

  // Construct official Vidstuck embed URL using official documentation parameters
  const embedUrl = useMemo(() => {
    const id = media.id;
    const baseParams = new URLSearchParams({
      branding: 'STONED.LIVING',
      color: '10B981',
      overlay: 'true',
      subtitle: 'english',
    });

    if (effectiveMediaType === 'movie') {
      return `https://vidstuck.xyz/embed/movie/${id}?${baseParams.toString()}`;
    }

    // TV Shows & Serialized Anime
    const s = initialSeason || 1;
    const e = initialEpisode || 1;
    baseParams.set('episodeSelector', 'true');
    baseParams.set('nextEpisode', 'true');
    baseParams.set('autoplayNextEpisode', 'true');
    return `https://vidstuck.xyz/embed/tv/${id}/${s}/${e}?${baseParams.toString()}`;
  }, [media.id, effectiveMediaType, initialSeason, initialEpisode]);

  const strainPairing = media.strain_pairing
    ? {
        strain_name: media.strain_pairing.split('(')[0]?.trim() || media.strain_pairing,
        strain_pairing: media.strain_pairing,
        strain_type: media.strain_type || 'Hybrid',
        thc: media.thc || '24% THC',
        flavor: media.flavor || 'Citrus & Sweet Pine',
        couchlock_score: media.couchlock_score || 92,
        chill_vibe: media.chill_vibe || 'Elevated Session Vibe',
        terpenes: media.terpenes || 'Myrcene & Caryophyllene',
        sommelier_note:
          media.sommelier_note ||
          `Pair with ${media.strain_pairing}. Enjoy deep immersion, vivid visuals, and optimal chill vibes during streaming.`,
      }
    : StrainDatabase.getPairingForMedia(media);

  const couchlockScore = strainPairing.couchlock_score || 90;
  const mediaTitle = media.title || media.name || 'Untitled';
  const releaseYear = (media.release_date || media.first_air_date)?.split('-')[0];

  return (
    <div className="min-h-screen bg-[#060907] text-white">
      <div className="w-full max-w-[1920px] mx-auto px-2 sm:px-6 lg:px-8 py-3 sm:py-6 pb-16 space-y-4 sm:space-y-6">
        {/* Top Control Bar */}
        <div className="flex items-center justify-between gap-3 bg-[#0d1310]/95 border border-emerald-500/30 p-2.5 sm:p-4 rounded-xl sm:rounded-2xl backdrop-blur-md shadow-lg">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button
              onClick={onClose}
              className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-emerald-950/70 hover:bg-emerald-800 text-emerald-300 font-bold text-xs sm:text-sm border border-emerald-500/40 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-md hover:scale-[1.02] active:scale-[0.98]"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            <div className="min-w-0 flex-1">
              <h1 className="text-sm sm:text-lg md:text-xl font-black text-white flex items-center gap-2 leading-tight truncate">
                <span className="truncate">{mediaTitle}</span>
                {isTv ? (
                  <span className="shrink-0 text-emerald-400 font-mono text-[10px] sm:text-xs bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1">
                    <Tv className="w-3 h-3" /> TV Series
                  </span>
                ) : (
                  <span className="shrink-0 text-emerald-400 font-mono text-[10px] sm:text-xs bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1">
                    <Film className="w-3 h-3" /> Movie
                  </span>
                )}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {media.vote_average ? (
              <div className="flex items-center gap-1 bg-black/60 border border-emerald-500/30 px-2.5 py-1 rounded-lg text-xs font-bold text-amber-400">
                <Star className="w-3.5 h-3.5 fill-amber-400" />
                <span>{media.vote_average.toFixed(1)}</span>
              </div>
            ) : null}
            {releaseYear ? (
              <span className="hidden sm:inline-flex items-center gap-1 text-xs text-zinc-400 font-mono bg-black/40 px-2 py-1 rounded-lg border border-zinc-800">
                <Calendar className="w-3 h-3 text-zinc-500" />
                {releaseYear}
              </span>
            ) : null}
          </div>
        </div>

        {/* ── Vidstuck Dedicated Cinema Video Player ── */}
        <div className="relative w-full aspect-video bg-black rounded-xl sm:rounded-3xl border border-emerald-500/40 shadow-[0_0_60px_rgba(16,185,129,0.25)] overflow-hidden">
          <iframe
            key={embedUrl}
            src={embedUrl}
            title={mediaTitle}
            className="w-full h-full border-0 rounded-xl sm:rounded-3xl"
            allowFullScreen
            // @ts-ignore
            mozallowfullscreen="true"
            webkitallowfullscreen="true"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>

        {/* ── Below-Player Info & Strain Sommelier ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
          {/* Left Column: Synopsis, Genres, Featured Cast (8 cols) */}
          <div className="lg:col-span-8 bg-[#0d1310] border border-emerald-500/20 rounded-2xl sm:rounded-3xl p-4 sm:p-6 space-y-5">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
              <Info className="w-4 h-4" />
              <span>Overview & Synopsis</span>
            </div>

            <p className="text-zinc-300 text-sm sm:text-base leading-relaxed">
              {media.overview || 'No synopsis available for this title.'}
            </p>

            {/* Genres list */}
            {media.genres && media.genres.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-emerald-950/60">
                <span className="text-zinc-400 text-xs font-bold block">Genres:</span>
                <div className="flex flex-wrap items-center gap-2">
                  {media.genres.map((g) => (
                    <span
                      key={g.id}
                      className="bg-emerald-950/70 border border-emerald-500/30 text-emerald-300 text-xs px-3 py-1 rounded-full font-medium"
                    >
                      {g.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Featured Cast */}
            {media.cast && media.cast.length > 0 && (
              <div className="space-y-3 pt-3 border-t border-emerald-950/60">
                <span className="text-white text-xs font-extrabold uppercase tracking-wider block">
                  Featured Cast
                </span>
                <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
                  {media.cast.slice(0, 10).map((c) => (
                    <div
                      key={c.id}
                      className="flex-shrink-0 w-24 sm:w-28 bg-black/50 border border-emerald-950/80 p-2 rounded-xl text-center"
                    >
                      <img
                        src={
                          c.profile_path
                            ? `https://image.tmdb.org/t/p/w185${c.profile_path}`
                            : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80'
                        }
                        alt={c.name}
                        className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover mx-auto mb-1.5 ring-1 ring-emerald-500/30"
                      />
                      <p className="font-bold text-[11px] text-white truncate">{c.name}</p>
                      <p className="text-[9px] text-zinc-400 truncate">{c.character}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Sommelier Strain Pairing Card (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-gradient-to-br from-emerald-950/90 via-[#0a140f] to-green-950/90 border border-emerald-500/30 p-4 sm:p-5 rounded-2xl sm:rounded-3xl space-y-3 shadow-xl">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <div className="flex items-center gap-1.5">
                  <Cannabis className="w-4 h-4 text-emerald-400 animate-pulse shrink-0" />
                  <span className="text-xs font-black text-emerald-300 uppercase tracking-wider">
                    Recommended Strain Pairing
                  </span>
                </div>
                {strainPairing.chill_vibe && (
                  <span className="text-[10px] font-bold text-emerald-300 bg-emerald-900/60 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                    ✨ {strainPairing.chill_vibe}
                  </span>
                )}
              </div>

              <div className="bg-black/50 border border-emerald-500/20 p-3 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm sm:text-base font-extrabold text-white">
                      {strainPairing.strain_name || strainPairing.strain_pairing}
                    </span>
                    {strainPairing.strain_type && (
                      <span className="text-[10px] font-mono font-bold text-amber-300 bg-amber-950/80 border border-amber-500/40 px-1.5 py-0.5 rounded">
                        {strainPairing.strain_type}
                      </span>
                    )}
                  </div>
                  {strainPairing.thc && (
                    <span className="text-[10px] font-black text-emerald-400 bg-emerald-950 border border-emerald-500/40 px-2 py-0.5 rounded-md">
                      ⚡ {strainPairing.thc.includes('THC') ? strainPairing.thc : `${strainPairing.thc} THC`}
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[10px] font-mono">
                    <span className="text-zinc-400">Couchlock Synergy Match</span>
                    <span className="text-amber-400 font-bold">{couchlockScore}%</span>
                  </div>
                  <div className="w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden border border-emerald-900/40">
                    <div
                      className="bg-gradient-to-r from-emerald-500 via-green-400 to-amber-400 h-full rounded-full transition-all duration-500"
                      style={{ width: `${couchlockScore}%` }}
                    />
                  </div>
                </div>
              </div>

              {(strainPairing.flavor || strainPairing.terpenes) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
                  {strainPairing.flavor && (
                    <div className="bg-black/40 border border-emerald-900/40 p-2.5 rounded-lg">
                      <span className="text-zinc-400 font-bold block text-[9px] uppercase">Flavor Profile</span>
                      <span className="text-emerald-200 font-medium block truncate">🍓 {strainPairing.flavor}</span>
                    </div>
                  )}
                  {strainPairing.terpenes && (
                    <div className="bg-black/40 border border-emerald-900/40 p-2.5 rounded-lg">
                      <span className="text-zinc-400 font-bold block text-[9px] uppercase">Terpene Spectrum</span>
                      <span className="text-emerald-300 font-mono block truncate">🧪 {strainPairing.terpenes}</span>
                    </div>
                  )}
                </div>
              )}

              {strainPairing.sommelier_note && (
                <div className="bg-black/40 p-3 rounded-xl border border-emerald-500/15">
                  <p className="text-[11px] text-zinc-300 leading-relaxed italic">
                    "{strainPairing.sommelier_note}"
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
