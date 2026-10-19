# Revised Implementation Plan: Lunatic16 streamed-pk-resolver Cloudflare Worker & Universal Ad-Stripped Player

This plan incorporates the exact architecture of **`Lunatic16/streamed-pk-resolver`** and **`Lunatic16/ppv-hls-proxy`**, tailored to run as a **dedicated Cloudflare Worker** with complete CORS, manifest rewriting, and segment proxying. It also updates the frontend player so that **live sports automatically play raw HLS streams with 100% of ads stripped** across all devices (phones, tablets, and computers).

---

## 1. Specification Alignment with `Lunatic16/streamed-pk-resolver`

### How `Lunatic16/streamed-pk-resolver` Operates
1. **Stream Resolution API**:
   * Accepts queries by source & stream ID (`/api/stream/:source/:id` or `/api/resolve?url=...`).
   * Fetches upstream metadata from the `streamed.pk` public API with domain failover chains (`streamed.pk`, `streamed.st`, `streami.su`).
   * Parses embed pages, extracting direct CDN `.m3u8` master playlists.
2. **Manifest Rewriting Engine (`/hls/manifest.m3u8`)**:
   * Upstream HLS playlists contain relative or absolute URLs to media segments (`.ts`, `.m4s`, `.aac`, encryption keys) hosted on CDN domains that block foreign browser origins.
   * The resolver rewrites each playlist line, repointing sub-variants and segment URIs through the proxy:
     `${workerOrigin}/hls/segment?url=${encodeURIComponent(segmentUrl)}&headers=${encodedHeaders}`
   * Emits `Content-Type: application/vnd.apple.mpegurl` and sets `Access-Control-Allow-Origin: *`.
3. **Segment Proxy (`/hls/segment`)**:
   * Forwards HTTP byte-range requests (`Range` header) and injects required upstream `Referer` and `User-Agent` headers.
   * Returns video chunks with permissive CORS headers so `hls.js` and mobile Safari play uninterrupted.
4. **Ad-Stripping Guarantee**:
   * The browser player connects exclusively to raw video manifests and media chunks.
   * Zero third-party HTML pages, zero `window.open` scripts, zero invisible `<a>` click-hijack layers, and zero overlay iframes are ever loaded by the client.

---

## 2. Dedicated Cloudflare Worker Script (`workers/streamed-pk-resolver-worker.js`)

We will generate a complete, production-grade Cloudflare Worker script that you can deploy with zero external dependencies:

* **Endpoint `/api/resolve`**:
  * Resolves a `streamed.pk` match/stream into an ad-stripped, proxied `.m3u8` URL.
  * Formats response: `{ success: true, streamUrl: "${workerOrigin}/hls/manifest.m3u8?url=...", source: "..." }`.
* **Endpoint `/hls/manifest.m3u8`**:
  * Proxies and rewrites master and variant `.m3u8` playlists.
* **Endpoint `/hls/segment`**:
  * Proxies video chunks (`.ts`, `.m4s`) with HTTP `Range` streaming support.
* **CORS Preflight**:
  * Responds to `OPTIONS` on all routes with `Access-Control-Allow-Origin: *` and `Access-Control-Allow-Headers: *`.
* **Fallback Embed Cleaner**:
  * Includes the `HTMLRewriter` rule set to neutralize inline popup scripts and container divs if an embed fallback is requested.

---

## 3. Frontend Player & Universal Device Optimization

### A. Automatic Ad-Stripping Playback
* When a user opens any match in the **Live Sports Arena**, the player automatically attempts to resolve the direct HLS stream via the Cloudflare Worker.
* If resolved, it immediately launches the raw HLS stream inside the custom HTML5 player—no ads, no popups.
* If a feed is offline or pending kickoff, it displays a friendly status with one-tap switching to other active feeds.

### B. Mobile, Tablet, and Desktop Compatibility
1. **iOS Safari (iPhone & iPad)**:
   * Uses native HLS playback with `playsInline`, `webkit-playsinline`, and `x5-playsinline`.
   * Implements `video.webkitEnterFullscreen()` fallback where the standard container Fullscreen API is blocked on iOS.
2. **Android & Desktop (Chrome, Firefox, Edge, Safari)**:
   * Uses `hls.js` with worker thread acceleration, low-latency live edge tracking, and automatic network error recovery (`hls.startLoad()`).
3. **Responsive Touch UI**:
   * Minimum 44px tap targets for mobile usability.
   * Single tap toggles the sleek dark control overlay without interfering with play/pause.
   * Volume slider with mute memory.
   * Adaptive quality selector (`Auto`, `1080p`, `720p`, `480p`).
   * Live edge synchronization badge (`LIVE`).

### C. In-App Cloudflare Worker Setup Modal
* The in-player **Resolver** settings modal will include:
  * A dedicated **Cloudflare Worker** tab.
  * 1-click **Copy Cloudflare Worker Code** button with the complete script.
  * A simple input to paste your Cloudflare Worker URL (e.g., `https://my-sports-resolver.workers.dev`).
  * Live connectivity tester.
  * Setup instructions for the free Cloudflare dashboard (Workers & Pages > Create Worker > Paste > Deploy).

---

## 4. Verification Plan

1. **Compilation & TypeScript Lint**:
   * Run `npm run lint` (`tsc --noEmit`) to verify zero syntax or typing errors.
   * Run `compile_applet` to confirm Vite production build succeeds.
2. **Device Responsiveness Testing**:
   * Verify layout, buttons, and video surface across phone, tablet, and desktop viewports.
   * Confirm touch interactions on mobile do not cause jumpy scrolling or overlay overlap.
3. **Failover & Feed Switching Testing**:
   * Verify Feed 1, Feed 2, Feed 3, and Refresh buttons operate smoothly.
   * Verify fallback behavior when a stream is not yet live.
