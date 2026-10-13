/**
 * Cloudflare Pages Function — VidCore Ad-stripping Proxy
 * Route: /vidcore-proxy/embed/tv/:id/:season/:episode
 *        /vidcore-proxy/embed/movie/:id
 *
 * Fetches VidCore HTML, strips known ad/tracker scripts server-side,
 * returns clean HTML served from your own domain so the iframe is same-origin.
 */

const VIDCORE_BASE = 'https://vidcore44.alwaysdata.net';

/** All ad/tracker domain fragments to block */
const AD_DOMAINS = [
  'holdbitter.com',
  'cdn.holdbitter.com',
  'biomanos.org',
  'apiguinee.org',
  'ferocitycandour.com',
  'alaphoid.com',
  'portalfluently.com',
  'bakestubborn.com',
  'workdeadlinededicate.com',
  'indirectlyrawpick.com',
  'pushcrew.com',
  'onesignal.com',
];

/**
 * Remove <script src="...adDomain...">...</script> tags.
 * Handles single/double quotes, protocol-relative URLs, and self-closing tags.
 */
function stripExternalAdScripts(html: string): string {
  for (const domain of AD_DOMAINS) {
    const esc = domain.replace(/\./g, '\\.');
    const re = new RegExp(
      `<script[^>]+src=["']?(?:https?:)?//[^"'\\s>]*${esc}[^"'\\s>]*["']?[^>]*>[\\s\\S]*?</script>`,
      'gi'
    );
    html = html.replace(re, '<!-- ad-script blocked -->');
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
 */
function stripInlineAdScripts(html: string): string {
  const domainPattern = AD_DOMAINS.map(d => d.replace(/\./g, '\\.')).join('|');
  const re = new RegExp(
    `<script(?:\\s[^>]*)?>([\\s\\S]{0,25000}(?:${domainPattern})[\\s\\S]{0,25000}?)</script>`,
    'gi'
  );
  return html.replace(re, (match) => {
    // Extra safety: never strip scripts containing player configuration or core libraries
    if (/SERVER_IDS|TMDB_KEY|parsePath|hls\.js|player|config|sources/i.test(match)) return match;
    return '<!-- ad-inline blocked -->';
  });
}

/**
 * Remove <link rel="preconnect|dns-prefetch|preload|prefetch"> tags pointing to ad domains.
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
 * Strip the devtools-detection + YouTube redirect script VidCore injects.
 */
function stripDevtoolsScript(html: string): string {
  return html.replace(
    /<script>\s*\(function\s*\(\s*\)\s*\{[\s\S]*?(?:sessionStorage\vert{}youtube\.com)[\s\S]*?\}\s*\)\s*\(\s*\);\s*<\/script>/gi,
    '<!-- devtools-redirect removed -->'
  );
}

/**
 * Rewrite protocol-relative asset URLs to https:// using full domain matching
 * so legitimate CDNs (like jsdelivr) are never accidentally blocked.
 */
function rewriteAssetUrls(html: string): string {
  const domainPattern = AD_DOMAINS.map(d => d.replace(/\./g, '\\.')).join('|');
  const re = new RegExp(`(src|href)="//(?!(?:${domainPattern}))`, 'g');
  return html.replace(re, '$1="https://');
}

/**
 * Inject a <base> tag.
 */
function injectBaseTag(html: string): string {
  return html.replace(/<head([^>]*)>/i, `<head$1><base href="${VIDCORE_BASE}/">`);
}

/**
 * Build a combined runtime-injection script for mobile playback fixes,
 * fullscreen polyfills, and active runtime ad/popup blocking.
 */
function buildMobilePatchScript(): string {
  const adDomainsJson = JSON.stringify(AD_DOMAINS);
  return `<script>
(function() {
  'use strict';

  // ── Runtime Adblocker (Intercepts fetch, XHR, window.open, and dynamic scripts) ──
  var BLOCKED_DOMAINS = ${adDomainsJson};
  function isAdUrl(url) {
    if (!url) return false;
    var lower = String(url).toLowerCase();
    for (var i = 0; i < BLOCKED_DOMAINS.length; i++) {
      if (lower.indexOf(BLOCKED_DOMAINS[i]) !== -1) return true;
    }
    return false;
  }

  // Block window.open popups to ad domains
  var _origOpen = window.open;
  window.open = function(url) {
    if (isAdUrl(url)) {
      console.warn('[Proxy Adblock] Blocked popup:', url);
      return null;
    }
    return _origOpen.apply(this, arguments);
  };

  // Block fetch requests to ad domains
  var _origFetch = window.fetch;
  window.fetch = function(resource, init) {
    var url = (resource instanceof Request) ? resource.url : resource;
    if (isAdUrl(url)) {
      return Promise.reject(new TypeError('Blocked by proxy adblock'));
    }
    return _origFetch.apply(this, arguments);
  };

  // Block XMLHttpRequest to ad domains
  var _origXhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    if (isAdUrl(url)) {
      this.__isBlockedAd = true;
    }
    return _origXhrOpen.apply(this, arguments);
  };
  var _origXhrSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function() {
    if (this.__isBlockedAd) {
      return;
    }
    return _origXhrSend.apply(this, arguments);
  };

  // Remove transparent clickjack overlays over the player
  setInterval(function() {
    var overlays = document.querySelectorAll('div, a');
    for (var i = 0; i < overlays.length; i++) {
      var el = overlays[i];
      if (el.tagName === 'A' && el.getAttribute('href') && el.getAttribute('href') !== '#') {
        var style = window.getComputedStyle(el);
        if (style.position === 'absolute' || style.position === 'fixed') {
          if (parseFloat(style.opacity) < 0.1 || style.zIndex > 999) {
            el.remove();
          }
        }
      }
    }
  }, 1000);

  // ── 1. Status-badge retry watcher ───────────────────────────────────────
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

    video.addEventListener('loadedmetadata', function() {
      if (video.paused) video.play().catch(function() {});
    });

    var _stall = null;
    function armStall() {
      clearTimeout(_stall);
      _stall = setTimeout(function() {
        if (video.readyState >= 3) return;
        var p = window.__player;
        if (p && p.state && !p.state.isDestroying) {
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
          if (!p.state.__autoRetried) {
            p.state.__autoRetried = true;
            p.reload(true);
          }
        } else if (!_retried) {
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
<\/script>`;
}

const RESPONSE_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'public, max-age=120',
  'x-proxy': 'vidcore-ad-stripped',
  'x-frame-options': 'ALLOWALL',
  'content-security-policy': "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;",
  'permissions-policy': 'fullscreen=*, autoplay=*',
};

/** Fetch from VidCore with up to `maxAttempts` retries on non-200 or network error. */
async function fetchWithRetry(vidcoreUrl: string, maxAttempts = 3): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const res = await fetch(vidcoreUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Referer': `${VIDCORE_BASE}/`,
          'Origin': VIDCORE_BASE,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          ...(attempt > 1 ? { 'Cache-Control': 'no-cache' } : {}),
        },
      });
      clearTimeout(timeout);
      if (res.ok) return res;
      if (res.status < 500) return res;
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (err) {
      clearTimeout(timeout);
      lastErr = err;
    }
    if (attempt < maxAttempts) await new Promise(r => setTimeout(r, attempt * 200));
  }
  throw lastErr;
}

export async function onRequest(context: { request: Request; waitUntil?: (p: Promise<any>) => void }): Promise<Response> {
  const url = new URL(context.request.url);

  const vidcorePath = url.pathname.replace(/^\/vidcore-proxy/, '');
  const vidcoreUrl = `${VIDCORE_BASE}${vidcorePath}${url.search}`;

  if (!vidcorePath.startsWith('/embed/')) {
    return new Response('Not found', { status: 404 });
  }

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

    if (!contentType.includes('text/html')) {
      return new Response(upstream.body, {
        status: upstream.status,
        headers: { 'content-type': contentType },
      });
    }

    let html = await upstream.text();

    // --- Ad removal pipeline (order matters) ---
    html = stripExternalAdScripts(html);
    html = stripInlineAdScripts(html);
    html = stripAdLinkTags(html);
    html = stripDevtoolsScript(html);
    html = rewriteAssetUrls(html);
    html = html.replace(/<meta[^>]+http-equiv=["']?(?:x-frame-options|content-security-policy)["']?[^>]*>/gi, '<!-- meta-security stripped -->');

    html = injectBaseTag(html);

    html = html.replace(/,\s*10000\s*\)/g, ', 30000)');

    const autoNextScript = `<script>
(function(){
  (function patchFullscreen() {
    var _orig = Element.prototype.requestFullscreen;
    Element.prototype.requestFullscreen = function() {
      if (_orig && document.fullscreenEnabled !== false) {
        try { return _orig.call(this); } catch(e) {}
      }
      var video = (this.tagName === 'VIDEO' ? this : this.querySelector('video')) ||
                  document.getElementById('main-video') ||
                  document.querySelector('video');
      if (video && video.webkitEnterFullscreen) {
        try { video.webkitEnterFullscreen(); } catch(e) {}
      }
      return Promise.resolve();
    };
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

    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.setAttribute('x-webkit-airplay', 'allow');

    if (!document.fullscreenEnabled && video.webkitEnterFullscreen) {
      video.requestFullscreen = function() {
        try { video.webkitEnterFullscreen(); } catch(e) {}
        return Promise.resolve();
      };
      video.webkitRequestFullscreen = video.requestFullscreen;
    }

    if (!video.__endedBound) {
      video.__endedBound = true;

      video.addEventListener('ended', notifyEnded);

      video.addEventListener('timeupdate', function() {
        if (video.__endedFired) return;
        var dur = video.duration;
        if (!dur || !isFinite(dur) || dur < 10) return;
        if (!video.paused && (dur - video.currentTime) <= 1.5) {
          video.__endedFired = true;
          notifyEnded();
        }
      });

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

    const bodyClose = html.lastIndexOf('</body>');
    if (bodyClose !== -1) {
      html = html.slice(0, bodyClose) + buildMobilePatchScript() + autoNextScript + html.slice(bodyClose);
    } else {
      html += buildMobilePatchScript() + autoNextScript;
    }

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
