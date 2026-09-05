import React from 'react';
import { Star } from 'lucide-react';
import { MediaItem } from '../types';
import { getMediaBadgeLabel } from '../utils/mediaUtils';

interface MediaCardProps {
  item: MediaItem;
  onOpenDetails: (item: MediaItem) => void;
  className?: string;
}

export const MediaCard: React.FC<MediaCardProps> = ({
  item,
  onOpenDetails,
  className = 'w-36 sm:w-44 md:w-52 flex-shrink-0'
}) => {
  const title = item.title || item.name || 'Untitled';
  const releaseDate = item.release_date || item.first_air_date || '';
  const year = releaseDate ? new Date(releaseDate).getFullYear() : '';
  const posterUrl = item.poster_path
    ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
    : 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&auto=format&fit=crop&q=80';
  const posterSrcSet = item.poster_path
    ? `https://image.tmdb.org/t/p/w300${item.poster_path} 300w, https://image.tmdb.org/t/p/w500${item.poster_path} 500w`
    : undefined;

  return (
    <div
      className={`group/card relative rounded-2xl overflow-hidden bg-[#0d1310] border border-emerald-500/20 hover:border-emerald-400/60 transition-all duration-300 hover:shadow-[0_0_25px_rgba(16,185,129,0.35)] hover:scale-[1.02] cursor-pointer flex flex-col justify-between ${className}`}
      onClick={() => onOpenDetails(item)}
    >
      <div>
        {/* Poster Image Container */}
        <div className="relative aspect-[2/3] w-full overflow-hidden bg-zinc-900">
          <img
            src={posterUrl}
            srcSet={posterSrcSet}
            sizes="(max-width: 640px) 144px, (max-width: 768px) 176px, 208px"
            alt={title}
            className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-500 [content-visibility:auto]"
            loading="lazy"
            decoding="async"
          />

          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d1310] via-transparent to-transparent opacity-80 group-hover/card:opacity-60 transition-opacity" />

          {/* Top Badges */}
          <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none z-10 gap-1">
            <span className="bg-black/80 backdrop-blur-md text-amber-400 font-bold text-[10px] px-1.5 py-0.5 rounded-md border border-amber-500/30 flex items-center gap-1">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
              {item.vote_average?.toFixed(1) || '8.0'}
            </span>
            <span className="bg-black/80 backdrop-blur-md text-emerald-400 font-extrabold text-[9px] px-1.5 py-0.5 rounded-md border border-emerald-500/30 uppercase tracking-wider">
              {getMediaBadgeLabel(item)}
            </span>
          </div>
        </div>

        {/* Info Label */}
        <div className="p-2.5 sm:p-3">
          <h3 className="font-bold text-xs sm:text-sm text-white truncate group-hover/card:text-emerald-400 transition-colors leading-snug">
            {title}
          </h3>
        </div>
      </div>

      {/* Footer Meta */}
      <div className="px-2.5 pb-2.5 sm:px-3 sm:pb-3 pt-0 flex items-center justify-between text-[11px] text-zinc-400">
        <span className="font-mono text-zinc-400 text-xs">{year || '2024'}</span>
      </div>
    </div>
  );
};

