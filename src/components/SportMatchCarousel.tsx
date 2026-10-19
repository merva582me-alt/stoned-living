import React, { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, LucideIcon, Radio, Tv2 } from 'lucide-react';

// ---------------------------------------------------------------------------
// Hardcoded series / category logos — used ONLY in the text-fallback branch
// (no badges, no streamed.pk poster, no ESPN/TSDB eventPoster)
// ---------------------------------------------------------------------------
const SERIES_LOGOS: Array<{ pattern: RegExp; logo: string }> = [
  { pattern: /formula\s*1|formula\s*one|\bf1\b/i,              logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/F1.svg/400px-F1.svg.png' },
  { pattern: /nascar\s+cup/i,                                   logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/NASCAR_Cup_Series_logo.svg/400px-NASCAR_Cup_Series_logo.svg.png' },
  { pattern: /nascar\s+xfinity/i,                               logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/76/NASCAR_Xfinity_Series_logo.svg/400px-NASCAR_Xfinity_Series_logo.svg.png' },
  { pattern: /nascar/i,                                         logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/NASCAR_Cup_Series_logo.svg/400px-NASCAR_Cup_Series_logo.svg.png' },
  { pattern: /\bmotogp\b|\bmoto2\b|\bmoto3\b/i,                 logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/MotoGP_logo.svg/400px-MotoGP_logo.svg.png' },
  { pattern: /indycar/i,                                        logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/IndyCar_series_logo.svg/400px-IndyCar_series_logo.svg.png' },
  { pattern: /world\s+rally|\bwrc\b/i,                          logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/WRC_logo.svg/400px-WRC_logo.svg.png' },
  { pattern: /contender\s+series|dana\s+white/i,                logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/UFC_Logo.svg/400px-UFC_Logo.svg.png' },
  { pattern: /\bufc\b/i,                                        logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/UFC_Logo.svg/400px-UFC_Logo.svg.png' },
  { pattern: /bellator/i,                                       logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/02/Bellator_MMA_logo.svg/400px-Bellator_MMA_logo.svg.png' },
  { pattern: /\bone\s+championship\b|\bone\s+fc\b/i,            logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/One_Championship_logo.svg/400px-One_Championship_logo.svg.png' },
  { pattern: /super\s+rizin|rizin/i,                            logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/RIZIN_FF_logo.svg/400px-RIZIN_FF_logo.svg.png' },
  { pattern: /\bwwe\b|wrestlemania|royal\s+rumble|summerslam/i, logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/WWE_Logo.svg/400px-WWE_Logo.svg.png' },
  { pattern: /legacy\s+fighting|\blfc\b/i,                      logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/UFC_Logo.svg/400px-UFC_Logo.svg.png' },
];

const CATEGORY_LOGOS: Record<string, string> = {
  'fight':          'https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/UFC_Logo.svg/400px-UFC_Logo.svg.png',
  'mma':            'https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/UFC_Logo.svg/400px-UFC_Logo.svg.png',
  'boxing':         'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/WBC_Logo.png/400px-WBC_Logo.png',
  'wrestling':      'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/WWE_Logo.svg/400px-WWE_Logo.svg.png',
  'motor sports':   'https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/F1.svg/400px-F1.svg.png',
  'motorsports':    'https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/F1.svg/400px-F1.svg.png',
  'motorsport':     'https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/F1.svg/400px-F1.svg.png',
  'racing':         'https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/F1.svg/400px-F1.svg.png',
};

function getSeriesLogo(title: string, category: string): string | undefined {
  for (const e of SERIES_LOGOS) {
    if (e.pattern.test(title)) return e.logo;
  }
  return CATEGORY_LOGOS[category.toLowerCase().trim()];
}

export interface SportMatch {
  id:        string;
  title:     string;
  category:  string;
  date:      number;
  is_live:   boolean;
  teams?:    { home?: { name: string; badge: string }; away?: { name: string; badge: string } };
  poster?:   string;
  tsdb?:     { homeBadge?: string; awayBadge?: string; homeScore?: number; awayScore?: number; leagueName?: string; progress?: string; eventPoster?: string; leagueBanner?: string };
  /** streamed.pk stream sources — carried to the player to fetch streams on demand */
  _sources?: { source: string; id: string }[];
}

interface SportMatchCarouselProps {
  title:    string;
  subtitle?: string;
  icon?:    LucideIcon;
  matches:  SportMatch[];
  onOpen:   (match: SportMatch) => void;
  loading?: boolean;
}

function splitVs(title: string | undefined): [string, string] {
  if (!title) return ['', ''];
  const parts = title.split(/\s+vs\.?\s+/i);
  if (parts.length >= 2) return [parts[0].trim(), parts.slice(1).join(' vs ').trim()];
  return [title, ''];
}

function formatMatchDate(ts: number): { dateStr: string | null; timeStr: string } {
  const d = new Date(ts);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const tomorrowStart = todayStart + 86_400_000;
  const matchDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (matchDay === todayStart) return { dateStr: null, timeStr };
  if (matchDay === tomorrowStart) return { dateStr: 'Tomorrow', timeStr };
  return {
    dateStr: d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }),
    timeStr,
  };
}

export const SportMatchTile: React.FC<{ match: SportMatch; onOpen: (m: SportMatch) => void }> = ({ match, onOpen }) => {
  const homeBadge    = match.tsdb?.homeBadge;
  const awayBadge    = match.tsdb?.awayBadge;
  const eventPoster  = match.tsdb?.eventPoster;
  const leagueBanner = match.tsdb?.leagueBanner;
  const hasBadges    = !!(homeBadge || awayBadge); // at least one badge
  const hasBothBadges = !!(homeBadge && awayBadge);
  // Full-cover image: streamed.pk poster > event poster > league banner (when no badges)
  const coverImage   = match.poster || eventPoster || (!hasBadges ? leagueBanner : undefined);
  const [teamA, teamB] = splitVs(match.title);
  const { dateStr, timeStr } = match.date ? formatMatchDate(match.date) : { dateStr: null, timeStr: null };

  return (
    <button
      onClick={() => onOpen(match)}
      className="group text-left bg-[#0e1411] hover:bg-[#131d17] border border-emerald-900/40 hover:border-emerald-500/50 rounded-2xl overflow-hidden transition-all duration-200 cursor-pointer w-full h-full flex flex-col"
    >
      <div className="relative w-full aspect-video bg-emerald-950/30">
        {coverImage ? (
          <img
            src={coverImage}
            alt={match.title}
            className="w-full h-full object-cover opacity-85 group-hover:opacity-100 transition"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : hasBadges ? (
          /* Badge layout — league banner as dim background when available */
          <div className="relative w-full h-full flex items-center justify-center gap-4 px-3">
            {leagueBanner && (
              <img src={leagueBanner} alt="" aria-hidden
                className="absolute inset-0 w-full h-full object-cover opacity-10"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            )}
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/70 to-[#0a100d]/90" />
            <div className="relative flex items-center justify-center gap-4 w-full">
              {homeBadge
                ? <img src={homeBadge} alt="" className="w-10 h-10 sm:w-12 sm:h-12 object-contain drop-shadow-lg"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                : hasBothBadges ? null : <span className="text-white font-black text-[10px] text-center line-clamp-2 flex-1 max-w-[40%]">{teamA}</span>
              }
              <span className="text-zinc-400 font-black text-xs shrink-0">VS</span>
              {awayBadge
                ? <img src={awayBadge} alt="" className="w-10 h-10 sm:w-12 sm:h-12 object-contain drop-shadow-lg"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                : hasBothBadges ? null : <span className="text-white font-black text-[10px] text-center line-clamp-2 flex-1 max-w-[40%]">{teamB}</span>
              }
            </div>
          </div>
        ) : (
          /* Text fallback — series/category logo replaces the TV icon when available */
          <div className="relative w-full h-full flex flex-col items-center justify-center gap-1.5 px-3">
            {leagueBanner && (
              <img src={leagueBanner} alt="" aria-hidden
                className="absolute inset-0 w-full h-full object-cover opacity-10"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            )}
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/70 to-[#0a100d]/90" />
            {(() => {
              const sLogo = getSeriesLogo(match.title, match.category);
              return sLogo
                ? <img src={sLogo} alt="" aria-hidden
                    className="relative w-16 h-16 sm:w-20 sm:h-20 object-contain opacity-90 drop-shadow-lg"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                : <Tv2 className="relative w-5 h-5 text-emerald-500/40" />;
            })()}
            <div className="relative flex items-center gap-2 w-full justify-center">
              <span className="text-white font-black text-[10px] text-center line-clamp-2 flex-1">{teamA || match.title}</span>
              {teamB && <><span className="text-emerald-400 font-black text-[10px] shrink-0">VS</span>
              <span className="text-white font-black text-[10px] text-center line-clamp-2 flex-1">{teamB}</span></>}
            </div>
          </div>
        )}
        {match.is_live && (
          <span className="absolute top-2 left-2 flex items-center gap-1 text-[9px] font-bold text-rose-200 bg-rose-600/90 px-2 py-0.5 rounded-full uppercase">
            <Radio className="w-2.5 h-2.5 animate-pulse" /> Live
          </span>
        )}
      </div>
      <div className="p-3 space-y-1 flex-1">
        <p className="text-xs font-extrabold text-white line-clamp-2 group-hover:text-emerald-300 transition leading-tight">
          {match.title}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {!match.is_live && timeStr && (
            <span className="text-[9px] font-mono text-zinc-400 bg-zinc-800/60 px-1.5 py-0.5 rounded-full">
              {dateStr ? `${dateStr} · ${timeStr}` : timeStr}
            </span>
          )}
          {match.tsdb?.leagueName && (
            <span className="text-[9px] text-zinc-500 truncate">{match.tsdb.leagueName}</span>
          )}
        </div>
      </div>
    </button>
  );
}

export const SportMatchCarousel: React.FC<SportMatchCarouselProps> = ({
  title,
  subtitle,
  icon: Icon,
  matches,
  onOpen,
  loading = false,
}) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftStart, setScrollLeftStart] = useState(0);
  const [hasDragged, setHasDragged] = useState(false);

  const cardWidth = 'w-[260px] sm:w-[300px] md:w-[320px] flex-shrink-0 min-w-[240px]';

  const handleScroll = (direction: 'left' | 'right') => {
    if (!rowRef.current) return;
    const { scrollLeft, clientWidth } = rowRef.current;
    const scrollAmount = clientWidth * 0.75;
    rowRef.current.scrollTo({
      left: direction === 'left' ? scrollLeft - scrollAmount : scrollLeft + scrollAmount,
      behavior: 'smooth',
    });
  };

  const validMatches = matches.filter(
    (m) =>
      !/redzone/i.test(m.title) &&
      !/sky sports golf|tennis channel|rally\s*(tv|channel)|nhl network|nfl network|fox league|fox cricket|willow cricket/i.test(m.title)
  );

  if (!loading && !validMatches.length) return null;

  return (
    <section className="relative my-8 group/carousel [content-visibility:auto] [contain-intrinsic-size:1px_280px]">
      <div className="flex items-end justify-between px-2 mb-3 sm:mb-4">
        <div>
          <div className="flex items-center gap-2">
            {Icon && <Icon className="w-5 h-5 text-emerald-400 shrink-0" />}
            <h2 className="text-lg sm:text-xl md:text-2xl font-black text-white tracking-tight">{title}</h2>
            {!loading && validMatches.length > 0 && (
              <span className="text-[10px] font-mono text-zinc-500 bg-zinc-800/80 px-2 py-0.5 rounded-full">{validMatches.length}</span>
            )}
          </div>
          {subtitle && <p className="text-xs text-emerald-500/80 font-medium mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => handleScroll('left')}
            className="p-2 rounded-xl bg-[#121915] border border-emerald-500/20 hover:border-emerald-400 text-zinc-300 hover:text-white transition-all shadow-md active:scale-95"
            aria-label="Scroll left">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => handleScroll('right')}
            className="p-2 rounded-xl bg-[#121915] border border-emerald-500/20 hover:border-emerald-400 text-zinc-300 hover:text-white transition-all shadow-md active:scale-95"
            aria-label="Scroll right">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div
        ref={rowRef}
        onMouseDown={(e) => {
          if (!rowRef.current) return;
          setIsMouseDown(true);
          setHasDragged(false);
          setStartX(e.pageX - rowRef.current.offsetLeft);
          setScrollLeftStart(rowRef.current.scrollLeft);
        }}
        onMouseLeave={() => setIsMouseDown(false)}
        onMouseUp={() => setIsMouseDown(false)}
        onMouseMove={(e) => {
          if (!isMouseDown || !rowRef.current) return;
          const x = e.pageX - rowRef.current.offsetLeft;
          const walk = (x - startX) * 1.5;
          if (Math.abs(walk) > 5) setHasDragged(true);
          rowRef.current.scrollLeft = scrollLeftStart - walk;
        }}
        className={`flex items-stretch gap-3 sm:gap-4 overflow-x-auto scrollbar-none scroll-smooth pb-4 pt-2 px-1 sm:px-2 select-none ${
          isMouseDown ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {loading
          ? Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className={`${cardWidth} aspect-[4/3] rounded-2xl bg-[#0c130e] border border-emerald-950 animate-pulse`} />
            ))
          : validMatches.map((match) => (
              <div
                key={match.id}
                className={cardWidth}
                onClick={(e) => { if (hasDragged) { e.stopPropagation(); e.preventDefault(); } }}
              >
                <SportMatchTile match={match} onOpen={(m) => { if (!hasDragged) onOpen(m); }} />
              </div>
            ))}
      </div>
    </section>
  );
};
