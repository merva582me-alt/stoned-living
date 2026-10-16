import React, { useState } from 'react';
import { Play, Star, Plus, Check } from 'lucide-react';
import { MediaItem, UserProfile } from '../types';
import { toggleWatchlist, isItemInWatchlist, isUserLoggedIn, requestAuthForAction } from '../services/storage';
import { toast } from 'sonner';

interface MediaCardProps {
  item: MediaItem;
  onOpenDetails: (item: MediaItem) => void;
  onPlay?: (item: MediaItem) => void;
  className?: string;
  rankNumber?: number; // For Top 10 cards
  isRecentlyAdded?: boolean;
  isLoggedIn?: boolean;
  onRequireLogin?: (targetItem: MediaItem) => void;
  onUpdateUser?: (updated: UserProfile) => void;
  isInWatchlist?: boolean;
}

export const MediaCard: React.FC<MediaCardProps> = ({
  item,
  onOpenDetails,
  onPlay,
  className = 'w-full',
  rankNumber,
  isRecentlyAdded,
  isLoggedIn,
  onRequireLogin,
  onUpdateUser,
  isInWatchlist,
}) => {
  const [inWatchlist, setInWatchlist] = useState(() => 
    isInWatchlist !== undefined ? isInWatchlist : isItemInWatchlist(item.id)
  );
  const [imgError, setImgError] = useState(false);

  React.useEffect(() => {
    if (isInWatchlist !== undefined) {
      setInWatchlist(isInWatchlist);
    }
  }, [isInWatchlist]);

  const title = item.title || item.name || 'Untitled';
  const releaseYear = (item.release_date || item.first_air_date)?.split('-')[0] || '2026';
  const isTv = item.media_type === 'tv' || Boolean(item.first_air_date);
  const rating = (item.vote_average || 8.0).toFixed(1);

  const posterUrl = !imgError && item.poster_path
    ? (item.poster_path.startsWith('http') ? item.poster_path : `https://image.tmdb.org/t/p/w500${item.poster_path}`)
    : (item.backdrop_path ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` : '');

  const handleToggleWatchlist = (e: React.MouseEvent) => {
    e.stopPropagation();
    const loggedIn = isLoggedIn !== undefined ? isLoggedIn : isUserLoggedIn();
    if (!loggedIn) {
      if (onRequireLogin) {
        onRequireLogin(item);
      } else {
        requestAuthForAction(item);
      }
      return;
    }
    const result = toggleWatchlist(item);
    setInWatchlist(result.inList);
    if (onUpdateUser) onUpdateUser(result.updatedProfile);
    toast(result.inList ? 'Saved to Watchlist' : 'Removed from Watchlist', { duration: 1500 });
  };

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onPlay) {
      onPlay(item);
    } else {
      onOpenDetails(item);
    }
  };

  return (
    <div
      onClick={() => onOpenDetails(item)}
      className={`group relative flex flex-col cursor-pointer select-none transition-all duration-300 ${className}`}
    >
      {/* Poster Container (2:3 aspect ratio) */}
      <div className="relative w-full aspect-[2/3] rounded-xl overflow-hidden bg-[#0c1410] border border-zinc-800 group-hover:border-zinc-500 group-hover:shadow-[0_8px_30px_rgba(0,0,0,0.8)] transition-all duration-300">
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={title}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-gradient-to-br from-[#0c1510] to-[#060a08]">
            <span className="text-emerald-400 font-black text-2xl mb-1">Z</span>
            <span className="text-xs text-zinc-400 font-semibold line-clamp-2">{title}</span>
          </div>
        )}

        {/* Top-Right Quick Add to Watchlist Button */}
        <button
          type="button"
          onClick={handleToggleWatchlist}
          title={inWatchlist ? 'In Watchlist' : 'Add to Watchlist'}
          className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center backdrop-blur-md transition-all duration-200 z-10 ${
            inWatchlist
              ? 'bg-emerald-500 text-black'
              : 'bg-black/60 text-white/90 opacity-0 group-hover:opacity-100 hover:bg-emerald-500 hover:text-black border border-white/20'
          }`}
        >
          {inWatchlist ? <Check className="w-3.5 h-3.5 stroke-[2.5]" /> : <Plus className="w-3.5 h-3.5" />}
        </button>

        {/* Numeric Rank Badge (For Top 10 Carousel) */}
        {rankNumber !== undefined && (
          <div className="absolute top-2 left-2 z-10 w-7 h-7 rounded-lg bg-black/80 backdrop-blur-md border border-emerald-500/40 text-emerald-400 font-black text-xs flex items-center justify-center shadow-lg">
            #{rankNumber}
          </div>
        )}

        {/* Hover Center Play Button Overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div
            onClick={handlePlay}
            className="w-11 h-11 rounded-full bg-white text-black flex items-center justify-center shadow-2xl transition-transform transform scale-90 group-hover:scale-100 hover:bg-zinc-200"
          >
            <Play className="w-5 h-5 fill-current ml-0.5" />
          </div>
        </div>

        {/* Bottom Poster Badge: 'Recently Added' matching reference screenshots 1:1 */}
        {isRecentlyAdded && (
          <div className="absolute bottom-1.5 left-0 right-0 flex items-center justify-center z-10 pointer-events-none">
            <span className="px-2.5 py-0.5 rounded-sm bg-[#E50914] text-white font-black text-[9px] tracking-wider uppercase shadow-lg">
              Recently Added
            </span>
          </div>
        )}
      </div>

      {/* Card Metadata (Below Poster) */}
      <div className="mt-2.5 px-0.5">
        <h3 className="text-white font-bold text-xs sm:text-sm truncate group-hover:text-red-500 transition-colors">
          {title}
        </h3>
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 mt-0.5 font-medium">
          <span className="flex items-center gap-0.5 text-amber-400 font-bold">
            <Star className="w-3 h-3 fill-amber-400" />
            <span>{rating}</span>
          </span>
          <span className="text-zinc-600">·</span>
          <span>{releaseYear}</span>
          <span className="text-zinc-600">·</span>
          <span className="capitalize">{isTv ? 'Series' : 'Movie'}</span>
        </div>
      </div>
    </div>
  );
};
