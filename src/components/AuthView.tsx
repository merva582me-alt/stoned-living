import React, { useState } from 'react';
import { Cannabis, Mail, Lock, User as UserIcon, Eye, EyeOff, Sparkles, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { loginWithEmail, registerWithEmail, loginWithGoogle } from '../services/firebase';
import { UserProfile } from '../types';
import { saveUserProfile, DEFAULT_USER } from '../services/storage';
import { toast } from 'sonner';

interface AuthViewProps {
  onSuccess: (user: UserProfile) => void;
  onEnterGuest: (guestName?: string) => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onSuccess, onEnterGuest }) => {
  const [mode, setMode] = useState<'signin' | 'signup' | 'guest'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [guestName, setGuestName] = useState('VIP Cinephile');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (mode === 'guest') {
      const gName = guestName.trim() || 'VIP Cinephile';
      const guestProfile: UserProfile = {
        ...DEFAULT_USER,
        id: `guest_${Date.now()}`,
        username: gName,
        email: 'guest@stoned.living',
        role: 'vip'
      };
      saveUserProfile(guestProfile);
      toast.success(`Welcome, ${gName}!`);
      onSuccess(guestProfile);
      return;
    }

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
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      let msg = 'Authentication failed. Please try again.';
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

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const user = await loginWithGoogle();
      if (user) {
        const profile: UserProfile = {
          ...DEFAULT_USER,
          id: user.uid,
          username: user.displayName || user.email?.split('@')[0] || 'VIP Member',
          email: user.email || '',
          avatar: user.photoURL || DEFAULT_USER.avatar,
        };
        saveUserProfile(profile);
        toast.success(`Signed in as ${profile.username}`);
        onSuccess(profile);
      }
    } catch (err: any) {
      console.error('Google sign in error:', err);
      if (err.code !== 'auth/popup-closed-by-user') {
        setErrorMsg('Google sign in failed. You can sign in as Guest or with email.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = () => {
    setEmail('vip@stoned.living');
    setPassword('stoned2026');
  };

  return (
    <div className="relative min-h-screen w-full bg-[#050508] text-white flex flex-col justify-between overflow-x-hidden selection:bg-emerald-500 selection:text-black">
      {/* Cinematic Background Backdrop with Emerald Ambient Gradients */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-25 scale-105 transition-transform duration-1000"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1920&auto=format&fit=crop&q=80')`
          }}
        />
        {/* Obsidian & Emerald radial vignettes */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#050508] via-[#050508]/80 to-[#050508]/60" />
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-600/15 rounded-full blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-[140px]" />
      </div>

      {/* Top Floating Logo Island */}
      <header className="relative z-10 w-full px-6 sm:px-12 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#060c08] border-2 border-[#00df82] flex items-center justify-center shadow-[0_0_14px_rgba(0,223,130,0.35)] shrink-0">
            <Cannabis className="w-5 h-5 text-[#00df82]" />
          </div>
          <div>
            <span className="font-black text-xl sm:text-2xl tracking-tight leading-none">
              <span className="text-white">STONED</span>
              <span className="text-[#00df82]">.</span>
              <span className="text-[#00df82]">LIVING</span>
            </span>
            <span className="block text-[9px] font-mono tracking-widest text-[#00df82] uppercase mt-0.5 font-semibold">
              HIGH DEFINITION STREAMING
            </span>
          </div>
        </div>

        <button
          onClick={() => {
            setMode('guest');
            setGuestName('VIP Cinephile');
          }}
          className="text-xs sm:text-sm font-semibold text-zinc-300 hover:text-white px-4 py-2 rounded-xl bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800/80 transition-all cursor-pointer backdrop-blur-md"
        >
          Sign in with a name instead
        </button>
      </header>

      {/* Center Sign In Glass Card */}
      <main className="relative z-10 w-full max-w-md mx-auto px-4 py-6 sm:py-10 my-auto">
        <div className="relative rounded-2xl sm:rounded-3xl bg-[#090e0b]/85 border border-emerald-500/25 p-7 sm:p-10 backdrop-blur-2xl shadow-[0_20px_70px_rgba(0,0,0,0.85)]">
          {/* Subtle top emerald glow strip */}
          <div className="absolute -top-[1px] left-12 right-12 h-[2px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent" />

          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {mode === 'signin' && 'Sign In'}
              {mode === 'signup' && 'Create Account'}
              {mode === 'guest' && 'Enter with Name'}
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">
              {mode === 'guest'
                ? 'Choose a display name to jump straight into Stoned.living'
                : 'Stream 4K movies, TV series, anime, & live sports'}
            </p>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2 animate-shake">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Your Name
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Alex"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-[#121a15] border border-zinc-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-white rounded-xl pl-10 pr-4 py-3 text-sm placeholder-zinc-500 transition-all outline-none"
                  />
                </div>
              </div>
            )}

            {mode === 'guest' ? (
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Display Name
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
                  <input
                    type="text"
                    required
                    placeholder="Enter your name..."
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    className="w-full bg-[#121a15] border border-emerald-500/40 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 text-white rounded-xl pl-10 pr-4 py-3 text-sm placeholder-zinc-500 transition-all outline-none"
                    autoFocus
                  />
                </div>
                <p className="text-[11px] text-zinc-500 mt-2">
                  No email or password needed. You'll enter immediately with this profile.
                </p>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      type="email"
                      required
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-[#121a15] border border-zinc-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-white rounded-xl pl-10 pr-4 py-3 text-sm placeholder-zinc-500 transition-all outline-none"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-zinc-300">Password</label>
                    {mode === 'signin' && (
                      <button
                        type="button"
                        onClick={handleQuickDemo}
                        className="text-[11px] text-emerald-400 hover:text-emerald-300 transition cursor-pointer"
                      >
                        Demo credentials
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-[#121a15] border border-zinc-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-white rounded-xl pl-10 pr-11 py-3 text-sm placeholder-zinc-500 transition-all outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {mode === 'signup' && (
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full bg-[#121a15] border border-zinc-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-white rounded-xl pl-10 pr-4 py-3 text-sm placeholder-zinc-500 transition-all outline-none"
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-zinc-400 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded bg-zinc-900 border-zinc-700 text-emerald-500 focus:ring-emerald-500/20"
                    />
                    <span>Remember me</span>
                  </label>
                  <span className="text-zinc-500 hover:text-zinc-400 cursor-pointer">
                    Need help?
                  </span>
                </div>
              </>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-bold text-sm tracking-wide shadow-lg shadow-emerald-950/80 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.99]"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>
                    {mode === 'signin' && 'Sign In'}
                    {mode === 'signup' && 'Create Account'}
                    {mode === 'guest' && 'Enter Stoned.living'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Social / Alternative Divider */}
          <div className="relative my-6 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-800" />
            </div>
            <span className="relative bg-[#090e0b] px-3 text-[11px] font-mono text-zinc-500 uppercase tracking-widest">
              OR
            </span>
          </div>

          {/* Alternative Auth Buttons */}
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-zinc-900/80 hover:bg-zinc-800/90 border border-zinc-800 hover:border-zinc-700 text-white text-xs font-semibold flex items-center justify-center gap-2.5 transition-all cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
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
              <span>Continue with Google</span>
            </button>

            {mode !== 'guest' ? (
              <button
                type="button"
                onClick={() => {
                  setMode('guest');
                  setGuestName('VIP Cinephile');
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>Instant Guest Mode (No login required)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setMode('signin')}
                className="w-full py-2.5 px-4 rounded-xl bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold transition cursor-pointer"
              >
                Back to Email Sign In
              </button>
            )}
          </div>

          {/* Mode Switcher Footer */}
          <div className="mt-7 pt-5 border-t border-zinc-800/80 text-center text-xs text-zinc-400">
            {mode === 'signin' && (
              <p>
                New to Stoned.living?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setErrorMsg('');
                  }}
                  className="text-white hover:text-emerald-400 font-semibold underline underline-offset-4 cursor-pointer"
                >
                  Sign up now
                </button>
              </p>
            )}
            {mode === 'signup' && (
              <p>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setErrorMsg('');
                  }}
                  className="text-white hover:text-emerald-400 font-semibold underline underline-offset-4 cursor-pointer"
                >
                  Sign in
                </button>
              </p>
            )}
            {mode === 'guest' && (
              <p>
                Want to save lists across devices?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setErrorMsg('');
                  }}
                  className="text-white hover:text-emerald-400 font-semibold underline underline-offset-4 cursor-pointer"
                >
                  Create an account
                </button>
              </p>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full px-6 py-6 border-t border-zinc-900/80 text-center text-xs text-zinc-500 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-500/70" />
          <span>Stoned.living Cinema Experience · VidCore 4K Engine · Streamed.pk Sports</span>
        </div>
        <div className="flex items-center gap-4 text-zinc-500 text-[11px]">
          <span className="hover:text-zinc-300 cursor-pointer">DMCA Notice</span>
          <span>·</span>
          <span className="hover:text-zinc-300 cursor-pointer">Privacy</span>
          <span>·</span>
          <span className="hover:text-zinc-300 cursor-pointer">Terms</span>
        </div>
      </footer>
    </div>
  );
};
