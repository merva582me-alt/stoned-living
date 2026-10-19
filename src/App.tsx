import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { HomeView } from './components/HomeView';
import { SearchView } from './components/SearchView';
import { MoviesView } from './components/MoviesView';
import { TvView } from './components/TvView';
import { SportsView } from './components/SportsView';
import { LibraryView } from './components/LibraryView';
import { SettingsView } from './components/SettingsView';
import { WatchPlayer } from './components/WatchPlayer';
import { SportsWatchPlayer } from './components/SportsWatchPlayer';
import { MediaDetailsModal } from './components/MediaDetailsModal';
import { AuthModal } from './components/AuthModal';
import { ScrollToTopButton } from './components/ScrollToTopButton';

import { MediaItem, UserProfile, SiteSettings, APIMatch } from './types';
import { fetchSiteSettings, fetchMediaDetail } from './services/api';
import { fetchLiveMatches, fetchTodayMatches } from './services/sportsApi';
import { 
  loadUserProfile, 
  saveUserProfile, 
  DEFAULT_USER, 
  registerProfileSyncListener, 
  registerAuthPromptListener,
  toggleWatchlist,
  removeFromWatchHistory
} from './services/storage';
import { 
  subscribeToSiteSettings, 
  subscribeToUserProfile, 
  fetchUserProfileFromFirestore,
  saveProfileToFirestore, 
  logoutUser, 
  auth 
} from './services/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { toast } from 'sonner';

const VALID_TABS = new Set(['home', 'search', 'movies', 'tv', 'sports', 'library', 'settings']);

export interface PlayerRoute {
  type: 'movie' | 'series' | 'sports';
  id: string;
  season?: number;
  episode?: number;
}

export function parsePlayerRoute(): PlayerRoute | null {
  if (typeof window === 'undefined') return null;
  const pathname = window.location.pathname;
  const searchParams = new URLSearchParams(window.location.search);

  // Path route: /player/movie/:id
  const moviePathMatch = pathname.match(/^\/player\/movie\/([^/?#]+)/i);
  if (moviePathMatch) {
    return { type: 'movie', id: moviePathMatch[1] };
  }

  // Path route: /player/series/:id/:season/:episode or /player/series/:id
  const seriesPathMatch = pathname.match(/^\/player\/series\/([^/?#]+)(?:\/(\d+))?(?:\/(\d+))?/i);
  if (seriesPathMatch) {
    const s = seriesPathMatch[2] ? parseInt(seriesPathMatch[2], 10) : 1;
    const e = seriesPathMatch[3] ? parseInt(seriesPathMatch[3], 10) : 1;
    return { type: 'series', id: seriesPathMatch[1], season: s, episode: e };
  }

  // Path route: /player/sports/:id
  const sportsPathMatch = pathname.match(/^\/player\/sports\/([^/?#]+)/i);
  if (sportsPathMatch) {
    return { type: 'sports', id: sportsPathMatch[1] };
  }

  // Universal query parameter fallbacks:
  // /player/movie?id=...
  if (pathname.startsWith('/player/movie')) {
    const id = searchParams.get('id') || searchParams.get('tmdbId');
    if (id) return { type: 'movie', id };
  }
  // /player/series?id=...&season=...&episode=...
  if (pathname.startsWith('/player/series')) {
    const id = searchParams.get('id') || searchParams.get('tmdbId');
    const s = searchParams.get('season') ? parseInt(searchParams.get('season')!, 10) : 1;
    const e = searchParams.get('episode') ? parseInt(searchParams.get('episode')!, 10) : 1;
    if (id) return { type: 'series', id, season: s, episode: e };
  }
  // /player/sports?id=...
  if (pathname.startsWith('/player/sports')) {
    const id = searchParams.get('id');
    if (id) return { type: 'sports', id };
  }

  return null;
}

function getInitialTab(): string {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab');
  return tab && VALID_TABS.has(tab) ? tab : 'home';
}

export default function App() {
  const [currentTab, setCurrentTab] = useState<string>(getInitialTab);
  const [inspectItem, setInspectItem] = useState<MediaItem | null>(null);
  const [activeMedia, setActiveMedia] = useState<MediaItem | null>(null);
  const [playSeason, setPlaySeason] = useState<number | undefined>(undefined);
  const [playEpisode, setPlayEpisode] = useState<number | undefined>(undefined);
  const [playerRoute, setPlayerRoute] = useState<PlayerRoute | null>(() => parsePlayerRoute());
  const [activeSportsMatch, setActiveSportsMatch] = useState<APIMatch | null>(null);
  const [pendingAddMedia, setPendingAddMedia] = useState<MediaItem | null>(null);

  // User Profile & Settings State
  const [user, setUser] = useState<UserProfile>(() => loadUserProfile());
  const [currentUser, setCurrentUser] = useState<User | null>(() => auth.currentUser);
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null);

  // Auth Modal State
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalReason, setAuthModalReason] = useState<string | undefined>(undefined);

  // User is logged in whenever their profile ID is established and not the guest placeholder
  const isLoggedIn = Boolean(user && user.id && user.id !== 'guest_user');

  // Register background Firestore sync for any watchlist/history/favorite updates
  useEffect(() => {
    registerProfileSyncListener((updated, immediate) => {
      if (auth.currentUser || (updated.id && updated.id !== 'guest_user')) {
        saveProfileToFirestore(updated, Boolean(immediate));
      }
    });
  }, []);

  // Clear any legacy age verification data
  useEffect(() => {
    try {
      localStorage.removeItem('stoned_living_age_verified');
    } catch {}
  }, []);

  // Listen for Add to List requests triggered when not logged in
  useEffect(() => {
    registerAuthPromptListener((targetItem) => {
      setPendingAddMedia(targetItem);
      setAuthModalReason('Please sign in or create an account to save titles to your personal list');
      setIsAuthModalOpen(true);
    });
  }, []);

  // Sync tab with URL when not viewing standalone player
  useEffect(() => {
    if (playerRoute) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') !== currentTab) {
      params.set('tab', currentTab);
      window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
    }
  }, [currentTab, playerRoute]);

  // Handle browser Back & Forward button navigation (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const route = parsePlayerRoute();
      setPlayerRoute(route);
      if (!route) {
        setActiveMedia(null);
        setActiveSportsMatch(null);
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        if (tab && VALID_TABS.has(tab)) {
          setCurrentTab(tab);
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Resolve media item when loaded directly via /player/movie/:id or /player/series/:id or /player/sports/:id
  useEffect(() => {
    if (!playerRoute) return;

    if (playerRoute.type === 'movie' || playerRoute.type === 'series') {
      const mediaId = Number(playerRoute.id);
      if (!isNaN(mediaId) && (!activeMedia || activeMedia.id !== mediaId)) {
        fetchMediaDetail(playerRoute.type === 'movie' ? 'movie' : 'tv', mediaId)
          .then((detail) => {
            if (detail) {
              setActiveMedia(detail);
              if (playerRoute.type === 'series') {
                setPlaySeason(playerRoute.season || 1);
                setPlayEpisode(playerRoute.episode || 1);
              }
            } else {
              toast.error('Could not load title details');
            }
          })
          .catch(() => {
            toast.error('Failed to load title');
          });
      }
    } else if (playerRoute.type === 'sports') {
      const matchId = playerRoute.id;
      if (!activeSportsMatch || activeSportsMatch.id !== matchId) {
        Promise.all([fetchLiveMatches(), fetchTodayMatches()])
          .then(([live, today]) => {
            const allMatches = [...live, ...today];
            const found = allMatches.find((m) => String(m.id) === String(matchId));
            if (found) {
              setActiveSportsMatch(found);
            } else {
              setActiveSportsMatch({
                id: matchId,
                title: 'Live Sports Broadcast',
                category: 'Sports',
                date: Date.now(),
                sources: [{ source: 'alpha', id: matchId }],
              });
            }
          })
          .catch(() => {
            setActiveSportsMatch({
              id: matchId,
              title: 'Live Sports Broadcast',
              category: 'Sports',
              date: Date.now(),
              sources: [{ source: 'alpha', id: matchId }],
            });
          });
      }
    }
  }, [playerRoute]);

  // Real-time site settings listener
  useEffect(() => {
    fetchSiteSettings().then(setSiteSettings);
    const unsubscribe = subscribeToSiteSettings((live) => {
      setSiteSettings(live);
    });
    return () => unsubscribe();
  }, []);

  // Real-time Firebase Auth and Firestore User synchronization
  useEffect(() => {
    let unsubProfile: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setCurrentUser(firebaseUser);

      if (firebaseUser) {
        // Immediate cloud data fetch so on any device/refresh, cloud data loads directly
        fetchUserProfileFromFirestore(firebaseUser.uid).then((cloudData) => {
          if (cloudData) {
            saveUserProfile(cloudData, false);
            setUser(cloudData);
          }
        });

        // Subscribe to real-time Firestore profile
        if (unsubProfile) unsubProfile();
        unsubProfile = subscribeToUserProfile(firebaseUser, (cloudProfile) => {
          setUser(cloudProfile);
        });
      } else {
        if (unsubProfile) {
          unsubProfile();
          unsubProfile = null;
        }
        setUser((prev) => {
          if (!prev.id || prev.id === 'guest_user') {
            return { ...prev, watchHistory: [] };
          }
          return prev;
        });
      }
    });

    return () => {
      unsubAuth();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  const handlePlayMedia = (item: MediaItem, season?: number, episode?: number) => {
    setInspectItem(null);
    setActiveMedia(item);
    const s = season || 1;
    const e = episode || 1;
    setPlaySeason(s);
    setPlayEpisode(e);

    const isTv = item.media_type === 'tv' || Boolean(item.first_air_date);
    const route: PlayerRoute = isTv
      ? { type: 'series', id: String(item.id), season: s, episode: e }
      : { type: 'movie', id: String(item.id) };

    const url = isTv
      ? `/player/series/${item.id}/${s}/${e}`
      : `/player/movie/${item.id}`;

    setPlayerRoute(route);
    window.history.pushState(null, '', url);
  };

  const handleSelectSportsMatch = (match: APIMatch) => {
    setActiveSportsMatch(match);
    const route: PlayerRoute = { type: 'sports', id: String(match.id) };
    setPlayerRoute(route);
    window.history.pushState(null, '', `/player/sports/${match.id}`);
  };

  const handleClosePlayer = () => {
    setActiveMedia(null);
    setActiveSportsMatch(null);
    setPlayerRoute(null);

    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.history.pushState(null, '', `/?tab=${currentTab}`);
    }
  };

  const handleInspectMedia = (item: MediaItem) => {
    setInspectItem(item);
  };

  const handleRequireLogin = (targetItem: MediaItem) => {
    setPendingAddMedia(targetItem);
    setAuthModalReason('Please sign in or create an account to save titles to your personal list');
    setIsAuthModalOpen(true);
  };

  const handleNavigateTab = (tab: string) => {
    // If user is not logged in and clicks library or settings, show Auth Modal with prompt reason
    if (tab === 'library' && !isLoggedIn) {
      setAuthModalReason('Please sign in or create an account to access and sync My Library');
      setIsAuthModalOpen(true);
      return;
    }

    if (tab === 'settings' && !isLoggedIn) {
      setAuthModalReason('Please sign in or create an account to access and sync your Settings');
      setIsAuthModalOpen(true);
      return;
    }

    if (VALID_TABS.has(tab)) {
      setCurrentTab(tab);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleUpdateUser = (updated: UserProfile) => {
    setUser(updated);
    saveUserProfile(updated);
    if (auth.currentUser) {
      saveProfileToFirestore(updated);
    }
  };

  const handleRemoveWatchHistory = (mediaId: number, season?: number, episode?: number) => {
    const updated = removeFromWatchHistory(mediaId, season, episode);
    setUser(updated);
    if (auth.currentUser) {
      saveProfileToFirestore(updated);
    }
    toast.success('Removed from Continue Watching');
  };

  const handleAuthSuccess = (authenticatedUser: UserProfile) => {
    setUser(authenticatedUser);
    setIsAuthModalOpen(false);

    // If an item was queued to be added to list, add it automatically
    if (pendingAddMedia) {
      const res = toggleWatchlist(pendingAddMedia);
      const title = pendingAddMedia.title || pendingAddMedia.name || 'title';
      toast.success(`Saved "${title}" to your List`);
      handleUpdateUser(res.updatedProfile);
      setPendingAddMedia(null);
    }

    if (authModalReason?.includes('Library')) {
      setCurrentTab('library');
    } else if (authModalReason?.includes('Settings')) {
      setCurrentTab('settings');
    }
    setAuthModalReason(undefined);
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      const guestProfile: UserProfile = {
        ...DEFAULT_USER,
        id: 'guest_user',
        username: 'VIP Guest',
        email: 'viewer@stoned.living',
        watchlist: [],
        stashDetails: {},
        watchHistory: [],
        favorites: [],
        customLists: []
      };
      setUser(guestProfile);
      saveUserProfile(guestProfile);
      if (currentTab === 'library') {
        setCurrentTab('home');
      }
      toast.success('Signed out successfully');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-black text-white selection:bg-red-600 selection:text-white">
      {/* ── Fixed Left Sidebar Dock (With Firebase Login / Account) ── */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={handleNavigateTab}
        accentColor={user.settings?.accentColor || 'emerald'}
        user={user}
        isLoggedIn={isLoggedIn}
        onOpenLogin={() => {
          setAuthModalReason(undefined);
          setIsAuthModalOpen(true);
        }}
        onLogout={handleLogout}
      />

      {/* ── Main Content Viewport ── */}
      {/* Mobile: pb-20 (bottom nav bar). Desktop: pl-16 / pl-[72px] (side dock). */}
      <div className="w-full min-h-screen pt-0 pb-20 md:pt-0 md:pb-0 md:pl-16 lg:pl-[72px] transition-all duration-300">
        {/* Tab Routing */}
        {currentTab === 'home' && (
          <HomeView
            user={user}
            isLoggedIn={isLoggedIn}
            onPlayMedia={handlePlayMedia}
            onInspectItem={handleInspectMedia}
            onNavigateTab={handleNavigateTab}
            onRequireLogin={handleRequireLogin}
            onUpdateUser={handleUpdateUser}
            onRemoveWatchHistory={handleRemoveWatchHistory}
          />
        )}

        {currentTab === 'search' && (
          <SearchView
            onOpenDetails={handleInspectMedia}
            onPlayMedia={handlePlayMedia}
          />
        )}

        {currentTab === 'movies' && (
          <MoviesView
            onOpenDetails={handleInspectMedia}
            onPlayMedia={handlePlayMedia}
          />
        )}

        {currentTab === 'tv' && (
          <TvView
            onOpenDetails={handleInspectMedia}
            onPlayMedia={handlePlayMedia}
          />
        )}

        {currentTab === 'sports' && (
          <SportsView
            onPlayMedia={handleInspectMedia}
            onSelectMatch={handleSelectSportsMatch}
          />
        )}

        {currentTab === 'library' && (
          <LibraryView
            user={user}
            isLoggedIn={isLoggedIn}
            onOpenLogin={() => {
              setAuthModalReason('Please sign in or create an account to access and sync My Library');
              setIsAuthModalOpen(true);
            }}
            onOpenDetails={handleInspectMedia}
            onPlayMedia={handlePlayMedia}
            onNavigateTab={handleNavigateTab}
            onRemoveWatchHistory={handleRemoveWatchHistory}
          />
        )}

        {currentTab === 'settings' && (
          <SettingsView
            user={user}
            isLoggedIn={isLoggedIn}
            onOpenLogin={() => {
              setAuthModalReason('Please sign in or create an account to access and sync your Settings');
              setIsAuthModalOpen(true);
            }}
            onUpdateUser={handleUpdateUser}
          />
        )}
      </div>

      {/* ── Media Details Modal Dialog (Screenshots 9 & 10) ── */}
      {inspectItem && (
        <MediaDetailsModal
          item={inspectItem}
          onClose={() => setInspectItem(null)}
          onPlay={handlePlayMedia}
          onSelectMedia={(m) => setInspectItem(m)}
          isLoggedIn={isLoggedIn}
          onRequireLogin={handleRequireLogin}
          onUpdateUser={handleUpdateUser}
          userWatchlist={user.watchlist}
        />
      )}

      {/* ── Standalone Cinema Watch Player (/player/movie/:id and /player/series/:id/:season/:episode) ── */}
      {((playerRoute && (playerRoute.type === 'movie' || playerRoute.type === 'series')) || activeMedia) && (
        activeMedia ? (
          <WatchPlayer
            media={activeMedia}
            user={user}
            isLoggedIn={isLoggedIn}
            initialSeason={playSeason || playerRoute?.season || 1}
            initialEpisode={playEpisode || playerRoute?.episode || 1}
            onClose={handleClosePlayer}
            onUpdateUser={handleUpdateUser}
          />
        ) : (
          <div className="fixed inset-0 z-50 bg-[#050806] text-white flex flex-col items-center justify-center p-6 select-none">
            <div className="w-12 h-12 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin mb-4 shadow-[0_0_20px_rgba(0,223,130,0.3)]" />
            <h2 className="text-base sm:text-lg font-black tracking-wider text-emerald-400 font-mono">
              CONNECTING TO THEATER STREAM...
            </h2>
            <p className="text-xs text-zinc-400 mt-1 font-mono text-center max-w-sm">
              Loading 4K cinema stream on {playerRoute?.type === 'series' ? 'Series' : 'Movie'} channel...
            </p>
            <button
              onClick={handleClosePlayer}
              className="mt-6 px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 text-xs font-bold transition cursor-pointer"
            >
              Return to Catalog
            </button>
          </div>
        )
      )}

      {/* ── Standalone Sports Watch Player (/player/sports/:id) ── */}
      {((playerRoute && playerRoute.type === 'sports') || activeSportsMatch) && (
        activeSportsMatch ? (
          <SportsWatchPlayer
            match={activeSportsMatch}
            onClose={handleClosePlayer}
          />
        ) : (
          <div className="fixed inset-0 z-50 bg-[#050806] text-white flex flex-col items-center justify-center p-6 select-none">
            <div className="w-12 h-12 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin mb-4 shadow-[0_0_20px_rgba(0,223,130,0.3)]" />
            <h2 className="text-base sm:text-lg font-black tracking-wider text-emerald-400 font-mono">
              CONNECTING TO LIVE BROADCAST...
            </h2>
            <p className="text-xs text-zinc-400 mt-1 font-mono text-center max-w-sm">
              Retrieving live match broadcast stream...
            </p>
            <button
              onClick={handleClosePlayer}
              className="mt-6 px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 text-xs font-bold transition cursor-pointer"
            >
              Return to Sports
            </button>
          </div>
        )
      )}

      {/* ── Firebase Authentication Modal ── */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
        promptReason={authModalReason}
      />

      {/* ── Floating Scroll to Top Button (Home, Search, Movies, Series, Sports) ── */}
      {['home', 'search', 'movies', 'tv', 'sports'].includes(currentTab) && (
        <ScrollToTopButton />
      )}
    </div>
  );
}
