/**
 * ESPN / MLB / NHL finished-match detection
 *
 * Each scoreboard API returns today's games with a status field.
 * We extract every game that is confirmed "final/finished" and return
 * them as a Set of normalised "home|away" pair strings — the same
 * format used by fetchTodayFinishedPairs() in sportsdb.ts.
 *
 * The two sets are merged in SportsView so any match confirmed finished
 * by either source is dropped from the live list.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
}

function addPair(pairs: Set<string>, home: string, away: string) {
  const h = norm(home);
  const a = norm(away);
  if (!h || !a) return;
  pairs.add(`${h}|${a}`);
  pairs.add(`${a}|${h}`); // streamed.pk may swap home/away
}

// ---------------------------------------------------------------------------
// In-memory caches (60 s TTL — same as TSDB live scores)
// ---------------------------------------------------------------------------

interface FinishedSets {
  pairs:  Set<string>; // normalised "home|away" for team-vs-team matches
  titles: Set<string>; // normalised event title for single-name events (racing, MMA)
}

let espnCache:  FinishedSets | null = null;
let mlbCache:   Set<string>  | null = null;
let nhlCache:   Set<string>  | null = null;

let espnFetchedAt = 0;
let mlbFetchedAt  = 0;
let nhlFetchedAt  = 0;

const TTL = 60_000;

// ---------------------------------------------------------------------------
// ESPN — covers American Football, Basketball, Soccer, MMA, Racing
// ---------------------------------------------------------------------------

const ESPN_SLUGS = [
  // American Football
  'football/nfl',
  'football/college-football',         // NCAA football (all FBS games)

  // Basketball
  'basketball/nba',
  'basketball/mens-college-basketball',   // NCAA men's
  'basketball/womens-college-basketball', // NCAA women's

  // Soccer / Football — major leagues
  'soccer/usa.1',          // MLS
  'soccer/eng.1',          // Premier League
  'soccer/eng.2',          // Championship
  'soccer/uefa.champions', // Champions League
  'soccer/uefa.europa',    // Europa League
  'soccer/esp.1',          // LaLiga
  'soccer/ita.1',          // Serie A
  'soccer/ger.1',          // Bundesliga
  'soccer/fra.1',          // Ligue 1
  'soccer/mex.1',          // Liga MX
  'soccer/ned.1',          // Eredivisie
  'soccer/por.1',          // Primeira Liga
  'soccer/bra.1',          // Brasileirão
  'soccer/conmebol.libertadores', // Copa Libertadores
  'soccer/fifa.world',     // World Cup (when active)

  // MMA / Fighting
  'mma/ufc',               // UFC events
  'mma/bellator',          // Bellator
  'boxing/professional',   // Professional boxing

  // Motorsport
  'racing/f1',             // Formula 1
  'racing/nascar-cup-series',     // NASCAR Cup Series
  'racing/nascar-xfinity-series', // NASCAR Xfinity
  'racing/nascar-camping-world-truck-series', // NASCAR Trucks
  'racing/indycar',        // IndyCar

  // Other
  'baseball/mlb',          // MLB via ESPN as fallback
  'hockey/nhl',            // NHL via ESPN as fallback
];

interface ESPNCompetitor {
  homeAway: 'home' | 'away';
  team: { displayName: string };
}

interface ESPNEvent {
  name?: string;       // full event name, e.g. "NASCAR Cup Series at Daytona"
  shortName?: string;  // abbreviated name
  competitions: Array<{
    competitors: ESPNCompetitor[];
    status: {
      type: {
        name: string; // "STATUS_FINAL", "STATUS_IN_PROGRESS", "STATUS_SCHEDULED", etc.
      };
    };
  }>;
}

interface ESPNScoreboard {
  events?: ESPNEvent[];
}

async function fetchESPNSlug(slug: string): Promise<FinishedSets> {
  const pairs  = new Set<string>();
  const titles = new Set<string>();
  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/${slug}/scoreboard`,
      // User-Agent is required — ESPN blocks requests without it
      { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return { pairs, titles };
    const data = await res.json() as ESPNScoreboard;
    for (const event of data.events ?? []) {
      for (const comp of event.competitions ?? []) {
        if (!comp.status?.type?.name?.includes('FINAL')) continue;

        const home = comp.competitors.find(c => c.homeAway === 'home')?.team.displayName ?? '';
        const away = comp.competitors.find(c => c.homeAway === 'away')?.team.displayName ?? '';

        if (home && away) {
          // Team-vs-team event (football, basketball, soccer, etc.)
          addPair(pairs, home, away);
        } else {
          // Single-name event (racing, MMA, boxing) — match by event title
          if (event.name)      titles.add(norm(event.name));
          if (event.shortName) titles.add(norm(event.shortName));
        }
      }
    }
  } catch { /* ignore network errors */ }
  return { pairs, titles };
}

async function fetchESPNFinished(): Promise<FinishedSets> {
  const now = Date.now();
  if (espnCache && now - espnFetchedAt < TTL) return espnCache;

  const results = await Promise.allSettled(ESPN_SLUGS.map(fetchESPNSlug));
  const merged: FinishedSets = { pairs: new Set(), titles: new Set() };
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    r.value.pairs.forEach(p  => merged.pairs.add(p));
    r.value.titles.forEach(t => merged.titles.add(t));
  }

  espnCache = merged;
  espnFetchedAt = now;
  return merged;
}

// ---------------------------------------------------------------------------
// MLB Stats API
// ---------------------------------------------------------------------------

interface MLBTeam {
  team: { name: string };
}

interface MLBGame {
  teams: { home: MLBTeam; away: MLBTeam };
  status: {
    abstractGameState: string; // "Final" | "Live" | "Preview"
  };
}

interface MLBSchedule {
  dates?: Array<{ games: MLBGame[] }>;
}

async function fetchMLBFinished(): Promise<Set<string>> {
  const now = Date.now();
  if (mlbCache && now - mlbFetchedAt < TTL) return mlbCache;

  const finished = new Set<string>();
  const today = new Date().toISOString().slice(0, 10);
  try {
    const res = await fetch(
      `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${today}&hydrate=team,linescore`
    );
    if (!res.ok) { mlbCache = finished; mlbFetchedAt = now; return finished; }
    const data = await res.json() as MLBSchedule;
    for (const date of data.dates ?? []) {
      for (const game of date.games ?? []) {
        if (game.status?.abstractGameState !== 'Final') continue;
        addPair(finished, game.teams.home.team.name, game.teams.away.team.name);
      }
    }
  } catch { /* ignore */ }

  mlbCache = finished;
  mlbFetchedAt = now;
  return finished;
}

// ---------------------------------------------------------------------------
// NHL Web API
// ---------------------------------------------------------------------------

interface NHLTeam {
  placeName?: { default: string };
  commonName?: { default: string };
  abbrev?: string;
}

interface NHLGame {
  gameState: string; // "FINAL" | "OFF" | "LIVE" | "FUT" | "PRE"
  homeTeam: NHLTeam;
  awayTeam: NHLTeam;
}

interface NHLScoreboard {
  games?: NHLGame[];
}

function nhlTeamName(t: NHLTeam): string {
  return t.commonName?.default ?? t.placeName?.default ?? t.abbrev ?? '';
}

async function fetchNHLFinished(): Promise<Set<string>> {
  const now = Date.now();
  if (nhlCache && now - nhlFetchedAt < TTL) return nhlCache;

  const finished = new Set<string>();
  const today = new Date().toISOString().slice(0, 10);
  try {
    const res = await fetch(`https://api-web.nhle.com/v1/score/${today}`);
    if (!res.ok) { nhlCache = finished; nhlFetchedAt = now; return finished; }
    const data = await res.json() as NHLScoreboard;
    for (const game of data.games ?? []) {
      if (game.gameState !== 'FINAL' && game.gameState !== 'OFF') continue;
      addPair(finished, nhlTeamName(game.homeTeam), nhlTeamName(game.awayTeam));
    }
  } catch { /* ignore */ }

  nhlCache = finished;
  nhlFetchedAt = now;
  return finished;
}

// ---------------------------------------------------------------------------
// Public export — merged finished sets from all sources
// ---------------------------------------------------------------------------

export interface APIFinishedSets {
  /** Normalised "home|away" pairs for team-vs-team matches */
  pairs:  Set<string>;
  /** Normalised event title fragments for single-name events (racing, MMA) */
  titles: Set<string>;
}

/**
 * Returns finished-match sets from ESPN (all sports), MLB, and NHL APIs.
 * `pairs`  — use for "Team A vs Team B" style matches.
 * `titles` — use for single-name events (NASCAR race name, UFC event name, etc.):
 *             check if any word sequence from the match title appears in this set.
 * Fetches all sources in parallel; individual failures are silently ignored.
 */
export async function fetchAPIFinishedPairs(): Promise<APIFinishedSets> {
  const [espn, mlb, nhl] = await Promise.all([
    fetchESPNFinished(),
    fetchMLBFinished(),
    fetchNHLFinished(),
  ]);

  const pairs  = new Set<string>();
  const titles = new Set<string>();

  espn.pairs.forEach(p   => pairs.add(p));
  espn.titles.forEach(t  => titles.add(t));
  mlb.forEach(p          => pairs.add(p));
  nhl.forEach(p          => pairs.add(p));

  return { pairs, titles };
}
