/**
 * Cloudflare Pages Function — embed.st Ad-stripping Proxy
 * Route: /embedst-proxy/embed/{source}/{id}/{streamNo}
 *
 * Fetches embed.st HTML, strips known ad/tracker scripts and iframes server-side,
 * returns clean HTML served from your own domain so the iframe is same-origin.
 *
 * Ad layers stripped (sourced from stoned.living-sports.har):
 *  1. adexchangerapid.com  — pop-under / tab-over RTB exchange
 *  2. onepyrincehyarey.org — ad iframe network (loaded via embed.st/ad.html)
 *  3. bmmads.com           — popunder SSP triggered by onepyrincehyarey iframes
 *  4. filebaseprotector.com — offer-wall / conversion tracking
 *  5. gamerhit.co, adsrise.pro, zog.link — affiliate redirect chain
 *  6. ymvhnxcaanmuy.site   — Adcash CDN for ad exchange script
 *  7. doubleclick.net, googleadservices.com — Google conversion pixels
 */

const EMBEDST_BASE = 'https://embed.st';

/** All ad/tracker domain fragments to block */
const AD_DOMAINS = [
  'adexchangerapid.com',
  'bmmads.com',
  'onepyrincehyarey.org',
  'filebaseprotector.com',
  'gamerhit.co',
  'adsrise.pro',
  'zog.link',
  'ymvhnxcaanmuy.site',
  'sxhvutuncarlb.space',
  'usrpubtrk.com',
  'doubleclick.net',
  'googleadservices.com',
  'cdn-cgi/rum',
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
 * The 635KB obfuscated player script must never be stripped — guard by size (>100KB).
 * Only strip small inline scripts (≤10KB) that reference ad domains.
 */
function stripInlineAdScripts(html: string): string {
  const domainPattern = AD_DOMAINS.map(d => d.replace(/\./g, '\\.')).join('|');
  const re = new RegExp(
    `<script(?:\\s[^>]*)?>([\\s\\S]{1,10000}(?:${domainPattern})[\\s\\S]{0,10000}?)</script>`,
    'gi'
  );
  return html.replace(re, (match) => {
    // Never strip scripts over 100KB — that's the player itself
    if (match.length > 100_000) return match;
    return '<!-- ad-inline blocked -->';
  });
}

/**
 * Strip the tiny inline `aclib.runPop(...)` script that arms a click-triggered
 * pop-under. aclib is loaded inside the obfuscated player bundle and exposes a
 * global; this one-liner activates it. Strip the call but keep the bundle intact.
 */
function stripAclibRunPop(html: string): string {
  return html.replace(
    /<script[^>]*>\s*aclib\s*\.\s*runPop\s*\([^)]*\)\s*;?\s*<\/script>/gi,
    '<!-- ad-popup blocked -->'
  );
}

/**
 * Inject a dummy `aclib` global before the player bundle executes so any
 * remaining aclib.runPop / aclib.runAutoTag calls become no-ops even if the
 * call survives other stripping.
 */
function injectAclibNoop(html: string): string {
  const noop = `<script>window.aclib={runPop:function(){},runAutoTag:function(){},runBanner:function(){}};</script>`;
  // Insert as the very first thing inside <head> (or <html> if no head)
  if (/<head[\s>]/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1>${noop}`);
  }
  return html.replace(/<html([^>]*)>/i, `<html$1>${noop}`);
}

/**
 * Remove <link rel="preconnect|dns-prefetch|preload|prefetch"> tags pointing to ad domains.
 */
function stripAdLinkTags(html: string): string {
  for (const domain of AD_DOMAINS) {
    const esc = domain.replace(/\./g, '\\.');
    // Matches href="//domain.com/..." (with path) AND href="//domain.com" (bare domain)
    const re = new RegExp(
      `<link[^>]+href=["']?(?:https?:)?//${esc}[^"'\\s>]*["']?[^>]*>`,
      'gi'
    );
    html = html.replace(re, '<!-- ad-link blocked -->');
  }
  return html;
}

/**
 * Remove <iframe> tags whose src points to an ad domain or to embed.st/ad.html.
 * embed.st/ad.html is the ad container page that loads all the onepyrincehyarey
 * tracking iframes (confirmed in stoned.living-sports.har line 4313).
 */
function stripAdIframes(html: string): string {
  // Strip embed.st/ad.html iframes explicitly
  html = html.replace(
    /<iframe[^>]+src=["'][^"']*embed\.st\/ad\.html[^"']*["'][^>]*>[\s\S]*?<\/iframe>/gi,
    '<!-- ad-iframe blocked -->'
  );
  html = html.replace(
    /<iframe[^>]+src=["'][^"']*embed\.st\/ad\.html[^"']*["'][^>]*\/?>/gi,
    '<!-- ad-iframe blocked -->'
  );
  // Strip iframes pointing to any ad domain
  for (const domain of AD_DOMAINS) {
    const esc = domain.replace(/\./g, '\\.');
    const re = new RegExp(
      `<iframe[^>]+src=["'][^"']*${esc}[^"']*["'][^>]*>[\\s\\S]*?</iframe>`,
      'gi'
    );
    html = html.replace(re, '<!-- ad-iframe blocked -->');
    const reSelf = new RegExp(
      `<iframe[^>]+src=["'][^"']*${esc}[^"']*["'][^>]*/?>`,
      'gi'
    );
    html = html.replace(reSelf, '<!-- ad-iframe blocked -->');
  }
  return html;
}

/**
 * Rewrite protocol-relative asset URLs (//strmd.b-cdn.net/…) to https://
 * so they still load when served from a different origin.
 * Skip any that belong to ad domains.
 */
function rewriteAssetUrls(html: string): string {
  const adFragment = AD_DOMAINS.map(d => d.split('.')[0]).join('|');
  const re = new RegExp(`(src|href)="//(?!(?:${adFragment}))`, 'g');
  return html.replace(re, '$1="https://');
}

/**
 * Strip the inline script that calls document.body.insertAdjacentHTML to inject
 * a hidden <iframe src="/ad.html">. This script uses a path-relative URL so the
 * domain blocklist can't catch it. It is a small self-contained IIFE (~200 chars).
 * Pattern confirmed in stoned.living-sports.har: the script calls insertAdjacentHTML
 * with a hidden iframe pointing to /ad.html and repeats itself via setTimeout.
 */
function stripAdHtmlScript(html: string): string {
  // Match inline <script> blocks (≤4000 chars) that use insertAdjacentHTML to
  // inject a hidden /ad.html iframe. The script body contains HTML string literals
  // with < chars, so we can't use [^<]*. Use a size-capped [\s\S] match instead.
  return html.replace(
    /<script[^>]*>([\s\S]{0,4000}?insertAdjacentHTML[\s\S]{0,4000}?\/ad\.html[\s\S]{0,500}?)<\/script>/gi,
    '<!-- ad-html-script blocked -->'
  );
}

/**
 * Inject a <base href="https://embed.st/"> tag so all relative sub-resource
 * URLs resolve back to embed.st rather than the proxy origin.
 *
 * embed.st pages start with <html lang="en"><head>... (no standalone <head> line).
 * Target <head> first, fall back to after <html>.
 */
function injectBaseTag(html: string): string {
  const base = `<base href="https://embed.st/">`;
  if (/<head[\s>]/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1>${base}`);
  }
  return html.replace(/<html([^>]*)>/i, `<html$1>${base}`);
}

/**
 * Rewrite window.location.pathname so the player's path parser sees /embed/...
 * instead of /embedst-proxy/embed/...
 *
 * history.replaceState() is the only reliable cross-browser way to change what
 * window.location.pathname returns inside an iframe. Location.prototype
 * descriptor overrides are blocked by browsers as a security measure, and
 * Object.defineProperty on window.location itself throws because location
 * properties are non-configurable.
 *
 * replaceState does NOT trigger a navigation or reload — it only updates the
 * URL bar value. The _redirects rule is updated to passthrough /embed/* so
 * any reload of the rewritten URL also reaches the correct proxy handler.
 *
 * embedPath: the actual embed.st path e.g. /embed/admin/match-id/1
 */
function injectPathnamePatch(html: string, embedPath: string): string {
  const safePath = JSON.stringify(embedPath);
  const patch = '<script>' +
    '(function(){' +
    `try{history.replaceState(null,'',${safePath}+window.location.search+window.location.hash);}` +
    'catch(e){}' +
    '})();' +
    '</' + 'script>';
  if (/<head[\s>]/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1>${patch}`);
  }
  return html.replace(/<html([^>]*)>/i, `<html$1>${patch}`);
}

/**
 * Strip hidden anchor tags pointing to ad domains.
 * embed.st injects <a href="http://sxhvutuncarlb.space/ad/visit.php" style="display:none">
 * as a click-hijack anchor in the body.
 */
function stripAdAnchors(html: string): string {
  for (const domain of AD_DOMAINS) {
    const esc = domain.replace(/\./g, '\\.');
    const re = new RegExp(
      `<a[^>]+href=["']https?://[^"']*${esc}[^"']*["'][^>]*>[\\s\\S]{0,500}?</a>`,
      'gi'
    );
    html = html.replace(re, '<!-- ad-anchor blocked -->');
  }
  return html;
}

const RESPONSE_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'public, max-age=120',
  'x-proxy': 'embedst-ad-stripped',
  'x-frame-options': 'ALLOWALL',
  'content-security-policy': "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;",
  'permissions-policy': 'fullscreen=*, autoplay=*',
};

/** Fetch from embed.st with up to `maxAttempts` retries on non-200 or network error. */
async function fetchWithRetry(embedUrl: string, maxAttempts = 3): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const res = await fetch(embedUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Referer': 'https://embed.st/',
          'Origin': 'https://embed.st',
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

  // Strip the /embedst-proxy prefix to get the actual embed.st path.
  const embedPath = url.pathname.replace(/^\/embedst-proxy/, '');
  const embedUrl = `${EMBEDST_BASE}${embedPath}${url.search}`;

  // Proxy /embed/ paths (the player page) and pass-through supporting paths
  // that the player JS calls relative to the embed.st origin:
  //   /fetch   — stream source fetch API
  //   /api/    — any sub-API calls
  //   /assets/ — JS/CSS assets (already handled by non-HTML passthrough below)
  const isEmbedPage = embedPath.startsWith('/embed/');
  const isPassthrough = !isEmbedPage && (
    embedPath.startsWith('/fetch') ||
    embedPath.startsWith('/api/') ||
    embedPath.startsWith('/assets/') ||
    embedPath.startsWith('/js/') ||
    embedPath.startsWith('/css/')
  );

  if (!isEmbedPage && !isPassthrough) {
    return new Response('Not found', { status: 404 });
  }

  const cache = caches.default;
  const cacheKey = new Request(embedUrl);
  const cached = await cache.match(cacheKey);
  if (cached) {
    const body = await cached.text();
    return new Response(body, { status: 200, headers: RESPONSE_HEADERS });
  }

  // For passthrough paths (non-embed), forward the request directly including method/body
  if (isPassthrough) {
    try {
      const req = context.request;
      const upRes = await fetch(embedUrl, {
        method: req.method,
        headers: {
          'Referer': 'https://embed.st/',
          'Origin': 'https://embed.st',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          ...(req.headers.get('content-type') ? { 'Content-Type': req.headers.get('content-type')! } : {}),
        },
        body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
      });
      const ct = upRes.headers.get('content-type') || 'application/octet-stream';
      return new Response(upRes.body, {
        status: upRes.status,
        headers: {
          'content-type': ct,
          'access-control-allow-origin': '*',
        },
      });
    } catch (err: any) {
      return new Response(`Proxy error: ${err}`, { status: 502 });
    }
  }

  try {
    const upstream = await fetchWithRetry(embedUrl);

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
    html = injectAclibNoop(html);        // dummy aclib global FIRST — before player runs
    html = stripExternalAdScripts(html); // <script src="ad.com/...">
    html = stripInlineAdScripts(html);   // small inline blocks mentioning ad domains
    html = stripAclibRunPop(html);       // aclib.runPop({zoneId:...}) call
    html = stripAdHtmlScript(html);      // inline IIFE that injects <iframe src="/ad.html">
    html = stripAdLinkTags(html);        // <link preconnect/dns-prefetch href="ad.com">
    html = stripAdIframes(html);         // <iframe src="embed.st/ad.html"> and ad domain iframes
    html = stripAdAnchors(html);         // hidden <a href="ad.com"> click-hijack anchors
    html = rewriteAssetUrls(html);       // fix protocol-relative asset URLs

    // Strip any <meta http-equiv="X-Frame-Options"> or CSP meta tags
    html = html.replace(
      /<meta[^>]+http-equiv=["']?(?:x-frame-options|content-security-policy)["']?[^>]*>/gi,
      '<!-- meta-security stripped -->'
    );

    // Inject <base> so all relative sub-resource URLs resolve to embed.st
    html = injectBaseTag(html);

    // Rewrite window.location.pathname so the player sees /embed/... not /embedst-proxy/embed/...
    html = injectPathnamePatch(html, embedPath);

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
