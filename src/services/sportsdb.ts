/**
 * TheSportsDB enrichment service  (free tier — no API key required)
 * Endpoint: https://www.thesportsdb.com/api/v1/json/3/
 *
 * Provides real-time livescores, team badges, league info and
 * match progress to enrich streamed.pk cards that have no visuals.
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
  strStatus?:       string | null;  // e.g. "BT" (before time), "HT", "FT"
  strTimestamp?:    string | null;  // ISO datetime e.g. "2026-09-06T18:00:00"
  strEventTime?:    string | null;  // e.g. "18:00"
  dateEvent?:       string | null;  // e.g. "2026-09-06"
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
  homeBadge?:  string;
  awayBadge?:  string;
  leagueName?: string;
  homeScore?:  number;
  awayScore?:  number;
  progress?:   string;   // game clock / inning / period
}

// ---------------------------------------------------------------------------
// In-memory session cache
// ---------------------------------------------------------------------------

let liveScoreCache: TSDBLiveScore[] | null = null;
let liveScoreFetchedAt = 0;
const LIVE_TTL = 60_000; // re-fetch livescores at most once per minute
const teamBadgeCache = new Map<string, string>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
}

/** True if two team name strings are close enough to be the same team */
function nameMatch(a: string, b: string): boolean {
  const na = norm(a);
  const nb = norm(b);
  return na === nb || na.includes(nb) || nb.includes(na);
}

/** Format raw progress string into a readable label */
export function fmtProgress(p: string | null | undefined): string {
  if (!p) return '';
  if (p === 'FT') return 'Full Time';
  if (p === 'HT') return 'Half Time';
  // Baseball: IN1 → 1st, IN9 → 9th etc.
  const inn = p.match(/^IN(\d+)$/);
  if (inn) {
    const n = Number(inn[1]);
    const sfx = n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th';
    return `${n}${sfx} Inning`;
  }
  // Soccer / Hockey minutes: "45'", "67'"
  if (p.endsWith("'")) return p;
  // Quarter / Period
  const qtr = p.match(/^Q(\d)$/i);
  if (qtr) return `Q${qtr[1]}`;
  const per = p.match(/^P(\d)$/i);
  if (per) return `Period ${per[1]}`;
  return p;
}

// ---------------------------------------------------------------------------
// API fetchers
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
    // Warm the badge cache from live data
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
// Public API
// ---------------------------------------------------------------------------

/**
 * Enrich matches using only the livescores endpoint (one fast request).
 * Team name search is intentionally omitted — it fires 200+ requests for
 * college teams that aren't in TSDB anyway, causing the slowness.
 * Matches not found in livescores get the generated VS card instantly.
 */
export async function buildEnrichmentMap(
  matches: Array<{ id: string; title: string; teams?: { home?: { name: string }; away?: { name: string } } }>,
  onUpdate?: (id: string, enrichment: MatchEnrichment) => void
): Promise<Map<string, MatchEnrichment>> {
  const result = new Map<string, MatchEnrichment>();
  if (!matches.length) return result;

  // Single request — covers all professional/major-league live matches
  const live = await fetchLiveScores();

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
    }
    // No match in livescores = college/unknown team → generated VS card, no extra requests
  }

  return result;
}

// ---------------------------------------------------------------------------
// Helper — extract home/away names from a match (title "X vs Y" or teams obj)
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
