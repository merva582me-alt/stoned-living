# Sports Image Enrichment Plan

## Top-Level Overview

**Goal:** Fix missing cover images on sports event cards by:
1. Patching the existing pipeline bug that silently drops `eventPoster` and `leagueBanner` enrichment (TSDB already fetches these, they just never reach the card)
2. Extending the existing ESPN scoreboard fetches (already running for finished-match detection) to also extract **event images** and **team logos** — covering UFC, boxing, NASCAR, F1, and all team sports

**Approach:**
- The ESPN scoreboard API (`site.api.espn.com/apis/site/v2/sports/{slug}/scoreboard`) already returns `images[]` per event and `team.logo` per competitor — the current `ESPNEvent` TypeScript interface just doesn't capture those fields
- No new external services or API keys needed — ESPN is already being called, we just extract more from the existing response
- The resulting enrichment maps into the existing `MatchEnrichment` shape (`eventPoster`, `homeBadge`, `awayBadge`, `leagueBanner`)

**Files changed:**
- `src/components/SportsView.tsx` — fix `toSportMatch()` and `getSectionMatches()` to stop dropping enrichment
- `src/services/espn.ts` — extend `ESPNEvent` interface and `fetchESPNSlug()` to capture images and logos; add new `buildESPNImageMap()` export
- `src/components/SportsView.tsx` — wire `buildESPNImageMap()` into the enrichment pipeline

**Non-goals:**
- No new API services (no UFC.com scraping, no RAWG, no SerpAPI)
- No hardcoded image maps
- No changes to the HLS player or stream resolution
- No changes to how TSDB enrichment works internally

---

## Sub-Task 1 — Fix TSDB Enrichment Passthrough Bug

**Status:** `[x] done` — already implemented in codebase (`toSportMatch` already passes `eventPoster` and `leagueBanner`; no `hasVisual` filter exists to remove)

### Intent
`toSportMatch()` copies most enrichment fields into the `tsdb` object but silently drops `eventPoster` and `leagueBanner`. This means TheSportsDB successfully fetches event posters for single-name events (NASCAR, UFC, Formula 1) but the data is discarded before reaching the card renderer. Also, `getSectionMatches()` has a visual filter that checks for images but doesn't include `eventPoster`, so cards whose only image is an event poster get dropped from carousels entirely.

### Expected Outcomes
- NASCAR, Formula 1, MMA, and other single-name events that TSDB has a thumbnail for will show their TSDB event poster
- Cards with only an `eventPoster` (no team badges, no streamed.pk poster) are no longer dropped from carousels
- No change to team-vs-team match cards (they use `homeBadge`/`awayBadge`, not `eventPoster`)

### Todo List
1. In `toSportMatch()` in `SportsView.tsx`, add the two missing fields to the `tsdb` object being built:
   - `eventPoster: enrich.eventPoster`
   - `leagueBanner: enrich.leagueBanner`
2. In `getSectionMatches()` in `SportsView.tsx`, extend the `hasVisual` check to include `m.tsdb?.eventPoster` alongside the existing fields

### Relevant Context
- `toSportMatch` — [`src/components/SportsView.tsx`](src/components/SportsView.tsx:150) — the `tsdb` object is built here; `eventPoster` and `leagueBanner` are referenced in `MatchEnrichment` but not copied
- `getSectionMatches` / `hasVisual` check — [`src/components/SportsView.tsx`](src/components/SportsView.tsx:568)
- `SportMatch.tsdb.eventPoster` read in `SportMatchTile` — [`src/components/SportMatchCarousel.tsx`](src/components/SportMatchCarousel.tsx:53) — already reads it, just never receives a value
- `MatchEnrichment` interface — [`src/services/sportsdb.ts`](src/services/sportsdb.ts:47)

---

## Sub-Task 2 — Extend ESPN Service to Extract Images and Team Logos

**Status:** `[x] done`

### Intent
The ESPN scoreboard API already returns rich image data that the current service ignores. Each event has an `images[]` array with poster/thumbnail URLs. Each competitor has a `team.logo` URL. Since ESPN already covers UFC (`mma/ufc`), Bellator (`mma/bellator`), boxing (`boxing/professional`), Formula 1 (`racing/f1`), NASCAR (`racing/nascar-cup-series`), NFL, NBA, soccer, and more — extracting these images from the already-fetched scoreboard responses will cover almost all the missing-image cards in the screenshots.

The ESPN scoreboard interface (`ESPNEvent`) currently only reads `name`, `shortName`, and `competitions[].status`. We need to also read `images[]` and `competitions[].competitors[].team.logo`.

### Expected Outcomes
- UFC events like "Noche UFC: Rodriguez vs Silva" get the ESPN event poster as their cover image
- "Dana White's Contender Series" events get the ESPN series image
- Boxing matches like "Regie Suganob vs Sivenathi Nontshinga" get ESPN team/fighter logos
- NASCAR and F1 events get ESPN race event imagery
- NFL, NBA, soccer match cards get ESPN team logos (filling in where TSDB is patchy)
- Images come from the already-running ESPN fetches — no new HTTP requests for the image step

### Todo List
1. Extend the `ESPNCompetitor` interface in `espn.ts` to include `team.logo: string` and `team.displayName: string`
2. Extend the `ESPNEvent` interface to include `images?: Array<{ url: string; type?: string }>` — ESPN typically has a `type` of `"thumbnail"` or `"banner"` per image entry
3. Create a new exported function `buildESPNImageMap(matches: EnrichInput[], onUpdate: OnUpdate): Promise<Map<string, MatchEnrichment>>` in `espn.ts`:
   - Import `EnrichInput` and `MatchEnrichment` from `sportsdb.ts` (they are already exported)
   - For each ESPN slug, fetch the scoreboard (reuse the existing `fetchESPNSlug` fetch — share cached results to avoid double-fetching), extract per-event: `images[0].url` as `eventPoster` for single-name events; `home team.logo` as `homeBadge` and `away team.logo` as `awayBadge` for team-vs-team events
   - Match events to input matches by normalized title comparison (same `norm()` helper already in the file)
   - For each matched input match, call `onUpdate(match.id, enrichment)` progressively per slug
   - Cache results with the same 60s TTL pattern used elsewhere in the file
4. The function signature must match the `onUpdate` callback pattern used by `buildEnrichmentMap` in `sportsdb.ts` so it slots into the existing pipeline in `SportsView`

### Relevant Context
- `ESPNCompetitor` and `ESPNEvent` interfaces — [`src/services/espn.ts`](src/services/espn.ts:96)
- `fetchESPNSlug` (existing fetch logic to extend, not replace) — [`src/services/espn.ts`](src/services/espn.ts:118)
- `ESPN_SLUGS` list covering all relevant sports — [`src/services/espn.ts`](src/services/espn.ts:52)
- `MatchEnrichment` shape to conform to — [`src/services/sportsdb.ts`](src/services/sportsdb.ts:47)
- `buildEnrichmentMap` progressive callback pattern to follow — [`src/services/sportsdb.ts`](src/services/sportsdb.ts:373)
- `EnrichInput` type (matches passed in) — [`src/services/sportsdb.ts`](src/services/sportsdb.ts) — check if exported, may need to export it
- `norm()` helper already exists in `espn.ts` at line 17 — reuse it
- ESPN scoreboard response shape: `events[].{ name, shortName, images: [{ url, type }], competitions: [{ competitors: [{ homeAway, team: { displayName, logo } }] }] }`

---

## Sub-Task 3 — Wire ESPN Image Enrichment into SportsView

**Status:** `[x] done`

### Intent
The new `buildESPNImageMap()` function needs to be called alongside the existing TSDB `buildEnrichmentMap()` in `SportsView.load()`. The existing `onUpdate` / `setEnrichUpdates` merge callback must be updated to merge the ESPN results additively — filling in only fields that TSDB left empty, while always updating scores (since ESPN is fresher for live matches).

### Expected Outcomes
- After the page loads, cards that had no image now show ESPN-sourced images progressively
- TSDB enrichment is not regressed — if TSDB already found a badge, ESPN does not overwrite it
- Scores and progress always use the freshest data (scores can overwrite)

### Todo List
1. Import `buildESPNImageMap` from `../services/espn` at the top of `SportsView.tsx`
2. In `SportsView.load()`, after the existing `buildEnrichmentMap` (TSDB) call, call `buildESPNImageMap` with the same `allForEnrich` input and the same `onUpdate` callback:
   ```
   await buildESPNImageMap(allForEnrich, onUpdate)
   ```
   This can run after TSDB completes (not in parallel) to ensure TSDB values are preserved — or run in parallel if the `onUpdate` merge logic guards correctly
3. Update the `onUpdate` merge logic in `SportsView` so that **ESPN always wins** — ESPN-sourced images overwrite TSDB images (ESPN quality is higher). Scores always update regardless of source. The merge order should be: TSDB first (baseline), then ESPN overwrites image fields. Since `buildESPNImageMap` runs after TSDB, the simple spread `{ ...prev.get(id), ...enrichment }` will naturally let ESPN overwrite — confirm this is the behaviour and remove any guards that would block overwriting

### Relevant Context
- `SportsView.load()` enrichment section — [`src/components/SportsView.tsx`](src/components/SportsView.tsx:447)
- `setEnrichUpdates` `onUpdate` callback — [`src/components/SportsView.tsx`](src/components/SportsView.tsx:447) — current simple spread needs to become additive for images
- `buildEnrichmentMap` import — [`src/components/SportsView.tsx`](src/components/SportsView.tsx:1) — add `buildESPNImageMap` alongside

---

## Implementation Order

```
Sub-Task 1  →  Sub-Task 2  →  Sub-Task 3
```

Sub-Task 1 is a prerequisite because it fixes the rendering pipeline — without it, even correctly enriched events won't show their images. Sub-Task 2 is a new capability (ESPN image extraction). Sub-Task 3 wires Sub-Task 2 into the running app.
