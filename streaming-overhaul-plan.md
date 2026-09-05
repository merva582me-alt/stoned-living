# Stoned.living — Streaming Architecture Overhaul Plan

## Top-Level Overview

**Goal:** Replace the VidFast iframe streaming layer with a high-performance, ad-free streaming stack consisting of:
- A **Plyr + Hls.js** HTML5 video player (frontend)
- A **Cloudflare Worker** resolver API that extracts `.m3u8` HLS manifests from multiple open-source providers in the background
- A new **Live Sports** section backed by Streamed.pk and DaddyLive resolvers
- Full migration from Express + Node.js to **Cloudflare Pages** (static) + **Cloudflare Workers** (API)
- AniList integration for the Anime catalog section

**Scope:**
- Delete `server.ts`, `src/services/vidfast.ts`, and all iframe/VidFast references
- Build a `/workers/resolver` Cloudflare Worker project
- Replace `WatchPlayer.tsx` iframe with Plyr + Hls.js `<video>` element
- Add `SportsView.tsx` with sports tab routing
- Add AniList GraphQL queries to the anime section
- Preserve all brand features: strain pairings, ambient sound, Firebase Auth, stash/watchlist, admin panel, age gate, smoke particles
- Move all secrets to Cloudflare environment variables

**Architecture:**
```
Browser (Cloudflare Pages static SPA)
  └─ WatchPlayer (Plyr + Hls.js)
       └─ GET /api/resolve?source=vidsrc&type=movie&id=12345
            └─ Cloudflare Worker (/workers/resolver)
                 ├─ VidSrc resolver  → .m3u8
                 ├─ VidLink resolver → .m3u8
                 ├─ VidCore resolver → .m3u8
                 ├─ VidUp resolver   → .m3u8  (media fallback chain)
                 ├─ Streamed.pk resolver → .m3u8 (sports)
                 └─ DaddyLive resolver   → .m3u8 (sports)
```

---

## Sub-Task 1 — Legacy Purge & Cloudflare Pages Migration

**Intent:** Remove all VidFast code and Express server infrastructure. Migrate to Cloudflare Pages (static frontend) with a `wrangler.toml` scaffold. All secrets moved to Cloudflare environment variables.

**Expected Outcomes:**
- `server.ts` deleted
- `src/services/vidfast.ts` deleted
- All VidFast references removed from `AdminPanel.tsx`, `api.ts`, `storage.ts`, `types.ts`
- `package.json` scripts updated: `dev` runs Vite directly (`vite`), `build` runs only `vite build`
- Express and `tsx`/`esbuild` server-build dependencies removed from `package.json`
- `wrangler.toml` created at project root configuring Cloudflare Pages
- `_headers` file created at project root for security headers
- `.env.example` updated to document all required Cloudflare env vars (TMDB_API_KEY, Firebase config keys)
- All hardcoded API keys removed from `src/services/api.ts` (replaced with `import.meta.env.VITE_TMDB_API_KEY`)
- `vite.config.ts` updated with a dev-proxy for `/api/*` pointing to the local Wrangler dev server URL

**Todo List:**
1. Delete `server.ts`
2. Delete `src/services/vidfast.ts`
3. In `src/services/api.ts`: remove hardcoded `DIRECT_TMDB_KEY` and `DIRECT_TMDB_READ_TOKEN` constants; replace with `import.meta.env.VITE_TMDB_API_KEY` and `import.meta.env.VITE_TMDB_READ_TOKEN`; remove the backend proxy path (the Express `/api/tmdb` path) and standardize all calls to direct TMDb HTTPS
4. In `src/components/AdminPanel.tsx`: remove the `vidfastPrimaryServer` / `allowedServers` settings fields; remove any VidFast-specific UI controls
5. In `src/services/storage.ts`: remove default VidFast server setting
6. In `src/types.ts`: remove `StreamServer` type and any VidFast-related type fields
7. Update `package.json`: remove `express`, `@types/express`, `tsx`, `esbuild` from dependencies; update `dev` script to `vite`, `build` script to `vite build`, remove `start` script
8. Create `wrangler.toml` with Cloudflare Pages project name `stoned-living` and build config pointing to `dist/`
9. Create `public/_headers` with strict CSP headers (allow `blob:` and `media-src *` for HLS), CORS headers for `/api/*`
10. Update `.env.example` with all required VITE_ prefixed vars and Worker-side vars
11. Update `vite.config.ts` to proxy `/api` to `http://localhost:8787` during dev (Wrangler local dev port)

**Relevant Context:**
- `server.ts` — entire file to be deleted
- `src/services/vidfast.ts` — entire file to be deleted
- [`src/services/api.ts`](src/services/api.ts) — lines with `DIRECT_TMDB_KEY`, `DIRECT_TMDB_READ_TOKEN`, backend proxy path
- [`src/components/AdminPanel.tsx`](src/components/AdminPanel.tsx) — VidFast server settings panel
- [`src/services/storage.ts`](src/services/storage.ts) — default server key
- [`package.json`](package.json) — scripts and dependencies
- [`vite.config.ts`](vite.config.ts) — add proxy

**Status:** [x] done

---

## Sub-Task 2a — Cloudflare Worker Scaffold, Orchestration, VidSrc & VidLink

**Intent:** Create the standalone Cloudflare Worker project under `/workers/resolver/` with full scaffolding, the main orchestration handler, and the two primary resolvers (VidSrc and VidLink). This allows primary stream resolution to be validated immediately before the secondary resolvers are added.

**Expected Outcomes:**
- `/workers/resolver/` directory with `wrangler.toml`, `src/index.ts`, `package.json`, `tsconfig.json`
- Worker exposes `GET /api/resolve?type=movie|tv|anime&id=TMDB_ID&season=N&episode=N` and returns `{ url: "https://...m3u8", provider: "vidsrc" }` or `{ error: "no stream found" }`
- CORS headers set on all responses: `Access-Control-Allow-Origin: https://stoned.living` (also `*` during dev)
- Resolvers implemented:
  - **VidSrc** (`cool-dev-guy/vidsrc.ts`): fetch `https://vidsrc.cc/embed/...`, extract encrypted source, decrypt RC4 key, return `.m3u8`
  - **VidLink** (`walterwhite-69/Vidlink.pro-Decryptor`): fetch `https://vidlink.pro/movie/...` or `/tv/...`, extract and decrypt stream data from script tags, return `.m3u8`
- Fallback chain: try VidSrc → VidLink (VidCore + VidUp stubs return `null` as placeholders for 2b)
- Worker returns first successful `.m3u8`; on all failures returns `{ error: "no stream found" }` with HTTP 502

**Todo List:**
1. Create `/workers/resolver/package.json` with `wrangler` and TypeScript dev dependencies (`@cloudflare/workers-types`)
2. Create `/workers/resolver/tsconfig.json` targeting Cloudflare Workers runtime
3. Create `/workers/resolver/wrangler.toml` with worker name `stoned-resolver`, compatibility date, and route pattern for standalone deployment
4. Create `/workers/resolver/src/index.ts` with: CORS preflight handler, request URL parsing, sequential fallback chain orchestration (try each resolver, return first non-null result), and structured JSON response
5. Create `/workers/resolver/src/resolvers/vidsrc.ts` — implement VidSrc resolution: construct embed URL (`https://vidsrc.cc/embed/movie/TMDB_ID` or `/tv/TMDB_ID/S/E`), fetch HTML, extract nested iframe `src`, fetch that page, locate RC4-encrypted key, decrypt it using `TextDecoder` + XOR loop (per `cool-dev-guy/vidsrc.ts` logic), fetch final provider URL, extract `.m3u8` from response
6. Create `/workers/resolver/src/resolvers/vidlink.ts` — implement VidLink resolution: fetch `https://vidlink.pro/movie/ID` or `/tv/ID/S/E`, extract the AES-encrypted JSON blob from the inline `<script>` tag, derive decryption key from page constants, decrypt with `crypto.subtle.decrypt` (AES-CBC), parse resulting JSON for the `.m3u8` stream URL (per `walterwhite-69/Vidlink.pro-Decryptor`)
7. Create `/workers/resolver/src/resolvers/vidcore.ts` and `/workers/resolver/src/resolvers/vidup.ts` as stubs that immediately return `null` (to be completed in 2b)
8. Wire all four resolvers in `index.ts` fallback chain; deploy locally with `wrangler dev` and manually verify VidSrc and VidLink return valid `.m3u8` URLs

**Relevant Context:**
- Referenced repos (logic to port):
  - `https://github.com/cool-dev-guy/vidsrc.ts`
  - `https://github.com/walterwhite-69/Vidlink.pro-Decryptor`
- Cloudflare Workers runtime APIs available: `fetch`, `crypto.subtle`, `atob/btoa`, `TextDecoder`, `URL`, `Headers`
- VidSrc RC4 decryption is a pure XOR loop — no external crypto library needed
- VidLink AES-CBC uses `crypto.subtle` which is natively available in Workers

**Status:** [x] done

---

## Sub-Task 2b — Worker Resolvers: VidCore, VidUp & Cloudflare Cache API

**Intent:** Complete the media resolver fallback chain by implementing VidCore and VidUp resolvers (replacing the stubs from 2a), then add the Cloudflare Cache API layer to cache resolved `.m3u8` manifests for 5 minutes to reduce redundant extraction work.

**Expected Outcomes:**
- `/workers/resolver/src/resolvers/vidcore.ts` fully implemented (no longer a stub)
- `/workers/resolver/src/resolvers/vidup.ts` fully implemented (no longer a stub)
- Full four-provider fallback chain operational: VidSrc → VidLink → VidCore → VidUp
- Cloudflare Cache API wrapper added in `index.ts`: on successful resolution, cache the result for 5 minutes keyed on `type+id+season+episode`; on incoming request, check cache first and return immediately if hit
- Cache key format: `https://stoned-resolver/cache/TYPE/ID/S/E`

**Todo List:**
1. Implement `/workers/resolver/src/resolvers/vidcore.ts` — fetch VidCore embed endpoint, parse HLS manifest URL from JSON response or URL pattern (per `sharoon7171/vidcore-hls-scraper-resolver`)
2. Implement `/workers/resolver/src/resolvers/vidup.ts` — fetch VidUp embed, locate and return `.m3u8` manifest URL (per `sharoon7171/vidup-stream-solver`)
3. In `index.ts`: wrap the resolver chain with a `caches.default.match(cacheKey)` check before running resolvers; on success, store result via `caches.default.put(cacheKey, cachedResponse)` with `Cache-Control: max-age=300`
4. Verify full four-provider fallback chain with `wrangler dev`

**Relevant Context:**
- Referenced repos:
  - `https://github.com/sharoon7171/vidcore-hls-scraper-resolver`
  - `https://github.com/sharoon7171/vidup-stream-solver`
- Cloudflare Cache API: `caches.default` — use `Request`/`Response` objects for `.match()` and `.put()`
- Cache only applies in deployed Workers (not in `wrangler dev` local mode by default)

**Status:** [x] done

---

## Sub-Task 3 — Cloudflare Worker Resolver API (Sports: Streamed.pk, DaddyLive)

**Intent:** Extend the Cloudflare Worker with sports stream resolvers that take a match/channel ID and return live `.m3u8` HLS manifests for Streamed.pk and DaddyLive. These are separate resolver modules added to the same Worker.

**Expected Outcomes:**
- Worker exposes an additional route: `GET /api/resolve?source=sports&provider=streamed|daddylive&id=CHANNEL_ID`
- `GET /api/sports/events?provider=streamed|daddylive` returns a list of current live events with `{ id, title, category, thumbnail }` objects
- Resolvers implemented:
  - **Streamed.pk** (`sharoon7171/streamed-pk-hls-stream-resolver`): fetch the Streamed.pk event page, extract the HLS playlist URL from the page source
  - **DaddyLive** (`sharoon7171/daddylive-stream-resolver`): fetch the DaddyLive channel page, extract the `.m3u8` manifest link, handle any token/key challenges
- Silent fallback: if Streamed.pk fails for a channel, try DaddyLive equivalent channel; return error only if both fail
- Same CORS headers and Cache API caching (TTL: 30 seconds for live streams)

**Todo List:**
1. Create `/workers/resolver/src/resolvers/streamed.ts` — implement Streamed.pk resolution: fetch event listing endpoint for live events list, fetch channel/event embed, extract HLS URL (per `sharoon7171/streamed-pk-hls-stream-resolver`)
2. Create `/workers/resolver/src/resolvers/daddylive.ts` — implement DaddyLive resolution: fetch channel schedule/listing, fetch channel page, extract `.m3u8` manifest (per `sharoon7171/daddylive-stream-resolver`)
3. Add `/api/sports/events` route handler to `index.ts`: fetches and merges live event lists from both providers, deduplicates by title/sport category, returns unified event list JSON
4. Add sports fallback chain to `index.ts`: for a given sports channel ID, try Streamed.pk first, then DaddyLive
5. Set Cache TTL to 30 seconds for sports live streams (much shorter than VOD cache)

**Relevant Context:**
- Referenced repos:
  - `https://github.com/sharoon7171/streamed-pk-hls-stream-resolver`
  - `https://github.com/sharoon7171/daddylive-stream-resolver`
- Live sports need very short cache TTLs since stream tokens rotate frequently

**Status:** [x] done

---

## Sub-Task 4 — Plyr + Hls.js Player Component

**Intent:** Replace the VidFast iframe in `WatchPlayer.tsx` with a native HTML5 `<video>` element powered by Plyr (UI controls) and Hls.js (HLS playback). The player calls the Worker resolver API to get the `.m3u8` URL, then loads it into the player. There must be zero UI references to any third-party provider.

**Expected Outcomes:**
- `plyr` and `hls.js` added to `package.json` dependencies
- `WatchPlayer.tsx` no longer renders an `<iframe>`; instead renders a `<video id="stoned-player">` element
- On mount/media change, WatchPlayer calls `GET /api/resolve?type=...&id=...&season=...&episode=...` and passes the returned `.m3u8` URL to Hls.js
- Hls.js attaches the HLS stream to the `<video>` element; Plyr wraps the `<video>` element for controls
- Loading state: a stoned.living branded skeleton/spinner shown while resolving; no provider names or logos visible
- Error state: if all resolvers fail, show a branded "Stream unavailable — try again" UI (no provider references)
- All existing WatchPlayer features preserved: episode/season selector, next/prev episode, theater mode, lights-off, fullscreen, strain pairing card, comments, watch history
- Plyr CSS imported; player styled to match stoned.living's emerald/dark theme via CSS custom properties
- Hls.js error recovery: on fatal HLS error, attempt re-resolve via Worker (one retry)

**Todo List:**
1. Install `plyr` and `hls.js` via package.json
2. Add Plyr CSS import to `src/index.css` or directly in `WatchPlayer.tsx`
3. In `WatchPlayer.tsx`: remove `getEmbedUrl` call and `<iframe>` block; add `<video>` ref element
4. Add `resolveStream(type, id, season?, episode?)` async function that calls `fetch('/api/resolve?...')` and returns the `.m3u8` URL
5. Add `useEffect` that calls `resolveStream`, sets loading state, then initializes Hls.js with the returned URL and attaches it to the video ref
6. Initialize Plyr on the video ref after Hls.js setup; configure Plyr with stoned.living colors (emerald) via `--plyr-color-main` CSS variable; disable Plyr's default quality selector (quality is abstracted by the resolver)
7. Implement loading skeleton (existing brand-themed spinner/overlay)
8. Implement error state overlay (branded, no provider names)
9. Implement Hls.js `FATAL` error handler: on error, call `resolveStream` one more time with the next provider (or just re-resolve); if second attempt fails, show error state
10. Remove import of `vidfast.ts` from WatchPlayer and any other components
11. Verify all existing player features (episode selectors, theater mode, lights-off, strain card, comments) still function correctly after player swap

**Relevant Context:**
- [`src/components/WatchPlayer.tsx`](src/components/WatchPlayer.tsx) — main file to modify (iframe → video element)
- `src/services/vidfast.ts` — deleted in Sub-Task 1; remove its import here
- Plyr docs: `new Plyr(videoElement, options)` — use `controls` option to specify which controls to show
- Hls.js docs: `hls.loadSource(url); hls.attachMedia(videoEl)` pattern

**Status:** [x] done

---

## Sub-Task 5 — Live Sports Section (SportsView + Routing)

**Intent:** Build the brand-new Live Sports section as a top-level tab. A `SportsView.tsx` component fetches live events from the Worker's `/api/sports/events` endpoint, displays them in a categorized grid (Football, Basketball, UFC, etc.), and when a user taps an event, passes the event ID to `WatchPlayer` which resolves via the sports resolver chain.

**Expected Outcomes:**
- `SportsView.tsx` created in `src/components/`
- Fetches `GET /api/sports/events` on mount; displays events grouped by sport category
- Each event card shows: sport icon, match title, teams (if available), live indicator badge
- Tapping an event calls `onWatch(eventItem)` which opens `WatchPlayer` — the player detects `media_type === 'sports'` and uses the sports resolver path (`/api/resolve?source=sports&...`)
- `sports` tab added to `VALID_TABS` in `App.tsx`
- `SportsView` wired into `App.tsx` tab renderer
- `Navbar.tsx`: "Sports" entry added to `navItems` and `mobileBottomNavItems` with an appropriate icon (e.g., `Trophy` or `Tv2` from Lucide)
- `MediaItem` type extended with optional `sports_provider`, `channel_id`, `sport_category` fields
- Zero external provider names visible in the UI (events shown as match title + sport category only)

**Todo List:**
1. Extend `MediaItem` in `src/types.ts` with optional sports fields: `sport_category?: string`, `channel_id?: string`, `sports_provider?: string`, `is_live?: boolean`
2. Create `src/components/SportsView.tsx`:
   - Fetch `/api/sports/events` on mount; handle loading/error states
   - Group events by `sport_category`
   - Render category sections with event cards (match title, live badge, sport icon)
   - On card click: call `onWatch` with the event `MediaItem`
3. In `WatchPlayer.tsx`: detect `media_type === 'sports'` and call `/api/resolve?source=sports&provider=...&id=CHANNEL_ID` instead of the media resolver path
4. In `src/App.tsx`:
   - Add `'sports'` to `VALID_TABS`
   - Import and render `<SportsView>` when `currentTab === 'sports'`
   - Pass required `onWatch` callback to `SportsView`
5. In `src/components/Navbar.tsx`:
   - Add `{ id: 'sports', label: 'Sports', icon: Trophy }` to `navItems` array
   - Add matching entry to `mobileBottomNavItems`

**Relevant Context:**
- [`src/App.tsx`](src/App.tsx) — `VALID_TABS`, tab renderer switch block, and `onNavigate`/`onWatch` wiring
- [`src/components/Navbar.tsx`](src/components/Navbar.tsx) — `navItems` and `mobileBottomNavItems` arrays
- [`src/components/WatchPlayer.tsx`](src/components/WatchPlayer.tsx) — media type branching for resolver URL
- [`src/types.ts`](src/types.ts) — `MediaItem` interface

**Status:** [x] done

---

## Sub-Task 6 — AniList Integration for Anime Catalog

**Intent:** Add AniList GraphQL API as an additional data source for the Anime tab, providing richer anime-specific metadata (studios, airing status, episode count, genres). AniList IDs are passed alongside TMDb IDs to the Worker resolver, which can use them for anime stream resolution. The existing TMDb-based anime data stays as a fallback.

**Expected Outcomes:**
- `src/services/anilist.ts` created with AniList GraphQL query functions:
  - `fetchAniListTrending()` — trending anime this season
  - `fetchAniListSeasonal()` — current season airing
  - `fetchAniListSearch(query)` — search anime by title
  - `fetchAniListDetails(id)` — full anime details (studios, episodes, genres, relations)
- `AnimeView.tsx` updated to prefer AniList data for the Anime tab, with TMDb as fallback
- `MediaItem` type extended with optional `anilist_id?: number`, `anilist_studios?: string[]`, `airing_status?: string`
- AniList ID passed to `WatchPlayer` as part of the media item; Worker resolver accepts `?anilist_id=` parameter for anime resolution
- No AniList branding in the UI — all catalog sections remain titled as stoned.living branded sections ("Trending Anime", "This Season", etc.)
- AniList GraphQL endpoint: `https://graphql.anilist.co` (no API key required)

**Todo List:**
1. Create `src/services/anilist.ts` with:
   - `ANILIST_ENDPOINT = 'https://graphql.anilist.co'`
   - `gqlFetch(query, variables)` helper function using `fetch` with POST + JSON body
   - `fetchAniListTrending()` GraphQL query (TRENDING_DESC, format IN [TV, MOVIE, OVA])
   - `fetchAniListSeasonal(season, year)` query
   - `fetchAniListSearch(query)` query
   - `fetchAniListDetails(id)` query
   - Mapping function `anilistToMediaItem(anilistMedia)` → `Partial<MediaItem>` that maps AniList fields to the shared `MediaItem` shape
2. In `src/types.ts`: add `anilist_id?: number`, `airing_status?: string`, `anilist_studios?: string[]` to `MediaItem`
3. In `src/components/AnimeView.tsx`: replace or supplement the TMDb anime fetch calls with `fetchAniListTrending()` and `fetchAniListSeasonal()` for the "Trending" and "This Season" category rows; keep TMDb as fallback
4. In `src/App.tsx`: update anime category data fetching (in the `useEffect` for `animeCategoryData`) to use AniList for the primary anime categories
5. In `/workers/resolver/src/index.ts`: accept optional `anilist_id` query param and pass it to the VidSrc resolver (VidSrc supports AniList IDs for anime)

**Relevant Context:**
- [`src/components/AnimeView.tsx`](src/components/AnimeView.tsx) — current TMDb-based anime fetch logic
- [`src/App.tsx`](src/App.tsx) — `animeCategoryData` state and `fetchAnime` calls
- AniList GraphQL API: no auth required, rate limit ~90 req/min
- VidSrc supports AniList IDs for anime: `https://vidsrc.cc/embed/anime/ANILIST_ID/episode/N`

**Status:** [x] done

---

## Sub-Task 7 — Integration Testing & Deployment Configuration

**Intent:** Verify the complete end-to-end data flow works correctly: user selects media → Worker resolves → Plyr/Hls.js plays. Finalize all Cloudflare Pages and Worker deployment configuration files.

**Expected Outcomes:**
- `wrangler.toml` at root correctly configures Pages build (input: `dist/`, `build.command: vite build`)
- `/workers/resolver/wrangler.toml` configures Worker with correct route binding to `stoned.living/api/*`
- `public/_redirects` file created for Cloudflare Pages SPA fallback routing (`/* /index.html 200`)
- `.env.example` documents all required environment variables clearly
- `README.md` updated (or created) with deployment instructions: how to set Cloudflare secrets, deploy Worker with `wrangler deploy`, deploy Pages via `git push` or `wrangler pages deploy`
- Smoke-test checklist documented in the README:
  - Movie playback resolves and plays
  - TV episode playback with season/episode selection resolves and plays
  - Anime playback (AniList ID) resolves and plays
  - Sports live event resolves and plays
  - All fallback chains gracefully handle failures

**Todo List:**
1. Create `public/_redirects` with `/* /index.html 200` for SPA routing on Cloudflare Pages
2. Update root `wrangler.toml` to include Pages build config
3. Verify `/workers/resolver/wrangler.toml` has correct worker name, compatibility date, and route bindings
4. Update `.env.example` with all variables including Worker-side vars and their descriptions
5. Write `README.md` covering: project structure overview, local dev setup (`vite` + `wrangler dev`), required env vars, Cloudflare Pages deployment steps, Worker deployment steps, and smoke-test checklist

**Relevant Context:**
- Cloudflare Pages requires `_redirects` (or `_headers`) files in the build output root for SPA routing
- Workers bound to Pages projects can use `[env.production.routes]` in `wrangler.toml`

**Status:** [x] done

---

## Notes for Implementation

- **Sub-tasks must be executed in order** (1 → 2 → 3 → 4 → 5 → 6 → 7) as each builds on the previous.
- **After Sub-Task 1**, the app will have no streaming capability. Sub-Tasks 2–4 restore it.
- **Resolver logic complexity:** The resolver implementations in Sub-Tasks 2 and 3 are the most complex parts. Each provider's decryption/extraction logic should be implemented faithfully from the referenced GitHub repos. Stream URL patterns rotate, so the implementation must be designed to be easily updated.
- **No provider names in UI:** Every component that previously showed "VidFast" or any server name must be sanitized. The player loading state, error state, and any settings panels must use only stoned.living branded language.
- **Hls.js compatibility:** Use `Hls.isSupported()` to gate Hls.js usage; for Safari (native HLS), fall back to `video.src = m3u8Url` directly.
- **Worker CORS:** During development, allow `*` origin. In production, restrict to `https://stoned.living` and `https://*.stoned-living.pages.dev`.
