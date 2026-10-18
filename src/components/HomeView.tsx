import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, ChevronUp, Play, X } from 'lucide-react';
import { MediaItem, UserProfile } from '../types';
import { formatRemainingTime, deduplicateWatchHistory } from '../services/storage';
import { HeroSlider } from './HeroSlider';
import { MediaCard } from './MediaCard';
import {
  fetchTrending,
  fetchTopRated,
  discoverMedia,
} from '../services/api';

interface HomeViewProps {
  user: UserProfile;
  isLoggedIn?: boolean;
  onPlayMedia: (item: MediaItem, season?: number, episode?: number) => void;
  onInspectItem: (item: MediaItem) => void;
  onNavigateTab: (tab: string) => void;
  onRequireLogin?: (item: MediaItem) => void;
  onUpdateUser?: (updated: UserProfile) => void;
  onRemoveWatchHistory?: (mediaId: number, season?: number, episode?: number) => void;
}

// ── Streaming Providers List (Screenshot 2) ──
const STREAMING_PROVIDERS = [
  { id: '213', name: 'Netflix', type: 'TV Network', logoType: 'netflix' },
  { id: '1024', name: 'Amazon MGM Studios', type: 'Movie Studio', logoType: 'mgm' },
  { id: '3172', name: 'Shudder', type: 'Movie Studio', logoType: 'shudder' },
  { id: '2739', name: 'Disney+', type: 'TV Network', logoType: 'disney' },
  { id: '2552', name: 'Apple TV+', type: 'TV Network', logoType: 'apple' },
  { id: '3172_b', name: 'Blumhouse', type: 'Movie Studio', logoType: 'blumhouse' },
  { id: '178464', name: 'Vivamax', type: 'Movie Studio', logoType: 'vivamax' },
  { id: '4330', name: 'Paramount+', type: 'TV Network', logoType: 'paramount' },
  { id: '49', name: 'Max', type: 'TV Network', logoType: 'max' },
  { id: '174', name: 'Warner Bros.', type: 'Movie Studio', logoType: 'wb' },
];


export const HomeView: React.FC<HomeViewProps> = ({
  user,
  isLoggedIn = false,
  onPlayMedia,
  onInspectItem,
  onNavigateTab,
  onRequireLogin,
  onUpdateUser,
  onRemoveWatchHistory,
}) => {
  // Live State for all 1:1 shelves
  const [heroItems, setHeroItems] = useState<MediaItem[]>([]);
  const [top10Items, setTop10Items] = useState<MediaItem[]>([]);
  const [top10Filter, setTop10Filter] = useState<'all' | 'movies' | 'tv'>('all');
  const [trendingMovies, setTrendingMovies] = useState<MediaItem[]>([]);
  const [trendingShows, setTrendingShows] = useState<MediaItem[]>([]);

  // Genre Shelves (Screenshots 3 - 6)
  const [horrorItems, setHorrorItems] = useState<MediaItem[]>([]);
  const [actionItems, setActionItems] = useState<MediaItem[]>([]);
  const [comedyItems, setComedyItems] = useState<MediaItem[]>([]);
  const [romanceItems, setRomanceItems] = useState<MediaItem[]>([]);
  const [scifiItems, setScifiItems] = useState<MediaItem[]>([]);
  const [thrillerItems, setThrillerItems] = useState<MediaItem[]>([]);
  const [animationItems, setAnimationItems] = useState<MediaItem[]>([]);
  const [documentaryItems, setDocumentaryItems] = useState<MediaItem[]>([]);

  // TV Shelves (Screenshots 7 - 8)
  const [popularTvItems, setPopularTvItems] = useState<MediaItem[]>([]);
  const [tvActionItems, setTvActionItems] = useState<MediaItem[]>([]);
  const [tvComedyItems, setTvComedyItems] = useState<MediaItem[]>([]);
  const [tvDramaItems, setTvDramaItems] = useState<MediaItem[]>([]);

  // Curated Shelves (Screenshots 9 - 12)
  const [topRatedMovies, setTopRatedMovies] = useState<MediaItem[]>([]);
  const [popularWeekItems, setPopularWeekItems] = useState<MediaItem[]>([]);
  const [highlyRated, setHighlyRated] = useState<MediaItem[]>([]);

  const [loading, setLoading] = useState(true);

  const continueWatchingScrollRef = useRef<HTMLDivElement>(null);
  const top10ScrollRef = useRef<HTMLDivElement>(null);
  const providersScrollRef = useRef<HTMLDivElement>(null);

  // Fetch live media catalog from TMDb
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setLoading(true);
      try {
        // Primary visible shelves loaded in fast parallel batch
        const [
          trendingAll,
          movies,
          tv,
          horror,
          action,
          comedy,
          romance,
          scifi,
          thriller,
        ] = await Promise.all([
          fetchTrending('all', 'day').catch(() => []),
          fetchTrending('movie', 'day').catch(() => []),
          fetchTrending('tv', 'day').catch(() => []),
          discoverMedia('movie', 27).catch(() => []),
          discoverMedia('movie', 28).catch(() => []),
          discoverMedia('movie', 35).catch(() => []),
          discoverMedia('movie', 10749).catch(() => []),
          discoverMedia('movie', 878).catch(() => []),
          discoverMedia('movie', 53).catch(() => []),
        ]);

        if (!isMounted) return;

        setHeroItems(trendingAll.slice(0, 8));
        setTrendingMovies(movies);
        setTrendingShows(tv);
        setHorrorItems(horror);
        setActionItems(action);
        setComedyItems(comedy);
        setRomanceItems(romance);
        setScifiItems(scifi);
        setThrillerItems(thriller);

        // Secondary shelves loaded immediately after
        const [
          anim,
          doc,
          pTv,
          tAction,
          tCom,
          tDrama,
          topM,
          popW,
          highR,
        ] = await Promise.all([
          discoverMedia('movie', 16).catch(() => []),
          discoverMedia('movie', 99).catch(() => []),
          fetchTrending('tv', 'day').catch(() => []),
          discoverMedia('tv', 10759).catch(() => []),
          discoverMedia('tv', 35).catch(() => []),
          discoverMedia('tv', 18).catch(() => []),
          fetchTopRated('movie').catch(() => []),
          fetchTrending('movie', 'week').catch(() => []),
          fetchTopRated('tv').catch(() => []),
        ]);

        if (!isMounted) return;
        setAnimationItems(anim);
        setDocumentaryItems(doc);
        setPopularTvItems(pTv);
        setTvActionItems(tAction);
        setTvComedyItems(tCom);
        setTvDramaItems(tDrama);
        setTopRatedMovies(topM);
        setPopularWeekItems(popW);
        setHighlyRated(highR);
      } catch (err) {
        console.error('Failed to load catalog shelves:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Update Top 10 based on filter (All, Movies, TV)
  useEffect(() => {
    if (top10Filter === 'movies') {
      setTop10Items(trendingMovies.slice(0, 10));
    } else if (top10Filter === 'tv') {
      setTop10Items(trendingShows.slice(0, 10));
    } else {
      const combined: MediaItem[] = [];
      const maxLen = Math.max(trendingMovies.length, trendingShows.length);
      for (let i = 0; i < maxLen; i++) {
        if (trendingMovies[i]) combined.push(trendingMovies[i]);
        if (trendingShows[i]) combined.push(trendingShows[i]);
      }
      setTop10Items(combined.slice(0, 10));
    }
  }, [top10Filter, trendingMovies, trendingShows]);

  const scrollShelf = (ref: React.RefObject<HTMLDivElement | null>, direction: 'left' | 'right') => {
    if (ref.current) {
      const scrollAmount = (direction === 'left' ? -1 : 1) * Math.max(ref.current.clientWidth * 0.75, 320);
      ref.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div className="w-full min-h-screen bg-black text-white pb-28 selection:bg-red-600 selection:text-white">
      {/* ── 1. Widescreen Hero Billboard (Fills 100% to Right Edge, Screenshot 1) ── */}
      <HeroSlider
        items={heroItems}
        onPlay={(item) => onPlayMedia(item)}
        onOpenDetails={(item) => onInspectItem(item)}
        isLoggedIn={isLoggedIn}
        onRequireLogin={onRequireLogin}
        onUpdateUser={onUpdateUser}
        userWatchlist={user.watchlist}
      />

      {/* ── 2. Content Shelves (Bleeds to Both Left and Right Edges when Scrolled) ── */}
      <div className="w-full px-0 pt-6 relative z-20 space-y-12">
        {/* ─────────────────────────────────────────────────────────────
            CONTINUE WATCHING SHELF (Only visible to authenticated logged-in users)
        ─────────────────────────────────────────────────────────────── */}
        {isLoggedIn && user?.watchHistory && user.watchHistory.length > 0 && (() => {
          const continueWatchingList = deduplicateWatchHistory(user.watchHistory);
          if (continueWatchingList.length === 0) return null;

          return (
            <div className="space-y-8 sm:space-y-10">
              <section className="space-y-4">
                <div className="flex items-center justify-between px-6 sm:px-8 lg:px-10">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
                      <span>Continue Watching</span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-[#00df82] font-bold border border-emerald-500/30 font-mono">
                        {continueWatchingList.length}
                      </span>
                    </h2>
                  </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => scrollShelf(continueWatchingScrollRef, 'left')}
                    className="w-8 h-8 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center border border-zinc-800 transition cursor-pointer"
                    title="Scroll left"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => scrollShelf(continueWatchingScrollRef, 'right')}
                    className="w-8 h-8 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center border border-zinc-800 transition cursor-pointer"
                    title="Scroll right"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div
                ref={continueWatchingScrollRef}
                className="flex gap-4 sm:gap-5 overflow-x-auto no-scrollbar scroll-smooth pb-3 w-full"
              >
                <div className="shrink-0 w-2 sm:w-3 lg:w-5 pointer-events-none" aria-hidden="true" />
                {continueWatchingList.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => onPlayMedia({
                      id: item.mediaId,
                      title: item.title,
                      overview: '',
                      poster_path: item.posterPath,
                      backdrop_path: item.backdropPath,
                      vote_average: 8.5,
                      vote_count: 100,
                      popularity: 10,
                      media_type: item.mediaType,
                    }, item.season, item.episode)}
                    className="w-64 sm:w-72 md:w-80 shrink-0 group cursor-pointer select-none relative"
                  >
                    <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 group-hover:border-emerald-500/50 transition-all shadow-lg group-hover:scale-[1.02]">
                      <img
                        src={item.backdropPath || item.posterPath || ''}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                      
                      {/* Quick Remove Action Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onRemoveWatchHistory) {
                            onRemoveWatchHistory(item.mediaId, item.season, item.episode);
                          }
                        }}
                        className="absolute top-2 right-2 z-20 w-7 h-7 rounded-full bg-black/80 hover:bg-red-600 text-zinc-300 hover:text-white flex items-center justify-center opacity-80 group-hover:opacity-100 transition-all cursor-pointer border border-white/10 shadow-lg"
                        title="Remove from Continue Watching"
                      >
                        <X className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>

                      {/* Play overlay icon */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                        <div className="w-12 h-12 rounded-full bg-[#00df82] text-black flex items-center justify-center shadow-[0_0_16px_rgba(0,223,130,0.6)]">
                          <Play className="w-5 h-5 fill-current ml-0.5" />
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-zinc-800">
                        <div
                          className="h-full bg-[#00df82] shadow-[0_0_8px_rgba(0,223,130,0.8)]"
                          style={{ width: `${Math.min(Math.max(item.progressPercent || 5, 5), 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-2.5 px-0.5">
                      <h3 className="font-bold text-xs sm:text-sm text-white truncate group-hover:text-[#00df82] transition-colors">
                        {item.title}
                      </h3>
                      <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-0.5">
                        <span className="text-emerald-400 font-semibold font-mono">
                          {formatRemainingTime(item.durationSeconds, item.progressSeconds, item.progressPercent, item.mediaType)}
                        </span>
                        <span>·</span>
                        <span className="font-mono text-zinc-400">{item.mediaType === 'tv' ? `S${item.season || 1} E${item.episode || 1}` : 'Movie'}</span>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="shrink-0 w-8 sm:w-12 pointer-events-none" aria-hidden="true" />
              </div>
            </section>

            {/* Section Separator */}
            <div className="px-6 sm:px-8 lg:px-10" aria-hidden="true">
              <div className="border-t border-zinc-800/80" />
            </div>
          </div>
        );
      })()}

        {/* ─────────────────────────────────────────────────────────────
            TOP 10 SHELF (Screenshot 2)
            Features: [All] [Movies] [TV] & Giant Outline Stroke Rank Numbers
        ─────────────────────────────────────────────────────────────── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-6 sm:px-8 lg:px-10">
            <div className="flex items-center gap-4">
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                TOP 10
              </h2>

              {/* Segmented Filter: All | Movies | TV */}
              <div className="flex items-center p-0.5 rounded-xl bg-[#141414] border border-zinc-800 text-xs font-semibold">
                <button
                  onClick={() => setTop10Filter('all')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    top10Filter === 'all'
                      ? 'bg-zinc-800 text-white font-bold'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setTop10Filter('movies')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    top10Filter === 'movies'
                      ? 'bg-zinc-800 text-white font-bold'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Movies
                </button>
                <button
                  onClick={() => setTop10Filter('tv')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    top10Filter === 'tv'
                      ? 'bg-zinc-800 text-white font-bold'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  TV
                </button>
              </div>
            </div>

            {/* Scroll Navigation Arrows */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => scrollShelf(top10ScrollRef, 'left')}
                className="w-8 h-8 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center border border-zinc-800 transition cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => scrollShelf(top10ScrollRef, 'right')}
                className="w-8 h-8 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center border border-zinc-800 transition cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Top 10 Carousel with Giant Outline Numbers (Bleeds to Right Edge) */}
          <div
            ref={top10ScrollRef}
            className="flex items-start gap-3 sm:gap-5 md:gap-6 overflow-x-auto overflow-y-hidden no-scrollbar scroll-smooth pb-4 pt-1 w-full top10-carousel px-4 sm:px-8 lg:px-10"
          >
            {loading && !top10Items.length ? (
              Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="w-32 sm:w-40 md:w-44 lg:w-48 shrink-0 aspect-[2/3] rounded-xl bg-zinc-900/60 animate-pulse border border-zinc-800 ml-6 sm:ml-8"
                />
              ))
            ) : (
              top10Items.map((item, index) => (
                <div 
                  key={item.id} 
                  className={`shrink-0 ${
                    index === 0
                      ? 'pl-9 sm:pl-12 md:pl-14 lg:pl-16'
                      : index === 9
                      ? 'pl-14 sm:pl-18 md:pl-20 lg:pl-22'
                      : 'pl-8 sm:pl-10 md:pl-12 lg:pl-14'
                  }`}
                >
                  <div className="w-32 sm:w-40 md:w-44 lg:w-48">
                    <MediaCard
                      item={item}
                      top10Rank={index + 1}
                      isRecentlyAdded={index === 4 || index === 5 || index === 6}
                      onOpenDetails={onInspectItem}
                      onPlay={onPlayMedia}
                      isLoggedIn={isLoggedIn}
                      onRequireLogin={onRequireLogin}
                      onUpdateUser={onUpdateUser}
                      isInWatchlist={user.watchlist?.includes(Number(item.id))}
                    />
                  </div>
                </div>
              ))
            )}
            <div className="shrink-0 w-6 sm:w-10 pointer-events-none" aria-hidden="true" />
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────
            STREAMING PROVIDERS SHELF (Screenshot 2)
            Features: Netflix, Amazon MGM, Shudder, Disney+, Apple TV+, etc.
        ─────────────────────────────────────────────────────────────── */}
        <div className="space-y-8 sm:space-y-10">
          {/* Section Separator */}
          <div className="px-6 sm:px-8 lg:px-10" aria-hidden="true">
            <div className="border-t border-zinc-800/80" />
          </div>

          <section className="space-y-4">
            <div className="flex items-center justify-between px-6 sm:px-8 lg:px-10">
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Streaming Providers
              </h2>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => scrollShelf(providersScrollRef, 'left')}
                  className="w-8 h-8 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center border border-zinc-800 transition cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => scrollShelf(providersScrollRef, 'right')}
                  className="w-8 h-8 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center border border-zinc-800 transition cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div
              ref={providersScrollRef}
              className="flex gap-4 sm:gap-5 overflow-x-auto no-scrollbar scroll-smooth pb-3 w-full"
            >
              <div className="shrink-0 w-2 sm:w-3 lg:w-5 pointer-events-none" aria-hidden="true" />
              {STREAMING_PROVIDERS.map((provider) => (
                <div
                  key={provider.id}
                  onClick={() => onNavigateTab('movies')}
                  className="shrink-0 group cursor-pointer"
                >
                  {/* Logo Box */}
                  <div className="w-56 sm:w-64 h-28 sm:h-32 rounded-2xl bg-[#121212] border border-zinc-800/80 group-hover:border-zinc-700 flex items-center justify-center p-4 transition-transform group-hover:scale-[1.02]">
                    {provider.logoType === 'netflix' && (
                      <span className="text-2xl sm:text-3xl font-black text-[#E50914] tracking-tighter uppercase font-serif">
                        NETFLIX
                      </span>
                    )}
                    {provider.logoType === 'mgm' && (
                      <div className="text-center">
                        <span className="text-xs sm:text-sm font-black tracking-widest text-zinc-300 uppercase block">
                          AMAZON
                        </span>
                        <span className="text-[10px] sm:text-xs font-semibold tracking-wider text-zinc-400 uppercase block">
                          MGM STUDIOS
                        </span>
                      </div>
                    )}
                    {provider.logoType === 'shudder' && (
                      <span className="text-xl sm:text-2xl font-black text-red-600 tracking-wider uppercase font-mono">
                        SHUDDER
                      </span>
                    )}
                    {provider.logoType === 'disney' && (
                      <span className="text-2xl sm:text-3xl font-black text-[#3ea6ff] italic tracking-tight font-serif">
                        Disney<span className="text-base font-bold not-italic">+</span>
                      </span>
                    )}
                    {provider.logoType === 'apple' && (
                      <span className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                        tv+
                      </span>
                    )}
                    {provider.logoType === 'blumhouse' && (
                      <div className="text-center">
                        <span className="text-xs sm:text-sm font-black tracking-widest text-white uppercase block font-serif">
                          BLUMHOUSE
                        </span>
                        <span className="text-[9px] tracking-widest text-zinc-400 uppercase block">
                          PRODUCTIONS
                        </span>
                      </div>
                    )}
                    {provider.logoType === 'vivamax' && (
                      <span className="text-xl sm:text-2xl font-black text-[#f5a623] tracking-tight">
                        viva<span className="text-blue-500">max</span>
                      </span>
                    )}
                    {provider.logoType === 'paramount' && (
                      <span className="text-xl sm:text-2xl font-black text-[#0064ff] tracking-tight italic">
                        Paramount<span className="not-italic">+</span>
                      </span>
                    )}
                    {provider.logoType === 'max' && (
                      <span className="text-2xl sm:text-3xl font-black text-white tracking-widest uppercase">
                        MAX
                      </span>
                    )}
                    {provider.logoType === 'wb' && (
                      <span className="text-sm sm:text-base font-black text-zinc-300 tracking-wider uppercase">
                        WARNER BROS.
                      </span>
                    )}
                  </div>

                  {/* Subtitle Details */}
                  <div className="mt-2">
                    <h3 className="text-white font-bold text-xs sm:text-sm group-hover:text-red-500 transition-colors">
                      {provider.name}
                    </h3>
                    <p className="text-zinc-500 text-[11px] font-medium mt-0.5">
                      {provider.type}
                    </p>
                  </div>
                </div>
              ))}
              <div className="shrink-0 w-8 sm:w-12 pointer-events-none" aria-hidden="true" />
            </div>
          </section>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            GENRE SHELVES (Screenshots 3 - 6)
        ─────────────────────────────────────────────────────────────── */}
        <ShelfSection
          title="Horror"
          items={horrorItems}
          onOpenDetails={onInspectItem}
          onPlay={onPlayMedia}
          loading={loading}
        />

        <ShelfSection
          title="Action"
          items={actionItems}
          onOpenDetails={onInspectItem}
          onPlay={onPlayMedia}
          loading={loading}
        />

        <ShelfSection
          title="Comedy"
          items={comedyItems}
          onOpenDetails={onInspectItem}
          onPlay={onPlayMedia}
          loading={loading}
        />

        <ShelfSection
          title="Romance"
          items={romanceItems}
          onOpenDetails={onInspectItem}
          onPlay={onPlayMedia}
          loading={loading}
        />

        <ShelfSection
          title="Sci-Fi"
          items={scifiItems}
          onOpenDetails={onInspectItem}
          onPlay={onPlayMedia}
          loading={loading}
        />

        <ShelfSection
          title="Thriller"
          items={thrillerItems}
          onOpenDetails={onInspectItem}
          onPlay={onPlayMedia}
          loading={loading}
        />

        <ShelfSection
          title="Animation"
          items={animationItems}
          onOpenDetails={onInspectItem}
          onPlay={onPlayMedia}
          loading={loading}
        />

        <ShelfSection
          title="Documentary"
          items={documentaryItems}
          onOpenDetails={onInspectItem}
          onPlay={onPlayMedia}
          loading={loading}
        />

        {/* ─────────────────────────────────────────────────────────────
            TV SERIES SHELVES (Screenshots 7 - 8)
        ─────────────────────────────────────────────────────────────── */}
        <ShelfSection
          title="Popular TV"
          items={popularTvItems}
          onOpenDetails={onInspectItem}
          onPlay={onPlayMedia}
          loading={loading}
        />

        <ShelfSection
          title="TV Action"
          items={tvActionItems}
          onOpenDetails={onInspectItem}
          onPlay={onPlayMedia}
          loading={loading}
        />

        <ShelfSection
          title="TV Comedy"
          items={tvComedyItems}
          onOpenDetails={onInspectItem}
          onPlay={onPlayMedia}
          loading={loading}
        />

        <ShelfSection
          title="TV Drama"
          items={tvDramaItems}
          onOpenDetails={onInspectItem}
          onPlay={onPlayMedia}
          loading={loading}
        />

        {/* ─────────────────────────────────────────────────────────────
            TOP RATED & RECENTS SHELVES (Screenshots 9 - 12)
        ─────────────────────────────────────────────────────────────── */}
        <ShelfSection
          title="Top Rated Movies"
          items={topRatedMovies}
          onOpenDetails={onInspectItem}
          onPlay={onPlayMedia}
          loading={loading}
        />

        <ShelfSection
          title="Popular This Week"
          items={popularWeekItems}
          onOpenDetails={onInspectItem}
          onPlay={onPlayMedia}
          loading={loading}
        />

        <ShelfSection
          title="Highly Rated"
          items={highlyRated}
          onOpenDetails={onInspectItem}
          onPlay={onPlayMedia}
          loading={loading}
        />
      </div>


    </div>
  );
};

// ── Shelf Section Component (Bleeds to Right Edge) ──
interface ShelfSectionProps {
  title: string;
  items: MediaItem[];
  onOpenDetails: (item: MediaItem) => void;
  onPlay: (item: MediaItem) => void;
  loading: boolean;
  isLoggedIn?: boolean;
  onRequireLogin?: (item: MediaItem) => void;
  onUpdateUser?: (updated: UserProfile) => void;
  userWatchlist?: number[];
}

const ShelfSection: React.FC<ShelfSectionProps> = ({
  title,
  items,
  onOpenDetails,
  onPlay,
  loading,
  isLoggedIn,
  onRequireLogin,
  onUpdateUser,
  userWatchlist,
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
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => scroll('right')}
              className="w-8 h-8 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center border border-zinc-800 transition cursor-pointer"
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
          {loading && !items.length ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="w-36 sm:w-44 md:w-48 lg:w-52 shrink-0 aspect-[2/3] rounded-xl bg-zinc-900/60 animate-pulse border border-zinc-800"
              />
            ))
          ) : (
            items.map((item, idx) => (
              <div key={item.id} className="w-36 sm:w-44 md:w-48 lg:w-52 shrink-0">
                <MediaCard
                  item={item}
                  isRecentlyAdded={idx === 1 || idx === 5}
                  onOpenDetails={onOpenDetails}
                  onPlay={onPlay}
                  isLoggedIn={isLoggedIn}
                  onRequireLogin={onRequireLogin}
                  onUpdateUser={onUpdateUser}
                  isInWatchlist={userWatchlist ? userWatchlist.includes(Number(item.id)) : undefined}
                />
              </div>
            ))
          )}
          <div className="shrink-0 w-8 sm:w-12 pointer-events-none" aria-hidden="true" />
        </div>
      </section>
    </div>
  );
};
