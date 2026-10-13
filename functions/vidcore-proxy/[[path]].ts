/**
 * Cloudflare Pages Function — VidCore Ad-stripping Proxy
 * Route: /vidcore-proxy/embed/tv/:id/:season/:episode
 *        /vidcore-proxy/embed/movie/:id
 *
 * Fetches VidCore HTML, strips known ad/tracker scripts server-side,
 * rewrites nested iframes so they also go through the proxy,
 * injects a safer runtime ad-blocker + robot-overlay remover.
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

  // current ads
  'biomanos.org',
  'show-creative1.com',
  'holdbitter.com',
  'apiguinee.org',
  'benchform.org',
];

/**
 * Remove <script src="...adDomain...">...</script> tags.
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
    if (/SERVER_IDS|TMDB_KEY|parsePath|hls\.js/i.test(match)) return match;
    return '<!-- ad-inline blocked -->';
  });
}

/**
 * Remove <link> tags pointing to ad domains.
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
 * Extra pattern-based stripper for social-bar / chaturbate-style ads.
 */
function stripCommonAdPatterns(html: string): string {
  html = html.replace(
    /<script[^>]+src=["']?(?:https?:)?\/\/[^"'\s>]*(?:biomanos|show-creative|holdbitter|apiguinee|benchform|chaturbate)[^"'\s>]*["']?[^>]*>[\s\S]*?<\/script>/gi,
    '<!-- ad-pattern blocked -->'
  );
  html = html.replace(
    /<script[^>]+src=["']?(?:https?:)?\/\/[^"'\s>]*(?:biomanos|show-creative|holdbitter|apiguinee|benchform|chaturbate)[^"'\s>]*["']?[^>]*\/?>/gi,
    '<!-- ad-pattern blocked -->'
  );
  html = html.replace(
    /<link[^>]+href=["']?(?:https?:)?\/\/[^"'\s>]*(?:biomanos|show-creative|holdbitter|apiguinee|benchform)[^"'\s>]*["']?[^>]*>/gi,
    '<!-- ad-link-pattern blocked -->'
  );
  return html;
}

/**
 * Strip the devtools-detection + YouTube redirect script.
 */
function stripDevtoolsScript(html: string): string {
  return html.replace(
    /<script>\s*\(function\s*\(\s*\)\s*\{[\s\S]*?(?:sessionStorage|youtube\.com)[\s\S]*?\}\s*\)\s*\(\s*\);\s*<\/script>/gi,
    '<!-- devtools-redirect removed -->'
  );
}

/**
 * Rewrite protocol-relative asset URLs to https://
 */
function rewriteAssetUrls(html: string): string {
  const adFragment = AD_DOMAINS.map(d => d.split('.')[0]).join('|');
  const re = new RegExp(`(src|href)="//(?!(?:${adFragment}))`, 'g');
  return html.replace(re, '$1="https://');
}

/**
 * Rewrite nested iframes that point to vidcore / alwaysdata
 * so they also go through our ad-stripping proxy.
 */
function rewriteNestedIframes(html: string, proxyOrigin: string): string {
  return html.replace(
    /(<iframe[^>]+src=["'])(https?:)?\/\/(?:www\.)?(?:vidcore\.org|[^"'\/]+\.alwaysdata\.net)(\/embed\/[^"']*)(["'][^>]*>)/gi,
    (_match, start, _protocol, path, end) => {
      return `${start}${proxyOrigin}/vidcore-proxy${path}${end}`;
    }
  );
}

/**
 * Inject <base href="https://vidcore.org/">
 */
function injectBaseTag(html: string): string {
  return html.replace(/<head([^>]*)>/i, `<head$1><base href="https://vidcore.org/">`);
}

/**
 * Safer runtime ad-blocker.
 * Only blocks known ad domains. Does not break legitimate createElement usage.
 */
function buildRuntimeAdBlocker(): string {
  const domains = AD_DOMAINS.map(d => `"${d}"`).join(',');
  return `<script>
(function() {
  'use strict';
  var BLOCKED = [${domains}];

  function isBlocked(url) {
    if (!url) return false;
    try {
      var str = (typeof url === 'string' ? url : (url.url || url.href || '')).toLowerCase();
      return BLOCKED.some(function(d) { return str.indexOf(d) !== -1; });
    } catch(e) { return false; }
  }

  // Block only when src/href is set to an ad domain
  var origCreate = Document.prototype.createElement;
  Document.prototype.createElement = function(tagName, options) {
    var el = origCreate.call(this, tagName, options);
    var tag = (tagName || '').toLowerCase();
    if (tag === 'script' || tag === 'link' || tag === 'iframe' || tag === 'img') {
      var desc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'src') ||
                 Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src');
      // Safer: only intercept setAttribute
      var origSet = el.setAttribute.bind(el);
      el.setAttribute = function(name, value) {
        if ((name === 'src' || name === 'href') && isBlocked(value)) {
          console.log('[adblock] blocked setAttribute', value);
          return;
        }
        return origSet(name, value);
      };
    }
    return el;
  };

  // Block fetch to ad domains
  if (window.fetch) {
    var origFetch = window.fetch;
    window.fetch = function(input, init) {
      if (isBlocked(input)) {
        console.log('[adblock] fetch blocked', input);
        return Promise.reject(new TypeError('Blocked by ad blocker'));
      }
      return origFetch.apply(this, arguments);
    };
  }

  // Block XHR to ad domains
  var origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    if (isBlocked(url)) {
      console.log('[adblock] xhr blocked', url);
      // Make it a no-op
      this.send = function() {};
      return;
    }
    return origOpen.apply(this, arguments);
  };

  // Extra safety: remove the "I'm not a robot" overlay if it ever appears
  function removeRobotOverlay() {
    var texts = ['I\\'m not a robot', 'CHECK THE BOX', 'not a robot'];
    document.querySelectorAll('div, section, aside').forEach(function(el) {
      var t = (el.textContent || '').trim();
      if (texts.some(function(s) { return t.indexOf(s) !== -1; }) && el.querySelector('input[type="checkbox"]')) {
        el.style.display = 'none';
        el.remove();
      }
    });
  }

  // Run once on load + watch for late injection
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', removeRobotOverlay);
  } else {
    removeRobotOverlay();
  }
  new MutationObserver(removeRobotOverlay).observe(document.documentElement, {
    childList: true,
    subtree: true
  });
})();
<\/script>`;
}

/**
 * Mobile playback fixes (auto-retry, autoplay, stall watchdog).
 */
function buildMobilePatchScript(): string {
  return `<script>
(function() {
  'use strict';

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
        badge.textContent = 'All sources failed \\u2014 retrying\\u2026';
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
  'cache-control': 'public, max-age=60',   // shorter cache while testing
  'x-proxy': 'vidcore-ad-stripped',
  'x-frame-options': 'ALLOWALL',
  'content-security-policy': "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;",
  'permissions-policy': 'fullscreen=*, autoplay=*',
};

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
          'Referer': 'https://vidcore.org/',
          'Origin': 'https://vidcore.org',
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
  const proxyOrigin = url.origin;

  const vidcorePath = url.pathname.replace(/^\/vidcore-proxy/, '');
  const vidcoreUrl = `${VIDCORE_BASE}${vidcorePath}${url.search}`;

  if (!vidcorePath.startsWith('/embed/')) {
    return new Response('Not found', { status: 404 });
  }

  // Skip cache while debugging – force fresh response
  // const cache = caches.default;
  // const cacheKey = new Request(vidcoreUrl);
  // const cached = await cache.match(cacheKey);
  // if (cached) {
  //   const body = await cached.text();
  //   return new Response(body, { status: 200, headers: RESPONSE_HEADERS });
  // }

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

    // ── Ad removal pipeline ──────────────────────────────────────────────
    html = stripExternalAdScripts(html);
    html = stripInlineAdScripts(html);
    html = stripAdLinkTags(html);
    html = stripCommonAdPatterns(html);
    html = stripDevtoolsScript(html);
    html = rewriteAssetUrls(html);
    html = html.replace(/<meta[^>]+http-equiv=["']?(?:x-frame-options|content-security-policy)["']?[^>]*>/gi, '<!-- meta-security stripped -->');

    // Rewrite nested iframes (vidcore / alwaysdata → our proxy)
    html = rewriteNestedIframes(html, proxyOrigin);

    // Inject <base>
    html = injectBaseTag(html);

    // Raise SSE scrape timeout 10s → 30s
    html = html.replace(/,\s*10000\s*\)/g, ', 30000)');

    // ── Inject scripts ───────────────────────────────────────────────────
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

    // Pathname patch (must run first)
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

    // Inject pathname patch + safer runtime ad-blocker at the very top of <head>
    html = html.replace(
      /<head([^>]*)>/i,
      `<head$1>${pathnamePatch}${buildRuntimeAdBlocker()}`
    );

    return new Response(html, { status: 200, headers: RESPONSE_HEADERS });
  } catch (err: any) {
    const isTimeout = err?.name === 'AbortError';
    return new Response(isTimeout ? 'Upstream timed out' : `Proxy error: ${err}`, {
      status: isTimeout ? 504 : 502,
    });
  }
}
