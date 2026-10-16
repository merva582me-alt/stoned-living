import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, 
  Cannabis,
  Server,
  RotateCw,
  Zap,
  ChevronRight
} from 'lucide-react';
import { MediaItem, UserProfile } from '../types';
import { updateWatchHistory } from '../services/storage';
import { toast } from 'sonner';

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

export interface VidCoreServer {
  id: string;
  serverParam: string;
  name: string;
  badge: string;
  description: string;
}

export const VIDCORE_SERVERS: VidCoreServer[] = [
  { id: 'atlas', serverParam: 'atlas', name: 'Atlas', badge: 'Fastest', description: 'Primary High-Speed Node' },
  { id: 'centaurus', serverParam: 'centaurus', name: 'Centaurus', badge: 'HD', description: 'High Bitrate 1080p' },
  { id: 'ursa', serverParam: 'meow', name: 'Ursa', badge: 'Ultra', description: 'Ultra Resilient Mirror' },
  { id: 'andromeda', serverParam: 'andromeda', name: 'Andromeda', badge: 'CDN', description: 'Global Edge Cache' },
  { id: 'orion', serverParam: 'orion', name: 'Orion', badge: 'Backup', description: 'Failover Relay' },
];

function getVidCoreStreamUrl(
  mediaId: number, 
  isTv: boolean, 
  season: number, 
  episode: number, 
  serverParam: string
): string {
  const base = isTv
    ? `https://stream-proxy.chronixx.workers.dev/embed/tv/${mediaId}/${season}/${episode}`
    : `https://stream-proxy.chronixx.workers.dev/embed/movie/${mediaId}`;
  return `${base}?server=${serverParam}&branding=STONED.LIVING&color=10b981&autoplay=true`;
}

const PREFERRED_SERVER_KEY = 'stoned_living_preferred_vidcore_server';

function getInitialServerIndex(): number {
  try {
    const saved = localStorage.getItem(PREFERRED_SERVER_KEY);
    if (saved) {
      const idx = VIDCORE_SERVERS.findIndex(s => s.id === saved || s.serverParam === saved);
      if (idx !== -1) return idx;
    }
  } catch {}
  return 0;
}

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
  const [serverIndex, setServerIndex] = useState<number>(getInitialServerIndex);
  const [stalledServerIds, setStalledServerIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showSkip, setShowSkip] = useState(false);
  const [failoverCountdown, setFailoverCountdown] = useState(7);
  const [autoRotate, setAutoRotate] = useState(true);

  const isTv = media.media_type === 'tv' || Boolean(media.first_air_date);
  const currentServer = VIDCORE_SERVERS[serverIndex];
  const streamUrl = getVidCoreStreamUrl(media.id, isTv, season, episode, currentServer.serverParam);

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

  // Next server in the rotation pool
  const nextServerIndex = (serverIndex + 1) % VIDCORE_SERVERS.length;
  const nextServer = VIDCORE_SERVERS[nextServerIndex];

  // Helper to persist user server preference
  const persistServerChoice = (idx: number) => {
    try {
      localStorage.setItem(PREFERRED_SERVER_KEY, VIDCORE_SERVERS[idx].id);
    } catch {}
  };

  // Reset loading state and countdown when server, media, or episode changes
  useEffect(() => {
    setIsLoading(true);
    setShowSkip(false);
    setFailoverCountdown(7);

    // Show manual reveal / force play after 3 seconds
    const skipTimer = setTimeout(() => {
      setShowSkip(true);
    }, 3000);

    // Safety timeout: automatically dismiss overlay after 5 seconds if iframe loaded or stalled
    const safetyTimer = setTimeout(() => {
      setIsLoading(false);
    }, 5200);

    return () => {
      clearTimeout(skipTimer);
      clearTimeout(safetyTimer);
    };
  }, [media.id, season, episode, serverIndex]);

  // ── Intelligent Auto-Switch Watchdog (Runs ONLY while stream is connecting / loading) ──
  // CRITICAL: Once the stream has loaded (isLoading === false), stop auto-switching so user is never interrupted
  useEffect(() => {
    if (!autoRotate || !isLoading) return;

    const interval = setInterval(() => {
      setFailoverCountdown((prev) => {
        if (prev <= 1) {
          // Record current server as stalled in this session
          const currentId = VIDCORE_SERVERS[serverIndex].id;
          setStalledServerIds((prevList) => 
            prevList.includes(currentId) ? prevList : [...prevList, currentId]
          );

          // Auto switch to next server in pool
          const nextIdx = (serverIndex + 1) % VIDCORE_SERVERS.length;
          const target = VIDCORE_SERVERS[nextIdx];
          setServerIndex(nextIdx);
          persistServerChoice(nextIdx);

          toast.info(`Auto-switching to VidCore ${target.name}...`, {
            duration: 2500,
          });
          return 7;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [autoRotate, isLoading, serverIndex]);

  // Manual server selection handler
  const handleSelectServer = (index: number) => {
    setServerIndex(index);
    persistServerChoice(index);
    setIsLoading(true);
    setFailoverCountdown(7);
    // Explicit manual selection pauses auto-rotate so user's choice is respected
    setAutoRotate(false);
    toast.success(`Connected to VidCore ${VIDCORE_SERVERS[index].name}`);
  };

  const handleNextServer = () => {
    const nextIdx = (serverIndex + 1) % VIDCORE_SERVERS.length;
    handleSelectServer(nextIdx);
  };

  // Record playback session in user history (Only for logged-in authenticated users)
  useEffect(() => {
    if (!isLoggedIn) return;

    const updated = updateWatchHistory({
      mediaId: media.id,
      mediaType: isTv ? 'tv' : 'movie',
      title,
      posterPath: media.poster_path ? `https://image.tmdb.org/t/p/w500${media.poster_path}` : null,
      backdropPath: backdropUrl || null,
      season: isTv ? (season || 1) : 1,
      episode: isTv ? (episode || 1) : 1,
      progressSeconds: 120,
      durationSeconds: 7200,
      progressPercent: 5,
    });
    if (onUpdateUser) onUpdateUser(updated);
  }, [media.id, season, episode, isLoggedIn, isTv, title, media.poster_path, backdropUrl]);

  return (
    <div className="fixed inset-0 z-50 bg-[#050806] text-white flex flex-col overflow-hidden select-none">
      {/* ── Top Header Navigation Bar ── */}
      <header className="w-full px-3 sm:px-8 py-3 flex items-center justify-between bg-black/75 backdrop-blur-md border-b border-emerald-500/15 z-20 shrink-0">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 transition cursor-pointer text-xs font-bold shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden xs:inline">Back</span>
          </button>

          {/* Stoned.living Brand Logo */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-xl bg-[#060c08] border-2 border-[#00df82] flex items-center justify-center shadow-[0_0_12px_rgba(0,223,130,0.35)] shrink-0">
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

          <div className="h-4 w-px bg-zinc-800 hidden md:block shrink-0" />

          {/* Title & Episode info */}
          <div className="min-w-0 truncate">
            <h1 className="text-xs sm:text-sm font-bold text-white truncate max-w-xs sm:max-w-md">
              {title} {isTv && <span className="text-emerald-400 text-xs font-mono ml-1">S{season} E{episode}</span>}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Episode / Season Quick Switcher for TV */}
          {isTv && (
            <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl px-2 py-1 text-xs">
              <span className="text-zinc-500 text-[11px] hidden xs:inline">Ep:</span>
              <button
                onClick={() => setEpisode(Math.max(1, episode - 1))}
                className="w-5 h-5 flex items-center justify-center rounded hover:bg-zinc-800 text-zinc-300 font-bold"
                title="Previous episode"
              >
                -
              </button>
              <span className="font-mono text-emerald-400 font-bold px-1 text-xs">{episode}</span>
              <button
                onClick={() => setEpisode(episode + 1)}
                className="w-5 h-5 flex items-center justify-center rounded hover:bg-zinc-800 text-zinc-300 font-bold"
                title="Next episode"
              >
                +
              </button>
            </div>
          )}

          {/* Active Server Badge (Header preview) */}
          <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-950/40 border border-emerald-500/20 text-[#00df82] text-xs font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00df82] animate-pulse" />
            <span>VidCore {currentServer.name}</span>
          </div>
        </div>
      </header>

      {/* ── Center Stage: Theater Screen (Direct Embed) ── */}
      <main className="relative flex-1 min-h-0 w-full bg-black flex items-center justify-center overflow-hidden">
        {/* Backdrop Ambient Glow Behind Player */}
        {backdropUrl && (
          <div 
            className="absolute inset-0 bg-cover bg-center filter blur-3xl opacity-20 scale-110 pointer-events-none"
            style={{ backgroundImage: `url('${backdropUrl}')` }}
          />
        )}

        {/* Video Iframe Embed */}
        <iframe
          key={`vidcore-${currentServer.id}-${media.id}-${isTv ? `${season}-${episode}` : 'movie'}`}
          src={streamUrl}
          title={title}
          allowFullScreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="no-referrer"
          onLoad={() => setIsLoading(false)}
          className="relative z-10 w-full h-full max-w-[1920px] border-0"
        />

        {/* ── Loading & Connecting Screen Overlay ── */}
        <div
          className={`absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/92 backdrop-blur-xl transition-all duration-500 ease-out ${
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
              <div className="w-20 h-28 sm:w-28 sm:h-42 rounded-2xl overflow-hidden shadow-[0_16px_40px_rgba(0,0,0,0.85),0_0_24px_rgba(0,223,130,0.18)] border border-emerald-500/25 mb-4 relative group">
                <img
                  src={posterUrl}
                  alt={title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
              </div>
            )}

            {/* Title Name */}
            <h2 className="text-lg sm:text-2xl md:text-3xl font-black text-white tracking-tight drop-shadow-md px-2 max-w-md line-clamp-2">
              {title}
            </h2>

            {/* Episode details if TV */}
            {isTv && (
              <div className="inline-flex items-center gap-2 mt-1.5 px-3 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-[#00df82] font-mono text-xs font-semibold tracking-wider uppercase">
                <span>Season {season}</span>
                <span className="w-1 h-1 rounded-full bg-[#00df82]/70" />
                <span>Episode {episode}</span>
              </div>
            )}

            {/* Connecting to server status line */}
            <div className="flex items-center justify-center gap-2 mt-4 text-zinc-300 font-mono text-xs sm:text-sm font-semibold tracking-wide">
              <span className="w-2 h-2 rounded-full bg-[#00df82] animate-ping" />
              <span>Connecting to VidCore</span>
              <span className="text-[#00df82] font-bold">{currentServer.name}</span>
            </div>

            {/* Auto-rotation failover notice */}
            <p className="text-[11px] text-zinc-400 mt-1 font-mono">
              Auto-rotating in <span className="text-[#00df82] font-bold tabular-nums">{failoverCountdown}s</span> if stalled
            </p>

            {/* Glowing Indeterminate Progress Bar */}
            <div className="w-48 sm:w-64 h-1.5 bg-zinc-800/90 rounded-full mt-3 overflow-hidden relative border border-zinc-700/40 shadow-inner">
              <div className="absolute inset-y-0 w-2/5 bg-gradient-to-r from-emerald-500 via-[#00df82] to-emerald-400 rounded-full animate-stream-shimmer shadow-[0_0_12px_rgba(0,223,130,0.9)]" />
            </div>

            {/* Direct 1-Click Server Switch Pills right inside the Connecting Overlay */}
            <div className="mt-4 flex flex-col items-center gap-1.5 w-full">
              <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-400">
                Switch Server Instantly:
              </span>
              <div className="flex flex-wrap items-center justify-center gap-1.5 max-w-sm">
                {VIDCORE_SERVERS.map((srv, idx) => {
                  const isCurrent = idx === serverIndex;
                  const wasStalled = stalledServerIds.includes(srv.id);
                  return (
                    <button
                      key={`connecting-${srv.id}`}
                      type="button"
                      onClick={() => handleSelectServer(idx)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        isCurrent
                          ? 'bg-emerald-500 text-black shadow-[0_0_14px_rgba(0,223,130,0.5)] scale-105'
                          : wasStalled
                          ? 'bg-zinc-900/90 text-amber-300 border border-amber-500/30 hover:border-amber-400'
                          : 'bg-zinc-900/90 text-zinc-300 hover:text-white border border-zinc-800 hover:border-emerald-500/50'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${isCurrent ? 'bg-black' : wasStalled ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                      <span>{srv.name}</span>
                      {wasStalled && <span className="text-[9px] text-amber-400 font-mono">(Slow)</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Action buttons inside connecting modal */}
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={handleNextServer}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-[#00df82] border border-emerald-500/40 text-xs font-bold transition cursor-pointer"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Next Server ({nextServer.name})</span>
              </button>

              {showSkip && (
                <button
                  onClick={() => setIsLoading(false)}
                  className="px-3.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold transition cursor-pointer"
                >
                  Reveal Player
                </button>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* ── Permanently Visible Bottom Server Dock (Works on Mobile Portrait & Landscape) ── */}
      <footer className="w-full bg-[#060a08]/95 backdrop-blur-md border-t border-emerald-500/20 px-3 py-2 sm:px-6 sm:py-2.5 z-30 shrink-0 pb-[max(0.6rem,env(safe-area-inset-bottom))]">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2.5">
          {/* Server dock label & active status badge */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px] font-black uppercase tracking-wider text-zinc-300 hidden xs:inline">
                Servers
              </span>
            </div>
            {isLoading ? (
              autoRotate ? (
                <button
                  type="button"
                  onClick={() => setAutoRotate(false)}
                  className="text-[10px] font-mono text-emerald-400 bg-emerald-950/70 border border-emerald-500/40 px-1.5 py-0.5 rounded-md flex items-center gap-1 cursor-pointer hover:bg-emerald-900/60"
                  title="Connecting... Click to pause auto-rotation"
                >
                  <RotateCw className="w-2.5 h-2.5 animate-spin text-emerald-400" />
                  <span className="tabular-nums font-bold">{failoverCountdown}s</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => { setAutoRotate(true); setFailoverCountdown(7); }}
                  className="text-[10px] font-mono text-zinc-400 bg-zinc-900 border border-zinc-700 px-1.5 py-0.5 rounded-md flex items-center gap-1 cursor-pointer hover:text-white"
                  title="Click to resume auto-rotation while connecting"
                >
                  <span>Auto: Off</span>
                </button>
              )
            ) : (
              <div className="text-[10px] font-mono text-emerald-400 bg-emerald-950/50 border border-emerald-500/30 px-1.5 py-0.5 rounded-md flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00df82] animate-pulse" />
                <span>Live</span>
              </div>
            )}
          </div>

          {/* Horizontally Scrollable Server Selector Pills (Always accessible on mobile) */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar scroll-smooth py-0.5 px-0.5 flex-1 justify-center sm:justify-start max-w-full">
            {VIDCORE_SERVERS.map((srv, idx) => {
              const isActive = idx === serverIndex;
              const wasStalled = stalledServerIds.includes(srv.id);
              return (
                <button
                  key={srv.id}
                  onClick={() => handleSelectServer(idx)}
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-emerald-500/25 text-[#00df82] border border-emerald-400 font-black shadow-[0_0_12px_rgba(0,223,130,0.35)] scale-[1.02]'
                      : wasStalled
                      ? 'bg-zinc-900/90 text-amber-300 border border-amber-500/30 hover:border-amber-400 font-semibold'
                      : 'bg-zinc-900/90 text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-700 font-semibold'
                  }`}
                  aria-pressed={isActive}
                  title={`${srv.name} — ${srv.description}${wasStalled ? ' (reported slow)' : ''}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-[#00df82] animate-pulse' : wasStalled ? 'bg-amber-400' : 'bg-zinc-600'}`} />
                  <span>{srv.name}</span>
                  <span className={`text-[9px] font-mono px-1 py-0.2 rounded hidden sm:inline ${
                    isActive ? 'bg-emerald-400/25 text-emerald-200' : wasStalled ? 'bg-amber-950/60 text-amber-300' : 'bg-zinc-800 text-zinc-500'
                  }`}>
                    {srv.badge}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Next Server Quick Switch Button */}
          <button
            onClick={handleNextServer}
            title={`Next Server (${nextServer.name})`}
            className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-emerald-400 text-xs font-bold transition cursor-pointer shrink-0"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Next Server</span>
          </button>
        </div>
      </footer>
    </div>
  );
};
