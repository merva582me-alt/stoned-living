import React, { useState, useEffect } from 'react';
import { Search, Flame, Film, Tv, Sparkles, User, Settings, ShieldAlert, Heart, Bookmark, History, Menu, X, Cannabis, LogOut, Volume2, VolumeX, Trophy } from 'lucide-react';
import { UserProfile, SiteSettings } from '../types';

export const GoogleIcon: React.FC<{ className?: string }> = ({ className = "w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" }) => (
  <svg className={className} viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);

interface NavbarProps {
  currentTab: string;
  onNavigate: (tab: string, extraData?: any) => void;
  onOpenSearch: () => void;
  searchOpen?: boolean;
  user: UserProfile;
  settings: SiteSettings | null;
  isLoggedIn?: boolean;
  onGoogleSignIn?: () => void;
  onSignOut?: () => void;
  onToggleAmbientSound?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onNavigate,
  onOpenSearch,
  searchOpen = false,
  user,
  settings,
  isLoggedIn = false,
  onGoogleSignIn,
  onSignOut,
  onToggleAmbientSound
}) => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = [
    { id: 'home',   label: 'Home',     icon: Flame    },
    { id: 'movies', label: 'Movies',   icon: Film     },
    { id: 'tv',     label: 'TV Shows', icon: Tv       },
    { id: 'anime',  label: 'Anime',    icon: Sparkles },
    { id: 'sports', label: 'Sports',   icon: Trophy   },
    { id: 'stash',  label: 'My Stash', icon: Bookmark }
  ];

  const mobileBottomNavItems = [
    { id: 'home',   label: 'Home',     icon: Flame,    onClick: () => onNavigate('home')   },
    { id: 'search', label: 'Search',   icon: Search,   onClick: onOpenSearch, isSearch: true },
    { id: 'movies', label: 'Movies',   icon: Film,     onClick: () => onNavigate('movies') },
    { id: 'tv',     label: 'TV',       icon: Tv,       onClick: () => onNavigate('tv')     },
    { id: 'anime',  label: 'Anime',    icon: Sparkles, onClick: () => onNavigate('anime')  },
    { id: 'sports', label: 'Sports',   icon: Trophy,   onClick: () => onNavigate('sports') },
    { id: 'stash',  label: 'My Stash', icon: Bookmark, onClick: () => onNavigate('stash')  }
  ];

  return (
    <>
      <header className={`sticky top-0 z-[90] w-full transition-all duration-300 bg-[#080d0a]/95 backdrop-blur-xl border-b border-emerald-500/40 shadow-[0_4px_20px_rgba(0,0,0,0.8),0_1px_0_rgba(16,185,129,0.2)] ${searchOpen ? 'hidden md:block' : ''}`}>
      {/* Announcement Bar */}
      {settings?.announcementActive && settings.announcementText && (
        <div className="bg-gradient-to-r from-emerald-900/90 via-emerald-700/80 to-green-900/90 border-b border-emerald-500/30 px-4 py-1.5 text-center text-xs font-medium text-emerald-100 flex items-center justify-center gap-2 shadow-inner">
          <Flame className="w-3.5 h-3.5 text-emerald-300 animate-pulse" />
          <span>{settings.announcementText}</span>
        </div>
      )}

      {/* Main Glass Header */}
      <div
        className={`px-3 sm:px-8 lg:px-10 py-2 sm:py-2.5 flex items-center justify-between gap-2 sm:gap-4 lg:gap-8 transition-all duration-300 w-full max-w-[1920px] mx-auto ${
          scrolled
            ? 'shadow-[0_10px_30px_rgba(0,0,0,0.9)]'
            : ''
        }`}
      >
        {/* Left: Brand Logo & Desktop Nav Links */}
        <div className="flex items-center gap-2 sm:gap-4 lg:gap-6 shrink-0 min-w-0">
          <button
            onClick={() => onNavigate('home')}
            className="flex items-center gap-1.5 sm:gap-2.5 group text-left focus:outline-none shrink-0"
          >
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-emerald-400 via-emerald-600 to-green-800 p-0.5 shadow-[0_0_20px_rgba(16,185,129,0.4)] group-hover:shadow-[0_0_30px_rgba(16,185,129,0.7)] transition-all duration-300">
              <div className="w-full h-full bg-[#090e0b] rounded-[10px] flex items-center justify-center">
                <Cannabis className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-emerald-400 group-hover:scale-110 transition-transform duration-300" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1 sm:gap-1.5">
                <span className="font-extrabold text-xs sm:text-lg lg:text-xl tracking-wider whitespace-nowrap">
                  <span className="text-white group-hover:text-emerald-400 transition-colors">STONED</span>
                  <span className="text-emerald-400 group-hover:text-white transition-colors">.LIVING</span>
                </span>
              </div>
              <p className="text-[9px] sm:text-[10px] text-emerald-500/80 tracking-widest font-mono uppercase leading-none hidden sm:block">
                High Definition Streaming
              </p>
            </div>
          </button>

          {/* Pro Nav Pill Bar for Desktop */}
          <nav className="hidden lg:flex items-center gap-1.5 bg-[#0c130e]/90 p-1.5 rounded-2xl border border-emerald-500/30 shadow-inner">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 flex items-center gap-2 whitespace-nowrap ${
                    active
                      ? 'bg-gradient-to-r from-emerald-500 to-emerald-400 text-black shadow-[0_0_15px_rgba(16,185,129,0.4)] scale-[1.02]'
                      : 'text-zinc-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${active ? 'text-black' : 'text-emerald-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Center: Search Bar (Expands dynamically on desktop, compact on mobile) */}
        <div className="flex-1 min-w-0 max-w-[110px] xs:max-w-[180px] sm:max-w-md md:max-w-xl lg:max-w-2xl xl:max-w-3xl mx-0.5 sm:mx-4">
          <button
            onClick={onOpenSearch}
            aria-label="Open search"
            className="w-full flex items-center justify-between gap-1.5 bg-[#0f1712]/90 hover:bg-[#142018] border border-emerald-500/30 hover:border-emerald-400/60 text-zinc-300 hover:text-white px-2 sm:px-4 py-1.5 sm:py-2.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm transition-all duration-200 shadow-inner group/search"
          >
            <div className="flex items-center gap-1 sm:gap-2.5 min-w-0">
              <Search className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5 text-emerald-400 shrink-0 group-hover/search:scale-110 transition-transform" />
              <span className="text-[10px] sm:text-sm font-medium text-zinc-400 group-hover/search:text-zinc-200 truncate">
                <span className="sm:hidden">Search...</span>
                <span className="hidden sm:inline">Search movies, TV shows, anime, actors, genres...</span>
              </span>
            </div>
          </button>
        </div>

        {/* Right: Actions & Profile */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* Quick Ambient Lofi Sound Toggle */}
          <button
            type="button"
            onClick={onToggleAmbientSound}
            title={user.settings.ambientSound ? 'Lofi Girl Radio (XVFUtEh9zrY) - On' : 'Lofi Girl Radio (XVFUtEh9zrY) - Off'}
            className={`p-2 rounded-xl border transition-all flex items-center justify-center cursor-pointer ${
              user.settings.ambientSound
                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)] animate-pulse'
                : 'bg-[#121915] border-emerald-900/60 text-zinc-400 hover:text-white hover:border-emerald-500/40'
            }`}
          >
            {user.settings.ambientSound ? (
              <Volume2 className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-emerald-400" />
            ) : (
              <VolumeX className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            )}
          </button>

          {!isLoggedIn ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onGoogleSignIn?.();
              }}
              className="flex items-center gap-1 sm:gap-2 bg-gradient-to-r from-emerald-900/80 to-emerald-950/80 hover:from-emerald-800 hover:to-emerald-900 border border-emerald-500/40 text-white px-2 sm:px-3.5 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[10px] xs:text-[11px] sm:text-xs font-bold shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:shadow-[0_0_25px_rgba(16,185,129,0.4)] transition-all shrink-0 whitespace-nowrap cursor-pointer"
            >
              <GoogleIcon />
              <span className="hidden sm:inline">Sign in with Google</span>
              <span className="sm:hidden">Sign In</span>
            </button>
          ) : (
            <div className="relative">
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2 p-1 rounded-xl bg-[#121915] border border-emerald-500/40 hover:border-emerald-400 transition-all ring-1 ring-emerald-500/30"
              >
                <img
                  src={user.avatar}
                  alt={user.username}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg object-cover ring-1 ring-emerald-500/50"
                />
                <span className="hidden md:inline text-xs font-semibold text-white max-w-[100px] truncate">
                  {user.username}
                </span>
              </button>

              {profileDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setProfileDropdownOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-60 bg-[#0f1512] border border-emerald-500/40 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.95)] p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150 ring-1 ring-emerald-500/30">
                    <div className="px-3 py-2 border-b border-emerald-900/50 mb-1 flex items-center justify-between">
                      <div className="min-w-0 pr-2">
                        <p className="text-xs font-bold text-white truncate">{user.username}</p>
                        <p className="text-[10px] text-emerald-400 font-medium truncate">{user.email}</p>
                      </div>
                      <span className="bg-emerald-500/20 text-emerald-300 text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase shrink-0">
                        GOOGLE
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        onNavigate('stash');
                        setProfileDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium text-zinc-300 hover:bg-emerald-500/20 hover:text-emerald-300 flex items-center gap-2.5 transition cursor-pointer"
                    >
                      <Bookmark className="w-4 h-4 text-emerald-400" />
                      My Stash Watchlist
                    </button>

                    <button
                      onClick={() => {
                        onNavigate('stash');
                        setProfileDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium text-zinc-300 hover:bg-emerald-500/20 hover:text-emerald-300 flex items-center gap-2.5 transition cursor-pointer"
                    >
                      <History className="w-4 h-4 text-emerald-400" />
                      Continue Watching
                    </button>

                    <button
                      onClick={() => {
                        onNavigate('admin');
                        setProfileDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-amber-400 hover:bg-amber-500/20 hover:text-amber-300 flex items-center gap-2.5 transition cursor-pointer"
                    >
                      <ShieldAlert className="w-4 h-4 text-amber-400" />
                      Admin Panel
                    </button>

                    <div className="pt-1 mt-1 border-t border-emerald-900/50">
                      <button
                        onClick={() => {
                          onSignOut?.();
                          setProfileDropdownOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium text-rose-400 hover:bg-rose-950/40 flex items-center gap-2.5 transition cursor-pointer"
                      >
                        <LogOut className="w-4 h-4 text-rose-400" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            className="hidden portrait:hidden landscape:hidden p-2 rounded-xl bg-[#121915] border border-emerald-500/30 text-zinc-300 hover:text-white"
          >
            {mobileMenuOpen ? <X className="w-5 h-5 text-emerald-400" /> : <Menu className="w-5 h-5 text-emerald-400" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="relative z-40 md:hidden">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative bg-[#090e0b]/95 backdrop-blur-2xl border-b border-emerald-500/30 px-4 py-4 space-y-2 z-50">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onNavigate(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium ${
                    active
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : 'text-zinc-300 hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-4 h-4 text-emerald-400" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      </header>

      {/* Mobile Bottom Navigation Bar (rendered outside header so position:fixed binds to viewport, not header's backdrop-filter) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-[100] bg-[#0d1813]/95 backdrop-blur-xl border-t border-emerald-500/30 px-1.5 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] flex items-center justify-around shadow-[0_-5px_25px_rgba(0,0,0,0.95)]">
        {mobileBottomNavItems.map((item) => {
          const Icon = item.icon;
          const active = item.isSearch ? !!searchOpen : (currentTab === item.id && !searchOpen);
          return (
            <button
              key={item.id}
              onClick={item.onClick}
              className={`flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-xl transition-all cursor-pointer ${
                active ? 'text-emerald-400 font-bold bg-emerald-500/10 shadow-[0_0_12px_rgba(16,185,129,0.2)]' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${active ? 'text-emerald-400 scale-110' : 'text-zinc-400'}`} />
              <span className="text-[10px] tracking-tight truncate max-w-[65px]">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
