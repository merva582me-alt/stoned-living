import React, { useState, useEffect, useRef } from 'react';
import {
  Tv,
  Flame,
  Star,
  Play,
  Plus,
  Check,
  Info,
  Clock,
  Sparkles,
  Trophy,
  Crown,
  Shield,
  Smile,
  Film,
  Atom,
  Wand2,
  Ghost,
  ShieldAlert,
  HelpCircle,
  Palette,
  Compass,
  Radio,
  Baby,
  Layers,
  SlidersHorizontal,
  Grid,
  LucideIcon
} from 'lucide-react';
import { MediaItem, UserProfile } from '../types';
import { MediaCarousel } from './MediaCarousel';
import { MediaCard } from './MediaCard';
import {
  fetchTrending,
  fetchCategoryList,
  fetchTopRated,
  discoverMedia,
  discoverMediaAdvanced
} from '../services/api';

interface TvViewProps {
  user: UserProfile;
  onPlayMedia: (item: MediaItem) => void;
  onInspectItem: (item: MediaItem) => void;
  onToggleWatchlist: (item: MediaItem) => void;
}

interface TvSectionConfig {
  id: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  fetcher: () => Promise<MediaItem[]>;
}

const tvCache: Record<string, MediaItem[]> = {};

export const TvView: React.FC<TvViewProps> = ({
  user,
  onPlayMedia,
  onInspectItem,
  onToggleWatchlist
}) => {
  const [sectionData, setSectionData] = useState<Record<string, MediaItem[]>>(tvCache);
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [heroIndex, setHeroIndex] = useState(0);

  // Filter Toolbar State
  const [sortBy, setSortBy] = useState<'popularity.desc' | 'vote_average.desc' | 'first_air_date.desc'>('popularity.desc');
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedRating, setSelectedRating] = useState<string>('all');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'carousels' | 'grid'>('carousels');

  // Grid Catalog Pagination State
  const [gridItems, setGridItems] = useState<MediaItem[]>([]);
  const [gridPage, setGridPage] = useState(1);
  const [loadingGrid, setLoadingGrid] = useState(false);
  const [hasMoreGrid, setHasMoreGrid] = useState(true);

  const isMountedRef = useRef(true);

  // 20 Horizontal TV Sections
  const tvSections: TvSectionConfig[] = [
    {
      id: '1_trending_tv',
      title: 'Trending TV Shows',
      subtitle: 'Most popular series currently streaming today',
      icon: Flame,
      fetcher: () => fetchTrending('tv', 'week')
    },
    {
      id: '2_popular_tv',
      title: 'Popular TV Shows',
      subtitle: 'Binge-worthy series trending across all networks',
      icon: Sparkles,
      fetcher: () => fetchCategoryList('tv', 'popular')
    },
    {
      id: '3_top_rated_tv',
      title: 'Top Rated TV Shows',
      subtitle: 'Highest rated television series of all time',
      icon: Trophy,
      fetcher: () => fetchTopRated('tv')
    },
    {
      id: '4_airing_today',
      title: 'Airing Today',
      subtitle: 'Brand new episodes airing today',
      icon: Clock,
      fetcher: () => fetchCategoryList('tv', 'airing_today')
    },
    {
      id: '5_currently_airing',
      title: 'Currently Airing',
      subtitle: 'Series actively broadcasting current seasons',
      icon: Radio,
      fetcher: () => fetchCategoryList('tv', 'on_the_air')
    },
    {
      id: '6_recently_released_shows',
      title: 'Recently Released Shows',
      subtitle: 'New series released in 2025 and 2026',
      icon: Tv,
      fetcher: () =>
        discoverMediaAdvanced('tv', {
          'first_air_date.gte': '2025-01-01',
          sort_by: 'first_air_date.desc'
        })
    },
    {
      id: '7_best_shows_all_time',
      title: 'Best TV Shows Of All Time',
      subtitle: 'Iconic television classics with legendary ratings',
      icon: Crown,
      fetcher: () =>
        discoverMediaAdvanced('tv', {
          'vote_average.gte': '8.0',
          'vote_count.gte': '1000',
          sort_by: 'vote_average.desc'
        })
    },
    {
      id: '8_crime_shows',
      title: 'Crime Shows',
      subtitle: 'Gritty mob sagas, detective thrillers, and heists',
      icon: Shield,
      fetcher: () => discoverMedia('tv', 80)
    },
    {
      id: '9_comedy_shows',
      title: 'Comedy Shows',
      subtitle: 'Sitcoms, standup specials, and hilarious series',
      icon: Smile,
      fetcher: () => discoverMedia('tv', 35)
    },
    {
      id: '10_drama_shows',
      title: 'Drama Shows',
      subtitle: 'Intense character dramas and emotional sagas',
      icon: Film,
      fetcher: () => discoverMedia('tv', 18)
    },
    {
      id: '11_scifi_shows',
      title: 'Sci-Fi Shows',
      subtitle: 'Space operas, cybernetic futures, and alien mysteries',
      icon: Atom,
      fetcher: () => discoverMedia('tv', 10765)
    },
    {
      id: '12_fantasy_shows',
      title: 'Fantasy Shows',
      subtitle: 'Mythic realms, dragons, and high fantasy television',
      icon: Wand2,
      fetcher: () =>
        discoverMediaAdvanced('tv', {
          with_genres: '10765',
          sort_by: 'popularity.desc'
        })
    },
    {
      id: '13_horror_shows',
      title: 'Horror Shows',
      subtitle: 'Supernatural thrillers, zombie apocalypses, and chills',
      icon: Ghost,
      fetcher: () => discoverMedia('tv', 9648)
    },
    {
      id: '14_thriller_shows',
      title: 'Thriller Shows',
      subtitle: 'Edge-of-your-seat suspense and conspiracy sagas',
      icon: ShieldAlert,
      fetcher: () => discoverMedia('tv', 10759)
    },
    {
      id: '15_mystery_shows',
      title: 'Mystery Shows',
      subtitle: 'Puzzling whodunits, investigative thrillers, and mind benders',
      icon: HelpCircle,
      fetcher: () => discoverMedia('tv', 9648)
    },
    {
      id: '16_animation_shows',
      title: 'Animation Shows',
      subtitle: 'Animated series for teens and adults',
      icon: Palette,
      fetcher: () => discoverMedia('tv', 16)
    },
    {
      id: '17_documentary_shows',
      title: 'Documentary Shows',
      subtitle: 'True crime, nature docuseries, and historical sagas',
      icon: Compass,
      fetcher: () => discoverMedia('tv', 99)
    },
    {
      id: '18_reality_shows',
      title: 'Reality Shows',
      subtitle: 'Competition series, docu-soaps, and unscripted drama',
      icon: Radio,
      fetcher: () => discoverMedia('tv', 10764)
    },
    {
      id: '19_kids_shows',
      title: 'Kids Shows',
      subtitle: 'Wholesome entertainment for younger audiences',
      icon: Baby,
      fetcher: () => discoverMedia('tv', 10762)
    },
    {
      id: '20_mini_series',
      title: 'Mini Series',
      subtitle: 'Self-contained limited event television series',
      icon: Layers,
      fetcher: () =>
        discoverMediaAdvanced('tv', {
          with_type: '3',
          sort_by: 'popularity.desc'
        })
    }
  ];

  useEffect(() => {
    isMountedRef.current = true;

    const loadSection = async (sec: TvSectionConfig) => {
      if (tvCache[sec.id] && tvCache[sec.id].length > 0) return;
      try {
        setLoadingMap((prev) => ({ ...prev, [sec.id]: true }));
        const items = await sec.fetcher();
        if (isMountedRef.current && items && items.length > 0) {
          const formatted = items.map((i) => ({ ...i, media_type: 'tv' as const }));
          tvCache[sec.id] = formatted;
          setSectionData((prev) => ({ ...prev, [sec.id]: formatted }));
        }
      } catch (err) {
        console.warn(`Error fetching ${sec.id}:`, err);
      } finally {
        if (isMountedRef.current) {
          setLoadingMap((prev) => ({ ...prev, [sec.id]: false }));
        }
      }
    };

    // Load top 4 sections immediately
    const topSections = tvSections.slice(0, 4);
    const remainingSections = tvSections.slice(4);

    topSections.forEach((sec) => loadSection(sec));

    // Stream remaining sections in small batches
    const chunkSize = 4;
    for (let i = 0; i < remainingSections.length; i += chunkSize) {
      const chunk = remainingSections.slice(i, i + chunkSize);
      const delay = 150 * Math.floor(i / chunkSize) + 200;
      setTimeout(() => {
        if (isMountedRef.current) {
          chunk.forEach((sec) => loadSection(sec));
        }
      }, delay);
    }

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Featured Hero TV Show
  const featuredPool =
    sectionData['1_trending_tv']?.slice(0, 5) ||
    sectionData['2_popular_tv']?.slice(0, 5) ||
    [];
  const featuredItem = featuredPool[heroIndex % (featuredPool.length || 1)] || featuredPool[0];

  useEffect(() => {
    if (!featuredPool.length) return;
    const interval = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % featuredPool.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [featuredPool.length]);

  // Fetch grid catalog data
  const fetchGridData = async (pageToFetch: number, reset = false) => {
    setLoadingGrid(true);
    const params: Record<string, string> = {
      page: String(pageToFetch),
      sort_by: sortBy
    };

    if (selectedGenre !== 'all') params.with_genres = selectedGenre;
    if (selectedYear !== 'all') {
      if (selectedYear === '2025') params['first_air_date.gte'] = '2025-01-01';
      else if (selectedYear === '2024') {
        params['first_air_date.gte'] = '2024-01-01';
        params['first_air_date.lte'] = '2024-12-31';
      } else if (selectedYear === '2020s') params['first_air_date.gte'] = '2020-01-01';
      else if (selectedYear === 'classics') params['first_air_date.lte'] = '2015-01-01';
    }
    if (selectedRating !== 'all') params['vote_average.gte'] = selectedRating;
    if (selectedLanguage !== 'all') params.with_original_language = selectedLanguage;

    const res = await discoverMediaAdvanced('tv', params);
    if (!isMountedRef.current) return;

    const formatted = res.map((m) => ({ ...m, media_type: 'tv' as const }));

    if (reset) {
      setGridItems(formatted);
      setGridPage(1);
    } else {
      setGridItems((prev) => {
        const existingIds = new Set(prev.map((i) => i.id));
        const newUnique = formatted.filter((i) => !existingIds.has(i.id));
        return [...prev, ...newUnique];
      });
    }

    setHasMoreGrid(formatted.length >= 10);
    setLoadingGrid(false);
  };

  useEffect(() => {
    if (
      selectedGenre !== 'all' ||
      selectedYear !== 'all' ||
      selectedRating !== 'all' ||
      selectedLanguage !== 'all' ||
      sortBy !== 'popularity.desc' ||
      viewMode === 'grid'
    ) {
      fetchGridData(1, true);
    }
  }, [selectedGenre, selectedYear, selectedRating, selectedLanguage, sortBy, viewMode]);

  const activeFilterCount =
    (selectedGenre !== 'all' ? 1 : 0) +
    (selectedYear !== 'all' ? 1 : 0) +
    (selectedRating !== 'all' ? 1 : 0) +
    (selectedLanguage !== 'all' ? 1 : 0) +
    (sortBy !== 'popularity.desc' ? 1 : 0);

  const isFilterActive = activeFilterCount > 0 || viewMode === 'grid';
  const isWatchlisted = featuredItem ? user.watchlist.some(id => Number(id) === Number(featuredItem.id)) : false;

  return (
    <div className="space-y-10 px-4 sm:px-6 lg:px-10 w-full max-w-[1920px] mx-auto pt-4 pb-4">
      {/* FEATURED TV HERO SECTION */}
      {featuredItem ? (
        <section className="relative w-full rounded-3xl overflow-hidden bg-black border border-emerald-950 shadow-[0_0_50px_rgba(16,185,129,0.1)] min-h-[440px] sm:min-h-[520px] flex items-end">
          {/* Backdrop Image */}
          <div className="absolute inset-0">
            <img
              src={
                featuredItem.backdrop_path
                  ? `https://image.tmdb.org/t/p/original${featuredItem.backdrop_path}`
                  : featuredItem.poster_path
                  ? `https://image.tmdb.org/t/p/original${featuredItem.poster_path}`
                  : 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=1600&auto=format&fit=crop&q=80'
              }
              alt={featuredItem.name || featuredItem.title}
              className="w-full h-full object-cover object-center scale-105 transition-all duration-1000"
            />
            {/* Dark Emerald Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0d1813] via-[#0d1813]/70 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0d1813] via-[#0d1813]/80 to-transparent w-full md:w-3/4" />
          </div>

          {/* Content */}
          <div className="relative z-10 p-6 sm:p-10 md:p-14 max-w-3xl space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="bg-emerald-500 text-black font-extrabold text-[10px] sm:text-xs px-2.5 py-1 rounded-md tracking-wider uppercase shadow-[0_0_15px_rgba(16,185,129,0.5)] flex items-center gap-1">
                <Tv className="w-3.5 h-3.5" /> FEATURED SERIES
              </span>
              <span className="bg-black/60 backdrop-blur-md text-amber-400 font-black text-xs px-2.5 py-1 rounded-md border border-amber-500/30 flex items-center gap-1">
                <Star className="w-3.5 h-3.5 fill-amber-400" /> {featuredItem.vote_average?.toFixed(1) || '8.5'}
              </span>
            </div>

            <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white tracking-tight leading-none drop-shadow-lg">
              {featuredItem.name || featuredItem.title}
            </h1>

            <p className="text-zinc-300 text-sm sm:text-base line-clamp-3 leading-relaxed max-w-2xl font-normal">
              {featuredItem.overview}
            </p>

            {/* Action Buttons */}
            <div className="grid grid-cols-3 sm:flex items-center gap-1.5 sm:gap-3 pt-2 w-full sm:w-auto">
              <button
                onClick={() => onPlayMedia(featuredItem)}
                className="px-2 sm:px-6 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-[11px] xs:text-xs sm:text-sm transition-all shadow-[0_0_25px_rgba(16,185,129,0.4)] flex items-center justify-center gap-1 sm:gap-2 whitespace-nowrap"
              >
                <Play className="w-3.5 h-3.5 sm:w-5 sm:h-5 fill-black shrink-0" />
                <span>Stream</span>
              </button>

              <button
                onClick={() => onToggleWatchlist(featuredItem)}
                className={`px-2 sm:px-5 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl border font-bold text-[11px] xs:text-xs sm:text-sm transition-all flex items-center justify-center gap-1 sm:gap-2 backdrop-blur-md whitespace-nowrap ${
                  isWatchlisted
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500'
                    : 'bg-black/60 text-white border-zinc-700 hover:border-emerald-400 hover:text-emerald-400'
                }`}
              >
                {isWatchlisted ? <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" /> : <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />}
                <span>{isWatchlisted ? 'In Stash' : 'Stash'}</span>
              </button>

              <button
                onClick={() => onInspectItem(featuredItem)}
                className="px-2 sm:px-5 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl bg-black/60 text-zinc-300 border border-zinc-700 hover:border-white hover:text-white font-bold text-[11px] xs:text-xs sm:text-sm transition-all backdrop-blur-md flex items-center justify-center gap-1 sm:gap-2 whitespace-nowrap"
              >
                <Info className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span>Details</span>
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section className="relative w-full rounded-3xl overflow-hidden bg-[#0a100c] border border-emerald-950/60 min-h-[440px] sm:min-h-[520px] flex items-end p-6 sm:p-10 md:p-14 animate-pulse">
          <div className="space-y-4 max-w-2xl w-full z-10">
            <div className="h-6 w-36 bg-emerald-900/50 rounded-md" />
            <div className="h-12 w-3/4 bg-emerald-950/80 rounded-2xl" />
            <div className="h-16 w-full bg-zinc-900/50 rounded-2xl" />
            <div className="flex gap-3 pt-2">
              <div className="h-12 w-32 bg-emerald-800/40 rounded-2xl" />
              <div className="h-12 w-28 bg-zinc-900/60 rounded-2xl" />
            </div>
          </div>
        </section>
      )}

      {/* FILTERING & SORTING TOOLBAR */}
      <section className="bg-[#0b100c] border border-emerald-900/40 p-4 sm:p-5 rounded-3xl space-y-4 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <SlidersHorizontal className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <h3 className="text-lg font-black text-white">TV Series Filter & Catalog Explorer</h3>
              <p className="text-xs text-zinc-400">Filter television series by genre, air date, rating & language</p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-[#121915] p-1 rounded-2xl border border-emerald-950 self-start md:self-auto">
            <button
              onClick={() => setViewMode('carousels')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                viewMode === 'carousels'
                  ? 'bg-emerald-500 text-black shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" /> Featured Rows
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                viewMode === 'grid'
                  ? 'bg-emerald-500 text-black shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Grid className="w-3.5 h-3.5" /> Full Grid Catalog
            </button>
          </div>
        </div>

        {/* Filters Select Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-2">
          {/* Genre Filter */}
          <div>
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Genre</label>
            <select
              value={selectedGenre}
              onChange={(e) => setSelectedGenre(e.target.value)}
              className="w-full bg-[#141d17] text-white border border-emerald-900/50 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:border-emerald-400"
            >
              <option value="all">All TV Genres</option>
              <option value="80">Crime</option>
              <option value="35">Comedy</option>
              <option value="18">Drama</option>
              <option value="10765">Sci-Fi & Fantasy</option>
              <option value="9648">Mystery / Horror</option>
              <option value="10759">Action & Adventure</option>
              <option value="16">Animation</option>
              <option value="99">Documentary</option>
              <option value="10764">Reality</option>
              <option value="10762">Kids</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full bg-[#141d17] text-white border border-emerald-900/50 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:border-emerald-400"
            >
              <option value="popularity.desc">Most Popular</option>
              <option value="vote_average.desc">Highest Rated</option>
              <option value="first_air_date.desc">Latest Air Date</option>
            </select>
          </div>

          {/* Air Date Year */}
          <div>
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Premiered</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full bg-[#141d17] text-white border border-emerald-900/50 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:border-emerald-400"
            >
              <option value="all">All Air Years</option>
              <option value="2025">2025 / 2026 Premieres</option>
              <option value="2024">2024 Series</option>
              <option value="2020s">2020s Era</option>
              <option value="classics">Classics (&lt; 2015)</option>
            </select>
          </div>

          {/* Rating */}
          <div>
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Rating</label>
            <select
              value={selectedRating}
              onChange={(e) => setSelectedRating(e.target.value)}
              className="w-full bg-[#141d17] text-white border border-emerald-900/50 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:border-emerald-400"
            >
              <option value="all">Any Rating</option>
              <option value="8.0">★ 8.0+ Outstanding</option>
              <option value="7.5">★ 7.5+ High Score</option>
              <option value="7.0">★ 7.0+ Above Average</option>
            </select>
          </div>

          {/* Language */}
          <div>
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Language</label>
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="w-full bg-[#141d17] text-white border border-emerald-900/50 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:border-emerald-400"
            >
              <option value="all">All Languages</option>
              <option value="en">English</option>
              <option value="ja">Japanese</option>
              <option value="es">Spanish</option>
              <option value="ko">Korean</option>
              <option value="fr">French</option>
            </select>
          </div>
        </div>

        {isFilterActive && (
          <div className="flex items-center justify-between border-t border-emerald-950/60 pt-3 text-xs">
            <span className="text-emerald-400 font-medium">
              Filter Active ({activeFilterCount} active filters) • Showing filtered series
            </span>
            <button
              onClick={() => {
                setSelectedGenre('all');
                setSelectedYear('all');
                setSelectedRating('all');
                setSelectedLanguage('all');
                setSortBy('popularity.desc');
                setViewMode('carousels');
              }}
              className="text-zinc-400 hover:text-white underline font-semibold"
            >
              Reset Filters
            </button>
          </div>
        )}
      </section>

      {/* RENDER VIEW MODE */}
      {viewMode === 'grid' || isFilterActive ? (
        <section className="space-y-6 pt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black text-white flex items-center gap-2">
              <Tv className="w-6 h-6 text-emerald-400" /> TV Series Catalog Results
            </h2>
            <span className="text-xs text-zinc-400 font-mono">{gridItems.length} shows loaded</span>
          </div>

          <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
            {gridItems.map((item) => (
              <MediaCard
                key={item.id}
                item={item}
                onOpenDetails={onInspectItem}
                className="w-full"
              />
            ))}
          </div>

          {loadingGrid && (
            <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 pt-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-[2/3] bg-emerald-950/20 rounded-2xl animate-pulse border border-emerald-900/30" />
              ))}
            </div>
          )}

          {hasMoreGrid && !loadingGrid && (
            <div className="flex justify-center pt-8">
              <button
                onClick={() => {
                  const nextPage = gridPage + 1;
                  setGridPage(nextPage);
                  fetchGridData(nextPage, false);
                }}
                className="px-8 py-3.5 rounded-2xl bg-[#101713] border border-emerald-500/30 hover:border-emerald-400 text-white font-bold text-sm transition-all hover:scale-105 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
              >
                Load More TV Shows ↓
              </button>
            </div>
          )}
        </section>
      ) : (
        <div className="space-y-8">
          {tvSections.map((sec) => {
            const items = sectionData[sec.id] || [];
            const isLoading = Boolean(loadingMap[sec.id] && !items.length);

            return (
              <MediaCarousel
                key={sec.id}
                title={sec.title}
                subtitle={sec.subtitle}
                icon={sec.icon}
                items={items}
                loading={isLoading}
                onPlay={onPlayMedia}
                onOpenDetails={onInspectItem}
                onToggleWatchlist={onToggleWatchlist}
                watchlistIds={user.watchlist}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};
