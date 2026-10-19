/**
 * Cloudflare Worker: Streamed.pk HLS Stream Resolver & CORS Proxy
 * 
 * Implements the architecture of Lunatic16/streamed-pk-resolver & ppv-hls-proxy:
 * 1. Resolves stream feeds from streamed.pk sources
 * 2. Unlocks and extracts direct CDN HLS (.m3u8) streams
 * 3. Rewrites .m3u8 manifests so all variant playlists and video chunks (.ts / .m4s) route through the proxy
 * 4. Proxies video segments with byte-range support and universal CORS headers (Access-Control-Allow-Origin: *)
 * 5. Eliminates 100% of popup ads, overlay hijacks, and banner scripts for all client devices (iPhone, iPad, Android, PC)
 */

const STREAMED_API_BASE = "https://streamed.pk";
const DEFAULT_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

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

  // If source and id were supplied, query streamed.pk API
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

  // Fetch the embed page to extract the underlying .m3u8 playlist URL
  try {
    const embedOrigin = new URL(targetEmbedUrl).origin;
    const pageRes = await fetch(targetEmbedUrl, {
      headers: {
        "User-Agent": DEFAULT_USER_AGENT,
        "Referer": "https://streamed.pk/",
        "Origin": embedOrigin
      }
    });

    if (!pageRes.ok) {
      return corsResponse(JSON.stringify({
        success: false,
        fallbackEmbed: targetEmbedUrl,
        error: `Embed returned HTTP ${pageRes.status}`
      }), { status: 502, headers: { "Content-Type": "application/json" } });
    }

    const html = await pageRes.text();

    // Look for m3u8 playlist patterns in player configuration, script variables, or HLS configs
    const m3u8Matches = [
      ...html.matchAll(/(?:file|source|url|hls|src)["']?\s*[:=]\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/gi),
      ...html.matchAll(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/gi)
    ];

    let foundM3u8 = null;
    for (const match of m3u8Matches) {
      const candidate = match[1];
      if (candidate && candidate.startsWith("http") && candidate.includes(".m3u8")) {
        foundM3u8 = candidate;
        break;
      }
    }

    if (foundM3u8) {
      // Build proxied manifest URL through our Cloudflare Worker
      const proxiedManifestUrl = `${url.origin}/hls/manifest.m3u8?url=${encodeURIComponent(foundM3u8)}&ref=${encodeURIComponent(embedOrigin + "/")}`;
      return corsResponse(JSON.stringify({
        success: true,
        streamUrl: proxiedManifestUrl,
        rawUrl: foundM3u8,
        isDirectHls: true,
        source: source || "streamed"
      }), { headers: { "Content-Type": "application/json" } });
    }

    // If direct m3u8 was not regex-extractable, return fallback embed
    return corsResponse(JSON.stringify({
      success: false,
      isDirectHls: false,
      fallbackEmbed: targetEmbedUrl,
      error: "Stream is using encrypted container or iframe. Playback available via embed mirror."
    }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return corsResponse(JSON.stringify({
      success: false,
      error: "Resolution failed: " + (err instanceof Error ? err.message : String(err)),
      fallbackEmbed: targetEmbedUrl
    }), { status: 500, headers: { "Content-Type": "application/json" } });
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

      // Preserve other comment/directive lines
      if (trimmed.startsWith("#")) {
        return line;
      }

      // Line is a URI to a sub-playlist (.m3u8) or a video segment (.ts / .m4s / .aac)
      try {
        const absoluteUri = new URL(trimmed, manifestBaseUrl).toString();

        if (absoluteUri.includes(".m3u8")) {
          // Sub-playlist: route through handleManifest
          return `${url.origin}/hls/manifest.m3u8?url=${encodeURIComponent(absoluteUri)}&ref=${encodeURIComponent(upstreamReferer)}`;
        } else {
          // Video chunk/segment: route through handleSegment
          return `${url.origin}/hls/segment?url=${encodeURIComponent(absoluteUri)}&ref=${encodeURIComponent(upstreamReferer)}`;
        }
      } catch {
        return line;
      }
    });

    const rewrittenManifest = rewrittenLines.join("\n");

    return corsResponse(rewrittenManifest, {
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

    // Forward byte-range requests for video seeking/buffering
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

// ── 4. Main Request Router ──
export default {
  async fetch(request) {
    const url = new URL(request.url);

    // 1. Handle CORS Preflight
    if (request.method === "OPTIONS") {
      return corsResponse(null, { status: 204 });
    }

    // 2. Health check
    if (url.pathname === "/health" || url.pathname === "/") {
      return corsResponse(JSON.stringify({
        ok: true,
        service: "streamed-pk-hls-resolver",
        version: "1.0.0",
        author: "Lunatic16/streamed-pk-resolver"
      }), { headers: { "Content-Type": "application/json" } });
    }

    // 3. Resolve API: /api/resolve
    if (url.pathname === "/api/resolve" || url.pathname === "/resolve") {
      return handleResolve(request, url);
    }

    // 4. Manifest Proxy: /hls/manifest.m3u8
    if (url.pathname.startsWith("/hls/manifest") || url.pathname.endsWith(".m3u8")) {
      return handleManifest(request, url);
    }

    // 5. Segment Proxy: /hls/segment
    if (url.pathname.startsWith("/hls/segment")) {
      return handleSegment(request, url);
    }

    return corsResponse("Not Found", { status: 404 });
  }
};
