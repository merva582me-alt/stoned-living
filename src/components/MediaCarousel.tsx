import React, { useRef, useState, useEffect } from 'react';
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
  onToggleWatchlist: (item: MediaItem) => void;
  watchlistIds: number[];
  loading?: boolean;
}

export const MediaCarousel: React.FC<MediaCarouselProps> = ({
  title,
  subtitle,
  icon: Icon,
  items,
  onPlay,
  onOpenDetails,
  onToggleWatchlist,
  watchlistIds,
  loading = false
}) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftStart, setScrollLeftStart] = useState(0);
  const [hasDragged, setHasDragged] = useState(false);

  // Smooth Left/Right Arrow Navigation
  const handleScroll = (direction: 'left' | 'right') => {
    if (rowRef.current) {
      const { scrollLeft, clientWidth } = rowRef.current;
      const scrollAmount = clientWidth * 0.75;
      rowRef.current.scrollTo({
        left: direction === 'left' ? scrollLeft - scrollAmount : scrollLeft + scrollAmount,
        behavior: 'smooth'
      });
    }
  };


  // Click & Drag Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!rowRef.current) return;
    setIsMouseDown(true);
    setHasDragged(false);
    setStartX(e.pageX - rowRef.current.offsetLeft);
    setScrollLeftStart(rowRef.current.scrollLeft);
  };

  const handleMouseLeave = () => {
    setIsMouseDown(false);
  };

  const handleMouseUp = () => {
    setIsMouseDown(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDown || !rowRef.current) return;
    const x = e.pageX - rowRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    if (Math.abs(walk) > 5) {
      setHasDragged(true);
    }
    rowRef.current.scrollLeft = scrollLeftStart - walk;
  };

  const handleCardClick = (item: MediaItem, action: () => void) => {
    if (!hasDragged) {
      action();
    }
  };

  const cardWidthClasses =
    'w-[145px] xs:w-[160px] sm:w-[calc(33.3%-10px)] md:w-[calc(25%-12px)] lg:w-[calc(20%-13px)] xl:w-[calc(16.66%-13.5px)] 2xl:w-[calc(12.5%-14px)] flex-shrink-0 min-w-[135px]';

  return (
    <section className="relative my-8 group/carousel [content-visibility:auto] [contain-intrinsic-size:1px_280px]">
      {/* Header */}
      <div className="flex items-end justify-between px-2 mb-3 sm:mb-4">
        <div>
          <div className="flex items-center gap-2">
            {Icon && <Icon className="w-5 h-5 text-emerald-400 shrink-0" />}
            <h2 className="text-lg sm:text-xl md:text-2xl font-black text-white tracking-tight">
              {title}
            </h2>
          </div>
          {subtitle && (
            <p className="text-xs text-emerald-500/80 font-medium mt-0.5">{subtitle}</p>
          )}
        </div>

        {/* Arrow Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleScroll('left')}
            className="p-2 rounded-xl bg-[#121915] border border-emerald-500/20 hover:border-emerald-400 text-zinc-300 hover:text-white transition-all shadow-md active:scale-95"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleScroll('right')}
            className="p-2 rounded-xl bg-[#121915] border border-emerald-500/20 hover:border-emerald-400 text-zinc-300 hover:text-white transition-all shadow-md active:scale-95"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scrollable Container */}
      <div
        ref={rowRef}
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeave}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        className={`flex items-stretch gap-3 sm:gap-4 overflow-x-auto scrollbar-none scroll-smooth pb-4 pt-2 px-1 sm:px-2 select-none ${
          isMouseDown ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {loading || (!items.length && loading !== false)
          ? Array.from({ length: 7 }).map((_, idx) => (
              <div
                key={idx}
                className={`${cardWidthClasses} aspect-[2/3] rounded-2xl bg-[#0c130e] border border-emerald-950 animate-pulse flex flex-col justify-between p-3`}
              >
                <div className="w-12 h-4 bg-emerald-950/60 rounded-md" />
                <div className="space-y-2">
                  <div className="w-3/4 h-4 bg-emerald-950/80 rounded" />
                  <div className="w-1/2 h-3 bg-emerald-950/40 rounded" />
                </div>
              </div>
            ))
          : items.map((item) => (
              <div
                key={`${item.media_type || 'm'}_${item.id}`}
                className={cardWidthClasses}
                onClick={(e) => {
                  if (hasDragged) {
                    e.stopPropagation();
                    e.preventDefault();
                  }
                }}
              >
                <MediaCard
                  item={item}
                  onOpenDetails={(i) => handleCardClick(i, () => onOpenDetails(i))}
                  className="w-full h-full"
                />
              </div>
            ))}
      </div>
    </section>
  );
};
