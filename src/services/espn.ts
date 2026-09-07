/**
 * ESPN / MLB / NHL finished-match detection  +  ESPN image enrichment
 *
 * Part 1 (original): Each scoreboard API returns today's games with a status
 * field. We extract every game that is confirmed "final/finished" and return
 * them as a Set of normalised "home|away" pair strings — the same format used
 * by fetchTodayFinishedPairs() in sportsdb.ts.
 *
 * Part 2 (new): The ESPN scoreboard also returns event images and team logos.
 * buildESPNImageMap() re-uses the same scoreboard responses (separate cache) to
 * produce a MatchEnrichment map — covering UFC, boxing, NASCAR, F1, NFL, NBA,
 * soccer, etc. — with real event posters and team logos from ESPN's CDN.
 */

import type { MatchEnrichment } from './sportsdb';

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
  team: {
    displayName: string;
    logo?: string;         // team logo URL (e.g. https://a.espncdn.com/i/teamlogos/...)
  };
}

interface ESPNImage {
  url:   string;
  type?: string;  // "thumbnail" | "banner" | "default" | etc.
}

interface ESPNEvent {
  id?:        string;
  name?:      string;       // full event name, e.g. "NASCAR Cup Series at Daytona"
  shortName?: string;       // abbreviated name
  images?:    ESPNImage[];  // event poster/thumbnail images
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

// ── Image cache — separate from the finished-match cache ─────────────────────

interface ESPNImageData {
  events: ESPNEvent[];
}

const espnImageCache = new Map<string, { data: ESPNImageData; fetchedAt: number }>();

async function fetchESPNSlugRaw(slug: string): Promise<ESPNImageData> {
  const cached = espnImageCache.get(slug);
  if (cached && Date.now() - cached.fetchedAt < TTL) return cached.data;

  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/${slug}/scoreboard`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return { events: [] };
    const data = await res.json() as ESPNScoreboard;
    const result: ESPNImageData = { events: data.events ?? [] };
    espnImageCache.set(slug, { data: result, fetchedAt: Date.now() });
    return result;
  } catch {
    return { events: [] };
  }
}

async function fetchESPNSlug(slug: string): Promise<FinishedSets> {
  const pairs  = new Set<string>();
  const titles = new Set<string>();
  try {
    // Reuse cached raw data if available, otherwise fetch
    const { events } = await fetchESPNSlugRaw(slug);
    for (const event of events) {
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
// ESPN image enrichment — extract event posters + team logos from scoreboard
// ---------------------------------------------------------------------------

type EnrichInput = Array<{ id: string; title: string; category?: string }>;
type OnUpdate    = (id: string, enrichment: MatchEnrichment) => void;

/** Pick the best image URL from an ESPN images array.
 *  Prefers "thumbnail" type; falls back to the first available URL. */
function pickESPNImage(images: ESPNImage[] | undefined): string {
  if (!images?.length) return '';
  const thumb = images.find(img => img.type === 'thumbnail');
  return (thumb ?? images[0]).url;
}

/** Fuzzy title match — check if the ESPN event name overlaps enough
 *  with the streamed.pk match title to be considered the same event. */
function titleMatches(espnName: string, matchTitle: string): boolean {
  const a = norm(espnName);
  const b = norm(matchTitle);
  if (!a || !b) return false;
  // Exact match
  if (a === b) return true;
  // One contains the other
  if (a.includes(b) || b.includes(a)) return true;
  // Share at least 3 consecutive words
  const wordsA = a.split(' ');
  const wordsB = new Set(b.split(' '));
  let run = 0;
  for (const w of wordsA) {
    if (wordsB.has(w) && w.length > 2) { run++; if (run >= 3) return true; }
    else run = 0;
  }
  return false;
}

/**
 * buildESPNImageMap — extract event posters and team logos from ESPN scoreboard.
 *
 * Runs after TSDB enrichment so ESPN images overwrite TSDB images (ESPN CDN
 * quality is higher). Returns a Map<matchId, MatchEnrichment> and also calls
 * onUpdate progressively per slug.
 */
export async function buildESPNImageMap(
  matches: EnrichInput,
  onUpdate: OnUpdate
): Promise<Map<string, MatchEnrichment>> {
  const result = new Map<string, MatchEnrichment>();
  if (!matches.length) return result;

  // Fetch all slugs in parallel — fetchESPNSlugRaw uses its own cache so
  // this does not double-hit the network when fetchESPNFinished ran first.
  const slugResults = await Promise.allSettled(
    ESPN_SLUGS.map(async slug => ({ slug, ...(await fetchESPNSlugRaw(slug)) }))
  );

  for (const settled of slugResults) {
    if (settled.status !== 'fulfilled') continue;
    const { events } = settled.value;

    for (const event of events) {
      // Pick the best image for this event (works for both single-name and team events)
      const eventImage = pickESPNImage(event.images);

      for (const comp of event.competitions ?? []) {
        const home = comp.competitors.find(c => c.homeAway === 'home');
        const away = comp.competitors.find(c => c.homeAway === 'away');

        const homeName  = home?.team.displayName ?? '';
        const awayName  = away?.team.displayName ?? '';
        const homeLogo  = home?.team.logo ?? '';
        const awayLogo  = away?.team.logo ?? '';
        const isTeamVs  = !!(homeName && awayName);

        for (const match of matches) {
          let enrichment: MatchEnrichment | null = null;

          if (isTeamVs) {
            // Team-vs-team match: match by checking both team names appear in title
            const mNorm = norm(match.title);
            const hNorm = norm(homeName);
            const aNorm = norm(awayName);
            if (
              mNorm.includes(hNorm) || mNorm.includes(aNorm) ||
              hNorm.includes(norm(match.title.split(/\s+vs\.?\s+/i)[0] ?? '')) ||
              aNorm.includes(norm(match.title.split(/\s+vs\.?\s+/i).slice(-1)[0] ?? ''))
            ) {
              if (homeLogo || awayLogo || eventImage) {
                enrichment = {
                  ...(homeLogo  ? { homeBadge: homeLogo }   : {}),
                  ...(awayLogo  ? { awayBadge: awayLogo }   : {}),
                  ...(eventImage ? { eventPoster: eventImage } : {}),
                };
              }
            }
          } else {
            // Single-name event (racing, MMA, boxing): match by title similarity
            const espnName = event.name ?? event.shortName ?? '';
            if (espnName && titleMatches(espnName, match.title)) {
              if (eventImage) {
                enrichment = { eventPoster: eventImage };
              }
            }
          }

          if (enrichment) {
            const existing = result.get(match.id) ?? {};
            const merged   = { ...existing, ...enrichment };
            result.set(match.id, merged);
            onUpdate(match.id, enrichment);
          }
        }
      }
    }
  }

  return result;
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
