import React, { useState, useEffect } from 'react';
import { Play, FolderPlus, Check, ChevronRight, Star } from 'lucide-react';
import { MediaItem, UserProfile } from '../types';
import { toggleWatchlist, isItemInWatchlist, isUserLoggedIn, requestAuthForAction } from '../services/storage';
import { toast } from 'sonner';

interface HeroSliderProps {
  items: MediaItem[];
  onPlay: (item: MediaItem) => void;
  onOpenDetails: (item: MediaItem) => void;
  isLoggedIn?: boolean;
  onRequireLogin?: (item: MediaItem) => void;
  onUpdateUser?: (updated: UserProfile) => void;
  userWatchlist?: number[];
}

export const HeroSlider: React.FC<HeroSliderProps> = ({
  items,
  onPlay,
  onOpenDetails,
  isLoggedIn,
  onRequireLogin,
  onUpdateUser,
  userWatchlist,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!items.length) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, 10000);
    return () => clearInterval(timer);
  }, [items.length]);

  if (!items.length) {
    return (
      <div className="w-full h-[60vh] lg:h-[78vh] bg-[#0c1410] animate-pulse flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-2 border-red-500/30 border-t-red-500 animate-spin" />
      </div>
    );
  }

  const current = items[currentIndex];
  const inWatchlist = userWatchlist 
    ? userWatchlist.includes(Number(current.id))
    : isItemInWatchlist(current.id);

  const backdropUrl = current.backdrop_path
    ? (current.backdrop_path.startsWith('http') ? current.backdrop_path : `https://image.tmdb.org/t/p/original${current.backdrop_path}`)
    : current.poster_path
    ? (current.poster_path.startsWith('http') ? current.poster_path : `https://image.tmdb.org/t/p/original${current.poster_path}`)
    : '';

  const title = current.title || current.name || 'Featured Cinema';
  const releaseYear = (current.release_date || current.first_air_date)?.split('-')[0] || '2026';
  const rating = (current.vote_average || 8.0).toFixed(1);
  const genreName = current.genres?.[0]?.name || (current.media_type === 'tv' ? 'Science Fiction' : 'Action');

  const handleToggleList = () => {
    const loggedIn = isLoggedIn !== undefined ? isLoggedIn : isUserLoggedIn();
    if (!loggedIn) {
      if (onRequireLogin) {
        onRequireLogin(current);
      } else {
        requestAuthForAction(current);
      }
      return;
    }
    const res = toggleWatchlist(current);
    if (onUpdateUser) onUpdateUser(res.updatedProfile);
    toast(res.inList ? 'Added to your List' : 'Removed from your List');
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % items.length);
  };

  return (
    <div className="relative w-full h-[60vh] sm:h-[70vh] md:h-[76vh] lg:h-[84vh] overflow-hidden select-none bg-black">
      {/* ── Cinematic Backdrop Image (Touches right edge of browser) ── */}
      <div className="absolute inset-0 w-full h-full">
        {backdropUrl && (
          <img
            key={backdropUrl}
            src={backdropUrl}
            alt={title}
            className="w-full h-full object-cover object-center filter brightness-[0.85] animate-fadeIn"
          />
        )}
        {/* Widescreen Scrim Gradients matching ZXCStream (Screenshot 1) */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/75 to-transparent w-full md:w-3/5" />
      </div>

      {/* ── Content Billboard (Left-Aligned, Matching Screenshot 1) ── */}
      <div className="relative z-10 w-full h-full pl-6 sm:pl-10 lg:pl-14 pr-16 pb-12 sm:pb-16 lg:pb-20 flex flex-col justify-end">
        <div className="max-w-2xl space-y-3.5">
          {/* Main Stylized Title Heading */}
          <h1 
            onClick={() => onOpenDetails(current)}
            className="text-3xl sm:text-5xl md:text-6xl font-black text-white tracking-tight uppercase leading-[1.05] drop-shadow-[0_4px_25px_rgba(0,0,0,0.95)] cursor-pointer hover:text-zinc-200 transition-colors"
          >
            {title}
          </h1>

          {/* Metadata Row: 7.1 / 10 ★    2026    Science Fiction */}
          <div className="flex items-center gap-3 text-xs sm:text-sm font-semibold text-zinc-300">
            <span className="flex items-center gap-1 font-bold text-white">
              <span className="text-white font-extrabold">{rating}</span>
              <span className="text-zinc-500 font-normal">/ 10</span>
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 ml-0.5" />
            </span>
            <span className="text-zinc-600">·</span>
            <span>{releaseYear}</span>
            <span className="text-zinc-600">·</span>
            <span>{genreName}</span>
          </div>

          {/* Synopsis (2-3 lines max) */}
          <p className="text-xs sm:text-sm text-zinc-300 line-clamp-3 leading-relaxed max-w-xl font-normal drop-shadow">
            {current.overview || 'After a mysterious cosmic event rips Oak Street from suburbia and transports their neighborhood to someplace unknown, the Platt family soon discovers that their very survival depends on them...'}
          </p>

          {/* Action Buttons: [ ▶ Play Now ]   [ 📁 Add to List ] (Screenshot 1) */}
          <div className="pt-2 flex items-center gap-3">
            <button
              onClick={() => onPlay(current)}
              className="px-6 py-2.5 rounded-lg bg-white hover:bg-zinc-200 text-black font-extrabold text-xs sm:text-sm flex items-center gap-2 shadow-2xl transition cursor-pointer hover:scale-105 active:scale-95"
            >
              <Play className="w-4 h-4 fill-black ml-0.5" />
              <span>Play Now</span>
            </button>

            <button
              onClick={handleToggleList}
              className="px-6 py-2.5 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 text-white font-semibold text-xs sm:text-sm flex items-center gap-2 backdrop-blur-md border border-zinc-700/80 transition cursor-pointer hover:scale-105 active:scale-95"
            >
              {inWatchlist ? <Check className="w-4 h-4 text-emerald-400" /> : <FolderPlus className="w-4 h-4" />}
              <span>{inWatchlist ? 'In List' : 'Add to List'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Right Carousel Arrow Button (Right Edge of Screen, Screenshot 1) ── */}
      <button
        onClick={handleNext}
        title="Next featured title"
        className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-20 text-white/70 hover:text-white transition-all cursor-pointer p-2 hover:scale-110 active:scale-95"
      >
        <ChevronRight className="w-10 h-10 sm:w-12 sm:h-12 stroke-[2.5]" />
      </button>
    </div>
  );
};
