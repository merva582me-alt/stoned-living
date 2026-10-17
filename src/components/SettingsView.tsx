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
  ShieldCheck,
  User as UserIcon,
  Camera,
  Sparkles,
  Link as LinkIcon,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  Cannabis,
  X
} from 'lucide-react';
import { UserProfile, UserSettings } from '../types';
import { saveUserProfile, clearWatchHistory, DEFAULT_USER } from '../services/storage';
import { saveProfileToFirestore } from '../services/firebase';
import { useTranslation, SupportedLanguage } from '../services/i18n';
import { toast } from 'sonner';

export interface AvatarPreset {
  id: string;
  name: string;
  type: 'indica' | 'sativa' | 'hybrid';
  url: string;
}

export const CURATED_AVATARS: AvatarPreset[] = [
  {
    id: 'og-kush',
    name: 'OG Kush',
    type: 'hybrid',
    url: 'https://images.unsplash.com/photo-1568644396922-5c3bfae12521?w=300&h=300&fit=crop&q=80',
  },
  {
    id: 'granddaddy-purple',
    name: 'Granddaddy Purple',
    type: 'indica',
    url: 'https://images.unsplash.com/photo-1536939459926-301728717817?w=300&h=300&fit=crop&q=80',
  },
  {
    id: 'sour-diesel',
    name: 'Sour Diesel',
    type: 'sativa',
    url: 'https://images.unsplash.com/photo-1603909223429-69bb7101f420?w=300&h=300&fit=crop&q=80',
  },
  {
    id: 'blue-dream',
    name: 'Blue Dream',
    type: 'hybrid',
    url: 'https://images.unsplash.com/photo-1589254065878-42c9da997008?w=300&h=300&fit=crop&q=80',
  },
  {
    id: 'runtz',
    name: 'Runtz',
    type: 'hybrid',
    url: 'https://images.unsplash.com/photo-1605732562742-3023a888e56e?w=300&h=300&fit=crop&q=80',
  },
  {
    id: 'purple-punch',
    name: 'Purple Punch',
    type: 'indica',
    url: 'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?w=300&h=300&fit=crop&q=80',
  },
  {
    id: 'super-lemon-haze',
    name: 'Super Lemon Haze',
    type: 'sativa',
    url: 'https://images.unsplash.com/photo-1556928045-16f7f50be0f3?w=300&h=300&fit=crop&q=80',
  },
  {
    id: 'gelato-33',
    name: 'Gelato #33',
    type: 'hybrid',
    url: 'https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?w=300&h=300&fit=crop&q=80',
  },
];

export const STRAIN_TYPE_STYLES: Record<'indica' | 'sativa' | 'hybrid', { badge: string; dot: string; label: string }> = {
  indica: {
    badge: 'bg-purple-950/80 text-purple-300 border-purple-500/40 shadow-[0_0_8px_rgba(168,85,247,0.2)]',
    dot: 'bg-purple-400 shadow-[0_0_6px_rgba(168,85,247,0.8)]',
    label: 'Indica',
  },
  sativa: {
    badge: 'bg-amber-950/80 text-amber-300 border-amber-500/40 shadow-[0_0_8px_rgba(245,158,11,0.2)]',
    dot: 'bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.8)]',
    label: 'Sativa',
  },
  hybrid: {
    badge: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.2)]',
    dot: 'bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.8)]',
    label: 'Hybrid',
  },
};

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
  const { t } = useTranslation(settings.language);

  const [isSiteLangOpen, setIsSiteLangOpen] = useState(false);
  const [isSubLangOpen, setIsSubLangOpen] = useState(false);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [isClearingProgress, setIsClearingProgress] = useState(false);

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

  // Profile picture customization state
  const [customAvatarUrl, setCustomAvatarUrl] = useState('');
  const [customUrlError, setCustomUrlError] = useState(false);
  const [isApplyingAvatar, setIsApplyingAvatar] = useState(false);

  const handleSelectAvatarPreset = async (presetUrl: string) => {
    if (user.avatar === presetUrl) return;
    setIsApplyingAvatar(true);
    const updatedUser: UserProfile = {
      ...user,
      avatar: presetUrl,
    };
    saveUserProfile(updatedUser);
    onUpdateUser(updatedUser);
    if (isLoggedIn) {
      await saveProfileToFirestore(updatedUser, true);
    }
    setIsApplyingAvatar(false);
    toast.success('Profile picture updated!');
  };

  const handleApplyCustomAvatar = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = customAvatarUrl.trim();
    if (!trimmed) {
      toast.error('Please enter an image URL');
      return;
    }
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('data:image/')) {
      toast.error('Please enter a valid image URL starting with https://');
      return;
    }

    setIsApplyingAvatar(true);
    const updatedUser: UserProfile = {
      ...user,
      avatar: trimmed,
    };
    saveUserProfile(updatedUser);
    onUpdateUser(updatedUser);
    if (isLoggedIn) {
      await saveProfileToFirestore(updatedUser, true);
    }
    setCustomAvatarUrl('');
    setCustomUrlError(false);
    setIsApplyingAvatar(false);
    toast.success('Custom profile picture saved!');
  };

  const handleResetAvatar = async () => {
    setIsApplyingAvatar(true);
    const updatedUser: UserProfile = {
      ...user,
      avatar: DEFAULT_USER.avatar,
    };
    saveUserProfile(updatedUser);
    onUpdateUser(updatedUser);
    if (isLoggedIn) {
      await saveProfileToFirestore(updatedUser, true);
    }
    setCustomAvatarUrl('');
    setCustomUrlError(false);
    setIsApplyingAvatar(false);
    toast.success('Reset to default profile picture');
  };

  const updateSetting = async <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    const updatedUser: UserProfile = {
      ...user,
      settings: {
        ...user.settings,
        [key]: value,
      },
    };
    saveUserProfile(updatedUser);
    onUpdateUser(updatedUser);
    if (isLoggedIn) {
      await saveProfileToFirestore(updatedUser, true);
    }
    toast.success(t('action.saved'));
  };

  const handleClearProgress = () => {
    setShowClearConfirmModal(true);
  };

  const executeClearProgress = async () => {
    setIsClearingProgress(true);
    try {
      const updated = clearWatchHistory();
      onUpdateUser(updated);
      if (isLoggedIn) {
        await saveProfileToFirestore(updated, true);
      }
      setShowClearConfirmModal(false);
      toast.success(t('action.saved'));
    } finally {
      setIsClearingProgress(false);
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
              Customize your profile picture, watching, and playback preferences.
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
                  Your preferences and avatar are stored locally. Log in to synchronize across all your phones, tablets, and TVs.
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

        {/* ── 0. Account & Profile Picture Section ── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-zinc-300 flex items-center gap-2">
                <Camera className="w-4 h-4 text-emerald-400" />
                <span>Profile Picture & Identity</span>
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Set an avatar for your account. It syncs across all your logged-in devices.
              </p>
            </div>
            {user.avatar !== DEFAULT_USER.avatar && (
              <button
                type="button"
                onClick={handleResetAvatar}
                disabled={isApplyingAvatar}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 text-[11px] text-zinc-400 hover:text-white transition cursor-pointer"
                title="Reset avatar to default"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Reset Default</span>
              </button>
            )}
          </div>

          <div className="rounded-3xl bg-[#0c1410] border border-emerald-500/20 p-5 sm:p-6 space-y-6 shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
            {/* Current Active Avatar Banner */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 pb-5 border-b border-zinc-900/80">
              <div className="relative group shrink-0">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border-2 border-emerald-500 shadow-[0_0_20px_rgba(0,223,130,0.25)] bg-[#050806] flex items-center justify-center">
                  <img
                    src={user.avatar || DEFAULT_USER.avatar}
                    alt={user.username || 'User Avatar'}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                    onError={(e) => {
                      // Fallback if image fails to load
                      (e.currentTarget as HTMLImageElement).src = DEFAULT_USER.avatar;
                    }}
                  />
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-[#0c1410] flex items-center justify-center text-black shadow-md">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              </div>

              <div className="flex-1 text-center sm:text-left space-y-1.5">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <h3 className="text-base sm:text-lg font-black text-white">
                    {user.username || 'VIP Cinephile'}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-mono font-bold uppercase tracking-wider">
                    {user.role || 'VIP'}
                  </span>
                  {(() => {
                    const activePreset = CURATED_AVATARS.find((p) => p.url === user.avatar);
                    if (!activePreset) return null;
                    return (
                      <span
                        className={`inline-flex items-center gap-1.5 text-[10px] font-mono font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full border ${
                          STRAIN_TYPE_STYLES[activePreset.type].badge
                        }`}
                      >
                        <Cannabis className="w-3 h-3" />
                        <span>{activePreset.name}</span>
                        <span className="opacity-50">•</span>
                        <span>{STRAIN_TYPE_STYLES[activePreset.type].label}</span>
                      </span>
                    );
                  })()}
                </div>
                <p className="text-xs text-zinc-400 font-mono">
                  {user.email || 'viewer@stoned.living'}
                </p>
                <p className="text-[11px] text-zinc-500 pt-1">
                  Click any curated cannabis strain preset below or paste a custom image link to personalize your profile.
                </p>
              </div>
            </div>

            {/* Curated Presets Grid */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                  <Cannabis className="w-4 h-4 text-emerald-400" />
                  <span>Curated Cannabis Strain Presets</span>
                </span>
                <span className="text-[10px] text-zinc-500">Tap to apply instantly</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {CURATED_AVATARS.map((preset) => {
                  const isSelected = user.avatar === preset.url;
                  const typeStyle = STRAIN_TYPE_STYLES[preset.type];
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectAvatarPreset(preset.url)}
                      disabled={isApplyingAvatar}
                      className={`group relative p-2.5 rounded-2xl border transition-all text-left flex items-center gap-3 cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-500/15 border-emerald-500 shadow-[0_0_15px_rgba(0,223,130,0.2)] ring-1 ring-emerald-500/50'
                          : 'bg-zinc-900/60 border-zinc-800/80 hover:bg-zinc-800/60 hover:border-emerald-500/40'
                      }`}
                    >
                      <div className="w-12 h-12 rounded-xl overflow-hidden border border-zinc-700/60 shrink-0 relative bg-black">
                        <img
                          src={preset.url}
                          alt={preset.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200"
                          loading="lazy"
                        />
                        {isSelected && (
                          <div className="absolute inset-0 bg-emerald-500/35 flex items-center justify-center">
                            <Check className="w-4 h-4 text-emerald-300 stroke-[3]" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-white truncate group-hover:text-emerald-300 transition-colors">
                          {preset.name}
                        </div>
                        <div className="mt-1">
                          <span
                            className={`inline-flex items-center gap-1 text-[9px] font-mono font-bold tracking-wider uppercase px-2 py-0.5 rounded-md border ${typeStyle.badge}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${typeStyle.dot}`} />
                            {typeStyle.label}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Image URL Option */}
            <div className="space-y-3 pt-2 border-t border-zinc-900">
              <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                <LinkIcon className="w-3.5 h-3.5 text-emerald-400" />
                <span>Custom Image URL</span>
              </span>
              <p className="text-[11px] text-zinc-400">
                Paste any direct image URL (.png, .jpg, .webp, or Discord/Imgur avatar) to use as your picture.
              </p>

              <form onSubmit={handleApplyCustomAvatar} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <div className="relative flex-1">
                  <LinkIcon className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="url"
                    placeholder="https://images.unsplash.com/... or direct image URL"
                    value={customAvatarUrl}
                    onChange={(e) => {
                      setCustomAvatarUrl(e.target.value);
                      setCustomUrlError(false);
                    }}
                    className="w-full bg-[#060c08] border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-600 outline-none focus:border-emerald-400 transition"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!customAvatarUrl.trim() || isApplyingAvatar}
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-[#00df82] disabled:opacity-40 text-black font-black text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shrink-0 shadow-[0_0_15px_rgba(0,223,130,0.25)]"
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Apply Picture</span>
                </button>
              </form>

              {/* Live Preview if user typed a custom URL */}
              {customAvatarUrl.trim() && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 mt-2">
                  <div className="w-10 h-10 rounded-lg overflow-hidden border border-emerald-500/50 bg-black shrink-0 flex items-center justify-center">
                    <img
                      src={customAvatarUrl}
                      alt="Custom Preview"
                      className="w-full h-full object-cover"
                      onError={() => setCustomUrlError(true)}
                      onLoad={() => setCustomUrlError(false)}
                    />
                  </div>
                  <div className="text-[11px] min-w-0 flex-1">
                    {customUrlError ? (
                      <span className="text-red-400 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span>Unable to load image from this URL. Please verify the link.</span>
                      </span>
                    ) : (
                      <span className="text-emerald-400 flex items-center gap-1 font-medium">
                        <Check className="w-3 h-3 shrink-0" />
                        <span>Image loaded successfully! Click Apply Picture to save.</span>
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

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
          <h2 className="text-sm font-bold text-zinc-300">{t('settings.danger_zone')}</h2>
          <p className="text-xs text-zinc-500">{t('settings.clear_progress_desc')}</p>

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
                  {t('settings.clear_progress')}
                </h3>
                <p className="text-xs text-zinc-400">
                  {t('settings.clear_progress_desc')}
                </p>
              </div>
            </div>

            <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-red-400 transition-colors" />
          </div>
        </section>
      </div>

      {/* ── Custom Emerald Confirmation Modal for Clear Watch Progress ── */}
      {showClearConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-md bg-[#0a120e] border border-emerald-500/40 rounded-3xl p-6 sm:p-7 shadow-[0_0_50px_rgba(16,185,129,0.25)] space-y-5">
            {/* Ambient glow */}
            <div className="absolute -top-16 -left-16 w-40 h-40 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-16 -right-16 w-40 h-40 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Header with Icon and Close */}
            <div className="flex items-start justify-between gap-4 relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-red-950/50 border border-red-500/40 flex items-center justify-center text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <button
                type="button"
                onClick={() => setShowClearConfirmModal(false)}
                className="w-8 h-8 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="space-y-2 relative z-10">
              <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
                {t('settings.clear_confirm_title')}
              </h3>
              <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                {t('settings.clear_confirm_desc')}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 relative z-10">
              <button
                type="button"
                onClick={() => setShowClearConfirmModal(false)}
                disabled={isClearingProgress}
                className="w-full sm:w-1/2 py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-bold text-zinc-300 hover:text-white transition cursor-pointer"
              >
                {t('settings.keep_progress')}
              </button>

              <button
                type="button"
                onClick={executeClearProgress}
                disabled={isClearingProgress}
                className="w-full sm:w-1/2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-xs transition cursor-pointer shadow-[0_0_20px_rgba(225,29,72,0.4)] flex items-center justify-center gap-2"
              >
                {isClearingProgress ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <Trash2 className="w-4 h-4 text-white" />
                )}
                <span>{t('settings.confirm_clear_btn')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
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
