import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Plyr from 'plyr';
import Hls from 'hls.js';
import 'plyr/dist/plyr.css';
import { toast } from 'sonner';
import { Play, SkipForward, SkipBack, Maximize, Minimize, Moon, Star, Flame, Cannabis, MessageSquare, Info, Film, Send, Sparkles, Check, Heart, Plus, ChevronLeft, ChevronRight, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { MediaItem, Season, Episode, Comment, UserProfile, SiteSettings } from '../types';
import { fetchTvSeason, fetchMediaDetail, fetchComments, postComment } from '../services/api';
import { updateWatchHistory } from '../services/storage';
import { auth, saveProfileToFirestore } from '../services/firebase';
import { StrainDatabase } from '../data/strainDatabase';

// ---------------------------------------------------------------------------
// Stream resolver helper
// ---------------------------------------------------------------------------

const RESOLVER_BASE = (import.meta.env.VITE_RESOLVER_URL || 'https://stoned-resolver.stonedliving.workers.dev').replace(/\/$/, '');

async function resolveStream(
  type: 'movie' | 'tv' | 'anime' | 'sports',
  id: string | number,
  season?: number,
  episode?: number,
  opts?: { source?: string; provider?: string; anilistId?: string }
): Promise<string | null> {
  try {
    let url: string;
    if (type === 'sports') {
      const provider = opts?.provider || 'streamed';
      url = `${RESOLVER_BASE}/api/resolve?source=sports&provider=${provider}&id=${id}`;
    } else {
      const params = new URLSearchParams({
        type,
        id: String(id),
        ...(season !== undefined  ? { season:  String(season)  } : {}),
        ...(episode !== undefined ? { episode: String(episode) } : {}),
        ...(opts?.anilistId       ? { anilist_id: opts.anilistId } : {})
      });
      url = `${RESOLVER_BASE}/api/resolve?${params}`;
    }
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json() as { url?: string };
    return data.url ?? null;
  } catch {
    return null;
  }
}

interface WatchPlayerProps {
  media: MediaItem;
  user?: UserProfile;
  settings?: SiteSettings | null;
  initialSeason?: number;
  initialEpisode?: number;
  onClose: () => void;
  onSelectMedia: (item: MediaItem) => void;
  onToggleWatchlist: (item: MediaItem) => void;
  onUpdateUser?: (updated: UserProfile) => void;
  inWatchlist?: boolean;
}

export const WatchPlayer: React.FC<WatchPlayerProps> = ({
  media,
  user,
  settings,
  initialSeason = 1,
  initialEpisode = 1,
  onClose,
  onSelectMedia,
  onToggleWatchlist,
  onUpdateUser,
  inWatchlist = false
}) => {
  const isTv = media.media_type === 'tv' || Boolean(media.number_of_seasons) || Boolean(media.first_air_date) || (Boolean(media.name) && !media.title);
  const effectiveMediaType: 'movie' | 'tv' = isTv ? 'tv' : 'movie';

  // ── HLS refs (sports only) ────────────────────────────────────────────────
  const videoRef  = useRef<HTMLVideoElement>(null);
  const plyrRef   = useRef<Plyr | null>(null);
  const hlsRef    = useRef<Hls | null>(null);

  // ── Stream state ──────────────────────────────────────────────────────────
  const [streamUrl, setStreamUrl]         = useState<string | null>(null);
  const [streamLoading, setStreamLoading] = useState(false);
  const [streamError, setStreamError]     = useState(false);
  const [retryCount, setRetryCount]       = useState(0);

  // ── Embed server selection (movies/tv/anime) ──────────────────────────────
  const [serverIndex, setServerIndex] = useState(0);

  const [seasonNum, setSeasonNum] = useState(initialSeason);
  const [episodeNum, setEpisodeNum] = useState(initialEpisode);
  const [seasonData, setSeasonData] = useState<Season | null>(null);
  const [fullMediaDetail, setFullMediaDetail] = useState<MediaItem | null>(null);
  const [theaterMode, setTheaterMode] = useState(false);
  const [lightsOff, setLightsOff] = useState(false);
  const [isFullScreenActive, setIsFullScreenActive] = useState(false);

  // Fetch complete TV details to get all seasons
  useEffect(() => {
    if (isTv && media.id) {
      fetchMediaDetail('tv', media.id).then((detail) => {
        if (detail) setFullMediaDetail(detail);
      });
    }
  }, [isTv, media.id]);

  const activeMedia = fullMediaDetail || media;

  const seasonsList = (() => {
    const rawSeasons = activeMedia.seasons;
    if (Array.isArray(rawSeasons) && rawSeasons.length > 0) {
      const filtered = rawSeasons.filter(
        (s) => s.season_number !== undefined && (s.episode_count === undefined || s.episode_count > 0)
      );
      if (filtered.length > 0) {
        return filtered.map((s) => ({
          season_number: s.season_number,
          name: s.season_number === 0 ? 'Specials (S0)' : (s.name || `Season ${s.season_number}`),
          episode_count: s.episode_count
        }));
      }
    }
    const count = activeMedia.number_of_seasons || media.number_of_seasons || 1;
    return Array.from({ length: Math.max(count, 1) }, (_, i) => ({
      season_number: i + 1,
      name: `Season ${i + 1}`,
      episode_count: undefined
    }));
  })();

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullScreenActive(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleBrowserFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  // Tabs state below player
  const [activeTab, setActiveTab] = useState<'overview' | 'episodes' | 'comments'>('overview');
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [strainBadge, setStrainBadge] = useState('Pineapple Express 🔥');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Load Season data if TV
  useEffect(() => {
    if (isTv) {
      fetchTvSeason(media.id, seasonNum).then((data) => {
        if (data) setSeasonData(data);
      });
    }
  }, [isTv, media.id, seasonNum]);

  // Load comments
  useEffect(() => {
    fetchComments(effectiveMediaType, media.id).then(setComments);
  }, [media.id, effectiveMediaType]);

  // Sync Watch History
  useEffect(() => {
    if (!media || !media.id) return;
    const currentEp = seasonData?.episodes?.find((e) => e.episode_number === episodeNum);
    const mediaTitle = media.title || media.name || activeMedia.title || activeMedia.name || 'Untitled';
    const poster = media.poster_path || activeMedia.poster_path || null;
    const backdrop = media.backdrop_path || activeMedia.backdrop_path || null;

    const updatedProfile = updateWatchHistory({
      mediaId: Number(media.id),
      mediaType: effectiveMediaType,
      title: mediaTitle,
      posterPath: poster,
      backdropPath: backdrop,
      season: isTv ? seasonNum : undefined,
      episode: isTv ? episodeNum : undefined,
      episodeTitle: currentEp?.name,
      progressSeconds: 1200,
      durationSeconds: 3600,
      progressPercent: 35
    });

    if (onUpdateUser) {
      onUpdateUser(updatedProfile);
    }

    if (auth.currentUser) {
      saveProfileToFirestore(updatedProfile);
    }
  }, [media, activeMedia, seasonNum, episodeNum, isTv, effectiveMediaType, seasonData, onUpdateUser]);

  // ── Detect media kind ─────────────────────────────────────────────────────
  const isSports = Boolean((media as any).is_live);
  const isAnime  = Boolean((media as any).is_anime);

  // ── Build embed server list (movies / TV / anime) — official embed URLs ───
  const embedServers = useMemo(() => {
    if (isSports) return [];
    const id = media.id;
    if (effectiveMediaType === 'movie') {
      return [
        `https://vidsrcme.ru/embed/movie/${id}`,
        `https://vidlink.pro/movie/${id}`,
        `https://vidcore.org/embed/movie/${id}?autoplay=true&theme=10b981`,
        `https://vidup.to/e/${id}`,
      ];
    }
    // TV or Anime
    return [
      `https://vidsrcme.ru/embed/tv/${id}/${seasonNum}/${episodeNum}`,
      `https://vidlink.pro/tv/${id}/${seasonNum}/${episodeNum}`,
      `https://vidcore.org/embed/tv/${id}/${seasonNum}/${episodeNum}?autoplay=true&theme=10b981`,
      `https://vidup.to/e/${id}?s=${seasonNum}&e=${episodeNum}`,
    ];
  }, [media.id, effectiveMediaType, seasonNum, episodeNum, isSports]);

  // Reset server when title/episode changes
  useEffect(() => { setServerIndex(0); }, [media.id, seasonNum, episodeNum]);

  // ── Sports: resolve HLS stream from worker ────────────────────────────────
  const loadStream = useCallback(async () => {
    if (!isSports) return;
    setStreamLoading(true);
    setStreamError(false);
    setStreamUrl(null);
    const url = await resolveStream(
      'sports',
      (media as any).channel_id || media.id,
      undefined, undefined,
      { provider: (media as any).sports_provider }
    );
    if (url) { setStreamUrl(url); } else { setStreamError(true); }
    setStreamLoading(false);
  }, [media, isSports]);

  useEffect(() => { if (isSports) loadStream(); }, [isSports, loadStream]);

  // ── HLS/Plyr — sports only ────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl || !isSports) return;
    if (hlsRef.current)  { hlsRef.current.destroy();  hlsRef.current = null; }
    if (plyrRef.current) { plyrRef.current.destroy(); plyrRef.current = null; }
    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
      hlsRef.current = hls;
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        plyrRef.current = new Plyr(video, {
          controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'fullscreen'],
          hideControls: true,
        });
        plyrRef.current.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_, d) => { if (d.fatal) setStreamError(true); });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamUrl;
      plyrRef.current = new Plyr(video, {
        controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'fullscreen'],
        hideControls: true,
      });
    } else {
      setStreamError(true);
    }
    return () => {
      hlsRef.current?.destroy();
      plyrRef.current?.destroy();
      hlsRef.current = null;
      plyrRef.current = null;
    };
  }, [streamUrl, isSports]);

  useEffect(() => () => {
    hlsRef.current?.destroy();
    plyrRef.current?.destroy();
  }, []);

  const handleNextEpisode = () => {
    const totalEpsInSeason = seasonData?.episodes?.length || 24;
    if (episodeNum < totalEpsInSeason) {
      setEpisodeNum(episodeNum + 1);
    } else {
      const currentIdx = seasonsList.findIndex((s) => s.season_number === seasonNum);
      if (currentIdx >= 0 && currentIdx < seasonsList.length - 1) {
        const nextSeason = seasonsList[currentIdx + 1];
        setSeasonNum(nextSeason.season_number);
        setEpisodeNum(1);
      }
    }
  };

  // Handle next/prev episode navigation
  const handlePrevEpisode = () => {
    if (episodeNum > 1) {
      setEpisodeNum(episodeNum - 1);
    } else {
      const currentIdx = seasonsList.findIndex((s) => s.season_number === seasonNum);
      if (currentIdx > 0) {
        const prevSeason = seasonsList[currentIdx - 1];
        setSeasonNum(prevSeason.season_number);
        setEpisodeNum(1);
      }
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setSubmittingComment(true);

    const activeUsername = user?.username || (user?.email ? user.email.split('@')[0] : 'Stoned Streamer');
    const activeAvatar = user?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80';

    const result = await postComment({
      mediaId: media.id,
      mediaType: isTv ? 'tv' : 'movie',
      season: isTv ? seasonNum : undefined,
      episode: isTv ? episodeNum : undefined,
      text: commentText,
      username: activeUsername,
      userAvatar: activeAvatar
    });

    const newCommentObj = result?.id ? result : null;
    if (newCommentObj) {
      setComments([newCommentObj, ...comments]);
      setCommentText('');
      toast.success('Review posted 🌿', { duration: 2000 });
    } else {
      toast.error('Failed to post review. Try again.');
    }
    setSubmittingComment(false);
  };

  const currentEpisodeData = seasonData?.episodes?.find((e) => e.episode_number === episodeNum);

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
        sommelier_note: media.sommelier_note || `Pair with ${media.strain_pairing}. Enjoy deep immersion, vivid visuals, and optimal chill vibes during streaming.`
      }
    : StrainDatabase.getPairingForMedia(media);

  const couchlockScore = strainPairing.couchlock_score || 90;

  const renderStrainCard = () => (
    <div className="bg-gradient-to-br from-emerald-950/80 via-[#0a140f] to-green-950/80 border border-emerald-500/30 p-3.5 sm:p-4 rounded-2xl space-y-2.5 shadow-lg">
      <div className="flex items-center justify-between flex-wrap gap-1">
        <div className="flex items-center gap-1.5">
          <Cannabis className="w-4 h-4 text-emerald-400 animate-pulse shrink-0" />
          <span className="text-[11px] font-black text-emerald-300 uppercase tracking-wider">
            Recommended Strain Pairing
          </span>
        </div>
        {strainPairing.chill_vibe && (
          <span className="text-[9px] font-bold text-emerald-300 bg-emerald-900/60 border border-emerald-500/30 px-2 py-0.5 rounded-full">
            ✨ {strainPairing.chill_vibe}
          </span>
        )}
      </div>

      <div className="bg-black/50 border border-emerald-500/20 p-2.5 rounded-xl space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm font-extrabold text-white">{strainPairing.strain_name || strainPairing.strain_pairing}</span>
            {strainPairing.strain_type && (
              <span className="text-[9px] font-mono font-bold text-amber-300 bg-amber-950/80 border border-amber-500/40 px-1.5 py-0.5 rounded">
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
          <div className="flex justify-between items-center text-[9px] font-mono">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[10px]">
          {strainPairing.flavor && (
            <div className="bg-black/30 border border-emerald-900/40 p-2 rounded-lg">
              <span className="text-zinc-400 font-bold block text-[9px] uppercase">Flavor Profile</span>
              <span className="text-emerald-200 font-medium block truncate">🍓 {strainPairing.flavor}</span>
            </div>
          )}
          {strainPairing.terpenes && (
            <div className="bg-black/30 border border-emerald-900/40 p-2 rounded-lg">
              <span className="text-zinc-400 font-bold block text-[9px] uppercase">Terpene Spectrum</span>
              <span className="text-emerald-300 font-mono block truncate">🧪 {strainPairing.terpenes}</span>
            </div>
          )}
        </div>
      )}

      {strainPairing.sommelier_note && (
        <div className="bg-black/40 p-2.5 rounded-xl border border-emerald-500/15">
          <p className="text-[10px] text-zinc-300 leading-relaxed italic">
            "{strainPairing.sommelier_note}"
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div className={`min-h-screen transition-colors duration-500 ${lightsOff ? 'bg-black' : 'bg-[#060907]'}`}>
      {/* Light Off Overlay */}
      {lightsOff && (
        <div className="fixed inset-0 bg-black/90 z-30 pointer-events-none transition-opacity duration-500" />
      )}

      <div className={`mx-auto transition-all duration-300 ${theaterMode ? 'w-full px-2 sm:px-4 py-2 sm:py-4 pb-12 sm:pb-16' : 'w-full max-w-[1920px] px-2 sm:px-6 lg:px-8 py-3 sm:py-6 pb-12 sm:pb-16'}`}>
        {/* Top Control Bar */}
        <div className="flex items-center justify-between gap-2 sm:gap-4 mb-3 sm:mb-4 bg-[#0d1310]/90 border border-emerald-500/30 p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl backdrop-blur-md">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <button
              onClick={onClose}
              className="px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl bg-emerald-950/60 hover:bg-emerald-800/80 text-emerald-300 font-semibold text-[11px] sm:text-xs border border-emerald-500/40 transition-all shrink-0"
            >
              ← <span className="hidden xs:inline">Back to Stash</span><span className="xs:hidden">Back</span>
            </button>

            <div className="min-w-0 flex-1">
              <h1 className="text-xs sm:text-base md:text-lg font-black text-white flex items-center gap-1.5 sm:gap-2 leading-tight truncate">
                <span className="truncate">{media.title || media.name}</span>
                {isTv && (
                  <span className="shrink-0 text-emerald-400 font-mono text-[10px] sm:text-xs bg-emerald-500/20 px-1.5 sm:px-2 py-0.5 rounded border border-emerald-500/30 whitespace-nowrap">
                    S{seasonNum}:E{episodeNum}
                  </span>
                )}
              </h1>
              {isTv && currentEpisodeData && (
                <p className="text-[10px] sm:text-xs text-zinc-400 font-medium truncate">{currentEpisodeData.name}</p>
              )}
            </div>
          </div>

          {/* Quick Player Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={() => onToggleWatchlist(media)}
              className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl border text-xs font-semibold transition ${
                inWatchlist
                  ? 'bg-emerald-500/30 text-emerald-300 border-emerald-500'
                  : 'bg-black/60 text-zinc-300 border-emerald-500/20 hover:border-emerald-400'
              }`}
              title="Save to Stash"
            >
              {inWatchlist ? <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" /> : <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            </button>
          </div>
        </div>

        {/* Responsive Grid Layout Container: Side-by-Side on PC (lg:grid), Stacked on Mobile/Tablet */}
        <div className="lg:grid lg:grid-cols-12 lg:gap-6 lg:items-start">

          {/* LEFT MAIN STREAM COLUMN (Full width on Mobile/Tablet, 8/12 on Desktop PC) */}
          <div className="lg:col-span-8 space-y-4 min-w-0">

            {/* ── Server switcher bar ─────────────────────────────────────── */}
            {!isSports && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Server:</span>
                {embedServers.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setServerIndex(i)}
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                      serverIndex === i
                        ? 'bg-emerald-500 text-black border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.4)]'
                        : 'bg-black/60 text-zinc-400 border-zinc-700 hover:border-emerald-500/60 hover:text-emerald-300'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            )}

            {/* ── Video Player Container ──────────────────────────────────── */}
            <div className="relative group z-40 w-full aspect-video bg-black rounded-xl sm:rounded-3xl overflow-hidden border border-emerald-500/30 shadow-[0_0_50px_rgba(16,185,129,0.2)]">

              {/* ── iframe embed — movies / TV / anime ── */}
              {!isSports && embedServers[serverIndex] && (
                <iframe
                  key={embedServers[serverIndex]}
                  src={embedServers[serverIndex]}
                  className="w-full h-full border-0"
                  allowFullScreen
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                  referrerPolicy="no-referrer"
                />
              )}

              {/* ── HLS video — sports ── */}
              {isSports && (
                <video
                  ref={videoRef}
                  id="stoned-player"
                  className="w-full h-full"
                  playsInline
                />
              )}

              {/* Sports loading overlay */}
              {isSports && streamLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-10">
                  <Loader2 className="w-10 h-10 text-emerald-400 animate-spin mb-3" />
                  <span className="text-xs font-bold text-emerald-300 tracking-widest uppercase">Connecting to stream…</span>
                </div>
              )}

              {/* Sports error overlay */}
              {isSports && streamError && !streamLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-10 gap-4">
                  <AlertCircle className="w-10 h-10 text-rose-400" />
                  <p className="text-sm font-bold text-white">Stream unavailable right now</p>
                  <p className="text-xs text-zinc-400">This event may not be live yet — try refreshing</p>
                  <button
                    onClick={() => { setRetryCount(0); loadStream(); }}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-black font-bold text-xs px-5 py-2.5 rounded-xl transition cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Try Again
                  </button>
                </div>
              )}

              {/* Episode nav overlay buttons (desktop) */}
              {isTv && !isSports && (
                <>
                  <button
                    onClick={handlePrevEpisode}
                    disabled={seasonNum === 1 && episodeNum === 1}
                    className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 z-50 items-center justify-center p-3 rounded-2xl bg-black/80 hover:bg-emerald-500 text-emerald-400 hover:text-black border border-emerald-500/50 hover:border-emerald-400 transition-all duration-200 shadow-[0_0_30px_rgba(0,0,0,0.9)] backdrop-blur-md opacity-75 hover:opacity-100 group-hover:opacity-100 disabled:opacity-20 disabled:pointer-events-none cursor-pointer group/prev"
                    title="Previous Episode"
                  >
                    <ChevronLeft className="w-7 h-7 stroke-[2.5]" />
                    <span className="absolute left-full ml-3 px-3 py-1.5 rounded-xl bg-black/95 text-emerald-300 border border-emerald-500/40 text-xs font-bold whitespace-nowrap opacity-0 group-hover/prev:opacity-100 transition-opacity pointer-events-none shadow-2xl">Previous Episode</span>
                  </button>
                  <button
                    onClick={handleNextEpisode}
                    className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 z-50 items-center justify-center p-3 rounded-2xl bg-black/80 hover:bg-emerald-500 text-emerald-400 hover:text-black border border-emerald-500/50 hover:border-emerald-400 transition-all duration-200 shadow-[0_0_30px_rgba(0,0,0,0.9)] backdrop-blur-md opacity-75 hover:opacity-100 group-hover:opacity-100 cursor-pointer group/next"
                    title="Next Episode"
                  >
                    <ChevronRight className="w-7 h-7 stroke-[2.5]" />
                    <span className="absolute right-full mr-3 px-3 py-1.5 rounded-xl bg-black/95 text-emerald-300 border border-emerald-500/40 text-xs font-bold whitespace-nowrap opacity-0 group-hover/next:opacity-100 transition-opacity pointer-events-none shadow-2xl">Next Episode</span>
                  </button>
                </>
              )}
            </div>

            {/* TV Selector Controls */}
            {isTv && (
              <div className="relative z-40 bg-[#0d1310] border border-emerald-500/20 p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl flex items-center justify-between gap-2 sm:gap-3">
                <button
                  onClick={handlePrevEpisode}
                  disabled={seasonNum === 1 && episodeNum === 1}
                  className="flex items-center gap-1 bg-black/60 hover:bg-emerald-950/60 border border-emerald-500/30 text-white font-semibold text-[11px] sm:text-xs px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-lg sm:rounded-xl disabled:opacity-40"
                >
                  <SkipBack className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
                  <span>Prev Ep</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleNextEpisode}
                    className="flex items-center gap-1 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-[11px] sm:text-xs px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.3)] transition cursor-pointer"
                  >
                    <span>Next Ep</span>
                    <SkipForward className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-black" />
                  </button>
                </div>
              </div>
            )}

            {/* MOBILE & TABLET ONLY: TV Season & Episodes Horizontal Carousel (< lg) */}
            {isTv && (
              <div className="lg:hidden my-3 sm:my-6 bg-[#0c120e] border border-emerald-500/20 p-2.5 sm:p-4 rounded-xl sm:rounded-3xl">
                <div className="flex items-center justify-between gap-2 mb-2.5 sm:mb-3">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <span className="text-xs sm:text-sm font-bold text-zinc-300">Season:</span>
                    <select
                      value={seasonNum}
                      onChange={(e) => {
                        setSeasonNum(parseInt(e.target.value, 10));
                        setEpisodeNum(1);
                      }}
                      className="bg-black/80 text-emerald-400 border border-emerald-500/40 font-bold text-xs px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl focus:outline-none cursor-pointer"
                    >
                      {seasonsList.map((s) => (
                        <option key={s.season_number} value={s.season_number} className="bg-zinc-950 text-white">
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <span className="text-[10px] sm:text-xs font-mono text-emerald-500">
                    {seasonData?.episodes?.length || 24} Episodes
                  </span>
                </div>

                <div className="flex items-center gap-2.5 sm:gap-3 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory">
                  {(seasonData?.episodes || Array.from({ length: 24 }, (_, i) => ({ episode_number: i + 1, name: `Episode ${i + 1}`, id: i + 1, overview: '' }))).map((ep) => {
                    const isActive = ep.episode_number === episodeNum;
                    const stillUrl = ('still_path' in ep && ep.still_path)
                      ? `https://image.tmdb.org/t/p/w300${ep.still_path}`
                      : (media.backdrop_path || media.poster_path)
                      ? `https://image.tmdb.org/t/p/w300${media.backdrop_path || media.poster_path}`
                      : 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=300&auto=format&fit=crop&q=80';

                    return (
                      <button
                        key={ep.id || ep.episode_number}
                        onClick={() => setEpisodeNum(ep.episode_number)}
                        className={`flex-shrink-0 snap-start w-32 sm:w-48 text-left rounded-xl sm:rounded-2xl overflow-hidden border transition-all ${
                          isActive
                            ? 'border-emerald-400 bg-emerald-950/40 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                            : 'border-emerald-900/40 bg-[#090e0b] hover:border-emerald-600/50'
                        }`}
                      >
                        <div className="relative aspect-video w-full overflow-hidden bg-zinc-900">
                          <img src={stillUrl} alt={ep.name} className="w-full h-full object-cover" />
                          {isActive && (
                            <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center">
                              <Play className="w-5 h-5 sm:w-8 sm:h-8 fill-emerald-400 text-emerald-400" />
                            </div>
                          )}
                          <span className="absolute bottom-1 left-1 sm:bottom-1.5 sm:left-1.5 bg-black/85 font-mono text-[9px] sm:text-[10px] text-emerald-400 font-extrabold px-1.5 py-0.5 rounded">
                            E{ep.episode_number}
                          </span>
                        </div>

                        <div className="p-1.5 sm:p-2.5">
                          <h4 className="font-bold text-[10px] sm:text-xs text-white truncate">{ep.name}</h4>
                          {ep.overview ? <p className="hidden sm:block text-[10px] text-zinc-400 line-clamp-1 mt-0.5">{ep.overview}</p> : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Below Player Tabs: Overview & Comments */}
            <div className="bg-[#0d1310] border border-emerald-500/20 rounded-2xl sm:rounded-3xl p-3.5 sm:p-6">
              <div className="flex items-center gap-2 sm:gap-4 border-b border-emerald-900/40 pb-3 sm:pb-4 mb-4 sm:mb-6 overflow-x-auto">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl font-bold text-xs flex items-center gap-1.5 sm:gap-2 transition shrink-0 ${
                    activeTab === 'overview'
                      ? 'bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Info className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Overview & Details
                </button>

                <button
                  onClick={() => setActiveTab('comments')}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl font-bold text-xs flex items-center gap-1.5 sm:gap-2 transition shrink-0 ${
                    activeTab === 'comments'
                      ? 'bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Stash Community ({comments.length})
                </button>
              </div>

              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 space-y-4">
                      <p className="text-zinc-300 text-sm leading-relaxed">{media.overview}</p>

                      <div className="flex flex-wrap items-center gap-2 pt-2">
                        {media.genres?.map((g) => (
                          <span
                            key={g.id}
                            className="bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-xs px-3 py-1 rounded-full font-medium"
                          >
                            {g.name}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="bg-black/40 border border-emerald-500/20 p-4 rounded-2xl space-y-3 text-xs">
                      <div>
                        <span className="text-zinc-500 font-semibold block">TMDb Score:</span>
                        <span className="text-amber-400 font-bold flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 fill-amber-400" /> {media.vote_average?.toFixed(1)} / 10
                        </span>
                      </div>

                      {/* Mobile Strain Sommelier Card inside overview tab */}
                      <div className="lg:hidden">
                        {renderStrainCard()}
                      </div>

                      <div>
                        <span className="text-zinc-500 font-semibold block">Status:</span>
                        <span className="text-white font-medium">{media.status || 'Released'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Cast List */}
                  {media.cast && media.cast.length > 0 && (
                    <div>
                      <h4 className="font-extrabold text-white text-sm mb-3">Featured Cast:</h4>
                      <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
                        {media.cast.slice(0, 8).map((c) => (
                          <div
                            key={c.id}
                            className="flex-shrink-0 w-28 bg-black/40 border border-emerald-950 p-2 rounded-xl text-center"
                          >
                            <img
                              src={
                                c.profile_path
                                  ? `https://image.tmdb.org/t/p/w185${c.profile_path}`
                                  : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80'
                              }
                              alt={c.name}
                              className="w-16 h-16 rounded-full object-cover mx-auto mb-1.5 ring-1 ring-emerald-500/30"
                            />
                            <p className="font-bold text-[11px] text-white truncate">{c.name}</p>
                            <p className="text-[9px] text-zinc-400 truncate">{c.character}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'comments' && (
                <div className="space-y-6">
                  {/* Comment Input */}
                  <form onSubmit={handleCommentSubmit} className="space-y-3 bg-black/40 border border-emerald-500/20 p-4 rounded-2xl">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">Join the Session Discussion:</span>
                    </div>

                    <textarea
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Share your review, mind-blown moments, or strain pairing suggestions..."
                      className="w-full bg-[#070b08] border border-emerald-500/30 rounded-xl p-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-400 min-h-[80px]"
                    />

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={submittingComment || !commentText.trim()}
                        className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs px-5 py-2.5 rounded-xl transition disabled:opacity-40"
                      >
                        <Send className="w-3.5 h-3.5" /> {submittingComment ? 'Posting...' : 'Post Review'}
                      </button>
                    </div>
                  </form>

                  {/* Comments List */}
                  <div className="space-y-3">
                    {comments.map((c) => (
                      <div key={c.id} className="bg-[#090f0c] border border-emerald-950/80 p-3.5 sm:p-4 rounded-2xl space-y-2.5 overflow-hidden">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <img src={c.userAvatar} alt={c.username} className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover ring-1 ring-emerald-500/40 shrink-0" />
                            <span className="font-bold text-xs sm:text-sm text-white truncate">{c.username}</span>
                          </div>
                          <span className="text-[10px] sm:text-xs text-zinc-500 shrink-0">{new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>

                        <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed break-words whitespace-pre-wrap">{c.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT SIDEBAR COLUMN (PC / Computer Desktop Only) */}
          <div className="hidden lg:flex lg:flex-col lg:col-span-4 space-y-4 min-w-0">
            {/* TV Show Episode Playlist Sidebar */}
            {isTv && (
              <div className="bg-[#0c120e] border border-emerald-500/30 p-4 rounded-3xl shadow-xl space-y-3">
                <div className="flex items-center justify-between gap-2 border-b border-emerald-900/50 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-300">Season:</span>
                    <select
                      value={seasonNum}
                      onChange={(e) => {
                        setSeasonNum(parseInt(e.target.value, 10));
                        setEpisodeNum(1);
                      }}
                      className="bg-black/90 text-emerald-400 border border-emerald-500/40 font-bold text-xs px-2.5 py-1.5 rounded-xl focus:outline-none cursor-pointer"
                    >
                      {seasonsList.map((s) => (
                        <option key={s.season_number} value={s.season_number} className="bg-zinc-950 text-white">
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <span className="text-xs font-mono text-emerald-400 font-bold bg-emerald-950/80 px-2.5 py-1 rounded-lg border border-emerald-500/30">
                    {seasonData?.episodes?.length || 24} Episodes
                  </span>
                </div>

                {/* Vertical Scrollable Episodes List */}
                <div className="space-y-2 max-h-[460px] xl:max-h-[520px] overflow-y-auto pr-1.5 scrollbar-thin scrollbar-thumb-emerald-800/80">
                  {(seasonData?.episodes || Array.from({ length: 24 }, (_, i) => ({ episode_number: i + 1, name: `Episode ${i + 1}`, id: i + 1, overview: '' }))).map((ep) => {
                    const isActive = ep.episode_number === episodeNum;
                    const stillUrl = ('still_path' in ep && ep.still_path)
                      ? `https://image.tmdb.org/t/p/w300${ep.still_path}`
                      : (media.backdrop_path || media.poster_path)
                      ? `https://image.tmdb.org/t/p/w300${media.backdrop_path || media.poster_path}`
                      : 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=300&auto=format&fit=crop&q=80';

                    return (
                      <button
                        key={ep.id || ep.episode_number}
                        onClick={() => setEpisodeNum(ep.episode_number)}
                        className={`w-full flex items-center gap-3 p-2 rounded-2xl border text-left transition-all ${
                          isActive
                            ? 'border-emerald-400 bg-emerald-950/60 shadow-[0_0_20px_rgba(16,185,129,0.3)] ring-1 ring-emerald-400/50'
                            : 'border-emerald-900/30 bg-[#090e0b] hover:border-emerald-600/40 hover:bg-[#0d1611]'
                        }`}
                      >
                        <div className="relative aspect-video w-28 shrink-0 rounded-xl overflow-hidden bg-zinc-900 border border-emerald-900/30">
                          <img src={stillUrl} alt={ep.name} className="w-full h-full object-cover" />
                          {isActive ? (
                            <div className="absolute inset-0 bg-emerald-500/30 flex items-center justify-center">
                              <Play className="w-6 h-6 fill-emerald-300 text-emerald-300 animate-pulse" />
                            </div>
                          ) : (
                            <div className="absolute inset-0 bg-black/20 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity">
                              <Play className="w-5 h-5 text-white fill-white" />
                            </div>
                          )}
                          <span className="absolute bottom-1 left-1 bg-black/90 font-mono text-[9px] text-emerald-400 font-extrabold px-1.5 py-0.5 rounded">
                            E{ep.episode_number}
                          </span>
                        </div>

                        <div className="min-w-0 flex-1 space-y-0.5">
                          <h4 className={`font-bold text-xs truncate ${isActive ? 'text-emerald-300' : 'text-white'}`}>
                            {ep.name}
                          </h4>
                          {ep.overview ? (
                            <p className="text-[10px] text-zinc-400 line-clamp-2 leading-tight">{ep.overview}</p>
                          ) : (
                            <p className="text-[10px] text-zinc-500 italic">No overview available</p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* PC Sommelier Strain Pairing Card */}
            <div>
              {renderStrainCard()}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
