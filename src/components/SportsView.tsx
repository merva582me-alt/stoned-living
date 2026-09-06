import React, { useState, useEffect, useCallback } from 'react';
import {
  Trophy, Tv2, Loader2, AlertCircle, RefreshCw, Radio,
  Zap, Target, Dumbbell, CircleDot, ChevronLeft, Calendar, Flame
} from 'lucide-react';
import { buildEnrichmentMap, type MatchEnrichment } from '../services/sportsdb';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MatchSource { source: string; id: string; }
interface MatchTeam   { name: string; badge: string; }

// sportsrc.org ?type=matches response shape.
// Field names confirmed from live API — adjust if the API evolves.
interface APIMatch {
  id:        string;
  title:     string;
  category:  string;
  date:      number;
  poster?:   string;
  teams?:    { home?: MatchTeam; away?: MatchTeam };
  // sportsrc.org does not always include streamed.pk-style source mappings.
  // When present, these are used as fallback stream sources only.
  sources?:  MatchSource[];
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

// A normalised match used internally — extended with TheSportsDB enrichment
interface SportMatch {
  id:              string;
  title:           string;
  category:        string;
  date:            number;
  is_live:         boolean;
  teams?:          { home?: MatchTeam; away?: MatchTeam };
  poster?:         string;
  // streamed.pk source entries — only populated when the match data includes
  // explicit streamed.pk-compatible source mappings. Never populated from a
  // sportsrc.org match ID alone (C3 — no cross-provider ID contamination).
  streamedSources?: MatchSource[];
  // TheSportsDB enrichment (populated async after initial load)
  tsdb?:           MatchEnrichment;
}

interface SportsViewProps {
  user?: any;
  onPlayMedia?: (item: any) => void;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

// sportsrc.org is the primary data source. All calls go through the Worker
// proxy at /api/sportsrc — the Worker injects the X-API-KEY header so the
// key is never exposed in the browser bundle. The Vite dev server proxies
// /api/* to localhost:8787 (wrangler dev), so the same path works everywhere.
function sportsrcFetch(params: Record<string, string>) {
  return fetch(`/api/sportsrc?${new URLSearchParams(params).toString()}`);
}

// streamed.pk is the backup/fallback source for streams only.
// Calls are routed through the Worker proxy which adds the required headers.
const STREAMED_PROXY = 'https://stoned-resolver.stonedliving.workers.dev/api/sports';

function streamedBackupFetch(path: string) {
  if (window.location.hostname === 'localhost') {
    return fetch(`https://streamed.pk${path}`, {
      headers: { Referer: 'https://streamed.pk', 'User-Agent': 'Mozilla/5.0' }
    });
  }
  return fetch(`${STREAMED_PROXY}${path}`);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Today's date in YYYY-MM-DD format (local time) — required by sportsrc.org
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function normalise(m: APIMatch, isLive: boolean): SportMatch {
  return {
    id:              m.id,
    title:           m.title,
    category:        m.category,
    date:            m.date,
    is_live:         isLive,
    teams:           m.teams,
    poster:          m.poster,
    // Only carry forward streamed.pk source entries if they exist on this match
    streamedSources: m.sources?.length ? m.sources : undefined,
  };
}

// Route streamed.pk image URLs through the proxy
const STREAMED_PROXY_IMG = 'https://stoned-resolver.stonedliving.workers.dev/api/sports';
function streamedImg(path: string) {
  if (window.location.hostname === 'localhost') return `https://streamed.pk${path}`;
  return `${STREAMED_PROXY_IMG}${path}`;
}
function badgeUrl(badge: string) { return streamedImg(`/api/images/badge/${badge}.webp`); }

// ---------------------------------------------------------------------------
// Icon helper
// ---------------------------------------------------------------------------

function SportIcon({ category, className = 'w-4 h-4' }: { category: string; className?: string }) {
  const l = (category || '').toLowerCase();
  if (l.includes('football') || l.includes('soccer')) return <CircleDot className={className} />;
  if (l.includes('basketball'))                        return <Target    className={className} />;
  if (l.includes('ufc') || l.includes('mma') || l.includes('boxing')) return <Zap className={className} />;
  if (l.includes('tennis') || l.includes('golf'))     return <Trophy    className={className} />;
  if (l.includes('motor') || l.includes('f1'))        return <Zap       className={className} />;
  if (l.includes('fitness') || l.includes('weight'))  return <Dumbbell  className={className} />;
  return <Tv2 className={className} />;
}

// ---------------------------------------------------------------------------
// Match card
// ---------------------------------------------------------------------------

// Split "Team A vs Team B" into two halves
function splitVs(title: string): [string, string] {
  const parts = title.split(/\s+vs\.?\s+/i);
  if (parts.length >= 2) return [parts[0].trim(), parts.slice(1).join(' vs ').trim()];
  return [title, ''];
}

function MatchCard({ match, onOpen }: { match: SportMatch; onOpen: (m: SportMatch) => void }) {
  const home  = match.teams?.home;
  const away  = match.teams?.away;
  const tsdb  = match.tsdb;

  // Badge priority: streamed.pk native → TheSportsDB enrichment
  const homeBadgeSrc = home?.badge ? badgeUrl(home.badge) : tsdb?.homeBadge;
  const awayBadgeSrc = away?.badge ? badgeUrl(away.badge) : tsdb?.awayBadge;
  const hasBadges    = !!(homeBadgeSrc && awayBadgeSrc);

  const timeStr = match.date
    ? new Date(match.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  // Score display from TSDB (live matches)
  const hasScore = tsdb?.homeScore != null && tsdb?.awayScore != null;

  // Generated VS card — used when no badges/poster at all
  const [teamA, teamB] = splitVs(match.title);
  const generatedCard = (
    <div className="w-full aspect-video bg-gradient-to-br from-emerald-950/60 to-[#0a100d] rounded-xl mb-3 flex flex-col items-center justify-center gap-2 px-4 border border-emerald-900/30">
      <SportIcon category={match.category} className="w-5 h-5 text-emerald-500/50 mb-1" />
      <div className="flex items-center gap-3 w-full justify-center">
        <span className="text-white font-black text-[11px] text-center leading-tight line-clamp-2 flex-1">{teamA}</span>
        <span className="text-emerald-400 font-black text-xs shrink-0 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">VS</span>
        <span className="text-white font-black text-[11px] text-center leading-tight line-clamp-2 flex-1">{teamB || match.category}</span>
      </div>
    </div>
  );

  return (
    <button
      onClick={() => onOpen(match)}
      className="group text-left bg-[#0e1411] hover:bg-[#131d17] border border-emerald-900/40 hover:border-emerald-500/50 rounded-2xl p-4 transition-all duration-200 cursor-pointer w-full"
    >
      {/* Art: team badges (native or TSDB), poster, or generated VS card */}
      {hasBadges ? (
        <div className="w-full aspect-video bg-emerald-950/30 rounded-xl mb-3 flex flex-col items-center justify-center gap-2 px-4">
          {/* Score row — shown when TSDB has live score data */}
          {hasScore ? (
            <div className="flex items-center gap-3">
              <img src={homeBadgeSrc} alt={home?.name ?? teamA} className="w-10 h-10 object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              <div className="flex items-center gap-2 bg-black/50 border border-emerald-900/40 rounded-lg px-3 py-1">
                <span className="text-white font-black text-lg tabular-nums">{tsdb!.homeScore}</span>
                <span className="text-zinc-500 font-black text-xs">–</span>
                <span className="text-white font-black text-lg tabular-nums">{tsdb!.awayScore}</span>
              </div>
              <img src={awayBadgeSrc} alt={away?.name ?? teamB} className="w-10 h-10 object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <img src={homeBadgeSrc} alt={home?.name ?? teamA} className="w-12 h-12 object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              <span className="text-zinc-400 font-black text-xs">VS</span>
              <img src={awayBadgeSrc} alt={away?.name ?? teamB} className="w-12 h-12 object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            </div>
          )}
          {/* Progress label (inning / minute / period) */}
          {tsdb?.progress && (
            <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase tracking-wide">
              {tsdb.progress}
            </span>
          )}
        </div>
      ) : match.poster ? (
        <img
          src={match.poster.startsWith('http') ? match.poster : streamedImg(`${match.poster}${match.poster.endsWith('.webp') ? '' : '.webp'}`)}
          alt={match.title}
          className="w-full aspect-video object-cover rounded-xl mb-3 opacity-80 group-hover:opacity-100 transition"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      ) : generatedCard}

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
          {tsdb?.leagueName && (
            <span className="text-[9px] text-zinc-500 truncate max-w-[120px]">{tsdb.leagueName}</span>
          )}
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
  const [liveMatches,     setLiveMatches]     = useState<SportMatch[]>([]);
  const [todayMatches,    setTodayMatches]     = useState<SportMatch[]>([]);
  const [categoryMatches, setCategoryMatches]  = useState<SportMatch[]>([]);
  const [categories,      setCategories]       = useState<SportCategory[]>([]);

  // UI
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(false);

  // Player
  const [activeMatch,   setActiveMatch]   = useState<SportMatch | null>(null);
  const [streams,       setStreams]       = useState<StreamObj[]>([]);
  const [streamLoading, setStreamLoading] = useState(false);
  const [streamError,   setStreamError]   = useState(false);
  const [streamIndex,   setStreamIndex]   = useState(0);

  // ── Load categories then fetch live + today matches per sport ────────────

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      // Step 1: fetch the sports list first so we know which sports to query
      const catsRes = await sportsrcFetch({ type: 'sports' });
      const cats: SportCategory[] = catsRes.ok
        ? (await catsRes.json() as SportCategory[])
        : [];
      const validCats = Array.isArray(cats) ? cats : [];
      setCategories(validCats);

      if (!validCats.length) throw new Error('No sports categories returned');

      const today = todayStr();

      // Step 2: for each sport, fetch live (inprogress) + all-today in parallel
      const fetches = validCats.flatMap((cat) => [
        sportsrcFetch({ type: 'matches', sport: cat.name, status: 'inprogress', date: today })
          .then((r) => r.ok ? r.json() as Promise<APIMatch[]> : Promise.resolve([]))
          .catch(() => [] as APIMatch[]),
        sportsrcFetch({ type: 'matches', sport: cat.name, date: today })
          .then((r) => r.ok ? r.json() as Promise<APIMatch[]> : Promise.resolve([]))
          .catch(() => [] as APIMatch[]),
      ]);

      const results = await Promise.allSettled(fetches);

      // Step 3: merge all results — even indices = live, odd indices = all-today
      const liveRaw:  APIMatch[] = [];
      const todayRaw: APIMatch[] = [];
      results.forEach((r, i) => {
        if (r.status !== 'fulfilled' || !Array.isArray(r.value)) return;
        if (i % 2 === 0) liveRaw.push(...r.value);
        else              todayRaw.push(...r.value);
      });

      // Deduplicate by id
      const liveIds = new Set<string>();
      const live = liveRaw
        .filter((m) => { if (liveIds.has(m.id)) return false; liveIds.add(m.id); return true; })
        .map((m) => normalise(m, true));

      const seenIds = new Set(liveIds);
      const allToday = todayRaw
        .filter((m) => { if (seenIds.has(m.id)) return false; seenIds.add(m.id); return true; })
        .map((m) => normalise(m, liveIds.has(m.id)));

      setLiveMatches(live);
      setTodayMatches(allToday);

      // Enrich all matches with TheSportsDB badges + scores — update cards incrementally
      const allMatches = [...live, ...allToday.filter(m => !liveIds.has(m.id))];
      buildEnrichmentMap(allMatches, (id, enrichment) => {
        const patch = (list: SportMatch[]) =>
          list.map(m => m.id === id ? { ...m, tsdb: enrichment } : m);
        if (liveIds.has(id)) {
          setLiveMatches(prev => patch(prev));
        } else {
          setTodayMatches(prev => patch(prev));
        }
      }).catch(() => {});
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Category filter: re-fetch sport-specific matches on selection ─────────

  useEffect(() => {
    if (activeCategory === 'all') { setCategoryMatches([]); return; }
    const today = todayStr();
    const liveIds = new Set(liveMatches.map((m) => m.id));
    Promise.allSettled([
      sportsrcFetch({ type: 'matches', sport: activeCategory, status: 'inprogress', date: today })
        .then((r) => r.ok ? r.json() as Promise<APIMatch[]> : Promise.resolve([])),
      sportsrcFetch({ type: 'matches', sport: activeCategory, date: today })
        .then((r) => r.ok ? r.json() as Promise<APIMatch[]> : Promise.resolve([])),
    ]).then((results) => {
      const merged: APIMatch[] = [];
      const seen = new Set<string>();
      results.forEach((r) => {
        if (r.status !== 'fulfilled' || !Array.isArray(r.value)) return;
        r.value.forEach((m) => { if (!seen.has(m.id)) { seen.add(m.id); merged.push(m); } });
      });
      setCategoryMatches(merged.map((m) => normalise(m, liveIds.has(m.id))));
    }).catch(() => setCategoryMatches([]));
  }, [activeCategory, liveMatches]);

  // ── Open match → sportsrc.org primary embed + streamed.pk fallback ────────

  const openMatch = useCallback(async (match: SportMatch) => {
    setActiveMatch(match);
    setStreams([]);
    setStreamIndex(0);
    setStreamError(false);
    setStreamLoading(true);
    try {
      // Always fetch sportsrc.org detail for the primary embed URL.
      // Only attempt streamed.pk fallback sources if the match has explicit
      // streamed.pk-compatible source entries (C3 — no cross-provider ID use).
      const sportsrcDetailPromise = sportsrcFetch({ type: 'detail', id: match.id })
        .then((r) => r.ok ? r.json() as Promise<Record<string, unknown>> : Promise.resolve(null))
        .catch(() => null);

      const streamedPromises = (match.streamedSources ?? []).map((src) =>
        streamedBackupFetch(`/api/stream/${src.source}/${src.id}`)
          .then((r) => r.json() as Promise<StreamObj[]>)
          .catch(() => [] as StreamObj[])
      );

      const [detailResult, ...streamedResults] = await Promise.all([
        sportsrcDetailPromise,
        ...streamedPromises,
      ]);

      const all: StreamObj[] = [];

      // Primary stream: extract embed URL from sportsrc.org detail response.
      // The field is named 'streamUrl' per the API — adjust if the live response
      // uses a different key (e.g. 'url', 'embed_url', 'stream_url').
      const primaryUrl =
        (detailResult as any)?.streamUrl ||
        (detailResult as any)?.url ||
        (detailResult as any)?.embed_url ||
        (detailResult as any)?.stream_url ||
        null;

      if (primaryUrl) {
        all.push({ id: match.id, streamNo: 1, language: '', hd: true, embedUrl: String(primaryUrl), source: 'primary' });
      }

      // Fallback streams from streamed.pk — collect valid embed URLs, renumber from 2
      const backups: StreamObj[] = [];
      for (const r of streamedResults) {
        if (Array.isArray(r)) backups.push(...r.filter((s) => s.embedUrl));
      }
      backups.sort((a, b) => (b.hd ? 1 : 0) - (a.hd ? 1 : 0) || a.streamNo - b.streamNo);
      backups.forEach((s, i) => { s.streamNo = all.length + i + 1; });
      all.push(...backups);

      if (!all.length) { setStreamError(true); return; }
      setStreams(all);
    } catch {
      setStreamError(true);
    } finally {
      setStreamLoading(false);
    }
  }, []);

  const closePlayer = () => { setActiveMatch(null); setStreams([]); setStreamError(false); };

  // ── Derived lists ────────────────────────────────────────────────────────

  const displayMatches  = activeCategory === 'all' ? todayMatches : categoryMatches;
  const shownLive       = activeCategory === 'all' ? liveMatches : displayMatches.filter((m) => m.is_live);
  const upcomingMatches = displayMatches.filter((m) => !m.is_live);

  // ── Player view ──────────────────────────────────────────────────────────

  if (activeMatch) {
    const cur = streams[streamIndex];
    return (
      <div className="w-full max-w-[1920px] mx-auto py-6 px-4 sm:px-6 lg:px-10 pb-24 lg:pb-10 space-y-4">
        {/* Back + title */}
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

        {/* Stream switcher */}
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
                {i + 1}{s.hd ? ' HD' : ''}
              </button>
            ))}
          </div>
        )}

        {/* Player */}
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
              className="w-full h-full border-0"
              scrolling="no"
              allow="autoplay; fullscreen; encrypted-media"
              allowFullScreen
            />
          )}
        </div>
      </div>
    );
  }

  // ── Loading / Error ──────────────────────────────────────────────────────

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
        <button onClick={load}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-black font-bold text-xs px-5 py-2.5 rounded-xl transition cursor-pointer mt-2">
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </button>
      </div>
    );
  }

  // ── Main view ────────────────────────────────────────────────────────────

  return (
    <div className="w-full max-w-[1920px] mx-auto py-6 px-4 sm:px-6 lg:px-10 pb-24 lg:pb-10 space-y-8">

      {/* Header */}
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
          <button onClick={load}
            className="p-2 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-900 transition cursor-pointer"
            title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Category filter tabs */}
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
              onClick={() => setActiveCategory(cat.name)}
              className={`shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border font-bold text-xs transition-all cursor-pointer ${
                activeCategory === cat.name
                  ? 'bg-emerald-500 text-black border-emerald-400'
                  : 'bg-black/60 text-zinc-400 border-zinc-700 hover:border-emerald-500/50 hover:text-white'
              }`}
            >
              <SportIcon category={cat.name} className="w-3.5 h-3.5" /> {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Live Now */}
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

      {/* Today's Schedule */}
      {upcomingMatches.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2.5">
            <Calendar className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-extrabold text-white uppercase tracking-wider">
              {activeCategory === 'all' ? "Today's Schedule" : 'Upcoming'}
            </h2>
            <span className="text-[10px] font-mono text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">{upcomingMatches.length}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {upcomingMatches.map((m) => <MatchCard key={m.id} match={m} onOpen={openMatch} />)}
          </div>
        </section>
      )}

      {/* Empty state */}
      {shownLive.length === 0 && upcomingMatches.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <Trophy className="w-12 h-12 text-emerald-500/30" />
          <p className="text-base font-black text-white">No Events Right Now</p>
          <p className="text-xs text-zinc-400 max-w-sm">
            {activeCategory === 'all'
              ? 'Check back soon — events appear here automatically when they go live.'
              : 'No events scheduled for this sport today. Try another category.'}
          </p>
          <button onClick={load}
            className="flex items-center gap-2 bg-emerald-950 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 font-bold text-xs px-5 py-2.5 rounded-xl transition cursor-pointer">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      )}

    </div>
  );
};
