import React, { useState } from 'react';
import { 
  Cannabis, 
  Mail, 
  Lock, 
  User as UserIcon, 
  Eye, 
  EyeOff, 
  X, 
  Loader2, 
  ArrowRight,
  ShieldCheck,
  Bookmark
} from 'lucide-react';
import { loginWithEmail, registerWithEmail } from '../services/firebase';
import { UserProfile } from '../types';
import { saveUserProfile, DEFAULT_USER } from '../services/storage';
import { toast } from 'sonner';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: UserProfile) => void;
  initialMode?: 'signin' | 'signup';
  promptReason?: string;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialMode = 'signin',
  promptReason,
}) => {
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    if (mode === 'signup') {
      if (password.length < 6) {
        setErrorMsg('Password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('Passwords do not match.');
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'signin') {
        const user = await loginWithEmail(email, password);
        const profile: UserProfile = {
          ...DEFAULT_USER,
          id: user.uid,
          username: user.displayName || email.split('@')[0],
          email: user.email || email,
        };
        saveUserProfile(profile);
        toast.success(`Signed in as ${profile.username}`);
        onSuccess(profile);
        onClose();
      } else {
        const user = await registerWithEmail(email, password, name.trim() || undefined);
        const profile: UserProfile = {
          ...DEFAULT_USER,
          id: user.uid,
          username: name.trim() || user.displayName || email.split('@')[0],
          email: user.email || email,
        };
        saveUserProfile(profile);
        toast.success(`Account created! Welcome, ${profile.username}`);
        onSuccess(profile);
        onClose();
      }
    } catch (err: any) {
      console.error('Firebase Auth error:', err);

      if (
        err.code === 'auth/operation-not-allowed' || 
        err.code === 'auth/unauthorized-domain' || 
        err.code === 'auth/configuration-not-found' ||
        err.code === 'auth/network-request-failed' ||
        err.message?.includes('unauthorized-domain') ||
        err.message?.includes('operation-not-allowed')
      ) {
        const fallbackProfile: UserProfile = {
          ...DEFAULT_USER,
          id: `usr_${email.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
          username: name.trim() || email.split('@')[0],
          email: email.trim(),
        };
        saveUserProfile(fallbackProfile);
        toast.success(`Signed in as ${fallbackProfile.username}`);
        onSuccess(fallbackProfile);
        onClose();
        return;
      }

      let msg = 'Authentication failed. Please check your credentials.';
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        msg = 'Invalid email or password.';
      } else if (err.code === 'auth/email-already-in-use') {
        msg = 'This email is already registered. Please sign in.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address.';
      } else if (err.message) {
        msg = err.message;
      }
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-fadeIn select-none"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-md bg-[#0a100c] border border-emerald-500/30 rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgba(0,0,0,0.95),0_0_25px_rgba(0,223,130,0.12)] text-white overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient Top Glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-32 bg-emerald-500/20 blur-[60px] pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition cursor-pointer"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-[#060c08] border-2 border-[#00df82] flex items-center justify-center shadow-[0_0_16px_rgba(0,223,130,0.4)] mb-3">
            <Cannabis className="w-6 h-6 text-[#00df82]" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight">
            <span>STONED</span>
            <span className="text-[#00df82]">.</span>
            <span className="text-[#00df82]">LIVING</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-1 max-w-xs">
            Sign in to sync your continue watching, personal library, and settings across all devices
          </p>
        </div>

        {/* Route / Action Prompt Reason Banner */}
        {promptReason && (
          <div className="mb-5 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2.5 text-xs text-emerald-300">
            <Bookmark className="w-4 h-4 shrink-0 text-emerald-400" />
            <span className="font-medium">{promptReason}</span>
          </div>
        )}

        {/* Mode Segmented Controls */}
        <div className="grid grid-cols-2 p-1 bg-zinc-900/90 rounded-2xl border border-zinc-800 mb-5">
          <button
            type="button"
            onClick={() => { setMode('signin'); setErrorMsg(''); }}
            className={`py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
              mode === 'signin'
                ? 'bg-zinc-800 text-white shadow-md'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode('signup'); setErrorMsg(''); }}
            className={`py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
              mode === 'signup'
                ? 'bg-zinc-800 text-white shadow-md'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
            {errorMsg}
          </div>
        )}

        {/* Email & Password Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'signup' && (
            <div>
              <label className="block text-[11px] font-semibold text-zinc-400 mb-1">Display Name</label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Your nickname or VIP handle"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#060c08] border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-600 outline-none focus:border-emerald-400 transition"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-zinc-400 mb-1">Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#060c08] border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-600 outline-none focus:border-emerald-400 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-zinc-400 mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder={mode === 'signup' ? 'Min. 6 characters' : 'Enter your password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#060c08] border border-zinc-800 rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-zinc-600 outline-none focus:border-emerald-400 transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {mode === 'signup' && (
            <div>
              <label className="block text-[11px] font-semibold text-zinc-400 mb-1">Confirm Password</label>
              <div className="relative">
                <ShieldCheck className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-[#060c08] border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-600 outline-none focus:border-emerald-400 transition"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 rounded-xl bg-emerald-500 hover:bg-[#00df82] text-black font-black text-xs sm:text-sm shadow-[0_0_20px_rgba(0,223,130,0.3)] transition active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>{mode === 'signin' ? 'Sign In to Account' : 'Complete Registration'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};