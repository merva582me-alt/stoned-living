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

const RESPONSE_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'public, max-age=300, stale-while-revalidate=600', // cache 5 min — same embed URL is identical
  'x-proxy': 'vidcore-ad-stripped',
  'x-frame-options': 'ALLOWALL',
  'content-security-policy': "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;",
};

export async function onRequest(context: { request: Request; waitUntil?: (p: Promise<any>) => void }): Promise<Response> {
  const url = new URL(context.request.url);

  // Strip the /vidcore-proxy prefix to get the actual VidCore path
  const vidcorePath = url.pathname.replace(/^\/vidcore-proxy/, '');
  const vidcoreUrl = `${VIDCORE_BASE}${vidcorePath}${url.search}`;

  // Only proxy /embed/ paths
  if (!vidcorePath.startsWith('/embed/')) {
    return new Response('Not found', { status: 404 });
  }

  // Check Cloudflare cache first — avoids hitting VidCore on repeat loads
  const cache = caches.default;
  const cacheKey = new Request(vidcoreUrl);
  const cached = await cache.match(cacheKey);
  if (cached) {
    const body = await cached.text();
    return new Response(body, { status: 200, headers: RESPONSE_HEADERS });
  }

  // Abort fetch after 12 s — fail fast rather than hanging until CF's 30 s wall
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const upstream = await fetch(vidcoreUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://vidcore.org/',
        'Origin': 'https://vidcore.org',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    clearTimeout(timeout);

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
    html = stripDevtoolsScript(html);    // devtools → youtube redirect
    html = rewriteAssetUrls(html);       // fix protocol-relative asset URLs
    // Strip any <meta http-equiv="X-Frame-Options"> or CSP meta tags VidCore injects
    html = html.replace(/<meta[^>]+http-equiv=["']?(?:x-frame-options|content-security-policy)["']?[^>]*>/gi, '<!-- meta-security stripped -->');

    // Inject <base> so all relative sub-resource URLs (JS, CSS, fetch) resolve to vidcore.org
    html = injectBaseTag(html);

    // parsePath() reads window.location.pathname which will be /vidcore-proxy/embed/...
    // Patch it once at the JS source level so the player sees /embed/... instead.
    html = html.replace(
      /window\.location\.pathname/g,
      `window.location.pathname.replace(/^\\/vidcore-proxy/,'')`
    );

    const processed = new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' } });
    context.waitUntil?.(cache.put(cacheKey, processed.clone()));

    return new Response(html, { status: 200, headers: RESPONSE_HEADERS });
  } catch (err: any) {
    clearTimeout(timeout);
    const isTimeout = err?.name === 'AbortError';
    return new Response(isTimeout ? 'Upstream timed out' : `Proxy error: ${err}`, {
      status: isTimeout ? 504 : 502,
    });
  }
}
