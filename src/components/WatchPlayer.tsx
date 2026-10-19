import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, 
  Cannabis, 
  Server, 
  RotateCw, 
  Zap, 
  ChevronRight,
  Play
} from 'lucide-react';
import { MediaItem, UserProfile } from '../types';
import { updateWatchHistory } from '../services/storage';
import { fetchEpisodeDetails } from '../services/api';
import { EpisodesModal } from './EpisodesModal';
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

// Default node is now URSA (index 0), followed by Atlas, Centaurus, Andromeda, and Orion
export const STREAM_SERVERS: StreamServerNode[] = [
  { id: 'ursa', serverParam: 'meow', name: 'Ursa', badge: 'Ultra', description: 'Ultra Resilient Mirror' },
  { id: 'atlas', serverParam: 'atlas', name: 'Atlas', badge: 'Fastest', description: 'Primary High-Speed Node' },
  { id: 'centaurus', serverParam: 'centaurus', name: 'Centaurus', badge: 'HD', description: 'High Bitrate 1080p' },
  { id: 'andromeda', serverParam: 'andromeda', name: 'Andromeda', badge: 'CDN', description: 'Global Edge Cache' },
  { id: 'orion', serverParam: 'orion', name: 'Orion', badge: 'Backup', description: 'Failover Relay' },
];

export const VIDCORE_SERVERS = STREAM_SERVERS;

const FAILOVER_TIMEOUT = 5; // 5 seconds before switching to next node

function getStreamUrl(
  mediaId: number, 
  isTv: boolean, 
  season: number, 
  episode: number, 
  serverParam: string,
  resumeSeconds: number = 0
): string {
  const base = isTv
    ? `https://stream-proxy.chronixx.workers.dev/embed/tv/${mediaId}/${season}/${episode}`
    : `https://stream-proxy.chronixx.workers.dev/embed/movie/${mediaId}`;
  const resumeParam = resumeSeconds > 10 ? `&t=${resumeSeconds}&start=${resumeSeconds}#t=${resumeSeconds}` : '';
  return `${base}?server=${serverParam}&branding=STONED.LIVING&color=10b981&autoplay=true${resumeParam}`;
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
  // Default to Ursa (index 0)
  return 0;
}

function formatPlaybackTime(sec: number): string {
  if (sec <= 0) return '0:00';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) {
    return `${h}h ${m < 10 ? '0' : ''}${m}m`;
  }
  return `${m}:${s < 10 ? '0' : ''}${s}`;
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
  const [failoverCountdown, setFailoverCountdown] = useState(FAILOVER_TIMEOUT);
  const [autoRotate, setAutoRotate] = useState(true);
  const [isEpisodesModalOpen, setIsEpisodesModalOpen] = useState(false);

  const isTv = media.media_type === 'tv' || Boolean(media.first_air_date);

  // Baseline duration: 42 minutes (2520s) for TV episodes, 110 minutes (6600s) for movies
  const baselineDuration = isTv
    ? (media.episode_run_time?.[0] ? media.episode_run_time[0] * 60 : 2520)
    : (media.runtime ? media.runtime * 60 : 6600);

  const [detectedDuration, setDetectedDuration] = useState<number>(baselineDuration);
  const [episodeTitle, setEpisodeTitle] = useState<string>('');

  // Find saved watch history to resume playback at last saved position
  const existingHistory = user?.watchHistory?.find((h) => Number(h.mediaId) === Number(media.id));
  const isSameEp = existingHistory && (!isTv || (Number(existingHistory.season) === Number(season) && Number(existingHistory.episode) === Number(episode)));
  const initialResumeSeconds = isSameEp && (existingHistory?.progressSeconds || 0) > 10 ? existingHistory.progressSeconds : 0;

  const [playbackSeconds, setPlaybackSeconds] = useState<number>(initialResumeSeconds);
  const playbackSecondsRef = useRef<number>(initialResumeSeconds);
  playbackSecondsRef.current = playbackSeconds;

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const hasShownResumeToastRef = useRef(false);

  const currentServer = STREAM_SERVERS[serverIndex];
  const streamUrl = getStreamUrl(media.id, isTv, season, episode, currentServer.serverParam, initialResumeSeconds);

  const title = media.title || media.name || 'Untitled';
  const backdropUrl = media.backdrop_path
    ? (media.backdrop_path.startsWith('http') ? media.backdrop_path : `https://image.tmdb.org/t/p/original${media.backdrop_path}`)
    : media.poster_path
    ? (media.poster_path.startsWith('http') ? media.poster_path : `https://image.tmdb.org/t/p/original${media.poster_path}`)
    : '';

  // Next server in the rotation pool
  const nextServerIndex = (serverIndex + 1) % STREAM_SERVERS.length;
  const nextServer = STREAM_SERVERS[nextServerIndex];

  // Helper to persist user server preference
  const persistServerChoice = (idx: number) => {
    try {
      localStorage.setItem(PREFERRED_SERVER_KEY, STREAM_SERVERS[idx].id);
    } catch {}
  };

  // Immediate watch history sync to ensure cloud persistence across browsers/devices
  const flushWatchHistory = (immediate = false) => {
    if (!isLoggedIn) return;
    const currentSec = playbackSecondsRef.current;
    if (currentSec <= 0) return;

    const currentPct = Math.min(99, Math.max(1, Math.round((currentSec / detectedDuration) * 100)));
    const updated = updateWatchHistory({
      mediaId: media.id,
      mediaType: isTv ? 'tv' : 'movie',
      title,
      posterPath: media.poster_path ? `https://image.tmdb.org/t/p/w500${media.poster_path}` : null,
      backdropPath: backdropUrl || null,
      season: isTv ? (season || 1) : 1,
      episode: isTv ? (episode || 1) : 1,
      episodeTitle: episodeTitle || undefined,
      progressSeconds: currentSec,
      durationSeconds: detectedDuration,
      progressPercent: currentPct,
    }, immediate);
    if (onUpdateUser) onUpdateUser(updated);
  };

  // Show Resume Notification Toast on initial load if resuming from prior progress
  useEffect(() => {
    if (initialResumeSeconds > 10 && !hasShownResumeToastRef.current) {
      hasShownResumeToastRef.current = true;
      toast.info(`Resuming playback at ${formatPlaybackTime(initialResumeSeconds)}`, {
        duration: 4500,
        action: {
          label: 'Start Over',
          onClick: () => {
            setPlaybackSeconds(0);
            playbackSecondsRef.current = 0;
            if (iframeRef.current?.contentWindow) {
              try {
                iframeRef.current.contentWindow.postMessage({ type: 'seek', time: 0 }, '*');
                iframeRef.current.contentWindow.postMessage({ type: 'setCurrentTime', value: 0 }, '*');
              } catch {}
            }
            if (isLoggedIn) {
              const updated = updateWatchHistory({
                mediaId: media.id,
                mediaType: isTv ? 'tv' : 'movie',
                title,
                posterPath: media.poster_path ? `https://image.tmdb.org/t/p/w500${media.poster_path}` : null,
                backdropPath: backdropUrl || null,
                season: isTv ? (season || 1) : 1,
                episode: isTv ? (episode || 1) : 1,
                episodeTitle: episodeTitle || undefined,
                progressSeconds: 0,
                durationSeconds: detectedDuration,
                progressPercent: 0,
              }, true);
              if (onUpdateUser) onUpdateUser(updated);
            }
            toast.success('Restarted playback from beginning');
          }
        }
      });
    }
  }, [initialResumeSeconds, isLoggedIn, media.id, isTv, season, episode, title, media.poster_path, backdropUrl, detectedDuration, episodeTitle, onUpdateUser]);

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

  // Listen for iframe postMessage from embed (timeupdate, durationchange, errors)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      try {
        const raw = event.data;
        const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!data || typeof data !== 'object') return;

        // Detect player errors and trigger instant failover
        const rawString = typeof raw === 'string' ? raw : JSON.stringify(raw);
        if (
          rawString.includes('MEDIA_ERR_SRC_NOT_SUPPORTED') ||
          rawString.includes('MEDIA_ERR_NETWORK') ||
          rawString.includes('html5_video:4') ||
          rawString.includes('224003')
        ) {
          if (autoRotate) {
            handleNextServer();
            return;
          }
        }

        const duration = Number(data.duration || data.totalDuration || data.length);
        const currentTime = Number(data.currentTime || data.time || data.progress || data.seconds);

        if (!isNaN(duration) && duration > 60) {
          setDetectedDuration(Math.round(duration));
        }
        if (!isNaN(currentTime) && currentTime >= 0) {
          const sec = Math.round(currentTime);
          setPlaybackSeconds(sec);
          playbackSecondsRef.current = sec;
          setIsLoading(false); // Live video is moving
        }
      } catch (_) {}
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [autoRotate]);

  // Reset loading state and countdown when server, media, or episode changes
  useEffect(() => {
    setIsLoading(true);
    setShowSkip(false);
    setFailoverCountdown(FAILOVER_TIMEOUT);

    // Show manual reveal / force play after 2.5 seconds
    const skipTimer = setTimeout(() => {
      setShowSkip(true);
    }, 2500);

    // Safety timeout: automatically dismiss overlay after 5 seconds if iframe loaded or stalled
    const safetyTimer = setTimeout(() => {
      setIsLoading(false);
    }, 5000);

    return () => {
      clearTimeout(skipTimer);
      clearTimeout(safetyTimer);
    };
  }, [media.id, season, episode, serverIndex]);

  // ── Node Rotator Watchdog: 5-second countdown to switch to next node if stalled ──
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
          return FAILOVER_TIMEOUT;
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
    setFailoverCountdown(FAILOVER_TIMEOUT);
    // Explicit manual selection pauses auto-rotate so user's choice is respected
    setAutoRotate(false);
    toast.success(`Connected to Node ${STREAM_SERVERS[index].name}`);
  };

  const handleNextServer = () => {
    const nextIdx = (serverIndex + 1) % STREAM_SERVERS.length;
    handleSelectServer(nextIdx);
  };

  // Periodic watch progress recording + flush on unmount / window unload
  useEffect(() => {
    if (!isLoggedIn) return;

    // Flush immediately when tab is refreshed or closed
    const handleBeforeUnload = () => {
      flushWatchHistory(true);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Periodic watch progress sync every 10 seconds
    const progressTimer = setInterval(() => {
      if (isLoading) return;
      flushWatchHistory(false);
    }, 10000);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      clearInterval(progressTimer);
      // Synchronous immediate flush on player close
      flushWatchHistory(true);
    };
  }, [media.id, season, episode, isLoggedIn, isTv, title, media.poster_path, backdropUrl, detectedDuration, episodeTitle]);

  const handleClosePlayer = () => {
    flushWatchHistory(true);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#050806] text-white flex flex-col overflow-hidden select-none">
      {/* ── Top Header Navigation Bar ── */}
      <header className="w-full px-3 sm:px-8 py-3 flex items-center justify-between bg-black/75 backdrop-blur-md border-b border-emerald-500/15 z-20 shrink-0">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <button
            onClick={handleClosePlayer}
            className="flex items-center gap-1.5 px-3 py-1.5 min-h-[40px] rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 transition cursor-pointer text-xs font-bold shrink-0"
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
          {/* Episode / Season Selector Button for TV */}
          {isTv && (
            <button
              type="button"
              onClick={() => setIsEpisodesModalOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 min-h-[40px] rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-white border border-zinc-800 hover:border-emerald-500/50 transition-all cursor-pointer shadow-sm group"
              title="Select season and episode"
            >
              <div className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                  <rect x="6" y="2" width="16" height="16" rx="2" fill="currentColor" fillOpacity="0.15" stroke="currentColor" />
                  <path d="M2 6v12a2 2 0 0 0 2 2h12" />
                  <polygon points="12 7 17 10 12 13 12 7" fill="currentColor" />
                </svg>
              </div>
              <span className="text-xs font-bold font-mono tracking-tight text-white group-hover:text-emerald-400 transition-colors">
                S{season} E{episode}
              </span>
            </button>
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
          ref={iframeRef}
          key={`stream-${currentServer.id}-${media.id}-${isTv ? `${season}-${episode}` : 'movie'}`}
          src={streamUrl}
          title={title}
          allowFullScreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
          onLoad={() => {
            setIsLoading(false);
            if (initialResumeSeconds > 10 && iframeRef.current?.contentWindow) {
              try {
                iframeRef.current.contentWindow.postMessage({ type: 'seek', time: initialResumeSeconds }, '*');
                iframeRef.current.contentWindow.postMessage({ type: 'setCurrentTime', value: initialResumeSeconds }, '*');
              } catch {}
            }
          }}
          className="relative z-10 w-full h-full max-w-[1920px] border-0"
        />

        {/* Connecting / Loading Overlay with Skip Button */}
        {isLoading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md transition-opacity duration-300">
            <div className="w-12 h-12 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin mb-4 shadow-[0_0_20px_rgba(0,223,130,0.3)]" />
            <h2 className="text-sm sm:text-base font-black tracking-wider text-emerald-400 font-mono">
              CONNECTING TO NODE {currentServer.name.toUpperCase()}...
            </h2>
            <p className="text-xs text-zinc-400 mt-1 font-mono text-center max-w-sm px-4">
              {autoRotate ? `Auto-switching in ${failoverCountdown}s if stream stalls...` : 'Connecting to mirror...'}
            </p>
            {showSkip && (
              <button
                type="button"
                onClick={() => setIsLoading(false)}
                className="mt-5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700 text-xs font-mono cursor-pointer transition"
              >
                Reveal Player
              </button>
            )}
          </div>
        )}
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
                  onClick={() => { setAutoRotate(true); setFailoverCountdown(FAILOVER_TIMEOUT); }}
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
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 min-h-[38px] rounded-xl text-xs transition-all cursor-pointer whitespace-nowrap shrink-0 ${
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
            className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 min-h-[38px] rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-emerald-400 text-xs font-bold transition cursor-pointer shrink-0"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Next Server</span>
          </button>
        </div>
      </footer>

      {/* Episodes Selection Modal */}
      {isTv && (
        <EpisodesModal
          isOpen={isEpisodesModalOpen}
          media={media}
          currentSeason={season}
          currentEpisode={episode}
          onSelectEpisode={(newSeason, newEpisode) => {
            setSeason(newSeason);
            setEpisode(newEpisode);
            setIsLoading(true);
            toast.success(`Now playing Season ${newSeason} · Episode ${newEpisode}`);
          }}
          onClose={() => setIsEpisodesModalOpen(false)}
        />
      )}
    </div>
  );
};
