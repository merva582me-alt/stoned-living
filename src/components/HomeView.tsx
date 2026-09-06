import React, { useState, useEffect, useRef } from 'react';
import {
  Film,
  Flame,
  Tv,
  Sparkles,
  Star,
  Trophy,
  Zap,
  Clock,
  Rocket,
  Crown,
  Gem,
  Ghost,
  Swords,
  Smile,
  Atom,
  ShieldAlert,
  Shield,
  Wand2,
  Palette,
  HeartHandshake,
  Compass,
  LucideIcon
} from 'lucide-react';
import { MediaItem, UserProfile } from '../types';
import { HeroSlider } from './HeroSlider';
import { MediaCarousel } from './MediaCarousel';
import {
  fetchTrending,
  fetchCategoryList,
  fetchTopRated,
  fetchAnime,
  discoverMedia,
  discoverMediaAdvanced
} from '../services/api';

interface HomeViewProps {
  user: UserProfile;
  isLoggedIn?: boolean;
  onPlayMedia: (item: MediaItem, season?: number, episode?: number) => void;
  onInspectItem: (item: MediaItem) => void;
  onToggleWatchlist: (item: MediaItem) => void;
  onNavigateTab: (tab: string) => void;
}

interface SectionConfig {
  id: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  fetcher: () => Promise<MediaItem[]>;
}

// Global in-memory cache for fast tab switches
const homeCache: Record<string, MediaItem[]> = {};

// Helper to interleave Movies, TV Shows, and Anime into a balanced mixed list
async function mixMedia(
  fetchMovies: () => Promise<MediaItem[]>,
  fetchTv: () => Promise<MediaItem[]>,
  fetchAnime: () => Promise<MediaItem[]>
): Promise<MediaItem[]> {
  const [mList, tvList, aList] = await Promise.all([
    fetchMovies().catch(() => []),
    fetchTv().catch(() => []),
    fetchAnime().catch(() => [])
  ]);

  const movies = mList.map((i) => ({ ...i, media_type: 'movie' as const }));
  const tvs = tvList.map((i) => ({ ...i, media_type: 'tv' as const }));
  const animes = aList.map((i) => ({
    ...i,
    media_type: (i.media_type || (i.first_air_date ? 'tv' : 'movie')) as 'movie' | 'tv',
    is_anime: true
  }));

  const combined: MediaItem[] = [];
  const seen = new Set<number>();
  const maxLen = Math.max(movies.length, tvs.length, animes.length);

  for (let i = 0; i < maxLen; i++) {
    if (i < movies.length && !seen.has(movies[i].id)) {
      seen.add(movies[i].id);
      combined.push(movies[i]);
    }
    if (i < tvs.length && !seen.has(tvs[i].id)) {
      seen.add(tvs[i].id);
      combined.push(tvs[i]);
    }
    if (i < animes.length && !seen.has(animes[i].id)) {
      seen.add(animes[i].id);
      combined.push(animes[i]);
    }
  }

  return combined;
}

export const HomeView: React.FC<HomeViewProps> = ({
  user,
  isLoggedIn,
  onPlayMedia,
  onInspectItem,
  onToggleWatchlist,
  onNavigateTab
}) => {
  const [sectionData, setSectionData] = useState<Record<string, MediaItem[]>>(homeCache);
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const isMountedRef = useRef(true);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // 21 Exact Horizontal Sections in exact required order
  const sections: SectionConfig[] = [
    {
      id: '1_new_movies',
      title: 'New Movies',
      subtitle: 'Fresh theatrical and 4K digital movie releases',
      icon: Film,
      fetcher: async () => {
        const raw = await fetchCategoryList('movie', 'now_playing');
        // Filter for movies released in 2025 or 2026
        const recent = raw.filter((item) => {
          if (!item.release_date) return false;
          const year = parseInt(item.release_date.slice(0, 4), 10);
          return year >= 2025;
        });

        if (recent.length >= 10) {
          return recent.sort((a, b) => new Date(b.release_date!).getTime() - new Date(a.release_date!).getTime());
        }

        // Supplemental discover for latest 2025/2026 releases
        const todayStr = new Date().toISOString().split('T')[0];
        const discoverNew = await discoverMediaAdvanced('movie', {
          'primary_release_date.lte': todayStr,
          'primary_release_date.gte': '2025-01-01',
          sort_by: 'primary_release_date.desc'
        });

        const combined = [...recent, ...discoverNew];
        const uniqueMap = new Map<number, MediaItem>();
        combined.forEach((m) => uniqueMap.set(m.id, m));
        return Array.from(uniqueMap.values()).sort(
          (a, b) => new Date(b.release_date || 0).getTime() - new Date(a.release_date || 0).getTime()
        );
      }
    },
    {
      id: '2_trending_movies',
      title: 'Trending Movies',
      subtitle: 'The most watched feature films of the week',
      icon: Flame,
      fetcher: () => fetchTrending('movie', 'week')
    },
    {
      id: '3_trending_tv',
      title: 'Trending TV Shows',
      subtitle: 'Most popular series currently streaming today',
      icon: Tv,
      fetcher: () => fetchTrending('tv', 'week')
    },
    {
      id: '4_trending_anime',
      title: 'Trending Anime',
      subtitle: 'Top Japanese animated series & feature films',
      icon: Sparkles,
      fetcher: () =>
        discoverMediaAdvanced('tv', {
          with_genres: '16',
          with_original_language: 'ja',
          sort_by: 'popularity.desc'
        })
    },
    {
      id: '5_top_rated_movies',
      title: 'Top Rated Movies',
      subtitle: 'Highest rated critically acclaimed cinema masterpieces',
      icon: Star,
      fetcher: () => fetchTopRated('movie')
    },
    {
      id: '6_top_rated_tv',
      title: 'Top Rated TV Shows',
      subtitle: 'All-time highest rated television series',
      icon: Trophy,
      fetcher: () => fetchTopRated('tv')
    },
    {
      id: '7_popular_movies',
      title: 'Popular Movies',
      subtitle: 'Crowd-pleasing blockbusters around the globe',
      icon: Zap,
      fetcher: () => fetchCategoryList('movie', 'popular')
    },
    {
      id: '8_popular_tv',
      title: 'Popular TV Shows',
      subtitle: 'Binge-worthy series trending across all networks',
      icon: Clock,
      fetcher: () => fetchCategoryList('tv', 'popular')
    },
    {
      id: '9_upcoming_movies',
      title: 'Upcoming Movies',
      subtitle: 'Highly anticipated upcoming theatrical feature releases',
      icon: Rocket,
      fetcher: async () => {
        const upcoming = await fetchCategoryList('movie', 'upcoming');
        const todayStr = new Date().toISOString().split('T')[0];
        const discoverUpcoming = await discoverMediaAdvanced('movie', {
          'primary_release_date.gte': todayStr,
          sort_by: 'popularity.desc'
        });
        const combined = [...upcoming, ...discoverUpcoming];
        const uniqueMap = new Map<number, MediaItem>();
        combined.forEach((m) => uniqueMap.set(m.id, m));
        return Array.from(uniqueMap.values());
      }
    },
    {
      id: '10_all_time_classics',
      title: 'All-Time Classics',
      subtitle: 'Timeless masterpiece movies, legendary TV series & classic anime',
      icon: Crown,
      fetcher: () =>
        mixMedia(
          () => discoverMediaAdvanced('movie', { 'primary_release_date.lte': '2004-12-31', 'vote_count.gte': '1000', sort_by: 'vote_average.desc' }),
          () => discoverMediaAdvanced('tv', { 'first_air_date.lte': '2012-12-31', 'vote_count.gte': '500', sort_by: 'vote_average.desc' }),
          () => fetchAnime('tv', { sort_by: 'vote_average.desc', 'vote_count.gte': '300' })
        )
    },
    {
      id: '11_hidden_gems',
      title: 'Hidden Gems',
      subtitle: 'High-scoring, underrated movies, series & anime waiting to be discovered',
      icon: Gem,
      fetcher: () =>
        mixMedia(
          () => discoverMediaAdvanced('movie', { 'vote_average.gte': '7.5', 'vote_count.gte': '100', 'vote_count.lte': '1500', sort_by: 'vote_average.desc' }),
          () => discoverMediaAdvanced('tv', { 'vote_average.gte': '7.8', 'vote_count.gte': '50', 'vote_count.lte': '1000', sort_by: 'vote_average.desc' }),
          () => discoverMediaAdvanced('tv', { with_genres: '16', with_original_language: 'ja', 'vote_average.gte': '8.0', 'vote_count.gte': '50', 'vote_count.lte': '1200', sort_by: 'vote_average.desc' })
        )
    },
    {
      id: '12_horror',
      title: 'Horror',
      subtitle: 'Supernatural chills, horror series & dark thriller anime',
      icon: Ghost,
      fetcher: () =>
        mixMedia(
          () => discoverMedia('movie', 27),
          () => discoverMediaAdvanced('tv', { with_genres: '9648', sort_by: 'popularity.desc' }),
          () => discoverMediaAdvanced('tv', { with_genres: '16,9648', with_original_language: 'ja', sort_by: 'popularity.desc' })
        )
    },
    {
      id: '13_action',
      title: 'Action',
      subtitle: 'High-octane films, action series & epic shonen anime',
      icon: Swords,
      fetcher: () =>
        mixMedia(
          () => discoverMedia('movie', 28),
          () => discoverMedia('tv', 10759),
          () => discoverMediaAdvanced('tv', { with_genres: '16,10759', with_original_language: 'ja', sort_by: 'popularity.desc' })
        )
    },
    {
      id: '14_comedy',
      title: 'Comedy',
      subtitle: 'Hilarious comedy movies, sitcoms & slice-of-life anime',
      icon: Smile,
      fetcher: () =>
        mixMedia(
          () => discoverMedia('movie', 35),
          () => discoverMedia('tv', 35),
          () => discoverMediaAdvanced('tv', { with_genres: '16,35', with_original_language: 'ja', sort_by: 'popularity.desc' })
        )
    },
    {
      id: '15_sci_fi',
      title: 'Sci-Fi',
      subtitle: 'Cosmic films, sci-fi TV series & futuristic anime',
      icon: Atom,
      fetcher: () =>
        mixMedia(
          () => discoverMedia('movie', 878),
          () => discoverMedia('tv', 10765),
          () => discoverMediaAdvanced('tv', { with_genres: '16,10765', with_original_language: 'ja', sort_by: 'popularity.desc' })
        )
    },
    {
      id: '16_thriller',
      title: 'Thriller',
      subtitle: 'Edge-of-your-seat films, mystery thrillers & psychological suspense anime',
      icon: ShieldAlert,
      fetcher: () =>
        mixMedia(
          () => discoverMedia('movie', 53),
          () => discoverMediaAdvanced('tv', { with_genres: '9648,80', sort_by: 'popularity.desc' }),
          () => discoverMediaAdvanced('tv', { with_genres: '16,9648', with_original_language: 'ja', sort_by: 'popularity.desc' })
        )
    },
    {
      id: '17_crime',
      title: 'Crime',
      subtitle: 'Gritty mob movies, crime procedural series & detective anime',
      icon: Shield,
      fetcher: () =>
        mixMedia(
          () => discoverMedia('movie', 80),
          () => discoverMedia('tv', 80),
          () => discoverMediaAdvanced('tv', { with_genres: '16,80', with_original_language: 'ja', sort_by: 'popularity.desc' })
        )
    },
    {
      id: '18_fantasy',
      title: 'Fantasy',
      subtitle: 'Magical movies, epic fantasy series & isekai anime realms',
      icon: Wand2,
      fetcher: () =>
        mixMedia(
          () => discoverMedia('movie', 14),
          () => discoverMedia('tv', 10765),
          () => discoverMediaAdvanced('tv', { with_genres: '16,10765', with_original_language: 'ja', sort_by: 'popularity.desc' })
        )
    },
    {
      id: '19_animation',
      title: 'Animation',
      subtitle: 'Stunning animated films, global cartoon series & masterpiece anime',
      icon: Palette,
      fetcher: () =>
        mixMedia(
          () => discoverMedia('movie', 16),
          () => discoverMediaAdvanced('tv', { with_genres: '16', without_original_language: 'ja', sort_by: 'popularity.desc' }),
          () => discoverMediaAdvanced('tv', { with_genres: '16', with_original_language: 'ja', sort_by: 'popularity.desc' })
        )
    },
    {
      id: '20_family',
      title: 'Family',
      subtitle: 'Wholesome family films, youth series & heartwarming anime',
      icon: HeartHandshake,
      fetcher: () =>
        mixMedia(
          () => discoverMedia('movie', 10751),
          () => discoverMedia('tv', 10762),
          () => discoverMediaAdvanced('tv', { with_genres: '16,10762', with_original_language: 'ja', sort_by: 'popularity.desc' })
        )
    },
    {
      id: '21_documentary',
      title: 'Documentary',
      subtitle: 'Investigative documentaries, docuseries & true-story animated sagas',
      icon: Compass,
      fetcher: () =>
        mixMedia(
          () => discoverMedia('movie', 99),
          () => discoverMedia('tv', 99),
          () => discoverMediaAdvanced('tv', { with_genres: '99', sort_by: 'popularity.desc' })
        )
    }
  ];

  const fetchSection = (sec: SectionConfig) => {
    if (homeCache[sec.id] && homeCache[sec.id].length > 0) return;
    setLoadingMap((prev) => ({ ...prev, [sec.id]: true }));
    sec.fetcher()
      .then((items) => {
        if (!isMountedRef.current) return;
        if (items && items.length > 0) {
          homeCache[sec.id] = items;
          setSectionData((prev) => ({ ...prev, [sec.id]: items }));
        }
      })
      .catch((err) => {
        console.warn(`Error fetching home section ${sec.id}:`, err);
      })
      .finally(() => {
        if (isMountedRef.current) {
          setLoadingMap((prev) => ({ ...prev, [sec.id]: false }));
        }
      });
  };

  useEffect(() => {
    isMountedRef.current = true;

    // First 6 sections load immediately (covers above the fold + one scroll)
    sections.slice(0, 6).forEach(fetchSection);

    // Remaining sections use IntersectionObserver — fetch when near viewport
    const observers: IntersectionObserver[] = [];
    sections.slice(6).forEach((sec) => {
      const el = sectionRefs.current[sec.id];
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            fetchSection(sec);
            obs.disconnect();
          }
        },
        { rootMargin: '200px' }
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => {
      isMountedRef.current = false;
      observers.forEach((o) => o.disconnect());
    };
  }, []);

  // Build featured items mix: interleave top trending new movies, trending TV shows, and trending anime
  const trendingMovies = sectionData['2_trending_movies'] || sectionData['1_new_movies'] || [];
  const trendingTv = sectionData['3_trending_tv'] || [];
  const trendingAnime = sectionData['4_trending_anime'] || [];

  const heroItems: MediaItem[] = [];
  const maxHeroCount = Math.max(trendingMovies.length, trendingTv.length, trendingAnime.length);
  for (let i = 0; i < maxHeroCount && heroItems.length < 9; i++) {
    if (trendingMovies[i]) heroItems.push({ ...trendingMovies[i], media_type: trendingMovies[i].media_type || 'movie' });
    if (trendingTv[i]) heroItems.push({ ...trendingTv[i], media_type: 'tv' });
    if (trendingAnime[i]) heroItems.push({ ...trendingAnime[i], media_type: 'tv' });
  }

  // Flatten all available catalog items for matching watch history
  const combinedCatalog: MediaItem[] = (Object.values(sectionData) as MediaItem[][]).reduce<MediaItem[]>((acc, list) => acc.concat(list || []), []);

  return (
    <div className="space-y-10 px-4 sm:px-6 lg:px-10 w-full max-w-[1920px] mx-auto pt-4 pb-4">
      {/* Hero Banner Slider */}
      <HeroSlider
        items={heroItems}
        onPlay={onPlayMedia}
        onOpenDetails={onInspectItem}
        onToggleWatchlist={onToggleWatchlist}
        watchlistIds={user.watchlist}
      />

      {/* Continue Watching Section (only for logged in users with watch history) */}
      {isLoggedIn && user.watchHistory.length > 0 && (
        <section className="my-8 bg-[#0c120e] border border-emerald-500/20 p-5 rounded-3xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-emerald-400" /> Continue Watching
            </h2>
            <button
              onClick={() => onNavigateTab('stash')}
              className="text-xs font-bold text-emerald-400 hover:underline"
            >
              View All History →
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {user.watchHistory.slice(0, 3).map((h) => {
              const matchedMedia = combinedCatalog.find((m) => Number(m.id) === Number(h.mediaId)) || {
                id: h.mediaId,
                title: h.title,
                name: h.title,
                overview: '',
                poster_path: h.posterPath,
                backdrop_path: h.backdropPath,
                vote_average: 8.5,
                vote_count: 10,
                popularity: 10,
                media_type: h.mediaType || 'movie'
              };

              const posterUrl = h.posterPath
                ? `https://image.tmdb.org/t/p/w300${h.posterPath}`
                : 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=300&auto=format&fit=crop&q=80';

              return (
                <div
                  key={h.id}
                  onClick={() => onPlayMedia(matchedMedia, h.season, h.episode)}
                  className="flex items-center gap-4 bg-[#101713] hover:bg-emerald-950/40 border border-emerald-900/50 hover:border-emerald-500/40 p-3 rounded-2xl cursor-pointer group transition"
                >
                  <img src={posterUrl} alt={h.title} className="w-16 h-22 rounded-xl object-cover" />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-sm text-white group-hover:text-emerald-400 transition-colors truncate">
                      {h.title}
                    </h4>
                    {h.season && (
                      <p className="text-xs text-emerald-400 font-mono mt-0.5">
                        S{h.season}:E{h.episode} {h.episodeTitle ? `• ${h.episodeTitle}` : ''}
                      </p>
                    )}
                    <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden mt-3">
                      <div className="bg-emerald-500 h-full" style={{ width: `${h.progressPercent}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Render All 21 Horizontal Category Carousels in Exact Sequence */}
      {sections.map((sec, idx) => {
        const items = sectionData[sec.id] || [];
        const isLoading = Boolean(loadingMap[sec.id] && !items.length);

        return (
          <div
            key={sec.id}
            ref={idx >= 4 ? (el) => { sectionRefs.current[sec.id] = el; } : undefined}
          >
            <MediaCarousel
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
          </div>
        );
      })}
    </div>
  );
};
