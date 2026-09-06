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

const teamBadgeCache = new Map<string, string>(); // normalised name → badge URL

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

async function fetchTeamBadge(teamName: string): Promise<string | null> {
  const key = norm(teamName);
  if (teamBadgeCache.has(key)) return teamBadgeCache.get(key) ?? null;
  try {
    const res = await fetch(`${TSDB}/searchteams.php?t=${encodeURIComponent(teamName)}`);
    if (!res.ok) return null;
    const json = await res.json() as { teams: TSDBTeam[] | null };
    const team = (json.teams ?? []).find(t => nameMatch(t.strTeam, teamName)) ?? json.teams?.[0];
    const badge = team?.strBadge ?? null;
    teamBadgeCache.set(key, badge ?? '');
    return badge;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build enrichment for all matches, calling onUpdate incrementally so the UI
 * can render badges as they arrive rather than waiting for all requests.
 *
 * Strategy:
 *  1. Fire livescores fetch immediately (one request, covers many matches)
 *  2. For every team not covered by livescores, fire ALL badge searches in
 *     parallel — no sequential batching. TSDB free tier handles it fine.
 *  3. As each per-match pair resolves, call onUpdate so the card re-renders.
 */
export async function buildEnrichmentMap(
  matches: Array<{ id: string; title: string; teams?: { home?: { name: string }; away?: { name: string } } }>,
  onUpdate?: (id: string, enrichment: MatchEnrichment) => void
): Promise<Map<string, MatchEnrichment>> {
  const result = new Map<string, MatchEnrichment>();
  if (!matches.length) return result;

  // Step 1 — livescores (one request, instant for covered leagues)
  const live = await fetchLiveScores();

  // Separate matches into livescore-matched vs needing team search
  const needsSearch: Array<{ id: string; homeRaw: string; awayRaw: string }> = [];

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
      needsSearch.push({ id: match.id, homeRaw, awayRaw });
    }
  }

  // Step 2 — collect unique team names not already cached
  const uniqueTeams = new Set<string>();
  for (const { homeRaw, awayRaw } of needsSearch) {
    if (homeRaw && !teamBadgeCache.has(norm(homeRaw))) uniqueTeams.add(homeRaw);
    if (awayRaw && !teamBadgeCache.has(norm(awayRaw))) uniqueTeams.add(awayRaw);
  }

  // Step 3 — fire ALL team searches in parallel (no sequential batching)
  await Promise.allSettled(Array.from(uniqueTeams).map(fetchTeamBadge));

  // Step 4 — second pass: resolve badge-only enrichment and call onUpdate per match
  for (const { id, homeRaw, awayRaw } of needsSearch) {
    const homeBadge = homeRaw ? (teamBadgeCache.get(norm(homeRaw)) || undefined) : undefined;
    const awayBadge = awayRaw ? (teamBadgeCache.get(norm(awayRaw)) || undefined) : undefined;
    if (homeBadge || awayBadge) {
      const enrichment: MatchEnrichment = { homeBadge, awayBadge };
      result.set(id, enrichment);
      onUpdate?.(id, enrichment);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Helper — extract home/away names from a match (title "X vs Y" or teams obj)
// ---------------------------------------------------------------------------

function getTeamNames(match: {
  title: string;
  teams?: { home?: { name: string }; away?: { name: string } }
}): [string, string] {
  if (match.teams?.home?.name && match.teams?.away?.name) {
    return [match.teams.home.name, match.teams.away.name];
  }
  const parts = match.title.split(/\s+vs\.?\s+/i);
  if (parts.length >= 2) return [parts[0].trim(), parts.slice(1).join(' vs ').trim()];
  return [match.title, ''];
}
