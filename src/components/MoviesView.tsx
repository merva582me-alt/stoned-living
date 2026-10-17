import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Zap, 
  Ghost, 
  Compass, 
  Smile, 
  Shield, 
  FileText, 
  Heart, 
  Users, 
  Sparkles,
  SlidersHorizontal,
  Flame,
  Loader2
} from 'lucide-react';
import { MediaItem, AdvanceFilters, DEFAULT_ADVANCE_FILTERS } from '../types';
import { MediaCard } from './MediaCard';
import { discoverMediaPaginated } from '../services/api';
import { AdvanceFilterDrawer } from './AdvanceFilterDrawer';

interface MoviesViewProps {
  onOpenDetails: (item: MediaItem) => void;
  onPlayMedia: (item: MediaItem) => void;
}

const GENRE_FILTERS = [
  { id: 'all', name: 'All Movies', icon: Flame },
  { id: 28, name: 'Action', icon: Zap },
  { id: 27, name: 'Horror', icon: Ghost },
  { id: 12, name: 'Adventure', icon: Compass },
  { id: 16, name: 'Animation', icon: Sparkles },
  { id: 35, name: 'Comedy', icon: Smile },
  { id: 80, name: 'Crime', icon: Shield },
  { id: 99, name: 'Documentary', icon: FileText },
  { id: 18, name: 'Drama', icon: Heart },
  { id: 10751, name: 'Family', icon: Users },
];

export const MoviesView: React.FC<MoviesViewProps> = ({
  onOpenDetails,
  onPlayMedia,
}) => {
  const [selectedGenre, setSelectedGenre] = useState<string | number>('all');
  const [advanceFilters, setAdvanceFilters] = useState<AdvanceFilters>(DEFAULT_ADVANCE_FILTERS);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const [movies, setMovies] = useState<MediaItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalResults, setTotalResults] = useState(9999);

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Helper to compile API discovery params
  const buildApiParams = useCallback((genre: string | number, adv: AdvanceFilters) => {
    const p: Record<string, string> = {
      sort_by: adv.sortBy,
    };
    if (genre !== 'all') {
      p.with_genres = String(genre);
    }
    if (adv.year) {
      if (adv.year === '2010s') {
        p['primary_release_date.gte'] = '2010-01-01';
        p['primary_release_date.lte'] = '2019-12-31';
      } else {
        p.primary_release_year = adv.year;
      }
    }
    if (adv.minRating > 0) {
      p['vote_average.gte'] = String(adv.minRating);
      p['vote_count.gte'] = '30';
    }
    if (adv.companyId) {
      p.with_companies = adv.companyId;
    }
    if (adv.language) {
      p.with_original_language = adv.language;
    }
    return p;
  }, []);

  // Fetch initial page 1 when genre or advance filters change
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setPage(1);
    setHasMore(true);

    const params = buildApiParams(selectedGenre, advanceFilters);
    discoverMediaPaginated('movie', params, 1)
      .then((res) => {
        if (!isMounted) return;
        setMovies(res.results);
        setTotalResults(res.totalResults);
        setHasMore(res.page < res.totalPages && res.results.length > 0);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load initial movies batch:', err);
        if (!isMounted) return;
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedGenre, advanceFilters, buildApiParams]);

  // Load subsequent page when user scrolls
  const loadNextPage = useCallback(async () => {
    if (loading || loadingMore || !hasMore) return;
    setLoadingMore(true);

    const nextPage = page + 1;
    const params = buildApiParams(selectedGenre, advanceFilters);

    try {
      const res = await discoverMediaPaginated('movie', params, nextPage);
      if (res.results.length > 0) {
        setMovies((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const deduplicated = res.results.filter((m) => !existingIds.has(m.id));
          return [...prev, ...deduplicated];
        });
        setPage(nextPage);
        setHasMore(nextPage < res.totalPages && res.results.length > 0);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('Failed to load endless movies page:', err);
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [page, loading, loadingMore, hasMore, selectedGenre, advanceFilters, buildApiParams]);

  // Infinite Scroll Sentinel using IntersectionObserver
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first.isIntersecting && hasMore && !loading && !loadingMore) {
          loadNextPage();
        }
      },
      {
        root: null,
        rootMargin: '600px', // Trigger fetch 600px ahead for buttery-smooth endless streaming
        threshold: 0.05,
      }
    );

    observer.observe(sentinel);
    return () => {
      observer.disconnect();
    };
  }, [loadNextPage, hasMore, loading, loadingMore]);

  // Active filter count for badge
  const activeFilterCount = [
    advanceFilters.sortBy !== DEFAULT_ADVANCE_FILTERS.sortBy,
    advanceFilters.year !== DEFAULT_ADVANCE_FILTERS.year,
    advanceFilters.minRating !== DEFAULT_ADVANCE_FILTERS.minRating,
    advanceFilters.companyId !== DEFAULT_ADVANCE_FILTERS.companyId,
    advanceFilters.language !== DEFAULT_ADVANCE_FILTERS.language,
  ].filter(Boolean).length;

  return (
    <div className="w-full min-h-screen bg-[#050806] text-white pt-6 sm:pt-8 pb-24 px-4 sm:px-8 lg:px-12 xl:px-16 selection:bg-emerald-500 selection:text-black">
      <div className="w-full space-y-6">
        {/* ── Page Header (Screenshot 4) ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Movies
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">
              Explore movies, from new releases to timeless favorites.
            </p>
          </div>

          {/* Quick Counter */}
          <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono shrink-0 self-start sm:self-auto bg-[#0c1410] px-3 py-1.5 rounded-lg border border-emerald-500/15">
            <span>Total results:</span>
            <span className="text-emerald-400 font-bold">400,000+</span>
          </div>
        </div>

        {/* ── Genre Filter Bar & Advance Filter Trigger (Screenshot 4) ── */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-zinc-900 pb-5">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            {GENRE_FILTERS.map((genre) => {
              const Icon = genre.icon;
              const isActive = selectedGenre === genre.id;
              return (
                <button
                  key={genre.id}
                  onClick={() => setSelectedGenre(genre.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? 'bg-emerald-500 text-black shadow-[0_0_15px_#00FF9D]'
                      : 'bg-[#0c1410] text-zinc-300 hover:text-white hover:bg-zinc-800 border border-emerald-500/15'
                  }`}
                >
                  <span>{genre.name}</span>
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-black' : 'text-zinc-400'}`} />
                </button>
              );
            })}
          </div>

          {/* Advance Filter Drawer Button */}
          <button
            onClick={() => setIsFilterOpen(true)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
              activeFilterCount > 0
                ? 'bg-emerald-500 text-black shadow-[0_0_15px_#00FF9D]'
                : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Advance Filter</span>
            {activeFilterCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-black text-emerald-400 text-[10px] font-black flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* ── Fluid Multi-Device Movie Poster Grid with Endless Scrolling ── */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-3 sm:gap-4 lg:gap-5">
            {Array.from({ length: 16 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[2/3] rounded-xl bg-zinc-900/60 animate-pulse border border-zinc-800"
              />
            ))}
          </div>
        ) : movies.length > 0 ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-3 sm:gap-4 lg:gap-5">
              {movies.map((item, idx) => (
                <MediaCard
                  key={`${item.id}-${idx}`}
                  item={item}
                  isRecentlyAdded={idx === 1 || idx === 4}
                  onOpenDetails={onOpenDetails}
                  onPlay={onPlayMedia}
                />
              ))}
            </div>

            {/* Endless Scroll Sentinel Element */}
            <div ref={sentinelRef} className="h-6 w-full flex items-center justify-center" />

            {/* Loading More Spinner & Skeleton Strip */}
            {loadingMore && (
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-center gap-2 text-xs text-emerald-400 font-mono">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                  <span>Loading more titles...</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-3 sm:gap-4 lg:gap-5 opacity-70">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div
                      key={`skeleton-more-${i}`}
                      className="aspect-[2/3] rounded-xl bg-zinc-900/70 animate-pulse border border-emerald-500/20"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Reached End of Catalog */}
            {!hasMore && movies.length > 0 && (
              <div className="py-12 text-center border-t border-zinc-900/80">
                <p className="text-zinc-500 text-xs font-mono">
                  ✨ You have reached the end of the collection ({movies.length} movies loaded)
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="py-24 text-center space-y-3">
            <p className="text-zinc-400 font-bold">No movies found matching these criteria.</p>
            {activeFilterCount > 0 && (
              <button
                onClick={() => {
                  setAdvanceFilters(DEFAULT_ADVANCE_FILTERS);
                  setSelectedGenre('all');
                }}
                className="text-xs text-emerald-400 hover:underline cursor-pointer font-semibold"
              >
                Reset all filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Slide-over Advance Filter Drawer ── */}
      <AdvanceFilterDrawer
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        type="movie"
        filters={advanceFilters}
        onChangeFilters={setAdvanceFilters}
        onResetFilters={() => setAdvanceFilters(DEFAULT_ADVANCE_FILTERS)}
        totalResults={totalResults}
      />
    </div>
  );
};
