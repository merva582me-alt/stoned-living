/**
 * VidUp Resolver
 *
 * Ported from: https://github.com/sharoon7171/vidup-stream-solver
 *
 * Flow:
 *   1. Build embed URL → https://vidup.io/e/<tmdbId>  (movie)
 *                     or https://vidup.io/e/<tmdbId>?s=<season>&e=<episode>  (tv)
 *   2. Fetch the page, extract the packed/obfuscated script
 *   3. Locate the master .m3u8 URL either directly in HTML or via a sources JSON call
 *   4. Return the .m3u8 URL
 */

import type { ResolveParams } from './types.js';

const BASE = 'https://vidup.io';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  'Referer': BASE,
  'Accept': 'text/html,application/xhtml+xml'
};

// ---------------------------------------------------------------------------
// Unpack eval(p,a,c,k,e,d) — the classic JavaScript obfuscator
// ---------------------------------------------------------------------------

function unpackEvalPacked(packed: string): string | null {
  // Match: eval(function(p,a,c,k,e,d){...}('...',N,N,'...'....))
  const re = /eval\(function\(p,a,c,k,e,(?:r|d)\)\{[\s\S]+?\}\('([\s\S]+?)',(\d+),(\d+),'([\s\S]+?)'\.split/;
  const m = packed.match(re);
  if (!m) return null;

  try {
    const [, p, , c, kStr] = m;
    const a = parseInt(m[2], 10);
    const k = kStr.split('|');
    let result = p;
    for (let i = parseInt(c, 10) - 1; i >= 0; i--) {
      if (k[i]) {
        const b36 = i.toString(a);
        result = result.replace(new RegExp(`\\b${b36}\\b`, 'g'), k[i]);
      }
    }
    return result;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractM3u8(text: string): string | null {
  const re = /(https?:\/\/[^\s"'<>\\]+\.m3u8[^\s"'<>\\]*)/;
  const m = text.match(re);
  return m ? m[1] : null;
}

function extractSourcesUrl(html: string): string | null {
  // Patterns like: sources: [{file:"https://..."}] or "file":"https://..."
  const patterns = [
    /file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i,
    /["']file["']\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i,
    /src\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return m[1];
  }
  return null;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function resolveVidUp(params: ResolveParams): Promise<string | null> {
  const { type, id, season = 1, episode = 1 } = params;

  const embedUrl =
    type === 'movie'
      ? `${BASE}/e/${id}`
      : `${BASE}/e/${id}?s=${season}&e=${episode}`;

  try {
    const res = await fetch(embedUrl, { headers: HEADERS, redirect: 'follow' });
    if (!res.ok) return null;
    const html = await res.text();

    // ── Strategy 1: direct .m3u8 in HTML ───────────────────────────────────
    const direct = extractM3u8(html) || extractSourcesUrl(html);
    if (direct) return direct;

    // ── Strategy 2: unpack obfuscated script and scan ──────────────────────
    if (html.includes('eval(function(p,a,c,k')) {
      const unpacked = unpackEvalPacked(html);
      if (unpacked) {
        const m3u8 = extractM3u8(unpacked) || extractSourcesUrl(unpacked);
        if (m3u8) return m3u8;
      }
    }

    // ── Strategy 3: follow a /playlist or /sources endpoint ────────────────
    const playlistPath = html.match(/['"](\/(?:playlist|sources|stream)\/[^'"]+)['"]/i);
    if (playlistPath) {
      const apiUrl = `${BASE}${playlistPath[1]}`;
      try {
        const apiRes = await fetch(apiUrl, {
          headers: { ...HEADERS, Accept: 'application/json' },
          redirect: 'follow'
        });
        if (apiRes.ok) {
          const text = await apiRes.text();
          const m3u8 = extractM3u8(text);
          if (m3u8) return m3u8;
        }
      } catch { /* fall through */ }
    }

    return null;
  } catch {
    return null;
  }
}
