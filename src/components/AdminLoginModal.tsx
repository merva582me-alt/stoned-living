import React, { useState } from 'react';
import { ShieldAlert, Key, User, Lock, ArrowRight, X, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      // Validate requested credentials
      if (username.trim() === 'reef' && password === '@Andrew123P!') {
        sessionStorage.setItem('stoned_admin_auth', 'true');
        toast.success('Admin access granted! Welcome, Reef. ⚡');
        setUsername('');
        setPassword('');
        onSuccess();
      } else {
        setError('Invalid username or password. Please verify your admin credentials.');
      }
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-md bg-[#0a120e] border-2 border-emerald-500/50 rounded-3xl p-6 sm:p-8 shadow-[0_0_60px_rgba(16,185,129,0.3)] space-y-6 overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white bg-zinc-900/60 hover:bg-zinc-800 rounded-full transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Icon & Title */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/30 inline-block mb-1">
              Admin Portal
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Administrator Login
            </h2>
          </div>
        </div>

        <p className="text-xs text-zinc-400 leading-relaxed">
          Enter your authorized credentials to access system settings, banner announcements, and server cache controls.
        </p>

        {/* Error Alert */}
        {error && (
          <div className="bg-rose-950/60 border border-rose-500/50 text-rose-300 p-3 rounded-2xl text-xs font-semibold flex items-center gap-2 animate-shake">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-emerald-400" /> Username
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter admin username..."
              className="w-full bg-[#101813] border border-emerald-900/60 focus:border-emerald-400 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none transition"
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-emerald-400" /> Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password..."
              className="w-full bg-[#101813] border border-emerald-900/60 focus:border-emerald-400 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none transition font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 text-black font-extrabold text-sm py-3.5 px-6 rounded-xl shadow-lg transition cursor-pointer mt-2"
          >
            {loading ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Unlock Control Center</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
