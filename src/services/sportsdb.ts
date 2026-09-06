/**
 * TheSportsDB enrichment service  (free tier — no API key required)
 * Endpoint: https://www.thesportsdb.com/api/v1/json/3/
 *
 * Strategy:
 *  1. Livescores endpoint — one request, covers everything currently in play.
 *     Badges + scores arrive immediately for live matches.
 *  2. Team search endpoint — /searchteams.php?t=Name — used progressively for
 *     upcoming matches whose teams aren't in livescores.  Requests are queued,
 *     rate-limited and cached so the page loads instantly and badges pop in.
 */

const TSDB = 'https://www.thesportsdb.com/api/v1/json/3';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TSDBLiveScore {
  idEvent:          string;
  idHomeTeam:       string;
  idAwayTeam:       string;
  strHomeTeam:      string;
  strAwayTeam:      string;
  strSport:         string;
  strLeague:        string;
  intHomeScore:     string | null;
  intAwayScore:     string | null;
  strProgress:      string | null;  // e.g. "IN9", "45'", "HT", "FT"
  strStatus?:       string | null;
  strTimestamp?:    string | null;
  strEventTime?:    string | null;
  dateEvent?:       string | null;
  strHomeTeamBadge: string;
  strAwayTeamBadge: string;
}

export interface TSDBTeam {
  idTeam:   string;
  strTeam:  string;
  strBadge: string;
  strLeague: string;
  strSport:  string;
}

export interface MatchEnrichment {
  homeBadge?:   string;
  awayBadge?:   string;
  leagueName?:  string;
  homeScore?:   number;
  awayScore?:   number;
  progress?:    string;
  eventPoster?: string;  // TSDB event thumbnail — used for single-name events (UFC, NASCAR)
}

// ---------------------------------------------------------------------------
// In-memory caches
// ---------------------------------------------------------------------------

let liveScoreCache: TSDBLiveScore[] | null = null;
let liveScoreFetchedAt = 0;
const LIVE_TTL = 60_000;

// Persistent badge cache: normalised team name → badge URL (or '' = not found)
const teamBadgeCache = new Map<string, string>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
}

function nameMatch(a: string, b: string): boolean {
  const na = norm(a);
  const nb = norm(b);
  return na === nb || na.includes(nb) || nb.includes(na);
}

export function fmtProgress(p: string | null | undefined): string {
  if (!p) return '';
  if (p === 'FT') return 'Full Time';
  if (p === 'HT') return 'Half Time';
  const inn = p.match(/^IN(\d+)$/);
  if (inn) {
    const n = Number(inn[1]);
    const sfx = n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th';
    return `${n}${sfx} Inning`;
  }
  if (p.endsWith("'")) return p;
  const qtr = p.match(/^Q(\d)$/i);
  if (qtr) return `Q${qtr[1]}`;
  const per = p.match(/^P(\d)$/i);
  if (per) return `Period ${per[1]}`;
  return p;
}

// ---------------------------------------------------------------------------
// Livescores fetch (cached 60 s)
// ---------------------------------------------------------------------------

async function fetchLiveScores(): Promise<TSDBLiveScore[]> {
  const now = Date.now();
  if (liveScoreCache && now - liveScoreFetchedAt < LIVE_TTL) return liveScoreCache;
  try {
    const res = await fetch(`${TSDB}/livescore.php`);
    if (!res.ok) return liveScoreCache ?? [];
    const json = await res.json() as { livescore: TSDBLiveScore[] | null };
    liveScoreCache = json.livescore ?? [];
    liveScoreFetchedAt = now;
    for (const ev of liveScoreCache) {
      if (ev.strHomeTeam && ev.strHomeTeamBadge) teamBadgeCache.set(norm(ev.strHomeTeam), ev.strHomeTeamBadge);
      if (ev.strAwayTeam && ev.strAwayTeamBadge) teamBadgeCache.set(norm(ev.strAwayTeam), ev.strAwayTeamBadge);
    }
    return liveScoreCache;
  } catch {
    return liveScoreCache ?? [];
  }
}

// ---------------------------------------------------------------------------
// Rate-limited fetch queue (shared by team search + event search)
// ---------------------------------------------------------------------------

// In-flight promise dedup: normalised name → promise resolving to badge URL | ''
const inFlight = new Map<string, Promise<string>>();

// Simple queue: max 3 concurrent requests, 120 ms gap between dispatches
let activeRequests = 0;
const MAX_CONCURRENT = 3;
const REQUEST_GAP_MS = 120;
let lastDispatch = 0;

async function fetchTeamBadge(teamName: string): Promise<string> {
  const key = norm(teamName);
  if (!key) return '';

  // Already cached (including negative results)
  if (teamBadgeCache.has(key)) return teamBadgeCache.get(key)!;

  // Deduplicate concurrent requests for the same team
  if (inFlight.has(key)) return inFlight.get(key)!;

  const promise = (async (): Promise<string> => {
    // Wait until we're under the concurrency limit and past the rate gap
    while (activeRequests >= MAX_CONCURRENT) {
      await new Promise(r => setTimeout(r, 50));
    }
    const now = Date.now();
    const wait = lastDispatch + REQUEST_GAP_MS - now;
    if (wait > 0) await new Promise(r => setTimeout(r, wait));

    activeRequests++;
    lastDispatch = Date.now();
    try {
      const res = await fetch(`${TSDB}/searchteams.php?t=${encodeURIComponent(teamName)}`);
      if (!res.ok) { teamBadgeCache.set(key, ''); return ''; }
      const json = await res.json() as { teams: TSDBTeam[] | null };
      const teams = json.teams ?? [];
      const exact = teams.find(t => norm(t.strTeam) === key);
      const fuzzy = exact ?? teams.find(t => nameMatch(t.strTeam, teamName));
      const badge = fuzzy?.strBadge ?? '';
      teamBadgeCache.set(key, badge);
      return badge;
    } catch {
      teamBadgeCache.set(key, '');
      return '';
    } finally {
      activeRequests--;
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, promise);
  return promise;
}

// ---------------------------------------------------------------------------
// Event poster lookup — for single-name events (UFC cards, NASCAR races etc.)
// ---------------------------------------------------------------------------

interface TSDBEvent {
  idEvent:    string;
  strEvent:   string;
  strThumb?:  string;
  strBanner?: string;
  strPoster?: string;
}

const eventPosterCache = new Map<string, string>(); // normalised title → poster URL | ''

async function fetchEventPoster(title: string): Promise<string> {
  const key = norm(title);
  if (!key) return '';
  if (eventPosterCache.has(key)) return eventPosterCache.get(key)!;

  const promise = (async (): Promise<string> => {
    while (activeRequests >= MAX_CONCURRENT) {
      await new Promise(r => setTimeout(r, 50));
    }
    const now = Date.now();
    const wait = lastDispatch + REQUEST_GAP_MS - now;
    if (wait > 0) await new Promise(r => setTimeout(r, wait));

    activeRequests++;
    lastDispatch = Date.now();
    try {
      const res = await fetch(`${TSDB}/searchevents.php?e=${encodeURIComponent(title)}`);
      if (!res.ok) { eventPosterCache.set(key, ''); return ''; }
      const json = await res.json() as { event: TSDBEvent[] | null };
      const events = json.event ?? [];
      const exact  = events.find(e => norm(e.strEvent) === key);
      const fuzzy  = exact ?? events.find(e => nameMatch(e.strEvent, title));
      const poster = fuzzy?.strThumb || fuzzy?.strBanner || fuzzy?.strPoster || '';
      eventPosterCache.set(key, poster);
      return poster;
    } catch {
      eventPosterCache.set(key, '');
      return '';
    } finally {
      activeRequests--;
    }
  })();

  // Don't use inFlight for events — keys are long and rarely duplicated
  return promise;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build an enrichment map for the given matches.
 *
 * Phase 1 (synchronous-ish): match against TSDB livescores — instant for live games.
 * Phase 2 (progressive): for any match not found in livescores, look up each team
 *   name via /searchteams.php and call onUpdate as badges arrive, so the UI can
 *   progressively re-render cards without blocking the initial paint.
 */
export async function buildEnrichmentMap(
  matches: Array<{ id: string; title: string; teams?: { home?: { name: string }; away?: { name: string } } }>,
  onUpdate?: (id: string, enrichment: MatchEnrichment) => void
): Promise<Map<string, MatchEnrichment>> {
  const result = new Map<string, MatchEnrichment>();
  if (!matches.length) return result;

  // ── Phase 1: livescores (one request, covers all in-play matches) ──────────
  const live = await fetchLiveScores();

  const unmatched: typeof matches = [];

  for (const match of matches) {
    const [homeRaw, awayRaw] = getTeamNames(match);
    if (!homeRaw && !awayRaw) continue;

    const liveMatch = live.find(ev =>
      (nameMatch(ev.strHomeTeam, homeRaw) || nameMatch(ev.strAwayTeam, homeRaw)) &&
      (nameMatch(ev.strHomeTeam, awayRaw) || nameMatch(ev.strAwayTeam, awayRaw))
    );

    if (liveMatch) {
      const enrichment: MatchEnrichment = {
        homeBadge:  liveMatch.strHomeTeamBadge || undefined,
        awayBadge:  liveMatch.strAwayTeamBadge || undefined,
        leagueName: liveMatch.strLeague || undefined,
        homeScore:  liveMatch.intHomeScore != null ? Number(liveMatch.intHomeScore) : undefined,
        awayScore:  liveMatch.intAwayScore != null ? Number(liveMatch.intAwayScore) : undefined,
        progress:   fmtProgress(liveMatch.strProgress),
      };
      result.set(match.id, enrichment);
      onUpdate?.(match.id, enrichment);
    } else {
      unmatched.push(match);
    }
  }

  // ── Phase 2: progressive team-search for upcoming matches ─────────────────
  // Fire-and-forget — resolves via onUpdate callbacks so the caller doesn't wait
  if (onUpdate && unmatched.length > 0) {
    (async () => {
      // Check cache first — many teams will already be known from a prior load
      const needFetch: typeof matches = [];
      for (const match of unmatched) {
        const [homeRaw, awayRaw] = getTeamNames(match);
        const homeCached = teamBadgeCache.get(norm(homeRaw));
        const awayCached = teamBadgeCache.get(norm(awayRaw));
        if (homeCached !== undefined && awayCached !== undefined) {
          // Both already in cache — emit immediately
          if (homeCached || awayCached) {
            onUpdate(match.id, {
              homeBadge: homeCached || undefined,
              awayBadge: awayCached || undefined,
            });
          }
        } else {
          needFetch.push(match);
        }
      }

      // For the rest, fetch concurrently (rate-limited inside fetchTeamBadge)
      await Promise.all(needFetch.map(async match => {
        const [homeRaw, awayRaw] = getTeamNames(match);
        const isVsMatch = !!awayRaw; // has an opponent

        if (isVsMatch) {
          // Normal team vs team — search both sides
          const [homeBadge, awayBadge] = await Promise.all([
            fetchTeamBadge(homeRaw),
            fetchTeamBadge(awayRaw),
          ]);
          if (homeBadge || awayBadge) {
            onUpdate(match.id, {
              homeBadge: homeBadge || undefined,
              awayBadge: awayBadge || undefined,
            });
          }
        } else if (match.title) {
          // Single-name event (UFC card, NASCAR race, etc.) — search by event title
          const poster = await fetchEventPoster(match.title);
          if (poster) {
            onUpdate(match.id, { eventPoster: poster });
          }
        }
      }));
    })();
  }

  return result;
}

// ---------------------------------------------------------------------------
// Helper — extract home/away names from a match
// ---------------------------------------------------------------------------

function getTeamNames(match: {
  title?: string;
  teams?: { home?: { name: string }; away?: { name: string } }
}): [string, string] {
  if (match.teams?.home?.name && match.teams?.away?.name) {
    return [match.teams.home.name, match.teams.away.name];
  }
  if (!match.title) return ['', ''];
  const parts = match.title.split(/\s+vs\.?\s+/i);
  if (parts.length >= 2) return [parts[0].trim(), parts.slice(1).join(' vs ').trim()];
  return [match.title, ''];
}
