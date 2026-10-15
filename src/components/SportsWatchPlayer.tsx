import React, { useState, useEffect } from 'react';
import { ArrowLeft, Cannabis, Radio, AlertCircle, RefreshCw, Volume2 } from 'lucide-react';
import { APIMatch, StreamedStream } from '../types';
import { fetchStreams, getTeamBadgeUrl, getMatchPosterUrl } from '../services/sportsApi';

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

  const homeBadge = getTeamBadgeUrl(match.teams?.home?.badge);
  const awayBadge = getTeamBadgeUrl(match.teams?.away?.badge);
  const posterUrl = getMatchPosterUrl(match.poster);

  // Load streams when match is opened
  const loadStreams = async () => {
    setLoadingStreams(true);
    setFetchError(null);

    if (!match.sources || match.sources.length === 0) {
      setLoadingStreams(false);
      setFetchError('No broadcast sources found for this match yet.');
      return;
    }

    try {
      // Fetch available streams from primary source, or check secondary if empty
      let foundStreams: StreamedStream[] = [];
      for (const src of match.sources) {
        const res = await fetchStreams(src.source, src.id);
        if (res && res.length > 0) {
          foundStreams = res;
          break;
        }
      }

      if (foundStreams.length > 0) {
        // Prefer first HD stream if available, otherwise first stream
        const hdIndex = foundStreams.findIndex((s) => s.hd);
        setActiveStreamIndex(hdIndex !== -1 ? hdIndex : 0);
        setStreams(foundStreams);
      } else {
        setStreams([]);
        setFetchError('Live streams will be available 15 minutes before kickoff.');
      }
    } catch {
      setFetchError('Could not connect to broadcast network. Please try refreshing.');
    } finally {
      setLoadingStreams(false);
    }
  };

  useEffect(() => {
    loadStreams();
  }, [match.id]);

  // Manage embed loading overlay
  useEffect(() => {
    setIsLoadingEmbed(true);
    setShowSkip(false);

    const skipTimer = setTimeout(() => {
      setShowSkip(true);
    }, 3500);

    const fallbackTimer = setTimeout(() => {
      setIsLoadingEmbed(false);
    }, 7000);

    return () => {
      clearTimeout(skipTimer);
      clearTimeout(fallbackTimer);
    };
  }, [activeStreamIndex, streams]);

  const activeStream = streams[activeStreamIndex];

  return (
    <div className="fixed inset-0 z-50 bg-[#050806] text-white flex flex-col overflow-hidden select-none">
      {/* ── Top Header Navigation Bar ── */}
      <header className="w-full px-4 sm:px-8 py-3.5 flex items-center justify-between bg-black/70 backdrop-blur-md border-b border-emerald-500/15 z-30">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 transition cursor-pointer text-xs font-bold shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          {/* Stoned.living Brand Logo */}
          <div className="flex items-center gap-2.5 shrink-0">
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

          <div className="h-4 w-px bg-zinc-800 hidden sm:block shrink-0" />

          {/* Match Title & Live Badge */}
          <div className="min-w-0 flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md bg-red-600/90 text-white text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1 shrink-0 animate-pulse">
              <Radio className="w-3 h-3" />
              <span>LIVE</span>
            </span>
            <h1 className="text-xs sm:text-sm font-bold text-white truncate max-w-xs md:max-w-md lg:max-w-lg">
              {match.title}
            </h1>
          </div>
        </div>

        {/* ── Right Stream Source Switcher Pills ── */}
        <div className="flex items-center gap-2 shrink-0">
          {streams.length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto max-w-[200px] sm:max-w-md no-scrollbar py-0.5">
              {streams.map((stream, idx) => {
                const isActive = activeStreamIndex === idx;
                return (
                  <button
                    key={stream.id || idx}
                    onClick={() => setActiveStreamIndex(idx)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1 ${
                      isActive
                        ? 'bg-emerald-500 text-black shadow-[0_0_12px_rgba(0,223,130,0.6)] font-bold'
                        : 'bg-zinc-900/80 text-zinc-300 hover:text-white border border-zinc-800'
                    }`}
                  >
                    <span>Feed {stream.streamNo || idx + 1}</span>
                    {stream.hd && (
                      <span className={`text-[9px] px-1 py-0.2 rounded font-mono font-bold ${isActive ? 'bg-black text-[#00df82]' : 'bg-emerald-500/20 text-emerald-400'}`}>
                        HD
                      </span>
                    )}
                    {stream.language && stream.language !== 'English' && (
                      <span className="text-[10px] opacity-75">· {stream.language}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <button
            onClick={loadStreams}
            title="Refresh stream feeds"
            className="p-1.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loadingStreams ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </header>

      {/* ── Center Stage: Theater Screen (Direct Embed) ── */}
      <main className="relative flex-1 w-full bg-black flex items-center justify-center overflow-hidden">
        {/* Ambient Blurred Backdrop */}
        {posterUrl && (
          <div
            className="absolute inset-0 bg-cover bg-center filter blur-3xl opacity-20 scale-110 pointer-events-none"
            style={{ backgroundImage: `url('${posterUrl}')` }}
          />
        )}

        {/* Video Iframe Embed */}
        {activeStream?.embedUrl ? (
          <iframe
            key={activeStream.embedUrl}
            src={activeStream.embedUrl}
            title={match.title}
            allowFullScreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="no-referrer"
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

        {/* ── Loading Screen Overlay matching user's spec ── */}
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

            {/* Exact "Connecting to server" status line (Zero server names) */}
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
                onClick={() => setIsLoadingEmbed(false)}
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
