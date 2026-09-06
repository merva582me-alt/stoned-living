import React, { useState, useEffect, useCallback } from 'react';
import {
  Trophy, Tv2, Loader2, AlertCircle, RefreshCw, Radio,
  Zap, Target, Dumbbell, CircleDot, ChevronLeft, Calendar, Flame
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MatchSource { source: string; id: string; }

interface MatchTeam { name: string; badge: string; }

interface SportMatch {
  id:             string;
  title:          string;
  sport_category: string;
  provider:       string;
  thumbnail?:     string;
  is_live:        boolean;
  sources?:       MatchSource[];
  date?:          number;
  teams?:         { home?: MatchTeam; away?: MatchTeam };
}

interface StreamObj {
  id:       string;
  streamNo: number;
  language: string;
  hd:       boolean;
  embedUrl: string;
  source:   string;
}

interface SportCategory { id: string; name: string; }

interface SportsViewProps {
  user?: any;
  onPlayMedia?: (item: any) => void;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const RESOLVER = (import.meta.env.VITE_RESOLVER_URL || 'https://stoned-resolver.stonedliving.workers.dev').replace(/\/$/, '');
const STREAMED  = 'https://streamed.pk';

// ---------------------------------------------------------------------------
// Icon helper
// ---------------------------------------------------------------------------

function SportIcon({ category, className = 'w-4 h-4' }: { category: string; className?: string }) {
  const l = (category || '').toLowerCase();
  if (l.includes('football') || l.includes('soccer')) return <CircleDot className={className} />;
  if (l.includes('basketball'))                        return <Target   className={className} />;
  if (l.includes('ufc') || l.includes('mma') || l.includes('boxing')) return <Zap className={className} />;
  if (l.includes('tennis') || l.includes('golf'))     return <Trophy   className={className} />;
  if (l.includes('motor') || l.includes('f1'))        return <Zap      className={className} />;
  if (l.includes('fitness') || l.includes('weight'))  return <Dumbbell className={className} />;
  return <Tv2 className={className} />;
}

// ---------------------------------------------------------------------------
// Match card
// ---------------------------------------------------------------------------

function MatchCard({ match, onOpen }: { match: SportMatch; onOpen: (m: SportMatch) => void }) {
  const homeBadge = match.teams?.home?.badge
    ? `${STREAMED}/api/images/badge/${match.teams.home.badge}.webp`
    : null;
  const awayBadge = match.teams?.away?.badge
    ? `${STREAMED}/api/images/badge/${match.teams.away.badge}.webp`
    : null;
  const hasBadges = homeBadge && awayBadge && match.teams?.home && match.teams?.away;
  const timeStr = match.date
    ? new Date(match.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <button
      onClick={() => onOpen(match)}
      className="group text-left bg-[#0e1411] hover:bg-[#131d17] border border-emerald-900/40 hover:border-emerald-500/50 rounded-2xl p-4 transition-all duration-200 cursor-pointer w-full"
    >
      {/* Team badges or poster */}
      {hasBadges ? (
        <div className="w-full aspect-video bg-emerald-950/30 rounded-xl mb-3 flex items-center justify-center gap-4 px-4">
          <img src={homeBadge!} alt={match.teams!.home!.name} className="w-12 h-12 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <span className="text-zinc-400 font-black text-xs">VS</span>
          <img src={awayBadge!} alt={match.teams!.away!.name} className="w-12 h-12 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        </div>
      ) : match.thumbnail ? (
        <img
          src={match.thumbnail}
          alt={match.title}
          className="w-full aspect-video object-cover rounded-xl mb-3 opacity-80 group-hover:opacity-100 transition"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      ) : (
        <div className="w-full aspect-video bg-emerald-950/30 rounded-xl mb-3 flex items-center justify-center">
          <SportIcon category={match.sport_category} className="w-10 h-10 text-emerald-500/30" />
        </div>
      )}

      <div className="space-y-1.5">
        <p className="text-xs font-extrabold text-white line-clamp-2 group-hover:text-emerald-300 transition leading-tight">
          {match.title}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {match.is_live ? (
            <span className="flex items-center gap-1 text-[9px] font-bold text-rose-300 bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded-full uppercase">
              <Radio className="w-2.5 h-2.5 animate-pulse" /> Live
            </span>
          ) : timeStr ? (
            <span className="text-[9px] font-mono text-zinc-400 bg-zinc-800/60 px-1.5 py-0.5 rounded-full">
              {timeStr}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const SportsView: React.FC<SportsViewProps> = () => {
  // Data
  const [liveMatches,    setLiveMatches]    = useState<SportMatch[]>([]);
  const [todayMatches,   setTodayMatches]   = useState<SportMatch[]>([]);
  const [categoryMatches,setCategoryMatches]= useState<SportMatch[]>([]);
  const [categories,     setCategories]     = useState<SportCategory[]>([]);

  // UI state
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(false);

  // Active player
  const [activeMatch,   setActiveMatch]    = useState<SportMatch | null>(null);
  const [streams,       setStreams]        = useState<StreamObj[]>([]);
  const [streamLoading, setStreamLoading]  = useState(false);
  const [streamError,   setStreamError]    = useState(false);
  const [streamIndex,   setStreamIndex]    = useState(0);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [liveRes, todayRes, catsRes] = await Promise.all([
        fetch(`${RESOLVER}/api/sports/events`),
        fetch(`${RESOLVER}/api/sports/today`),
        fetch(`${RESOLVER}/api/sports/categories`),
      ]);
      if (!liveRes.ok && !todayRes.ok) throw new Error('Failed');
      const [live, today, cats] = await Promise.all([
        liveRes.ok  ? liveRes.json()  : Promise.resolve([]),
        todayRes.ok ? todayRes.json() : Promise.resolve([]),
        catsRes.ok  ? catsRes.json()  : Promise.resolve([]),
      ]);
      setLiveMatches(Array.isArray(live)  ? live  : []);
      setTodayMatches(Array.isArray(today) ? today : []);
      setCategories(Array.isArray(cats)   ? cats  : []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Fetch sport-specific matches when category changes
  useEffect(() => {
    if (activeCategory === 'all') {
      setCategoryMatches([]);
      return;
    }
    fetch(`${RESOLVER}/api/sports/by-sport?sport=${activeCategory}`)
      .then((r) => r.json())
      .then((d) => setCategoryMatches(Array.isArray(d) ? d : []))
      .catch(() => setCategoryMatches([]));
  }, [activeCategory]);

  // ---------------------------------------------------------------------------
  // Open match → fetch streams
  // ---------------------------------------------------------------------------

  const openMatch = useCallback(async (match: SportMatch) => {
    setActiveMatch(match);
    setStreams([]);
    setStreamIndex(0);
    setStreamError(false);
    if (!match.sources?.length) { setStreamError(true); return; }
    setStreamLoading(true);
    try {
      const sourcesParam = match.sources.map((s) => `${s.source}:${s.id}`).join(',');
      const res = await fetch(`${RESOLVER}/api/sports/streams?sources=${encodeURIComponent(sourcesParam)}`);
      if (!res.ok) throw new Error();
      const data = await res.json() as StreamObj[];
      const valid = Array.isArray(data) ? data.filter((s) => s.embedUrl) : [];
      if (!valid.length) { setStreamError(true); return; }
      valid.sort((a, b) => (b.hd ? 1 : 0) - (a.hd ? 1 : 0) || a.streamNo - b.streamNo);
      setStreams(valid);
    } catch {
      setStreamError(true);
    } finally {
      setStreamLoading(false);
    }
  }, []);

  const closePlayer = () => { setActiveMatch(null); setStreams([]); setStreamError(false); };

  // ---------------------------------------------------------------------------
  // Derived lists
  // ---------------------------------------------------------------------------

  const displayMatches = activeCategory === 'all' ? todayMatches : categoryMatches;
  // Upcoming = today's non-live matches
  const upcomingMatches = displayMatches.filter((m) => !m.is_live);
  const shownLive = activeCategory === 'all' ? liveMatches : displayMatches.filter((m) => m.is_live);

  // ---------------------------------------------------------------------------
  // Player view
  // ---------------------------------------------------------------------------

  if (activeMatch) {
    const cur = streams[streamIndex];
    return (
      <div className="w-full max-w-[1920px] mx-auto py-6 px-4 sm:px-6 lg:px-10 pb-24 lg:pb-10 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={closePlayer} className="flex items-center gap-1.5 bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-500/30 text-emerald-300 font-bold text-xs px-3.5 py-2 rounded-xl transition cursor-pointer shrink-0">
            <ChevronLeft className="w-4 h-4" /> Back to Sports
          </button>
          <div className="flex items-center gap-2 min-w-0">
            {activeMatch.is_live && (
              <span className="flex items-center gap-1 text-[9px] font-bold text-rose-300 bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded-full uppercase shrink-0">
                <Radio className="w-2.5 h-2.5 animate-pulse" /> Live
              </span>
            )}
            <h1 className="text-sm sm:text-base font-black text-white truncate">{activeMatch.title}</h1>
          </div>
        </div>

        {streams.length > 1 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Stream:</span>
            {streams.map((s, i) => (
              <button key={s.id} onClick={() => setStreamIndex(i)}
                className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                  streamIndex === i ? 'bg-emerald-500 text-black border-emerald-400' : 'bg-black/60 text-zinc-400 border-zinc-700 hover:border-emerald-500/60 hover:text-emerald-300'
                }`}>
                {i + 1}{s.hd ? ' HD' : ''}
              </button>
            ))}
          </div>
        )}

        <div className="w-full aspect-video bg-black rounded-2xl overflow-hidden border border-emerald-500/30 shadow-[0_0_50px_rgba(16,185,129,0.15)]">
          {streamLoading && (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
              <span className="text-xs font-bold text-emerald-300 tracking-widest uppercase">Loading Stream…</span>
            </div>
          )}
          {streamError && !streamLoading && (
            <div className="w-full h-full flex flex-col items-center justify-center gap-4">
              <AlertCircle className="w-10 h-10 text-rose-400" />
              <p className="text-sm font-bold text-white">Stream unavailable</p>
              <p className="text-xs text-zinc-400">This event may not be live yet — check back closer to start time</p>
              <button onClick={() => openMatch(activeMatch)} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-black font-bold text-xs px-5 py-2.5 rounded-xl transition cursor-pointer">
                <RefreshCw className="w-3.5 h-3.5" /> Retry
              </button>
            </div>
          )}
          {!streamLoading && !streamError && cur && (
            <iframe key={cur.embedUrl} src={cur.embedUrl} className="w-full h-full border-0"
              allowFullScreen allow="autoplay; encrypted-media; picture-in-picture; fullscreen" referrerPolicy="no-referrer" />
          )}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Loading / Error
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-32 gap-4">
        <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
        <p className="text-sm font-bold text-emerald-300 tracking-widest uppercase">Loading Sports…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-32 gap-4 px-4 text-center">
        <AlertCircle className="w-10 h-10 text-rose-400" />
        <p className="text-sm font-bold text-white">Could not load sports events</p>
        <button onClick={load} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-black font-bold text-xs px-5 py-2.5 rounded-xl transition cursor-pointer mt-2">
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </button>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Main sports tab
  // ---------------------------------------------------------------------------

  return (
    <div className="w-full max-w-[1920px] mx-auto py-6 px-4 sm:px-6 lg:px-10 pb-24 lg:pb-10 space-y-8">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white">Live Sports</h1>
            <p className="text-xs text-emerald-400 font-mono mt-0.5">{liveMatches.length} live · {todayMatches.length} today</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest">
            <Radio className="w-3 h-3 animate-pulse" /> Live
          </span>
          <button onClick={load} className="p-2 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-900 transition cursor-pointer" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Sport category filter tabs ── */}
      {categories.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setActiveCategory('all')}
            className={`shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border font-bold text-xs transition-all cursor-pointer ${
              activeCategory === 'all'
                ? 'bg-emerald-500 text-black border-emerald-400'
                : 'bg-black/60 text-zinc-400 border-zinc-700 hover:border-emerald-500/50 hover:text-white'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" /> All Sports
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border font-bold text-xs transition-all cursor-pointer ${
                activeCategory === cat.id
                  ? 'bg-emerald-500 text-black border-emerald-400'
                  : 'bg-black/60 text-zinc-400 border-zinc-700 hover:border-emerald-500/50 hover:text-white'
              }`}
            >
              <SportIcon category={cat.name} className="w-3.5 h-3.5" /> {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* ── Live Now section ── */}
      {shownLive.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2.5">
            <Flame className="w-4 h-4 text-rose-400" />
            <h2 className="text-sm font-extrabold text-white uppercase tracking-wider">Live Now</h2>
            <span className="flex items-center gap-1 text-[9px] font-bold text-rose-300 bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded-full uppercase">
              <Radio className="w-2 h-2 animate-pulse" /> {shownLive.length}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {shownLive.map((m) => <MatchCard key={m.id} match={m} onOpen={openMatch} />)}
          </div>
        </section>
      )}

      {/* ── Upcoming Today section ── */}
      {upcomingMatches.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2.5">
            <Calendar className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-extrabold text-white uppercase tracking-wider">
              {activeCategory === 'all' ? 'Today\'s Schedule' : 'Upcoming'}
            </h2>
            <span className="text-[10px] font-mono text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">{upcomingMatches.length}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {upcomingMatches.map((m) => <MatchCard key={m.id} match={m} onOpen={openMatch} />)}
          </div>
        </section>
      )}

      {/* ── Empty state ── */}
      {shownLive.length === 0 && upcomingMatches.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <Trophy className="w-12 h-12 text-emerald-500/30" />
          <p className="text-base font-black text-white">No Events Right Now</p>
          <p className="text-xs text-zinc-400 max-w-sm">
            {activeCategory === 'all'
              ? 'Check back soon — events will appear here automatically when they go live.'
              : 'No events scheduled for this sport today. Try another category.'}
          </p>
          <button onClick={load} className="flex items-center gap-2 bg-emerald-950 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 font-bold text-xs px-5 py-2.5 rounded-xl transition cursor-pointer">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      )}

    </div>
  );
};
