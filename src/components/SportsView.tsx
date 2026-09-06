import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Trophy, Loader2, AlertCircle, RefreshCw, Radio, Flame, Calendar,
  ChevronLeft, Play, SlidersHorizontal, Grid, Layers, Clock, CircleDot,
  Zap, Target, Dumbbell, Tv2, LucideIcon,
} from 'lucide-react';
import { buildEnrichmentMap, type MatchEnrichment } from '../services/sportsdb';
import { SportMatchCarousel, SportMatchTile, type SportMatch } from './SportMatchCarousel';

// ---------------------------------------------------------------------------
// streamed.pk types
// ---------------------------------------------------------------------------

const STREAMED_BASE = 'https://streamed.pk';

interface StreamedMatch {
  id:       string;
  title:    string;
  category: string;
  date:     number;   // Unix ms epoch
  poster?:  string;
  popular:  boolean;
  teams?: {
    home?: { name: string; badge: string };
    away?: { name: string; badge: string };
  };
  sources: { source: string; id: string }[];
}

interface StreamedSport {
  id:   string;
  name: string;
}

interface StreamedStream {
  id:       string;
  streamNo: number;
  language: string;
  hd:       boolean;
  embedUrl: string;
  source:   string;
}

// ---------------------------------------------------------------------------
// streamed.pk helpers
// ---------------------------------------------------------------------------

async function streamedFetch<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${STREAMED_BASE}${path}`);
    if (!res.ok) return null;
    return await res.json() as T;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Local interfaces
// ---------------------------------------------------------------------------

interface SportCategory { id: string; name: string; }

interface SportSectionConfig {
  id:       string;
  title:    string;
  subtitle: string;
  icon:     LucideIcon;
}

interface SportsViewProps {
  user?: any;
  onPlayMedia?: (item: any) => void;
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function sportIcon(category: string): LucideIcon {
  const l = (category || '').toLowerCase();
  if (l.includes('football') || l.includes('soccer')) return CircleDot;
  if (l.includes('basketball')) return Target;
  if (l.includes('ufc') || l.includes('mma') || l.includes('boxing')) return Zap;
  if (l.includes('tennis') || l.includes('golf')) return Trophy;
  if (l.includes('motor') || l.includes('f1')) return Zap;
  if (l.includes('fitness') || l.includes('weight')) return Dumbbell;
  return Tv2;
}

function sortMatches(list: SportMatch[], sortBy: string): SportMatch[] {
  const copy = [...list];
  if (sortBy === 'time.asc')  return copy.sort((a, b) => a.date - b.date);
  if (sortBy === 'time.desc') return copy.sort((a, b) => b.date - a.date);
  if (sortBy === 'title')     return copy.sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''));
  return copy.sort((a, b) => {
    if (a.is_live !== b.is_live) return a.is_live ? -1 : 1;
    return a.date - b.date;
  });
}

/** A match is truly live only if its start time is within a reasonable window.
 *  streamed.pk /live sometimes lists matches hours before kick-off. */
function isActuallyLive(m: StreamedMatch, fromLiveEndpoint: boolean): boolean {
  if (!fromLiveEndpoint) return false;
  const diff = Date.now() - m.date; // positive = started in the past
  return diff >= -15 * 60 * 1000 && diff <= 6 * 60 * 60 * 1000;
}

/** Convert a StreamedMatch to a SportMatch.
 *  Badges come exclusively from TSDB enrichment — streamed.pk badge fields
 *  are unreliable (often just the sport category name). */
function toSportMatch(m: StreamedMatch, fromLiveEndpoint: boolean, enrich?: MatchEnrichment): SportMatch {
  return {
    id:       m.id,
    title:    m.title,
    category: m.category,
    date:     m.date,
    is_live:  isActuallyLive(m, fromLiveEndpoint),
    poster:   m.poster ? `${STREAMED_BASE}${m.poster}.webp` : undefined,
    // No teams from streamed.pk — badges only come from TSDB below
    tsdb: enrich ? {
      homeBadge:  enrich.homeBadge,
      awayBadge:  enrich.awayBadge,
      leagueName: enrich.leagueName,
      homeScore:  enrich.homeScore,
      awayScore:  enrich.awayScore,
    } : undefined,
    _sources: m.sources,
  } as SportMatch;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const SportsView: React.FC<SportsViewProps> = () => {
  const [sports, setSports]               = useState<StreamedSport[]>([]);
  const [liveMatches, setLiveMatches]     = useState<SportMatch[]>([]);
  const [bySport, setBySport]             = useState<Record<string, SportMatch[]>>({});
  const [loading, setLoading]             = useState(true);
  const [loadError, setLoadError]         = useState<string | null>(null);
  // Progressive enrichment updates: matchId → enrichment (arrives after initial render)
  const [enrichUpdates, setEnrichUpdates] = useState<Map<string, MatchEnrichment>>(() => new Map());

  // Filters
  const [selectedSport, setSelectedSport]   = useState('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'live' | 'upcoming'>('all');
  const [sortBy, setSortBy]                 = useState('default');
  const [viewMode, setViewMode]             = useState<'carousels' | 'grid'>('carousels');

  // Hero
  const [heroIndex, setHeroIndex] = useState(0);

  // Player
  const [activeMatch, setActiveMatch]     = useState<SportMatch | null>(null);
  const [streams, setStreams]             = useState<StreamedStream[]>([]);
  const [streamLoading, setStreamLoading] = useState(false);
  const [streamError, setStreamError]     = useState(false);
  const [streamIndex, setStreamIndex]     = useState(0);

  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // ── 1. Fetch sports categories & all matches in parallel ──────────────
      const [sportsData, liveData, allData] = await Promise.all([
        streamedFetch<StreamedSport[]>('/api/sports'),
        streamedFetch<StreamedMatch[]>('/api/matches/live'),
        streamedFetch<StreamedMatch[]>('/api/matches/all'),
      ]);

      if (controller.signal.aborted) return;

      const sportsList: StreamedSport[] = sportsData ?? [];
      const liveRaw: StreamedMatch[]    = liveData  ?? [];
      const allRaw:  StreamedMatch[]    = allData   ?? [];

      setSports(sportsList);

      // ── 2. TSDB enrichment — Phase 1 synchronous, Phase 2 progressive ──────
      const allForEnrich = [...liveRaw, ...allRaw].map(m => ({
        id: m.id, title: m.title,
        teams: m.teams
          ? { home: m.teams.home ? { name: m.teams.home.name } : undefined,
              away: m.teams.away ? { name: m.teams.away.name } : undefined }
          : undefined,
      }));

      // Reset progressive updates on each full reload
      setEnrichUpdates(new Map());

      const enrichMap = await buildEnrichmentMap(
        allForEnrich,
        // onUpdate: called progressively as team-search badges arrive
        (id, enrichment) => {
          setEnrichUpdates(prev => {
            const next = new Map(prev);
            next.set(id, { ...prev.get(id), ...enrichment });
            return next;
          });
        }
      );

      if (controller.signal.aborted) return;

      // ── 3. Build live SportMatch list ─────────────────────────────────────
      const liveIds = new Set(liveRaw.map(m => m.id));
      const liveMapped: SportMatch[] = liveRaw.map(m =>
        toSportMatch(m, true, enrichMap.get(m.id))
      );
      setLiveMatches(liveMapped);

      // ── 4. Build per-sport upcoming map ───────────────────────────────────
      const sportMap: Record<string, SportMatch[]> = {};
      for (const m of allRaw) {
        if (liveIds.has(m.id)) continue;
        const cat = m.category?.toLowerCase() || 'other';
        if (!sportMap[cat]) sportMap[cat] = [];
        sportMap[cat].push(toSportMatch(m, false, enrichMap.get(m.id)));
      }
      setBySport(sportMap);

    } catch {
      if (!controller.signal.aborted) {
        setLoadError('Could not load sports events. Please try again.');
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    load();
    return () => { abortRef.current?.abort(); };
  }, [load]);

  // ── Derived categories from actual match data + streamed.pk sports list ──
  const categories: SportCategory[] = useMemo(() => {
    // Prefer streamed.pk sports list if available, otherwise derive from data
    if (sports.length > 0) return sports;
    const seen = new Set<string>();
    const cats: SportCategory[] = [];
    const allKeys = [...Object.keys(bySport), ...liveMatches.map(m => m.category.toLowerCase())];
    for (const k of allKeys) {
      if (!k || seen.has(k)) continue;
      seen.add(k);
      cats.push({ id: k, name: k.charAt(0).toUpperCase() + k.slice(1) });
    }
    return cats.sort((a, b) => a.name.localeCompare(b.name));
  }, [sports, bySport, liveMatches]);

  const sportSections: SportSectionConfig[] = useMemo(() => {
    const sections: SportSectionConfig[] = [{
      id:       'live',
      title:    'Live Now',
      subtitle: 'All live games and events happening right now',
      icon:     Flame,
    }];
    for (const cat of categories) {
      sections.push({
        id:       cat.id,
        title:    cat.name,
        subtitle: `Upcoming ${cat.name.toLowerCase()} events`,
        icon:     sportIcon(cat.name),
      });
    }
    return sections;
  }, [categories]);

  /** Merge a progressive enrichment update into a match's tsdb field */
  const applyUpdate = useCallback((m: SportMatch): SportMatch => {
    const upd = enrichUpdates.get(m.id);
    if (!upd) return m;
    return { ...m, tsdb: { ...m.tsdb, ...upd } };
  }, [enrichUpdates]);

  const allMatches = useMemo(() => {
    const upcoming = Object.values(bySport).flat();
    const seen = new Set<string>();
    const merged: SportMatch[] = [];
    for (const m of [...liveMatches, ...upcoming]) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      merged.push(applyUpdate(m));
    }
    return merged;
  }, [liveMatches, bySport, applyUpdate]);

  const filteredMatches = useMemo(() => {
    let list = allMatches;
    if (selectedSport !== 'all') {
      const target = selectedSport.toLowerCase();
      list = list.filter(m => m.category.toLowerCase() === target);
    }
    if (selectedStatus === 'live')     list = list.filter(m => m.is_live);
    if (selectedStatus === 'upcoming') list = list.filter(m => !m.is_live);
    return sortMatches(list, sortBy);
  }, [allMatches, selectedSport, selectedStatus, sortBy]);

  const activeFilterCount =
    (selectedSport !== 'all' ? 1 : 0) +
    (selectedStatus !== 'all' ? 1 : 0) +
    (sortBy !== 'default' ? 1 : 0);
  const isFilterActive = activeFilterCount > 0 || viewMode === 'grid';

  const heroPool = liveMatches.length
    ? liveMatches.slice(0, 5)
    : allMatches.filter(m => !m.is_live).slice(0, 5);
  const featuredMatch = heroPool[heroIndex % (heroPool.length || 1)] || heroPool[0];

  useEffect(() => {
    if (!heroPool.length) return;
    const interval = setInterval(() => setHeroIndex(prev => (prev + 1) % heroPool.length), 8000);
    return () => clearInterval(interval);
  }, [heroPool.length]);

  // ── Stream fetching via streamed.pk ───────────────────────────────────────

  const openMatch = useCallback(async (match: SportMatch) => {
    setActiveMatch(match);
    setStreams([]);
    setStreamIndex(0);
    setStreamError(false);
    setStreamLoading(true);

    const sources = match._sources;

    if (!sources || sources.length === 0) {
      setStreamError(true);
      setStreamLoading(false);
      return;
    }

    try {
      // Fetch all sources in parallel, collect all streams
      const results = await Promise.all(
        sources.map(s =>
          streamedFetch<StreamedStream[]>(`/api/stream/${s.source}/${s.id}`)
            .then(arr => arr ?? [])
        )
      );
      const allStreams: StreamedStream[] = results.flat();
      if (!allStreams.length) {
        setStreamError(true);
        return;
      }
      setStreams(allStreams);
    } catch {
      setStreamError(true);
    } finally {
      setStreamLoading(false);
    }
  }, []);

  const closePlayer = () => { setActiveMatch(null); setStreams([]); setStreamError(false); };

  const getSectionMatches = (sectionId: string): SportMatch[] => {
    const raw = sectionId === 'live' ? liveMatches : (bySport[sectionId.toLowerCase()] ?? []);
    return raw.map(applyUpdate);
  };

  // ── Player view ──────────────────────────────────────────────────────────

  if (activeMatch) {
    const cur = streams[streamIndex];
    return (
      <div className="w-full max-w-[1920px] mx-auto py-6 px-4 sm:px-6 lg:px-10 pb-24 lg:pb-10 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={closePlayer}
            className="flex items-center gap-1.5 bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-500/30 text-emerald-300 font-bold text-xs px-3.5 py-2 rounded-xl transition cursor-pointer shrink-0">
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
              <button key={`${s.source}-${s.streamNo}`} onClick={() => setStreamIndex(i)}
                className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                  streamIndex === i
                    ? 'bg-emerald-500 text-black border-emerald-400'
                    : 'bg-black/60 text-zinc-400 border-zinc-700 hover:border-emerald-500/60 hover:text-emerald-300'
                }`}>
                {s.language || `#${s.streamNo}`}{s.hd ? ' HD' : ''}
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
              <p className="text-xs text-zinc-400">This event may not have started yet — check back closer to kick-off</p>
              <button onClick={() => openMatch(activeMatch)}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-black font-bold text-xs px-5 py-2.5 rounded-xl transition cursor-pointer">
                <RefreshCw className="w-3.5 h-3.5" /> Retry
              </button>
            </div>
          )}
          {!streamLoading && !streamError && cur && (
            <iframe
              key={cur.embedUrl}
              src={cur.embedUrl}
              width="100%"
              height="100%"
              frameBorder={0}
              scrolling="no"
              allow="autoplay; fullscreen; encrypted-media"
              allowFullScreen
              className="w-full h-full"
            />
          )}
        </div>

        {/* Match info panel */}
        {activeMatch.tsdb && (
          <div className="flex items-center gap-4 bg-[#0b100c] border border-emerald-900/40 rounded-2xl px-5 py-3 flex-wrap">
            {activeMatch.tsdb.leagueName && (
              <span className="text-xs text-emerald-300 font-semibold">{activeMatch.tsdb.leagueName}</span>
            )}
            {(activeMatch.tsdb.homeScore !== undefined && activeMatch.tsdb.awayScore !== undefined) && (
              <span className="text-white font-black text-sm">
                {activeMatch.tsdb.homeScore} – {activeMatch.tsdb.awayScore}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Main catalog view ─────────────────────────────────────────────────────

  return (
    <div className="space-y-10 px-4 sm:px-6 lg:px-10 w-full max-w-[1920px] mx-auto pt-4 pb-24 lg:pb-10">

      {/* HERO */}
      {loading ? (
        <section className="relative w-full rounded-3xl overflow-hidden bg-[#0a100c] border border-emerald-950/60 min-h-[440px] sm:min-h-[520px] flex items-end p-6 sm:p-10 md:p-14 animate-pulse">
          <div className="space-y-4 max-w-2xl w-full z-10">
            <div className="h-6 w-36 bg-emerald-900/50 rounded-md" />
            <div className="h-12 w-3/4 bg-emerald-950/80 rounded-2xl" />
            <div className="h-16 w-full bg-zinc-900/50 rounded-2xl" />
            <div className="flex gap-3 pt-2">
              <div className="h-12 w-32 bg-emerald-800/40 rounded-2xl" />
            </div>
          </div>
        </section>
      ) : featuredMatch ? (
        <section className="relative w-full rounded-3xl overflow-hidden bg-[#060e09] border border-emerald-950 shadow-[0_0_50px_rgba(16,185,129,0.1)] min-h-[440px] sm:min-h-[520px] flex items-end">
          <div className="absolute inset-0">
            {featuredMatch.poster ? (
              <img src={featuredMatch.poster} alt={featuredMatch.title}
                className="w-full h-full object-cover object-center scale-105 transition-all duration-1000" />
            ) : (() => {
              const hBadge = featuredMatch.teams?.home?.badge || featuredMatch.tsdb?.homeBadge;
              const aBadge = featuredMatch.teams?.away?.badge || featuredMatch.tsdb?.awayBadge;
              return (
                <>
                  {hBadge && <img src={hBadge} alt="" aria-hidden className="absolute left-[5%] top-1/2 -translate-y-1/2 w-[38%] max-w-[320px] opacity-10 blur-2xl scale-150 pointer-events-none" />}
                  {aBadge && <img src={aBadge} alt="" aria-hidden className="absolute right-[5%] top-1/2 -translate-y-1/2 w-[38%] max-w-[320px] opacity-10 blur-2xl scale-150 pointer-events-none" />}
                  <div className="absolute right-0 top-0 bottom-0 w-1/2 hidden md:flex items-center justify-center gap-6 pr-12">
                    {hBadge && <img src={hBadge} alt={featuredMatch.teams?.home?.name ?? ''} className="w-28 h-28 lg:w-36 lg:h-36 object-contain drop-shadow-[0_0_24px_rgba(16,185,129,0.3)]" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
                    <span className="text-3xl font-black text-emerald-400/60">VS</span>
                    {aBadge && <img src={aBadge} alt={featuredMatch.teams?.away?.name ?? ''} className="w-28 h-28 lg:w-36 lg:h-36 object-contain drop-shadow-[0_0_24px_rgba(16,185,129,0.3)]" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/60 via-[#060e09]/80 to-[#060e09]" />
                </>
              );
            })()}
            <div className="absolute inset-0 bg-gradient-to-t from-[#060e09] via-[#060e09]/60 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#060e09] via-[#060e09]/70 to-transparent w-full md:w-2/3" />
          </div>
          <div className="relative z-10 p-6 sm:p-10 md:p-14 max-w-3xl space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="bg-emerald-500 text-black font-extrabold text-[10px] sm:text-xs px-2.5 py-1 rounded-md tracking-wider uppercase shadow-[0_0_15px_rgba(16,185,129,0.5)] flex items-center gap-1">
                <Trophy className="w-3.5 h-3.5" /> FEATURED EVENT
              </span>
              {featuredMatch.is_live ? (
                <span className="bg-rose-600/90 text-white font-black text-xs px-2.5 py-1 rounded-md flex items-center gap-1">
                  <Radio className="w-3.5 h-3.5 animate-pulse" /> LIVE
                </span>
              ) : (
                <span className="bg-black/60 backdrop-blur-md text-emerald-300 font-black text-xs px-2.5 py-1 rounded-md border border-emerald-500/30 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {new Date(featuredMatch.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              {featuredMatch.tsdb?.leagueName && (
                <span className="bg-black/40 text-zinc-300 text-[10px] px-2 py-0.5 rounded-md border border-zinc-700">
                  {featuredMatch.tsdb.leagueName}
                </span>
              )}
            </div>
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white tracking-tight leading-none drop-shadow-lg">
              {featuredMatch.title}
            </h1>
            {featuredMatch.tsdb && (featuredMatch.tsdb.homeScore !== undefined) && (
              <p className="text-emerald-300 font-black text-2xl">
                {featuredMatch.tsdb.homeScore} – {featuredMatch.tsdb.awayScore}
              </p>
            )}
            <p className="text-zinc-300 text-sm sm:text-base leading-relaxed max-w-2xl">
              {featuredMatch.is_live
                ? 'Watch this event live right now on Stoned.Living Sports.'
                : `Scheduled for ${new Date(featuredMatch.date).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`}
            </p>
            <div className="flex items-center gap-3 pt-2">
              <button onClick={() => openMatch(featuredMatch)}
                className="px-6 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm transition-all shadow-[0_0_25px_rgba(16,185,129,0.4)] flex items-center gap-2">
                <Play className="w-5 h-5 fill-black" />
                {featuredMatch.is_live ? 'Watch Live' : 'Watch Event'}
              </button>
              <button onClick={load}
                className="px-5 py-3.5 rounded-2xl bg-black/60 text-zinc-300 border border-zinc-700 hover:border-emerald-400 hover:text-emerald-300 font-bold text-sm transition-all backdrop-blur-md flex items-center gap-2">
                <RefreshCw className="w-4 h-4" /> Refresh
              </button>
            </div>
            {heroPool.length > 1 && (
              <div className="flex items-center gap-1.5 pt-2">
                {heroPool.map((_, i) => (
                  <button key={i} onClick={() => setHeroIndex(i)}
                    className={`h-1.5 rounded-full transition-all ${heroIndex === i ? 'w-6 bg-emerald-400' : 'w-1.5 bg-zinc-600 hover:bg-zinc-400'}`}
                    aria-label={`Featured event ${i + 1}`} />
                ))}
              </div>
            )}
          </div>
        </section>
      ) : (
        <section className="relative w-full rounded-3xl overflow-hidden bg-[#0a100c] border border-emerald-950/60 min-h-[320px] flex flex-col items-center justify-center gap-4 p-8 text-center">
          <Trophy className="w-12 h-12 text-emerald-500/30" />
          <p className="text-lg font-black text-white">No Events Scheduled</p>
          <p className="text-xs text-zinc-400 max-w-sm">Check back soon — live games and events appear here automatically.</p>
          <button onClick={load}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-black font-bold text-xs px-5 py-2.5 rounded-xl transition cursor-pointer">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </section>
      )}

      {/* API error banner */}
      {loadError && (
        <div className="bg-rose-950/40 border border-rose-500/30 rounded-2xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white">{loadError}</p>
          </div>
          <button onClick={load}
            className="shrink-0 flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-black font-bold text-xs px-3 py-2 rounded-xl transition cursor-pointer">
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      )}

      {/* FILTER & CATALOG EXPLORER */}
      <section className="bg-[#0b100c] border border-emerald-900/40 p-4 sm:p-5 rounded-3xl space-y-4 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <SlidersHorizontal className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <h3 className="text-lg font-black text-white">Sports Filter & Event Explorer</h3>
              <p className="text-xs text-zinc-400">
                {liveMatches.length} live · {allMatches.filter(m => !m.is_live).length} upcoming
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-[#121915] p-1 rounded-2xl border border-emerald-950 self-start md:self-auto">
            <button onClick={() => setViewMode('carousels')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                viewMode === 'carousels' ? 'bg-emerald-500 text-black shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'text-zinc-400 hover:text-white'
              }`}>
              <Layers className="w-3.5 h-3.5" /> Featured Rows
            </button>
            <button onClick={() => setViewMode('grid')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                viewMode === 'grid' ? 'bg-emerald-500 text-black shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'text-zinc-400 hover:text-white'
              }`}>
              <Grid className="w-3.5 h-3.5" /> Full Grid Catalog
            </button>
          </div>
        </div>

        {/* Sport category pill tabs */}
        {categories.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <button
              onClick={() => setSelectedSport('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                selectedSport === 'all'
                  ? 'bg-emerald-500 text-black border-emerald-400'
                  : 'bg-[#141d17] text-zinc-300 border-emerald-900/50 hover:border-emerald-500/50 hover:text-white'
              }`}>
              All Sports
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedSport(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                  selectedSport === cat.id
                    ? 'bg-emerald-500 text-black border-emerald-400'
                    : 'bg-[#141d17] text-zinc-300 border-emerald-900/50 hover:border-emerald-500/50 hover:text-white'
                }`}>
                {React.createElement(sportIcon(cat.name), { className: 'w-3 h-3' })}
                {cat.name}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 pt-2">
          <div>
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Status</label>
            <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value as typeof selectedStatus)}
              className="w-full bg-[#141d17] text-white border border-emerald-900/50 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:border-emerald-400">
              <option value="all">All Events</option>
              <option value="live">Live Only</option>
              <option value="upcoming">Upcoming Only</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Sort By</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
              className="w-full bg-[#141d17] text-white border border-emerald-900/50 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:border-emerald-400">
              <option value="default">Live First, Then Time</option>
              <option value="time.asc">Start Time (Soonest)</option>
              <option value="time.desc">Start Time (Latest)</option>
              <option value="title">Title A–Z</option>
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={load}
              className="w-full flex items-center justify-center gap-2 bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-500/30 text-emerald-300 font-bold text-xs px-3 py-2 rounded-xl transition cursor-pointer">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh Events
            </button>
          </div>
        </div>

        {isFilterActive && (
          <div className="flex items-center justify-between border-t border-emerald-950/60 pt-3 text-xs">
            <span className="text-emerald-400 font-medium">
              Filter Active ({activeFilterCount} active filters) · {filteredMatches.length} events
            </span>
            <button onClick={() => { setSelectedSport('all'); setSelectedStatus('all'); setSortBy('default'); setViewMode('carousels'); }}
              className="text-zinc-400 hover:text-white underline font-semibold">
              Reset Filters
            </button>
          </div>
        )}
      </section>

      {/* GRID or CAROUSEL ROWS */}
      {viewMode === 'grid' || isFilterActive ? (
        <section className="space-y-6 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black text-white flex items-center gap-2">
              <Trophy className="w-6 h-6 text-emerald-400" /> Sports Event Results
            </h2>
            <span className="text-xs text-zinc-400 font-mono">{filteredMatches.length} events</span>
          </div>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-[4/3] bg-emerald-950/20 rounded-2xl animate-pulse border border-emerald-900/30" />
              ))}
            </div>
          ) : filteredMatches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
              <Calendar className="w-10 h-10 text-emerald-500/30" />
              <p className="text-base font-black text-white">No Events Match Your Filters</p>
              <p className="text-xs text-zinc-400">Try adjusting your filters or check back later.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredMatches.map(m => (
                <SportMatchTile key={m.id} match={m} onOpen={openMatch} />
              ))}
            </div>
          )}
        </section>
      ) : (
        <div className="space-y-2">
          {sportSections.map(sec => (
            <SportMatchCarousel
              key={sec.id}
              title={sec.title}
              subtitle={sec.subtitle}
              icon={sec.icon}
              matches={getSectionMatches(sec.id)}
              onOpen={openMatch}
              loading={loading}
            />
          ))}
          {!loading && !liveMatches.length && !Object.values(bySport).some(arr => (arr as SportMatch[]).length > 0) && !loadError && (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
              <Trophy className="w-12 h-12 text-emerald-500/30" />
              <p className="text-base font-black text-white">No Events Right Now</p>
              <p className="text-xs text-zinc-400 max-w-sm">Events appear here automatically when they go live or get scheduled.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
