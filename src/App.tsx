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
import { MediaDetailsModal } from './components/MediaDetailsModal';
import { AgeGate, isAgeVerified } from './components/AgeGate';
import { AuthModal } from './components/AuthModal';

import { MediaItem, UserProfile, SiteSettings } from './types';
import { fetchSiteSettings } from './services/api';
import { loadUserProfile, saveUserProfile, DEFAULT_USER, registerProfileSyncListener } from './services/storage';
import { 
  subscribeToSiteSettings, 
  subscribeToUserProfile, 
  saveProfileToFirestore, 
  logoutUser, 
  auth 
} from './services/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { toast } from 'sonner';

const VALID_TABS = new Set(['home', 'search', 'movies', 'tv', 'sports', 'library', 'settings']);

function getInitialTab(): string {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab');
  return tab && VALID_TABS.has(tab) ? tab : 'home';
}

export default function App() {
  const [ageVerified, setAgeVerified] = useState(isAgeVerified);
  const [currentTab, setCurrentTab] = useState<string>(getInitialTab);
  const [inspectItem, setInspectItem] = useState<MediaItem | null>(null);
  const [activeMedia, setActiveMedia] = useState<MediaItem | null>(null);
  const [playSeason, setPlaySeason] = useState<number | undefined>(undefined);
  const [playEpisode, setPlayEpisode] = useState<number | undefined>(undefined);

  // User Profile & Settings State
  const [user, setUser] = useState<UserProfile>(() => loadUserProfile());
  const [currentUser, setCurrentUser] = useState<User | null>(() => auth.currentUser);
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null);

  // Auth Modal State
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalReason, setAuthModalReason] = useState<string | undefined>(undefined);

  const isLoggedIn = Boolean(currentUser && user.id && user.id !== 'guest_user');

  // Register background Firestore sync for any watchlist/history/favorite updates
  useEffect(() => {
    registerProfileSyncListener((updated) => {
      if (auth.currentUser) {
        saveProfileToFirestore(updated);
      }
    });
  }, []);

  // Sync tab with URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') !== currentTab) {
      params.set('tab', currentTab);
      window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
    }
  }, [currentTab]);

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
    setPlaySeason(season || 1);
    setPlayEpisode(episode || 1);
  };

  const handleInspectMedia = (item: MediaItem) => {
    setInspectItem(item);
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

  const handleAuthSuccess = (authenticatedUser: UserProfile) => {
    setUser(authenticatedUser);
    setIsAuthModalOpen(false);
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
          <SportsView />
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
        />
      )}

      {/* ── Cinema Theater Watch Player (Screenshot 11) ── */}
      {activeMedia && (
        <WatchPlayer
          media={activeMedia}
          user={user}
          isLoggedIn={isLoggedIn}
          initialSeason={playSeason}
          initialEpisode={playEpisode}
          onClose={() => setActiveMedia(null)}
          onUpdateUser={handleUpdateUser}
        />
      )}

      {/* ── Firebase Authentication Modal ── */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
        promptReason={authModalReason}
      />
    </div>
  );
}
