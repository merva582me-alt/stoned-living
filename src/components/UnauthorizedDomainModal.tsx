import React, { useState } from 'react';
import { X, ExternalLink, Copy, Check, ShieldAlert, Key, Globe, Sparkles } from 'lucide-react';
import firebaseConfig from '../../firebase-applet-config.json';

interface UnauthorizedDomainModalProps {
  domain: string;
  onClose: () => void;
  onRetry: () => void;
}

export const UnauthorizedDomainModal: React.FC<UnauthorizedDomainModalProps> = ({
  domain,
  onClose,
  onRetry
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(domain);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const firebaseConsoleUrl = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/settings`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg bg-[#0a120e] border-2 border-emerald-500/50 rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgba(16,185,129,0.3)] space-y-6 overflow-hidden text-left">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white bg-zinc-900/60 hover:bg-zinc-800 rounded-full transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Icon & Title */}
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/30 inline-block mb-1">
              GitHub Pages Authorization Required
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Authorize Your GitHub Pages Domain
            </h2>
          </div>
        </div>

        {/* Info Text */}
        <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
          Google Authentication blocked this request because your deployed domain (<span className="text-emerald-400 font-bold font-mono">{domain}</span>) is not listed in your Firebase project's Authorized Domains list.
        </p>

        {/* Copy Domain Card */}
        <div className="bg-[#101913] border border-emerald-800/60 rounded-2xl p-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Globe className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="truncate">
              <span className="block text-[10px] text-zinc-400 font-mono uppercase">Your Current Domain</span>
              <span className="text-sm font-black font-mono text-emerald-300 truncate block">{domain}</span>
            </div>
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Domain</span>
              </>
            )}
          </button>
        </div>

        {/* Step by Step Guide */}
        <div className="space-y-2.5 text-xs text-zinc-300">
          <p className="font-bold text-emerald-400 uppercase tracking-wider text-[11px] flex items-center gap-1">
            <Key className="w-3.5 h-3.5" /> Simple Checklist to Fix Google Login on GitHub Pages:
          </p>
          <ol className="space-y-2 list-decimal list-inside bg-black/40 p-3.5 rounded-2xl border border-zinc-800/80 leading-relaxed">
            <li>
              Open <a href={firebaseConsoleUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline font-bold inline-flex items-center gap-1">Firebase Console <ExternalLink className="w-3 h-3" /></a>
            </li>
            <li>
              <strong>Enable Google Provider:</strong> Under <strong>Authentication</strong> → <strong>Sign-in method</strong>, ensure <strong>Google</strong> is set to <strong>Enabled</strong>.
            </li>
            <li>
              <strong>Add Authorized Domain:</strong> Under <strong>Authentication</strong> → <strong>Settings</strong> → <strong>Authorized domains</strong> tab, click <strong>Add domain</strong> and paste <span className="text-emerald-300 font-mono font-bold">{domain}</span> (e.g. <span className="text-zinc-400 font-mono">your-username.github.io</span>).
            </li>
          </ol>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
          <a
            href={firebaseConsoleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 text-black font-black text-xs py-3 px-4 rounded-xl shadow-lg transition text-center cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Open Firebase Console</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <button
            onClick={onRetry}
            className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs py-3 px-4 rounded-xl border border-zinc-700 transition cursor-pointer"
          >
            Try Sign In Again
          </button>
        </div>
      </div>
    </div>
  );
};
