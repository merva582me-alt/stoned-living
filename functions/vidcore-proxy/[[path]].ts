/**
 * Cloudflare Pages Function — VidCore Ad-stripping Proxy
 * Route: /vidcore-proxy/embed/tv/:id/:season/:episode
 *        /vidcore-proxy/embed/movie/:id
 *
 * Fetches VidCore HTML, strips known ad/tracker scripts server-side,
 * returns clean HTML served from your own domain so the iframe is same-origin.
 */

const VIDCORE_BASE = 'https://vidcore.org';

/** All ad/tracker domain fragments to block */
const AD_DOMAINS = [
  // original
  'ferocitycandour.com',
  'alaphoid.com',
  'portalfluently.com',
  'bakestubborn.com',
  'workdeadlinededicate.com',
  'indirectlyrawpick.com',
  'pushcrew.com',
  'onesignal.com',

  // new (biomanos / social-bar / chaturbate style ads)
  'biomanos.org',
  'show-creative1.com',
  'holdbitter.com',
  'apiguinee.org',
];

/**
 * Remove <script src="...adDomain...">...</script> tags.
 * Handles single/double quotes, protocol-relative URLs, and self-closing tags.
 */
function stripExternalAdScripts(html: string): string {
  for (const domain of AD_DOMAINS) {
    const esc = domain.replace(/\./g, '\\.');
    // Matches: <script ... src="(https?:|//)?...domain..." ...>...</script>
    const re = new RegExp(
      `<script[^>]+src=["']?(?:https?:)?//[^"'\\s>]*${esc}[^"'\\s>]*["']?[^>]*>[\\s\\S]*?</script>`,
      'gi'
    );
    html = html.replace(re, '<!-- ad-script blocked -->');
    // Also catch self-closing / no body variant
    const reSelf = new RegExp(
      `<script[^>]+src=["']?(?:https?:)?//[^"'\\s>]*${esc}[^"'\\s>]*["']?[^>]*/?>`,
      'gi'
    );
    html = html.replace(reSelf, '<!-- ad-script blocked -->');
  }
  return html;
}

/**
 * Remove inline <script> blocks that are ad re-injection scripts.
 * These are small scripts (< 20kb) that assign an ad domain URL to a variable
 * and dynamically re-inject it. We deliberately avoid stripping large scripts
 * (the player itself) that merely reference ad domains as detection strings.
 */
function stripInlineAdScripts(html: string): string {
  const domainPattern = AD_DOMAINS.map(d => d.replace(/\./g, '\\.')).join('|');
  // Only match inline scripts where an ad domain appears as an assigned string value:
  //   const AD_SRC = 'https://ferocitycandour.com/...'
  //   s.src = "//alaphoid.com/..."
  //   document.createElement('script')...src = '//alaphoid.com'
  // Use a size cap: replace only if match is under 25,000 chars (player is 110k+)
  const re = new RegExp(
    `<script(?:\\s[^>]*)?>([\\s\\S]{0,25000}(?:${domainPattern})[\\s\\S]{0,25000}?)</script>`,
    'gi'
  );
  return html.replace(re, (match) => {
    // Extra safety: don't strip if it looks like the main player (has CONFIG or SERVER_IDS)
    if (/SERVER_IDS|TMDB_KEY|parsePath|hls\.js/i.test(match)) return match;
    return '<!-- ad-inline blocked -->';
  });
}

/**
 * Remove <link rel="preconnect|dns-prefetch|preload|prefetch"> tags pointing to ad domains.
 * These are used to warm up connections even before the script tag fires.
 */
function stripAdLinkTags(html: string): string {
  for (const domain of AD_DOMAINS) {
    const esc = domain.replace(/\./g, '\\.');
    const re = new RegExp(
      `<link[^>]+href=["']?(?:https?:)?//[^"'\\s>]*${esc}[^"'\\s>]*["']?[^>]*>`,
      'gi'
    );
    html = html.replace(re, '<!-- ad-link blocked -->');
  }
  return html;
}

/**
 * Extra pattern-based stripper for social-bar / chaturbate-style ads
 * that keep rotating domains.
 */
function stripCommonAdPatterns(html: string): string {
  // Block any script that references the known ad networks by keyword
  html = html.replace(
    /<script[^>]+src=["']?(?:https?:)?\/\/[^"'\s>]*(?:biomanos|show-creative|holdbitter|apiguinee|chaturbate)[^"'\s>]*["']?[^>]*>[\s\S]*?<\/script>/gi,
    '<!-- ad-pattern blocked -->'
  );
  // Self-closing / no-body variant
  html = html.replace(
    /<script[^>]+src=["']?(?:https?:)?\/\/[^"'\s>]*(?:biomanos|show-creative|holdbitter|apiguinee|chaturbate)[^"'\s>]*["']?[^>]*\/?>/gi,
    '<!-- ad-pattern blocked -->'
  );
  // Link tags
  html = html.replace(
    /<link[^>]+href=["']?(?:https?:)?\/\/[^"'\s>]*(?:biomanos|show-creative|holdbitter|apiguinee)[^"'\s>]*["']?[^>]*>/gi,
    '<!-- ad-link-pattern blocked -->'
  );
  return html;
}

/**
 * Strip the devtools-detection + YouTube redirect script VidCore injects.
 * It reads sessionStorage and calls window.top.location.replace(youtubeUrl).
 */
function stripDevtoolsScript(html: string): string {
  return html.replace(
    /<script>\s*\(function\s*\(\s*\)\s*\{[\s\S]*?(?:sessionStorage|youtube\.com)[\s\S]*?\}\s*\)\s*\(\s*\);\s*<\/script>/gi,
    '<!-- devtools-redirect removed -->'
  );
}

/**
 * Rewrite protocol-relative asset URLs (//cdn.foo.com/…) to https://
 * so they still load when served from a different origin.
 * Skip any that belong to ad domains.
 */
function rewriteAssetUrls(html: string): string {
  const adFragment = AD_DOMAINS.map(d => d.split('.')[0]).join('|');
  const re = new RegExp(`(src|href)="//(?!(?:${adFragment}))`, 'g');
  return html.replace(re, '$1="https://');
}

/**
 * Inject a <base href="https://vidcore.org/"> tag so all relative sub-resource
 * URLs (scripts, stylesheets, fetch calls using relative paths) resolve back to
 * VidCore's origin rather than the proxy's origin.
 */
function injectBaseTag(html: string): string {
  return html.replace(/<head([^>]*)>/i, `<head$1><base href="https://vidcore.org/">`);
}

/**
 * Build a runtime-injection script that fixes mobile playback.
 *
 * Works for BOTH movies and TV:
 *  1. Watch the status badge: auto-retry once when "All sources failed" appears.
 *     Uses player.reload(true) if available; falls back to page reload.
 *  2. On loadedmetadata call video.play() so autoplay works on iOS/Android
 *     (the native HLS path never calls play() itself).
 *  3. 20 s stall watchdog: if the video hasn't reached canplay/playing/error,
 *     try player.switch(next) if the API is present, or reload if not.
 *
 * All player API calls are guarded so the script never throws on movies where
 * the TV-specific player API shape isn't available.
 */
function buildMobilePatchScript(): string {
  return `<script>
(function() {
  'use strict';

  // ── 1. Status-badge retry watcher ───────────────────────────────────────
  // Works without __player — only watches DOM text so it fires on movies too.
  var _retried = false;
  function watchBadge() {
    var badge = document.getElementById('status-badge') ||
                document.querySelector('[class*="status"]') ||
                document.querySelector('[id*="status"]');
    if (!badge) return;
    new MutationObserver(function() {
      var txt = (badge.textContent || '').trim();
      if (txt.indexOf('All sources failed') !== -1 && !_retried) {
        _retried = true;
        badge.textContent = 'All sources failed \u2014 retrying\u2026';
        setTimeout(function() {
          _retried = false;
          var p = window.__player;
          if (p && !p.state.isDestroying) {
            p.reload(true);
          } else {
            // Fallback: reload the page (inside the iframe) to restart the scrape
            try { window.location.reload(); } catch(e) {}
          }
        }, 2500);
      }
      if (txt.indexOf('Fetching') !== -1 || txt.indexOf('Loading') !== -1 || txt.indexOf('Searching') !== -1) {
        _retried = false;
      }
    }).observe(badge, { childList: true, characterData: true, subtree: true });
  }

  // ── 2 & 3. Video-level patches (autoplay + stall watchdog) ──────────────
  function patchVideo(video) {
    if (video.__mobilePatchApplied) return;
    video.__mobilePatchApplied = true;

    // 2. Autoplay: native HLS path resolves loadedmetadata but never calls play().
    video.addEventListener('loadedmetadata', function() {
      if (video.paused) video.play().catch(function() {});
    });

    // 3. Stall watchdog: 20 s without canplay/playing/error = source is hung.
    var _stall = null;
    function armStall() {
      clearTimeout(_stall);
      _stall = setTimeout(function() {
        if (video.readyState >= 3) return; // HAVE_FUTURE_DATA — already buffering fine
        var p = window.__player;
        if (p && p.state && !p.state.isDestroying) {
          // TV-style player with source switching
          var sources = p.state.sources;
          if (sources && sources.length > 0) {
            var next = (p.state.sourceIdx || 0) + 1;
            if (next < sources.length) {
              try { p['switch'](next); } catch(e) { p.reload(true); }
            } else if (!p.state.__autoRetried) {
              p.state.__autoRetried = true;
              p.reload(true);
            }
            return;
          }
          // Movie-style player — just reload
          if (!p.state.__autoRetried) {
            p.state.__autoRetried = true;
            p.reload(true);
          }
        } else if (!_retried) {
          // No player API — reload the page inside the iframe
          _retried = true;
          try { window.location.reload(); } catch(e) {}
        }
      }, 20000);
    }
    video.addEventListener('loadstart', armStall);
    video.addEventListener('canplay',   function() { clearTimeout(_stall); });
    video.addEventListener('playing',   function() { clearTimeout(_stall); });
    video.addEventListener('error',     function() { clearTimeout(_stall); });
  }

  function init() {
    watchBadge();
    document.querySelectorAll('video').forEach(patchVideo);
    new MutationObserver(function() {
      document.querySelectorAll('video').forEach(patchVideo);
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
<\\/script>`;
}

const RESPONSE_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  // Cache for 2 minutes only — TV show episode changes need fresh scrape results.
  // No stale-while-revalidate: a stale response with exhausted sources would
  // immediately show "All sources failed" to the next viewer of the same episode.
  'cache-control': 'public, max-age=120',
  'x-proxy': 'vidcore-ad-stripped',
  'x-frame-options': 'ALLOWALL',
  'content-security-policy': "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;",
  // Allow fullscreen from within the iframe (required for Permissions Policy on modern browsers)
  'permissions-policy': 'fullscreen=*, autoplay=*',
};

/** Fetch from VidCore with up to `maxAttempts` retries on non-200 or network error. */
async function fetchWithRetry(vidcoreUrl: string, maxAttempts = 3): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    // Give each attempt 12 s; total wall time stays well under CF's 30 s limit.
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const res = await fetch(vidcoreUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Referer': 'https://vidcore.org/',
          'Origin': 'https://vidcore.org',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          // Cache-bust on retry so VidCore doesn't serve a stale/errored page
          ...(attempt > 1 ? { 'Cache-Control': 'no-cache' } : {}),
        },
      });
      clearTimeout(timeout);
      if (res.ok) return res;
      // 5xx from VidCore — worth retrying; 4xx are definitive
      if (res.status < 500) return res;
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (err) {
      clearTimeout(timeout);
      lastErr = err;
    }
    // Brief back-off before retry (200 ms, 400 ms)
    if (attempt < maxAttempts) await new Promise(r => setTimeout(r, attempt * 200));
  }
  throw lastErr;
}

export async function onRequest(context: { request: Request; waitUntil?: (p: Promise<any>) => void }): Promise<Response> {
  const url = new URL(context.request.url);

  // Strip the /vidcore-proxy prefix to get the actual VidCore path.
  // Also strip any query params we added (e.g. autoplay=1) — VidCore uses
  // URL params directly so we keep them, but we must not double-encode them.
  const vidcorePath = url.pathname.replace(/^\/vidcore-proxy/, '');
  const vidcoreUrl = `${VIDCORE_BASE}${vidcorePath}${url.search}`;

  // Only proxy /embed/ paths
  if (!vidcorePath.startsWith('/embed/')) {
    return new Response('Not found', { status: 404 });
  }

  // Cache key uses the full URL including query string (autoplay=1 etc.) so
  // different param combos get separate cache entries.
  const cache = caches.default;
  const cacheKey = new Request(vidcoreUrl);
  const cached = await cache.match(cacheKey);
  if (cached) {
    const body = await cached.text();
    return new Response(body, { status: 200, headers: RESPONSE_HEADERS });
  }

  try {
    const upstream = await fetchWithRetry(vidcoreUrl);

    if (!upstream.ok) {
      return new Response(`Upstream error: ${upstream.status}`, { status: upstream.status });
    }

    const contentType = upstream.headers.get('content-type') || 'text/html';

    // Pass non-HTML content (JS, CSS, images, etc.) straight through
    if (!contentType.includes('text/html')) {
      return new Response(upstream.body, {
        status: upstream.status,
        headers: { 'content-type': contentType },
      });
    }

    let html = await upstream.text();

    // --- Ad removal pipeline (order matters) ---
    html = stripExternalAdScripts(html); // <script src="ad.com/...">
    html = stripInlineAdScripts(html);   // inline blocks mentioning ad domains
    html = stripAdLinkTags(html);        // <link preconnect/dns-prefetch href="ad.com">
    html = stripCommonAdPatterns(html);  // keyword-based social-bar / chaturbate ads
    html = stripDevtoolsScript(html);    // devtools → youtube redirect
    html = rewriteAssetUrls(html);       // fix protocol-relative asset URLs
    // Strip any <meta http-equiv="X-Frame-Options"> or CSP meta tags VidCore injects
    html = html.replace(/<meta[^>]+http-equiv=["']?(?:x-frame-options|content-security-policy)["']?[^>]*>/gi, '<!-- meta-security stripped -->');

    // Inject <base> so all relative sub-resource URLs (JS, CSS, fetch) resolve to vidcore.org
    html = injectBaseTag(html);

    // ── Raise the SSE scrape timeout from 10 s to 30 s ──────────────────────
    // VidCore's player fires: setTimeout(() => { timedOut = true; evtSource.close(); reject(...); }, 10000);
    // We replace ALL bare occurrences of ", 10000)" in setTimeout calls with ", 30000)"
    // so slow networks (mobile, proxy hop) get enough time to receive the source URL.
    html = html.replace(/,\s*10000\s*\)/g, ', 30000)');

    // Inject auto-next-episode bridge + mobile fullscreen polyfill
    const autoNextScript = `<script>
(function(){
  // ── Mobile fullscreen polyfill ───────────────────────────────────────────
  // iOS Safari only supports fullscreen via HTMLVideoElement.webkitEnterFullscreen.
  // Patch Element.prototype.requestFullscreen so any player code that calls it
  // on a non-video element still triggers native fullscreen on the video.
  (function patchFullscreen() {
    var _orig = Element.prototype.requestFullscreen;
    Element.prototype.requestFullscreen = function() {
      // If native fullscreen is supported, use it
      if (_orig && document.fullscreenEnabled !== false) {
        try { return _orig.call(this); } catch(e) {}
      }
      // Fallback: find the nearest video element and use webkitEnterFullscreen
      var video = (this.tagName === 'VIDEO' ? this : this.querySelector('video')) ||
                  document.getElementById('main-video') ||
                  document.querySelector('video');
      if (video && video.webkitEnterFullscreen) {
        try { video.webkitEnterFullscreen(); } catch(e) {}
      }
      return Promise.resolve();
    };
    // Also patch webkitRequestFullscreen / mozRequestFullScreen aliases
    Element.prototype.webkitRequestFullscreen = Element.prototype.requestFullscreen;
    Element.prototype.mozRequestFullScreen = Element.prototype.requestFullscreen;
    Element.prototype.msRequestFullscreen = Element.prototype.requestFullscreen;
  })();

  function notifyEnded() {
    try { window.parent.postMessage({ type: 'ended' }, '*'); } catch(_) {}
  }

  function attachVideoListeners(video) {
    if (video.__patchBound) return;
    video.__patchBound = true;

    // playsinline is required for inline playback on iOS — never remove it.
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.setAttribute('x-webkit-airplay', 'allow');

    // Patch requestFullscreen directly on the video element to use
    // webkitEnterFullscreen when the standard API is unavailable
    if (!document.fullscreenEnabled && video.webkitEnterFullscreen) {
      video.requestFullscreen = function() {
        try { video.webkitEnterFullscreen(); } catch(e) {}
        return Promise.resolve();
      };
      video.webkitRequestFullscreen = video.requestFullscreen;
    }

    // Auto-next bridge
    if (!video.__endedBound) {
      video.__endedBound = true;

      // Primary: native ended event
      video.addEventListener('ended', notifyEnded);

      // Fallback: timeupdate-based detection for HLS/DASH players that never
      // fire 'ended' because they manage segments themselves. Fire when the
      // playhead is within 1.5 s of the duration and the video is not paused.
      video.addEventListener('timeupdate', function() {
        if (video.__endedFired) return;
        var dur = video.duration;
        if (!dur || !isFinite(dur) || dur < 10) return; // ignore ads / short clips
        if (!video.paused && (dur - video.currentTime) <= 1.5) {
          video.__endedFired = true;
          notifyEnded();
        }
      });

      // Reset the fired flag whenever the video src changes (new episode src)
      video.addEventListener('emptied', function() { video.__endedFired = false; });
      video.addEventListener('loadstart', function() { video.__endedFired = false; });
    }
  }

  function init() {
    var v = document.getElementById('main-video') || document.querySelector('video');
    if (v) { attachVideoListeners(v); }
    var obs = new MutationObserver(function() {
      document.querySelectorAll('video').forEach(function(vid) {
        attachVideoListeners(vid);
      });
    });
    obs.observe(document.body || document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
<\/script>`;
    // Inject mobile patch BEFORE autoNext so the badge watcher and video patching
    // are in place before the player finishes initialising.
    // Use lastIndexOf so we insert before the final </body> even if VidCore's
    // HTML has multiple partial occurrences earlier in the markup.
    const bodyClose = html.lastIndexOf('</body>');
    if (bodyClose !== -1) {
      html = html.slice(0, bodyClose) + buildMobilePatchScript() + autoNextScript + html.slice(bodyClose);
    } else {
      html += buildMobilePatchScript() + autoNextScript;
    }

    // ── Fix parsePath() so it works under the /vidcore-proxy prefix ──────────
    // VidCore's parsePath() checks parts[0] === 'embed' but when served via the
    // proxy the pathname is /vidcore-proxy/embed/... so parts[0] is 'vidcore-proxy'
    // and parsePath() returns null immediately → "All sources failed" before any
    // source is even tried.
    //
    // Strategy: inject a <script> that runs BEFORE the player JS and overrides
    // window.location so parsePath() sees the correct /embed/... path.
    // We use Object.defineProperty to make window.location.pathname read-only-safe.
    const pathnamePatch = `<script>
(function() {
  try {
    var _realPathname = window.location.pathname;
    var _patchedPathname = _realPathname.replace(/^\\/vidcore-proxy/, '');
    if (_patchedPathname !== _realPathname) {
      Object.defineProperty(window.location, 'pathname', {
        get: function() { return _patchedPathname; },
        configurable: true
      });
    }
  } catch(e) {
    // Object.defineProperty on window.location may be restricted in some browsers —
    // fall back to patching parsePath directly after it is defined.
    document.addEventListener('DOMContentLoaded', function() {
      if (typeof parsePath === 'function') {
        var _orig = parsePath;
        parsePath = function() {
          var _origPath = window.location.pathname;
          try {
            Object.defineProperty(window.location, 'pathname', {
              get: function() { return _origPath.replace(/^\\/vidcore-proxy/, ''); },
              configurable: true
            });
          } catch(e2) {}
          var result = _orig();
          try {
            Object.defineProperty(window.location, 'pathname', {
              get: function() { return _origPath; },
              configurable: true
            });
          } catch(e3) {}
          return result;
        };
      }
    });
  }
})();
<\/script>`;
    // Inject the pathname patch as the FIRST thing inside <head> so it runs
    // before any other script — especially before parsePath() is called.
    html = html.replace(/<head([^>]*)>/i, `<head$1>${pathnamePatch}`);

    const processed = new Response(html, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=120' },
    });
    context.waitUntil?.(cache.put(cacheKey, processed.clone()));

    return new Response(html, { status: 200, headers: RESPONSE_HEADERS });
  } catch (err: any) {
    const isTimeout = err?.name === 'AbortError';
    return new Response(isTimeout ? 'Upstream timed out' : `Proxy error: ${err}`, {
      status: isTimeout ? 504 : 502,
    });
  }
}
