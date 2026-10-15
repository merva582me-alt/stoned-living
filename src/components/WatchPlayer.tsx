import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Cannabis 
} from 'lucide-react';
import { MediaItem, UserProfile } from '../types';
import { updateWatchHistory } from '../services/storage';

interface WatchPlayerProps {
  media: MediaItem;
  user?: UserProfile;
  isLoggedIn?: boolean;
  initialSeason?: number;
  initialEpisode?: number;
  onClose: () => void;
  onSelectMedia?: (item: MediaItem) => void;
  onUpdateUser?: (updated: UserProfile) => void;
}

const VIDCORE_SERVER = {
  id: 'vidcore',
  name: 'VidCore',
  getUrl: (id: number, isTv: boolean, s: number, e: number) =>
    isTv
      ? `https://vidcore.org/embed/tv/${id}/${s}/${e}?branding=STONED.LIVING&color=10b981&autoplay=true`
      : `https://vidcore.org/embed/movie/${id}?branding=STONED.LIVING&color=10b981&autoplay=true`,
};

export const WatchPlayer: React.FC<WatchPlayerProps> = ({
  media,
  user,
  isLoggedIn = false,
  initialSeason = 1,
  initialEpisode = 1,
  onClose,
  onUpdateUser,
}) => {
  const [season, setSeason] = useState(initialSeason);
  const [episode, setEpisode] = useState(initialEpisode);
  const [isLoading, setIsLoading] = useState(true);
  const [showSkip, setShowSkip] = useState(false);

  const isTv = media.media_type === 'tv' || Boolean(media.first_air_date);
  const streamUrl = VIDCORE_SERVER.getUrl(media.id, isTv, season, episode);

  const title = media.title || media.name || 'Untitled';
  const genres = media.genres?.map((g) => g.name).join(' / ') || (isTv ? 'SERIES' : 'CINEMA');

  const backdropUrl = media.backdrop_path
    ? (media.backdrop_path.startsWith('http') ? media.backdrop_path : `https://image.tmdb.org/t/p/original${media.backdrop_path}`)
    : media.poster_path
    ? (media.poster_path.startsWith('http') ? media.poster_path : `https://image.tmdb.org/t/p/original${media.poster_path}`)
    : '';

  const posterUrl = media.poster_path
    ? (media.poster_path.startsWith('http') ? media.poster_path : `https://image.tmdb.org/t/p/w500${media.poster_path}`)
    : backdropUrl;

  // Manage loading state when media or season/episode changes
  useEffect(() => {
    setIsLoading(true);
    setShowSkip(false);

    // Show skip button after 3.5 seconds
    const skipTimer = setTimeout(() => {
      setShowSkip(true);
    }, 3500);

    // Safety fallback: ensure player reveals if cross-origin iframe load event is suppressed
    const fallbackTimer = setTimeout(() => {
      setIsLoading(false);
    }, 7000);

    return () => {
      clearTimeout(skipTimer);
      clearTimeout(fallbackTimer);
    };
  }, [media.id, season, episode]);

  // Record playback session in user history (Only for logged-in authenticated users)
  useEffect(() => {
    if (!isLoggedIn) return;

    const updated = updateWatchHistory({
      mediaId: media.id,
      mediaType: isTv ? 'tv' : 'movie',
      title,
      posterPath: media.poster_path ? `https://image.tmdb.org/t/p/w500${media.poster_path}` : null,
      backdropPath: backdropUrl || null,
      season: isTv ? season : undefined,
      episode: isTv ? episode : undefined,
      progressSeconds: 120,
      durationSeconds: 7200,
      progressPercent: 5,
    });
    if (onUpdateUser) onUpdateUser(updated);
  }, [media.id, season, episode, isLoggedIn]);

  return (
    <div className="fixed inset-0 z-50 bg-[#050806] text-white flex flex-col overflow-hidden select-none">
      {/* ── Top Header Navigation Bar ── */}
      <header className="w-full px-4 sm:px-8 py-3.5 flex items-center justify-between bg-black/60 backdrop-blur-md border-b border-emerald-500/15 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 transition cursor-pointer text-xs font-bold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          {/* Stoned.living Brand Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-[#060c08] border-2 border-[#00df82] flex items-center justify-center shadow-[0_0_12px_rgba(0,223,130,0.35)] shrink-0">
              <Cannabis className="w-4 h-4 text-[#00df82]" />
            </div>
            <div className="hidden sm:flex flex-col text-left select-none">
              <span className="font-black text-xs tracking-tight leading-none">
                <span className="text-white">STONED</span>
                <span className="text-[#00df82]">.LIVING</span>
              </span>
              <span className="text-[6.5px] font-mono tracking-[0.14em] text-[#00df82] uppercase mt-0.5 font-semibold">
                HIGH DEFINITION STREAMING
              </span>
            </div>
          </div>

          <div className="h-4 w-px bg-zinc-800 hidden sm:block" />

          <div className="hidden sm:block">
            <h1 className="text-sm font-bold text-white truncate max-w-md">
              {title} {isTv && <span className="text-emerald-400 text-xs font-mono ml-1.5">S{season} E{episode}</span>}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Episode / Season Quick Switcher for TV */}
          {isTv && (
            <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-xl px-2 py-1 text-xs">
              <span className="text-zinc-500">Ep:</span>
              <button
                onClick={() => setEpisode(Math.max(1, episode - 1))}
                className="px-1.5 py-0.5 rounded hover:bg-zinc-800 text-zinc-300 font-bold"
              >
                -
              </button>
              <span className="font-mono text-emerald-400 font-bold px-1">{episode}</span>
              <button
                onClick={() => setEpisode(episode + 1)}
                className="px-1.5 py-0.5 rounded hover:bg-zinc-800 text-zinc-300 font-bold"
              >
                +
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── Center Stage: Theater Screen (Direct Embed) ── */}
      <main className="relative flex-1 w-full bg-black flex items-center justify-center overflow-hidden">
        {/* Backdrop Ambient Glow Behind Player */}
        {backdropUrl && (
          <div 
            className="absolute inset-0 bg-cover bg-center filter blur-3xl opacity-20 scale-110 pointer-events-none"
            style={{ backgroundImage: `url('${backdropUrl}')` }}
          />
        )}

        {/* Video Iframe Embed */}
        <iframe
          key={`vidcore-${media.id}-${isTv ? `${season}-${episode}` : 'movie'}`}
          src={streamUrl}
          title={title}
          allowFullScreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="no-referrer"
          onLoad={() => setIsLoading(false)}
          className="relative z-10 w-full h-full max-w-[1920px] border-0"
        />

        {/* ── Loading Screen Overlay ── */}
        <div
          className={`absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/92 backdrop-blur-xl transition-all duration-700 ease-out ${
            isLoading ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
        >
          {/* Ambient Blurred Backdrop */}
          {backdropUrl && (
            <div 
              className="absolute inset-0 bg-cover bg-center filter blur-2xl opacity-25 scale-110 pointer-events-none transition-transform duration-1000"
              style={{ backgroundImage: `url('${backdropUrl}')` }}
            />
          )}

          {/* Vignette Gradients */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-black/60 pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,223,130,0.08)_0%,transparent_75%)] pointer-events-none" />

          {/* Centered Content Card */}
          <div className="relative z-30 flex flex-col items-center text-center px-4 max-w-lg mx-auto select-none">
            {/* Poster Thumbnail */}
            {posterUrl && (
              <div className="w-24 h-36 sm:w-28 sm:h-42 rounded-2xl overflow-hidden shadow-[0_16px_40px_rgba(0,0,0,0.85),0_0_24px_rgba(0,223,130,0.18)] border border-emerald-500/25 mb-5 relative group">
                <img
                  src={posterUrl}
                  alt={title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
              </div>
            )}

            {/* Title Name */}
            <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight drop-shadow-md px-2 max-w-md line-clamp-2">
              {title}
            </h2>

            {/* Episode details if TV */}
            {isTv && (
              <div className="inline-flex items-center gap-2 mt-2 px-3 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-[#00df82] font-mono text-xs font-semibold tracking-wider uppercase">
                <span>Season {season}</span>
                <span className="w-1 h-1 rounded-full bg-[#00df82]/70" />
                <span>Episode {episode}</span>
              </div>
            )}

            {/* Connecting to server status line */}
            <div className="flex items-center justify-center gap-2 mt-5 text-zinc-300 font-mono text-sm sm:text-base font-semibold tracking-wide">
              <span className="w-2.5 h-2.5 rounded-full bg-[#00df82] animate-ping" />
              <span>Connecting to server</span>
              <span className="text-[#00df82] font-bold animate-pulse">_</span>
            </div>

            {/* Glowing Indeterminate Progress Bar */}
            <div className="w-56 sm:w-72 h-1.5 bg-zinc-800/90 rounded-full mt-4 overflow-hidden relative border border-zinc-700/40 shadow-inner">
              <div className="absolute inset-y-0 w-2/5 bg-gradient-to-r from-emerald-500 via-[#00df82] to-emerald-400 rounded-full animate-stream-shimmer shadow-[0_0_12px_rgba(0,223,130,0.9)]" />
            </div>

            {/* Optional Skip Loading / Force Reveal action */}
            {showSkip && (
              <button
                onClick={() => setIsLoading(false)}
                className="mt-6 text-xs font-mono text-zinc-500 hover:text-[#00df82] transition-colors uppercase tracking-wider underline underline-offset-4 cursor-pointer"
              >
                Skip loading
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
