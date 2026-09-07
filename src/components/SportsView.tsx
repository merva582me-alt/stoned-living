import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Hls from 'hls.js';
import {
  Trophy, Loader2, AlertCircle, RefreshCw, Radio, Flame, Calendar,
  ChevronLeft, Play, SlidersHorizontal, Grid, Layers, Clock, CircleDot,
  Zap, Target, Dumbbell, Tv2, LucideIcon, Cannabis, MessageSquare, Info, Send,
} from 'lucide-react';
import { toast } from 'sonner';
import { buildEnrichmentMap, fetchTodayFinishedPairs, type MatchEnrichment } from '../services/sportsdb';
import { fetchAPIFinishedPairs } from '../services/espn';
import { SportMatchCarousel, SportMatchTile, type SportMatch } from './SportMatchCarousel';
import { fetchComments, postComment } from '../services/api';
import { StrainDatabase } from '../data/strainDatabase';
import type { Comment } from '../types';

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

// Stable numeric hash from a string (for comment mediaId)
function strHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (Math.imul(31, h) + s.charCodeAt(i)) | 0; }
  return Math.abs(h);
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
  // Default: live first, then upcoming sorted ascending by air time.
  // Entries with no date (date === 0) go last within the upcoming group.
  return copy.sort((a, b) => {
    if (a.is_live !== b.is_live) return a.is_live ? -1 : 1;
    if (a.is_live && b.is_live)  return 0; // preserve API order within live
    const aDate = a.date || Infinity;
    const bDate = b.date || Infinity;
    return aDate - bDate;
  });
}

/** Junk entry patterns — schedule pages and broadcast channels that
 *  streamed.pk lists as "matches" but are not real sporting events. */
const JUNK_PATTERNS = [
  /\bschedule\b/i,
  /\bstreams?\s+schedule\b/i,
  /\bnetwork\b/i,
  /\bbroadcast\b/i,
  /^[A-Z]{2,5}\s+TV$/i,        // e.g. "BBC TV", "ESPN TV"
];

/**
 * Keywords that identify a broadcaster/channel name rather than a team.
 * Used to catch "NFL vs RedZone", "Fox vs ESPN", etc.
 */
const CHANNEL_KEYWORDS = /\b(redzone|red\s+zone|channel|network|tv|espn|fox\s+sports|cbs\s+sports|nbc\s+sports|sky\s+sports|bein\s+sports|dazn|peacock|paramount)\b/i;

function isJunkEntry(m: StreamedMatch): boolean {
  const hasOpponent = /\bvs\.?\b/i.test(m.title);
  if (hasOpponent) {
    // Even with "vs", catch entries where one side is a broadcaster name
    // e.g. "NFL vs RedZone", "Match vs ESPN Channel"
    const parts = m.title.split(/\s+vs\.?\s+/i);
    if (parts.length >= 2) {
      const left  = parts[0].trim();
      const right = parts.slice(1).join(' vs ').trim();
      if (CHANNEL_KEYWORDS.test(left) || CHANNEL_KEYWORDS.test(right)) return true;
    }
    return false;
  }
  return JUNK_PATTERNS.some(p => p.test(m.title));
}

/**
 * Returns true for always-on broadcast channels (no opponent, channel-like
 * name) that should appear in liveMatches but never in the upcoming bySport map.
 */
function isChannelEntry(m: StreamedMatch): boolean {
  if (/\bvs\.?\b/i.test(m.title)) return false; // has opponent → real match
  if (/ - /.test(m.title)) return false;          // dash separator → team match or event
  return CHANNEL_KEYWORDS.test(m.title) || /\bchannel\b/i.test(m.title);
}

/** Trust streamed.pk — if it came from the /live endpoint, it's live.
 *  Also treat always-on broadcast channels (no opponent, has sources) as live. */
function isActuallyLive(m: StreamedMatch, fromLiveEndpoint: boolean): boolean {
  if (fromLiveEndpoint) return true;
  // Channels like "Fox Cricket", "Tennis Channel" etc. have no "vs" opponent
  // and always have an active stream — mark them live regardless of endpoint.
  const hasOpponent = /\bvs\.?\b/i.test(m.title);
  if (!hasOpponent && m.sources?.length > 0) return true;
  return false;
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
      homeBadge:    enrich.homeBadge,
      awayBadge:    enrich.awayBadge,
      leagueName:   enrich.leagueName,
      homeScore:    enrich.homeScore,
      awayScore:    enrich.awayScore,
      eventPoster:  enrich.eventPoster,
      leagueBanner: enrich.leagueBanner,
    } : undefined,
    _sources: m.sources,
  } as SportMatch;
}

// ---------------------------------------------------------------------------
// StreamPlayer — handles HLS (.m3u8), direct video, and embed iframe URLs
// ---------------------------------------------------------------------------

function isHlsUrl(url: string): boolean {
  return url.includes('.m3u8');
}
function isDirectVideo(url: string): boolean {
  return /\.(mp4|webm|ogg|ts)(\?|$)/i.test(url);
}

const StreamPlayer: React.FC<{ url: string }> = ({ url }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isHlsUrl(url)) {
      if (Hls.isSupported()) {
        const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
        hls.loadSource(url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => { video.play().catch(() => {}); });
        return () => { hls.destroy(); };
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari native HLS
        video.src = url;
        video.play().catch(() => {});
      }
    } else if (isDirectVideo(url)) {
      video.src = url;
      video.play().catch(() => {});
    }
  }, [url]);

  if (isHlsUrl(url) || isDirectVideo(url)) {
    return (
      <video
        ref={videoRef}
        className="w-full h-full bg-black"
        controls
        autoPlay
        playsInline
        style={{ display: 'block' }}
      />
    );
  }

  // Regular embed page — use iframe
  return (
    <iframe
      src={url}
      width="100%"
      height="100%"
      frameBorder={0}
      scrolling="no"
      allow="autoplay; fullscreen; encrypted-media"
      allowFullScreen
      className="w-full h-full"
    />
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const SportsView: React.FC<SportsViewProps> = ({ user }) => {
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

  // Player tabs + comments
  const [playerTab, setPlayerTab]           = useState<'info' | 'comments'>('info');
  const [comments, setComments]             = useState<Comment[]>([]);
  const [commentText, setCommentText]       = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // ── 1. Fetch sports categories, all matches, and finished-match sets ──
      // fetchTodayFinishedPairs (TSDB) and fetchAPIFinishedPairs (ESPN/MLB/NHL)
      // run in parallel with the streamed.pk calls; results are merged below.
      const [sportsData, liveData, allData, tsdbFinished, apiFinished] = await Promise.all([
        streamedFetch<StreamedSport[]>('/api/sports'),
        streamedFetch<StreamedMatch[]>('/api/matches/live'),
        streamedFetch<StreamedMatch[]>('/api/matches/all'),
        fetchTodayFinishedPairs(),
        fetchAPIFinishedPairs(),
      ]);

      if (controller.signal.aborted) return;

      // Merge: a match is finished if either source says so
      const finishedPairs  = new Set<string>([...tsdbFinished, ...apiFinished.pairs]);
      const finishedTitles = apiFinished.titles; // for single-name events (NASCAR, UFC, etc.)

      const sportsList: StreamedSport[] = sportsData ?? [];
      // Upcoming: show everything streamed.pk provides, untouched
      const allRaw: StreamedMatch[] = (allData ?? []).filter(m => !isJunkEntry(m));
      // Live: only keep matches that have at least one source listed and whose
      // scheduled start time is not more than 4 hours in the past (a stale-feed
      // guard — no real match runs longer than that).
      const MAX_LIVE_AGE_MS = 4 * 60 * 60 * 1000;
      const liveRaw: StreamedMatch[] = (liveData ?? []).filter(m =>
        !isJunkEntry(m) &&
        m.sources?.length > 0 &&
        (!m.date || Date.now() - m.date < MAX_LIVE_AGE_MS)
      );

      setSports(sportsList);

      // ── 1b. Probe live matches — drop any with no working stream feed ─────────
      // For each live match fetch every source's stream list and only keep the
      // match if at least one stream comes back with a non-empty embedUrl.
      const probeResults = await Promise.all(
        liveRaw.map(async m => {
          const streams = await Promise.all(
            m.sources.map(s =>
              streamedFetch<StreamedStream[]>(`/api/stream/${s.source}/${s.id}`)
                .then(arr => arr ?? [])
            )
          );
          const hasFeed = streams.flat().some(st => !!st.embedUrl);
          return { m, hasFeed };
        })
      );

      // Drop matches confirmed finished by any source
      const normStr = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();

      // Helper: check a home|away pair (in both orders) against finishedPairs
      const isPairFinished = (h: string, a: string) =>
        finishedPairs.has(`${normStr(h)}|${normStr(a)}`);

      // Extract team names from a title using both "vs" and " - " separators
      const splitTeams = (title: string): [string, string] | null => {
        const vsParts = title.split(/\s+vs\.?\s+/i);
        if (vsParts.length >= 2) return [vsParts[0].trim(), vsParts.slice(1).join(' vs ').trim()];
        const dashIdx = title.indexOf(' - ');
        if (dashIdx !== -1) {
          const left  = title.slice(0, dashIdx).trim();
          const right = title.slice(dashIdx + 3).trim();
          if (left && right && !/\b20\d{2}\b/.test(left) && !/\b20\d{2}\b/.test(right)) {
            return [left, right];
          }
        }
        return null;
      };

      const liveFiltered = probeResults.filter(r => {
        if (!r.hasFeed) return false;
        const title = r.m.title ?? '';
        const teams = splitTeams(title);
        if (teams) {
          if (isPairFinished(teams[0], teams[1])) return false;
        } else if (title) {
          // Single-name event (NASCAR race, UFC card, etc.)
          const t = normStr(title);
          for (const ft of finishedTitles) {
            if (t.includes(ft) || ft.includes(t)) return false;
          }
        }
        return true;
      }).map(r => r.m);

      if (controller.signal.aborted) return;

      // ── 2. TSDB enrichment — Phase 1 synchronous, Phase 2 progressive ──────
      const allForEnrich = [...liveFiltered, ...allRaw].map(m => ({
        id: m.id, title: m.title, category: m.category,
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

      // ── 3. Build live SportMatch list ─────────────────────────────────────
      const liveIds = new Set(liveFiltered.map(m => m.id));
      const liveMapped: SportMatch[] = liveFiltered.map(m =>
        toSportMatch(m, true, enrichMap.get(m.id))
      );
      setLiveMatches(liveMapped);

      // ── 4. Build per-sport upcoming map ───────────────────────────────────
      // Drop matches that are confirmed finished by TSDB or whose scheduled
      // time is in the past and weren't picked up by the live endpoint.
      const now = Date.now();
      const sportMap: Record<string, SportMatch[]> = {};
      for (const m of allRaw) {
        if (liveIds.has(m.id)) continue;
        if (m.date && m.date < now) continue; // past kick-off and not live → ended

        // Always-on broadcast channels belong in liveMatches only, not upcoming
        if (isChannelEntry(m)) continue;

        // Secondary check: any API says this specific match is finished today
        const title = m.title ?? '';
        const teams = splitTeams(title);
        if (teams) {
          if (isPairFinished(teams[0], teams[1])) continue;
        } else if (title) {
          const t = normStr(title);
          let done = false;
          for (const ft of finishedTitles) {
            if (t.includes(ft) || ft.includes(t)) { done = true; break; }
          }
          if (done) continue;
        }

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
    // Reset player UI state for new match
    setPlayerTab('info');
    setComments([]);
    setCommentText('');
    // Pre-load comments in background
    fetchComments('movie', strHash(match.id)).then(setComments);

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
      const allStreams: StreamedStream[] = results.flat().filter(s => !!s.embedUrl);
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

  const closePlayer = () => {
    setActiveMatch(null);
    setStreams([]);
    setStreamError(false);
    setPlayerTab('info');
    setComments([]);
    setCommentText('');
  };

  const getSectionMatches = (sectionId: string): SportMatch[] => {
    const raw = sectionId === 'live' ? liveMatches : (bySport[sectionId.toLowerCase()] ?? []);
    return raw.map(applyUpdate).filter(m => {
      // Drop cards that would render completely blank — no poster, no badges, no artwork
      const hasVisual =
        m.poster ||
        m.tsdb?.homeBadge ||
        m.tsdb?.awayBadge ||
        m.tsdb?.eventPoster ||
        m.tsdb?.leagueBanner ||
        m.teams?.home?.badge ||
        m.teams?.away?.badge;
      return !!hasVisual;
    });
  };

  // ── Player view ──────────────────────────────────────────────────────────

  if (activeMatch) {
    const cur = streams[streamIndex];
    const matchId = strHash(activeMatch.id);

    // Split title into team names for badge display
    const titleParts = activeMatch.title.split(/\s+vs\.?\s+/i);
    const teamA = titleParts[0]?.trim() ?? activeMatch.title;
    const teamB = titleParts.length >= 2 ? titleParts.slice(1).join(' vs ').trim() : '';

    const homeBadge  = activeMatch.tsdb?.homeBadge;
    const awayBadge  = activeMatch.tsdb?.awayBadge;
    const hasScore   = activeMatch.tsdb?.homeScore !== undefined && activeMatch.tsdb?.awayScore !== undefined;
    const leagueName = activeMatch.tsdb?.leagueName;
    const progress   = activeMatch.tsdb?.progress;

    // Strain pairing — use match title + action vibe
    const strainPairing = StrainDatabase.getPairingForMedia({
      id: matchId,
      title: activeMatch.title,
      genre_ids: [28], // action vibe for sports
    });
    const couchlockScore = strainPairing.couchlock_score || 90;

    const renderStrainCard = () => (
      <div className="bg-gradient-to-br from-emerald-950/80 via-[#0a140f] to-green-950/80 border border-emerald-500/30 p-3.5 sm:p-4 rounded-2xl space-y-2.5 shadow-lg">
        <div className="flex items-center justify-between flex-wrap gap-1">
          <div className="flex items-center gap-1.5">
            <Cannabis className="w-4 h-4 text-emerald-400 animate-pulse shrink-0" />
            <span className="text-[11px] font-black text-emerald-300 uppercase tracking-wider">
              Recommended Strain Pairing
            </span>
          </div>
          {strainPairing.chill_vibe && (
            <span className="text-[9px] font-bold text-emerald-300 bg-emerald-900/60 border border-emerald-500/30 px-2 py-0.5 rounded-full">
              ✨ {strainPairing.chill_vibe}
            </span>
          )}
        </div>
        <div className="bg-black/50 border border-emerald-500/20 p-2.5 rounded-xl space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-extrabold text-white">{strainPairing.strain_name}</span>
              {strainPairing.strain_type && (
                <span className="text-[9px] font-mono font-bold text-amber-300 bg-amber-950/80 border border-amber-500/40 px-1.5 py-0.5 rounded">
                  {strainPairing.strain_type}
                </span>
              )}
            </div>
            {strainPairing.thc && (
              <span className="text-[10px] font-black text-emerald-400 bg-emerald-950 border border-emerald-500/40 px-2 py-0.5 rounded-md">
                ⚡ {strainPairing.thc.includes('THC') ? strainPairing.thc : `${strainPairing.thc} THC`}
              </span>
            )}
          </div>
          <div className="space-y-1">
            <div className="flex justify-between items-center text-[9px] font-mono">
              <span className="text-zinc-400">Couchlock Synergy Match</span>
              <span className="text-amber-400 font-bold">{couchlockScore}%</span>
            </div>
            <div className="w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden border border-emerald-900/40">
              <div
                className="bg-gradient-to-r from-emerald-500 via-green-400 to-amber-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${couchlockScore}%` }}
              />
            </div>
          </div>
        </div>
        {(strainPairing.flavor || strainPairing.terpenes) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[10px]">
            {strainPairing.flavor && (
              <div className="bg-black/30 border border-emerald-900/40 p-2 rounded-lg">
                <span className="text-zinc-400 font-bold block text-[9px] uppercase">Flavor Profile</span>
                <span className="text-emerald-200 font-medium block truncate">🍓 {strainPairing.flavor}</span>
              </div>
            )}
            {strainPairing.terpenes && (
              <div className="bg-black/30 border border-emerald-900/40 p-2 rounded-lg">
                <span className="text-zinc-400 font-bold block text-[9px] uppercase">Terpene Spectrum</span>
                <span className="text-emerald-300 font-mono block truncate">🧪 {strainPairing.terpenes}</span>
              </div>
            )}
          </div>
        )}
        {strainPairing.sommelier_note && (
          <div className="bg-black/40 p-2.5 rounded-xl border border-emerald-500/15">
            <p className="text-[10px] text-zinc-300 leading-relaxed italic">"{strainPairing.sommelier_note}"</p>
          </div>
        )}
      </div>
    );

    const handleCommentSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!commentText.trim()) return;
      setSubmittingComment(true);
      const activeUsername = user?.username || (user?.email ? user.email.split('@')[0] : 'Stoned Streamer');
      const activeAvatar = user?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80';
      const result = await postComment({
        mediaId: matchId,
        mediaType: 'movie',
        text: commentText,
        username: activeUsername,
        userAvatar: activeAvatar,
      });
      if (result?.id) {
        setComments(prev => [result, ...prev]);
        setCommentText('');
        toast.success('Review posted 🌿', { duration: 2000 });
      } else {
        toast.error('Failed to post review. Try again.');
      }
      setSubmittingComment(false);
    };

    return (
      <div className="min-h-screen bg-[#060907]">
        <div className="mx-auto w-full max-w-[1920px] px-2 sm:px-6 lg:px-8 py-3 sm:py-6 pb-12 sm:pb-16">

          {/* ── Top Control Bar ─────────────────────────────────────────────── */}
          <div className="flex items-center gap-2 sm:gap-4 mb-3 sm:mb-4 bg-[#0d1310]/90 border border-emerald-500/30 p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl backdrop-blur-md">
            <button
              onClick={closePlayer}
              className="px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl bg-emerald-950/60 hover:bg-emerald-800/80 text-emerald-300 font-semibold text-[11px] sm:text-xs border border-emerald-500/40 transition-all shrink-0 cursor-pointer"
            >
              ← <span className="hidden xs:inline">Back to Sports</span><span className="xs:hidden">Back</span>
            </button>
            <div className="min-w-0 flex-1 flex items-center gap-2">
              {activeMatch.is_live && (
                <span className="flex items-center gap-1 text-[9px] font-bold text-rose-300 bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded-full uppercase shrink-0">
                  <Radio className="w-2.5 h-2.5 animate-pulse" /> Live
                </span>
              )}
              <h1 className="text-xs sm:text-base md:text-lg font-black text-white leading-tight truncate">
                {activeMatch.title}
              </h1>
              {leagueName && (
                <span className="shrink-0 text-emerald-400 font-mono text-[10px] sm:text-xs bg-emerald-500/20 px-1.5 sm:px-2 py-0.5 rounded border border-emerald-500/30 whitespace-nowrap hidden sm:inline">
                  {leagueName}
                </span>
              )}
            </div>
          </div>

          {/* ── Two-column grid (8 + 4) on desktop, stacked on mobile ────────── */}
          <div className="lg:grid lg:grid-cols-12 lg:gap-6 lg:items-start">

            {/* LEFT: video + switcher + tabs */}
            <div className="lg:col-span-8 space-y-4 min-w-0">

              {/* Stream switcher bar */}
              {streams.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Stream:</span>
                  {streams.map((s, i) => (
                    <button key={`${s.source}-${s.streamNo}`} onClick={() => setStreamIndex(i)}
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                        streamIndex === i
                          ? 'bg-emerald-500 text-black border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.4)]'
                          : 'bg-black/60 text-zinc-400 border-zinc-700 hover:border-emerald-500/60 hover:text-emerald-300'
                      }`}>
                      {s.language || `#${s.streamNo}`}{s.hd ? ' HD' : ''}
                    </button>
                  ))}
                </div>
              )}

              {/* Video container */}
              <div className="relative group z-40 w-full aspect-video bg-black rounded-xl sm:rounded-3xl overflow-hidden border border-emerald-500/30 shadow-[0_0_50px_rgba(16,185,129,0.2)]">
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
                  <StreamPlayer key={cur.embedUrl} url={cur.embedUrl} />
                )}
              </div>

              {/* ── Below-video Tabs panel ─────────────────────────────────── */}
              <div className="bg-[#0d1310] border border-emerald-500/20 rounded-2xl sm:rounded-3xl p-3.5 sm:p-6">
                {/* Tab bar */}
                <div className="flex items-center gap-2 sm:gap-4 border-b border-emerald-900/40 pb-3 sm:pb-4 mb-4 sm:mb-6 overflow-x-auto">
                  <button
                    onClick={() => setPlayerTab('info')}
                    className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl font-bold text-xs flex items-center gap-1.5 sm:gap-2 transition shrink-0 ${
                      playerTab === 'info'
                        ? 'bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Info className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Match Info
                  </button>
                  <button
                    onClick={() => {
                      setPlayerTab('comments');
                      fetchComments('movie', matchId).then(setComments);
                    }}
                    className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl font-bold text-xs flex items-center gap-1.5 sm:gap-2 transition shrink-0 ${
                      playerTab === 'comments'
                        ? 'bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Stash Community ({comments.length})
                  </button>
                </div>

                {/* Match Info tab */}
                {playerTab === 'info' && (
                  <div className="space-y-5">
                    {/* Team badges + score */}
                    <div className="flex items-center justify-center gap-4 sm:gap-8 py-4">
                      {/* Home team */}
                      <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
                        {homeBadge ? (
                          <img src={homeBadge} alt={teamA}
                            className="w-14 h-14 sm:w-20 sm:h-20 object-contain drop-shadow-lg"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        ) : (
                          <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center">
                            <Trophy className="w-7 h-7 text-emerald-500/50" />
                          </div>
                        )}
                        <span className="text-xs sm:text-sm font-black text-white text-center line-clamp-2 leading-tight">{teamA}</span>
                      </div>

                      {/* Score / VS */}
                      <div className="flex flex-col items-center gap-1 shrink-0">
                        {hasScore ? (
                          <>
                            <span className="text-2xl sm:text-4xl font-black text-white tabular-nums">
                              {activeMatch.tsdb!.homeScore} <span className="text-zinc-500">–</span> {activeMatch.tsdb!.awayScore}
                            </span>
                            {progress && (
                              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full uppercase tracking-wide">
                                {progress}
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            <span className="text-xl sm:text-2xl font-black text-zinc-500">VS</span>
                            {activeMatch.is_live && (
                              <span className="flex items-center gap-1 text-[9px] font-bold text-rose-300 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full uppercase">
                                <Radio className="w-2.5 h-2.5 animate-pulse" /> Live
                              </span>
                            )}
                          </>
                        )}
                      </div>

                      {/* Away team */}
                      <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
                        {awayBadge ? (
                          <img src={awayBadge} alt={teamB}
                            className="w-14 h-14 sm:w-20 sm:h-20 object-contain drop-shadow-lg"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        ) : (
                          <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center">
                            <Trophy className="w-7 h-7 text-emerald-500/50" />
                          </div>
                        )}
                        <span className="text-xs sm:text-sm font-black text-white text-center line-clamp-2 leading-tight">{teamB || activeMatch.title}</span>
                      </div>
                    </div>

                    {/* Meta row */}
                    <div className="flex flex-wrap items-center gap-2">
                      {leagueName && (
                        <span className="bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-xs px-3 py-1 rounded-full font-medium">
                          {leagueName}
                        </span>
                      )}
                      <span className="bg-zinc-900/60 border border-zinc-700/60 text-zinc-300 text-xs px-3 py-1 rounded-full font-medium capitalize">
                        {activeMatch.category}
                      </span>
                      {activeMatch.date > 0 && !activeMatch.is_live && (
                        <span className="bg-zinc-900/60 border border-zinc-700/60 text-zinc-400 text-xs px-3 py-1 rounded-full font-medium font-mono">
                          {new Date(activeMatch.date).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>

                    {/* Mobile-only strain card */}
                    <div className="lg:hidden">
                      {renderStrainCard()}
                    </div>
                  </div>
                )}

                {/* Comments tab */}
                {playerTab === 'comments' && (
                  <div className="space-y-6">
                    <form onSubmit={handleCommentSubmit} className="space-y-3 bg-black/40 border border-emerald-500/20 p-4 rounded-2xl">
                      <span className="text-xs font-bold text-white block">Join the Session Discussion:</span>
                      <textarea
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Share your thoughts on the match, strain pairing suggestions..."
                        className="w-full bg-[#070b08] border border-emerald-500/30 rounded-xl p-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-400 min-h-[80px]"
                      />
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={submittingComment || !commentText.trim()}
                          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs px-5 py-2.5 rounded-xl transition disabled:opacity-40 cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" /> {submittingComment ? 'Posting...' : 'Post Review'}
                        </button>
                      </div>
                    </form>
                    <div className="space-y-3">
                      {comments.map((c) => (
                        <div key={c.id} className="bg-[#090f0c] border border-emerald-950/80 p-3.5 sm:p-4 rounded-2xl space-y-2.5 overflow-hidden">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <img src={c.userAvatar} alt={c.username} className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover ring-1 ring-emerald-500/40 shrink-0" />
                              <span className="font-bold text-xs sm:text-sm text-white truncate">{c.username}</span>
                            </div>
                            <span className="text-[10px] sm:text-xs text-zinc-500 shrink-0">{new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed break-words whitespace-pre-wrap">{c.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT SIDEBAR — desktop only */}
            <div className="hidden lg:flex lg:flex-col lg:col-span-4 space-y-4 min-w-0 mt-0">

              {/* Match Panel */}
              <div className="bg-[#0c120e] border border-emerald-500/30 p-4 rounded-3xl shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-emerald-900/50 pb-3">
                  <div className="flex items-center gap-2">
                    {activeMatch.is_live && (
                      <span className="flex items-center gap-1 text-[9px] font-bold text-rose-300 bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded-full uppercase">
                        <Radio className="w-2.5 h-2.5 animate-pulse" /> Live
                      </span>
                    )}
                    {leagueName && <span className="text-xs font-bold text-emerald-300">{leagueName}</span>}
                  </div>
                  <span className="text-[10px] font-medium text-zinc-500 capitalize">{activeMatch.category}</span>
                </div>

                {/* Team badges + score — large sidebar version */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
                    {homeBadge ? (
                      <img src={homeBadge} alt={teamA}
                        className="w-16 h-16 object-contain drop-shadow-lg"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center">
                        <Trophy className="w-7 h-7 text-emerald-500/40" />
                      </div>
                    )}
                    <span className="text-[11px] font-black text-white text-center line-clamp-2 leading-tight">{teamA}</span>
                  </div>

                  <div className="flex flex-col items-center gap-1 shrink-0 px-1">
                    {hasScore ? (
                      <>
                        <span className="text-3xl font-black text-white tabular-nums leading-none">
                          {activeMatch.tsdb!.homeScore}
                        </span>
                        <span className="text-zinc-600 font-black text-sm">–</span>
                        <span className="text-3xl font-black text-white tabular-nums leading-none">
                          {activeMatch.tsdb!.awayScore}
                        </span>
                        {progress && (
                          <span className="text-[9px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full mt-1 uppercase tracking-wide">
                            {progress}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-lg font-black text-zinc-600">VS</span>
                    )}
                  </div>

                  <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
                    {awayBadge ? (
                      <img src={awayBadge} alt={teamB}
                        className="w-16 h-16 object-contain drop-shadow-lg"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center">
                        <Trophy className="w-7 h-7 text-emerald-500/40" />
                      </div>
                    )}
                    <span className="text-[11px] font-black text-white text-center line-clamp-2 leading-tight">{teamB || activeMatch.title}</span>
                  </div>
                </div>

                {/* Time if upcoming */}
                {activeMatch.date > 0 && !activeMatch.is_live && (
                  <div className="bg-black/40 border border-emerald-900/40 rounded-xl px-3 py-2 text-center">
                    <span className="text-[10px] text-zinc-500 font-semibold block uppercase tracking-wider mb-0.5">Starts</span>
                    <span className="text-xs font-mono font-bold text-emerald-300">
                      {new Date(activeMatch.date).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )}
              </div>

              {/* Strain Pairing Card */}
              {renderStrainCard()}
            </div>

          </div>
        </div>
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
