/**
 * Cloudflare Pages Function & Worker — VidCore Ad-stripping & Subtitle Passthrough Proxy
 * Routes: /vidcore-proxy/*
 *
 * Targets: EdgeOne / VidCore upstream with ad/tracker script neutralization,
 * while allowing subtitles (.vtt, .srt), HLS streams (.m3u8, .ts), and media through.
 */

const TARGET_ORIGIN = "https://4565565.edgeone.dev";
const UPSTREAM_REFERER = "https://vidcore.org/";

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
  "ferocitycandour.com",
  "alaphoid.com",
  "portalfluently.com",
  "bakestubborn.com",
  "workdeadlinededicate.com",
  "indirectlyrawpick.com",
  "pushcrew.com",
  "onesignal.com"
];

class HeadCleaner {
  element(element: any) {
    element.prepend(`
      <script>
        (function() {
          // 1. Spoof window.open so ad scripts think the popup opened
          const dummyWin = {
            closed: false,
            focus: function() {},
            blur: function() {},
            close: function() {},
            location: { href: "about:blank" }
          };
          try {
            Object.defineProperty(window, "open", {
              value: function() { return dummyWin; },
              writable: false,
              configurable: false
            });
          } catch(e) {}

          // 2. Block invisible <a target="_blank"> click-hijacks
          window.addEventListener("click", function(e) {
            const link = e.target && e.target.closest ? e.target.closest("a") : null;
            if (link && (link.getAttribute("target") === "_blank" || link.style?.position === "fixed" || link.style?.zIndex > 1000)) {
              e.preventDefault();
              e.stopImmediatePropagation();
            }
          }, true);

          // 3. Auto-remove dynamically injected z-index: 2147483647 shields & container-* iframes
          const nukeShields = () => {
            try {
              document.querySelectorAll(
                'iframe[id^="container-"], iframe[class^="container-"], div[style*="2147483647"], iframe[style*="2147483647"], div[style*="opacity: 0.01"]'
              ).forEach(el => el.remove());
            } catch(e) {}
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
        div[style*="opacity: 0.01"] {
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
  workerOrigin: string;
  buffer: string;

  constructor(workerOrigin: string) {
    this.workerOrigin = workerOrigin;
    this.buffer = "";
  }

  element(element: any) {
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

  text(textChunk: any) {
    this.buffer += textChunk.text;
    if (textChunk.lastInTextNode) {
      const lower = this.buffer.toLowerCase();
      
      // Keep VS_PROXY_BASE intact and route it through our Worker so video streams & subtitles don't get CORS blocked
      if (this.buffer.includes("VS_PROXY_BASE")) {
        const rewritten = this.buffer.replace(new RegExp(TARGET_ORIGIN, 'g'), this.workerOrigin);
        textChunk.replace(rewritten);
      } else if (
        !this.buffer.includes("__next_f") &&
        (BLOCKED_PATTERNS.some(p => lower.includes(p)) || lower.includes("window.open("))
      ) {
        textChunk.replace("/* stripped inline ad script */");
      } else {
        textChunk.replace(this.buffer);
      }
      this.buffer = "";
    } else {
      textChunk.remove();
    }
  }
}

export async function handleRequest(request: Request): Promise<Response> {
  const incomingUrl = new URL(request.url);

  // Handle CORS preflight requests for video streams, subtitles, and segments
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS, HEAD",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Max-Age": "86400"
      }
    });
  }

  // Block any leaked ad/tracker requests
  if (BLOCKED_PATTERNS.some(p => incomingUrl.pathname.toLowerCase().includes(p))) {
    return new Response("/* blocked */", {
      status: 200,
      headers: { "Content-Type": "application/javascript" }
    });
  }

  // Strip /vidcore-proxy prefix if present
  const upstreamPath = incomingUrl.pathname.replace(/^\/vidcore-proxy/, '') || '/';
  const targetUrl = new URL(upstreamPath + incomingUrl.search, TARGET_ORIGIN);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("Host", new URL(TARGET_ORIGIN).host);
  requestHeaders.set("Referer", UPSTREAM_REFERER);
  requestHeaders.set("Origin", "https://vidcore.org");
  requestHeaders.delete("x-forwarded-proto");
  requestHeaders.delete("x-real-ip");

  try {
    const response = await fetch(targetUrl.toString(), {
      method: request.method,
      headers: requestHeaders,
      redirect: "follow",
      body: request.method !== "GET" && request.method !== "HEAD" ? request.body : undefined
    });

    const responseHeaders = new Headers(response.headers);
    responseHeaders.delete("X-Frame-Options");
    responseHeaders.delete("Content-Security-Policy");
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS, HEAD");
    responseHeaders.set("Access-Control-Allow-Headers", "*");

    const contentType = (responseHeaders.get("content-type") || "").toLowerCase();

    // HTML transformation: Strip ads and inject shields
    if (contentType.includes("text/html")) {
      // Check if HTMLRewriter is available in Cloudflare runtime
      if (typeof (globalThis as any).HTMLRewriter !== "undefined") {
        const Rewriter = (globalThis as any).HTMLRewriter;
        const cleaner = new TagCleaner(incomingUrl.origin);
        return new Rewriter()
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

      // Fallback text-based replacement if HTMLRewriter is unavailable
      let text = await response.text();
      for (const pattern of BLOCKED_PATTERNS) {
        text = text.replaceAll(pattern, "/* blocked */");
      }
      return new Response(text, {
        status: response.status,
        headers: responseHeaders
      });
    }

    // Pass all other requests (subtitles .vtt, .srt, video streams .m3u8, .ts, images, fonts) straight through with CORS
    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders
    });
  } catch (err: any) {
    return new Response(`/* proxy error: ${err?.message || err} */`, {
      status: 502,
      headers: {
        "Content-Type": "text/plain",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}

// Cloudflare Pages Function entry point
export async function onRequest(context: { request: Request; waitUntil?: (p: Promise<any>) => void }): Promise<Response> {
  return handleRequest(context.request);
}

// Cloudflare Worker standard entry point
export default {
  async fetch(request: Request) {
    return handleRequest(request);
  }
};
