import React, { useState } from 'react';
import { Plus, Edit2, Check, Lock, Sparkles, X, Shuffle, ArrowLeft, Trash2, KeyRound, Cannabis } from 'lucide-react';
import { UserProfile } from '../types';
import { saveUserProfile } from '../services/storage';
import { toast } from 'sonner';

export interface NetflixProfile {
  id: string;
  name: string;
  avatar: string;
  role?: string;
  isKid?: boolean;
  isLocked?: boolean;
  pin?: string;
  themeColor: string;
}

export const AVATAR_CATALOG = {
  characters: [
    { name: 'Astronaut', url: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=200&auto=format&fit=crop&q=80', category: 'THE CAST' },
    { name: 'Cyberpunk Girl', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80', category: 'THE CAST' },
    { name: 'Pilot', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80', category: 'THE CAST' },
    { name: 'Rebel', url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80', category: 'THE CAST' },
    { name: 'Neon Samurai', url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&auto=format&fit=crop&q=80', category: 'MOVIE NIGHT' },
    { name: 'Director', url: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=200&auto=format&fit=crop&q=80', category: 'MOVIE NIGHT' },
    { name: 'Secret Agent', url: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=200&auto=format&fit=crop&q=80', category: 'MOVIE NIGHT' },
    { name: 'Cinephile', url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&auto=format&fit=crop&q=80', category: 'MOVIE NIGHT' },
  ],
  illustrations: [
    { name: 'Fox', url: 'https://images.unsplash.com/photo-1516934024742-b461fba47600?w=200&auto=format&fit=crop&q=80' },
    { name: 'Monster', url: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=200&auto=format&fit=crop&q=80' },
    { name: 'Panda', url: 'https://images.unsplash.com/photo-1527118732049-c88155f2107c?w=200&auto=format&fit=crop&q=80' },
    { name: 'Lion', url: 'https://images.unsplash.com/photo-1534188753412-3e26d0d618d6?w=200&auto=format&fit=crop&q=80' },
    { name: 'Emerald Leaf', url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80' },
    { name: 'Retro Pop', url: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=200&auto=format&fit=crop&q=80' },
  ],
  emojis: [
    { name: 'Popcorn', url: 'https://images.unsplash.com/photo-1578849278619-e73505e9610f?w=200&auto=format&fit=crop&q=80' },
    { name: 'Clapperboard', url: 'https://images.unsplash.com/photo-1585951237318-9ea5e175b891?w=200&auto=format&fit=crop&q=80' },
    { name: 'Film Reel', url: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=200&auto=format&fit=crop&q=80' },
    { name: 'Cannabis Bud', url: 'https://images.unsplash.com/photo-1568644396922-5c3bfae12521?w=200&auto=format&fit=crop&q=80' },
  ]
};

export const PRESET_PROFILES: NetflixProfile[] = [
  {
    id: 'alex',
    name: 'Alex',
    role: 'Admin',
    avatar: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=200&auto=format&fit=crop&q=80',
    themeColor: '#10b981',
  },
  {
    id: 'sam',
    name: 'Sam',
    avatar: 'https://images.unsplash.com/photo-1516934024742-b461fba47600?w=200&auto=format&fit=crop&q=80',
    themeColor: '#34d399',
  },
  {
    id: 'jordan',
    name: 'Jordan',
    avatar: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=200&auto=format&fit=crop&q=80',
    isLocked: true,
    pin: '1234',
    themeColor: '#059669',
  },
  {
    id: 'panda',
    name: 'Kids',
    avatar: 'https://images.unsplash.com/photo-1527118732049-c88155f2107c?w=200&auto=format&fit=crop&q=80',
    isKid: true,
    themeColor: '#6ee7b7',
  },
];

interface ProfileSelectModalProps {
  isOpen: boolean;
  currentUser: UserProfile;
  onSelectProfile: (profile: NetflixProfile) => void;
  onOpenAuthModal?: () => void;
  onSwitchAccount?: () => void;
  onClose?: () => void;
  allowClose?: boolean;
}

export const ProfileSelectModal: React.FC<ProfileSelectModalProps> = ({
  isOpen,
  currentUser,
  onSelectProfile,
  onOpenAuthModal,
  onSwitchAccount,
  onClose,
  allowClose = false,
}) => {
  const [isManaging, setIsManaging] = useState(false);
  const [viewState, setViewState] = useState<'list' | 'add' | 'pin'>('list');
  const [selectedForPin, setSelectedForPin] = useState<NetflixProfile | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  // Add Profile state (Screen 7)
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileIsKid, setNewProfileIsKid] = useState(false);
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState(AVATAR_CATALOG.characters[0].url);
  const [avatarCategory, setAvatarCategory] = useState<'characters' | 'illustrations' | 'emojis'>('characters');

  const [profiles, setProfiles] = useState<NetflixProfile[]>(() => {
    try {
      const stored = localStorage.getItem('stoned_netflix_profiles_v2');
      if (stored) return JSON.parse(stored);
    } catch {}
    return PRESET_PROFILES;
  });

  const saveProfiles = (list: NetflixProfile[]) => {
    setProfiles(list);
    try {
      localStorage.setItem('stoned_netflix_profiles_v2', JSON.stringify(list));
    } catch {}
  };

  if (!isOpen) return null;

  const handleSelect = (p: NetflixProfile) => {
    if (isManaging) {
      // Delete or edit profile in manage mode
      if (profiles.length <= 1) {
        toast.error('You must keep at least one profile.');
        return;
      }
      if (confirm(`Remove profile "${p.name}"?`)) {
        const next = profiles.filter((x) => x.id !== p.id);
        saveProfiles(next);
        toast.success(`Removed profile ${p.name}`);
      }
      return;
    }

    if (p.isLocked) {
      setSelectedForPin(p);
      setPinInput('');
      setPinError(false);
      setViewState('pin');
      return;
    }

    onSelectProfile(p);
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedForPin) return;
    if (pinInput === (selectedForPin.pin || '1234') || pinInput === '1234') {
      onSelectProfile(selectedForPin);
      setViewState('list');
    } else {
      setPinError(true);
      toast.error('Incorrect PIN (Default is 1234)');
    }
  };

  const handleCreateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProfileName.trim()) {
      toast.error('Please enter a profile name');
      return;
    }
    const newProfile: NetflixProfile = {
      id: `profile_${Date.now()}`,
      name: newProfileName.trim(),
      avatar: selectedAvatarUrl,
      isKid: newProfileIsKid,
      themeColor: '#10b981',
    };
    const updated = [...profiles, newProfile];
    saveProfiles(updated);
    toast.success(`Profile "${newProfile.name}" created!`);
    setNewProfileName('');
    setViewState('list');
    onSelectProfile(newProfile);
  };

  const handleShuffleAvatar = () => {
    const all = [
      ...AVATAR_CATALOG.characters,
      ...AVATAR_CATALOG.illustrations,
      ...AVATAR_CATALOG.emojis,
    ];
    const random = all[Math.floor(Math.random() * all.length)];
    setSelectedAvatarUrl(random.url);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-[#050508] text-white flex flex-col justify-between p-4 sm:p-8 animate-fadeIn overflow-y-auto">
      {/* Background Ambient Glow */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-emerald-600/10 rounded-full blur-[160px]" />
      </div>

      {/* Top Header */}
      <div className="w-full max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#060c08] border-2 border-[#00df82] flex items-center justify-center shadow-[0_0_12px_rgba(0,223,130,0.35)] shrink-0">
            <Cannabis className="w-4 h-4 text-[#00df82]" />
          </div>
          <div className="flex flex-col text-left select-none">
            <span className="font-black text-lg tracking-tight leading-none">
              <span className="text-white">STONED</span>
              <span className="text-[#00df82]">.</span>
              <span className="text-[#00df82]">LIVING</span>
            </span>
            <span className="text-[7.5px] font-mono tracking-widest text-[#00df82] uppercase mt-0.5 font-semibold">
              HIGH DEFINITION STREAMING
            </span>
          </div>
        </div>

        {allowClose && onClose && viewState === 'list' && (
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white text-xs sm:text-sm font-semibold px-4 py-2 rounded-xl bg-zinc-900/60 border border-zinc-800 transition cursor-pointer"
          >
            ✕ Close
          </button>
        )}
      </div>

      {/* ── VIEW 1: Profile Gateway ("Who's watching?") ── */}
      {viewState === 'list' && (
        <div className="w-full max-w-4xl mx-auto my-auto text-center space-y-8 sm:space-y-12 py-10">
          <div>
            <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight drop-shadow-md">
              Who's watching?
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-2">
              Select a profile to continue with personalized recommendations & 4K streaming.
            </p>
          </div>

          {/* Profiles Grid */}
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10">
            {profiles.map((p) => {
              const isCurrent = currentUser.username === p.name;
              return (
                <div
                  key={p.id}
                  onClick={() => handleSelect(p)}
                  className="group flex flex-col items-center gap-3 cursor-pointer transition-transform duration-200"
                >
                  <div className="relative w-24 h-24 sm:w-36 sm:h-36 rounded-2xl overflow-hidden border-2 border-transparent group-hover:border-emerald-400 group-hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] group-hover:scale-105 transition-all duration-200 bg-zinc-900">
                    <img
                      src={p.avatar}
                      alt={p.name}
                      className="w-full h-full object-cover"
                    />
                    {p.isLocked && !isManaging && (
                      <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-md p-1.5 rounded-lg border border-zinc-700/80">
                        <Lock className="w-3.5 h-3.5 text-emerald-400" />
                      </div>
                    )}
                    {isManaging && (
                      <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-1">
                        <Trash2 className="w-6 h-6 text-red-400" />
                        <span className="text-[10px] font-semibold text-red-300">Delete</span>
                      </div>
                    )}
                    {isCurrent && !isManaging && (
                      <div className="absolute bottom-2 right-2 bg-emerald-500 rounded-full p-1 shadow-md">
                        <Check className="w-3.5 h-3.5 text-black stroke-[3]" />
                      </div>
                    )}
                  </div>

                  <div className="text-center">
                    <span className="block text-sm sm:text-base font-semibold text-zinc-300 group-hover:text-white transition-colors">
                      {p.name}
                    </span>
                    {p.role && (
                      <span className="text-[10px] text-emerald-400 font-mono tracking-wider">
                        {p.role}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* + Add Profile Tile (Screen 7 trigger) */}
            <div
              onClick={() => {
                setViewState('add');
                setNewProfileName('');
                setNewProfileIsKid(false);
              }}
              className="group flex flex-col items-center gap-3 cursor-pointer"
            >
              <div className="w-24 h-24 sm:w-36 sm:h-36 rounded-2xl border-2 border-dashed border-zinc-700 hover:border-emerald-400 flex items-center justify-center bg-zinc-900/30 group-hover:scale-105 group-hover:bg-emerald-950/20 transition-all">
                <Plus className="w-10 h-10 text-zinc-400 group-hover:text-emerald-400 transition-colors" />
              </div>
              <span className="text-sm sm:text-base font-semibold text-zinc-400 group-hover:text-white transition-colors">
                Add profile
              </span>
            </div>
          </div>

          {/* Action Controls */}
          <div className="pt-6 flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={() => setIsManaging(!isManaging)}
              className="px-6 py-2.5 rounded-xl border border-zinc-700 hover:border-emerald-400 text-zinc-300 hover:text-white text-xs sm:text-sm font-semibold tracking-wider transition cursor-pointer bg-zinc-900/40"
            >
              {isManaging ? 'Done' : 'Manage Profiles'}
            </button>

            {onSwitchAccount && (
              <button
                onClick={onSwitchAccount}
                className="px-6 py-2.5 rounded-xl border border-emerald-500/30 hover:border-emerald-400 bg-emerald-950/30 hover:bg-emerald-900/50 text-emerald-300 text-xs sm:text-sm font-semibold tracking-wide transition cursor-pointer"
              >
                Sign in with a name instead
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── VIEW 2: Add a Profile (Screen 7) ── */}
      {viewState === 'add' && (
        <div className="w-full max-w-2xl mx-auto my-auto py-8">
          <div className="rounded-3xl bg-[#090e0b]/90 border border-emerald-500/25 p-6 sm:p-10 backdrop-blur-2xl shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setViewState('list')}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h2 className="text-xl sm:text-2xl font-black text-white">Add a profile</h2>
              </div>
              <button
                type="button"
                onClick={handleShuffleAvatar}
                className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-950/40 px-3 py-1.5 rounded-lg border border-emerald-500/30"
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span>Shuffle Avatar</span>
              </button>
            </div>

            <form onSubmit={handleCreateProfile} className="space-y-6">
              {/* Profile Name & Avatar Preview */}
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border-2 border-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.4)] shrink-0">
                  <img src={selectedAvatarUrl} alt="Preview" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 space-y-3">
                  <input
                    type="text"
                    required
                    placeholder="Profile Name"
                    value={newProfileName}
                    onChange={(e) => setNewProfileName(e.target.value)}
                    className="w-full bg-[#121a15] border border-zinc-700 focus:border-emerald-500 text-white rounded-xl px-4 py-3 text-sm placeholder-zinc-500 outline-none"
                    autoFocus
                  />
                  <label className="flex items-center gap-2.5 text-xs text-zinc-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={newProfileIsKid}
                      onChange={(e) => setNewProfileIsKid(e.target.checked)}
                      className="w-4 h-4 rounded bg-zinc-900 border-zinc-700 text-emerald-500"
                    />
                    <span>Kid profile (Filtered age-appropriate content)</span>
                  </label>
                </div>
              </div>

              {/* Avatar Category Tabs */}
              <div>
                <span className="block text-xs font-semibold text-zinc-400 mb-2">
                  Choose an avatar:
                </span>
                <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
                  {(['characters', 'illustrations', 'emojis'] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setAvatarCategory(cat)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition ${
                        avatarCategory === cat
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Avatar Grid */}
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 mt-4 max-h-48 overflow-y-auto p-1">
                  {AVATAR_CATALOG[avatarCategory].map((av, idx) => (
                    <div
                      key={idx}
                      onClick={() => setSelectedAvatarUrl(av.url)}
                      className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
                        selectedAvatarUrl === av.url
                          ? 'border-emerald-400 scale-105 shadow-[0_0_15px_rgba(16,185,129,0.6)]'
                          : 'border-transparent hover:border-zinc-600'
                      }`}
                    >
                      <img src={av.url} alt={av.name} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition cursor-pointer shadow-lg shadow-emerald-950/60"
                >
                  Save Profile
                </button>
                <button
                  type="button"
                  onClick={() => setViewState('list')}
                  className="py-3 px-6 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-sm font-semibold transition cursor-pointer border border-zinc-800"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── VIEW 3: Locked Profile PIN Entry (Jordan) ── */}
      {viewState === 'pin' && selectedForPin && (
        <div className="w-full max-w-sm mx-auto my-auto py-8">
          <div className="rounded-3xl bg-[#090e0b]/95 border border-emerald-500/30 p-8 backdrop-blur-2xl shadow-2xl text-center space-y-6">
            <div className="w-20 h-20 mx-auto rounded-2xl overflow-hidden border-2 border-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.5)]">
              <img src={selectedForPin.avatar} alt={selectedForPin.name} className="w-full h-full object-cover" />
            </div>

            <div>
              <h2 className="text-xl font-black text-white">Profile Locked</h2>
              <p className="text-xs text-zinc-400 mt-1">
                Enter PIN to access {selectedForPin.name}'s profile.
              </p>
            </div>

            <form onSubmit={handlePinSubmit} className="space-y-4">
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
                <input
                  type="password"
                  maxLength={6}
                  placeholder="Enter 4-digit PIN (default 1234)"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  className={`w-full bg-[#121a15] border ${
                    pinError ? 'border-red-500' : 'border-zinc-700'
                  } focus:border-emerald-400 text-center tracking-widest text-lg font-mono text-white rounded-xl py-3 outline-none`}
                  autoFocus
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition cursor-pointer shadow-lg shadow-emerald-950/60"
                >
                  Unlock
                </button>
                <button
                  type="button"
                  onClick={() => setViewState('list')}
                  className="py-3 px-4 rounded-xl bg-zinc-900 text-zinc-400 text-sm font-semibold transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="w-full max-w-6xl mx-auto text-center text-xs text-zinc-500 pt-6 border-t border-zinc-900/80 flex items-center justify-between">
        <span>Stoned.living Cinema Experience</span>
        <span className="font-mono text-[11px] text-zinc-600">v2.4.0 · 4K Stream</span>
      </footer>
    </div>
  );
};
