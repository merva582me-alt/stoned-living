import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AgeGate, isAgeVerified } from './components/AgeGate';
import { Navbar } from './components/Navbar';
import { HomeView } from './components/HomeView';
import { MoviesView } from './components/MoviesView';
import { TvView } from './components/TvView';
import { AnimeView } from './components/AnimeView';
import { SportsView } from './components/SportsView';
import { HeroSlider } from './components/HeroSlider';
import { MediaCarousel } from './components/MediaCarousel';
import { MediaCard } from './components/MediaCard';
import { WatchPlayer } from './components/WatchPlayer';
import { MediaDetailsModal } from './components/MediaDetailsModal';
import { SearchModal } from './components/SearchModal';
import { AdminPanel } from './components/AdminPanel';
import { AdminLoginModal } from './components/AdminLoginModal';
import { Footer } from './components/Footer';
import { SmokeParticleCanvas } from './components/SmokeParticleCanvas';

import { MediaItem, UserProfile, SiteSettings } from './types';
import { fetchTrending, discoverMedia, discoverMediaAdvanced, fetchTopRated, fetchAnime, fetchSiteSettings, enrichListClient } from './services/api';
import { MOCK_MOVIES, MOCK_SHOWS } from './data/mockTmdbData';
import { loadUserProfile, saveUserProfile } from './services/storage';
import { Flame, Film, Tv, Sparkles, Star, Clock, Bookmark, Heart, Smile, Zap, Ghost, HeartHandshake, Baby, Shield, Rocket, Trophy, Compass, ShieldAlert } from 'lucide-react';
import { subscribeToSiteSettings } from './services/firebase';
import { toast } from 'sonner';

// Genre Configurations for Movies
const MOVIE_GENRE_CONFIGS = [
  { id: 'new', name: 'New Movies', icon: Flame, title: '🍿 New & Fresh Movies', subtitle: 'Latest theatrical and digital movie releases' },
  { id: 28, name: 'Action', icon: Zap, title: '🔥 Action & Adrenaline', subtitle: 'Explosive blockbusters, martial arts, and high-stakes chases' },
  { id: 35, name: 'Comedy', icon: Smile, title: '😂 High-Vibe Comedy', subtitle: 'Hilarious buddy comedies, slapstick, and endless laughs' },
  { id: 27, name: 'Horror', icon: Ghost, title: '👻 Horror & Midnight Thrills', subtitle: 'Supernatural chills, psychological suspense, and creature features' },
  { id: 10751, name: 'Kids', icon: Baby, title: '🎨 Kids & Family Cinema', subtitle: 'Fun animated journeys and family adventures for all ages' },
  { id: 10749, name: 'Romance', icon: Heart, title: '❤️ Romance & Love Stories', subtitle: 'Heartwarming, romantic, and emotional feature films' },
  { id: 'romcom', name: 'Rom Com', icon: HeartHandshake, title: '💕 Rom-Com Favorites', subtitle: 'Witty, romantic comedies full of charm and feel-good vibes' },
  { id: 878, name: 'Sci-Fi', icon: Rocket, title: '🌌 Sci-Fi & Cosmic Worlds', subtitle: 'Space exploration, futuristic dystopias, and mindbenders' },
  { id: 53, name: 'Thriller', icon: Zap, title: '⚡ Edge-of-Your-Seat Thrillers', subtitle: 'High tension, espionage, twists, and psychological games' },
  { id: 80, name: 'Crime', icon: Shield, title: '🕵️ Crime & Heist Cinema', subtitle: 'Mob sagas, elaborate bank heists, and gritty undercover stories' },
  { id: 'classics', name: 'All-Time Classics', icon: Trophy, title: '🏆 All-Time Classic Movies', subtitle: 'Top-rated, critically acclaimed cinema masterpieces' }
];

// Genre Configurations for TV Shows
const TV_GENRE_CONFIGS = [
  { id: 'new_tv', name: 'New TV Shows', icon: Tv, title: '📺 New & Trending TV Series', subtitle: 'Fresh season premieres and trending series' },
  { id: 35, name: 'Comedy', icon: Smile, title: '🤣 Comedy TV Series', subtitle: 'Sitcoms, comedy series, and lighthearted binges' },
  { id: 9648, name: 'Horror', icon: Ghost, title: '👁️ Horror & Mystery Series', subtitle: 'Creepy mysteries, supernatural thrillers, and dark tales' },
  { id: 10759, name: 'Action', icon: Zap, title: '⚡ Action & Adventure TV', subtitle: 'High-octane series, superhero sagas, and epic quests' },
  { id: 10762, name: 'Kids', icon: Baby, title: '🎈 Kids & Youth Shows', subtitle: 'Family-friendly animated and live-action series' },
  { id: 18, name: 'Romance', icon: Heart, title: '💘 Romance & Drama Series', subtitle: 'Captivating relationship dramas and romantic sagas' },
  { id: 'cop_shows', name: 'Cop Shows', icon: Shield, title: '🕵️ Cop & Crime Thrillers', subtitle: 'Police procedurals, detective cases, and crime syndicates' },
  { id: 10765, name: 'Sci-Fi & Fantasy', icon: Rocket, title: '🚀 Sci-Fi & Fantasy Shows', subtitle: 'Epic fantasy realms, space adventures, and dystopian futures' },
  { id: 'classics', name: 'All-Time Classics', icon: Trophy, title: '👑 All-Time Classic TV Series', subtitle: 'Highest rated TV series of all time' }
];

// Anime Category Configurations
const ANIME_CATEGORY_CONFIGS = [
  { id: 'trending_anime', name: 'Trending Anime', icon: Sparkles, title: '🔥 Trending & Popular Anime', subtitle: 'Top Japanese animated series streaming right now' },
  { id: 'shonen', name: 'Action / Shonen', icon: Zap, title: '⚔️ Action & Shonen Anime', subtitle: 'Epic battles, power-ups, martial sagas, and tournaments' },
  { id: 'comedy_anime', name: 'Comedy & Slice of Life', icon: Smile, title: '🍡 Comedy & Slice of Life', subtitle: 'Charming, funny, and comforting daily life anime' },
  { id: 'fantasy_anime', name: 'Fantasy & Isekai', icon: Compass, title: '🔮 Fantasy & Isekai Realms', subtitle: 'Reincarnation, magical systems, and mythical monster quests' },
  { id: 'romance_anime', name: 'Romance & Drama', icon: Heart, title: '🌸 Romance & High School Drama', subtitle: 'Touching high school romance, tearjerkers, and love stories' },
  { id: 'anime_movies', name: 'Anime Movies', icon: Film, title: '🎬 Feature Length Anime Movies', subtitle: 'Cinematic Japanese anime feature films' },
  { id: 'classic_anime', name: 'All-Time Classics', icon: Trophy, title: '🏆 All-Time Classic Anime', subtitle: 'Highest rated masterpiece anime series and films' }
];

const VALID_TABS = new Set(['home', 'movies', 'tv', 'anime', 'sports', 'admin']);

function getInitialTab(): string {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab');
  return tab && VALID_TABS.has(tab) ? tab : 'home';
}

export default function App() {
  const [ageVerified, setAgeVerified] = useState(isAgeVerified);
  const [currentTab, setCurrentTab] = useState(getInitialTab);
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(() => new Set([getInitialTab()]));
  const [searchOpen, setSearchOpen] = useState(false);
  const [inspectItem, setInspectItem] = useState<MediaItem | null>(null);
  const [activeMedia, setActiveMedia] = useState<MediaItem | null>(null);
  const [playSeason, setPlaySeason] = useState<number | undefined>(undefined);
  const [playEpisode, setPlayEpisode] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (currentTab !== 'watch') {
      setVisitedTabs((prev) => {
        if (prev.has(currentTab)) return prev;
        const next = new Set(prev);
        next.add(currentTab);
        return next;
      });
    }
  }, [currentTab]);

  // App Data & Settings State
  const [user, setUser] = useState<UserProfile>(loadUserProfile());
  const [settings, setSettings] = useState<SiteSettings | null>(null);

  // Admin Portal State
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('stoned_admin_auth') === 'true';
  });
  const [adminModalOpen, setAdminModalOpen] = useState(false);

  // HOME PAGE STATES (Pre-populated for instant initial load)
  const [homeNewMovies, setHomeNewMovies] = useState<MediaItem[]>(() => enrichListClient(MOCK_MOVIES) as MediaItem[]);
  const [homeTrendingShows, setHomeTrendingShows] = useState<MediaItem[]>(() => enrichListClient(MOCK_SHOWS) as MediaItem[]);
  const [homeTrendingMovies, setHomeTrendingMovies] = useState<MediaItem[]>(() => enrichListClient(MOCK_MOVIES) as MediaItem[]);
  const [homeTrendingAnime, setHomeTrendingAnime] = useState<MediaItem[]>(() => enrichListClient(MOCK_SHOWS.filter(s => s.genre_ids?.includes(16) || s.name?.includes('Dragon') || s.name?.includes('Demon') || s.name?.includes('Attack'))) as MediaItem[]);
  const [homeAllTimeClassics, setHomeAllTimeClassics] = useState<MediaItem[]>(() => enrichListClient([...MOCK_MOVIES, ...MOCK_SHOWS]) as MediaItem[]);

  // MOVIES PAGE STATES
  const [movieGenreData, setMovieGenreData] = useState<Record<string | number, MediaItem[]>>({});
  const [selectedMovieGenre, setSelectedMovieGenre] = useState<string | number | undefined>();
  const [singleMovieGenreGrid, setSingleMovieGenreGrid] = useState<MediaItem[]>([]);
  const [loadingMovieGenreGrid, setLoadingMovieGenreGrid] = useState(false);

  // TV SHOWS PAGE STATES
  const [tvGenreData, setTvGenreData] = useState<Record<string | number, MediaItem[]>>({});
  const [selectedTvGenre, setSelectedTvGenre] = useState<string | number | undefined>();
  const [singleTvGenreGrid, setSingleTvGenreGrid] = useState<MediaItem[]>([]);
  const [loadingTvGenreGrid, setLoadingTvGenreGrid] = useState(false);

  // ANIME PAGE STATES
  const [animeCategoryData, setAnimeCategoryData] = useState<Record<string, MediaItem[]>>({});
  const [selectedAnimeCategory, setSelectedAnimeCategory] = useState<string | undefined>();
  const [singleAnimeCategoryGrid, setSingleAnimeCategoryGrid] = useState<MediaItem[]>([]);
  const [loadingAnimeCategoryGrid, setLoadingAnimeCategoryGrid] = useState(false);

  // Fetch and subscribe to site settings in real-time
  useEffect(() => {
    fetchSiteSettings().then(setSettings);
    const unsubscribe = subscribeToSiteSettings((liveSettings) => {
      setSettings(liveSettings);
    });
    return () => unsubscribe();
  }, []);

  // Fetch initial media catalogs exclusively from TMDb API
  useEffect(() => {
    // 1. Home page data fetches
    fetchTrending('movie', 'day').then((m) => {
      if (m && m.length) setHomeTrendingMovies(m);
    });

    fetchTrending('tv', 'day').then((s) => {
      if (s && s.length) setHomeTrendingShows(s);
    });

    discoverMedia('movie').then((m) => {
      if (m && m.length) setHomeNewMovies(m);
    });

    fetchAnime('tv', { sort_by: 'popularity.desc' }).then((a) => {
      if (a && a.length) setHomeTrendingAnime(a);
    });

    // All-time classics for home page (combine top rated movies, tv, anime)
    Promise.all([
      fetchTopRated('movie'),
      fetchTopRated('tv'),
      fetchAnime('tv', { sort_by: 'vote_average.desc', 'vote_count.gte': '300' })
    ]).then(([mTop, tvTop, animeTop]) => {
      const combined: MediaItem[] = [];
      const maxLength = Math.max(mTop.length, tvTop.length, animeTop.length);
      for (let i = 0; i < maxLength; i++) {
        if (mTop[i]) combined.push({ ...mTop[i], media_type: 'movie' });
        if (tvTop[i]) combined.push({ ...tvTop[i], media_type: 'tv' });
        if (animeTop[i]) combined.push({ ...animeTop[i], media_type: 'tv' });
      }
      setHomeAllTimeClassics(combined);
    });

    fetchSiteSettings().then(setSettings);
  }, []);

  // Fetch single Movie genre grid when chip selected
  useEffect(() => {
    if (selectedMovieGenre !== undefined) {
      setLoadingMovieGenreGrid(true);
      if (selectedMovieGenre === 'new') {
        discoverMedia('movie').then((items) => {
          setSingleMovieGenreGrid(items);
          setLoadingMovieGenreGrid(false);
        });
      } else if (selectedMovieGenre === 'romcom') {
        discoverMediaAdvanced('movie', { with_genres: '10749,35' }).then((items) => {
          setSingleMovieGenreGrid(items);
          setLoadingMovieGenreGrid(false);
        });
      } else if (selectedMovieGenre === 'classics') {
        fetchTopRated('movie').then((items) => {
          setSingleMovieGenreGrid(items);
          setLoadingMovieGenreGrid(false);
        });
      } else if (typeof selectedMovieGenre === 'number') {
        discoverMedia('movie', selectedMovieGenre).then((items) => {
          setSingleMovieGenreGrid(items);
          setLoadingMovieGenreGrid(false);
        });
      } else {
        setLoadingMovieGenreGrid(false);
        setSingleMovieGenreGrid([]);
      }
    } else {
      setSingleMovieGenreGrid([]);
    }
  }, [selectedMovieGenre]);

  // Fetch single TV genre grid when chip selected
  useEffect(() => {
    if (selectedTvGenre !== undefined) {
      setLoadingTvGenreGrid(true);
      if (selectedTvGenre === 'new_tv') {
        discoverMedia('tv').then((items) => {
          setSingleTvGenreGrid(items);
          setLoadingTvGenreGrid(false);
        });
      } else if (selectedTvGenre === 'cop_shows') {
        discoverMedia('tv', 80).then((items) => {
          setSingleTvGenreGrid(items);
          setLoadingTvGenreGrid(false);
        });
      } else if (selectedTvGenre === 'classics') {
        fetchTopRated('tv').then((items) => {
          setSingleTvGenreGrid(items);
          setLoadingTvGenreGrid(false);
        });
      } else if (typeof selectedTvGenre === 'number') {
        discoverMedia('tv', selectedTvGenre).then((items) => {
          setSingleTvGenreGrid(items);
          setLoadingTvGenreGrid(false);
        });
      } else {
        setLoadingTvGenreGrid(false);
        setSingleTvGenreGrid([]);
      }
    } else {
      setSingleTvGenreGrid([]);
    }
  }, [selectedTvGenre]);

  // Fetch single Anime category grid when chip selected
  useEffect(() => {
    if (selectedAnimeCategory !== undefined) {
      setLoadingAnimeCategoryGrid(true);
      if (selectedAnimeCategory === 'trending_anime') {
        fetchAnime('tv', { sort_by: 'popularity.desc' }).then((items) => {
          setSingleAnimeCategoryGrid(items);
          setLoadingAnimeCategoryGrid(false);
        });
      } else if (selectedAnimeCategory === 'shonen') {
        fetchAnime('tv', { with_genres: '16,10759' }).then((items) => {
          setSingleAnimeCategoryGrid(items);
          setLoadingAnimeCategoryGrid(false);
        });
      } else if (selectedAnimeCategory === 'comedy_anime') {
        fetchAnime('tv', { with_genres: '16,35' }).then((items) => {
          setSingleAnimeCategoryGrid(items);
          setLoadingAnimeCategoryGrid(false);
        });
      } else if (selectedAnimeCategory === 'fantasy_anime') {
        fetchAnime('tv', { with_genres: '16,10765' }).then((items) => {
          setSingleAnimeCategoryGrid(items);
          setLoadingAnimeCategoryGrid(false);
        });
      } else if (selectedAnimeCategory === 'romance_anime') {
        fetchAnime('tv', { with_genres: '16,10749' }).then((items) => {
          setSingleAnimeCategoryGrid(items);
          setLoadingAnimeCategoryGrid(false);
        });
      } else if (selectedAnimeCategory === 'anime_movies') {
        fetchAnime('movie', { sort_by: 'popularity.desc' }).then((items) => {
          setSingleAnimeCategoryGrid(items);
          setLoadingAnimeCategoryGrid(false);
        });
      } else if (selectedAnimeCategory === 'classic_anime') {
        fetchAnime('tv', { sort_by: 'vote_average.desc', 'vote_count.gte': '200' }).then((items) => {
          setSingleAnimeCategoryGrid(items);
          setLoadingAnimeCategoryGrid(false);
        });
      } else {
        setLoadingAnimeCategoryGrid(false);
        setSingleAnimeCategoryGrid([]);
      }
    } else {
      setSingleAnimeCategoryGrid([]);
    }
  }, [selectedAnimeCategory]);

  // Prevent main site background scrolling while details modal or search modal is open
  useEffect(() => {
    if (inspectItem || searchOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [inspectItem, searchOpen]);

  // Navigate to a tab and update the URL
  const navigateTo = (tab: string) => {
    setCurrentTab(tab);
    setSearchOpen(false);
    if (tab === 'admin' && !isAdminAuthenticated) {
      setAdminModalOpen(true);
    }
    if (VALID_TABS.has(tab)) {
      window.history.pushState({}, '', `?tab=${tab}`);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };


  // Sync tab from browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab && VALID_TABS.has(tab)) {
        setCurrentTab(tab);
      } else {
        setCurrentTab('home');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Keyboard shortcut listener (/ or Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === '/' || (e.metaKey && e.key === 'k')) && !searchOpen) {
        e.preventDefault();
        setSearchOpen(true);
      } else if (e.key === 'Escape') {
        setSearchOpen(false);
        setInspectItem(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchOpen]);

  const handleToggleWatchlist = (_item: MediaItem) => {
    // Watchlist/stash feature removed — no-op stub so child components still compile
  };

  const handlePlayMedia = (item: MediaItem, season?: number, episode?: number) => {
    setActiveMedia(item);
    setPlaySeason(season);
    setPlayEpisode(episode);
    setCurrentTab('watch');
    setInspectItem(null);
    setSearchOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const allCatalog = [
    ...homeTrendingMovies,
    ...homeTrendingShows,
    ...homeNewMovies,
    ...homeTrendingAnime,
    ...homeAllTimeClassics
  ];

  if (!ageVerified) {
    return <AgeGate onVerified={() => setAgeVerified(true)} />;
  }

  return (
    <div className="min-h-screen bg-[#0d1813] text-white selection:bg-emerald-500 selection:text-black font-sans relative pb-16 md:pb-0">
      {/* Background Particles Canvas */}
      <SmokeParticleCanvas enabled={user.settings.smokeEffects} />

      {/* Main Header Navbar */}
      <Navbar
        currentTab={currentTab}
        onNavigate={navigateTo}
        onOpenSearch={() => setSearchOpen(prev => !prev)}
        searchOpen={searchOpen}
        settings={settings}
      />

      {/* App Body Views */}
      <main className="relative z-10">
        {visitedTabs.has('home') && (
          <div className={currentTab === 'home' ? 'block' : 'hidden'}>
            <HomeView
              user={user}
              onPlayMedia={handlePlayMedia}
              onInspectItem={setInspectItem}
              onToggleWatchlist={handleToggleWatchlist}
              onNavigateTab={navigateTo}
            />
          </div>
        )}

        {visitedTabs.has('movies') && (
          <div className={currentTab === 'movies' ? 'block' : 'hidden'}>
            <MoviesView
              user={user}
              onPlayMedia={handlePlayMedia}
              onInspectItem={setInspectItem}
              onToggleWatchlist={handleToggleWatchlist}
            />
          </div>
        )}

        {visitedTabs.has('tv') && (
          <div className={currentTab === 'tv' ? 'block' : 'hidden'}>
            <TvView
              user={user}
              onPlayMedia={handlePlayMedia}
              onInspectItem={setInspectItem}
              onToggleWatchlist={handleToggleWatchlist}
            />
          </div>
        )}

        {visitedTabs.has('anime') && (
          <div className={currentTab === 'anime' ? 'block' : 'hidden'}>
            <AnimeView
              user={user}
              onPlayMedia={handlePlayMedia}
              onInspectItem={setInspectItem}
              onToggleWatchlist={handleToggleWatchlist}
            />
          </div>
        )}

        {visitedTabs.has('sports') && (
          <div className={currentTab === 'sports' ? 'block' : 'hidden'}>
            <SportsView
              user={user}
              onPlayMedia={handlePlayMedia}
            />
          </div>
        )}

        {visitedTabs.has('admin') && (
          <div className={currentTab === 'admin' ? 'block' : 'hidden'}>
            {isAdminAuthenticated ? (
              <AdminPanel
                settings={settings}
                onRefreshSettings={() => fetchSiteSettings().then(setSettings)}
                onUpdateSettings={(newSet) => setSettings(newSet)}
                onLogoutAdmin={() => {
                  sessionStorage.removeItem('stoned_admin_auth');
                  setIsAdminAuthenticated(false);
                  setUser(prev => ({ ...prev, role: 'vip' }));
                  navigateTo('home');
                  toast('Admin session logged out.');
                }}
              />
            ) : (
              <div className="w-full max-w-xl mx-auto py-16 px-4 flex flex-col items-center justify-center text-center space-y-6">
                <div className="w-20 h-20 rounded-3xl bg-amber-500/20 border-2 border-amber-500/40 flex items-center justify-center shadow-[0_0_30px_rgba(245,158,11,0.2)]">
                  <ShieldAlert className="w-10 h-10 text-amber-400" />
                </div>
                <div className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/30 inline-block">
                    Restricted Access
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black text-white">
                    Admin Dashboard Locked
                  </h2>
                  <p className="text-xs sm:text-sm text-zinc-400 max-w-md mx-auto leading-relaxed">
                    Enter administrator credentials (<span className="text-emerald-400 font-mono font-bold">reef</span>) to access system maintenance and site banner controls.
                  </p>
                </div>
                <button
                  onClick={() => setAdminModalOpen(true)}
                  className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 text-black font-extrabold text-xs sm:text-sm px-8 py-3.5 rounded-2xl shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:scale-105 active:scale-95 transition cursor-pointer"
                >
                  <ShieldAlert className="w-4 h-4" />
                  <span>Enter Admin Credentials</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* VIEW 5: WATCH PLAYER */}
        {currentTab === 'watch' && activeMedia && (
          <WatchPlayer
            media={activeMedia}
            initialSeason={playSeason || 1}
            initialEpisode={playEpisode || 1}
            user={user}
            settings={settings}
            onClose={() => navigateTo('home')}
            onSelectMedia={handlePlayMedia}
            onUpdateUser={(updated) => setUser(updated)}
          />
        )}

      </main>

      {/* Search Modal Overlay */}
      {searchOpen && (
        <SearchModal
          onClose={() => setSearchOpen(false)}
          onPlay={handlePlayMedia}
          onOpenDetails={setInspectItem}
        />
      )}

      {/* Media Details Inspect Modal */}
      {inspectItem && (
        <MediaDetailsModal
          item={inspectItem}
          onClose={() => setInspectItem(null)}
          onPlay={handlePlayMedia}
          onSelectMedia={(selected) => setInspectItem(selected)}
        />
      )}

      {/* Admin Credentials Login Modal */}
      <AdminLoginModal
        isOpen={adminModalOpen}
        onClose={() => setAdminModalOpen(false)}
        onSuccess={() => {
          setIsAdminAuthenticated(true);
          setAdminModalOpen(false);
          setUser(prev => ({ ...prev, role: 'admin' }));
        }}
      />

      {/* Main Footer */}
      <Footer onNavigate={navigateTo} userRole={user.role} />
    </div>
  );
}
