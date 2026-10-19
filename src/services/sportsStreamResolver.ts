import { StreamedStream, ResolvedStreamInfo } from '../types';

const RESOLVER_STORAGE_KEY = 'stoned_sports_resolver_url';

// Complete Cloudflare Worker code matching workers/streamed-pk-resolver-worker.js
export const CLOUDFLARE_WORKER_CODE = `/**
 * Cloudflare Worker: Streamed.pk HLS Stream Resolver & CORS Proxy
 * Lunatic16/streamed-pk-resolver architecture for 100% ad-stripped live sports
 */

const STREAMED_API_BASE = "https://streamed.pk";
const DEFAULT_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function corsResponse(body, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "*");
  return new Response(body, { ...init, headers });
}

async function handleResolve(request, url) {
  const source = url.searchParams.get("source") || "";
  const id = url.searchParams.get("id") || "";
  const streamNo = url.searchParams.get("streamNo") || "1";
  const embedParam = url.searchParams.get("url") || "";

  let targetEmbedUrl = embedParam;

  if (source && id && !targetEmbedUrl) {
    try {
      const apiRes = await fetch(\`\${STREAMED_API_BASE}/api/stream/\${encodeURIComponent(source)}/\${encodeURIComponent(id)}\`, {
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

  if (targetEmbedUrl.includes(".m3u8")) {
    const proxiedManifestUrl = \`\${url.origin}/hls/manifest.m3u8?url=\${encodeURIComponent(targetEmbedUrl)}&ref=\${encodeURIComponent("https://streamed.pk/")}\`;
    return corsResponse(JSON.stringify({
      success: true,
      streamUrl: proxiedManifestUrl,
      rawUrl: targetEmbedUrl,
      isDirectHls: true,
      source: source || "direct"
    }), { headers: { "Content-Type": "application/json" } });
  }

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
        error: \`Embed returned HTTP \${pageRes.status}\`
      }), { status: 502, headers: { "Content-Type": "application/json" } });
    }

    const html = await pageRes.text();
    const m3u8Matches = [
      ...html.matchAll(/(?:file|source|url|hls|src)["']?\\s*[:=]\\s*["'](https?:\\/\\/[^"']+\\.m3u8[^"']*)["']/gi),
      ...html.matchAll(/["'](https?:\\/\\/[^"']+\\.m3u8[^"']*)["']/gi)
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
      const proxiedManifestUrl = \`\${url.origin}/hls/manifest.m3u8?url=\${encodeURIComponent(foundM3u8)}&ref=\${encodeURIComponent(embedOrigin + "/")}\`;
      return corsResponse(JSON.stringify({
        success: true,
        streamUrl: proxiedManifestUrl,
        rawUrl: foundM3u8,
        isDirectHls: true,
        source: source || "streamed"
      }), { headers: { "Content-Type": "application/json" } });
    }

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

async function handleManifest(request, url) {
  const targetUrl = url.searchParams.get("url");
  const upstreamReferer = url.searchParams.get("ref") || "https://streamed.pk/";

  if (!targetUrl) return corsResponse("Missing url parameter", { status: 400 });

  try {
    const upstreamHeaders = new Headers();
    upstreamHeaders.set("User-Agent", DEFAULT_USER_AGENT);
    upstreamHeaders.set("Referer", upstreamReferer);
    upstreamHeaders.set("Origin", new URL(upstreamReferer).origin);

    const manifestRes = await fetch(targetUrl, { method: "GET", headers: upstreamHeaders });
    if (!manifestRes.ok) {
      return corsResponse(\`Upstream manifest HTTP \${manifestRes.status}\`, { status: manifestRes.status });
    }

    const manifestText = await manifestRes.text();
    const manifestBaseUrl = new URL(targetUrl);
    const lines = manifestText.split(/\\r?\\n/);

    const rewrittenLines = lines.map(line => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      if (trimmed.startsWith("#EXT-X-KEY:") && trimmed.includes("URI=\\"")) {
        return line.replace(/URI="([^"]+)"/, (_, keyUri) => {
          const absoluteKeyUrl = new URL(keyUri, manifestBaseUrl).toString();
          const proxiedKey = \`\${url.origin}/hls/segment?url=\${encodeURIComponent(absoluteKeyUrl)}&ref=\${encodeURIComponent(upstreamReferer)}\`;
          return \`URI="\${proxiedKey}"\`;
        });
      }

      if (trimmed.startsWith("#")) return line;

      try {
        const absoluteUri = new URL(trimmed, manifestBaseUrl).toString();
        if (absoluteUri.includes(".m3u8")) {
          return \`\${url.origin}/hls/manifest.m3u8?url=\${encodeURIComponent(absoluteUri)}&ref=\${encodeURIComponent(upstreamReferer)}\`;
        } else {
          return \`\${url.origin}/hls/segment?url=\${encodeURIComponent(absoluteUri)}&ref=\${encodeURIComponent(upstreamReferer)}\`;
        }
      } catch {
        return line;
      }
    });

    return corsResponse(rewrittenLines.join("\\n"), {
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Cache-Control": "no-cache, no-store, must-revalidate"
      }
    });
  } catch (err) {
    return corsResponse("Error rewriting manifest: " + String(err), { status: 500 });
  }
}

async function handleSegment(request, url) {
  const targetUrl = url.searchParams.get("url");
  const upstreamReferer = url.searchParams.get("ref") || "https://streamed.pk/";

  if (!targetUrl) return corsResponse("Missing url parameter", { status: 400 });

  try {
    const upstreamHeaders = new Headers();
    upstreamHeaders.set("User-Agent", DEFAULT_USER_AGENT);
    upstreamHeaders.set("Referer", upstreamReferer);
    upstreamHeaders.set("Origin", new URL(upstreamReferer).origin);

    const rangeHeader = request.headers.get("Range");
    if (rangeHeader) upstreamHeaders.set("Range", rangeHeader);

    const segmentRes = await fetch(targetUrl, { method: "GET", headers: upstreamHeaders });

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

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return corsResponse(null, { status: 204 });
    }

    if (url.pathname === "/health" || url.pathname === "/") {
      return corsResponse(JSON.stringify({
        ok: true,
        service: "streamed-pk-hls-resolver",
        version: "1.0.0",
        author: "Lunatic16/streamed-pk-resolver"
      }), { headers: { "Content-Type": "application/json" } });
    }

    if (url.pathname === "/api/resolve" || url.pathname === "/resolve") {
      return handleResolve(request, url);
    }

    if (url.pathname.startsWith("/hls/manifest") || url.pathname.endsWith(".m3u8")) {
      return handleManifest(request, url);
    }

    if (url.pathname.startsWith("/hls/segment")) {
      return handleSegment(request, url);
    }

    return corsResponse("Not Found", { status: 404 });
  }
};`;

/**
 * Returns the currently active resolver microservice or Cloudflare Worker URL.
 */
export function getResolverBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(RESOLVER_STORAGE_KEY);
    if (saved && saved.trim()) {
      return saved.trim().replace(/\/+$/, '');
    }
  }
  const envUrl = (import.meta.env.VITE_STREAMED_RESOLVER_URL || '').trim();
  return envUrl.replace(/\/+$/, '');
}

/**
 * Persists a user-defined resolver microservice or Cloudflare Worker URL.
 */
export function setResolverBaseUrl(url: string): void {
  if (typeof window !== 'undefined') {
    const cleaned = url.trim().replace(/\/+$/, '');
    if (!cleaned) {
      localStorage.removeItem(RESOLVER_STORAGE_KEY);
    } else {
      localStorage.setItem(RESOLVER_STORAGE_KEY, cleaned);
    }
  }
}

/**
 * Test connectivity to the Cloudflare Worker or resolver microservice.
 */
export async function checkResolverHealth(baseUrl: string): Promise<{ ok: boolean; message: string }> {
  const target = baseUrl.trim().replace(/\/+$/, '');
  if (!target) {
    return { ok: false, message: 'No resolver URL specified.' };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`${target}/health`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    }).catch(async () => {
      return await fetch(`${target}/`, {
        method: 'GET',
        signal: controller.signal,
      });
    });

    clearTimeout(timeout);

    if (res && (res.ok || res.status === 200)) {
      return { ok: true, message: 'Connected successfully! Cloudflare Worker is active and ready.' };
    }
    return { ok: false, message: `Resolver returned HTTP ${res?.status || 'Unknown'}` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Connection failed';
    return { ok: false, message: `Could not reach resolver at ${target}: ${msg}` };
  }
}

// In-memory cache for resolved stream URLs
const streamCache = new Map<string, ResolvedStreamInfo>();

/**
 * Resolves a live sports feed into an ad-stripped, direct HLS video stream.
 */
export async function resolveSportStream(
  stream: StreamedStream,
  options?: { forceFresh?: boolean; signal?: AbortSignal }
): Promise<ResolvedStreamInfo> {
  const cleanEmbed = (stream.embedUrl || '').trim();
  const cacheKey = `${stream.source}-${stream.streamNo || 1}-${cleanEmbed}`;

  if (!options?.forceFresh && streamCache.has(cacheKey)) {
    return streamCache.get(cacheKey)!;
  }

  const resolverBase = getResolverBaseUrl();

  // 1. Direct check: If embedUrl is already direct .m3u8
  if (cleanEmbed.includes('.m3u8')) {
    // If we have a Cloudflare Worker, route through manifest proxy for CORS guarantee
    const streamUrl = resolverBase
      ? `${resolverBase}/hls/manifest.m3u8?url=${encodeURIComponent(cleanEmbed)}&ref=${encodeURIComponent('https://streamed.pk/')}`
      : cleanEmbed;

    const info: ResolvedStreamInfo = {
      success: true,
      streamUrl,
      isDirectHls: true,
      source: stream.source,
      streamNo: stream.streamNo,
    };
    streamCache.set(cacheKey, info);
    return info;
  }

  // 2. Query the Cloudflare Worker or resolver microservice
  if (resolverBase) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      const resolveUrl = new URL(`${resolverBase}/api/resolve`);
      resolveUrl.searchParams.set('url', cleanEmbed);
      if (stream.source) resolveUrl.searchParams.set('source', stream.source);
      if (stream.streamNo) resolveUrl.searchParams.set('streamNo', String(stream.streamNo));
      if (stream.id) resolveUrl.searchParams.set('id', stream.id);

      const res = await fetch(resolveUrl.toString(), {
        headers: { Accept: 'application/json' },
        signal: options?.signal || controller.signal,
      });

      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        const resolvedUrl = data.streamUrl || data.url || data.hlsUrl;

        if (resolvedUrl && typeof resolvedUrl === 'string') {
          const info: ResolvedStreamInfo = {
            success: true,
            streamUrl: resolvedUrl,
            backupUrl: data.backupUrl,
            isDirectHls: true,
            source: stream.source,
            streamNo: stream.streamNo,
            headers: data.headers,
          };
          streamCache.set(cacheKey, info);
          return info;
        }
      }
    } catch (err) {
      console.warn('[sportsStreamResolver] Worker resolution failed:', err);
    }
  }

  // 3. Fallback: Return embed URL as safe fallback
  const fallbackInfo: ResolvedStreamInfo = {
    success: false,
    streamUrl: cleanEmbed,
    isDirectHls: false,
    source: stream.source,
    streamNo: stream.streamNo,
    error: resolverBase
      ? 'Feed is using encrypted player. Displaying mirror embed.'
      : 'Connect Cloudflare Worker in settings for 100% ad-stripped raw HLS streams.',
  };

  return fallbackInfo;
}
