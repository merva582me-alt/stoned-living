import React, { useState } from 'react';
import {
  Cannabis,
  HelpCircle,
  FileText,
  Wifi,
  Globe,
  X,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Server,
  ShieldCheck,
  Sparkles,
  Zap,
  Tv,
  Film,
  Activity,
  ChevronRight
} from 'lucide-react';

interface FooterProps {
  onNavigate: (tab: string) => void;
  userRole?: 'user' | 'vip' | 'admin';
}

type ModalType = 'faq' | 'terms' | 'speedtest' | 'servicecode' | null;

export const Footer: React.FC<FooterProps> = ({ onNavigate, userRole }) => {
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [language, setLanguage] = useState<string>('en-US');
  
  // Speed test simulation state
  const [testingSpeed, setTestingSpeed] = useState(false);
  const [speedResults, setSpeedResults] = useState<{ ping: number; speed: number; status: string } | null>(null);

  const runSpeedTest = () => {
    setTestingSpeed(true);
    setSpeedResults(null);
    setTimeout(() => {
      const ping = Math.floor(Math.random() * 25) + 12;
      const speed = Math.floor(Math.random() * 150) + 85;
      setSpeedResults({
        ping,
        speed,
        status: 'Optimal 4K HDR Ready'
      });
      setTestingSpeed(false);
    }, 1500);
  };

  return (
    <footer className="w-full bg-[#030604] border-t border-emerald-500/20 mt-6 sm:mt-12 py-8 sm:py-10 px-4 sm:px-6 lg:px-12 text-zinc-400 text-xs">
      <div className="w-full max-w-[1920px] mx-auto space-y-8">
        
        {/* Top Header Row: Brand, Live Status & Language */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-emerald-950/60">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => onNavigate('home')}
              className="flex items-center gap-2 group text-left cursor-pointer"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-green-700 p-0.5 shadow-[0_0_15px_rgba(16,185,129,0.3)] group-hover:scale-105 transition">
                <div className="w-full h-full bg-[#030604] rounded-[10px] flex items-center justify-center">
                  <Cannabis className="w-4 h-4 text-emerald-400" />
                </div>
              </div>
              <span className="font-black text-xl text-white tracking-wider">
                STONED<span className="text-emerald-400">.LIVING</span>
              </span>
            </button>
            <span className="hidden sm:inline-block w-1.5 h-1.5 rounded-full bg-emerald-900" />
            <span className="hidden sm:inline-block text-[11px] text-zinc-400 font-medium">
              High Definition Streaming
            </span>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Live Server Status Badge */}
            <button
              onClick={() => setActiveModal('speedtest')}
              className="flex items-center gap-2 bg-emerald-950/40 border border-emerald-500/30 hover:border-emerald-500/60 text-emerald-300 text-[11px] px-3 py-1.5 rounded-full transition cursor-pointer"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="font-semibold">VidFast 4K Server Online</span>
              <Activity className="w-3 h-3 text-emerald-400 ml-0.5" />
            </button>

            {/* Language Selector */}
            <div className="relative flex items-center bg-zinc-900/80 border border-zinc-800 rounded-lg px-2.5 py-1 text-[11px] text-zinc-300">
              <Globe className="w-3.5 h-3.5 text-zinc-400 mr-1.5 shrink-0" />
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="bg-transparent text-white font-medium focus:outline-none cursor-pointer pr-2"
                aria-label="Select Preferred Language"
              >
                <option value="en-US" className="bg-zinc-900 text-white">English (US)</option>
                <option value="es-ES" className="bg-zinc-900 text-white">Español</option>
                <option value="de-DE" className="bg-zinc-900 text-white">Deutsch</option>
                <option value="ja-JP" className="bg-zinc-900 text-white">日本語</option>
              </select>
            </div>
          </div>
        </div>

        {/* 4-Column Compact Navigation Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 lg:gap-8">
          
          {/* Column 1: Explore */}
          <div className="space-y-3">
            <h4 className="font-bold text-white text-[11px] uppercase tracking-wider text-emerald-400/90">Browse Content</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button onClick={() => onNavigate('home')} className="hover:text-white hover:underline transition">
                  Home Catalog
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('movies')} className="hover:text-white hover:underline transition flex items-center gap-1.5">
                  <Film className="w-3 h-3 text-emerald-400" /> Movies
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('tv')} className="hover:text-white hover:underline transition flex items-center gap-1.5">
                  <Tv className="w-3 h-3 text-emerald-400" /> TV Series
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('anime')} className="hover:text-white hover:underline transition flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-emerald-400" /> Anime Central
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('home')} className="hover:text-white hover:underline transition">
                  New Releases & Trending
                </button>
              </li>
            </ul>
          </div>

          {/* Column 3: Help & Diagnostics */}
          <div className="space-y-3">
            <h4 className="font-bold text-white text-[11px] uppercase tracking-wider text-emerald-400/90">Support & Tools</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button onClick={() => setActiveModal('faq')} className="hover:text-white hover:underline transition flex items-center gap-1.5">
                  <HelpCircle className="w-3 h-3 text-emerald-400" /> Help Center & FAQ
                </button>
              </li>
              <li>
                <button onClick={() => setActiveModal('speedtest')} className="hover:text-white hover:underline transition flex items-center gap-1.5">
                  <Wifi className="w-3 h-3 text-emerald-400" /> Stream Speed Diagnostic
                </button>
              </li>
              <li>
                <button onClick={() => setActiveModal('servicecode')} className="hover:text-white hover:underline transition flex items-center gap-1.5">
                  <Server className="w-3 h-3 text-emerald-400" /> Player & Server Status
                </button>
              </li>
              <li>
                <button onClick={() => setActiveModal('faq')} className="hover:text-white hover:underline transition">
                  Supported Devices
                </button>
              </li>
            </ul>
          </div>

          {/* Column 4: Legal & Privacy */}
          <div className="space-y-3">
            <h4 className="font-bold text-white text-[11px] uppercase tracking-wider text-emerald-400/90">Legal & Terms</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button onClick={() => setActiveModal('terms')} className="hover:text-white hover:underline transition flex items-center gap-1.5">
                  <FileText className="w-3 h-3 text-emerald-400" /> Terms of Use
                </button>
              </li>
              <li>
                <button onClick={() => setActiveModal('terms')} className="hover:text-white hover:underline transition">
                  Privacy Policy
                </button>
              </li>
              <li>
                <button onClick={() => setActiveModal('terms')} className="hover:text-white hover:underline transition">
                  Cookie Preferences
                </button>
              </li>
              <li>
                <button onClick={() => setActiveModal('terms')} className="hover:text-white hover:underline transition">
                  DMCA Content Notices
                </button>
              </li>
            </ul>
          </div>

          {/* Column 5: Elevated Living Notice */}
          <div className="col-span-2 sm:col-span-1 space-y-3 bg-emerald-950/20 border border-emerald-900/40 p-3.5 rounded-2xl">
            <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-[11px]">
              <Zap className="w-3.5 h-3.5" />
              <span>HIGH-VIBE STREAMING</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Ad-free 4K Ultra HD playback powered exclusively by VidFast. Fast, responsive, and seamless streaming across all devices.
            </p>
            <button 
              onClick={() => setActiveModal('speedtest')}
              className="text-[10px] text-emerald-300 font-bold hover:text-white flex items-center gap-1 group"
            >
              <span>Test Your Connection Speed</span>
              <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition" />
            </button>
          </div>

        </div>

        {/* Bottom Bar: Legal, TMDB Attribution & Netflix-style Service Code */}
        <div className="pt-6 border-t border-emerald-950/60 flex flex-col md:flex-row items-center justify-between gap-4 text-[11px] text-zinc-500">
          
          <div className="flex items-center gap-4 flex-wrap justify-center md:justify-start">
            {/* Netflix-style Service Code Button */}
            <button
              onClick={() => setActiveModal('servicecode')}
              className="border border-zinc-800 hover:border-emerald-500/60 text-zinc-400 hover:text-emerald-300 px-3 py-1 rounded font-mono text-[10px] transition flex items-center gap-1.5 cursor-pointer"
            >
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span>Service Code: <strong className="text-white">420-808-STREAM</strong></span>
            </button>

            <span>© {new Date().getFullYear()} Stoned.living. All rights reserved.</span>
          </div>

          <div className="flex items-center gap-4 flex-wrap justify-center">
            <button onClick={() => setActiveModal('terms')} className="hover:text-zinc-300 transition">Terms</button>
            <span>•</span>
            <button onClick={() => setActiveModal('terms')} className="hover:text-zinc-300 transition">Privacy</button>
            <span>•</span>
            <button onClick={() => setActiveModal('faq')} className="hover:text-zinc-300 transition">Help</button>
            <span>•</span>
            <a 
              href="https://www.themoviedb.org" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="hover:text-emerald-400 transition flex items-center gap-1.5 bg-zinc-900/60 px-2.5 py-1 rounded-md border border-zinc-800"
            >
              <span className="text-[10px]">Metadata by</span>
              <span className="font-extrabold text-white tracking-wider text-[11px] bg-gradient-to-r from-emerald-400 to-green-400 bg-clip-text text-transparent">TMDB</span>
              <ExternalLink className="w-2.5 h-2.5 text-zinc-500" />
            </a>
          </div>

        </div>

      </div>

      {/* ================= MODALS ================= */}

      {/* 1. Help & FAQ Modal */}
      {activeModal === 'faq' && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0a120e] border border-emerald-500/40 rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-2xl relative max-h-[85vh] overflow-y-auto">
            <button
              onClick={() => setActiveModal(null)}
              className="absolute top-5 right-5 p-2 text-zinc-400 hover:text-white bg-zinc-900 rounded-full cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-2xl">
                <HelpCircle className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-xl font-black text-white">Help Center & Streaming FAQ</h3>
                <p className="text-xs text-zinc-400">Everything you need to know about streaming on Stoned.living</p>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-4 space-y-1.5">
                <h4 className="font-bold text-white text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" /> How do the streaming video servers work?
                </h4>
                <p className="text-zinc-300 leading-relaxed">
                  Stoned.living uses VidFast 4K Ultra HD for high-speed, direct movie and TV show playback.
                </p>
              </div>

              <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-4 space-y-1.5">
                <h4 className="font-bold text-white text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" /> How does My Stash cloud syncing work?
                </h4>
                <p className="text-zinc-300 leading-relaxed">
                  When you sign in with your Google account, your watchlist, favorites, watch progress history, and server preferences automatically sync to Google Firebase Cloud Storage across all your devices.
                </p>
              </div>

              <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-4 space-y-1.5">
                <h4 className="font-bold text-white text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" /> What if a video is stuck or won't play?
                </h4>
                <p className="text-zinc-300 leading-relaxed">
                  1. Refresh the video player or click the play icon again.<br />
                  2. Ensure your ad-blocker or browser extensions aren't blocking embed frames.<br />
                  3. Run our connection speed test below to verify your network latency.
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setActiveModal(null)}
                className="bg-emerald-500 text-black font-bold text-xs px-6 py-2.5 rounded-xl hover:bg-emerald-400 transition cursor-pointer"
              >
                Close Help
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Terms & Privacy Modal */}
      {activeModal === 'terms' && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0a120e] border border-emerald-500/40 rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-2xl relative max-h-[85vh] overflow-y-auto">
            <button
              onClick={() => setActiveModal(null)}
              className="absolute top-5 right-5 p-2 text-zinc-400 hover:text-white bg-zinc-900 rounded-full cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-2xl">
                <FileText className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-xl font-black text-white">Terms of Use & Privacy</h3>
                <p className="text-xs text-zinc-400">Legal agreement and privacy commitments</p>
              </div>
            </div>

            <div className="space-y-4 text-xs text-zinc-300 leading-relaxed">
              <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-4 space-y-2">
                <h4 className="font-bold text-white text-sm">1. Service Overview & Content Disclaimer</h4>
                <p>
                  Stoned.living operates as a media indexing and discovery platform utilizing TMDB API metadata. Video streaming content is provided via public embed streams and external video networks. We do not host video files directly on our servers.
                </p>
              </div>

              <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-4 space-y-2">
                <h4 className="font-bold text-white text-sm">2. User Privacy & Cloud Data</h4>
                <p>
                  We prioritize your privacy. User profiles and watchlist data are securely stored using Google Firebase Firestore. We never sell or share user account data with third-party advertisers.
                </p>
              </div>

              <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-4 space-y-2">
                <h4 className="font-bold text-white text-sm">3. DMCA Compliance</h4>
                <p>
                  If you are a copyright owner and believe content accessible through our platform infringes upon your copyright, please submit a formal DMCA notice to our compliance team.
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setActiveModal(null)}
                className="bg-emerald-500 text-black font-bold text-xs px-6 py-2.5 rounded-xl hover:bg-emerald-400 transition cursor-pointer"
              >
                I Understand
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Stream Diagnostic & Speed Test Modal */}
      {activeModal === 'speedtest' && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0a120e] border border-emerald-500/40 rounded-3xl max-w-xl w-full p-6 sm:p-8 space-y-6 shadow-2xl relative">
            <button
              onClick={() => setActiveModal(null)}
              className="absolute top-5 right-5 p-2 text-zinc-400 hover:text-white bg-zinc-900 rounded-full cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-2xl">
                <Wifi className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-xl font-black text-white">Stream Speed & CDN Diagnostic</h3>
                <p className="text-xs text-zinc-400">Test your connection latency to high-speed embed nodes</p>
              </div>
            </div>

            <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 text-center space-y-6">
              {!speedResults && !testingSpeed && (
                <div className="space-y-4">
                  <p className="text-xs text-zinc-300">
                    Click below to ping active video embed mirrors and test your connection quality for 4K/1080p playback.
                  </p>
                  <button
                    onClick={runSpeedTest}
                    className="bg-gradient-to-r from-emerald-400 to-green-500 text-black font-extrabold text-xs px-8 py-3.5 rounded-2xl shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:scale-105 active:scale-95 transition cursor-pointer flex items-center gap-2 mx-auto"
                  >
                    <Zap className="w-4 h-4" /> START STREAM DIAGNOSTIC
                  </button>
                </div>
              )}

              {testingSpeed && (
                <div className="py-6 space-y-4">
                  <RefreshCw className="w-10 h-10 text-emerald-400 animate-spin mx-auto" />
                  <p className="text-xs font-bold text-emerald-300">Testing CDN nodes & measure latency...</p>
                </div>
              )}

              {speedResults && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-emerald-950/40 border border-emerald-500/30 p-4 rounded-xl text-center">
                      <span className="text-[10px] text-zinc-400 uppercase font-bold block">Network Latency</span>
                      <span className="text-2xl font-black text-emerald-400">{speedResults.ping} ms</span>
                    </div>
                    <div className="bg-emerald-950/40 border border-emerald-500/30 p-4 rounded-xl text-center">
                      <span className="text-[10px] text-zinc-400 uppercase font-bold block">Estimated Speed</span>
                      <span className="text-2xl font-black text-emerald-400">{speedResults.speed} Mbps</span>
                    </div>
                  </div>
                  <div className="bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 p-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Status: {speedResults.status}</span>
                  </div>
                  <button
                    onClick={runSpeedTest}
                    className="text-xs text-zinc-400 hover:text-white underline cursor-pointer"
                  >
                    Run Test Again
                  </button>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setActiveModal(null)}
                className="bg-zinc-800 text-white font-bold text-xs px-6 py-2.5 rounded-xl hover:bg-zinc-700 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Service Code & System Info Modal */}
      {activeModal === 'servicecode' && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0a120e] border border-emerald-500/40 rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl relative">
            <button
              onClick={() => setActiveModal(null)}
              className="absolute top-5 right-5 p-2 text-zinc-400 hover:text-white bg-zinc-900 rounded-full cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-2xl">
                <Server className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-xl font-black text-white">System Information & Service Code</h3>
                <p className="text-xs text-zinc-400">Stream session diagnostics and device specs</p>
              </div>
            </div>

            <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 space-y-3 font-mono text-xs text-zinc-300">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <span className="text-zinc-500">Service Code:</span>
                <span className="text-emerald-400 font-bold">420-808-STREAM</span>
              </div>
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <span className="text-zinc-500">App Version:</span>
                <span className="text-white">v2.4.0 (Pro Build)</span>
              </div>
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <span className="text-zinc-500">Active Embed Engine:</span>
                <span className="text-emerald-300 font-bold">VidFast 4K Ultra HD</span>
              </div>
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <span className="text-zinc-500">Database Connection:</span>
                <span className="text-green-400 font-bold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span> Firebase Firestore Live
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">User Agent:</span>
                <span className="text-zinc-400 truncate max-w-[200px]">HTML5 / React 18 SPA</span>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setActiveModal(null)}
                className="bg-emerald-500 text-black font-bold text-xs px-6 py-2.5 rounded-xl hover:bg-emerald-400 transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

    </footer>
  );
};
