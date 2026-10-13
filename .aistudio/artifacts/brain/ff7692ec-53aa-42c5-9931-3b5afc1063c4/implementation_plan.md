# Migrate Streaming Players Exclusively to Vidstuck (vidstuck.xyz)

Consolidate all movie, TV show, and anime streaming solely into Vidstuck's official embed player. Strip away external multi-server switchers, custom external episode skip controls, theater mode toggles, comments sections, and watch history tracking to deliver a fast, clutter-free viewing interface powered directly by Vidstuck's native player features.

## User Review & Critical Decisions

> [!IMPORTANT]
> - **Sole Streaming Provider**: All movies, TV shows, and anime will strictly use `https://vidstuck.xyz/embed/...` with TMDb identifiers. All legacy providers, proxies (`functions/vidcore-proxy`), and alternative embeds are removed.
> - **Stripped Outer Player Controls**: Per your requirement, external theater mode, external episode skip controls, the comments section, and watch history tracking are decommissioned.
> - **Native Vidstuck Feature Integration**: Vidstuck's built-in parameters will be enabled directly on the embed URL:
>   - `color=10B981` (Stoned.living emerald brand accent)
>   - `branding=STONED.LIVING` (Custom loading screen branding)
>   - `episodeSelector=true` (Vidstuck's built-in season/episode browser)
>   - `nextEpisode=true` (Vidstuck's native next episode button)
>   - `autoplayNextEpisode=true` (Vidstuck's native binge autoplay)
>   - `overlay=true` (Netflix-style pause overlay)
>   - `subtitle=english` (Default subtitle track)

---

## 1. Overview & Core Concept

- **What It Does**: Transforms the `WatchPlayer` component into a streamlined, high-performance cinema player powered 100% by Vidstuck.
- **Target Audience / Persona**: Users who want uninterrupted, full-screen playback with zero interface bloat, native episodic switching inside the player, and instantaneous video startup.
- **Key Value**: Drastically reduces code complexity, eliminates external script injection risks, cleans up the DOM, and provides a sleek player experience using Vidstuck's official parameters.

---

## 2. User Experience & Visual Design

- **Streamlined User Flow**:
  1. User selects any movie, TV series, or anime from the platform.
  2. The watch player view opens directly into a focused cinema layout with a "← Back" button and title header.
  3. The Vidstuck player loads instantly with the emerald branding (`STONED.LIVING`), custom theme (`#10B981`), and pause overlay.
  4. For TV shows and anime series, users browse seasons and episodes directly inside Vidstuck's native overlay/menu controls (`episodeSelector=true`).
  5. Closing the player returns immediately to the previous browsing view.

- **Visual Identity & Theme**:
  - *Palette*: Deep stealth canvas (`#060907` / `#0d1813`) with subtle emerald border framing (`border-emerald-500/30`).
  - *Minimalist Shell*: Uncluttered layout without extraneous server pills, comment forms, or secondary watch tracking cards.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Offloading Episodic Navigation to Vidstuck's Native Player**
  - *Chosen Approach*: Pass `episodeSelector=true`, `nextEpisode=true`, and `autoplayNextEpisode=true` in the iframe URL instead of maintaining complex external React episode carousels.
  - *Why*: Reduces redundant UI, prevents desynchronization between outer state and iframe state, and honors the directive to remove outer episode skip controls.

- **Decision 2: Elimination of Theater Mode, Comments, and Watch History Tracking**
  - *Chosen Approach*: Completely remove the comments feed tab, theater mode state, and watch history tracking listeners from the player.
  - *Why*: Directly aligns with user requirements for a focused, lightweight video player experience.

- **Decision 3: Universal TMDb Routing**
  - *Movie URL*: `https://vidstuck.xyz/embed/movie/{tmdbId}?branding=STONED.LIVING&color=10B981&overlay=true&subtitle=english`
  - *TV & Anime URL*: `https://vidstuck.xyz/embed/tv/{tmdbId}/{season}/{episode}?episodeSelector=true&nextEpisode=true&autoplayNextEpisode=true&branding=STONED.LIVING&color=10B981&overlay=true&subtitle=english`

---

## 4. Technical Architecture & Component Mapping

```
┌─────────────────────────────────────────────────────────────┐
│                       WatchPlayer.tsx                       │
│                                                             │
│  ┌─────────────────────────┐     ┌───────────────────────┐  │
│  │   Active Media Item     │     │ Initial S & Ep Offset │  │
│  │   (TMDb ID, Type)       │     │ (defaults to S1:E1)   │  │
│  └────────────┬────────────┘     └───────────┬───────────┘  │
│               │                              │              │
│               └──────────────┬───────────────┘              │
│                              ▼                              │
│               ┌─────────────────────────────┐               │
│               │  Vidstuck Embed URL Builder │               │
│               │                             │               │
│               │ Parameters:                 │               │
│               │ • branding=STONED.LIVING    │               │
│               │ • color=10B981              │               │
│               │ • overlay=true              │               │
│               │ • subtitle=english          │               │
│               │ • episodeSelector=true (TV) │               │
│               │ • nextEpisode=true (TV)     │               │
│               │ • autoplayNextEpisode=true  │               │
│               └──────────────┬──────────────┘               │
│                              │                              │
│                              ▼                              │
│               ┌─────────────────────────────┐               │
│               │   Focused 16:9 Cinema iFrame│               │
│               │   (Vidstuck Player Engine)  │               │
│               └─────────────────────────────┘               │
└─────────────────────────────────────────────────────────────┘
```

### Detailed Execution Steps
1. **Refactor `src/components/WatchPlayer.tsx`**:
   - Delete all legacy server arrays (`vidsrcme`, `vidlink`, `vidup`, `vidcore-proxy`).
   - Remove `serverIndex` state and the `Server: 1 2 3 4` button group.
   - Remove `theaterMode`, `lightsOff`, and custom episode skip controls (`Prev Ep`, `Next Ep`).
   - Remove the `comments` state, API calls (`fetchComments`, `postComment`), and the entire comments UI/form.
   - Remove watch history auto-syncing (`updateWatchHistory`, `saveProfileToFirestore`).
   - Remove the ad-blocking DOM observer tailored for the old VidCore proxy.
   - Implement clean Vidstuck URL builder with parameters: `branding=STONED.LIVING`, `color=10B981`, `overlay=true`, `subtitle=english`, `episodeSelector=true`, `nextEpisode=true`, and `autoplayNextEpisode=true`.
2. **Clean up `index.html`**:
   - Update DNS preconnect and prefetch headers to `https://vidstuck.xyz`.
   - Update metadata tags to spotlight the VidStuck player integration.
