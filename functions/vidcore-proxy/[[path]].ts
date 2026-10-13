/**
 * Cloudflare Pages Function — VidCore Ad-stripping Proxy
 * Route: /vidcore-proxy/embed/tv/:id/:season/:episode
 *        /vidcore-proxy/embed/movie/:id
 *
 * Fetches VidCore HTML, strips known ad/tracker scripts server-side,
 * and injects client-side runtime protection to block dynamic ad injections.
 */

const VIDCORE_BASE = 'https://vidcore.org';

/** All ad/tracker domain fragments to block */
const AD_DOMAINS = [
  'ferocitycandour.com',
  'alaphoid.com',
  'portalfluently.com',
  'bakestubborn.com',
  'workdeadlinededicate.com',
  'indirectlyrawpick.com',
  'pushcrew.com',
  'biomanos.org',
  'show-creative1.com',
  'holdbitter.com',
  'apiguinee.org',
  'onesignal.com',
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
 * Rewrite protocol-relative asset URLs to https://.
 */
function rewriteAssetUrls(html: string): string {
  const adFragment = AD_DOMAINS.map(d => d.split('.')[0]).join('|');
  const re = new RegExp(`(src|href)="//(?!(?:${adFragment}))`, 'g');
  return html.replace(re, '$1="https://');
}

/**
 * Inject a <base href="https://vidcore.org/"> tag.
 */
function injectBaseTag(html: string): string {
  return html.replace(/<head([^>]*)>/i, `<head$1><base href="https://vidcore.org/">`);
}

/**
 * Build a runtime interception script that overrides document.createElement
 * and DOM insertion methods to block dynamic ad script/iframe injection.
 */
function buildRuntimeAdBlockerScript(): string {
  return `<script>
(function() {
  'use strict';
  var AD_DOMAINS = [
    'ferocitycandour.com', 'alaphoid.com', 'portalfluently.com',
    'bakestubborn.com', 'workdeadlinededicate.com', 'indirectlyrawpick.com',
    'pushcrew.com', 'biomanos.org', 'show-creative1.com',
    'holdbitter.com', 'apiguinee.org', 'onesignal.com'
  ];

  function isAdUrl(url) {
    if (!url || typeof url !== 'string') return false;
    return AD_DOMAINS.some(function(domain) {
      return url.indexOf(domain) !== -1;
    });
  }

  var origCreateElement = document.createElement;
  document.createElement = function(tagName) {
    var el = origCreateElement.call(document, tagName);
    var tag = (tagName || '').toLowerCase();

    if (tag === 'script' || tag === 'iframe' || tag === 'link') {
      var urlProp = (tag === 'link') ? 'href' : 'src';
      
      Object.defineProperty(el, urlProp, {
        set: function(val) {
          if (isAdUrl(val)) {
            el.setAttribute(urlProp, 'about:blank');
            return;
          }
          el.setAttribute(urlProp, val);
        },
        get: function() {
          return el.getAttribute(urlProp);
        },
        configurable: true
      });

      var origSetAttribute = el.setAttribute;
      el.setAttribute = function(name, value) {
        if ((name === 'src' || name === 'href') && isAdUrl(value)) {
          return origSetAttribute.call(this, name, 'about:blank');
        }
        return origSetAttribute.apply(this, arguments);
      };
    }
    return el;
  };

  function checkNode(node) {
    if (!node || !node.tagName) return false;
    var tag = node.tagName.toLowerCase();
    if (tag === 'script' || tag === 'iframe') {
      var src = node.src || node.getAttribute('src');
      if (isAdUrl(src)) return true;
    }
    return false;
  }

  var origAppendChild = Element.prototype.appendChild;
  Element.prototype.appendChild = function(child) {
    if (checkNode(child)) return child;
    return origAppendChild.call(this, child);
  };

  var origInsertBefore = Element.prototype.insertBefore;
  Element.prototype.insertBefore = function(newNode, referenceNode) {
    if (checkNode(newNode)) return newNode;
    return origInsertBefore.call(this, newNode, referenceNode);
  };
})();
<\\/script>`;
}

/**
 * Build runtime-injection script that fixes mobile playback.
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
<\\/script>`;
}

const RESPONSE_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'public, max-age=120',
  'x-proxy': 'vidcore-ad-stripped',
  'x-frame-options': 'ALLOWALL',
  'content-security-policy': "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; connect-src * https://*.holdbitter.com 'none';",
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

    // --- Ad removal pipeline ---
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
<\\/script>`;

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
<\\/script>`;

    // Inject the runtime ad blocker and pathname patch at the top of <head>
    const runtimeBlockerScript = buildRuntimeAdBlockerScript();
    html = html.replace(/<head([^>]*)>/i, `<head$1>${runtimeBlockerScript}${pathnamePatch}`);

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
