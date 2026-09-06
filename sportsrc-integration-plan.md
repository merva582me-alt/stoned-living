# sportsrc.org Integration Plan

## Top-Level Overview

Replace streamed.pk as the **primary** data source for live sports with the sportsrc.org API.
Streamed.pk is demoted to a **secondary / backup** source — its streams are silently tried in
parallel and any that resolve are surfaced as extra numbered servers in the player's stream
switcher. No provider name (sportsrc, streamed.pk, or any other) is ever shown in the UI.

### API Facts (verified from docs images)

| Endpoint | Required params | Notes |
|---|---|---|
| `?type=sports` | — (auth only) | Lists available sport categories |
| `?type=matches` | `sport`, `status`, `date` | `status=inprogress` for live; omit status for all |
| `?type=detail` | `id` | Returns core match data including streaming URLs |

- **Base URL**: `https://api.sportsrc.org/v2/`
- **Auth**: `X-API-KEY: <key>` header (recommended; set server-side only — never in browser)
- **iframe required attributes**: `width="100%" height="100%" frameborder="0" scrolling="no" allow="autoplay; fullscreen; encrypted-media" allowfullscreen` — **no `sandbox` attribute**

---

## Known Design Constraints (address before implementing)

### C1 — Worker proxy must forward query params intact
The sportsrc.org API is entirely query-param based (`?type=matches&sport=football&date=...`).
The new Worker handler must forward the incoming request's query string **as-is** using
`new URL(req.url).search` — not by re-building params from pathname. This avoids any risk of
multi-value params, encoding edge cases, or param ordering issues.

### C2 — No VITE_ API key; use the existing Vite proxy for local dev
`vite.config.ts` already proxies all `/api/*` requests to `http://localhost:8787` (the local
Wrangler dev server). This means client code can call `/api/sportsrc?...` uniformly in both
development and production — the Vite proxy handles dev, the deployed Worker handles production.
**Do NOT add a `VITE_SPORTSRC_DEV_KEY` environment variable.** The key must only live as a
Cloudflare Worker secret. `sportsrcFetch` should always call `/api/sportsrc?...` with no env
variable branching at all.

### C3 — Streamed.pk fallback must not use sportsrc.org match IDs
Streamed.pk uses its own internal match IDs stored in `match.sources[]` (each `{ source, id }`).
These are provider-specific and are distinct from sportsrc.org's `id`. The fallback path in
`openMatch()` must only call `streamedBackupFetch` if the match object contains a non-empty
`sources[]` array with entries that came from streamed.pk's own data. If the match was sourced
entirely from sportsrc.org and has no `sources[]`, the streamed.pk fallback is skipped silently.
The `SportMatch` type will carry an optional `streamedSources?: MatchSource[]` field that is only
populated when the match data originated from (or was matched against) streamed.pk data.

---

## Sub-Tasks

---

### Sub-Task 1 — Worker: Add `/api/sportsrc` proxy route

**Intent**
All browser requests for sportsrc.org data go through the Cloudflare Worker so the `X-API-KEY`
header is injected server-side. The key lives as a Worker secret and never reaches the browser.

**Expected Outcomes**
- A new `handleSportsrc(req, env)` function exists in `workers/resolver/src/index.ts`.
- Requests to `GET /api/sportsrc?<any-params>` are forwarded to
  `https://api.sportsrc.org/v2/?<same-params>` with `X-API-KEY: env.SPORTSRC_API_KEY` added.
- Query params are forwarded by extracting `new URL(req.url).search` directly — not reconstructed
  — satisfying Constraint C1.
- The `Env` interface is extended with `SPORTSRC_API_KEY: string`.
- The main `fetch(req, env)` export's signature is updated to accept `env: Env`.
- The route `pathname === '/api/sportsrc'` is registered in the main fetch handler.
- `workers/resolver/wrangler.toml` gets a comment noting the required secret and setup command.
- `.env.example` is updated to document `SPORTSRC_API_KEY` as a Worker secret only.

**Todo List**
1. Add `Env` interface in `workers/resolver/src/index.ts`:
   ```ts
   interface Env { SPORTSRC_API_KEY: string; }
   ```
2. Update `export default { async fetch(req: Request, env: Env) }` to accept `env`.
3. Write `handleSportsrc(req: Request, env: Env): Promise<Response>`:
   - Extract `new URL(req.url).search` (the raw query string including the `?`).
   - Build target: `` `https://api.sportsrc.org/v2/${search}` `` (search already includes `?`).
   - Fetch with `{ headers: { 'X-API-KEY': env.SPORTSRC_API_KEY, 'Accept': 'application/json' } }`.
   - On non-2xx: return `jsonResponse({ error: `sportsrc returned ${status}` }, status, origin)`.
   - On success: stream the upstream body back with `Content-Type: application/json` + CORS headers.
4. Register route in main handler:
   ```ts
   if (pathname === '/api/sportsrc') return handleSportsrc(req, env);
   ```
5. Thread `env` through the existing route dispatchers that don't need it (no change needed —
   just confirm `handleResolve`, `handleHealth`, `handleSports` don't need `env`).
6. Add to `workers/resolver/wrangler.toml`:
   ```toml
   # Required Worker secret — run once after deployment:
   #   cd workers/resolver && wrangler secret put SPORTSRC_API_KEY
   ```
7. Add to `.env.example` (in the Worker section):
   ```
   # SPORTSRC_API_KEY — Worker secret only. Set via:
   #   cd workers/resolver && wrangler secret put SPORTSRC_API_KEY
   # This key is NEVER a VITE_ variable. The Vite proxy (/api → localhost:8787)
   # handles local dev, so no frontend env var is needed.
   ```

**Relevant Context**
- `workers/resolver/src/index.ts` — `handleSports` at lines 108-140 is the closest pattern, but
  note it uses `pathname` for path-based routing. The new handler must use `search` instead.
- Main fetch export at lines 146-164 — needs `env: Env` added to signature.
- `vite.config.ts` lines 19-25 — existing `/api` proxy to `localhost:8787` means local dev works
  automatically once the Worker secret is loaded via `wrangler dev --env`.

**Status** — `[x] done`

---

### Sub-Task 2 — Frontend: Rewrite SportsView data fetching to use sportsrc.org

**Intent**
Replace all streamed.pk match-list and category fetching with sportsrc.org calls routed through
the Worker proxy at `/api/sportsrc`. Keep the streamed.pk proxy path available for fallback use
only (Sub-Task 3). Satisfy Constraint C2 — no VITE_ key, uniform `/api/sportsrc` path.

**Expected Outcomes**
- `streamedFetch` is renamed to `streamedBackupFetch` to make its backup-only role explicit.
- A new `sportsrcFetch(params)` helper calls `/api/sportsrc?<params>` — no environment variable
  branching, same path in dev and production (Vite proxy handles dev transparently).
- `load()` fetches `?type=sports` first, then for each sport fires both an `inprogress` and an
  all-today matches request in parallel via `Promise.allSettled`.
- Results are merged and deduplicated by match `id` into `liveMatches` / `todayMatches`.
- `APIMatch` type is updated to match sportsrc.org's actual response shape (field names must be
  confirmed from a live API response during implementation — log and inspect).
- `normalise()` maps sportsrc.org fields to the internal `SportMatch` type.
- `SportMatch` gains an optional `streamedSources?: MatchSource[]` field — populated only when
  sportsrc.org match data includes streamed.pk-compatible source entries (see C3).
- The category filter `useEffect` uses `sportsrcFetch` for its per-sport fetch.
- No provider name or URL appears in any rendered string.

**sportsrc.org response shapes (field names TBD)**
The docs images confirm the endpoints exist and their required params, but do not show the JSON
field names. During implementation:
- For `?type=matches`: log the raw response and update `APIMatch` + `normalise()` accordingly.
- For `?type=detail`: log the raw response to find the streaming URL field name (likely `streamUrl`,
  `url`, or `embed_url`). This is used in Sub-Task 3.

**Todo List**
1. Rename `streamedFetch` → `streamedBackupFetch` everywhere in `SportsView.tsx`.
2. Remove the `STREAMED` / `SPORTS_PROXY` constants (keep `SPORTS_PROXY` referenced only from
   `streamedBackupFetch` — or keep the constant, just rename usage).
3. Add `sportsrcFetch(params: Record<string, string>): Promise<Response>`:
   ```ts
   function sportsrcFetch(params: Record<string, string>) {
     return fetch(`/api/sportsrc?${new URLSearchParams(params).toString()}`);
   }
   ```
   No env-var branching — the Vite proxy routes `/api/*` to the local Worker in dev.
4. Update `load()`:
   a. Call `sportsrcFetch({ type: 'sports' })` → parse as `SportCategory[]` → `setCategories()`.
   b. For each category, fire both:
      - `sportsrcFetch({ type: 'matches', sport: cat.name, status: 'inprogress', date: todayStr })`
      - `sportsrcFetch({ type: 'matches', sport: cat.name, date: todayStr })`
      where `todayStr = new Date().toISOString().slice(0, 10)` (YYYY-MM-DD).
   c. `Promise.allSettled` all fetches; merge into `liveMatches` / `todayMatches`, dedup by `id`.
   d. Keep `buildEnrichmentMap()` call unchanged.
5. Update `APIMatch` interface fields to match actual sportsrc.org response (confirm during impl).
6. Update `normalise()` to map sportsrc.org fields → `SportMatch`. Set `sources: []` initially;
   if sportsrc.org's match data includes source entries compatible with streamed.pk, copy them
   to `streamedSources`.
7. Update `SportMatch` interface: add `streamedSources?: MatchSource[]`.
8. Update the category filter `useEffect` (lines 307-322) to use `sportsrcFetch`.

**Relevant Context**
- `src/components/SportsView.tsx`:
  - `streamedFetch` at lines 62-74 → rename + new `sportsrcFetch`
  - `load()` at lines 250-301
  - Category filter `useEffect` at lines 307-322
  - `APIMatch` type at lines 15-24
  - `normalise()` at lines 80-91
  - `SportMatch` type at lines 38-49
- `vite.config.ts` lines 19-25 — existing proxy makes `sportsrcFetch` work in dev with zero config.

**Status** — `[x] done`

---

### Sub-Task 3 — Frontend: Unified stream resolution — sportsrc.org primary, streamed.pk fallback

**Intent**
When a match is opened: fetch the sportsrc.org embed URL (`?type=detail`) as stream "1" and,
only if the match has explicit streamed.pk source entries (`match.streamedSources`), attempt those
as fallback streams in parallel. All results merge into the unified numbered switcher. Satisfies
Constraint C3 — no cross-provider ID contamination.

**Expected Outcomes**
- `openMatch()` always fires `sportsrcFetch({ type: 'detail', id: match.id })`.
- If and only if `match.streamedSources?.length` is non-empty, it also fires
  `streamedBackupFetch` for each source entry.
- All fetches run via `Promise.allSettled` — neither failure blocks the other.
- The sportsrc.org embed URL is placed first as `StreamObj` `streamNo: 1`.
- Valid streamed.pk `StreamObj` results are appended (sorted HD-first, renumbered from 2).
- If the combined result is empty → `setStreamError(true)` (existing error UI unchanged).
- The player iframe exactly matches the sportsrc.org docs specification (see below).
- No provider name appears anywhere in the stream switcher or player UI.

**iframe — exact spec from docs**
```tsx
<iframe
  key={cur.embedUrl}
  src={cur.embedUrl}
  className="w-full h-full border-0"
  scrolling="no"
  allow="autoplay; fullscreen; encrypted-media"
  allowFullScreen
/>
```
Changes vs current (`src/components/SportsView.tsx` lines 424-432):
- Add `scrolling="no"` — currently missing
- Change `allow` to remove `picture-in-picture` — keep only `autoplay; fullscreen; encrypted-media`
- No `sandbox` — already absent ✅

**Todo List**
1. Rewrite `openMatch()`:
   a. Remove the early-exit guard `if (!match.sources?.length)` — sportsrc.org matches may have
      no `sources[]` and that's fine; sportsrc detail is the primary path.
   b. Build fetch list:
      - Always: `sportsrcFetch({ type: 'detail', id: match.id })`
      - Conditionally: `(match.streamedSources ?? []).map(src => streamedBackupFetch(...))`
   c. Run via `Promise.allSettled`.
   d. From sportsrc.org detail response: extract the streaming URL field (field name confirmed
      during Sub-Task 2 implementation). If present, create:
      ```ts
      { id: match.id, streamNo: 1, language: '', hd: true, embedUrl: url, source: 'primary' }
      ```
   e. From streamed.pk results: collect valid `StreamObj[]`, sort HD-first, renumber from 2.
   f. Combine: `[sportsrcStream?, ...backupStreams]`. Filter out any with falsy `embedUrl`.
   g. If combined empty → `setStreamError(true)`.
2. Update the iframe JSX (lines 424-432) to the exact spec above.
3. Audit all string literals in the player section for provider references — none currently
   present; confirm this remains true.

**Relevant Context**
- `src/components/SportsView.tsx`:
  - `openMatch()` at lines 326-356
  - iframe at lines 424-432
  - Stream switcher at lines 388-403
  - `StreamObj` type at lines 26-33
  - `MatchSource` type at line 12

**Status** — `[x] done`

---

### Sub-Task 4 — Config & secrets wiring

**Intent**
Ensure the API key is registered on the deployed Worker and all documentation is accurate.

**Expected Outcomes**
- `.env.example` documents `SPORTSRC_API_KEY` as a Worker secret only, with a clear note that
  no VITE_ variable is needed (the Vite proxy handles local dev).
- `workers/resolver/wrangler.toml` has a comment with the `wrangler secret put` command.
- No API key is present in any committed file.

**Todo List**
1. Confirm `.env.example` was updated in Sub-Task 1.
2. Confirm `workers/resolver/wrangler.toml` has the deployment comment.
3. Confirm `.gitignore` already ignores `.env` — verified.

**Status** — `[x] done`

---

## Deployment Steps (manual — run after implementation)

```bash
# 1. Register the API key as a Worker secret
cd workers/resolver
wrangler secret put SPORTSRC_API_KEY
# When prompted, paste: 0c8457d75effb1169a6da8eddaa58d5c

# 2. Deploy the updated Worker
wrangler deploy

# 3. Build and deploy the Pages frontend (no new env vars needed)
cd ../..
npm run build

# 4. Local dev — no extra setup needed.
#    Run: wrangler dev (in workers/resolver) + vite (in root) side by side.
#    The existing Vite /api proxy routes /api/sportsrc to localhost:8787 automatically.
#    The Worker reads SPORTSRC_API_KEY from wrangler dev's secret store.
```
