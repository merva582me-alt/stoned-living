/**
 * Cloudflare Worker: Streamed.pk HLS Stream Resolver & Ad-Stripping Proxy
 * 
 * Implements the architecture of Lunatic16/streamed-pk-resolver & ppv-hls-proxy:
 * 1. Resolves stream feeds from streamed.pk sources
 * 2. Unlocks and extracts direct CDN HLS (.m3u8) streams
 * 3. Rewrites .m3u8 manifests so all variant playlists and video chunks (.ts / .m4s) route through the proxy
 * 4. Proxies video segments with byte-range support and universal CORS headers (Access-Control-Allow-Origin: *)
 * 5. Rewrites and strips 100% of popup ads, overlay hijacks, and banner scripts from fallback embeds
 */

const STREAMED_API_BASE = "https://streamed.pk";
const DEFAULT_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const BLOCKED_PATTERNS = [
  "/tc/ff-tag.php",
  "/tc/ff-prime.php",
  "/tc/",
  "benchform.org",
  "biomanos.org",
  "apiguinee.org",
  "/brand.js",
  "popads",
  "popunder",
  "aclib",
  "atoptions",
  "/ad.html"
];

// CORS Response Helper
function corsResponse(body, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "*");
  return new Response(body, { ...init, headers });
}

// ── 1. Resolve Stream Metadata & Direct HLS URL ──
async function handleResolve(request, url) {
  const source = url.searchParams.get("source") || "";
  const id = url.searchParams.get("id") || "";
  const streamNo = url.searchParams.get("streamNo") || "1";
  const embedParam = url.searchParams.get("url") || "";

  let targetEmbedUrl = embedParam;

  if (source && id && !targetEmbedUrl) {
    try {
      const apiRes = await fetch(`${STREAMED_API_BASE}/api/stream/${encodeURIComponent(source)}/${encodeURIComponent(id)}`, {
        headers: {
          "Accept": "application/json",
          "User-Agent": DEFAULT_USER_AGENT,
          "Referer": "https://streamed.pk/"
        }
      });

      if (apiRes.ok) {
        const streams = await apiRes.json();
        if (Array.isArray(streams) && streams.length > 0) {
          const selected = streams.find(s => String(s.streamNo) === streamNo) || streams[0];
          targetEmbedUrl = selected?.embedUrl || "";
        }
      }
    } catch (err) {
      console.warn("Error querying streamed.pk API:", err);
    }
  }

  if (!targetEmbedUrl) {
    return corsResponse(JSON.stringify({
      success: false,
      error: "No stream or embed URL could be found for this feed."
    }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  // If targetEmbedUrl is already a direct .m3u8, proxy it immediately
  if (targetEmbedUrl.includes(".m3u8")) {
    const proxiedManifestUrl = `${url.origin}/hls/manifest.m3u8?url=${encodeURIComponent(targetEmbedUrl)}&ref=${encodeURIComponent("https://streamed.pk/")}`;
    return corsResponse(JSON.stringify({
      success: true,
      streamUrl: proxiedManifestUrl,
      rawUrl: targetEmbedUrl,
      isDirectHls: true,
      source: source || "direct"
    }), { headers: { "Content-Type": "application/json" } });
  }

  // Fetch the embed page to inspect for direct HLS playlist URLs
  try {
    const embedOrigin = new URL(targetEmbedUrl).origin;
    const pageRes = await fetch(targetEmbedUrl, {
      headers: {
        "User-Agent": DEFAULT_USER_AGENT,
        "Referer": "https://streamed.pk/",
        "Origin": embedOrigin
      }
    });

    if (pageRes.ok) {
      const html = await pageRes.text();

      // Look for m3u8 playlist patterns
      const m3u8Matches = [
        ...html.matchAll(/(?:file|source|url|hls|src)["']?\s*[:=]\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/gi),
        ...html.matchAll(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/gi)
      ];

      for (const match of m3u8Matches) {
        const candidate = match[1];
        if (candidate && candidate.startsWith("http") && candidate.includes(".m3u8")) {
          const proxiedManifestUrl = `${url.origin}/hls/manifest.m3u8?url=${encodeURIComponent(candidate)}&ref=${encodeURIComponent(embedOrigin + "/")}`;
          return corsResponse(JSON.stringify({
            success: true,
            streamUrl: proxiedManifestUrl,
            rawUrl: candidate,
            isDirectHls: true,
            source: source || "streamed"
          }), { headers: { "Content-Type": "application/json" } });
        }
      }
    }

    // Fallback: Embed with ad-stripping proxy
    const adStrippedEmbedUrl = `${url.origin}/proxy/embed?url=${encodeURIComponent(targetEmbedUrl)}`;
    return corsResponse(JSON.stringify({
      success: true,
      streamUrl: adStrippedEmbedUrl,
      fallbackEmbed: adStrippedEmbedUrl,
      isDirectHls: false,
      source: source || "embed",
      message: "Encrypted stream loaded through ad-stripping embed proxy."
    }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    const adStrippedEmbedUrl = `${url.origin}/proxy/embed?url=${encodeURIComponent(targetEmbedUrl)}`;
    return corsResponse(JSON.stringify({
      success: true,
      streamUrl: adStrippedEmbedUrl,
      fallbackEmbed: adStrippedEmbedUrl,
      isDirectHls: false,
      error: String(err)
    }), { headers: { "Content-Type": "application/json" } });
  }
}

// ── 2. Proxy & Rewrite HLS (.m3u8) Manifest ──
async function handleManifest(request, url) {
  const targetUrl = url.searchParams.get("url");
  const upstreamReferer = url.searchParams.get("ref") || "https://streamed.pk/";

  if (!targetUrl) {
    return corsResponse("Missing url parameter", { status: 400 });
  }

  try {
    const upstreamHeaders = new Headers();
    upstreamHeaders.set("User-Agent", DEFAULT_USER_AGENT);
    upstreamHeaders.set("Referer", upstreamReferer);
    upstreamHeaders.set("Origin", new URL(upstreamReferer).origin);

    const manifestRes = await fetch(targetUrl, {
      method: "GET",
      headers: upstreamHeaders
    });

    if (!manifestRes.ok) {
      return corsResponse(`Failed to fetch upstream manifest: HTTP ${manifestRes.status}`, {
        status: manifestRes.status
      });
    }

    const manifestText = await manifestRes.text();
    const manifestBaseUrl = new URL(targetUrl);

    // Rewrite lines in the .m3u8 playlist
    const lines = manifestText.split(/\r?\n/);
    const rewrittenLines = lines.map(line => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      // Handle URI tags like #EXT-X-KEY:METHOD=...,URI="..."
      if (trimmed.startsWith("#EXT-X-KEY:") && trimmed.includes("URI=\"")) {
        return line.replace(/URI="([^"]+)"/, (_, keyUri) => {
          const absoluteKeyUrl = new URL(keyUri, manifestBaseUrl).toString();
          const proxiedKey = `${url.origin}/hls/segment?url=${encodeURIComponent(absoluteKeyUrl)}&ref=${encodeURIComponent(upstreamReferer)}`;
          return `URI="${proxiedKey}"`;
        });
      }

      if (trimmed.startsWith("#")) {
        return line;
      }

      try {
        const absoluteUri = new URL(trimmed, manifestBaseUrl).toString();
        if (absoluteUri.includes(".m3u8")) {
          return `${url.origin}/hls/manifest.m3u8?url=${encodeURIComponent(absoluteUri)}&ref=${encodeURIComponent(upstreamReferer)}`;
        } else {
          return `${url.origin}/hls/segment?url=${encodeURIComponent(absoluteUri)}&ref=${encodeURIComponent(upstreamReferer)}`;
        }
      } catch {
        return line;
      }
    });

    return corsResponse(rewrittenLines.join("\n"), {
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Cache-Control": "no-cache, no-store, must-revalidate"
      }
    });
  } catch (err) {
    return corsResponse("Error rewriting manifest: " + String(err), { status: 500 });
  }
}

// ── 3. Proxy Media Segments (.ts / .m4s / .aac / keys) ──
async function handleSegment(request, url) {
  const targetUrl = url.searchParams.get("url");
  const upstreamReferer = url.searchParams.get("ref") || "https://streamed.pk/";

  if (!targetUrl) {
    return corsResponse("Missing url parameter", { status: 400 });
  }

  try {
    const upstreamHeaders = new Headers();
    upstreamHeaders.set("User-Agent", DEFAULT_USER_AGENT);
    upstreamHeaders.set("Referer", upstreamReferer);
    upstreamHeaders.set("Origin", new URL(upstreamReferer).origin);

    const rangeHeader = request.headers.get("Range");
    if (rangeHeader) {
      upstreamHeaders.set("Range", rangeHeader);
    }

    const segmentRes = await fetch(targetUrl, {
      method: "GET",
      headers: upstreamHeaders
    });

    const resHeaders = new Headers(segmentRes.headers);
    resHeaders.set("Access-Control-Allow-Origin", "*");
    resHeaders.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    resHeaders.set("Access-Control-Allow-Headers", "*");
    resHeaders.set("Cache-Control", "public, max-age=120");

    return new Response(segmentRes.body, {
      status: segmentRes.status,
      statusText: segmentRes.statusText,
      headers: resHeaders
    });
  } catch (err) {
    return corsResponse("Error proxying segment: " + String(err), { status: 500 });
  }
}

// ── 4. HTMLRewriter Ad-Stripping Proxy for Fallback Embeds ──
class HeadCleaner {
  element(element) {
    element.prepend(`
      <script>
        (function() {
          // 1. Spoof window.open so ad scripts believe the popup opened
          const dummyWin = {
            closed: false,
            focus: function() {},
            blur: function() {},
            close: function() {},
            location: { href: "about:blank" }
          };
          Object.defineProperty(window, "open", {
            value: function() { return dummyWin; },
            writable: false,
            configurable: false
          });

          // 2. Block invisible <a target="_blank"> click-hijacks
          window.addEventListener("click", function(e) {
            const link = e.target.closest("a");
            if (link && link.target === "_blank") {
              e.preventDefault();
              e.stopImmediatePropagation();
            }
          }, true);

          // 3. Auto-remove dynamically injected ad shields & container iframes
          const nukeShields = () => {
            document.querySelectorAll(
              'iframe[id^="container-"], iframe[class^="container-"], div[style*="2147483647"], iframe[style*="2147483647"], div[style*="opacity: 0.01"], iframe[src*="ad.html"]'
            ).forEach(el => el.remove());
          };

          const observer = new MutationObserver(nukeShields);
          observer.observe(document.documentElement, { childList: true, subtree: true });
          window.addEventListener("DOMContentLoaded", nukeShields);
        })();
      </script>
      <style>
        iframe[id^="container-"],
        iframe[class^="container-"],
        div[style*="z-index: 2147483647"],
        iframe[style*="z-index: 2147483647"],
        div[style*="opacity: 0.01"],
        iframe[src*="ad.html"] {
          display: none !important;
          pointer-events: none !important;
          visibility: hidden !important;
          width: 0 !important;
          height: 0 !important;
          z-index: -9999 !important;
        }
      </style>
    `, { html: true });
  }
}

class TagCleaner {
  element(element) {
    const src = (element.getAttribute("src") || "").toLowerCase();
    const href = (element.getAttribute("href") || "").toLowerCase();
    const id = (element.getAttribute("id") || "").toLowerCase();
    const style = (element.getAttribute("style") || "").toLowerCase();

    if (BLOCKED_PATTERNS.some(p => src.includes(p) || href.includes(p))) {
      element.remove();
      return;
    }

    if (id.startsWith("container-") || style.includes("2147483647") || style.includes("opacity: 0.01")) {
      element.remove();
    }
  }
}

async function handleProxyEmbed(request, url) {
  const targetUrlParam = url.searchParams.get("url");
  if (!targetUrlParam) {
    return corsResponse("Missing url parameter", { status: 400 });
  }

  try {
    const targetUrl = new URL(targetUrlParam);
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("Host", targetUrl.host);
    requestHeaders.set("Referer", "https://streamed.pk/");
    requestHeaders.set("Origin", targetUrl.origin);
    requestHeaders.set("User-Agent", DEFAULT_USER_AGENT);

    const response = await fetch(targetUrl.toString(), {
      method: request.method,
      headers: requestHeaders,
      redirect: "follow"
    });

    const responseHeaders = new Headers(response.headers);
    responseHeaders.delete("X-Frame-Options");
    responseHeaders.delete("Content-Security-Policy");
    responseHeaders.set("Access-Control-Allow-Origin", "*");

    const contentType = responseHeaders.get("content-type") || "";

    if (contentType.includes("text/html")) {
      const cleaner = new TagCleaner();
      return new HTMLRewriter()
        .on("head", new HeadCleaner())
        .on("script", cleaner)
        .on("link", cleaner)
        .on("iframe", cleaner)
        .on("div", cleaner)
        .transform(new Response(response.body, {
          status: response.status,
          headers: responseHeaders
        }));
    }

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders
    });
  } catch (err) {
    return corsResponse("Error proxying embed: " + String(err), { status: 500 });
  }
}

// ── 5. Main Request Router ──
export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Handle CORS Preflight
    if (request.method === "OPTIONS") {
      return corsResponse(null, { status: 204 });
    }

    // Health check
    if (url.pathname === "/health" || url.pathname === "/") {
      return corsResponse(JSON.stringify({
        ok: true,
        service: "streamed-pk-hls-resolver",
        version: "1.0.0",
        author: "Lunatic16/streamed-pk-resolver"
      }), { headers: { "Content-Type": "application/json" } });
    }

    // Resolve API: /api/resolve
    if (url.pathname === "/api/resolve" || url.pathname === "/resolve") {
      return handleResolve(request, url);
    }

    // Manifest Proxy: /hls/manifest.m3u8
    if (url.pathname.startsWith("/hls/manifest") || url.pathname.endsWith(".m3u8")) {
      return handleManifest(request, url);
    }

    // Segment Proxy: /hls/segment
    if (url.pathname.startsWith("/hls/segment")) {
      return handleSegment(request, url);
    }

    // Ad-Stripping Embed Proxy: /proxy/embed
    if (url.pathname.startsWith("/proxy/embed")) {
      return handleProxyEmbed(request, url);
    }

    return corsResponse("Not Found", { status: 404 });
  }
};
