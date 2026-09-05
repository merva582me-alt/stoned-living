/**
 * VidLink Resolver
 *
 * Ported from: https://github.com/walterwhite-69/Vidlink.pro-Decryptor
 *
 * Flow:
 *   1. Fetch https://vidlink.pro/movie/<id>  or  /tv/<id>/<season>/<episode>
 *   2. Extract the AES-CBC encrypted JSON blob from an inline <script>
 *      — the blob is stored in a JS variable (e.g. `const data = "..."`)
 *   3. Derive the AES key from constants embedded in the page
 *      (key = first 32 chars of a sha256-like string found in a script tag)
 *   4. Decrypt with crypto.subtle AES-CBC, parse the resulting JSON
 *   5. Walk the sources array and return the first .m3u8 URL
 */

import type { ResolveParams } from './types.js';

const BASE = 'https://vidlink.pro';

// ---------------------------------------------------------------------------
// Crypto helpers — Workers-native crypto.subtle
// ---------------------------------------------------------------------------

async function deriveKeyBytes(rawKey: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  // SHA-256 of the raw key string, take first 32 bytes
  const hash = await crypto.subtle.digest('SHA-256', enc.encode(rawKey));
  return new Uint8Array(hash);
}

async function aesDecrypt(encryptedB64: string, keyBytes: Uint8Array, ivBytes: Uint8Array): Promise<string> {
  const ciphertext = Uint8Array.from(atob(encryptedB64), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-CBC' }, false, ['decrypt']);
  const plainBuf = await crypto.subtle.decrypt({ name: 'AES-CBC', iv: ivBytes }, key, ciphertext);
  return new TextDecoder().decode(plainBuf);
}

// ---------------------------------------------------------------------------
// Extraction helpers
// ---------------------------------------------------------------------------

/** Pull a JS variable value out of an inline script block */
function extractJsVar(html: string, varName: string): string | null {
  // Matches: const|var|let NAME = "VALUE" or 'VALUE'
  const re = new RegExp(`(?:const|var|let)\\s+${varName}\\s*=\\s*["'\`]([^"'\`]+)["'\`]`, 'i');
  const m = html.match(re);
  return m ? m[1] : null;
}

/** Extract the longest base64-looking string from a script block — used as fallback */
function extractLargestBase64(html: string): string | null {
  const matches = html.match(/[A-Za-z0-9+/]{100,}={0,2}/g);
  if (!matches) return null;
  return matches.sort((a, b) => b.length - a.length)[0];
}

/** Hex string → Uint8Array */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

// ---------------------------------------------------------------------------
// Parse the decrypted sources JSON into an .m3u8 URL
// ---------------------------------------------------------------------------

function extractM3u8FromSources(json: unknown): string | null {
  if (typeof json !== 'object' || json === null) return null;

  const obj = json as Record<string, unknown>;

  // Direct .file or .url at top level
  if (typeof obj.file === 'string' && obj.file.includes('.m3u8')) return obj.file;
  if (typeof obj.url === 'string' && obj.url.includes('.m3u8')) return obj.url;

  // sources array
  if (Array.isArray(obj.sources)) {
    for (const s of obj.sources) {
      if (typeof s === 'object' && s !== null) {
        const src = s as Record<string, unknown>;
        if (typeof src.file === 'string' && src.file.includes('.m3u8')) return src.file;
        if (typeof src.url === 'string' && src.url.includes('.m3u8')) return src.url;
      }
    }
  }

  // Nested under "data"
  if (typeof obj.data === 'object' && obj.data !== null) {
    return extractM3u8FromSources(obj.data);
  }

  // Nested under "stream"
  if (typeof obj.stream === 'object' && obj.stream !== null) {
    return extractM3u8FromSources(obj.stream);
  }

  return null;
}

// ---------------------------------------------------------------------------
// Public resolver entry point
// ---------------------------------------------------------------------------

export async function resolveVidLink(params: ResolveParams): Promise<string | null> {
  const { type, id, season = 1, episode = 1 } = params;

  const url =
    type === 'movie'
      ? `${BASE}/movie/${id}`
      : `${BASE}/tv/${id}/${season}/${episode}`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        'Referer': BASE
      },
      redirect: 'follow'
    });
    if (!res.ok) return null;
    const html = await res.text();

    // ── Strategy 1: encrypted blob variable + key/iv variables ─────────────
    // VidLink stores: const data = "<base64-ciphertext>",
    //                 const key  = "<hex-or-string-key>",
    //                 const iv   = "<hex-iv>"
    const encryptedBlob =
      extractJsVar(html, 'data') ||
      extractJsVar(html, 'encrypted') ||
      extractJsVar(html, 'payload');

    const rawKey =
      extractJsVar(html, 'key') ||
      extractJsVar(html, 'secretKey') ||
      extractJsVar(html, 'secret');

    const rawIv =
      extractJsVar(html, 'iv') ||
      extractJsVar(html, 'initVector');

    if (encryptedBlob && rawKey && rawIv) {
      try {
        // Key: if 64 hex chars → raw hex bytes; otherwise derive via SHA-256
        const keyBytes =
          /^[0-9a-f]{64}$/i.test(rawKey)
            ? hexToBytes(rawKey)
            : await deriveKeyBytes(rawKey);

        const ivBytes =
          /^[0-9a-f]{32}$/i.test(rawIv)
            ? hexToBytes(rawIv)
            : new TextEncoder().encode(rawIv.slice(0, 16));

        const plaintext = await aesDecrypt(encryptedBlob, keyBytes, ivBytes);
        const parsed = JSON.parse(plaintext);
        const m3u8 = extractM3u8FromSources(parsed);
        if (m3u8) return m3u8;
      } catch {
        // Decryption failed — fall through to strategy 2
      }
    }

    // ── Strategy 2: unencrypted sources JSON in a script tag ────────────────
    // Some VidLink pages embed raw JSON: window.__INITIAL_STATE__ = {...}
    const stateRe = /window\.__(?:INITIAL_STATE|DATA)__\s*=\s*(\{[\s\S]+?\});/;
    const stateMatch = html.match(stateRe);
    if (stateMatch) {
      try {
        const parsed = JSON.parse(stateMatch[1]);
        const m3u8 = extractM3u8FromSources(parsed);
        if (m3u8) return m3u8;
      } catch { /* try next */ }
    }

    // ── Strategy 3: scan raw HTML for any .m3u8 URL ─────────────────────────
    const m3u8Re = /(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/;
    const rawMatch = html.match(m3u8Re);
    return rawMatch ? rawMatch[1] : null;

  } catch {
    return null;
  }
}
