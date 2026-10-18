# Implementation Plan - Horizontal Navigation Buttons for Genre & Sports Filters

Add horizontal navigation arrow buttons (`<` and `>`) flanking both ends of the filter pill bars across the **Movies**, **TV Shows / Series**, and **Live Sports Arena** tabs, enabling fast and comfortable browsing with smooth scrolling and dynamic edge-aware disabling.

## User Decisions Summary
- **Positioning**: Flanking both ends of the filter bar (Left arrow on the left, Right arrow on the right).
- **Limit Behavior**: Dim and disable (`opacity-30 cursor-not-allowed pointer-events-none`) when the scroll container reaches the start or end boundary.

---

## Proposed Changes

### 1. Reusable Scroll Controller Hook / Helper
We will implement horizontal scroll control with state tracking:
- `canScrollLeft`: boolean indicating if scroll position is > 0.
- `canScrollRight`: boolean indicating if `scrollLeft + clientWidth < scrollWidth - 2`.
- `scroll(direction: 'left' | 'right')`: smoothly scrolls the container by ~260px–320px (a chunk of 2-3 pills).
- Event listeners for `scroll` and window `resize` with passive observers to keep buttons updated in real-time as users scroll with mouse, trackpad, touch, or click.

### 2. Movies Tab (`src/components/MoviesView.tsx`)
- Wrap the genre pills track with a flanking navigation row:
  - **Left Button**: `<ChevronLeft />` button positioned at the left edge of the genre track.
  - **Scroll Track**: Centered horizontally scrollable track with `no-scrollbar` and `scroll-smooth`.
  - **Right Button**: `<ChevronRight />` button positioned at the right edge of the genre track (before Advance Filter).
- Visual Styling:
  - Rounded-full 32px or 36px circular button matching the app's aesthetic: `bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 hover:border-emerald-500/40`.
  - Disabled state: `opacity-25 cursor-default pointer-events-none` when at boundary.

### 3. TV Shows Tab (`src/components/TvView.tsx`)
- Mirror the flanking navigation layout around the TV genre pills track:
  - Left `<ChevronLeft />` button on the left flank.
  - Right `<ChevronRight />` button on the right flank before the Advance Filter button.
  - Dynamic scroll state updating on mount, scroll, and resize.

### 4. Live Sports Arena Tab (`src/components/SportsView.tsx`)
- Wrap the sports category pill bar (`All Sports`, `Basketball`, `Football`, etc.) with flanking navigation buttons:
  - Left `<ChevronLeft />` button on the left flank.
  - Horizontally scrollable sports category track.
  - Right `<ChevronRight />` button on the right flank.
  - Matches the exact visual polish, border, and hover glow effects.

---

## Verification Plan

### Automated Checks
- Run `lint_applet` to check for missing imports or TypeScript issues.
- Run `compile_applet` to ensure full build success.

### Functional Verification
- Test scrolling to the right: confirm left button enables and right button scrolls smoothly.
- Test scrolling all the way to the end: confirm right button dims and disables.
- Test scrolling back to start: confirm left button dims and disables.
- Verify across Movies, TV Shows, and Sports tabs in both desktop and mobile viewports.
