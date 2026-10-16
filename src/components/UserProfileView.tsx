import React, { useState } from 'react';
import { Bookmark, Heart, History, ListPlus, Play, Trash2, Check, Cannabis, Film, Sparkles, Clock, LogOut, ShieldCheck, Settings, Volume2, Wind } from 'lucide-react';
import { UserProfile, WatchHistoryItem, MediaItem } from '../types';
import { saveUserProfile, toggleWatchlist, formatRemainingTime, deduplicateWatchHistory } from '../services/storage';
import { saveProfileToFirestore } from '../services/firebase';
import { toast } from 'sonner';

const GoogleIcon: React.FC = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);

interface UserProfileViewProps {
  user: UserProfile;
  onUpdateUser: (user: UserProfile) => void;
  onPlay: (item: MediaItem, season?: number, episode?: number) => void;
  onOpenDetails: (item: MediaItem) => void;
  catalog: MediaItem[];
  isLoggedIn?: boolean;
  onGoogleSignIn?: () => void;
  onSignOut?: () => void;
  onSwitchProfile?: () => void;
}

export const UserProfileView: React.FC<UserProfileViewProps> = ({
  user,
  onUpdateUser,
  onPlay,
  onOpenDetails,
  catalog,
  isLoggedIn = false,
  onGoogleSignIn,
  onSignOut,
  onSwitchProfile,
}) => {
  const [sectionTab, setSectionTab] = useState<'you' | 'server'>('you');
  const [activeTab, setActiveTab] = useState<'history' | 'watchlist'>('watchlist');

  // Map to store media items by ID without duplicates
  const stashMap = new Map<number, MediaItem>();

  // 1. Populate from stored stash details
  if (user.stashDetails) {
    (Object.values(user.stashDetails) as (MediaItem | undefined)[]).forEach((item) => {
      if (item && item.id) {
        stashMap.set(Number(item.id), item);
      }
    });
  }

  // 2. Populate/enrich from current catalog
  catalog.forEach((item) => {
    if (item && item.id) {
      stashMap.set(Number(item.id), item);
    }
  });

  // 3. Deduplicate user watchlist IDs and map to media items
  const cleanWatchlistIds: number[] = Array.from(
    new Set((user.watchlist || []).map((id) => Number(id)).filter((id) => !isNaN(id) && id > 0))
  );

  const watchlistItems: MediaItem[] = cleanWatchlistIds
    .map((id) => {
      if (stashMap.has(id)) {
        return stashMap.get(id)!;
      }
      return {
        id,
        title: `Item #${id}`,
        name: `Item #${id}`,
        overview: '',
        poster_path: null,
        backdrop_path: null,
        vote_average: 8.0,
        vote_count: 100,
        popularity: 10,
        media_type: 'movie'
      };
    })
    .filter((item): item is MediaItem => item !== undefined);

  const handleRemoveFromStash = (e: React.MouseEvent, item: MediaItem) => {
    e.stopPropagation();
    const { updatedProfile } = toggleWatchlist(item);
    onUpdateUser(updatedProfile);
    if (isLoggedIn) {
      saveProfileToFirestore(updatedProfile);
    }
    toast.success(`Removed from Stash`, { duration: 2000 });
  };

  const handleClearHistory = () => {
    const updated = { ...user, watchHistory: [] };
    saveUserProfile(updated);
    onUpdateUser(updated);
  };

  if (!isLoggedIn) {
    return (
      <div className="w-full max-w-4xl mx-auto py-16 px-4 sm:px-6 lg:px-8 pb-4 text-center">
        <div className="bg-[#0a120e] border-2 border-emerald-500/40 rounded-3xl p-8 sm:p-12 shadow-[0_0_50px_rgba(16,185,129,0.2)] space-y-8 relative overflow-hidden">
          {/* Subtle Ambient Glow */}
          <div className="absolute -top-24 -left-24 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-green-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Icon Badge */}
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-500/20 via-emerald-950 to-emerald-900/40 border-2 border-emerald-500/50 flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(16,185,129,0.3)]">
            <ShieldCheck className="w-10 h-10 text-emerald-400" />
          </div>

          {/* Titles */}
          <div className="space-y-3 max-w-xl mx-auto">
            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-black px-3.5 py-1 rounded-full uppercase tracking-widest inline-flex items-center gap-1.5">
              <Cannabis className="w-3.5 h-3.5 text-emerald-400" /> MY STASH LOCKED
            </span>
            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              Sign In to Unlock Your Stash
            </h1>
            <p className="text-sm sm:text-base text-zinc-300 leading-relaxed">
              Access to <span className="text-emerald-400 font-bold">My Stash</span> requires a Google account. Log in to sync your personal watchlist, movies & TV shows, watch progress, and custom streaming server configurations across all your devices.
            </p>
          </div>

          {/* Feature Highlights Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left max-w-xl mx-auto">
            <div className="bg-[#0f1813] border border-emerald-900/50 p-4 rounded-2xl space-y-1">
              <Bookmark className="w-5 h-5 text-emerald-400 mb-2" />
              <h3 className="text-xs font-black text-white uppercase tracking-wider">Cloud Stash Watchlist</h3>
              <p className="text-[11px] text-zinc-400">Save and organize titles to watch later with instant cloud backup.</p>
            </div>
            <div className="bg-[#0f1813] border border-emerald-900/50 p-4 rounded-2xl space-y-1">
              <History className="w-5 h-5 text-emerald-400 mb-2" />
              <h3 className="text-xs font-black text-white uppercase tracking-wider">Watch History</h3>
              <p className="text-[11px] text-zinc-400">Pick up right where you left off on any screen or mobile device.</p>
            </div>
          </div>

          {/* Sign In Button */}
          <div className="pt-2 max-w-md mx-auto space-y-3">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onGoogleSignIn?.();
              }}
              className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-emerald-400 via-emerald-500 to-green-400 text-black font-black text-sm px-8 py-4 rounded-2xl shadow-[0_0_30px_rgba(16,185,129,0.5)] hover:scale-105 active:scale-95 transition cursor-pointer"
            >
              <GoogleIcon />
              <span>SIGN IN WITH GOOGLE ACCOUNT</span>
            </button>
            <p className="text-[11px] text-zinc-500">
              Secure authentication powered by Google Firebase Auth.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1920px] mx-auto py-8 px-4 sm:px-6 lg:px-10 space-y-8 pb-4">

      {/* Absolute Cinema Screen 8 Dual Navigation Tabs (You / Server) */}
      <div className="flex items-center gap-3 border-b border-zinc-800 pb-3">
        <button
          onClick={() => setSectionTab('you')}
          className={`px-5 py-2 rounded-2xl text-xs sm:text-sm font-bold transition cursor-pointer ${
            sectionTab === 'you'
              ? 'bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.4)]'
              : 'text-zinc-400 hover:text-white bg-zinc-900/60'
          }`}
        >
          You
        </button>
        <button
          onClick={() => setSectionTab('server')}
          className={`px-5 py-2 rounded-2xl text-xs sm:text-sm font-bold transition cursor-pointer ${
            sectionTab === 'server'
              ? 'bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.4)]'
              : 'text-zinc-400 hover:text-white bg-zinc-900/60'
          }`}
        >
          Server
        </button>
      </div>

      {sectionTab === 'server' ? (
        /* Screen 8 Server View */
        <div className="rounded-3xl bg-[#090e0b]/90 border border-emerald-500/30 p-6 sm:p-8 backdrop-blur-2xl shadow-2xl space-y-6 max-w-3xl">
          <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
            <div>
              <h2 className="text-xl font-black text-white">Streaming Engine Status</h2>
              <p className="text-xs text-zinc-400 mt-0.5">Stoned.living High-Performance Infrastructure</p>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-mono font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>ALL SYSTEMS OPERATIONAL</span>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-[#121c16] border border-zinc-800 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">Cinema 4K Engine</span>
                <span className="text-[11px] font-mono text-emerald-400 font-bold">Vidcore.org</span>
              </div>
              <p className="text-[11px] text-zinc-400">Sole primary movie & TV stream engine with emerald theme</p>
            </div>

            <div className="p-4 rounded-2xl bg-[#121c16] border border-zinc-800 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">Live Sports Engine</span>
                <span className="text-[11px] font-mono text-emerald-400 font-bold">Streamed.pk</span>
              </div>
              <p className="text-[11px] text-zinc-400">High-throughput sports schedules and match streams</p>
            </div>

            <div className="p-4 rounded-2xl bg-[#121c16] border border-zinc-800 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">Metadata Gateway</span>
                <span className="text-[11px] font-mono text-emerald-400 font-bold">TMDb v3 / v4</span>
              </div>
              <p className="text-[11px] text-zinc-400">Synced cast portraits, season stills, and 4K backdrops</p>
            </div>

            <div className="p-4 rounded-2xl bg-[#121c16] border border-zinc-800 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">Cloud Database</span>
                <span className="text-[11px] font-mono text-emerald-400 font-bold">Google Firestore</span>
              </div>
              <p className="text-[11px] text-zinc-400">Live multi-user profile synchronization and user stashes</p>
            </div>
          </div>
        </div>
      ) : (
        /* Screen 8 "You" View */
        <>
          {/* Profile Header Card */}
          <div className="bg-[#0b100d] border border-emerald-500/30 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
            <div className="flex items-center gap-5">
              <img
                src={user.avatar}
                alt={user.username}
                className="w-20 h-20 rounded-2xl object-cover ring-2 ring-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
              />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-black text-white">{user.username} (Admin)</h1>
                  {isLoggedIn ? (
                    <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-400" /> AUTHENTICATED
                    </span>
                  ) : (
                    <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase">
                      GUEST PROFILE
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-400 mt-1">{user.email || 'vip@stoned.living'}</p>
              </div>
            </div>

            {/* Profile Actions: Switch profile, Sign out */}
            <div className="flex flex-wrap items-center gap-3">
              {onSwitchProfile && (
                <button
                  type="button"
                  onClick={onSwitchProfile}
                  className="px-5 py-2.5 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-emerald-400 text-zinc-200 hover:text-white text-xs font-bold transition cursor-pointer shadow-md"
                >
                  Switch profile
                </button>
              )}

              {onSignOut && (
                <button
                  type="button"
                  onClick={onSignOut}
                  className="flex items-center gap-2 bg-rose-950/40 border border-rose-900/60 hover:bg-rose-900/60 text-rose-300 hover:text-white text-xs font-bold px-4 py-2.5 rounded-2xl transition cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-emerald-900/50 pb-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
              activeTab === 'history'
                ? 'bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            {(() => {
              const historyList = deduplicateWatchHistory(user.watchHistory || []);
              return (
                <>
                  <History className="w-4 h-4" /> Continue Watching ({historyList.length})
                </>
              );
            })()}
          </button>

          <button
            onClick={() => setActiveTab('watchlist')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
              activeTab === 'watchlist'
                ? 'bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Bookmark className="w-4 h-4" /> My Stash Watchlist ({watchlistItems.length})
          </button>
        </div>

        {activeTab === 'history' && deduplicateWatchHistory(user.watchHistory || []).length > 0 && (
          <button
            onClick={handleClearHistory}
            className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 font-semibold px-3 py-1.5 rounded-lg bg-rose-950/30 border border-rose-900/40"
          >
            <Trash2 className="w-3.5 h-3.5" /> Clear History
          </button>
        )}
      </div>

      {/* Tab Content */}
      {activeTab === 'history' && (() => {
        const historyList = deduplicateWatchHistory(user.watchHistory || []);
        if (historyList.length === 0) {
          return (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
              <History className="w-12 h-12 text-emerald-900" />
              <h3 className="text-lg font-extrabold text-white">No Watch History Yet</h3>
              <p className="text-zinc-500 text-sm max-w-xs">Start streaming movies, TV shows or anime, and your watch history will automatically appear here.</p>
            </div>
          );
        }

        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {historyList.map((h) => {
              const matched = catalog.find((m) => Number(m.id) === Number(h.mediaId)) || {
                id: h.mediaId,
                title: h.title,
                name: h.title,
                overview: '',
                poster_path: h.posterPath,
                backdrop_path: h.backdropPath,
                vote_average: 8.5,
                vote_count: 100,
                popularity: 10,
                media_type: h.mediaType || 'movie'
              };

              const posterUrl = h.posterPath
                ? `https://image.tmdb.org/t/p/w300${h.posterPath}`
                : 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=300&auto=format&fit=crop&q=80';

              return (
                <div
                  key={h.id}
                  onClick={() => onPlay(matched, h.season, h.episode)}
                  className="flex items-center gap-4 bg-[#0e1411] border border-emerald-900/50 hover:border-emerald-500/40 p-3 rounded-2xl cursor-pointer group transition"
                >
                  <img src={posterUrl} alt={h.title} className="w-16 h-22 rounded-xl object-cover" />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-sm text-white group-hover:text-emerald-400 transition-colors truncate">
                      {h.title}
                    </h4>
                    <div className="flex items-center justify-between text-[11px] text-zinc-400 mt-1 font-mono">
                      <span className="text-emerald-400 font-semibold">
                        {formatRemainingTime(h.durationSeconds, h.progressSeconds, h.progressPercent, h.mediaType)}
                      </span>
                      <span>{h.mediaType === 'tv' ? `S${h.season || 1}:E${h.episode || 1}` : 'Movie'}</span>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden mt-2.5">
                      <div className="bg-emerald-500 h-full" style={{ width: `${Math.min(Math.max(h.progressPercent || 5, 5), 100)}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {activeTab === 'watchlist' && (
        watchlistItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
            <Bookmark className="w-12 h-12 text-emerald-900" />
            <h3 className="text-lg font-extrabold text-white">Your Stash is Empty</h3>
            <p className="text-zinc-500 text-sm max-w-xs">Add movies, TV shows and anime to your stash watchlist and they'll appear here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {watchlistItems.map((item) => (
              <div
                key={`stash_${item.id}`}
                onClick={() => onOpenDetails(item)}
                className="bg-[#0e1411] border border-emerald-900/50 hover:border-emerald-500/40 p-3 rounded-2xl cursor-pointer group transition flex flex-col justify-between relative"
              >
                <div>
                  <div className="relative aspect-[2/3] rounded-xl overflow-hidden mb-2 bg-zinc-900">
                    <img
                      src={
                        item.poster_path
                          ? `https://image.tmdb.org/t/p/w300${item.poster_path}`
                          : 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=300&auto=format&fit=crop&q=80'
                      }
                      alt={item.title || item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {/* Media Type Badge */}
                    <span className="absolute top-2 left-2 bg-black/80 backdrop-blur-md text-emerald-400 font-extrabold text-[9px] px-1.5 py-0.5 rounded border border-emerald-500/30 uppercase">
                      {item.media_type === 'tv' ? 'TV SHOW' : 'MOVIE'}
                    </span>
                    {/* Quick Play Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPlay(item);
                      }}
                      className="absolute inset-0 m-auto w-10 h-10 rounded-full bg-emerald-500 text-black flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-[0_0_15px_rgba(16,185,129,0.8)] hover:scale-110 cursor-pointer"
                      title="Play Now"
                    >
                      <Play className="w-5 h-5 fill-black ml-0.5" />
                    </button>
                  </div>
                  <h4 className="font-bold text-xs text-white truncate group-hover:text-emerald-400">
                    {item.title || item.name}
                  </h4>
                </div>

                <div className="flex items-center justify-between pt-2 mt-2 border-t border-emerald-950">
                  <span className="text-[10px] text-zinc-500 font-mono">
                    ★ {item.vote_average ? item.vote_average.toFixed(1) : '8.0'}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => handleRemoveFromStash(e, item)}
                    className="text-zinc-500 hover:text-rose-400 p-1 rounded hover:bg-rose-950/40 transition cursor-pointer"
                    title="Remove from Stash"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Session Settings */}
      <div className="bg-[#0b100d] border border-emerald-500/30 rounded-3xl p-6 md:p-8 space-y-5">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
          <Settings className="w-4 h-4 text-emerald-400" />
        </div>
        <div>
          <h2 className="text-base font-black text-white">Session Settings</h2>
          <p className="text-[10px] text-emerald-500 font-mono">Personalize your Stoned.living experience</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Smoke Effects */}
        <label className="flex items-center justify-between gap-4 bg-black/40 border border-emerald-900/50 hover:border-emerald-500/40 p-4 rounded-2xl cursor-pointer transition">
          <div className="flex items-center gap-3">
            <Wind className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <span className="text-sm font-bold text-white block">Smoke Effects</span>
              <span className="text-[10px] text-zinc-500">Ambient particle canvas overlay</span>
            </div>
          </div>
          <input
            type="checkbox"
            checked={user.settings.smokeEffects}
            onChange={(e) => {
              const updated = { ...user, settings: { ...user.settings, smokeEffects: e.target.checked } };
              saveUserProfile(updated);
              onUpdateUser(updated);
            }}
            className="accent-emerald-500 w-5 h-5 rounded"
          />
        </label>

        {/* Ambient Sound */}
        <label className="flex items-center justify-between gap-4 bg-black/40 border border-emerald-900/50 hover:border-emerald-500/40 p-4 rounded-2xl cursor-pointer transition">
          <div className="flex items-center gap-3">
            <Volume2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <span className="text-sm font-bold text-white block">Ambient Sound</span>
              <span className="text-[10px] text-zinc-500">Background lofi audio during browsing</span>
            </div>
          </div>
          <input
            type="checkbox"
            checked={user.settings.ambientSound}
            onChange={(e) => {
              const updated = { ...user, settings: { ...user.settings, ambientSound: e.target.checked } };
              saveUserProfile(updated);
              onUpdateUser(updated);
            }}
            className="accent-emerald-500 w-5 h-5 rounded"
          />
        </label>
      </div>
    </div>

    </div>
  );
};
