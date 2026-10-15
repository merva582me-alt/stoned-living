import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Search as SearchIcon, 
  X, 
  Loader2, 
  Play, 
  Info, 
  Plus, 
  Check, 
  Star, 
  ChevronLeft, 
  ChevronRight 
} from 'lucide-react';
import { MediaItem } from '../types';
import { MediaCard } from './MediaCard';
import { 
  searchMedia, 
  discoverMedia, 
  fetchTrending, 
  fetchTopRated 
} from '../services/api';
import { toggleWatchlist, isItemInWatchlist } from '../services/storage';
import { toast } from 'sonner';

interface SearchViewProps {
  onOpenDetails: (item: MediaItem) => void;
  onPlayMedia: (item: MediaItem) => void;
}

// ── Exact popular searches from reference screenshots ──
const POPULAR_SEARCH_KEYWORDS = [
  'LINK CLICK',
  'VisionQuest',
  'Carrie',
  'Animals',
  'Matchbox the Movie',
  'Spider-Man: Brand New Day',
  'Street Fighter',
  'Crystal Lake',
  'Hope',
  'Whalefall',
  'Practical Magic 2',
  'Below',
  'Lanterns',
  'Clayface',
  'Buddy',
  'Other Mommy',
  'Resident Evil',
  'Avengers: Doomsday',
  'Love of Your Life',
  'Digger',
];

// ── Horizontal Carousel Shelf with < and > Controls (Matches Home Page ShelfSection 1:1) ──
interface ShelfProps {
  title: string;
  items: MediaItem[];
  loading?: boolean;
  onOpenDetails: (item: MediaItem) => void;
  onPlayMedia: (item: MediaItem) => void;
}

const SearchCarouselShelf: React.FC<ShelfProps> = ({
  title,
  items,
  loading,
  onOpenDetails,
  onPlayMedia,
}) => {
  const shelfRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (shelfRef.current) {
      const amount = (direction === 'left' ? -1 : 1) * Math.max(shelfRef.current.clientWidth * 0.75, 300);
      shelfRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-8 sm:space-y-10">
      {/* Section Separator */}
      <div className="px-6 sm:px-8 lg:px-10" aria-hidden="true">
        <div className="border-t border-zinc-800/80" />
      </div>

      <section className="space-y-4">
        {/* Header with Title and Scroll Arrows */}
        <div className="flex items-center justify-between px-6 sm:px-8 lg:px-10">
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            {title}
          </h2>

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
          ref={shelfRef}
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
                <div
                  key={item.id}
                  className="w-36 sm:w-44 md:w-48 lg:w-52 shrink-0"
                >
                  <MediaCard
                    item={item}
                    isRecentlyAdded={idx === 1 || idx === 5}
                    onOpenDetails={onOpenDetails}
                    onPlay={onPlayMedia}
                  />
                </div>
              ))}
          <div className="shrink-0 w-8 sm:w-12 pointer-events-none" aria-hidden="true" />
        </div>
      </section>
    </div>
  );
};

export const SearchView: React.FC<SearchViewProps> = ({
  onOpenDetails,
  onPlayMedia,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MediaItem[]>([]);
  const [searching, setSearching] = useState(false);

  // ── Multi-genre shelves for zero-state (Screenshots 2 to 10) ──
  const [horrorItems, setHorrorItems] = useState<MediaItem[]>([]);
  const [actionItems, setActionItems] = useState<MediaItem[]>([]);
  const [comedyItems, setComedyItems] = useState<MediaItem[]>([]);
  const [romanceItems, setRomanceItems] = useState<MediaItem[]>([]);
  const [scifiItems, setScifiItems] = useState<MediaItem[]>([]);
  const [thrillerItems, setThrillerItems] = useState<MediaItem[]>([]);
  const [animationItems, setAnimationItems] = useState<MediaItem[]>([]);
  const [documentaryItems, setDocumentaryItems] = useState<MediaItem[]>([]);
  const [popularTvItems, setPopularTvItems] = useState<MediaItem[]>([]);
  const [tvActionItems, setTvActionItems] = useState<MediaItem[]>([]);
  const [tvComedyItems, setTvComedyItems] = useState<MediaItem[]>([]);
  const [tvDramaItems, setTvDramaItems] = useState<MediaItem[]>([]);
  const [topRatedMovies, setTopRatedMovies] = useState<MediaItem[]>([]);
  const [popularWeekItems, setPopularWeekItems] = useState<MediaItem[]>([]);
  const [recentMovies, setRecentMovies] = useState<MediaItem[]>([]);
  const [recentTv, setRecentTv] = useState<MediaItem[]>([]);
  const [highlyRated, setHighlyRated] = useState<MediaItem[]>([]);

  const [loadingShelves, setLoadingShelves] = useState(true);

  // Load browse shelves in parallel batches
  useEffect(() => {
    let isMounted = true;

    async function loadBrowseShelves() {
      try {
        // Batch 1: Primary visible genres
        const [h, act, com, rom, sci, thr] = await Promise.all([
          discoverMedia('movie', 27).catch(() => []),
          discoverMedia('movie', 28).catch(() => []),
          discoverMedia('movie', 35).catch(() => []),
          discoverMedia('movie', 10749).catch(() => []),
          discoverMedia('movie', 878).catch(() => []),
          discoverMedia('movie', 53).catch(() => []),
        ]);

        if (!isMounted) return;
        setHorrorItems(h);
        setActionItems(act);
        setComedyItems(com);
        setRomanceItems(rom);
        setScifiItems(sci);
        setThrillerItems(thr);
        setLoadingShelves(false);

        // Batch 2: TV & Curated shelves
        const [anim, doc, pTv, tvAct, tvCom, tvDrama, topM, popW, recM, recTv, highR] = await Promise.all([
          discoverMedia('movie', 16).catch(() => []),
          discoverMedia('movie', 99).catch(() => []),
          fetchTrending('tv', 'day').catch(() => []),
          discoverMedia('tv', 10759).catch(() => []),
          discoverMedia('tv', 35).catch(() => []),
          discoverMedia('tv', 18).catch(() => []),
          fetchTopRated('movie').catch(() => []),
          fetchTrending('movie', 'week').catch(() => []),
          discoverMedia('movie', undefined).catch(() => []),
          discoverMedia('tv', undefined).catch(() => []),
          fetchTopRated('tv').catch(() => []),
        ]);

        if (!isMounted) return;
        setAnimationItems(anim);
        setDocumentaryItems(doc);
        setPopularTvItems(pTv);
        setTvActionItems(tvAct);
        setTvComedyItems(tvCom);
        setTvDramaItems(tvDrama);
        setTopRatedMovies(topM);
        setPopularWeekItems(popW);
        setRecentMovies(recM);
        setRecentTv(recTv);
        setHighlyRated(highR);
      } catch (err) {
        console.error('Error loading search shelves:', err);
      }
    }

    loadBrowseShelves();
    return () => {
      isMounted = false;
    };
  }, []);

  // Perform search query
  const performSearch = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    try {
      const res = await searchMedia(trimmed);
      setResults(res || []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  // Debounced search on input change
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, performSearch]);

  const handleSelectTag = (tag: string) => {
    setQuery(tag);
    performSearch(tag);
  };

  // Top Match isolation
  const topMatch = results.length > 0 ? results[0] : null;
  const moreResults = results.length > 1 ? results.slice(1) : [];

  const topMatchTitle = topMatch ? (topMatch.title || topMatch.name || 'Untitled') : '';
  const topMatchRating = topMatch ? (topMatch.vote_average || 8.0).toFixed(1) : '8.0';
  const topMatchYear = topMatch ? ((topMatch.release_date || topMatch.first_air_date)?.split('-')[0] || '2026') : '';
  const topMatchIsTv = topMatch ? (topMatch.media_type === 'tv' || Boolean(topMatch.first_air_date)) : false;
  const topMatchPoster = topMatch?.poster_path
    ? (topMatch.poster_path.startsWith('http') ? topMatch.poster_path : `https://image.tmdb.org/t/p/w500${topMatch.poster_path}`)
    : (topMatch?.backdrop_path ? `https://image.tmdb.org/t/p/w780${topMatch.backdrop_path}` : '');

  const [topInWatchlist, setTopInWatchlist] = useState(false);
  useEffect(() => {
    if (topMatch) {
      setTopInWatchlist(isItemInWatchlist(topMatch.id));
    }
  }, [topMatch]);

  const handleToggleTopWatchlist = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!topMatch) return;
    const res = toggleWatchlist(topMatch);
    setTopInWatchlist(res.inList);
    toast(res.inList ? 'Saved to Watchlist' : 'Removed from Watchlist');
  };

  return (
    <div className="w-full min-h-screen bg-[#050806] text-white pt-6 sm:pt-8 pb-28 selection:bg-emerald-500 selection:text-black">
      {/* ── Search Input Box (Padded to match content alignment) ── */}
      <div className="w-full px-6 sm:px-8 lg:px-10 mb-8 max-w-[1800px]">
        <div className="relative w-full">
          <div className="relative flex items-center w-full h-12 sm:h-14 bg-[#0a100c] border border-zinc-800/80 rounded-2xl px-5 text-white shadow-2xl focus-within:border-zinc-500 focus-within:ring-1 focus-within:ring-zinc-500 transition-all">
            <SearchIcon className="w-5 h-5 text-zinc-400 shrink-0 mr-3.5" />
            <input
              type="text"
              placeholder="Search ..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full h-full bg-transparent text-white text-sm sm:text-base placeholder-zinc-500 outline-none font-medium"
              autoFocus
            />
            {searching ? (
              <Loader2 className="w-5 h-5 text-emerald-400 animate-spin shrink-0" />
            ) : query ? (
              <button
                onClick={() => setQuery('')}
                className="p-1 rounded-full text-zinc-400 hover:text-white transition cursor-pointer"
                title="Clear search"
              >
                <X className="w-5 h-5" />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* ── IF ACTIVE QUERY: SHOW TOP MATCH SPOTLIGHT + MORE RESULTS (Screenshot 1) ── */}
      {query.trim().length > 0 ? (
        <div className="w-full px-6 sm:px-8 lg:px-10 space-y-8 max-w-[1800px] animate-fadeIn">
          {searching && results.length === 0 ? (
              <div className="py-24 flex flex-col items-center justify-center space-y-3">
                <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
                <span className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-widest">
                  Searching catalog...
                </span>
              </div>
            ) : topMatch ? (
              <>
                {/* ── Top Result Spotlight Card (Screenshot 1) ── */}
                <div className="space-y-3">
                  <h2 className="text-xs sm:text-sm font-semibold text-zinc-400">
                    Top result
                  </h2>
                  <div className="flex flex-col sm:flex-row gap-5 lg:gap-8 items-start bg-[#0a100c] border border-zinc-800/80 rounded-2xl p-4 sm:p-6 lg:p-7 shadow-2xl relative transition-all">
                    {/* Poster Image */}
                    {topMatchPoster && (
                      <div
                        onClick={() => onOpenDetails(topMatch)}
                        className="w-36 sm:w-44 md:w-52 aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl shrink-0 border border-zinc-800 cursor-pointer group relative"
                      >
                        <img
                          src={topMatchPoster}
                          alt={topMatchTitle}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
                      </div>
                    )}

                    {/* Spotlight Content */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between self-stretch">
                      <div>
                        <span className="px-3 py-1 rounded-full bg-zinc-800 text-zinc-300 font-semibold text-xs inline-block mb-2">
                          Top match
                        </span>
                        <h1
                          onClick={() => onOpenDetails(topMatch)}
                          className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight cursor-pointer hover:text-emerald-400 transition-colors"
                        >
                          {topMatchTitle}
                        </h1>

                        {/* Metadata line */}
                        <div className="flex items-center gap-2 text-xs sm:text-sm text-zinc-400 mt-2 font-medium">
                          <span className="flex items-center gap-1 text-amber-400 font-bold">
                            <Star className="w-4 h-4 fill-amber-400" />
                            <span>{topMatchRating}</span>
                          </span>
                          <span className="text-zinc-600">·</span>
                          <span>{topMatchYear}</span>
                          <span className="text-zinc-600">·</span>
                          <span className="capitalize">{topMatchIsTv ? 'TV Show' : 'Movie'}</span>
                        </div>

                        {/* Overview Synopsis */}
                        <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed mt-3 max-w-2xl line-clamp-3 sm:line-clamp-4">
                          {topMatch.overview || 'No synopsis available for this title.'}
                        </p>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-3 mt-6 flex-wrap">
                        <button
                          onClick={() => onPlayMedia(topMatch)}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-[#00df82] text-black font-bold text-xs sm:text-sm transition cursor-pointer shadow-[0_0_15px_rgba(0,223,130,0.3)]"
                        >
                          <Play className="w-4 h-4 fill-black" />
                          <span>Play</span>
                        </button>
                        <button
                          onClick={() => onOpenDetails(topMatch)}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-xs sm:text-sm transition cursor-pointer"
                        >
                          <Info className="w-4 h-4" />
                          <span>Details</span>
                        </button>
                        <button
                          onClick={handleToggleTopWatchlist}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-800/90 hover:bg-zinc-700 text-white font-bold text-xs sm:text-sm border border-zinc-700 transition cursor-pointer"
                        >
                          {topInWatchlist ? (
                            <>
                              <Check className="w-4 h-4 text-emerald-400" />
                              <span>Watchlist</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-4 h-4" />
                              <span>Watchlist</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── More results Section (Screenshot 1) ── */}
                {moreResults.length > 0 && (
                  <div className="space-y-4 pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-xl sm:text-2xl font-black text-white">More results</h2>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          More titles matching &ldquo;{query}&rdquo;
                        </p>
                      </div>
                      <span className="px-3 py-1 rounded-full bg-zinc-800/90 border border-zinc-700 text-xs font-mono text-zinc-300">
                        {results.length} results
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-3 sm:gap-4 lg:gap-5">
                      {moreResults.map((item) => (
                        <MediaCard
                          key={item.id}
                          item={item}
                          onOpenDetails={onOpenDetails}
                          onPlay={onPlayMedia}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="py-24 text-center space-y-3">
                <p className="text-lg font-bold text-zinc-300">
                  No titles found for &ldquo;{query}&rdquo;
                </p>
                <p className="text-xs text-zinc-500">
                  Try checking spelling or exploring popular searches below.
                </p>
              </div>
            )}
          </div>
        ) : (
          /* ── ZERO-STATE: POPULAR SEARCHES PILLS + FULL GENRE CAROUSEL SHELVES (Screenshots 2 to 10) ── */
          <div className="space-y-8 sm:space-y-10 animate-fadeIn w-full">
            {/* Popular Searches Pills */}
            <div className="w-full px-6 sm:px-8 lg:px-10 space-y-3 max-w-[1800px]">
              <h3 className="text-xs font-semibold text-zinc-400">
                Popular searches
              </h3>
              <div className="flex flex-wrap gap-2 pt-0.5">
                {POPULAR_SEARCH_KEYWORDS.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => handleSelectTag(tag)}
                    className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition cursor-pointer"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Complete Multi-Genre Horizontal Shelves (Edge-to-Edge like Home Page) */}
            <div className="space-y-8 sm:space-y-10 pt-2 w-full">
              <SearchCarouselShelf
                title="Horror"
                items={horrorItems}
                loading={loadingShelves}
                onOpenDetails={onOpenDetails}
                onPlayMedia={onPlayMedia}
              />

              <SearchCarouselShelf
                title="Action"
                items={actionItems}
                loading={loadingShelves}
                onOpenDetails={onOpenDetails}
                onPlayMedia={onPlayMedia}
              />

              <SearchCarouselShelf
                title="Comedy"
                items={comedyItems}
                loading={loadingShelves}
                onOpenDetails={onOpenDetails}
                onPlayMedia={onPlayMedia}
              />

              <SearchCarouselShelf
                title="Romance"
                items={romanceItems}
                loading={loadingShelves}
                onOpenDetails={onOpenDetails}
                onPlayMedia={onPlayMedia}
              />

              <SearchCarouselShelf
                title="Sci-Fi"
                items={scifiItems}
                loading={loadingShelves}
                onOpenDetails={onOpenDetails}
                onPlayMedia={onPlayMedia}
              />

              <SearchCarouselShelf
                title="Thriller"
                items={thrillerItems}
                loading={loadingShelves}
                onOpenDetails={onOpenDetails}
                onPlayMedia={onPlayMedia}
              />

              <SearchCarouselShelf
                title="Animation"
                items={animationItems}
                loading={loadingShelves}
                onOpenDetails={onOpenDetails}
                onPlayMedia={onPlayMedia}
              />

              <SearchCarouselShelf
                title="Documentary"
                items={documentaryItems}
                loading={loadingShelves}
                onOpenDetails={onOpenDetails}
                onPlayMedia={onPlayMedia}
              />

              <SearchCarouselShelf
                title="Popular TV"
                items={popularTvItems}
                loading={loadingShelves}
                onOpenDetails={onOpenDetails}
                onPlayMedia={onPlayMedia}
              />

              <SearchCarouselShelf
                title="TV Action"
                items={tvActionItems}
                loading={loadingShelves}
                onOpenDetails={onOpenDetails}
                onPlayMedia={onPlayMedia}
              />

              <SearchCarouselShelf
                title="TV Comedy"
                items={tvComedyItems}
                loading={loadingShelves}
                onOpenDetails={onOpenDetails}
                onPlayMedia={onPlayMedia}
              />

              <SearchCarouselShelf
                title="TV Drama"
                items={tvDramaItems}
                loading={loadingShelves}
                onOpenDetails={onOpenDetails}
                onPlayMedia={onPlayMedia}
              />

              <SearchCarouselShelf
                title="Top Rated Movies"
                items={topRatedMovies}
                loading={loadingShelves}
                onOpenDetails={onOpenDetails}
                onPlayMedia={onPlayMedia}
              />

              <SearchCarouselShelf
                title="Popular This Week"
                items={popularWeekItems}
                loading={loadingShelves}
                onOpenDetails={onOpenDetails}
                onPlayMedia={onPlayMedia}
              />

              <SearchCarouselShelf
                title="Recent Movies"
                items={recentMovies}
                loading={loadingShelves}
                onOpenDetails={onOpenDetails}
                onPlayMedia={onPlayMedia}
              />

              <SearchCarouselShelf
                title="Recent TV"
                items={recentTv}
                loading={loadingShelves}
                onOpenDetails={onOpenDetails}
                onPlayMedia={onPlayMedia}
              />

              <SearchCarouselShelf
                title="Highly Rated"
                items={highlyRated}
                loading={loadingShelves}
                onOpenDetails={onOpenDetails}
                onPlayMedia={onPlayMedia}
              />
            </div>
          </div>
        )}
    </div>
  );
};
