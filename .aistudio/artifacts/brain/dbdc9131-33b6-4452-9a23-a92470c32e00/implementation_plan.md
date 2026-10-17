# Comprehensive Fix Plan: Watch Progress Reset, Subtitles & Dubs Auto-Load, Settings Persistence, and Full-Site Translation

This plan delivers complete fixes for all four reported issues: resolving the non-functional "Clear Watch Progress" button with a custom confirmation modal and bidirectional Firestore/local sync; enabling subtitles and alternate audio tracks (dubs) with automatic loading based on user preferences; ensuring all playback and subtitle settings persist reliably in Firestore; and implementing full-site UI localization across all seven supported languages.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following user preferences were confirmed via Phase 1 clarifying questions:
> - **Language Translation Scope**: Full UI localization across all navigation, buttons, views, modals, filters, and player controls (English, Spanish, French, German, Japanese, Italian, Portuguese).
> - **Clear Watch Progress Confirmation**: Custom emerald modal dialog with explicit confirmation ("Clear Watch Progress", "Cancel", and safety notice), replacing the unreliable browser `window.confirm()` that fails in iframe and mobile webview environments.
> - **Subtitles & Alternative Audio**: Auto-load preferred subtitle and audio tracks directly from the user's settings into the streaming player, with real-time controls in the player dock for quick adjustments.

---

## 1. Overview & Core Concept

1. **Working Watch Progress Reset**:
   - Replaces `window.confirm()` with an accessible in-app modal matching the emerald/cannabis aesthetic.
   - Clears watch history from local storage and instantly persists the empty list to Cloud Firestore (`saveProfileToFirestore`), preventing real-time Firestore listeners or page refreshes from restoring old progress.
   - Clears active progress across Continue Watching carousels, profile history, and player state.

2. **Subtitles & Dubs (Alternate Audio) Auto-Load**:
   - Passes user preferences directly into the stream URL (`subtitle`, `dubLang`, `dubType`, `language`, `autoplay`).
   - Configures the player iframe with full permissions (`allow="autoplay; fullscreen; encrypted-media; picture-in-picture; accelerometer; gyroscope; web-share"`) and compatible referrer policies so OpenSubtitles and audio tracks load without cross-origin blocks.
   - Adds an interactive Subtitles & Dubs controller in the player dock to toggle subtitles, pick languages, or change audio tracks on the fly.

3. **Settings Persistence & Live Application**:
   - Modifies `SettingsView.tsx`'s `updateSetting` handler to immediately persist changes to Cloud Firestore for authenticated users (`saveProfileToFirestore(updatedUser, true)`), eliminating the bug where settings reverted on reload.
   - Wires playback settings (`autoplay`, `defaultVolume`, `autoSubtitles`, `subtitleLanguage`, `nextEpisode`) directly into both `WatchPlayer` and `SportsWatchPlayer`.

4. **Full-Site Multi-Language Localization (i18n)**:
   - Implements a dedicated internationalization engine (`src/services/i18n.ts`) supporting all 7 site languages (`en`, `es`, `fr`, `de`, `ja`, `it`, `pt`).
   - Translates all UI components: navigation, hero banners, filter tabs, modal cards, strain pairings, media details, settings labels, login modal, search, stash, and player headers.
   - Language selection in Settings immediately switches the whole application in real time and persists across sessions.

---

## 2. User Experience & Visual Design

- **Clear Watch Progress Modal**:
  - Dark emerald glass overlay (`bg-black/80 backdrop-blur-md`) with glowing emerald border (`border-emerald-500/40`).
  - Warning icon with clear explanation: *"Are you sure you want to clear your saved watch progress? This will reset your continue watching list across all devices."*
  - Dual action buttons: *"Keep Progress"* (subtle ghost button) and *"Yes, Clear Progress"* (emerald/red danger button with tactile feedback).
  
- **Player Subtitles & Audio Controls**:
  - Modern bottom dock switcher beside the node selector:
    - **Subs Badge**: Displays active subtitle language (e.g. `Subs: English` or `Subs: Off`) with a quick popup to switch between available languages.
    - **Audio Badge**: Displays active audio track (e.g. `Audio: English (Original)` or `Audio: Spanish Dub`).
  - Seamlessly respects the user's defaults saved in Settings.

- **Full-Site Localization UI**:
  - Selecting a language in Settings updates all text instantly with zero reload.
  - Retains strain naming authenticity (e.g. "OG Kush", "Granddaddy Purple") while translating all category tags, descriptions, button calls-to-action, status pills, and instructional text.

---

## 3. Key Technical Architecture & Implementation Steps

### A. Fix Watch Progress Clearing (`src/components/SettingsView.tsx` & `src/services/storage.ts`)
```
┌─────────────────────────────────────────────────────────────┐
│                   Clear Watch Progress Flow                  │
│                                                             │
│ [Clear Button] ──> [Custom Emerald Modal]                    │
│                          │ (User Confirms)                  │
│                          ▼                                  │
│                 clearWatchHistory()                         │
│                          │                                  │
│           ┌──────────────┴──────────────┐                   │
│           ▼                             ▼                   │
│    localStorage.clear            saveProfileToFirestore     │
│    (instant local)               (remote DB sync)           │
│           │                             │                   │
│           └──────────────┬──────────────┘                   │
│                          ▼                                  │
│           App State (user.watchHistory = [])                │
│           Continue Watching row updates immediately         │
└─────────────────────────────────────────────────────────────┘
```
1. Add state `showClearConfirmModal` to `SettingsView.tsx`.
2. Implement custom confirmation dialog component.
3. Call `clearWatchHistory()`, update local state via `onUpdateUser`, and call `saveProfileToFirestore` so Firestore is synchronized.

### B. Fix Settings Persistence (`src/components/SettingsView.tsx`)
1. In `updateSetting(key, value)`:
   - Save to localStorage with `saveUserProfile(updatedUser)`.
   - Update React parent state with `onUpdateUser(updatedUser)`.
   - If user is authenticated (`isLoggedIn`), call `saveProfileToFirestore(updatedUser, true)` to ensure Firestore persists the setting.
2. Ensure defaults are populated properly on initial load and schema migrations.

### C. Subtitles and Dubs / Alternate Audio Loading (`src/components/WatchPlayer.tsx`)
1. Enhance `getStreamUrl` to include subtitle and audio query parameters:
   - `subtitle=${encodeURIComponent(user?.settings?.autoSubtitles ? (user?.settings?.subtitleLanguage || 'English') : '')}`
   - `dubLang=${encodeURIComponent(user?.settings?.language || 'en')}`
   - `dubType=1`
   - `language=${encodeURIComponent(user?.settings?.language || 'en')}`
2. Ensure iframe attributes include:
   - `allow="autoplay; fullscreen; encrypted-media; picture-in-picture; accelerometer; gyroscope; web-share"`
   - `referrerPolicy="origin-when-cross-origin"`
3. Add in-player Subtitle & Audio indicator and dropdown toggle so users can adjust subtitles and dubs directly during playback.

### D. Full-Site Localization Engine (`src/services/i18n.ts`)
1. Create `src/services/i18n.ts` with comprehensive translation strings for:
   - **Common / Actions**: Search, Play Now, Add to Stash, In Stash, Close, Back, Save, Cancel, Clear, Loading, Error, Success.
   - **Navigation**: Home, Movies, TV Shows, Anime, Sports, My Stash, Settings, Search, VIP Cinephile.
   - **Hero & Carousels**: Trending Now, Continue Watching, Recommended Strains, Top Rated, High THC, Couch-Lock, Cinema Chill.
   - **Settings Tab**: Profile Identity, Weed Avatar Presets, Appearance, Playback & Subtitles, Autoplay, Default Volume, Subtitle Language, Site Language, Clear Watch Progress, Dangerous Zone.
   - **Player**: Stream Nodes, Connecting, Audio Dub, Subtitles, Return to Catalog, Season, Episode.
   - **Stash / Profile**: My Stash, Saved Movies & Series, Watch History, Clear History, Empty Stash Notice, Sign In to Unlock.
2. Provide a reactive `useTranslation(user?.settings?.language)` hook and `t(key)` helper.
3. Connect `useTranslation` to `App.tsx`, `Navbar.tsx`, `HeroSlider.tsx`, `MediaGrid.tsx`, `MediaDetailsModal.tsx`, `SettingsView.tsx`, `UserProfileView.tsx`, `WatchPlayer.tsx`, and `SportsView.tsx`.

---

## 4. Verification & Testing Checklist

- [ ] **Clear Watch Progress**: Click button in Settings; verify custom modal appears; confirm; verify "Continue Watching" row empties and stays empty after refreshing the browser and across sessions.
- [ ] **Subtitles & Dubs**: Open a movie/series in `WatchPlayer`; verify preferred subtitle language auto-loads, iframe permits cross-origin captions, and audio/subtitle switcher in bottom dock works.
- [ ] **Settings Sticking**: Change Autoplay, Subtitle Language, Site Language, and Volume in Settings; refresh the browser; verify all settings remain exactly as selected.
- [ ] **Full-Site Localization**: Switch language to Spanish, French, German, Japanese, Italian, and Portuguese; verify navigation, hero buttons, carousel headers, modal details, and settings immediately reflect the selected language.
- [ ] **Build & Typecheck**: Run `compile_applet` and `lint_applet` to ensure zero compilation or type errors.
