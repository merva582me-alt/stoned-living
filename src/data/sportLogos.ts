/**
 * Hardcoded sport / series logo map.
 *
 * Used as a guaranteed fallback so every sports card always shows a
 * recognisable logo rather than the TV-icon placeholder.
 *
 * Sources: Wikimedia Commons (free/open), ESPN CDN, official league CDNs.
 * Keys are lowercase normalised — match against norm(category) or norm(title).
 */

// ---------------------------------------------------------------------------
// Category logos — keyed on norm(match.category)
// ---------------------------------------------------------------------------
export const CATEGORY_LOGOS: Record<string, string> = {
  // American football
  'american football': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/NFL_logo.svg/400px-NFL_logo.svg.png',
  'football':          'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/NFL_logo.svg/400px-NFL_logo.svg.png',

  // Basketball
  'basketball':        'https://upload.wikimedia.org/wikipedia/en/thumb/0/03/National_Basketball_Association_logo.svg/400px-National_Basketball_Association_logo.svg.png',

  // Baseball
  'baseball':          'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Major_League_Baseball_logo.svg/400px-Major_League_Baseball_logo.svg.png',

  // Ice hockey
  'hockey':            'https://upload.wikimedia.org/wikipedia/en/thumb/3/3a/05_NHL_Shield.svg/400px-05_NHL_Shield.svg.png',
  'ice hockey':        'https://upload.wikimedia.org/wikipedia/en/thumb/3/3a/05_NHL_Shield.svg/400px-05_NHL_Shield.svg.png',

  // Soccer / football
  'soccer':            'https://upload.wikimedia.org/wikipedia/en/thumb/d/d3/Premier_League_Logo.svg/400px-Premier_League_Logo.svg.png',
  'football (soccer)': 'https://upload.wikimedia.org/wikipedia/en/thumb/d/d3/Premier_League_Logo.svg/400px-Premier_League_Logo.svg.png',

  // MMA / UFC / fight
  'fight':             'https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/UFC_Logo.svg/400px-UFC_Logo.svg.png',
  'mma':               'https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/UFC_Logo.svg/400px-UFC_Logo.svg.png',
  'boxing':            'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/WBC_Logo.png/400px-WBC_Logo.png',
  'wrestling':         'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/WWE_Logo.svg/400px-WWE_Logo.svg.png',

  // Motor sports
  'motor sports':      'https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/F1.svg/400px-F1.svg.png',
  'motorsports':       'https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/F1.svg/400px-F1.svg.png',
  'motorsport':        'https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/F1.svg/400px-F1.svg.png',
  'racing':            'https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/F1.svg/400px-F1.svg.png',

  // Cricket
  'cricket':           'https://upload.wikimedia.org/wikipedia/en/thumb/5/5a/ICC_Logo.png/400px-ICC_Logo.png',

  // Rugby
  'rugby':             'https://upload.wikimedia.org/wikipedia/en/thumb/a/af/World_Rugby_logo.svg/400px-World_Rugby_logo.svg.png',
  'rugby league':      'https://upload.wikimedia.org/wikipedia/en/thumb/a/af/World_Rugby_logo.svg/400px-World_Rugby_logo.svg.png',
  'rugby union':       'https://upload.wikimedia.org/wikipedia/en/thumb/a/af/World_Rugby_logo.svg/400px-World_Rugby_logo.svg.png',

  // Tennis
  'tennis':            'https://upload.wikimedia.org/wikipedia/en/thumb/6/6c/Wimbledon_Championships_logo_and_wordmark.svg/400px-Wimbledon_Championships_logo_and_wordmark.svg.png',

  // Golf
  'golf':              'https://upload.wikimedia.org/wikipedia/commons/thumb/7/70/PGA_Tour_Logo.svg/400px-PGA_Tour_Logo.svg.png',
};

// ---------------------------------------------------------------------------
// Series / event logos — keyed on substrings of norm(match.title)
// Checked in order; first match wins.
// ---------------------------------------------------------------------------
export const SERIES_LOGOS: Array<{ pattern: RegExp; logo: string; label: string }> = [
  // ── Formula 1 ──────────────────────────────────────────────────────────────
  {
    pattern: /formula\s*1|formula\s*one|\bf1\b/i,
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/F1.svg/600px-F1.svg.png',
    label: 'Formula 1',
  },

  // ── NASCAR ─────────────────────────────────────────────────────────────────
  {
    pattern: /nascar\s+cup/i,
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/NASCAR_Cup_Series_logo.svg/600px-NASCAR_Cup_Series_logo.svg.png',
    label: 'NASCAR Cup Series',
  },
  {
    pattern: /nascar\s+xfinity/i,
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/76/NASCAR_Xfinity_Series_logo.svg/600px-NASCAR_Xfinity_Series_logo.svg.png',
    label: 'NASCAR Xfinity',
  },
  {
    pattern: /nascar/i,
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/NASCAR_Cup_Series_logo.svg/600px-NASCAR_Cup_Series_logo.svg.png',
    label: 'NASCAR',
  },

  // ── MotoGP / Moto2 / Moto3 ────────────────────────────────────────────────
  {
    pattern: /\bmotogp\b/i,
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/MotoGP_logo.svg/600px-MotoGP_logo.svg.png',
    label: 'MotoGP',
  },
  {
    pattern: /\bmoto2\b/i,
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/MotoGP_logo.svg/600px-MotoGP_logo.svg.png',
    label: 'Moto2',
  },
  {
    pattern: /\bmoto3\b/i,
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/MotoGP_logo.svg/600px-MotoGP_logo.svg.png',
    label: 'Moto3',
  },

  // ── IndyCar ────────────────────────────────────────────────────────────────
  {
    pattern: /indycar/i,
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/IndyCar_series_logo.svg/600px-IndyCar_series_logo.svg.png',
    label: 'IndyCar',
  },

  // ── World Rally Championship ───────────────────────────────────────────────
  {
    pattern: /world\s+rally|\bwrc\b/i,
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/WRC_logo.svg/600px-WRC_logo.svg.png',
    label: 'WRC',
  },

  // ── UFC ────────────────────────────────────────────────────────────────────
  {
    pattern: /\bufc\b/i,
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/UFC_Logo.svg/600px-UFC_Logo.svg.png',
    label: 'UFC',
  },

  // ── Bellator ──────────────────────────────────────────────────────────────
  {
    pattern: /bellator/i,
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/02/Bellator_MMA_logo.svg/600px-Bellator_MMA_logo.svg.png',
    label: 'Bellator',
  },

  // ── ONE Championship ──────────────────────────────────────────────────────
  {
    pattern: /\bone\s+championship\b|\bone\s+fc\b/i,
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/One_Championship_logo.svg/600px-One_Championship_logo.svg.png',
    label: 'ONE Championship',
  },

  // ── RIZIN ─────────────────────────────────────────────────────────────────
  {
    pattern: /rizin/i,
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/RIZIN_FF_logo.svg/600px-RIZIN_FF_logo.svg.png',
    label: 'RIZIN',
  },

  // ── WWE ───────────────────────────────────────────────────────────────────
  {
    pattern: /\bwwe\b|wrestlemania|royal\s+rumble|summerslam/i,
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/WWE_Logo.svg/600px-WWE_Logo.svg.png',
    label: 'WWE',
  },

  // ── Boxing sanctioning bodies / Dana White ─────────────────────────────────
  {
    pattern: /contender\s+series|dana\s+white/i,
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/UFC_Logo.svg/600px-UFC_Logo.svg.png',
    label: 'UFC Contender Series',
  },
  {
    pattern: /legacy\s+fighting|\blfc\b/i,
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/UFC_Logo.svg/600px-UFC_Logo.svg.png',
    label: 'LFC',
  },

  // ── Super RIZIN ───────────────────────────────────────────────────────────
  {
    pattern: /super\s+rizin/i,
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/RIZIN_FF_logo.svg/600px-RIZIN_FF_logo.svg.png',
    label: 'Super RIZIN',
  },
];

// ---------------------------------------------------------------------------
// Lookup helper
// ---------------------------------------------------------------------------

/** Returns the best logo URL for a match — checks series patterns first (title),
 *  then falls back to category logo, then undefined. */
export function getSeriesLogo(title: string, category: string): string | undefined {
  // 1. Series match on title
  for (const entry of SERIES_LOGOS) {
    if (entry.pattern.test(title)) return entry.logo;
  }
  // 2. Category fallback
  const catKey = category.toLowerCase().trim();
  return CATEGORY_LOGOS[catKey];
}
