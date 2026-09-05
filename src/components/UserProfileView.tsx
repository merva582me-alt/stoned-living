import React, { useState } from 'react';
import { Bookmark, Heart, History, ListPlus, Play, Trash2, Check, Cannabis, Film, Sparkles, Clock, LogOut, ShieldCheck, Settings, Volume2, Wind } from 'lucide-react';
import { UserProfile, WatchHistoryItem, MediaItem } from '../types';
import { saveUserProfile, toggleWatchlist } from '../services/storage';
import { saveProfileToFirestore } from '../services/firebase';
import { GoogleIcon } from './Navbar';
import { toast } from 'sonner';

interface UserProfileViewProps {
  user: UserProfile;
  onUpdateUser: (user: UserProfile) => void;
  onPlay: (item: MediaItem, season?: number, episode?: number) => void;
  onOpenDetails: (item: MediaItem) => void;
  catalog: MediaItem[];
  isLoggedIn?: boolean;
  onGoogleSignIn?: () => void;
  onSignOut?: () => void;
}

export const UserProfileView: React.FC<UserProfileViewProps> = ({
  user,
  onUpdateUser,
  onPlay,
  onOpenDetails,
  catalog,
  isLoggedIn = false,
  onGoogleSignIn,
  onSignOut
}) => {
  const [activeTab, setActiveTab] = useState<'history' | 'watchlist'>('history');

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
              <h1 className="text-2xl font-black text-white">{user.username}</h1>
              {isLoggedIn ? (
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" /> GOOGLE AUTHENTICATED
                </span>
              ) : (
                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase">
                  GUEST PROFILE
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 mt-1">{user.email}</p>
          </div>
        </div>

        {/* Google Login Action or Stats */}
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="flex items-center gap-3 text-center">
            <div className="bg-[#101713] border border-emerald-900/50 px-4 py-2.5 rounded-2xl">
              <span className="font-extrabold text-lg text-emerald-400 block">{user.watchHistory.length}</span>
              <span className="text-[10px] text-zinc-400 font-semibold uppercase">Sessions</span>
            </div>
            <div className="bg-[#101713] border border-emerald-900/50 px-4 py-2.5 rounded-2xl">
              <span className="font-extrabold text-lg text-emerald-400 block">{user.watchlist.length}</span>
              <span className="text-[10px] text-zinc-400 font-semibold uppercase">In Stash</span>
            </div>
          </div>

          {!isLoggedIn ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onGoogleSignIn?.();
              }}
              className="flex items-center gap-2.5 bg-gradient-to-r from-emerald-500 to-green-400 text-black font-extrabold text-xs px-5 py-3 rounded-2xl shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:scale-105 transition"
            >
              <GoogleIcon />
              <span>Sync with Google Account</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSignOut?.();
              }}
              className="flex items-center gap-2 bg-rose-950/40 border border-rose-900/60 text-rose-300 hover:text-white text-xs font-bold px-4 py-2.5 rounded-2xl transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          )}
        </div>
      </div>

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
            <History className="w-4 h-4" /> Continue Watching ({user.watchHistory.length})
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

        {activeTab === 'history' && user.watchHistory.length > 0 && (
          <button
            onClick={handleClearHistory}
            className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 font-semibold px-3 py-1.5 rounded-lg bg-rose-950/30 border border-rose-900/40"
          >
            <Trash2 className="w-3.5 h-3.5" /> Clear History
          </button>
        )}
      </div>

      {/* Tab Content */}
      {activeTab === 'history' && (
        user.watchHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
            <History className="w-12 h-12 text-emerald-900" />
            <h3 className="text-lg font-extrabold text-white">No Watch History Yet</h3>
            <p className="text-zinc-500 text-sm max-w-xs">Start streaming movies, TV shows or anime, and your watch history will automatically appear here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {user.watchHistory.map((h) => {
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
                    {h.season && (
                      <p className="text-xs text-emerald-400 font-mono">
                        S{h.season}:E{h.episode} {h.episodeTitle ? `• ${h.episodeTitle}` : ''}
                      </p>
                    )}
                    {/* Progress bar */}
                    <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden mt-3">
                      <div className="bg-emerald-500 h-full" style={{ width: `${h.progressPercent}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

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
