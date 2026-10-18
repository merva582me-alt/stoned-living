import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Cannabis,
  Radio,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  SkipForward,
  Tv,
  CheckCircle2,
  X,
} from 'lucide-react';
import { APIMatch, StreamedStream } from '../types';
import {
  fetchAllMatchStreams,
  getTeamBadgeUrl,
  getMatchPosterUrl,
} from '../services/sportsApi';

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
  const [statusNotification, setStatusNotification] = useState<string | null>(null);
  const [dismissMobileTip, setDismissMobileTip] = useState(false);

  const homeBadge = getTeamBadgeUrl(match.teams?.home?.badge);
  const awayBadge = getTeamBadgeUrl(match.teams?.away?.badge);
  const posterUrl = getMatchPosterUrl(match.poster);

  // Load and combine all available feeds across all sources
  const loadStreams = useCallback(async () => {
    setLoadingStreams(true);
    setFetchError(null);
    setStatusNotification(null);

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

  // Switch to next feed helper
  const handleNextFeed = useCallback(() => {
    if (streams.length <= 1) return;
    const nextIndex = (activeStreamIndex + 1) % streams.length;
    setActiveStreamIndex(nextIndex);
    setIsLoadingEmbed(true);
    setStatusNotification(`Switched to Feed ${nextIndex + 1} (${streams[nextIndex]?.source || 'Source'})`);
    
    // Auto-clear notification after 4s
    const timer = setTimeout(() => setStatusNotification(null), 4000);
    return () => clearTimeout(timer);
  }, [streams, activeStreamIndex]);

  // Listen for iframe media errors and auto-switch
  useEffect(() => {
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
  }, [streams.length, handleNextFeed]);

  // Manage embed loading overlay
  useEffect(() => {
    setIsLoadingEmbed(true);
    setShowSkip(false);

    const skipTimer = setTimeout(() => {
      setShowSkip(true);
    }, 3000);

    const fallbackTimer = setTimeout(() => {
      setIsLoadingEmbed(false);
    }, 6000);

    return () => {
      clearTimeout(skipTimer);
      clearTimeout(fallbackTimer);
    };
  }, [activeStreamIndex, streams]);

  const activeStream = streams[activeStreamIndex];

  return (
    <div className="fixed inset-0 z-50 bg-[#050806] text-white flex flex-col overflow-hidden select-none">
      {/* ── Responsive Two-Row Header Navigation Bar ── */}
      <header className="w-full bg-black/85 backdrop-blur-md border-b border-emerald-500/15 z-30 flex flex-col">
        {/* ROW 1: Branding, Back, Category/Live, External Launcher, Refresh */}
        <div className="w-full px-3.5 sm:px-6 py-2.5 flex items-center justify-between gap-2">
          {/* Left: Back & Brand */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-1.5 min-h-[40px] rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 transition cursor-pointer text-xs font-bold shrink-0"
              aria-label="Back to Sports"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            {/* Stoned.living Brand Logo */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-[#060c08] border-2 border-[#00df82] flex items-center justify-center shadow-[0_0_12px_rgba(0,223,130,0.35)] shrink-0">
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
          </div>

          {/* Center: Live indicator & Sport category pill */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="px-2 py-0.5 rounded-md bg-red-600 text-white text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1 shrink-0 animate-pulse">
              <Radio className="w-3 h-3" />
              <span>LIVE</span>
            </span>

            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-[#00df82] text-[11px] font-mono font-semibold uppercase">
              <Tv className="w-3 h-3" />
              <span>{match.category}</span>
            </span>
          </div>

          {/* Right: Stream Launcher & Refresh */}
          <div className="flex items-center gap-2 shrink-0">
            {activeStream?.embedUrl && (
              <a
                href={activeStream.embedUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Launch stream in full-screen native mobile player"
                className="flex items-center gap-1.5 px-3 py-1.5 min-h-[40px] rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-[#00df82] hover:text-white border border-emerald-500/35 transition cursor-pointer text-xs font-semibold shrink-0 shadow-[0_0_10px_rgba(0,223,130,0.15)]"
              >
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden xs:inline">Open Stream</span>
                <span className="xs:hidden">Launch</span>
              </a>
            )}

            <button
              onClick={loadStreams}
              title="Refresh stream feeds"
              className="p-2 min-h-[40px] min-w-[40px] rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition cursor-pointer flex items-center justify-center shrink-0"
              aria-label="Refresh feeds"
            >
              <RefreshCw className={`w-4 h-4 ${loadingStreams ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* ROW 2: Match Title & Feeds Selector Bar */}
        <div className="w-full px-3.5 sm:px-6 py-2 bg-zinc-950/70 border-t border-zinc-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          {/* Match Title & Teams */}
          <div className="min-w-0 flex items-center gap-2">
            <h1 className="text-xs sm:text-sm font-bold text-white truncate max-w-full sm:max-w-md lg:max-w-xl">
              {match.title}
            </h1>
            {streams.length > 0 && (
              <span className="text-[10px] font-mono text-zinc-400 px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 shrink-0">
                {streams.length} {streams.length === 1 ? 'Feed' : 'Feeds'}
              </span>
            )}
          </div>

          {/* Horizontally Scrollable Stream Feeds */}
          {streams.length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-full sm:max-w-xl">
              {streams.map((stream, idx) => {
                const isActive = activeStreamIndex === idx;
                const sourceTag = stream.source && stream.source !== 'ADMIN' ? stream.source : null;
                return (
                  <button
                    key={`${stream.embedUrl}-${idx}`}
                    onClick={() => {
                      setActiveStreamIndex(idx);
                      setIsLoadingEmbed(true);
                    }}
                    className={`px-3 py-1.5 min-h-[36px] rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                      isActive
                        ? 'bg-[#00df82] text-black shadow-[0_0_14px_rgba(0,223,130,0.5)] font-bold'
                        : 'bg-zinc-900/90 text-zinc-300 hover:text-white border border-zinc-800/90 hover:border-zinc-700'
                    }`}
                  >
                    <span>Feed {idx + 1}</span>
                    {sourceTag && (
                      <span className={`text-[9px] px-1 py-0.2 rounded font-mono uppercase ${isActive ? 'bg-black/20 text-black' : 'text-zinc-400'}`}>
                        {sourceTag}
                      </span>
                    )}
                    {stream.hd && (
                      <span
                        className={`text-[9px] px-1 py-0.2 rounded font-mono font-bold ${
                          isActive ? 'bg-black text-[#00df82]' : 'bg-emerald-500/20 text-emerald-400'
                        }`}
                      >
                        HD
                      </span>
                    )}
                    {stream.language && stream.language !== 'English' && (
                      <span className="text-[10px] opacity-75">· {stream.language}</span>
                    )}
                  </button>
                );
              })}

              {/* Quick Next Feed Trigger */}
              <button
                onClick={handleNextFeed}
                title="Switch to next feed"
                className="px-2 py-1.5 min-h-[36px] rounded-xl text-xs font-semibold bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 transition cursor-pointer flex items-center gap-1 shrink-0"
              >
                <SkipForward className="w-3.5 h-3.5 text-[#00df82]" />
                <span className="hidden md:inline">Next</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── Status Toast / Switch Notification ── */}
      {statusNotification && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-40 bg-zinc-900/95 border border-emerald-500/50 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-[0_8px_25px_rgba(0,0,0,0.8),0_0_15px_rgba(0,223,130,0.25)] flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
          <CheckCircle2 className="w-4 h-4 text-[#00df82]" />
          <span>{statusNotification}</span>
        </div>
      )}

      {/* ── Center Stage: Theater Screen (Direct Embed) ── */}
      <main className="relative flex-1 w-full bg-black flex items-center justify-center overflow-hidden">
        {/* Ambient Blurred Backdrop */}
        {posterUrl && (
          <div
            className="absolute inset-0 bg-cover bg-center filter blur-3xl opacity-20 scale-110 pointer-events-none"
            style={{ backgroundImage: `url('${posterUrl}')` }}
          />
        )}

        {/* Video Iframe Embed with Comprehensive Mobile Support */}
        {activeStream?.embedUrl ? (
          <iframe
            key={activeStream.embedUrl}
            src={activeStream.embedUrl}
            title={match.title}
            allowFullScreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
            referrerPolicy="no-referrer-when-downgrade"
            onLoad={() => setIsLoadingEmbed(false)}
            className="relative z-10 w-full h-full max-w-[1920px] border-0"
          />
        ) : !loadingStreams && fetchError ? (
          <div className="relative z-20 flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-zinc-900/90 border border-emerald-500/20 flex items-center justify-center shadow-xl">
              <AlertCircle className="w-8 h-8 text-amber-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Stream Unavailable Right Now</h3>
              <p className="text-xs text-zinc-400 mt-1">{fetchError}</p>
            </div>
            <button
              onClick={loadStreams}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs transition cursor-pointer shadow-[0_0_15px_rgba(0,223,130,0.3)]"
            >
              Retry Connection
            </button>
          </div>
        ) : null}

        {/* ── Mobile Player Helper Bar ── */}
        {!dismissMobileTip && activeStream?.embedUrl && (
          <div className="absolute bottom-3 inset-x-3 sm:inset-x-auto sm:right-4 z-30 flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-zinc-950/90 backdrop-blur-md border border-emerald-500/30 text-white text-xs shadow-[0_8px_24px_rgba(0,0,0,0.8)]">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-2 h-2 rounded-full bg-[#00df82] animate-pulse shrink-0" />
              <span className="text-[11px] text-zinc-300 truncate">
                Playback stalled on mobile?
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {streams.length > 1 && (
                <button
                  onClick={handleNextFeed}
                  className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-[11px] font-bold transition cursor-pointer"
                >
                  Next Feed
                </button>
              )}

              <a
                href={activeStream.embedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#00df82] text-black text-[11px] font-bold transition hover:bg-emerald-400 cursor-pointer shadow-[0_0_10px_rgba(0,223,130,0.3)]"
              >
                <span>Launch Stream</span>
                <ExternalLink className="w-3 h-3" />
              </a>

              <button
                onClick={() => setDismissMobileTip(true)}
                className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
                title="Dismiss tip"
                aria-label="Dismiss tip"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ── Loading Screen Overlay ── */}
        <div
          className={`absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/92 backdrop-blur-xl transition-all duration-700 ease-out ${
            isLoadingEmbed || loadingStreams ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
        >
          {/* Ambient Blurred Backdrop */}
          {posterUrl && (
            <div
              className="absolute inset-0 bg-cover bg-center filter blur-2xl opacity-25 scale-110 pointer-events-none"
              style={{ backgroundImage: `url('${posterUrl}')` }}
            />
          )}

          {/* Vignette Gradients */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-black/60 pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,223,130,0.08)_0%,transparent_75%)] pointer-events-none" />

          {/* Centered Content Card */}
          <div className="relative z-30 flex flex-col items-center text-center px-4 max-w-lg mx-auto select-none">
            {/* Team Badges or Match Poster */}
            {homeBadge && awayBadge ? (
              <div className="flex items-center justify-center gap-6 mb-6">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-zinc-900/90 border border-emerald-500/25 p-2 flex items-center justify-center shadow-[0_12px_30px_rgba(0,0,0,0.8),0_0_18px_rgba(0,223,130,0.15)]">
                  <img src={homeBadge} alt={match.teams?.home?.name || 'Home'} className="w-full h-full object-contain" />
                </div>
                <span className="text-zinc-500 font-black text-sm tracking-widest font-mono">VS</span>
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-zinc-900/90 border border-emerald-500/25 p-2 flex items-center justify-center shadow-[0_12px_30px_rgba(0,0,0,0.8),0_0_18px_rgba(0,223,130,0.15)]">
                  <img src={awayBadge} alt={match.teams?.away?.name || 'Away'} className="w-full h-full object-contain" />
                </div>
              </div>
            ) : posterUrl ? (
              <div className="w-28 h-38 sm:w-32 sm:h-44 rounded-2xl overflow-hidden shadow-[0_16px_40px_rgba(0,0,0,0.85),0_0_24px_rgba(0,223,130,0.18)] border border-emerald-500/25 mb-5 relative group">
                <img src={posterUrl} alt={match.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
              </div>
            ) : null}

            {/* Title Name */}
            <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight drop-shadow-md px-2 max-w-md line-clamp-2">
              {match.title}
            </h2>

            {/* Category / Sport Subtitle */}
            <div className="inline-flex items-center gap-2 mt-2 px-3 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-[#00df82] font-mono text-xs font-semibold tracking-wider uppercase">
              <span>{match.category}</span>
              <span className="w-1 h-1 rounded-full bg-[#00df82]/70" />
              <span>LIVE ARENA</span>
            </div>

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

            {/* Controls while loading */}
            <div className="flex items-center gap-4 mt-6">
              {showSkip && (
                <button
                  onClick={() => setIsLoadingEmbed(false)}
                  className="text-xs font-mono text-zinc-400 hover:text-[#00df82] transition-colors uppercase tracking-wider underline underline-offset-4 cursor-pointer"
                >
                  Skip waiting
                </button>
              )}

              {activeStream?.embedUrl && (
                <a
                  href={activeStream.embedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 border border-emerald-500/30 text-[#00df82] hover:text-white text-xs font-mono font-semibold transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Direct Launcher</span>
                </a>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
