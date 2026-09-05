/**
 * DaddyLive Resolver
 *
 * Ported from: https://github.com/sharoon7171/daddylive-stream-resolver
 *
 * Schedule / event listing flow:
 *   GET https://daddylive.mp/schedule/schedule-generated.json
 *   → { "Day, Date": [ { time, channel, title, category } ] }
 *   Each channel maps to a stream URL pattern.
 *
 * Stream resolution flow:
 *   GET https://daddylive.mp/embed/stream-<channelId>.php
 *   → HTML with iframe src pointing to the actual stream host
 *   Follow iframe → extract .m3u8 URL
 */

import type { SportResolveParams, SportEvent } from './types.js';

const BASE     = 'https://daddylive.mp';
const CDN_BASE = 'https://top.topembed.pw';   // Common CDN used by DaddyLive streams

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  'Referer': BASE,
  'Origin': BASE
};

// ---------------------------------------------------------------------------
// Types from DaddyLive schedule JSON
// ---------------------------------------------------------------------------

interface DaddyLiveEvent {
  time: string;
  channel: string;       // e.g. "stream-1234" or a channel name
  title?: string;
  category?: string;
}

type DaddyLiveSchedule = Record<string, DaddyLiveEvent[]>;

// ---------------------------------------------------------------------------
// Normalise sport category
// ---------------------------------------------------------------------------

function normaliseSportCategory(raw = ''): string {
  const lower = raw.toLowerCase();
  if (lower.includes('football') || lower.includes('soccer')) return 'Football';
  if (lower.includes('basketball') || lower.includes('nba'))   return 'Basketball';
  if (lower.includes('ufc') || lower.includes('mma'))          return 'UFC / MMA';
  if (lower.includes('tennis'))                                return 'Tennis';
  if (lower.includes('baseball') || lower.includes('mlb'))     return 'Baseball';
  if (lower.includes('hockey') || lower.includes('nhl'))       return 'Hockey';
  if (lower.includes('golf'))                                  return 'Golf';
  if (lower.includes('cricket'))                               return 'Cricket';
  if (lower.includes('f1') || lower.includes('formula'))       return 'Motorsport';
  if (lower.includes('boxing'))                                return 'Boxing';
  return raw || 'Sports';
}

// ---------------------------------------------------------------------------
// Event listing — flatten today's schedule
// ---------------------------------------------------------------------------

export async function fetchDaddyLiveEvents(): Promise<SportEvent[]> {
  try {
    const res = await fetch(`${BASE}/schedule/schedule-generated.json`, {
      headers: { ...HEADERS, Accept: 'application/json' }
    });
    if (!res.ok) return [];

    const schedule = await res.json() as DaddyLiveSchedule;
    const events: SportEvent[] = [];

    // Pick events from today and the next day (schedule keys are date strings)
    const now = new Date();
    const todayStr = now.toDateString();

    for (const [dateKey, dayEvents] of Object.entries(schedule)) {
      // Include entries from today or any key that parses close to today
      const keyDate = new Date(dateKey);
      const diffDays = Math.abs((keyDate.getTime() - now.getTime()) / 86400000);
      if (diffDays > 1) continue;

      for (const ev of dayEvents) {
        // Extract numeric channel ID from channel string (e.g. "stream-1234" → "1234")
        const channelIdMatch = String(ev.channel).match(/\d+/);
        const channelId = channelIdMatch ? channelIdMatch[0] : String(ev.channel);

        events.push({
          id: channelId,
          title: ev.title || ev.channel,
          sport_category: normaliseSportCategory(ev.category),
          provider: 'daddylive',
          is_live: true
        });
      }
    }

    return events;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Stream resolution helpers
// ---------------------------------------------------------------------------

function extractM3u8(text: string): string | null {
  const re = /(https?:\/\/[^\s"'<>\\]+\.m3u8[^\s"'<>\\]*)/;
  const m = text.match(re);
  return m ? m[1] : null;
}

function extractIframeSrc(html: string): string | null {
  const re = /<iframe[^>]+src=["']([^"']+)["']/i;
  const m = html.match(re);
  if (!m) return null;
  const src = m[1];
  return src.startsWith('//') ? `https:${src}` : src;
}

// ---------------------------------------------------------------------------
// Stream resolution — follow iframe chain
// ---------------------------------------------------------------------------

export async function resolveDaddyLive(params: SportResolveParams): Promise<string | null> {
  const { channelId } = params;

  // DaddyLive embed URL pattern
  const embedUrl = `${BASE}/embed/stream-${channelId}.php`;

  try {
    // Step 1: Fetch the DaddyLive embed page
    const res1 = await fetch(embedUrl, { headers: HEADERS, redirect: 'follow' });
    if (!res1.ok) return null;
    const html1 = await res1.text();

    // Direct .m3u8 in the embed page (sometimes present)
    const direct = extractM3u8(html1);
    if (direct) return direct;

    // Step 2: Follow the nested iframe
    const iframeSrc = extractIframeSrc(html1);
    if (!iframeSrc) return null;

    const res2 = await fetch(iframeSrc, {
      headers: {
        ...HEADERS,
        Referer: BASE
      },
      redirect: 'follow'
    });
    if (!res2.ok) return null;
    const html2 = await res2.text();

    // Direct .m3u8 in iframe page
    const iframeM3u8 = extractM3u8(html2);
    if (iframeM3u8) return iframeM3u8;

    // Step 3: Some DaddyLive streams nest a second iframe into a CDN host
    const iframeSrc2 = extractIframeSrc(html2);
    if (iframeSrc2) {
      const host = new URL(iframeSrc).origin;
      const fullSrc2 = iframeSrc2.startsWith('http') ? iframeSrc2 : `${host}${iframeSrc2}`;
      const res3 = await fetch(fullSrc2, {
        headers: { ...HEADERS, Referer: iframeSrc },
        redirect: 'follow'
      });
      if (res3.ok) {
        const html3 = await res3.text();
        const m3u8 = extractM3u8(html3);
        if (m3u8) return m3u8;
      }
    }

    // Step 4: Try the CDN base directly with the channel ID pattern
    const cdnUrl = `${CDN_BASE}/embed/stream-${channelId}.php`;
    try {
      const cdnRes = await fetch(cdnUrl, {
        headers: { ...HEADERS, Referer: CDN_BASE },
        redirect: 'follow'
      });
      if (cdnRes.ok) {
        const cdnHtml = await cdnRes.text();
        const m3u8 = extractM3u8(cdnHtml);
        if (m3u8) return m3u8;
      }
    } catch { /* fall through */ }

    return null;
  } catch {
    return null;
  }
}
