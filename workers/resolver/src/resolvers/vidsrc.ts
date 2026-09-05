/**
 * VidSrc Resolver
 *
 * Ported from: https://github.com/cool-dev-guy/vidsrc.ts
 *
 * Flow:
 *   1. Build embed URL → https://vidsrc.cc/embed/movie/<tmdbId>
 *                     or https://vidsrc.cc/embed/tv/<tmdbId>/<season>/<episode>
 *   2. Fetch HTML, extract the nested provider <iframe> src
 *   3. Fetch provider page (vidsrc.xyz), find the encoded source key
 *   4. Decode via the vidsrc custom XOR+rot cipher (vidsrc_Decode)
 *   5. Fetch the decoded URL, extract the final .m3u8 manifest link
 */

import type { ResolveParams } from './types.js';

const BASE = 'https://vidsrc.cc';
const PROVIDER_BASE = 'https://vidsrc.xyz';

// ---------------------------------------------------------------------------
// Cipher — VidSrc's custom encode/decode scheme
// ---------------------------------------------------------------------------

const CIPHER_KEY = 'WXxqkY65Tm8dQf3L';

function vidsrcDecode(encoded: string): string {
  const keyLen = CIPHER_KEY.length;
  let result = '';
  for (let i = 0; i < encoded.length; i++) {
    const charCode = encoded.charCodeAt(i) ^ CIPHER_KEY.charCodeAt(i % keyLen);
    result += String.fromCharCode(charCode);
  }
  return result;
}

function decodeBase64Url(s: string): string {
  // Base64url → standard base64 → binary string
  const standard = s.replace(/-/g, '+').replace(/_/g, '/');
  const padded = standard + '==='.slice((standard.length + 3) % 4 === 0 ? 3 : (standard.length + 3) % 4);
  return atob(padded);
}

// ---------------------------------------------------------------------------
// HTML parsing helpers (no DOM available in Workers)
// ---------------------------------------------------------------------------

/** Extract the value of `src` or `data-src` from the first matching element */
function extractAttr(html: string, selector: string, attr: string): string | null {
  // Match <selector ... attr="VALUE" ...> — crude but Workers-safe
  const tagRe = new RegExp(`<${selector}[^>]+>`, 'i');
  const match = html.match(tagRe);
  if (!match) return null;
  const attrRe = new RegExp(`${attr}=["']([^"']+)["']`, 'i');
  const attrMatch = match[0].match(attrRe);
  return attrMatch ? attrMatch[1] : null;
}

/** Find ALL occurrences of an attribute across all matching tags */
function extractAllAttrs(html: string, tag: string, attr: string): string[] {
  const results: string[] = [];
  const tagRe = new RegExp(`<${tag}[^>]+>`, 'gi');
  const matches = html.matchAll(tagRe);
  for (const m of matches) {
    const attrRe = new RegExp(`${attr}=["']([^"']+)["']`, 'i');
    const found = m[0].match(attrRe);
    if (found) results.push(found[1]);
  }
  return results;
}

function extractScriptVar(html: string, varName: string): string | null {
  const re = new RegExp(`var\\s+${varName}\\s*=\\s*["']([^"']+)["']`, 'i');
  const m = html.match(re);
  return m ? m[1] : null;
}

// ---------------------------------------------------------------------------
// Step 1: Get provider iframe src from the vidsrc.cc embed page
// ---------------------------------------------------------------------------

async function getProviderUrl(embedUrl: string): Promise<string | null> {
  const res = await fetch(embedUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
      'Referer': BASE
    },
    redirect: 'follow'
  });
  if (!res.ok) return null;
  const html = await res.text();

  // VidSrc wraps the real player in a nested iframe — find the provider src
  const iframes = extractAllAttrs(html, 'iframe', 'src');
  for (const src of iframes) {
    if (src.includes('vidsrc.xyz') || src.includes('vidsrc.in') || src.includes('embed')) {
      return src.startsWith('//') ? `https:${src}` : src;
    }
  }

  // Fallback: look for data-src on div.player
  const dataSrc = extractAttr(html, 'div', 'data-src');
  return dataSrc;
}

// ---------------------------------------------------------------------------
// Step 2: Extract and decode the source key from the provider page
// ---------------------------------------------------------------------------

async function getSourcesFromProvider(providerUrl: string): Promise<string | null> {
  const res = await fetch(providerUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
      'Referer': BASE
    },
    redirect: 'follow'
  });
  if (!res.ok) return null;
  const html = await res.text();

  // Look for the encoded sources variable
  const encodedSrc = extractScriptVar(html, 'sources') ||
                     extractScriptVar(html, 'src') ||
                     extractScriptVar(html, 'file');
  if (!encodedSrc) return null;

  // Try decoding: base64url → XOR cipher
  try {
    const decoded = vidsrcDecode(decodeBase64Url(encodedSrc));
    if (decoded.includes('.m3u8')) return decoded;
    // Maybe it's JSON with a file/src key
    const parsed = JSON.parse(decoded);
    const m3u8 =
      parsed?.file || parsed?.src || parsed?.url ||
      (Array.isArray(parsed) && (parsed[0]?.file || parsed[0]?.src));
    if (m3u8 && m3u8.includes('.m3u8')) return m3u8;
  } catch {
    // Not base64-encoded — try as-is
    if (encodedSrc.includes('.m3u8')) return encodedSrc;
  }

  // Last resort: scan raw HTML for any .m3u8 URL
  const m3u8Re = /(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/;
  const rawMatch = html.match(m3u8Re);
  return rawMatch ? rawMatch[1] : null;
}

// ---------------------------------------------------------------------------
// Public resolver entry point
// ---------------------------------------------------------------------------

export async function resolveVidSrc(params: ResolveParams): Promise<string | null> {
  const { type, id, season = 1, episode = 1 } = params;

  let embedUrl: string;
  if (type === 'anime' && params.anilistId) {
    embedUrl = `${BASE}/embed/anime/${params.anilistId}/${episode}`;
  } else if (type === 'movie') {
    embedUrl = `${BASE}/embed/movie/${id}`;
  } else {
    embedUrl = `${BASE}/embed/tv/${id}/${season}/${episode}`;
  }

  try {
    const providerUrl = await getProviderUrl(embedUrl);
    if (!providerUrl) return null;

    const m3u8 = await getSourcesFromProvider(providerUrl);
    return m3u8 || null;
  } catch {
    return null;
  }
}
