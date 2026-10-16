import React, { useState } from 'react';
import { 
  Bookmark, 
  Heart, 
  Clock, 
  Plus, 
  Search, 
  Play, 
  Trash2,
  ChevronRight,
  FolderOpen,
  X
} from 'lucide-react';
import { MediaItem, UserProfile, WatchHistoryItem } from '../types';
import { MediaCard } from './MediaCard';
import { formatRemainingTime, deduplicateWatchHistory } from '../services/storage';

interface LibraryViewProps {
  user: UserProfile;
  isLoggedIn?: boolean;
  onOpenLogin?: () => void;
  onOpenDetails: (item: MediaItem) => void;
  onPlayMedia: (item: MediaItem, season?: number, episode?: number) => void;
  onNavigateTab: (tab: string) => void;
  onRemoveWatchHistory?: (mediaId: number, season?: number, episode?: number) => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  user,
  isLoggedIn = true,
  onOpenLogin,
  onOpenDetails,
  onPlayMedia,
  onNavigateTab,
  onRemoveWatchHistory,
}) => {
  const [activeList, setActiveList] = useState<'all' | 'watchlist' | 'favorites' | 'history'>('all');
  const [searchFilter, setSearchFilter] = useState('');

  if (isLoggedIn === false) {
    return (
      <div className="w-full min-h-screen bg-[#050806] text-white pt-16 pb-24 px-4 sm:px-8 lg:px-12 flex items-center justify-center selection:bg-emerald-500 selection:text-black">
        <div className="max-w-lg w-full text-center space-y-6 bg-[#0a100c] border border-emerald-500/25 rounded-3xl p-8 sm:p-12 shadow-[0_0_50px_rgba(0,0,0,0.9)]">
          <div className="w-16 h-16 rounded-2xl bg-[#060c08] border-2 border-[#00df82] flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(0,223,130,0.35)]">
            <Bookmark className="w-8 h-8 text-[#00df82]" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Sign In to Access Your Library
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-2 leading-relaxed">
              Sign in with your account to access your personal watchlist, cloud-synced continue watching progress, and custom lists across any browser or device.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={onOpenLogin}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-500 hover:bg-[#00df82] text-black font-black text-xs sm:text-sm shadow-[0_0_20px_rgba(0,223,130,0.3)] transition cursor-pointer"
            >
              Sign In / Register
            </button>
            <button
              onClick={() => onNavigateTab('home')}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 text-xs sm:text-sm font-semibold transition cursor-pointer"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Extract real user items with deduplicated history
  const historyItems = deduplicateWatchHistory(user.watchHistory || []);
  const stashItems: MediaItem[] = Object.values(user.stashDetails || {});

  // Filter based on search input
  const filteredHistory = historyItems.filter((h) =>
    h.title.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const filteredStash = stashItems.filter((m) =>
    (m.title || m.name || '').toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="w-full min-h-screen bg-[#050806] text-white pt-6 sm:pt-8 pb-24 px-4 sm:px-8 lg:px-12 xl:px-16 selection:bg-emerald-500 selection:text-black">
      <div className="w-full space-y-10">
        {/* ── Breadcrumb & Header (Screenshot 6) ── */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-zinc-500 font-medium">
            <button 
              onClick={() => onNavigateTab('home')}
              className="hover:text-emerald-400 transition cursor-pointer"
            >
              Home
            </button>
            <span>&gt;</span>
            <span className="text-zinc-300">Library</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                My Library
              </h1>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                Pick up where you left off or explore your saved titles.
              </p>
            </div>

            {/* Top Right Library Search */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search library..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full bg-[#0c1410] border border-emerald-500/20 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 outline-none focus:border-emerald-400 transition"
              />
            </div>
          </div>
        </div>

        {/* ── Continue Watching Section (Screenshot 6) ── */}
        {historyItems.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                Continue Watching
              </h2>
              <span className="text-xs text-zinc-400 font-medium">
                {historyItems.length} active sessions
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredHistory.map((item) => (
                <div
                  key={item.id}
                  onClick={() => onPlayMedia({
                    id: item.mediaId,
                    title: item.title,
                    overview: '',
                    poster_path: item.posterPath,
                    backdrop_path: item.backdropPath,
                    vote_average: 8.5,
                    vote_count: 100,
                    popularity: 10,
                    media_type: item.mediaType,
                  }, item.season, item.episode)}
                  className="group relative rounded-2xl overflow-hidden bg-[#0c1410] border border-emerald-500/15 hover:border-emerald-400/50 cursor-pointer shadow-lg transition-all hover:scale-[1.02]"
                >
                  {/* 16:9 Thumbnail Backdrop */}
                  <div className="relative aspect-video w-full overflow-hidden bg-black">
                    <img
                      src={item.backdropPath || item.posterPath || ''}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    
                    {/* Quick Remove Action Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onRemoveWatchHistory) {
                          onRemoveWatchHistory(item.mediaId, item.season, item.episode);
                        }
                      }}
                      className="absolute top-2.5 right-2.5 z-20 w-7 h-7 rounded-full bg-black/80 hover:bg-red-600 text-zinc-300 hover:text-white flex items-center justify-center opacity-80 group-hover:opacity-100 transition-all cursor-pointer border border-white/10 shadow-lg"
                      title="Remove from Continue Watching"
                    >
                      <X className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>

                    {/* Hover Play Button */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                      <div className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center shadow-xl">
                        <Play className="w-5 h-5 fill-current ml-0.5" />
                      </div>
                    </div>

                    {/* Progress Bar (at bottom of thumbnail) */}
                    <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-zinc-800">
                      <div
                        className="h-full bg-emerald-400 shadow-[0_0_8px_#00FF9D]"
                        style={{ width: `${Math.min(Math.max(item.progressPercent || 5, 5), 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Info below thumbnail */}
                  <div className="p-3.5 space-y-1">
                    <h3 className="font-bold text-sm text-white truncate group-hover:text-emerald-400 transition-colors">
                      {item.title}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                      <span className="text-emerald-400 font-semibold font-mono">
                        {formatRemainingTime(item.durationSeconds, item.progressSeconds, item.progressPercent, item.mediaType)}
                      </span>
                      <span>·</span>
                      <span className="font-mono">{item.mediaType === 'tv' ? `S${item.season || 1} E${item.episode || 1}` : 'Feature Film'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Your Lists Section (Screenshot 6) ── */}
        <div className="space-y-4">
          <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
            Your Lists
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Watchlist Card */}
            <div
              onClick={() => setActiveList('watchlist')}
              className={`p-5 rounded-2xl border transition-all cursor-pointer flex items-center gap-4 ${
                activeList === 'watchlist'
                  ? 'bg-emerald-500/15 border-emerald-400 text-white shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                  : 'bg-[#0c1410] border-emerald-500/15 hover:border-emerald-500/40 text-zinc-300'
              }`}
            >
              <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
                <Bookmark className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">Watchlist</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {user.watchlist?.length || 0} saved titles
                </p>
              </div>
            </div>

            {/* Favorites Card */}
            <div
              onClick={() => setActiveList('favorites')}
              className={`p-5 rounded-2xl border transition-all cursor-pointer flex items-center gap-4 ${
                activeList === 'favorites'
                  ? 'bg-emerald-500/15 border-emerald-400 text-white shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                  : 'bg-[#0c1410] border-emerald-500/15 hover:border-emerald-500/40 text-zinc-300'
              }`}
            >
              <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
                <Heart className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">Favorites</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {user.favorites?.length || 0} loved titles
                </p>
              </div>
            </div>

            {/* History Card */}
            <div
              onClick={() => setActiveList('history')}
              className={`p-5 rounded-2xl border transition-all cursor-pointer flex items-center gap-4 ${
                activeList === 'history'
                  ? 'bg-emerald-500/15 border-emerald-400 text-white shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                  : 'bg-[#0c1410] border-emerald-500/15 hover:border-emerald-500/40 text-zinc-300'
              }`}
            >
              <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
                <Clock className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">History</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {historyItems.length} playback sessions
                </p>
              </div>
            </div>

            {/* Create List Card */}
            <div
              onClick={() => setActiveList('all')}
              className={`p-5 rounded-2xl border transition-all cursor-pointer flex items-center gap-4 bg-[#0c1410] border-dashed border-zinc-800 hover:border-emerald-500/40 text-zinc-400 hover:text-white`}
            >
              <div className="w-12 h-12 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-center shrink-0">
                <Plus className="w-6 h-6 text-zinc-400" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">All Saved</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  View entire library
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Saved Media Grid ── */}
        <div className="space-y-4 pt-4 border-t border-zinc-900">
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight capitalize">
              {activeList === 'all' ? 'All Saved Titles' : activeList}
            </h2>
            <span className="text-xs text-zinc-400 font-mono">
              {filteredStash.length} titles
            </span>
          </div>

          {filteredStash.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-3 sm:gap-4 lg:gap-5">
              {filteredStash.map((item) => (
                <MediaCard
                  key={item.id}
                  item={item}
                  onOpenDetails={onOpenDetails}
                  onPlay={onPlayMedia}
                />
              ))}
            </div>
          ) : (
            <div className="py-20 text-center space-y-3 bg-[#0a100c] border border-dashed border-zinc-800 rounded-3xl p-8">
              <FolderOpen className="w-10 h-10 text-emerald-500/40 mx-auto" />
              <p className="text-base font-bold text-zinc-300">Your library is currently empty</p>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                Explore movies, series, or anime and tap &ldquo;Add to List&rdquo; on any poster to build your personalized 4K cinema library.
              </p>
              <button
                onClick={() => onNavigateTab('movies')}
                className="mt-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs shadow-lg transition cursor-pointer"
              >
                Browse Trending Movies
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
