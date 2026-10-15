import React, { useState, useEffect, useRef } from 'react';
import { Search, Cannabis, User, Sparkles, Home, Film, Tv, Trophy, Bookmark, Settings, LogOut, Flame } from 'lucide-react';
import { SiteSettings, UserProfile } from '../types';

interface NavbarProps {
  currentTab: string;
  onNavigate: (tab: string, extraData?: any) => void;
  onOpenSearch: () => void;
  searchOpen?: boolean;
  settings: SiteSettings | null;
  user?: UserProfile;
  onOpenProfileSelect?: () => void;
  onLogoutAdmin?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onNavigate,
  onOpenSearch,
  settings,
  user,
  onOpenProfileSelect,
  onLogoutAdmin,
}) => {
  const [scrolled, setScrolled] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navLinks = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'movies', label: 'Movies', icon: Film },
    { id: 'tv', label: 'Shows', icon: Tv },
    { id: 'anime', label: 'Anime', icon: Flame },
    { id: 'sports', label: 'Sports', icon: Trophy },
    { id: 'profile', label: 'My List', icon: Bookmark },
  ];

  return (
    <>
      {/* ── TOP FLOATING DESKTOP ISLANDS (Absolute Cinema Screens 2 & 9) ── */}
      <header className="fixed top-0 left-0 right-0 z-50 pointer-events-none transition-all duration-300">
        {/* Optional Announcement Banner */}
        {settings?.announcementActive && settings.announcementText && (
          <div className="pointer-events-auto bg-emerald-950/90 border-b border-emerald-500/30 px-4 py-1 text-center text-[11px] sm:text-xs font-semibold text-emerald-200 flex items-center justify-center gap-2 backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>{settings.announcementText}</span>
          </div>
        )}

        <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-8 lg:px-12 pt-4 sm:pt-6 flex items-center justify-between">
          {/* Left Floating Logo Island */}
          <div className="pointer-events-auto backdrop-blur-2xl bg-[#090e0b]/80 border border-emerald-500/25 rounded-2xl px-3.5 sm:px-4 py-2 sm:py-2.5 shadow-[0_10px_35px_rgba(0,0,0,0.85)] flex items-center gap-2.5 hover:border-emerald-500/50 transition-all duration-300 group">
            <button
              onClick={() => onNavigate('home')}
              className="flex items-center gap-2.5 cursor-pointer outline-none"
            >
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-[#060c08] border-2 border-[#00df82] flex items-center justify-center shadow-[0_0_12px_rgba(0,223,130,0.35)] group-hover:scale-105 group-hover:shadow-[0_0_18px_rgba(0,223,130,0.55)] transition-all shrink-0">
                <Cannabis className="w-4 h-4 text-[#00df82] group-hover:rotate-12 transition-transform duration-300" />
              </div>
              <div className="flex flex-col text-left select-none">
                <span className="font-black text-sm tracking-tight leading-none transition-colors duration-200">
                  <span className="text-white group-hover:text-[#00df82] transition-colors duration-200">STONED</span>
                  <span className="text-[#00df82] group-hover:text-white transition-colors duration-200">.</span>
                  <span className="text-[#00df82] group-hover:text-white transition-colors duration-200">LIVING</span>
                </span>
                <span className="text-[7px] font-mono tracking-[0.14em] text-[#00df82] uppercase mt-0.5 font-semibold">
                  HIGH DEFINITION STREAMING
                </span>
              </div>
            </button>
          </div>

          {/* Right Floating Glass Pill Navigation Bar (Desktop) */}
          <nav className="hidden md:flex pointer-events-auto backdrop-blur-2xl bg-[#090e0b]/80 border border-emerald-500/25 rounded-2xl px-4 sm:px-5 py-2 shadow-[0_10px_35px_rgba(0,0,0,0.85)] items-center gap-5 lg:gap-6 hover:border-emerald-500/40 transition-all duration-300">
            {navLinks.map((link) => {
              const isActive = currentTab === link.id;
              return (
                <button
                  key={link.id}
                  onClick={() => onNavigate(link.id)}
                  className={`relative text-xs lg:text-sm font-semibold tracking-wide transition-all cursor-pointer py-1 ${
                    isActive
                      ? 'text-emerald-400'
                      : 'text-zinc-300 hover:text-white'
                  }`}
                >
                  {link.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                  )}
                </button>
              );
            })}

            {/* Vertical Separator */}
            <div className="w-[1px] h-4 bg-zinc-800" />

            {/* Search Icon Button */}
            <button
              onClick={onOpenSearch}
              className="p-1.5 rounded-xl text-zinc-300 hover:text-white hover:bg-emerald-950/40 transition cursor-pointer"
              title="Search Movies, Shows & People"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Profile Avatar Button & Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="w-7 h-7 rounded-xl overflow-hidden border border-emerald-500/40 hover:border-emerald-400 hover:scale-105 transition cursor-pointer shadow-sm bg-zinc-900"
              >
                <img
                  src={user?.avatar || 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=200&auto=format&fit=crop&q=80'}
                  alt={user?.username || 'Profile'}
                  className="w-full h-full object-cover"
                />
              </button>

              {profileDropdownOpen && (
                <div className="absolute right-0 mt-3 w-56 rounded-2xl bg-[#090e0b]/95 border border-emerald-500/30 p-2 shadow-2xl backdrop-blur-2xl animate-fadeIn space-y-1">
                  <div className="px-3 py-2 border-b border-zinc-800">
                    <span className="block text-xs font-bold text-white truncate">
                      {user?.username || 'Alex (Admin)'}
                    </span>
                    <span className="block text-[10px] font-mono text-emerald-400 truncate">
                      {user?.email || 'VIP Cinephile'}
                    </span>
                  </div>

                  {onOpenProfileSelect && (
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        onOpenProfileSelect();
                      }}
                      className="w-full px-3 py-2 text-left text-xs font-semibold text-zinc-300 hover:text-white hover:bg-emerald-950/40 rounded-xl transition flex items-center gap-2 cursor-pointer"
                    >
                      <User className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Switch Profile</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      onNavigate('profile');
                    }}
                    className="w-full px-3 py-2 text-left text-xs font-semibold text-zinc-300 hover:text-white hover:bg-emerald-950/40 rounded-xl transition flex items-center gap-2 cursor-pointer"
                  >
                    <Settings className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Settings & My Stash</span>
                  </button>

                  {onLogoutAdmin && (
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        onLogoutAdmin();
                      }}
                      className="w-full px-3 py-2 text-left text-xs font-semibold text-red-300 hover:text-red-200 hover:bg-red-950/30 rounded-xl transition flex items-center gap-2 cursor-pointer border-t border-zinc-800/80"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </nav>

          {/* Right Mobile Quick Search & Avatar */}
          <div className="flex md:hidden pointer-events-auto items-center gap-2 backdrop-blur-2xl bg-[#090e0b]/80 border border-emerald-500/25 rounded-2xl px-3 py-1.5 shadow-[0_10px_35px_rgba(0,0,0,0.85)]">
            <button
              onClick={onOpenSearch}
              className="p-1.5 text-zinc-300 hover:text-white"
            >
              <Search className="w-4 h-4" />
            </button>
            <button
              onClick={onOpenProfileSelect}
              className="w-7 h-7 rounded-xl overflow-hidden border border-emerald-500/40"
            >
              <img
                src={user?.avatar || 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=200&auto=format&fit=crop&q=80'}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            </button>
          </div>
        </div>
      </header>

      {/* ── FLOATING MOBILE BOTTOM DOCK (Screens 9 & 10) ── */}
      <nav className="fixed bottom-4 left-4 right-4 z-50 md:hidden flex items-center justify-around backdrop-blur-2xl bg-[#090e0b]/90 border border-emerald-500/30 rounded-2xl py-2 px-3 shadow-[0_10px_35px_rgba(0,0,0,0.9)]">
        {navLinks.map((link) => {
          const Icon = link.icon;
          const isActive = currentTab === link.id;
          return (
            <button
              key={link.id}
              onClick={() => onNavigate(link.id)}
              className={`flex flex-col items-center gap-0.5 p-1 transition-all ${
                isActive ? 'text-emerald-400 scale-105' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-[10px] font-medium">{link.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
