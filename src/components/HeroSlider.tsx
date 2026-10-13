import React, { useState, useEffect } from 'react';
import { Play, Info, Cannabis, Star, Sparkles } from 'lucide-react';
import { MediaItem } from '../types';

interface HeroSliderProps {
  items: MediaItem[];
  onPlay: (item: MediaItem) => void;
  onOpenDetails: (item: MediaItem) => void;
}

export const HeroSlider: React.FC<HeroSliderProps> = ({
  items,
  onPlay,
  onOpenDetails,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!items.length) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, 8000);
    return () => clearInterval(timer);
  }, [items.length]);

  if (!items.length) {
    return (
      <div className="w-full min-h-[440px] sm:min-h-[520px] bg-[#0c120e] rounded-3xl animate-pulse flex items-center justify-center border border-emerald-900/30">
        <Cannabis className="w-12 h-12 text-emerald-800 animate-spin" />
      </div>
    );
  }

  const current = items[currentIndex];
  const backdropUrl = current.backdrop_path
    ? `https://image.tmdb.org/t/p/w1280${current.backdrop_path}`
    : current.poster_path
    ? `https://image.tmdb.org/t/p/w1280${current.poster_path}`
    : 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1600&auto=format&fit=crop&q=80';
  const backdropSrcSet = current.backdrop_path
    ? `https://image.tmdb.org/t/p/w1280${current.backdrop_path} 1280w, https://image.tmdb.org/t/p/original${current.backdrop_path} 1920w`
    : current.poster_path
    ? `https://image.tmdb.org/t/p/w1280${current.poster_path} 1280w, https://image.tmdb.org/t/p/original${current.poster_path} 1920w`
    : undefined;

  const isAnime = current.original_language === 'ja' && (current.genre_ids?.includes(16) || current.media_type === 'tv');
  const mediaLabel = isAnime && current.original_language === 'ja' ? 'Anime' : current.media_type === 'tv' ? 'TV Series' : 'Movie';

  return (
    <section className="relative w-full rounded-3xl overflow-hidden bg-black border border-emerald-950 shadow-[0_0_50px_rgba(16,185,129,0.1)] min-h-[440px] sm:min-h-[520px] flex items-end group">
      {/* Backdrop Image & Dark Gradient Overlays */}
      <div className="absolute inset-0">
        <img
          src={backdropUrl}
          srcSet={backdropSrcSet}
          sizes="100vw"
          alt={current.title || current.name}
          className="w-full h-full object-cover object-center scale-105 transition-all duration-1000"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d1813] via-[#0d1813]/70 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0d1813] via-[#0d1813]/80 to-transparent w-full md:w-3/4" />
      </div>

      {/* Content Box */}
      <div className="relative z-10 p-6 sm:p-10 md:p-14 max-w-3xl space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="bg-emerald-500 text-black font-extrabold text-[10px] sm:text-xs px-2.5 py-1 rounded-md tracking-wider uppercase shadow-[0_0_15px_rgba(16,185,129,0.5)] flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" /> FEATURED TITLE
          </span>
          <span className="bg-emerald-950/80 backdrop-blur-md text-emerald-300 font-black text-xs px-2.5 py-1 rounded-md border border-emerald-500/40 uppercase tracking-wider">
            {mediaLabel}
          </span>
          <span className="bg-black/60 backdrop-blur-md text-amber-400 font-black text-xs px-2.5 py-1 rounded-md border border-amber-500/30 flex items-center gap-1">
            <Star className="w-3.5 h-3.5 fill-amber-400" /> {current.vote_average?.toFixed(1) || '8.5'}
          </span>
        </div>

        <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white tracking-tight leading-none drop-shadow-lg">
          {current.title || current.name}
        </h1>

        {current.overview && (
          <p className="text-zinc-300 text-sm sm:text-base line-clamp-3 leading-relaxed max-w-2xl font-normal">
            {current.overview}
          </p>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-3 pt-2">
          <button
            onClick={() => onPlay(current)}
            className="px-4 sm:px-6 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-[11px] xs:text-xs sm:text-sm transition-all shadow-[0_0_25px_rgba(16,185,129,0.4)] flex items-center justify-center gap-1 sm:gap-2 whitespace-nowrap"
          >
            <Play className="w-3.5 h-3.5 sm:w-5 sm:h-5 fill-black shrink-0" />
            <span>Watch</span>
          </button>

          <button
            onClick={() => onOpenDetails(current)}
            className="px-4 sm:px-5 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl bg-black/60 text-zinc-300 border border-zinc-700 hover:border-white hover:text-white font-bold text-[11px] xs:text-xs sm:text-sm transition-all backdrop-blur-md flex items-center justify-center gap-1 sm:gap-2 whitespace-nowrap"
          >
            <Info className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span>Details</span>
          </button>
        </div>
      </div>

      {/* Indicator dots */}
      {items.length > 1 && (
        <div className="absolute bottom-6 right-8 z-20 hidden sm:flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-3.5 py-2 rounded-full border border-emerald-500/30">
          {items.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`h-2 rounded-full transition-all ${
                idx === currentIndex ? 'w-6 bg-emerald-400' : 'w-2 bg-zinc-600 hover:bg-zinc-400'
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
};

