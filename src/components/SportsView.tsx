import React, { useState, useEffect } from 'react';
import { Trophy, Tv2, Loader2, AlertCircle, RefreshCw, Radio, Zap, Target, Dumbbell, CircleDot } from 'lucide-react';
import { MediaItem, UserProfile } from '../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SportEvent {
  id: string;
  title: string;
  sport_category: string;
  provider: string;
  thumbnail?: string;
  is_live: boolean;
}

interface SportsViewProps {
  user?: UserProfile;
  onPlayMedia: (item: MediaItem, season?: number, episode?: number) => void;
}

// ---------------------------------------------------------------------------
// Sport category → icon mapping
// ---------------------------------------------------------------------------

function SportIcon({ category, className = 'w-4 h-4' }: { category: string; className?: string }) {
  const lower = category.toLowerCase();
  if (lower.includes('football') || lower.includes('soccer')) return <CircleDot className={className} />;
  if (lower.includes('basketball') || lower.includes('nba'))   return <Target className={className} />;
  if (lower.includes('ufc') || lower.includes('mma') || lower.includes('boxing')) return <Zap className={className} />;
  if (lower.includes('tennis') || lower.includes('golf'))      return <Trophy className={className} />;
  if (lower.includes('motor') || lower.includes('f1'))        return <Zap className={className} />;
  if (lower.includes('weight') || lower.includes('fitness'))  return <Dumbbell className={className} />;
  return <Tv2 className={className} />;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sportEventToMediaItem(ev: SportEvent): MediaItem {
  return {
    id: Number(ev.id) || Math.abs(hashCode(ev.id + ev.provider)),
    title: ev.title,
    overview: `Live ${ev.sport_category} event`,
    poster_path: ev.thumbnail || null,
    backdrop_path: null,
    vote_average: 0,
    vote_count: 0,
    popularity: 100,
    media_type: 'tv',
    // Sports-specific fields (accessed via `as any` in WatchPlayer)
    ...(ev as any),
    channel_id: ev.id,
    sports_provider: ev.provider,
    sport_category: ev.sport_category,
    is_live: true
  } as unknown as MediaItem;
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
}

// In production on Cloudflare Pages, the Worker is routed at /api/* so we
// use a relative path by default. VITE_RESOLVER_URL can override for local dev
// (point it at http://localhost:8787 when running `wrangler dev`).
const RESOLVER_URL = (import.meta.env.VITE_RESOLVER_URL || '').replace(/\/$/, '');

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const SportsView: React.FC<SportsViewProps> = ({ onPlayMedia }) => {
  const [events, setEvents]     = useState<SportEvent[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(false);

  const fetchEvents = async () => {
    setLoading(true);
    setError(false);
    try {
      const endpoint = RESOLVER_URL
        ? `${RESOLVER_URL}/api/sports/events?provider=all`
        : '/api/sports/events?provider=all';
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as SportEvent[];
      setEvents(Array.isArray(data) ? data : []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEvents(); }, []);

  // Group by sport_category
  const grouped = events.reduce<Record<string, SportEvent[]>>((acc, ev) => {
    const cat = ev.sport_category || 'Sports';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(ev);
    return acc;
  }, {});

  const categories = Object.keys(grouped).sort();

  // ---------------------------------------------------------------------------
  // Loading
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-32 gap-4">
        <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
        <p className="text-sm font-bold text-emerald-300 tracking-widest uppercase">Loading Live Events…</p>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Error
  // ---------------------------------------------------------------------------
  if (error) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-32 gap-4 px-4 text-center">
        <AlertCircle className="w-10 h-10 text-rose-400" />
        <p className="text-sm font-bold text-white">Could not load live events</p>
        <p className="text-xs text-zinc-400">The resolver worker may be offline or no events are currently live.</p>
        <button
          onClick={fetchEvents}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-black font-bold text-xs px-5 py-2.5 rounded-xl transition cursor-pointer mt-2"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </button>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Empty state
  // ---------------------------------------------------------------------------
  if (events.length === 0) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-32 gap-4 px-4 text-center">
        <Trophy className="w-12 h-12 text-emerald-500/40" />
        <p className="text-base font-black text-white">No Live Events Right Now</p>
        <p className="text-xs text-zinc-400 max-w-sm">
          Check back soon — live sports events will appear here automatically when they go live.
        </p>
        <button
          onClick={fetchEvents}
          className="flex items-center gap-2 bg-emerald-950 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 font-bold text-xs px-5 py-2.5 rounded-xl transition cursor-pointer mt-2"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Main view
  // ---------------------------------------------------------------------------
  return (
    <div className="w-full max-w-[1920px] mx-auto py-6 px-4 sm:px-6 lg:px-10 space-y-10 pb-24 lg:pb-10">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white">Live Sports</h1>
            <p className="text-xs text-emerald-400 font-mono mt-0.5">{events.length} events live now</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Live indicator */}
          <span className="flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest">
            <Radio className="w-3 h-3 animate-pulse" /> Live
          </span>
          <button
            onClick={fetchEvents}
            className="p-2 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-900 transition cursor-pointer"
            title="Refresh events"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Category sections */}
      {categories.map((cat) => (
        <section key={cat} className="space-y-4">
          {/* Section header */}
          <div className="flex items-center gap-2.5">
            <SportIcon category={cat} className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-extrabold text-white uppercase tracking-wider">{cat}</h2>
            <span className="text-[10px] font-mono text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">
              {grouped[cat].length}
            </span>
          </div>

          {/* Event grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {grouped[cat].map((ev) => (
              <button
                key={`${ev.provider}-${ev.id}`}
                onClick={() => onPlayMedia(sportEventToMediaItem(ev))}
                className="group text-left bg-[#0e1411] hover:bg-[#131d17] border border-emerald-900/40 hover:border-emerald-500/50 rounded-2xl p-4 transition-all duration-200 cursor-pointer"
              >
                {/* Thumbnail or sport icon fallback */}
                {ev.thumbnail ? (
                  <img
                    src={ev.thumbnail}
                    alt={ev.title}
                    className="w-full aspect-video object-cover rounded-xl mb-3 opacity-80 group-hover:opacity-100 transition"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-full aspect-video bg-emerald-950/40 rounded-xl mb-3 flex items-center justify-center">
                    <SportIcon category={cat} className="w-10 h-10 text-emerald-500/40" />
                  </div>
                )}

                {/* Event info */}
                <div className="space-y-1.5">
                  <p className="text-xs font-extrabold text-white line-clamp-2 group-hover:text-emerald-300 transition leading-tight">
                    {ev.title}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-[9px] font-bold text-rose-300 bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded-full uppercase">
                      <Radio className="w-2.5 h-2.5 animate-pulse" /> Live
                    </span>
                    <span className="text-[9px] text-zinc-500 font-mono truncate">
                      {ev.provider}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};
