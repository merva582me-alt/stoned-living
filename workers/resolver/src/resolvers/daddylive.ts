/**
 * DaddyLive (DLHD) Resolver
 * Official API: https://dlive.sx/api.php
 *
 * Protected API (requires key): https://dlive.sx/daddyapi.php?key=KEY&endpoint=channels|schedule
 * Public playable embed pages:
 *   https://dlive.sx/stream/stream-{id}.php
 *   https://dlive.sx/watch/stream-{id}.php
 *   https://dlive.sx/cast/stream-{id}.php
 *   https://dlive.sx/plus/stream-{id}.php
 *   https://dlive.sx/player/stream-{id}.php
 *
 * Since the schedule API requires a key, we use the public channels list
 * and the embed pages for event listing and stream resolution.
 */

import type { SportResolveParams, SportEvent } from './types.js';

const BASE     = 'https://dlive.sx';
const API_BASE = `${BASE}/daddyapi.php`;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  'Referer':    BASE,
  'Origin':     BASE
};

interface DaddyChannel {
  channel_name: string;
  channel_id:   string;
  logo_url?:    string;
}

function normaliseSportCategory(name = ''): string {
  const lower = name.toLowerCase();
  if (lower.includes('football') || lower.includes('nfl') || lower.includes('soccer')) return 'Football';
  if (lower.includes('basketball') || lower.includes('nba')) return 'Basketball';
  if (lower.includes('ufc') || lower.includes('mma') || lower.includes('boxing'))      return 'UFC / MMA';
  if (lower.includes('tennis'))    return 'Tennis';
  if (lower.includes('baseball') || lower.includes('mlb'))  return 'Baseball';
  if (lower.includes('hockey') || lower.includes('nhl'))    return 'Hockey';
  if (lower.includes('golf'))      return 'Golf';
  if (lower.includes('cricket'))   return 'Cricket';
  if (lower.includes('f1') || lower.includes('formula') || lower.includes('nascar') || lower.includes('motor')) return 'Motorsport';
  if (lower.includes('rugby') || lower.includes('afl'))     return 'Rugby / AFL';
  if (lower.includes('darts'))     return 'Darts';
  if (lower.includes('espn'))      return 'Sports Channels';
  if (lower.includes('bein') || lower.includes('sky sports') || lower.includes('bt sport')) return 'Sports Channels';
  return 'Sports';
}

function extractM3u8(text: string): string | null {
  const re = /(https?:\/\/[^\s"'<>\\]+\.m3u8[^\s"'<>\\]*)/;
  const m  = text.match(re);
  return m ? m[1] : null;
}

function extractIframeSrc(html: string): string | null {
  const re = /<iframe[^>]+src=["']([^"']+)["']/i;
  const m  = html.match(re);
  if (!m) return null;
  const src = m[1];
  return src.startsWith('//') ? `https:${src}` : src;
}

export async function fetchDaddyLiveEvents(): Promise<SportEvent[]> {
  try {
    // Use the public channels endpoint (no key required for channel list)
    const res = await fetch(`${API_BASE}?endpoint=channels`, {
      headers: { ...HEADERS, Accept: 'application/json' }
    });
    if (!res.ok) return [];
    const channels = await res.json() as DaddyChannel[];
    if (!Array.isArray(channels)) return [];
    return channels.map((ch) => {
      const logoUrl = ch.logo_url
        ? (ch.logo_url.startsWith('http') ? ch.logo_url : `${BASE}/${ch.logo_url}`)
        : undefined;
      return {
        id:             ch.channel_id,
        title:          ch.channel_name,
        sport_category: normaliseSportCategory(ch.channel_name),
        provider:       'daddylive',
        thumbnail:      logoUrl,
        is_live:        true
      };
    });
  } catch {
    return [];
  }
}

export async function resolveDaddyLive(params: SportResolveParams): Promise<string | null> {
  const { channelId } = params;

  // Try each valid folder path from the official docs
  const folders = ['stream', 'watch', 'cast', 'plus', 'player'];

  for (const folder of folders) {
    try {
      const embedUrl = `${BASE}/${folder}/stream-${channelId}.php`;
      const res = await fetch(embedUrl, { headers: HEADERS, redirect: 'follow' });
      if (!res.ok) continue;
      const html = await res.text();

      // Direct .m3u8 in page
      const direct = extractM3u8(html);
      if (direct) return direct;

      // Follow one level of iframe
      const iframeSrc = extractIframeSrc(html);
      if (iframeSrc) {
        try {
          const res2 = await fetch(iframeSrc, {
            headers: { ...HEADERS, Referer: BASE },
            redirect: 'follow'
          });
          if (res2.ok) {
            const html2 = await res2.text();
            const m3u8 = extractM3u8(html2);
            if (m3u8) return m3u8;

            // Second iframe level
            const iframeSrc2 = extractIframeSrc(html2);
            if (iframeSrc2) {
              const host = new URL(iframeSrc).origin;
              const fullSrc2 = iframeSrc2.startsWith('http') ? iframeSrc2 : `${host}${iframeSrc2}`;
              const res3 = await fetch(fullSrc2, {
                headers: { ...HEADERS, Referer: iframeSrc },
                redirect: 'follow'
              });
              if (res3.ok) {
                const m3u8 = extractM3u8(await res3.text());
                if (m3u8) return m3u8;
              }
            }
          }
        } catch { /* try next folder */ }
      }
    } catch { /* try next folder */ }
  }

  return null;
}
