import React, { useState, useRef, useEffect } from 'react';
import { 
  Globe, 
  PlaySquare, 
  FastForward, 
  Volume2, 
  Subtitles, 
  Trash2,
  ChevronRight,
  ChevronDown,
  Check,
  LogIn,
  Cloud,
  ShieldCheck
} from 'lucide-react';
import { UserProfile, UserSettings } from '../types';
import { saveUserProfile, clearWatchHistory } from '../services/storage';
import { toast } from 'sonner';

export interface LanguageOption {
  code: string;
  name: string;
  native: string;
}

export const SITE_LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'es', name: 'Spanish', native: 'Español' },
  { code: 'fr', name: 'French', native: 'Français' },
  { code: 'de', name: 'German', native: 'Deutsch' },
  { code: 'ja', name: 'Japanese', native: '日本語' },
  { code: 'it', name: 'Italian', native: 'Italiano' },
  { code: 'pt', name: 'Portuguese', native: 'Português' },
];

export const SUBTITLE_LANGUAGES: LanguageOption[] = [
  { code: 'off', name: 'Off', native: 'Off' },
  { code: 'en', name: 'English', native: 'English' },
  { code: 'es', name: 'Spanish', native: 'Español' },
  { code: 'fr', name: 'French', native: 'Français' },
  { code: 'de', name: 'German', native: 'Deutsch' },
  { code: 'ja', name: 'Japanese', native: '日本語' },
  { code: 'it', name: 'Italian', native: 'Italiano' },
  { code: 'pt', name: 'Portuguese', native: 'Português' },
];

interface SettingsViewProps {
  user: UserProfile;
  onUpdateUser: (updated: UserProfile) => void;
  isLoggedIn?: boolean;
  onOpenLogin?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  user,
  onUpdateUser,
  isLoggedIn = false,
  onOpenLogin,
}) => {
  const settings = user.settings;
  const [isSiteLangOpen, setIsSiteLangOpen] = useState(false);
  const [isSubLangOpen, setIsSubLangOpen] = useState(false);
  const siteLangRef = useRef<HTMLDivElement>(null);
  const subLangRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (siteLangRef.current && !siteLangRef.current.contains(event.target as Node)) {
        setIsSiteLangOpen(false);
      }
      if (subLangRef.current && !subLangRef.current.contains(event.target as Node)) {
        setIsSubLangOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const updateSetting = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    const updatedUser: UserProfile = {
      ...user,
      settings: {
        ...user.settings,
        [key]: value,
      },
    };
    saveUserProfile(updatedUser);
    onUpdateUser(updatedUser);
    toast.success('Setting saved');
  };

  const handleClearProgress = () => {
    if (window.confirm('Are you sure you want to clear all saved watch progress? This cannot be undone.')) {
      const updated = clearWatchHistory();
      onUpdateUser(updated);
      toast.success('Playback history cleared');
    }
  };

  const currentSiteLang = SITE_LANGUAGES.find(
    (l) => l.name.toLowerCase() === (settings.language || 'English').toLowerCase() ||
           l.code.toLowerCase() === (settings.language || 'en').toLowerCase()
  ) || SITE_LANGUAGES[0];

  const currentSubLang = SUBTITLE_LANGUAGES.find(
    (l) => l.name.toLowerCase() === (settings.subtitleLanguage || 'English').toLowerCase() ||
           l.code.toLowerCase() === (settings.subtitleLanguage || 'en').toLowerCase()
  ) || SUBTITLE_LANGUAGES[1];

  return (
    <div className="w-full min-h-screen bg-[#050806] text-white pt-8 pb-24 px-4 sm:px-8 lg:px-12 selection:bg-emerald-500 selection:text-black">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* ── Title & Sync Status Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-900 pb-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Settings
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">
              Customize your watching and playback preferences.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isLoggedIn ? (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                <Cloud className="w-3.5 h-3.5 text-emerald-400" />
                <span>Cloud Synced</span>
              </div>
            ) : (
              <button
                onClick={onOpenLogin}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-emerald-500/40 text-zinc-300 hover:text-emerald-400 text-xs font-semibold transition cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5 text-emerald-400" />
                <span>Sign in to sync</span>
              </button>
            )}
          </div>
        </div>

        {/* ── Unauthenticated Notice Banner (If viewing as guest) ── */}
        {!isLoggedIn && (
          <div className="rounded-2xl bg-gradient-to-r from-[#0a1510] to-[#0c1c14] border border-emerald-500/30 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-[0_0_30px_rgba(0,223,130,0.08)]">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Sign in to sync your settings</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Your preferences are stored locally. Log in to synchronize across all your phones, tablets, and TVs.
                </p>
              </div>
            </div>
            <button
              onClick={onOpenLogin}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-[#00df82] text-black font-black text-xs transition cursor-pointer whitespace-nowrap shrink-0 shadow-[0_0_15px_rgba(0,223,130,0.3)]"
            >
              Sign In / Register
            </button>
          </div>
        )}

        {/* ── 1. General Section ── */}
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-zinc-300">General</h2>
          <p className="text-xs text-zinc-500">Customize your site preferences.</p>

          <div className="rounded-2xl bg-[#0c1410] border border-emerald-500/15 p-4 flex items-center justify-between relative">
            <div className="flex items-center gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400">
                <Globe className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Language</h3>
                <p className="text-xs text-zinc-400">Choose your preferred site language</p>
              </div>
            </div>

            {/* Language Selector Dropdown */}
            <div className="relative" ref={siteLangRef}>
              <button
                onClick={() => {
                  setIsSiteLangOpen(!isSiteLangOpen);
                  setIsSubLangOpen(false);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-emerald-500/40 text-xs font-bold text-white transition cursor-pointer"
                aria-expanded={isSiteLangOpen}
                aria-label="Select site language"
              >
                <span>{currentSiteLang.name}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${isSiteLangOpen ? 'rotate-180' : ''}`} />
              </button>

              {isSiteLangOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-[#080f0b] border border-emerald-500/30 rounded-2xl p-1.5 shadow-[0_10px_40px_rgba(0,0,0,0.95)] z-50 animate-fadeIn">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-900 mb-1">
                    Select Language
                  </div>
                  <div className="max-h-60 overflow-y-auto space-y-0.5 custom-scrollbar">
                    {SITE_LANGUAGES.map((lang) => {
                      const isSelected = currentSiteLang.name === lang.name;
                      return (
                        <button
                          key={lang.code}
                          onClick={() => {
                            updateSetting('language', lang.name);
                            setIsSiteLangOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-500/20 text-emerald-300 font-bold'
                              : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span>{lang.name}</span>
                            {lang.native !== lang.name && (
                              <span className="text-[10px] text-zinc-500">({lang.native})</span>
                            )}
                          </div>
                          {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── 2. Playback Section ── */}
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-zinc-300">Playback</h2>
          <p className="text-xs text-zinc-500">Control how videos behave when you watch.</p>

          <div className="rounded-2xl bg-[#0c1410] border border-emerald-500/15 divide-y divide-zinc-900">
            {/* Autoplay Toggle */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400">
                  <PlaySquare className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Autoplay</h3>
                  <p className="text-xs text-zinc-400">Automatically start playing videos</p>
                </div>
              </div>

              <ToggleSwitch
                checked={settings.autoplay}
                onChange={(val) => updateSetting('autoplay', val)}
              />
            </div>

            {/* Next Episode Toggle */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400">
                  <FastForward className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Next episode</h3>
                  <p className="text-xs text-zinc-400">Automatically play the next episode</p>
                </div>
              </div>

              <ToggleSwitch
                checked={settings.nextEpisode}
                onChange={(val) => updateSetting('nextEpisode', val)}
              />
            </div>

            {/* Default Volume */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400">
                  <Volume2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Default volume</h3>
                  <p className="text-xs text-zinc-400">Volume used when starting a video</p>
                </div>
              </div>

              <button
                onClick={() => {
                  const nextVol = settings.defaultVolume === 100 ? 80 : settings.defaultVolume === 80 ? 50 : 100;
                  updateSetting('defaultVolume', nextVol);
                }}
                className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-bold text-white transition cursor-pointer tabular-nums"
              >
                {settings.defaultVolume || 100}%
              </button>
            </div>
          </div>
        </section>

        {/* ── 3. Subtitles Section ── */}
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-zinc-300">Subtitles</h2>
          <p className="text-xs text-zinc-500">Choose your preferred subtitle settings.</p>

          <div className="rounded-2xl bg-[#0c1410] border border-emerald-500/15 divide-y divide-zinc-900">
            {/* Default Subtitle Language */}
            <div className="p-4 flex items-center justify-between relative">
              <div className="flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400">
                  <Subtitles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Default language</h3>
                  <p className="text-xs text-zinc-400">Preferred subtitle language</p>
                </div>
              </div>

              {/* Subtitle Language Selector Dropdown */}
              <div className="relative" ref={subLangRef}>
                <button
                  onClick={() => {
                    setIsSubLangOpen(!isSubLangOpen);
                    setIsSiteLangOpen(false);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-emerald-500/40 text-xs font-bold text-white transition cursor-pointer"
                  aria-expanded={isSubLangOpen}
                  aria-label="Select default subtitle language"
                >
                  <span>{currentSubLang.name}</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${isSubLangOpen ? 'rotate-180' : ''}`} />
                </button>

                {isSubLangOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-[#080f0b] border border-emerald-500/30 rounded-2xl p-1.5 shadow-[0_10px_40px_rgba(0,0,0,0.95)] z-50 animate-fadeIn">
                    <div className="px-3 py-1.5 text-[10px] font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-900 mb-1">
                      Subtitle Language
                    </div>
                    <div className="max-h-60 overflow-y-auto space-y-0.5 custom-scrollbar">
                      {SUBTITLE_LANGUAGES.map((lang) => {
                        const isSelected = currentSubLang.name === lang.name;
                        return (
                          <button
                            key={lang.code}
                            onClick={() => {
                              updateSetting('subtitleLanguage', lang.name);
                              setIsSubLangOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
                              isSelected
                                ? 'bg-emerald-500/20 text-emerald-300 font-bold'
                                : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span>{lang.name}</span>
                              {lang.native !== lang.name && lang.code !== 'off' && (
                                <span className="text-[10px] text-zinc-500">({lang.native})</span>
                              )}
                            </div>
                            {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Auto Subtitles Toggle */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400">
                  <Subtitles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Auto subtitles</h3>
                  <p className="text-xs text-zinc-400">Automatically enable subtitles when available</p>
                </div>
              </div>

              <ToggleSwitch
                checked={settings.autoSubtitles}
                onChange={(val) => updateSetting('autoSubtitles', val)}
              />
            </div>
          </div>
        </section>

        {/* ── 4. Data Section ── */}
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-zinc-300">Data</h2>
          <p className="text-xs text-zinc-500">Manage your saved viewing data.</p>

          <div 
            onClick={handleClearProgress}
            className="rounded-2xl bg-[#0c1410] border border-red-500/20 hover:border-red-500/40 p-4 flex items-center justify-between transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-red-950/40 border border-red-500/30 flex items-center justify-center text-red-400 group-hover:scale-105 transition-transform">
                <Trash2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-red-300 group-hover:text-red-200">
                  Clear watch progress
                </h3>
                <p className="text-xs text-zinc-400">
                  Remove all saved playback progress
                </p>
              </div>
            </div>

            <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-red-400 transition-colors" />
          </div>
        </section>
      </div>
    </div>
  );
};

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ checked, onChange }) => {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
        checked ? 'bg-emerald-500' : 'bg-zinc-800'
      }`}
    >
      <div
        className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform absolute top-0.5 ${
          checked ? 'left-6.5' : 'left-0.5'
        }`}
      />
    </button>
  );
};
