import React, { useState, useRef, useEffect } from 'react';
import { 
  Home, 
  Search, 
  Film, 
  Tv, 
  BookOpen, 
  Settings, 
  Cannabis,
  Trophy,
  LogIn,
  LogOut,
  User as UserIcon,
  CheckCircle2,
  ChevronRight
} from 'lucide-react';
import { UserProfile } from '../types';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  accentColor?: string;
  user: UserProfile;
  isLoggedIn: boolean;
  onOpenLogin: () => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  user,
  isLoggedIn,
  onOpenLogin,
  onLogout,
}) => {
  const [isDesktopExpanded, setIsDesktopExpanded] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close user dropdown menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    if (isUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isUserMenuOpen]);

  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'search', label: 'Search', icon: Search },
    { id: 'movies', label: 'Movies', icon: Film },
    { id: 'tv', label: 'Series', icon: Tv },
    { id: 'sports', label: 'Sports', icon: Trophy },
    { id: 'library', label: 'Library', icon: BookOpen },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleAccountAction = () => {
    if (!isLoggedIn) {
      onOpenLogin();
    } else {
      setIsUserMenuOpen(!isUserMenuOpen);
    }
  };

  const displayName = user.username || (isLoggedIn ? 'VIP Member' : 'Guest');
  const userInitial = (displayName[0] || 'U').toUpperCase();

  return (
    <>
      {/* ─────────────────────────────────────────────────────────────
          1. FLOATING USER PROFILE / SIGN OUT DROPDOWN MENU
      ─────────────────────────────────────────────────────────────── */}
      {isUserMenuOpen && isLoggedIn && (
        <div
          ref={userMenuRef}
          className="fixed left-16 sm:left-20 lg:left-64 bottom-6 z-[60] w-64 bg-[#0a100c]/95 backdrop-blur-2xl border border-emerald-500/30 rounded-2xl p-3 shadow-[0_10px_40px_rgba(0,0,0,0.9),0_0_20px_rgba(0,223,130,0.15)] text-white animate-fadeIn select-none"
        >
          {/* Header info */}
          <div className="flex items-center gap-3 p-2 bg-[#060c08] rounded-xl border border-zinc-800/80 mb-2">
            <div className="relative w-10 h-10 rounded-full overflow-hidden bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center font-bold text-sm text-emerald-300 shrink-0">
              {user.avatar ? (
                <img src={user.avatar} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                userInitial
              )}
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-black" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-xs text-white truncate">{displayName}</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              </div>
              <p className="text-[10px] text-zinc-400 font-mono truncate">{user.email || 'Cloud Synced'}</p>
            </div>
          </div>

          {/* Quick Shortcuts */}
          <div className="space-y-1 mb-2">
            <button
              onClick={() => {
                onSelectTab('library');
                setIsUserMenuOpen(false);
              }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-zinc-300 hover:text-white hover:bg-zinc-800/60 transition cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <BookOpen className="w-4 h-4 text-emerald-400" />
                <span>My Library & Lists</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
            </button>

            <button
              onClick={() => {
                onSelectTab('settings');
                setIsUserMenuOpen(false);
              }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-zinc-300 hover:text-white hover:bg-zinc-800/60 transition cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Settings className="w-4 h-4 text-zinc-400" />
                <span>Account & Preferences</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
            </button>
          </div>

          <div className="border-t border-zinc-800/80 my-1.5" />

          {/* Sign Out Button */}
          <button
            onClick={() => {
              setIsUserMenuOpen(false);
              onLogout();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 transition cursor-pointer font-bold"
          >
            <LogOut className="w-4 h-4 text-red-400" />
            <span>Sign Out</span>
          </button>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          2. MOBILE BOTTOM NAVIGATION BAR (< 768px)
      ─────────────────────────────────────────────────────────────── */}
      <nav 
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 h-16 bg-[#060a08]/95 backdrop-blur-2xl border-t border-emerald-500/15 px-2 flex items-center justify-around select-none shadow-[0_-4px_30px_rgba(0,0,0,0.9)] pb-safe"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                onSelectTab(item.id);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all cursor-pointer relative ${
                isActive
                  ? 'text-emerald-400 font-bold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {/* Active top dot highlight */}
              {isActive && (
                <div className="absolute -top-2 w-5 h-1 bg-emerald-400 rounded-full shadow-[0_0_8px_#00FF9D]" />
              )}
              <Icon 
                className={`w-5 h-5 transition-transform ${
                  isActive ? 'scale-110 stroke-[2.5]' : 'stroke-[1.8]'
                }`} 
              />
              <span className="text-[10px] mt-1 font-medium tracking-tight">
                {item.label}
              </span>
            </button>
          );
        })}

        {/* Mobile Login / User Profile CTA */}
        <button
          onClick={handleAccountAction}
          className="flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all cursor-pointer text-zinc-400 hover:text-emerald-400"
          title={isLoggedIn ? displayName : 'Sign In'}
        >
          {isLoggedIn ? (
            <div className="relative w-6 h-6 rounded-full overflow-hidden bg-emerald-950/80 border border-emerald-400 flex items-center justify-center text-[10px] font-bold text-emerald-300">
              {user.avatar ? (
                <img src={user.avatar} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                userInitial
              )}
            </div>
          ) : (
            <LogIn className="w-5 h-5 text-emerald-400 stroke-[2]" />
          )}
          <span className="text-[10px] mt-1 font-medium tracking-tight text-emerald-400">
            {isLoggedIn ? 'Account' : 'Login'}
          </span>
        </button>
      </nav>

      {/* ─────────────────────────────────────────────────────────────
          3. TABLET SLIM LEFT DOCK (768px – 1023px)
      ─────────────────────────────────────────────────────────────── */}
      <aside 
        aria-label="Tablet Navigation"
        className="hidden md:flex lg:hidden fixed top-0 left-0 bottom-0 z-50 w-16 flex-col justify-between py-5 items-center bg-[#060a08]/95 backdrop-blur-2xl border-r border-emerald-500/15 select-none shadow-[4px_0_30px_rgba(0,0,0,0.85)]"
      >
        {/* Top: Logo */}
        <button
          onClick={() => {
            onSelectTab('home');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="cursor-pointer group"
          title="STONED.LIVING - High Definition Streaming"
        >
          <div className="w-10 h-10 rounded-xl bg-[#060c08] border-2 border-[#00df82] flex items-center justify-center shadow-[0_0_14px_rgba(0,223,130,0.35)] group-hover:scale-105 group-hover:shadow-[0_0_20px_rgba(0,223,130,0.55)] transition-all">
            <Cannabis className="w-5 h-5 text-[#00df82] group-hover:rotate-12 transition-transform duration-300" />
          </div>
        </button>

        {/* Middle: Nav Icons */}
        <nav className="flex flex-col gap-3 my-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                title={item.label}
                className={`relative p-3 rounded-xl transition-all cursor-pointer ${
                  isActive
                    ? 'bg-emerald-500/20 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-900/60'
                }`}
              >
                {isActive && (
                  <div className="absolute left-0 top-2 bottom-2 w-1 bg-emerald-400 rounded-r-full shadow-[0_0_8px_#00df82]" />
                )}
                <Icon className="w-5 h-5" />
              </button>
            );
          })}
        </nav>

        {/* Bottom: Login Button / User Avatar */}
        <button
          onClick={handleAccountAction}
          title={isLoggedIn ? `${displayName} (Click for menu)` : 'Sign In with Firebase'}
          className="p-2.5 rounded-xl transition cursor-pointer relative group flex items-center justify-center"
        >
          {isLoggedIn ? (
            <div className="relative w-8 h-8 rounded-full overflow-hidden bg-emerald-950 border border-emerald-400/80 flex items-center justify-center text-xs font-bold text-emerald-300 group-hover:ring-2 group-hover:ring-emerald-400 transition">
              {user.avatar ? (
                <img src={user.avatar} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                userInitial
              )}
              <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-400 border border-black" />
            </div>
          ) : (
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 hover:text-white transition shadow-[0_0_12px_rgba(0,223,130,0.2)]">
              <LogIn className="w-5 h-5" />
            </div>
          )}
        </button>
      </aside>

      {/* ─────────────────────────────────────────────────────────────
          4. DESKTOP HOVER-EXPAND RAIL (≥ 1024px)
      ─────────────────────────────────────────────────────────────── */}
      <aside
        aria-label="Desktop Navigation"
        onMouseEnter={() => setIsDesktopExpanded(true)}
        onMouseLeave={() => setIsDesktopExpanded(false)}
        className={`hidden lg:flex fixed top-0 left-0 bottom-0 z-50 flex-col justify-between py-6 bg-[#060a08]/95 backdrop-blur-2xl border-r border-zinc-800/80 transition-all duration-300 ease-out select-none shadow-[4px_0_30px_rgba(0,0,0,0.85)] ${
          isDesktopExpanded ? 'w-60 px-4' : 'w-[72px] px-3'
        }`}
      >
        {/* Top: Brand Monogram Icon */}
        <div className="flex flex-col items-center">
          <button
            onClick={() => {
              onSelectTab('home');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex items-center gap-3 group cursor-pointer"
            title="STONED.LIVING - High Definition Streaming"
          >
            {/* Green Cannabis Badged Monogram */}
            <div className="w-10 h-10 rounded-xl bg-[#060c08] border-2 border-[#00df82] flex items-center justify-center shadow-[0_0_14px_rgba(0,223,130,0.35)] group-hover:scale-105 group-hover:shadow-[0_0_22px_rgba(0,223,130,0.6)] transition-all shrink-0">
              <Cannabis className="w-5 h-5 text-[#00df82] group-hover:rotate-12 transition-transform duration-300" />
            </div>
            {isDesktopExpanded && (
              <div className="overflow-hidden whitespace-nowrap animate-fadeIn text-left select-none">
                <span className="block font-black text-base tracking-tight leading-tight transition-colors duration-200">
                  <span className="text-white group-hover:text-[#00df82] transition-colors duration-200">STONED</span>
                  <span className="text-[#00df82] group-hover:text-white transition-colors duration-200">.</span>
                  <span className="text-[#00df82] group-hover:text-white transition-colors duration-200">LIVING</span>
                </span>
                <span className="block text-[8px] font-mono tracking-[0.16em] text-[#00df82] uppercase mt-0.5 font-semibold">
                  HIGH DEFINITION STREAMING
                </span>
              </div>
            )}
          </button>
        </div>

        {/* Middle: Navigation Items */}
        <nav className="flex flex-col gap-2 my-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                title={item.label}
                className={`group relative flex items-center gap-4 py-3 px-3 rounded-xl transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-emerald-500/15 text-white font-bold'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-900/60 font-medium'
                }`}
              >
                {/* Active Left Indicator Bar */}
                {isActive && (
                  <div className="absolute left-0 top-2 bottom-2 w-1 bg-emerald-400 rounded-r-full shadow-[0_0_10px_#00FF9D]" />
                )}

                <div className="flex items-center justify-center w-6 shrink-0">
                  <Icon
                    className={`w-5 h-5 transition-transform duration-200 group-hover:scale-110 ${
                      isActive ? 'text-emerald-400' : 'text-zinc-400 group-hover:text-white'
                    }`}
                  />
                </div>

                {isDesktopExpanded && (
                  <span className="text-sm whitespace-nowrap transition-opacity animate-fadeIn">
                    {item.label}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom: Login Button / User Avatar */}
        <div className="flex flex-col items-center">
          <button
            onClick={handleAccountAction}
            title={isLoggedIn ? `${displayName} (Click for menu)` : 'Sign In with Firebase'}
            className={`w-full flex items-center gap-3.5 py-2.5 px-2.5 rounded-xl transition-all cursor-pointer group ${
              isLoggedIn
                ? 'hover:bg-zinc-900/70 border border-transparent hover:border-emerald-500/20'
                : 'bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:text-white shadow-[0_0_15px_rgba(0,223,130,0.15)]'
            }`}
          >
            {isLoggedIn ? (
              <div className="relative w-8 h-8 rounded-full overflow-hidden bg-emerald-950 border border-emerald-400/80 flex items-center justify-center text-xs font-bold text-emerald-300 shrink-0">
                {user.avatar ? (
                  <img src={user.avatar} alt={displayName} className="w-full h-full object-cover" />
                ) : (
                  userInitial
                )}
                <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-400 border border-black" />
              </div>
            ) : (
              <div className="flex items-center justify-center w-8 shrink-0">
                <LogIn className="w-5 h-5 group-hover:scale-110 transition-transform text-emerald-400" />
              </div>
            )}

            {isDesktopExpanded && (
              <div className="min-w-0 flex-1 text-left overflow-hidden whitespace-nowrap animate-fadeIn">
                {isLoggedIn ? (
                  <>
                    <p className="text-xs font-bold text-white truncate">{displayName}</p>
                    <p className="text-[10px] text-emerald-400 font-mono truncate">Cloud Synced</p>
                  </>
                ) : (
                  <span className="text-xs font-bold text-emerald-300 group-hover:text-white transition-colors">
                    Sign In
                  </span>
                )}
              </div>
            )}
          </button>
        </div>
      </aside>
    </>
  );
};
