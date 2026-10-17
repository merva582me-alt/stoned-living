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
import { fetchEpisodeDetails } from '../services/api';
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

export interface StreamServerNode {
  id: string;
  serverParam: string;
  name: string;
  badge: string;
  description: string;
}

export type VidCoreServer = StreamServerNode;

export const STREAM_SERVERS: StreamServerNode[] = [
  { id: 'atlas', serverParam: 'atlas', name: 'Atlas', badge: 'Fastest', description: 'Primary High-Speed Node' },
  { id: 'centaurus', serverParam: 'centaurus', name: 'Centaurus', badge: 'HD', description: 'High Bitrate 1080p' },
  { id: 'ursa', serverParam: 'meow', name: 'Ursa', badge: 'Ultra', description: 'Ultra Resilient Mirror' },
  { id: 'andromeda', serverParam: 'andromeda', name: 'Andromeda', badge: 'CDN', description: 'Global Edge Cache' },
  { id: 'orion', serverParam: 'orion', name: 'Orion', badge: 'Backup', description: 'Failover Relay' },
];

export const VIDCORE_SERVERS = STREAM_SERVERS;

function getStreamUrl(
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

const PREFERRED_SERVER_KEY = 'stoned_living_preferred_stream_node';

function getInitialServerIndex(): number {
  try {
    const saved = localStorage.getItem(PREFERRED_SERVER_KEY);
    if (saved) {
      const idx = STREAM_SERVERS.findIndex(s => s.id === saved || s.serverParam === saved);
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
  const currentServer = STREAM_SERVERS[serverIndex];
  const streamUrl = getStreamUrl(media.id, isTv, season, episode, currentServer.serverParam);

  const title = media.title || media.name || 'Untitled';
  const genres = media.genres?.map((g) => g.name).join(' / ') || (isTv ? 'SERIES' : 'CINEMA');

  // Baseline duration: 42 minutes (2520s) for TV episodes, 110 minutes (6600s) for movies
  const baselineDuration = isTv
    ? (media.episode_run_time?.[0] ? media.episode_run_time[0] * 60 : 2520)
    : (media.runtime ? media.runtime * 60 : 6600);

  const [detectedDuration, setDetectedDuration] = useState<number>(baselineDuration);
  const [episodeTitle, setEpisodeTitle] = useState<string>('');
  const [playbackSeconds, setPlaybackSeconds] = useState<number>(15);

  const backdropUrl = media.backdrop_path
    ? (media.backdrop_path.startsWith('http') ? media.backdrop_path : `https://image.tmdb.org/t/p/original${media.backdrop_path}`)
    : media.poster_path
    ? (media.poster_path.startsWith('http') ? media.poster_path : `https://image.tmdb.org/t/p/original${media.poster_path}`)
    : '';

  const posterUrl = media.poster_path
    ? (media.poster_path.startsWith('http') ? media.poster_path : `https://image.tmdb.org/t/p/w500${media.poster_path}`)
    : backdropUrl;

  // Next server in the rotation pool
  const nextServerIndex = (serverIndex + 1) % STREAM_SERVERS.length;
  const nextServer = STREAM_SERVERS[nextServerIndex];

  // Helper to persist user server preference
  const persistServerChoice = (idx: number) => {
    try {
      localStorage.setItem(PREFERRED_SERVER_KEY, STREAM_SERVERS[idx].id);
    } catch {}
  };

  // Fetch actual TMDb episode runtime and name for TV shows
  useEffect(() => {
    if (!isTv) return;
    let isCancelled = false;

    fetchEpisodeDetails(media.id, season, episode).then((details) => {
      if (isCancelled || !details) return;
      if (details.runtime && details.runtime > 0) {
        setDetectedDuration(details.runtime * 60);
      }
      if (details.name) {
        setEpisodeTitle(details.name);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [media.id, season, episode, isTv]);

  // Listen for iframe postMessage from embed (timeupdate, durationchange)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      try {
        const raw = event.data;
        const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!data || typeof data !== 'object') return;

        const duration = Number(data.duration || data.totalDuration || data.length);
        const currentTime = Number(data.currentTime || data.time || data.progress || data.seconds);

        if (!isNaN(duration) && duration > 60) {
          setDetectedDuration(Math.round(duration));
        }
        if (!isNaN(currentTime) && currentTime >= 0) {
          setPlaybackSeconds(Math.round(currentTime));
        }
      } catch (_) {}
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

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
          const currentId = STREAM_SERVERS[serverIndex].id;
          setStalledServerIds((prevList) => 
            prevList.includes(currentId) ? prevList : [...prevList, currentId]
          );

          // Auto switch to next server in pool
          const nextIdx = (serverIndex + 1) % STREAM_SERVERS.length;
          const target = STREAM_SERVERS[nextIdx];
          setServerIndex(nextIdx);
          persistServerChoice(nextIdx);

          toast.info(`Auto-switching to Node ${target.name}...`, {
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
    toast.success(`Connected to Node ${STREAM_SERVERS[index].name}`);
  };

  const handleNextServer = () => {
    const nextIdx = (serverIndex + 1) % STREAM_SERVERS.length;
    handleSelectServer(nextIdx);
  };

  // Record playback session and track active progress in user history
  useEffect(() => {
    if (!isLoggedIn) return;

    // Check if resuming from previous history
    const existing = user?.watchHistory?.find((h) => Number(h.mediaId) === Number(media.id));
    const isSameEp = existing && (!isTv || (existing.season === season && existing.episode === episode));
    const initialElapsed = isSameEp && existing.progressSeconds > 0 ? existing.progressSeconds : 15;
    setPlaybackSeconds(initialElapsed);

    const initialPct = Math.min(99, Math.max(1, Math.round((initialElapsed / detectedDuration) * 100)));
    const updated = updateWatchHistory({
      mediaId: media.id,
      mediaType: isTv ? 'tv' : 'movie',
      title,
      posterPath: media.poster_path ? `https://image.tmdb.org/t/p/w500${media.poster_path}` : null,
      backdropPath: backdropUrl || null,
      season: isTv ? (season || 1) : 1,
      episode: isTv ? (episode || 1) : 1,
      episodeTitle: episodeTitle || undefined,
      progressSeconds: initialElapsed,
      durationSeconds: detectedDuration,
      progressPercent: initialPct,
    });
    if (onUpdateUser) onUpdateUser(updated);

    // Increment watching progress every 15 seconds while actively streaming
    const progressTimer = setInterval(() => {
      if (isLoading) return;

      setPlaybackSeconds((prev) => {
        const next = Math.min(detectedDuration, prev + 15);
        const nextPct = Math.min(99, Math.max(1, Math.round((next / detectedDuration) * 100)));

        const syncUpdate = updateWatchHistory({
          mediaId: media.id,
          mediaType: isTv ? 'tv' : 'movie',
          title,
          posterPath: media.poster_path ? `https://image.tmdb.org/t/p/w500${media.poster_path}` : null,
          backdropPath: backdropUrl || null,
          season: isTv ? (season || 1) : 1,
          episode: isTv ? (episode || 1) : 1,
          episodeTitle: episodeTitle || undefined,
          progressSeconds: next,
          durationSeconds: detectedDuration,
          progressPercent: nextPct,
        });
        if (onUpdateUser) onUpdateUser(syncUpdate);
        return next;
      });
    }, 15000);

    return () => clearInterval(progressTimer);
  }, [media.id, season, episode, isLoggedIn, isTv, title, media.poster_path, backdropUrl, detectedDuration, episodeTitle]);

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
            <span>Node: {currentServer.name}</span>
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
          key={`stream-${currentServer.id}-${media.id}-${isTv ? `${season}-${episode}` : 'movie'}`}
          src={streamUrl}
          title={title}
          allowFullScreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
          onLoad={() => setIsLoading(false)}
          className="relative z-10 w-full h-full max-w-[1920px] border-0"
        />
      </main>

      {/* ── Permanently Visible Bottom Server Dock (Works on Mobile Portrait & Landscape) ── */}
      <footer className="w-full bg-[#060a08]/95 backdrop-blur-md border-t border-emerald-500/20 px-3 py-2 sm:px-6 sm:py-2.5 z-30 shrink-0 pb-[max(0.6rem,env(safe-area-inset-bottom))]">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2.5">
          {/* Server dock label & active status badge */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px] font-black uppercase tracking-wider text-zinc-300 hidden xs:inline">
                Nodes
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
            {STREAM_SERVERS.map((srv, idx) => {
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
