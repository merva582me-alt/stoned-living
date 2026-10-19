import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Cannabis,
  Radio,
  AlertCircle,
  RefreshCw,
  RotateCw,
  ShieldCheck,
  Settings,
  Layers,
} from 'lucide-react';
import { APIMatch, StreamedStream, ResolvedStreamInfo } from '../types';
import {
  fetchAllMatchStreams,
  getTeamBadgeUrl,
  getMatchPosterUrl,
} from '../services/sportsApi';
import { resolveSportStream } from '../services/sportsStreamResolver';
import { HlsSportsVideoPlayer } from './HlsSportsVideoPlayer';
import { ResolverConfigModal } from './ResolverConfigModal';
import { toast } from 'sonner';

interface SportsWatchPlayerProps {
  match: APIMatch;
  onClose: () => void;
}

export const SportsWatchPlayer: React.FC<SportsWatchPlayerProps> = ({
  match,
  onClose,
}) => {
  const [streams, setStreams] = useState<StreamedStream[]>([]);
  const [activeStreamIndex, setActiveStreamIndex] = useState(0);
  const [loadingStreams, setLoadingStreams] = useState(true);
  const [isLoadingEmbed, setIsLoadingEmbed] = useState(true);
  const [showSkip, setShowSkip] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Direct HLS stream resolver state
  const [resolvedStream, setResolvedStream] = useState<ResolvedStreamInfo | null>(null);
  const [isResolvingHls, setIsResolvingHls] = useState(false);
  const [playerMode, setPlayerMode] = useState<'hls' | 'embed'>('hls');
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  const homeBadge = getTeamBadgeUrl(match.teams?.home?.badge);
  const awayBadge = getTeamBadgeUrl(match.teams?.away?.badge);
  const posterUrl = getMatchPosterUrl(match.poster);

  // Load and combine all available feeds across all sources
  const loadStreams = useCallback(async () => {
    setLoadingStreams(true);
    setFetchError(null);

    if (!match.sources || match.sources.length === 0) {
      setLoadingStreams(false);
      setFetchError('No broadcast sources found for this match yet.');
      return;
    }

    try {
      const aggregated = await fetchAllMatchStreams(match.sources);

      if (aggregated && aggregated.length > 0) {
        // Sort streams: HD first, then by stream number
        const sorted = [...aggregated].sort((a, b) => {
          if (a.hd && !b.hd) return -1;
          if (!a.hd && b.hd) return 1;
          return (a.streamNo || 1) - (b.streamNo || 1);
        });

        setStreams(sorted);
        setActiveStreamIndex(0);
      } else {
        setStreams([]);
        setFetchError('Live streams will be available 15 minutes before kickoff.');
      }
    } catch {
      setFetchError('Could not connect to broadcast network. Please try refreshing.');
    } finally {
      setLoadingStreams(false);
    }
  }, [match.sources]);

  useEffect(() => {
    loadStreams();
  }, [loadStreams]);

  const activeStream = streams[activeStreamIndex];
  const nextStreamIndex = (activeStreamIndex + 1) % (streams.length || 1);
  const nextStream = streams[nextStreamIndex];

  // Resolve direct HLS stream for current active stream
  const resolveCurrentStream = useCallback(async (stream: StreamedStream | undefined, forceFresh = false) => {
    if (!stream) {
      setResolvedStream(null);
      return;
    }

    setIsResolvingHls(true);
    try {
      const res = await resolveSportStream(stream, { forceFresh });
      setResolvedStream(res);

      if (res.isDirectHls && res.streamUrl) {
        setPlayerMode('hls');
        setIsLoadingEmbed(false);
      } else {
        setPlayerMode('embed');
      }
    } catch (err) {
      console.warn('[SportsWatchPlayer] Stream resolution failed:', err);
      setPlayerMode('embed');
    } finally {
      setIsResolvingHls(false);
    }
  }, []);

  useEffect(() => {
    if (activeStream) {
      resolveCurrentStream(activeStream);
    }
  }, [activeStream, resolveCurrentStream]);

  // Switch to next feed helper
  const handleNextFeed = useCallback(() => {
    if (streams.length <= 1) return;
    const nextIndex = (activeStreamIndex + 1) % streams.length;
    setActiveStreamIndex(nextIndex);
    setIsLoadingEmbed(true);
    toast.info(`Switched to Feed ${nextIndex + 1} (${streams[nextIndex]?.source || 'Source'})`);
  }, [streams, activeStreamIndex]);

  // Listen for iframe media errors and auto-switch when in embed mode
  useEffect(() => {
    if (playerMode !== 'embed') return;

    const handleMessage = (e: MessageEvent) => {
      try {
        const raw = typeof e.data === 'string' ? e.data : JSON.stringify(e.data);
        if (
          raw.includes('html5_video:4') ||
          raw.includes('224003') ||
          raw.includes('MEDIA_ERR_SRC_NOT_SUPPORTED') ||
          raw.includes('MEDIA_ERR_NETWORK')
        ) {
          console.warn('[SportsWatchPlayer] Stream playback error detected from embed:', raw);
          if (streams.length > 1) {
            handleNextFeed();
          }
        }
      } catch {
        // Ignore non-stringifiable messages
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [streams.length, handleNextFeed, playerMode]);

  // Manage embed loading overlay
  useEffect(() => {
    if (playerMode !== 'embed') {
      setIsLoadingEmbed(false);
      return;
    }

    setIsLoadingEmbed(true);
    setShowSkip(false);

    const skipTimer = setTimeout(() => {
      setShowSkip(true);
    }, 2500);

    const fallbackTimer = setTimeout(() => {
      setIsLoadingEmbed(false);
    }, 5000);

    return () => {
      clearTimeout(skipTimer);
      clearTimeout(fallbackTimer);
    };
  }, [activeStreamIndex, streams, playerMode]);

  return (
    <div className="fixed inset-0 z-50 bg-[#050806] text-white flex flex-col overflow-hidden select-none">
      {/* ── Top Header Navigation Bar (Identical to Cinema Player) ── */}
      <header className="w-full px-3 sm:px-8 py-3 flex items-center justify-between bg-black/75 backdrop-blur-md border-b border-emerald-500/15 z-20 shrink-0">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 min-h-[40px] rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 transition cursor-pointer text-xs font-bold shrink-0"
            aria-label="Back to Sports"
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
                LIVE SPORTS ARENA
              </span>
            </div>
          </div>

          <div className="h-4 w-px bg-zinc-800 hidden md:block shrink-0" />

          {/* Match Title & Category */}
          <div className="min-w-0 truncate">
            <h1 className="text-xs sm:text-sm font-bold text-white truncate max-w-xs sm:max-w-md">
              {match.title}
              <span className="text-emerald-400 text-xs font-mono ml-2 uppercase hidden xs:inline">
                [{match.category}]
              </span>
            </h1>
          </div>
        </div>

        {/* Right Status Controls & Resolver Settings */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {/* Ad-Stripped HLS vs Embed Indicator */}
          {resolvedStream?.isDirectHls && playerMode === 'hls' ? (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-950/60 border border-emerald-500/35 text-emerald-400 text-xs font-mono shadow-[0_0_10px_rgba(16,185,129,0.2)]"
              title="Streaming direct HLS feed with 100% of ads and popups stripped"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline font-semibold">Ad-Stripped HLS</span>
              <span className="sm:hidden font-semibold">HLS Direct</span>
            </div>
          ) : (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 text-xs font-mono"
              title="Playing broadcast mirror via embed"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span className="hidden sm:inline">Embed Mirror</span>
              <span className="sm:hidden">Embed</span>
            </div>
          )}

          {/* Switch Mode Toggle (if HLS stream is available) */}
          {resolvedStream?.isDirectHls && (
            <button
              onClick={() => {
                const nextMode = playerMode === 'hls' ? 'embed' : 'hls';
                setPlayerMode(nextMode);
                toast.info(`Switched to ${nextMode === 'hls' ? 'Ad-Free HLS' : 'Embed Mirror'}`);
              }}
              title={playerMode === 'hls' ? 'Switch to embed player' : 'Switch to ad-stripped HLS player'}
              className="flex items-center gap-1 px-2.5 py-1 min-h-[32px] rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 text-xs font-mono transition cursor-pointer"
            >
              <Layers className="w-3 h-3 text-emerald-400" />
              <span className="hidden md:inline">
                {playerMode === 'hls' ? 'Use Embed' : 'Use HLS'}
              </span>
            </button>
          )}

          {/* Stream Resolver Microservice Configuration Modal Trigger */}
          <button
            onClick={() => setIsConfigModalOpen(true)}
            title="Configure streamed-pk-resolver microservice"
            className="flex items-center gap-1 px-2.5 py-1.5 min-h-[32px] rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-emerald-500/40 text-zinc-300 hover:text-emerald-400 text-xs font-mono transition cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Resolver</span>
          </button>
        </div>
      </header>

      {/* ── Center Stage: Live Screen (HLS Player or Fallback Embed) ── */}
      <main className="relative flex-1 min-h-0 w-full bg-black flex items-center justify-center overflow-hidden">
        {/* Ambient Backdrop Glow */}
        {posterUrl && (
          <div
            className="absolute inset-0 bg-cover bg-center filter blur-3xl opacity-20 scale-110 pointer-events-none"
            style={{ backgroundImage: `url('${posterUrl}')` }}
          />
        )}

        {/* Video Player Display */}
        {activeStream ? (
          playerMode === 'hls' && resolvedStream?.isDirectHls && resolvedStream.streamUrl ? (
            /* Custom Native HLS Video Player (100% Ad & Popup Stripped) */
            <HlsSportsVideoPlayer
              key={`hls-${activeStream.source}-${activeStream.streamNo || activeStreamIndex}-${resolvedStream.streamUrl}`}
              streamUrl={resolvedStream.streamUrl}
              title={match.title}
              posterUrl={posterUrl}
              onPlaybackError={(err) => {
                console.warn('[SportsWatchPlayer] HLS stream error:', err);
              }}
              onSwitchToEmbed={() => setPlayerMode('embed')}
            />
          ) : (
            /* Fallback Embed Player */
            <iframe
              key={`stream-${activeStream.source}-${activeStream.streamNo || activeStreamIndex}-${activeStream.embedUrl}`}
              src={activeStream.embedUrl}
              title={match.title}
              allowFullScreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
              onLoad={() => setIsLoadingEmbed(false)}
              className="relative z-10 w-full h-full max-w-[1920px] border-0"
            />
          )
        ) : fetchError ? (
          <div className="relative z-20 flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-4 text-amber-400">
              <AlertCircle className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-white mb-2 font-mono">
              BROADCAST UNAVAILABLE
            </h3>
            <p className="text-xs text-zinc-400 mb-6 font-mono leading-relaxed">
              {fetchError}
            </p>
            <button
              onClick={loadStreams}
              disabled={loadingStreams}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs transition cursor-pointer shadow-[0_0_15px_rgba(0,223,130,0.3)] disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingStreams ? 'animate-spin' : ''}`} />
              <span>Retry Connection</span>
            </button>
          </div>
        ) : null}

        {/* Connecting / Loading Overlay with Skip Button (for embed mode) */}
        {playerMode === 'embed' && (isLoadingEmbed || loadingStreams || isResolvingHls) && !fetchError && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md transition-opacity duration-300">
            {/* Team Badges or Match Poster */}
            {homeBadge && awayBadge ? (
              <div className="flex items-center justify-center gap-5 mb-5">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-zinc-900/90 border border-emerald-500/25 p-2 flex items-center justify-center shadow-lg">
                  <img src={homeBadge} alt={match.teams?.home?.name || 'Home'} className="w-full h-full object-contain" />
                </div>
                <span className="text-zinc-500 font-black text-xs tracking-widest font-mono">VS</span>
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-zinc-900/90 border border-emerald-500/25 p-2 flex items-center justify-center shadow-lg">
                  <img src={awayBadge} alt={match.teams?.away?.name || 'Away'} className="w-full h-full object-contain" />
                </div>
              </div>
            ) : null}

            <div className="w-10 h-10 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin mb-3 shadow-[0_0_20px_rgba(0,223,130,0.3)]" />
            <h2 className="text-xs sm:text-sm font-black tracking-wider text-emerald-400 font-mono text-center px-4">
              CONNECTING TO LIVE FEED {activeStreamIndex + 1}...
            </h2>
            <p className="text-[11px] text-zinc-400 mt-1 font-mono text-center max-w-sm px-4">
              Synchronizing high-definition broadcast mirror...
            </p>

            {showSkip && (
              <button
                type="button"
                onClick={() => setIsLoadingEmbed(false)}
                className="mt-4 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700 text-xs font-mono cursor-pointer transition"
              >
                Reveal Player
              </button>
            )}
          </div>
        )}
      </main>

      {/* ── Permanently Visible Bottom Feed Dock (Identical to Movies & TV Players) ── */}
      <footer className="w-full bg-[#060a08]/95 backdrop-blur-md border-t border-emerald-500/20 px-3 py-2 sm:px-6 sm:py-2.5 z-30 shrink-0 pb-[max(0.6rem,env(safe-area-inset-bottom))]">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2.5">
          {/* Feed dock label & status */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px] font-black uppercase tracking-wider text-zinc-300 hidden xs:inline">
                Feeds
              </span>
            </div>
            {isResolvingHls || loadingStreams ? (
              <div className="text-[10px] font-mono text-emerald-400 bg-emerald-950/70 border border-emerald-500/40 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                <RotateCw className="w-2.5 h-2.5 animate-spin text-emerald-400" />
                <span className="tabular-nums font-bold">Connecting</span>
              </div>
            ) : (
              <div className="text-[10px] font-mono text-emerald-400 bg-emerald-950/50 border border-emerald-500/30 px-1.5 py-0.5 rounded-md flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00df82] animate-pulse" />
                <span>Live</span>
              </div>
            )}
          </div>

          {/* Horizontally Scrollable Feed Selector Pills (Matching Cinema Nodes) */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar scroll-smooth py-0.5 px-0.5 flex-1 justify-center sm:justify-start max-w-full">
            {streams.map((st, idx) => {
              const isActive = idx === activeStreamIndex;
              const isHD = Boolean(st.hd);
              return (
                <button
                  key={`${st.source}-${st.streamNo || idx}-${idx}`}
                  onClick={() => {
                    setActiveStreamIndex(idx);
                    setIsLoadingEmbed(true);
                    toast.success(`Switched to Feed ${idx + 1} (${st.source})`);
                  }}
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 min-h-[38px] rounded-xl text-xs transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-emerald-500/25 text-[#00df82] border border-emerald-400 font-black shadow-[0_0_12px_rgba(0,223,130,0.35)] scale-[1.02]'
                      : 'bg-zinc-900/90 text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-700 font-semibold'
                  }`}
                  aria-pressed={isActive}
                  title={`Feed ${idx + 1} (${st.source}) - ${isHD ? 'High Definition' : 'Standard'}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-[#00df82] animate-pulse' : 'bg-zinc-600'}`} />
                  <span>Feed {idx + 1}</span>
                  <span className="text-[10px] text-zinc-500 font-mono hidden xs:inline uppercase">
                    {st.source}
                  </span>
                  <span className={`text-[9px] font-mono px-1 py-0.2 rounded font-bold ${
                    isActive
                      ? 'bg-emerald-400/25 text-emerald-200'
                      : 'bg-zinc-800 text-zinc-400'
                  }`}>
                    {isHD ? 'HD' : 'SD'}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Refresh & Next Feed Quick Switch Controls */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => {
                loadStreams();
                if (activeStream) {
                  resolveCurrentStream(activeStream, true);
                }
              }}
              disabled={loadingStreams || isResolvingHls}
              title="Reload all feeds"
              className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 min-h-[38px] rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-emerald-400 text-xs font-semibold transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingStreams || isResolvingHls ? 'animate-spin text-emerald-400' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            {streams.length > 1 && (
              <button
                onClick={handleNextFeed}
                title={`Next Feed (${nextStream?.source || ''})`}
                className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 min-h-[38px] rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-emerald-400 text-xs font-bold transition cursor-pointer shrink-0"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Next Feed</span>
              </button>
            )}
          </div>
        </div>
      </footer>

      {/* Stream Resolver Configuration Modal */}
      <ResolverConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        onSaved={() => {
          if (activeStream) {
            resolveCurrentStream(activeStream, true);
          }
        }}
      />
    </div>
  );
};
