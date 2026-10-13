/**
 * TheSportsDB enrichment service  (free tier — no API key required)
 * Endpoint: https://www.thesportsdb.com/api/v1/json/3/
 *
 * Strategy:
 *  1. Livescores endpoint — one request, covers everything currently in play.
 *  2. Team search — /searchteams.php?t=Name — for "A vs B" matches not in livescores.
 *  3. Event search — /searchevents.php?e=Title — for single-name events (UFC, NASCAR).
 *     Tries multiple cleaned-up title variants to maximise hit rate.
 *  4. League banner fallback — /search_all_leagues.php?s=LeagueName — last resort,
 *     gives every card at least the league logo.
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
  strProgress:      string | null;
  strStatus?:       string | null;
  strTimestamp?:    string | null;
  strEventTime?:    string | null;
  dateEvent?:       string | null;
  strHomeTeamBadge: string;
  strAwayTeamBadge: string;
}

export interface TSDBTeam {
  idTeam:    string;
  strTeam:   string;
  strBadge:  string;
  strLeague: string;
  strSport:  string;
}

export interface MatchEnrichment {
  homeBadge?:    string;
  awayBadge?:    string;
  leagueName?:   string;
  leagueBanner?: string; // league logo/banner used as last-resort card image
  homeScore?:    number;
  awayScore?:    number;
  progress?:     string;
  eventPoster?:  string; // TSDB event thumbnail for single-name events
}

// ---------------------------------------------------------------------------
// In-memory caches
// ---------------------------------------------------------------------------

let liveScoreCache: TSDBLiveScore[] | null = null;
let liveScoreFetchedAt = 0;
const LIVE_TTL = 60_000;

let finishedPairsCache: Set<string> | null = null;
let finishedPairsFetchedAt = 0;
const FINISHED_TTL = 120_000; // re-check every 2 minutes

const teamBadgeCache   = new Map<string, string>(); // norm(name)     → badge URL | ''
const eventPosterCache = new Map<string, string>(); // norm(title)    → poster URL | ''
const leagueBannerCache = new Map<string, string>(); // norm(category) → banner URL | ''

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

/**
 * Generate search query variants for a single-name event title.
 * streamed.pk uses patterns like:
 *   "IndyCar 2026 - IndyCar Grand Prix of Monterey"
 *   "Nascar Cup Series 2026 - Coke Zero Sugar 400"
 *   "LFC 63: Legacy Fighting Championship 63"
 *   "Dana White's Contender Series: Season 10, Week 5"
 * We strip years, league prefixes and generate multiple shorter forms.
 */
function eventSearchVariants(title: string): string[] {
  const variants = new Set<string>();
  variants.add(title);

  // Strip year (standalone 4-digit year like 2026)
  const noYear = title.replace(/\b20\d{2}\b/g, '').replace(/\s{2,}/g, ' ').trim();
  if (noYear !== title) variants.add(noYear);

  // If title contains " - " take the part after the dash (the actual event name)
  const dashIdx = title.indexOf(' - ');
  if (dashIdx !== -1) {
    const afterDash = title.slice(dashIdx + 3).trim();
    variants.add(afterDash);
    // Also strip year from that
    const afterDashNoYear = afterDash.replace(/\b20\d{2}\b/g, '').replace(/\s{2,}/g, ' ').trim();
    if (afterDashNoYear !== afterDash) variants.add(afterDashNoYear);
  }

  // If title contains ": " take the part after the colon
  const colonIdx = title.indexOf(': ');
  if (colonIdx !== -1) {
    const afterColon = title.slice(colonIdx + 2).trim();
    variants.add(afterColon);
  }

  // Strip season/week suffixes for series events
  const noSeason = title.replace(/:\s*season\s+\d+.*$/i, '').trim();
  if (noSeason !== title) variants.add(noSeason);

  return [...variants].filter(v => v.length > 2);
}

// ---------------------------------------------------------------------------
// Rate-limited queue (shared by all TSDB requests)
// ---------------------------------------------------------------------------

let activeRequests = 0;
const MAX_CONCURRENT = 2;
const REQUEST_GAP_MS = 300;
let lastDispatch = 0;

async function throttle(): Promise<void> {
  while (activeRequests >= MAX_CONCURRENT) {
    await new Promise(r => setTimeout(r, 50));
  }
  const wait = lastDispatch + REQUEST_GAP_MS - Date.now();
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  activeRequests++;
  lastDispatch = Date.now();
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
// Today's finished matches — used to drop ended games from the upcoming list
// ---------------------------------------------------------------------------

interface TSDBDayEvent {
  strHomeTeam?: string;
  strAwayTeam?: string;
  strStatus?:   string; // "Match Finished", "Not Started", "1H", "2H", etc.
  strProgress?: string; // "FT", "HT", etc.
}

/**
 * Returns a Set of normalised "home|away" pair strings for every match that
 * TSDB reports as finished today.  Also includes the reverse "away|home" pair
 * so lookups work regardless of which team streamed.pk calls "home".
 * Cached for FINISHED_TTL (2 min) to avoid hammering the API.
 */
export async function fetchTodayFinishedPairs(): Promise<Set<string>> {
  const now = Date.now();
  if (finishedPairsCache && now - finishedPairsFetchedAt < FINISHED_TTL) {
    return finishedPairsCache;
  }

  const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  try {
    const res = await fetch(`${TSDB}/eventsday.php?d=${today}`);
    if (!res.ok) return finishedPairsCache ?? new Set();
    const json = await res.json() as { events: TSDBDayEvent[] | null };
    const events = json.events ?? [];

    const pairs = new Set<string>();
    const FINISHED_STATUSES = /finished|ft|full.?time|ended|complete/i;

    for (const ev of events) {
      const statusFinished =
        (ev.strStatus   && FINISHED_STATUSES.test(ev.strStatus))  ||
        (ev.strProgress && FINISHED_STATUSES.test(ev.strProgress));
      if (!statusFinished) continue;
      if (!ev.strHomeTeam || !ev.strAwayTeam) continue;
      const h = norm(ev.strHomeTeam);
      const a = norm(ev.strAwayTeam);
      pairs.add(`${h}|${a}`);
      pairs.add(`${a}|${h}`); // streamed.pk may swap home/away
    }

    finishedPairsCache = pairs;
    finishedPairsFetchedAt = now;
    return pairs;
  } catch {
    return finishedPairsCache ?? new Set();
  }
}

// ---------------------------------------------------------------------------
// Team badge lookup
// ---------------------------------------------------------------------------

const inFlight = new Map<string, Promise<string>>();

async function fetchTeamBadge(teamName: string): Promise<string> {
  const key = norm(teamName);
  if (!key) return '';
  if (teamBadgeCache.has(key)) return teamBadgeCache.get(key)!;
  if (inFlight.has(key)) return inFlight.get(key)!;

  const promise = (async (): Promise<string> => {
    await throttle();
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
// Event poster lookup — tries multiple title variants
// ---------------------------------------------------------------------------

interface TSDBEvent {
  idEvent:    string;
  strEvent:   string;
  strThumb?:  string;
  strBanner?: string;
  strPoster?: string;
}

async function fetchEventPoster(title: string): Promise<string> {
  const key = norm(title);
  if (!key) return '';
  if (eventPosterCache.has(key)) return eventPosterCache.get(key)!;

  const variants = eventSearchVariants(title);

  for (const variant of variants) {
    const vkey = norm(variant);
    if (eventPosterCache.has(vkey)) {
      const cached = eventPosterCache.get(vkey)!;
      eventPosterCache.set(key, cached);
      return cached;
    }

    await throttle();
    try {
      const res = await fetch(`${TSDB}/searchevents.php?e=${encodeURIComponent(variant)}`);
      activeRequests--;
      if (!res.ok) continue;
      const json = await res.json() as { event: TSDBEvent[] | null };
      const events = json.event ?? [];
      const exact = events.find(e => norm(e.strEvent) === vkey);
      const fuzzy = exact ?? events.find(e => nameMatch(e.strEvent, variant));
      const poster = fuzzy?.strThumb || fuzzy?.strBanner || fuzzy?.strPoster || '';
      eventPosterCache.set(vkey, poster);
      if (poster) {
        eventPosterCache.set(key, poster);
        return poster;
      }
    } catch {
      activeRequests--;
    }
  }

  eventPosterCache.set(key, '');
  return '';
}

// ---------------------------------------------------------------------------
// League banner fallback
// ---------------------------------------------------------------------------

interface TSDBLeague {
  idLeague:     string;
  strLeague:    string;
  strBadge?:    string;
  strBanner?:   string;
  strLogo?:     string;
  strPoster?:   string;
  strFanart1?:  string;
}

async function fetchLeagueBanner(category: string): Promise<string> {
  const key = norm(category);
  if (!key) return '';
  if (leagueBannerCache.has(key)) return leagueBannerCache.get(key)!;

  await throttle();
  try {
    const res = await fetch(`${TSDB}/search_all_leagues.php?s=${encodeURIComponent(category)}`);
    activeRequests--;
    if (!res.ok) { leagueBannerCache.set(key, ''); return ''; }
    const json = await res.json() as { countrys: TSDBLeague[] | null };
    const leagues = json.countrys ?? [];
    // Prefer exact sport match, then any
    const exact = leagues.find(l => norm(l.strLeague) === key);
    const pick  = exact ?? leagues[0];
    const banner = pick?.strBanner || pick?.strBadge || pick?.strLogo || pick?.strPoster || pick?.strFanart1 || '';
    leagueBannerCache.set(key, banner);
    return banner;
  } catch {
    activeRequests--;
    leagueBannerCache.set(key, '');
    return '';
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function buildEnrichmentMap(
  matches: Array<{ id: string; title: string; category?: string; teams?: { home?: { name: string }; away?: { name: string } } }>,
  onUpdate?: (id: string, enrichment: MatchEnrichment) => void
): Promise<Map<string, MatchEnrichment>> {
  const result = new Map<string, MatchEnrichment>();
  if (!matches.length) return result;

  // ── Phase 1: livescores ───────────────────────────────────────────────────
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

  // ── Phase 2: progressive lookups (fire-and-forget) ────────────────────────
  if (onUpdate && unmatched.length > 0) {
    (async () => {
      // Pre-fetch one league banner per unique category (deduplicated).
      // This avoids N requests for the same category when many matches share it.
      const uniqueCategories = [...new Set(
        unmatched.map(m => m.category).filter((c): c is string => !!c)
      )];
      await Promise.all(uniqueCategories.map(cat => fetchLeagueBanner(cat)));

      // Emit from cache immediately for known teams
      const needFetch: typeof matches = [];
      for (const match of unmatched) {
        const [homeRaw, awayRaw] = getTeamNames(match);
        const isVs = !!awayRaw;
        if (isVs) {
          const hc = teamBadgeCache.get(norm(homeRaw));
          const ac = teamBadgeCache.get(norm(awayRaw));
          if (hc !== undefined && ac !== undefined) {
            onUpdate(match.id, { homeBadge: hc || undefined, awayBadge: ac || undefined });
          }
        }
        needFetch.push(match);
      }

      // Only fetch team badges for team-vs-team matches.
      // Single-name events (racing, MMA, boxing) skip fetchEventPoster — ESPN's
      // buildESPNImageMap covers those with higher-quality images and no rate limit.
      await Promise.all(needFetch.map(async match => {
        const [homeRaw, awayRaw] = getTeamNames(match);
        const isVs = !!awayRaw;
        const leagueBanner = match.category
          ? leagueBannerCache.get(norm(match.category)) || undefined
          : undefined;

        if (isVs) {
          const [homeBadge, awayBadge] = await Promise.all([
            fetchTeamBadge(homeRaw),
            fetchTeamBadge(awayRaw),
          ]);
          onUpdate(match.id, {
            homeBadge:    homeBadge    || undefined,
            awayBadge:    awayBadge    || undefined,
            leagueBanner,
          });
        } else {
          // Single-name event — just emit the league banner from cache.
          // ESPN handles event posters; no searchevents.php call needed.
          if (leagueBanner) {
            onUpdate(match.id, { leagueBanner });
          }
        }
      }));
    })();
  }

  return result;
}

// ---------------------------------------------------------------------------
// Helper — extract home/away names
// ---------------------------------------------------------------------------

function getTeamNames(match: {
  title?: string;
  teams?: { home?: { name: string }; away?: { name: string } }
}): [string, string] {
  if (match.teams?.home?.name && match.teams?.away?.name) {
    return [match.teams.home.name, match.teams.away.name];
  }
  if (!match.title) return ['', ''];
  // "vs" separator — canonical format ("Patriots vs Cowboys")
  const vsParts = match.title.split(/\s+vs\.?\s+/i);
  if (vsParts.length >= 2) return [vsParts[0].trim(), vsParts.slice(1).join(' vs ').trim()];
  // " - " separator — also used by streamed.pk for team matches
  // ("Detroit Lions - New Orleans Saints") but NOT for race/event titles
  // ("Moto2 2026 - Gran Premio di San Marino"). Heuristic: treat as a
  // team-vs-team match only when neither part contains a standalone year (20XX).
  const dashIdx = match.title.indexOf(' - ');
  if (dashIdx !== -1) {
    const left  = match.title.slice(0, dashIdx).trim();
    const right = match.title.slice(dashIdx + 3).trim();
    if (left && right && !/\b20\d{2}\b/.test(left) && !/\b20\d{2}\b/.test(right)) {
      return [left, right];
    }
  }
  return [match.title, ''];
}
