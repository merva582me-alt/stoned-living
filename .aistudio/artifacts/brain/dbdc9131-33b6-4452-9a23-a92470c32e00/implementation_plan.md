# Single-Card Show Progress & Remaining Time in Continue Watching

Deduplicate TV shows in Continue Watching so each series occupies exactly one card that tracks the most recently watched episode, clean up existing legacy duplicate cards, and replace the static "5% watched" indicator with dynamic remaining episode/movie time formatted as "45m remaining" or "1h 20m remaining".

## User Review & Critical Decisions

> [!IMPORTANT]
> The following product specifications were confirmed via interactive user clarification and govern the implementation:

- **Single Card Per Show**: When streaming TV series (e.g., Reacher), each show will maintain a single card in Continue Watching that updates in-place to the latest watched episode (e.g. updating S1 E1 to S1 E2 instead of creating duplicate cards).
- **Time Remaining Format**: Replace "5% watched" with time remaining formatted as **`45m remaining`** (or **`1h 20m remaining`** for longer content).
- **Automatic Legacy Cleanup**: Deduplication logic in `mergeWatchHistories` will automatically consolidate existing duplicate entries in local storage and Firestore on app boot so the row is immediately cleaned up.

---

## 1. Overview & Core Concept

- **What It Delivers**: A streamlined Continue Watching feed where every show has a single, up-to-date entry displaying the newest episode in progress and how much time is left to watch.
- **Problem Solved**:
  1. Watching sequential episodes previously produced multiple side-by-side cards for the same show (e.g., Reacher S1 E1 and S1 E2 both appearing).
  2. The indicator was fixed to a generic "5% watched" instead of providing meaningful context on how much of the episode remains.
- **Key Experience**: Opening the app immediately presents a clean, non-redundant row showing "Reacher · S1 E2 · 48m remaining".

---

## 2. User Experience & Visual Design

### Key User Flows
1. **Watching Sequential Episodes**:
   - User watches Reacher S1 E1. Continue Watching shows `Reacher · S1 E1 · 45m remaining`.
   - User finishes or switches to Reacher S1 E2. Continue Watching updates the existing Reacher card in-place to `Reacher · S1 E2 · 48m remaining`.
2. **Dynamic Remaining Time Presentation**:
   - Time remaining is calculated from runtime and current playback progress.
   - Formatted cleanly as:
     - Under 60 minutes: `45m remaining`
     - Over 60 minutes: `1h 15m remaining`
   - Progress bar visually reflects the percentage watched while the text clearly states remaining time in emerald monospace font (`text-emerald-400 font-mono text-xs`).
3. **Card Actions**:
   - Clicking the card resumes directly at the latest episode (`S1 E2`).
   - The top-right `X` button removes the show from Continue Watching entirely.

### Visual Layout
- **Shelf Header**: `Continue Watching (count)` with distinct show count (each series counted once).
- **Sub-info Line**: `<span className="text-emerald-400 font-mono font-semibold">45m remaining</span> · <span className="font-mono text-zinc-400">S1 E2</span>`.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Series-Level Keying vs. Episode-Level Keying**
  - *Chosen Approach*: Key watch history by `mediaId` for both movies and TV series, with season and episode stored as attributes that update as the user advances through the show.
  - *Why*: Prevents cluttered shelves filled with 5 different episodes of the same show. Matches Netflix, Prime Video, and Disney+ industry standards.
- **Decision 2: Automatic Deduplication on Sync & Load**
  - *Chosen Approach*: When `mergeWatchHistories` runs on app boot, group existing history records by `mediaId` and keep the one with the newest timestamp or highest season/episode.
  - *Why*: Immediately fixes the user's existing records shown in the screenshot without requiring manual deletion.
- **Decision 3: Episode Duration Heuristics**
  - *Chosen Approach*: Use TMDB runtime from stash details when available; otherwise use standard defaults (50 minutes for 1-hour drama/action shows like Reacher, 24 minutes for anime/comedy, 110 minutes for movies).
  - *Why*: Ensures realistic and helpful remaining times even if TMDB has missing episode-specific runtimes.

---

## 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                       WatchPlayer                           │
│  - Sends playback progress (duration & elapsed seconds)     │
│  - Automatically calculates episode runtime                 │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       storage.ts                            │
│  - updateWatchHistory: finds entry by mediaId (not episode) │
│    and updates in-place to the newest season & episode      │
│  - mergeWatchHistories: consolidates legacy duplicates      │
│  - formatTimeRemaining helper (e.g. "45m remaining")       │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 HomeView & Continue Watching                │
│  - Renders 1 card per show                                  │
│  - Displays "XXm remaining · S1 E2"                         │
│  - Preserves quick remove action and resume playback        │
└─────────────────────────────────────────────────────────────┘
```

### Formatting Implementation
```ts
export function formatTimeRemaining(progressSeconds: number = 0, durationSeconds: number = 3000): string {
  const remaining = Math.max(0, durationSeconds - progressSeconds);
  const minutes = Math.round(remaining / 60);
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m remaining` : `${hours}h remaining`;
  }
  return `${Math.max(1, minutes)}m remaining`;
}
```
