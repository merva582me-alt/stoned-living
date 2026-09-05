# stoned.living — Streaming Architecture

## Project Structure

```
stoned-living/
├── src/                        # React 19 frontend (Cloudflare Pages)
│   ├── components/
│   │   ├── WatchPlayer.tsx     # Plyr + Hls.js native video player
│   │   ├── SportsView.tsx      # Live sports catalog view (NEW)
│   │   ├── AdminPanel.tsx      # Stream Health panel + resolver telemetry
│   │   ├── AnimeView.tsx       # Anime tab — AniList primary, TMDb fallback
│   │   └── ...                 # All other existing components preserved
│   ├── services/
│   │   ├── api.ts              # TMDb direct API (no Express backend)
│   │   ├── anilist.ts          # AniList GraphQL service (NEW)
│   │   ├── firebase.ts         # Firebase Auth + Firestore
│   │   └── storage.ts          # LocalStorage user profiles
│   └── types.ts                # Shared TypeScript interfaces
├── workers/
│   └── resolver/               # Standalone Cloudflare Worker
│       ├── src/
│       │   ├── index.ts        # Main fetch handler, CORS, cache layer
│       │   └── resolvers/
│       │       ├── types.ts    # Shared resolver types
│       │       ├── vidsrc.ts   # VidSrc resolver (RC4 decrypt)
│       │       ├── vidlink.ts  # VidLink resolver (AES-CBC decrypt)
│       │       ├── vidcore.ts  # VidCore resolver
│       │       ├── vidup.ts    # VidUp resolver (eval-unpack)
│       │       ├── streamed.ts # Streamed.pk resolver + event listing
│       │       └── daddylive.ts # DaddyLive resolver + schedule
│       ├── wrangler.toml
│       └── package.json
├── public/
│   ├── _headers                # CSP + security headers
│   └── _redirects              # SPA fallback routing
├── wrangler.toml               # Cloudflare Pages config
└── .env.example                # All required environment variables
```

## Local Development

### Prerequisites

- Node.js ≥ 20
- Wrangler CLI: `npm i -g wrangler`

### 1. Install dependencies

```bash
# Frontend
npm install

# Worker
cd workers/resolver && npm install && cd ../..
```

### 2. Set environment variables

```bash
cp .env.example .env
# Fill in VITE_TMDB_API_KEY, VITE_TMDB_READ_TOKEN, Firebase vars
```

### 3. Start both servers in separate terminals

```bash
# Terminal 1 — Vite frontend dev server (port 5173)
npm run dev

# Terminal 2 — Wrangler Worker dev server (port 8787)
cd workers/resolver && npm run dev
```

The Vite dev server proxies all `/api/*` requests to `http://localhost:8787` automatically.

---

## Deployment

### Step 1 — Deploy the Cloudflare Worker

```bash
cd workers/resolver
wrangler deploy
```

Note the deployed Worker URL (e.g. `https://stoned-resolver.YOUR_SUBDOMAIN.workers.dev`).

### Step 2 — Set Cloudflare Pages environment variables

In the Cloudflare dashboard → **Pages → stoned-living → Settings → Environment Variables**, add:

| Variable | Value |
|---|---|
| `VITE_TMDB_API_KEY` | Your TMDb API key |
| `VITE_TMDB_READ_TOKEN` | Your TMDb read access token (JWT) |
| `VITE_RESOLVER_URL` | `https://stoned-resolver.YOUR_SUBDOMAIN.workers.dev` |
| `VITE_FIREBASE_API_KEY` | Firebase API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase app ID |

### Step 3 — Deploy the Pages frontend

```bash
# Via git push (recommended — auto-deploys on push to main)
git push origin main

# Or manually
npm run build
wrangler pages deploy dist --project-name stoned-living
```

---

## Worker API Reference

Base URL: `https://stoned-resolver.YOUR_SUBDOMAIN.workers.dev`

### Resolve a media stream

```
GET /api/resolve?type=movie&id=550
GET /api/resolve?type=tv&id=1396&season=1&episode=1
GET /api/resolve?type=anime&id=21&episode=1&anilist_id=21
```

Response:
```json
{ "url": "https://cdn.example.com/stream/master.m3u8", "provider": "vidsrc" }
```

### Resolve a live sports stream

```
GET /api/resolve?source=sports&provider=streamed&id=MATCH_ID
GET /api/resolve?source=sports&provider=daddylive&id=CHANNEL_ID
```

### Get live sports events

```
GET /api/sports/events?provider=all
GET /api/sports/events?provider=streamed
GET /api/sports/events?provider=daddylive
```

Response:
```json
[
  {
    "id": "123",
    "title": "Manchester City vs Arsenal",
    "sport_category": "Football",
    "provider": "streamed",
    "is_live": true
  }
]
```

### Health check / resolver ping

```
GET /api/health
GET /api/health?resolver=vidsrc
```

---

## Smoke-Test Checklist

After deploying, verify the following manually:

- [ ] **Movie playback** — Open a movie, confirm the loader spins → stream resolves → Plyr player appears and plays
- [ ] **TV episode** — Open a TV show, select season/episode, confirm stream resolves correctly
- [ ] **Anime** — Open an anime from the Anime tab (AniList-sourced), confirm stream resolves via VidSrc anime path
- [ ] **Sports** — Navigate to the Sports tab, confirm live events load from Streamed.pk / DaddyLive, tap an event and confirm the live stream plays
- [ ] **Fallback** — Temporarily set `VITE_RESOLVER_URL` to a bad URL; confirm the player shows "Stream unavailable" error overlay gracefully (no crashes, no provider names exposed)
- [ ] **Admin Panel** → Stream Health — Open the admin panel, confirm all 6 resolver rows show latency readings and ONLINE/OFFLINE status
- [ ] **Firebase Auth** — Sign in with Google, confirm watchlist/stash persist
- [ ] **Age Gate** — Clear localStorage, reload; confirm age gate appears before content
- [ ] **Strain pairings** — Confirm each media card shows a strain pairing (Indica/Sativa/Hybrid badge)
- [ ] **Ambient sound** — Toggle the lofi sound button in the navbar; confirm it plays/stops
