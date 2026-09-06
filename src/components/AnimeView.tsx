import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Flame,
  Star,
  Play,
  Plus,
  Check,
  Info,
  Clock,
  Trophy,
  Crown,
  Swords,
  Compass,
  Wand2,
  Atom,
  Smile,
  Ghost,
  Heart,
  HelpCircle,
  Brain,
  Coffee,
  Trophy as SportsIcon,
  Bot,
  Zap,
  Target,
  Film,
  SlidersHorizontal,
  Layers,
  Grid,
  LucideIcon
} from 'lucide-react';
import { MediaItem, UserProfile } from '../types';
import { MediaCarousel } from './MediaCarousel';
import { MediaCard } from './MediaCard';
import { discoverMediaAdvanced, fetchAnime } from '../services/api';
import { fetchAniListTrending, fetchAniListSeasonal } from '../services/anilist';

interface AnimeViewProps {
  user: UserProfile;
  onPlayMedia: (item: MediaItem) => void;
  onInspectItem: (item: MediaItem) => void;
  onToggleWatchlist: (item: MediaItem) => void;
}

interface AnimeSectionConfig {
  id: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  fetcher: () => Promise<MediaItem[]>;
}

const animeCache: Record<string, MediaItem[]> = {};

export const AnimeView: React.FC<AnimeViewProps> = ({
  user,
  onPlayMedia,
  onInspectItem,
  onToggleWatchlist
}) => {
  const [sectionData, setSectionData] = useState<Record<string, MediaItem[]>>(animeCache);
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [heroIndex, setHeroIndex] = useState(0);

  // Filter Toolbar State
  const [sortBy, setSortBy] = useState<'popularity.desc' | 'vote_average.desc' | 'first_air_date.desc'>('popularity.desc');
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [selectedFormat, setSelectedFormat] = useState<'all' | 'tv' | 'movie'>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedRating, setSelectedRating] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'carousels' | 'grid'>('carousels');

  // Grid Catalog State
  const [gridItems, setGridItems] = useState<MediaItem[]>([]);
  const [gridPage, setGridPage] = useState(1);
  const [loadingGrid, setLoadingGrid] = useState(false);
  const [hasMoreGrid, setHasMoreGrid] = useState(true);

  const isMountedRef = useRef(true);

  // Helper for discover anime TV or Movie
  const fetchAnimeSection = (type: 'tv' | 'movie' = 'tv', extra: Record<string, string> = {}) => {
    return fetchAnime(type, extra);
  };

  // Anime Sections — AniList-powered rows come first for richer metadata
  const animeSections: AnimeSectionConfig[] = [
    {
      id: '0_anilist_trending',
      title: 'Trending Anime',
      subtitle: 'Most watched and talked-about anime right now',
      icon: Flame,
      fetcher: async () => {
        const aniList = await fetchAniListTrending();
        if (aniList.length) return aniList;
        // TMDb fallback
        return fetchAnimeSection('tv', { sort_by: 'popularity.desc' });
      }
    },
    {
      id: '0b_anilist_seasonal',
      title: 'This Season',
      subtitle: 'Currently airing anime this season',
      icon: Sparkles,
      fetcher: async () => {
        const seasonal = await fetchAniListSeasonal();
        if (seasonal.length) return seasonal;
        return fetchAnimeSection('tv', { 'first_air_date.gte': '2025-01-01', sort_by: 'first_air_date.desc' });
      }
    },
    {
      id: '1_trending_anime',
      title: 'Popular Anime',
      subtitle: 'Top searched anime sagas and fan favorites',
      icon: Star,
      fetcher: () => fetchAnimeSection('tv', { 'vote_count.gte': '200', sort_by: 'popularity.desc' })
    },
    {
      id: '3_top_rated_anime',
      title: 'Top Rated of All Time',
      subtitle: 'Highest rated Japanese animation of all time',
      icon: Trophy,
      fetcher: () => fetchAnimeSection('tv', { 'vote_average.gte': '8.0', 'vote_count.gte': '300', sort_by: 'vote_average.desc' })
    },
    {
      id: '4_new_anime_releases',
      title: 'New Anime Releases',
      subtitle: 'Fresh anime series released in 2025 & 2026',
      icon: Clock,
      fetcher: () => fetchAnimeSection('tv', { 'first_air_date.gte': '2025-01-01', sort_by: 'first_air_date.desc' })
    },
    {
      id: '5_classic_anime',
      title: 'Classic Anime',
      subtitle: 'Legendary nostalgic anime released before 2012',
      icon: Crown,
      fetcher: () => fetchAnimeSection('tv', { 'first_air_date.lte': '2011-12-31', 'vote_count.gte': '200', sort_by: 'vote_average.desc' })
    },
    {
      id: '6_anime_movies',
      title: 'Anime Movies',
      subtitle: 'Theatrical feature films and animated masterpieces',
      icon: Film,
      fetcher: () => fetchAnimeSection('movie', { sort_by: 'popularity.desc' })
    },
    {
      id: '7_action_anime',
      title: 'Action Anime',
      subtitle: 'High energy martial arts, battles, and superpower clashes',
      icon: Swords,
      fetcher: () => fetchAnimeSection('tv', { with_genres: '10759,16' })
    },
    {
      id: '8_adventure_anime',
      title: 'Adventure Anime',
      subtitle: 'Epic journeys across uncharted worlds',
      icon: Compass,
      fetcher: () => fetchAnimeSection('tv', { with_genres: '10759,16' })
    },
    {
      id: '9_fantasy_anime',
      title: 'Fantasy Anime',
      subtitle: 'Magic spells, guilds, dungeons, and mythic beasts',
      icon: Wand2,
      fetcher: () => fetchAnimeSection('tv', { with_genres: '10765,16' })
    },
    {
      id: '10_scifi_anime',
      title: 'Sci-Fi Anime',
      subtitle: 'Futuristic cities, space travel, and cybernetic sagas',
      icon: Atom,
      fetcher: () => fetchAnimeSection('tv', { with_genres: '10765,16' })
    },
    {
      id: '11_comedy_anime',
      title: 'Comedy Anime',
      subtitle: 'Hilarious gags, parodies, and fun school life',
      icon: Smile,
      fetcher: () => fetchAnimeSection('tv', { with_genres: '35,16' })
    },
    {
      id: '12_horror_anime',
      title: 'Horror Anime',
      subtitle: 'Supernatural curses, dark fantasy, and psychological chills',
      icon: Ghost,
      fetcher: () => fetchAnimeSection('tv', { with_genres: '9648,16' })
    },
    {
      id: '13_romance_anime',
      title: 'Romance Anime',
      subtitle: 'Heart-warming love stories and emotional slice of life',
      icon: Heart,
      fetcher: () => fetchAnimeSection('tv', { with_genres: '18,16' })
    },
    {
      id: '14_mystery_anime',
      title: 'Mystery Anime',
      subtitle: 'Puzzling crimes, detective cases, and plot twists',
      icon: HelpCircle,
      fetcher: () => fetchAnimeSection('tv', { with_genres: '9648,16' })
    },
    {
      id: '15_psychological_anime',
      title: 'Psychological Anime',
      subtitle: 'Mind games, thriller battles, and deep philosophical themes',
      icon: Brain,
      fetcher: () => fetchAnimeSection('tv', { with_genres: '9648,18,16' })
    },
    {
      id: '16_slice_of_life_anime',
      title: 'Slice Of Life Anime',
      subtitle: 'Cozy, relaxing, wholesome everyday life adventures',
      icon: Coffee,
      fetcher: () => fetchAnimeSection('tv', { with_genres: '35,18,16' })
    },
    {
      id: '17_sports_anime',
      title: 'Sports Anime',
      subtitle: 'High stakes tournament battles, passion, and teamwork',
      icon: SportsIcon,
      fetcher: () => fetchAnimeSection('tv', { with_genres: '18,16' })
    },
    {
      id: '18_mecha_anime',
      title: 'Mecha Anime',
      subtitle: 'Giant robot combat, sci-fi military warfare, and pilot sagas',
      icon: Bot,
      fetcher: () => fetchAnimeSection('tv', { with_genres: '10765,16' })
    },
    {
      id: '19_isekai_anime',
      title: 'Isekai Anime',
      subtitle: 'Transported to another realm with overpowered abilities',
      icon: Zap,
      fetcher: () => fetchAnimeSection('tv', { with_genres: '10765,16' })
    },
    {
      id: '20_shonen_anime',
      title: 'Shonen Anime',
      subtitle: 'Willpower, martial arts, tournaments, and legendary rivalries',
      icon: Target,
      fetcher: () => fetchAnimeSection('tv', { with_genres: '10759,16' })
    }
  ];

  useEffect(() => {
    isMountedRef.current = true;

    const loadSection = async (sec: AnimeSectionConfig) => {
      if (animeCache[sec.id] && animeCache[sec.id].length > 0) return;
      try {
        setLoadingMap((prev) => ({ ...prev, [sec.id]: true }));
        const items = await sec.fetcher();
        if (isMountedRef.current && items && items.length > 0) {
          animeCache[sec.id] = items;
          setSectionData((prev) => ({ ...prev, [sec.id]: items }));
        }
      } catch (err) {
        console.warn(`Error fetching ${sec.id}:`, err);
      } finally {
        if (isMountedRef.current) {
          setLoadingMap((prev) => ({ ...prev, [sec.id]: false }));
        }
      }
    };

    // Load top 6 sections immediately
    const topSections = animeSections.slice(0, 6);
    const remainingSections = animeSections.slice(6);

    topSections.forEach((sec) => loadSection(sec));

    // Remaining sections in larger batches with shorter delays
    const chunkSize = 6;
    for (let i = 0; i < remainingSections.length; i += chunkSize) {
      const chunk = remainingSections.slice(i, i + chunkSize);
      const delay = 80 * Math.floor(i / chunkSize) + 100;
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

  // Featured Hero Anime
  const featuredPool =
    sectionData['1_trending_anime']?.slice(0, 5) ||
    sectionData['2_popular_anime']?.slice(0, 5) ||
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

    const type = selectedFormat === 'movie' ? 'movie' : 'tv';
    const params: Record<string, string> = {
      page: String(pageToFetch),
      with_genres: '16',
      with_original_language: 'ja',
      sort_by: sortBy
    };

    if (selectedGenre !== 'all') {
      params.with_genres = `16,${selectedGenre}`;
    }
    if (selectedYear !== 'all') {
      const yearKey = type === 'movie' ? 'primary_release_date.gte' : 'first_air_date.gte';
      if (selectedYear === '2025') params[yearKey] = '2025-01-01';
      else if (selectedYear === '2024') {
        params[yearKey] = '2024-01-01';
      } else if (selectedYear === '2020s') params[yearKey] = '2020-01-01';
      else if (selectedYear === 'classics') {
        const lteKey = type === 'movie' ? 'primary_release_date.lte' : 'first_air_date.lte';
        params[lteKey] = '2012-01-01';
      }
    }
    if (selectedRating !== 'all') params['vote_average.gte'] = selectedRating;

    const res = await discoverMediaAdvanced(type, params);
    if (!isMountedRef.current) return;

    const formatted = res.map((m) => ({ ...m, media_type: type }));

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
      selectedFormat !== 'all' ||
      selectedYear !== 'all' ||
      selectedRating !== 'all' ||
      sortBy !== 'popularity.desc' ||
      viewMode === 'grid'
    ) {
      fetchGridData(1, true);
    }
  }, [selectedGenre, selectedFormat, selectedYear, selectedRating, sortBy, viewMode]);

  const activeFilterCount =
    (selectedGenre !== 'all' ? 1 : 0) +
    (selectedFormat !== 'all' ? 1 : 0) +
    (selectedYear !== 'all' ? 1 : 0) +
    (selectedRating !== 'all' ? 1 : 0) +
    (sortBy !== 'popularity.desc' ? 1 : 0);

  const isFilterActive = activeFilterCount > 0 || viewMode === 'grid';
  const isWatchlisted = featuredItem ? user.watchlist.some(id => Number(id) === Number(featuredItem.id)) : false;

  return (
    <div className="space-y-10 px-4 sm:px-6 lg:px-10 w-full max-w-[1920px] mx-auto pt-4 pb-4">
      {/* FEATURED ANIME HERO SECTION */}
      {featuredItem ? (
        <section className="relative w-full rounded-3xl overflow-hidden bg-black border border-emerald-950 shadow-[0_0_50px_rgba(16,185,129,0.1)] min-h-[440px] sm:min-h-[520px] flex items-end">
          {/* Backdrop Image */}
          <div className="absolute inset-0">
            <img
              src={(() => {
                const bp = featuredItem.backdrop_path;
                const pp = featuredItem.poster_path;
                if (bp) return bp.startsWith('http') ? bp : `https://image.tmdb.org/t/p/original${bp}`;
                if (pp) return pp.startsWith('http') ? pp : `https://image.tmdb.org/t/p/original${pp}`;
                return 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1600&auto=format&fit=crop&q=80';
              })()}
              alt={featuredItem.name || featuredItem.title}
              className="w-full h-full object-cover object-center scale-105 transition-all duration-1000"
              loading="eager"
              fetchPriority="high"
              decoding="async"
            />
            {/* Dark Emerald Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0d1813] via-[#0d1813]/70 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0d1813] via-[#0d1813]/80 to-transparent w-full md:w-3/4" />
          </div>

          {/* Content */}
          <div className="relative z-10 p-6 sm:p-10 md:p-14 max-w-3xl space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="bg-emerald-500 text-black font-extrabold text-[10px] sm:text-xs px-2.5 py-1 rounded-md tracking-wider uppercase shadow-[0_0_15px_rgba(16,185,129,0.5)] flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> FEATURED ANIME
              </span>
              <span className="bg-black/60 backdrop-blur-md text-amber-400 font-black text-xs px-2.5 py-1 rounded-md border border-amber-500/30 flex items-center gap-1">
                <Star className="w-3.5 h-3.5 fill-amber-400" /> {featuredItem.vote_average?.toFixed(1) || '8.8'}
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
              <h3 className="text-lg font-black text-white">Anime Filter & Catalog Explorer</h3>
              <p className="text-xs text-zinc-400">Discover anime series & movies by genre, format, release year & score</p>
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
          {/* Format */}
          <div>
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Format</label>
            <select
              value={selectedFormat}
              onChange={(e) => setSelectedFormat(e.target.value as any)}
              className="w-full bg-[#141d17] text-white border border-emerald-900/50 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:border-emerald-400"
            >
              <option value="all">TV Series & Movies</option>
              <option value="tv">Anime Series (TV)</option>
              <option value="movie">Anime Movies</option>
            </select>
          </div>

          {/* Genre */}
          <div>
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Genre</label>
            <select
              value={selectedGenre}
              onChange={(e) => setSelectedGenre(e.target.value)}
              className="w-full bg-[#141d17] text-white border border-emerald-900/50 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:border-emerald-400"
            >
              <option value="all">All Anime Genres</option>
              <option value="10759">Action & Adventure</option>
              <option value="10765">Fantasy & Sci-Fi</option>
              <option value="35">Comedy</option>
              <option value="18">Drama & Slice of Life</option>
              <option value="9648">Mystery & Psychological</option>
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
              <option value="first_air_date.desc">Release Date</option>
            </select>
          </div>

          {/* Year */}
          <div>
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Release Year</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full bg-[#141d17] text-white border border-emerald-900/50 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:border-emerald-400"
            >
              <option value="all">All Release Years</option>
              <option value="2025">2025 / 2026 Season</option>
              <option value="2024">2024 Season</option>
              <option value="2020s">2020s Era</option>
              <option value="classics">Classic Anime (&lt; 2012)</option>
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
              <option value="all">Any Score</option>
              <option value="8.5">★ 8.5+ Legendary</option>
              <option value="8.0">★ 8.0+ Masterpiece</option>
              <option value="7.5">★ 7.5+ High Score</option>
            </select>
          </div>
        </div>

        {isFilterActive && (
          <div className="flex items-center justify-between border-t border-emerald-950/60 pt-3 text-xs">
            <span className="text-emerald-400 font-medium">
              Filter Active ({activeFilterCount} active filters) • Showing filtered anime
            </span>
            <button
              onClick={() => {
                setSelectedGenre('all');
                setSelectedFormat('all');
                setSelectedYear('all');
                setSelectedRating('all');
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
              <Sparkles className="w-6 h-6 text-emerald-400" /> Anime Catalog Results
            </h2>
            <span className="text-xs text-zinc-400 font-mono">{gridItems.length} anime loaded</span>
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
                Load More Anime ↓
              </button>
            </div>
          )}
        </section>
      ) : (
        <div className="space-y-8">
          {animeSections.map((sec) => {
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
