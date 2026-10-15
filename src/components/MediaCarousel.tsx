import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight, LucideIcon } from 'lucide-react';
import { MediaItem } from '../types';
import { MediaCard } from './MediaCard';

interface MediaCarouselProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  items: MediaItem[];
  onPlay: (item: MediaItem) => void;
  onOpenDetails: (item: MediaItem) => void;
  loading?: boolean;
}

export const MediaCarousel: React.FC<MediaCarouselProps> = ({
  title,
  subtitle,
  icon: Icon,
  items,
  onPlay,
  onOpenDetails,
  loading = false,
}) => {
  const rowRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (rowRef.current) {
      const amount = (direction === 'left' ? -1 : 1) * Math.max(rowRef.current.clientWidth * 0.75, 300);
      rowRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  if (!items.length && !loading) return null;

  return (
    <div className="space-y-8 sm:space-y-10">
      {/* Section Separator */}
      <div className="px-6 sm:px-8 lg:px-10" aria-hidden="true">
        <div className="border-t border-zinc-800/80" />
      </div>

      <section className="space-y-4">
        {/* Header with Title and Scroll Arrows */}
        <div className="flex items-center justify-between px-6 sm:px-8 lg:px-10">
          <div className="flex items-center gap-2.5">
            {Icon && <Icon className="w-5 h-5 text-emerald-400" />}
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {title}
            </h2>
            {subtitle && (
              <span className="text-xs text-zinc-400 hidden sm:inline-block font-medium">
                {subtitle}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => scroll('left')}
              className="w-8 h-8 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center border border-zinc-800 transition cursor-pointer"
              title="Scroll left"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => scroll('right')}
              className="w-8 h-8 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center border border-zinc-800 transition cursor-pointer"
              title="Scroll right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Carousel Track: Bleeds to Both Left and Right Edges when Scrolled */}
        <div
          ref={rowRef}
          className="flex gap-4 sm:gap-5 overflow-x-auto no-scrollbar scroll-smooth pb-3 w-full"
        >
          <div className="shrink-0 w-2 sm:w-3 lg:w-5 pointer-events-none" aria-hidden="true" />
          {loading && !items.length
            ? Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="w-36 sm:w-44 md:w-48 lg:w-52 shrink-0 aspect-[2/3] rounded-xl bg-zinc-900/60 animate-pulse border border-zinc-800"
                />
              ))
            : items.map((item, idx) => (
                <div key={item.id} className="w-36 sm:w-44 md:w-48 lg:w-52 shrink-0">
                  <MediaCard
                    item={item}
                    isRecentlyAdded={idx === 1 || idx === 5}
                    onOpenDetails={onOpenDetails}
                    onPlay={onPlay}
                  />
                </div>
              ))}
          <div className="shrink-0 w-8 sm:w-12 pointer-events-none" aria-hidden="true" />
        </div>
      </section>
    </div>
  );
};
