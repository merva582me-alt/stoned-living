# Separate 24/7 Sports TV Channels & Filter RedZone

Remove "NFL vs RedZone" from the match schedule and isolate 24/7 television broadcast networks into a dedicated "24/7 Live Sports TV Channels" section positioned above the match schedule in the Sports Arena, featuring network brand cards, broadcast badges, and clean head-to-head match scheduling.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following product decisions were confirmed during the planning interview:
> - **Section Placement**: A dedicated "24/7 Live Sports TV Channels" section will be placed directly above "Today's Match Schedule" in the Sports Arena (`SportsView`).
> - **Card Aesthetic & Styling**: 24/7 channels will feature specialized television network cards highlighting network logo imagery, sport category tags, and a glowing emerald `24/7 LIVE` broadcast badge (instead of head-to-head team VS layouts).
> - **Home View Isolation**: 24/7 channels will remain exclusive to the Sports Arena, keeping the Home page live carousel focused strictly on head-to-head match-ups.
> - **RedZone Filtering**: All instances of "NFL vs RedZone" will be thoroughly filtered out across all match feeds.

---

## 1. Overview & Core Concept

Currently, `streamed.pk` aggregates both scheduled head-to-head fixtures (e.g. Monza vs Cagliari) and continuous 24/7 cable/satellite television feeds (e.g. Sky Sports Golf, Tennis Channel, Rally TV, NHL Network, NFL Network, Fox League, Fox Cricket, Willow Cricket) as well as syndicated Sunday recap blocks ("NFL vs RedZone"). Mixing continuous television networks with timed match fixtures clutters "Today's Match Schedule", showing confusing "VS" placeholders and inaccurate kickoff times.

This feature introduces a two-tier architectural separation:
1. **Network Channel Extraction & Classification**: Intelligently classify 24/7 television channels based on channel identifiers and network titles, decoupling them from head-to-head sports games.
2. **Dedicated 24/7 Channel Section**: A high-impact, responsive section above the match schedule featuring television network cards with full stream playback integration through `SportsWatchPlayer`.
3. **Strict Noise Filtering**: Purge "NFL vs RedZone" occurrences from all match lists, carousels, and search queries.

---

## 2. User Experience & Visual Design

### Key User Flows
1. **Navigating to Sports Arena**: The user opens the Sports view (`tab=sports`).
2. **Browsing 24/7 Channels**: At the top of the content area (beneath category filters and live games, immediately above "Today's Match Schedule"), the user sees a dedicated **"24/7 Live Sports TV Channels"** section with a count badge.
3. **Interacting with Channel Cards**:
   - Each card displays the network's high-definition logo/poster in a clean 16:9 or 4:3 framed container.
   - A glowing emerald badge displays `24/7 LIVE` with a signal icon.
   - Clean unboxed metadata shows the sport category (e.g., `Golf`, `Tennis`, `American Football`, `Cricket`) and stream source count.
   - An "Open Channel" CTA button launches `SportsWatchPlayer` for continuous playback.
4. **Viewing Clean Match Schedule**: Scrolling down, "Today's Match Schedule" contains exclusively head-to-head sports fixtures (team vs team with club crests and kickoff timestamps) with zero 24/7 TV channels or "NFL vs RedZone" clutter.

### Visual Identity & Theme
- **Theme Tokens**: Dark OLED aesthetic (`#050806` canvas, `#090e0b` card surfaces, `#0c1410` hover states).
- **Accents**: Emerald signal glow (`text-[#00df82]`, `border-emerald-500/30`, `shadow-[0_0_20px_rgba(0,223,130,0.15)]`).
- **Typography**: Bebas Neue display titles, Plus Jakarta Sans body, and font-mono tabular numerics.
- **Card Layout**: Responsive 2-column (`sm:`) to 4-column (`xl:`) grid with minimum touch target $\ge 44\text{px}$ on mobile.

---

## 3. Key Product Decisions & Trade-Offs

### Decision 1: Identification & Classification Heuristics
- **Chosen Approach**: Combine strict canonical channel title matching (`Sky Sports Golf`, `Tennis Channel`, `Rally TV` / `Rally Channel`, `NHL Network`, `NFL Network`, `Fox League`, `Fox Cricket`, `Willow Cricket`) with pattern matching (`ppv-*` / `admin-*` IDs without home/away teams).
- **Why**: Resilient against minor API naming shifts (e.g., "Rally TV" vs "Rally Channel") while preventing false positives on real games that happen to be broadcast on those networks.

### Decision 2: RedZone Removal Policy
- **Chosen Approach**: Filter out matches matching `/^nfl vs redzone$/i` and `/redzone/i` at the data service layer (`sportsApi.ts`) before data propagates to views and carousels.
- **Why**: Centralizing the filter in the data ingestion pipeline guarantees RedZone will never appear in `SportsView`, `SportMatchCarousel`, `HomeView`, or search results.

---

## 4. Technical Architecture & Data Strategy

```
┌──────────────────────────────────────────────────────────────┐
│                     streamed.pk API                          │
│          (/api/matches/all-today, /api/matches/live)         │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                    sportsApi.ts Layer                        │
│  - isNflRedzoneFilter() ➔ Completely drops RedZone entries   │
│  - is247TvChannel()     ➔ Identifies 24/7 Network Channels   │
└──────────────┬───────────────────────────────┬───────────────┘
               │                               │
               ▼                               ▼
┌──────────────────────────────┐ ┌─────────────────────────────┐
│    24/7 Sports TV Channels   │ │    Head-to-Head Matches     │
│  - Sky Sports Golf           │ │  - Monza vs Cagliari        │
│  - Tennis Channel            │ │  - Parma vs Torino          │
│  - Rally TV / Channel        │ │  - Real Madrid vs Barcelona │
│  - NHL Network               │ └─────────────┬───────────────┘
│  - NFL Network               │               │
│  - Fox League / Cricket      │               ▼
│  - Willow Cricket            │ ┌─────────────────────────────┐
└──────────────┬───────────────┘ │  "Today's Match Schedule"   │
               │                 │  & Home Live Carousel       │
               ▼                 └─────────────────────────────┘
┌──────────────────────────────┐
│ "24/7 Live Sports TV" Grid   │
│ (Above Today's Match Sched)  │
└──────────────────────────────┘
```

### Component & File Strategy:
1. `src/services/sportsApi.ts`:
   - Add `isNflRedzone(match: APIMatch): boolean` to purge "NFL vs RedZone".
   - Add `is247TvChannel(match: APIMatch): boolean` to cleanly partition 24/7 television networks.
   - Export partitioned helpers `fetchSportsData()` or split in `SportsView`.
2. `src/components/SportsView.tsx`:
   - Compute `tvChannels` and `scheduledMatches` from filtered data.
   - Render the new **"24/7 Live Sports TV Channels"** section with custom network cards directly above "Today's Match Schedule".
   - Render filtered `scheduledMatches` in "Today's Match Schedule" (ensuring RedZone and TV networks never mix into the match list).
3. `src/components/SportMatchCarousel.tsx` & `src/components/HomeView.tsx`:
   - Ensure RedZone is excluded and Home carousel displays genuine head-to-head matches.
