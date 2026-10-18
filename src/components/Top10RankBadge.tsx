import React from 'react';

interface Top10RankBadgeProps {
  rank: number;
}

export const Top10RankBadge: React.FC<Top10RankBadgeProps> = ({ rank }) => {
  const isOne = rank === 1;
  const isTen = rank === 10;

  // Compact static SVG viewBox dimensions:
  // Digit 1: 48px | Digits 2-9: 68px | Cleanly separated 10: 106px
  const viewBoxWidth = isTen ? 106 : isOne ? 48 : 68;
  const textX = isOne ? 24 : 34;

  // Minimal subtle overlap (~4px to 8px):
  // The whole number sits clearly to the left of each poster so the entire rank can be read
  const overlapClasses = isTen
    ? 'right-[calc(100%-0.6rem)] sm:right-[calc(100%-0.8rem)] md:right-[calc(100%-1rem)] lg:right-[calc(100%-1.2rem)]'
    : isOne
    ? 'right-[calc(100%-0.15rem)] sm:right-[calc(100%-0.2rem)] md:right-[calc(100%-0.25rem)] lg:right-[calc(100%-0.3rem)]'
    : 'right-[calc(100%-0.25rem)] sm:right-[calc(100%-0.35rem)] md:right-[calc(100%-0.45rem)] lg:right-[calc(100%-0.55rem)]';

  const fontStyle = {
    fontFamily: 'Impact, "Bebas Neue", "Arial Black", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    paintOrder: 'stroke fill',
  };

  return (
    <div
      className={`absolute bottom-0 ${overlapClasses} h-[68%] z-0 pointer-events-none select-none flex items-end overflow-visible`}
      aria-hidden="true"
    >
      <svg
        viewBox={`0 0 ${viewBoxWidth} 132`}
        className="h-full w-auto max-w-none shrink-0 pointer-events-none select-none overflow-visible drop-shadow-[0_4px_14px_rgba(0,0,0,0.85)]"
        preserveAspectRatio="xMaxYMax meet"
      >
        {isTen ? (
          <g>
            {/* Number 10: Static cleanly separated '1' and '0' with 8px open gap */}
            {/* Base dark charcoal solid body with outer backing border */}
            <text
              x="22"
              y="124"
              textAnchor="middle"
              className="font-black text-[126px] select-none fill-[#121413] stroke-[#383838]"
              strokeWidth="4.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              style={fontStyle}
            >
              1
            </text>
            <text
              x="74"
              y="124"
              textAnchor="middle"
              className="font-black text-[126px] select-none fill-[#121413] stroke-[#383838]"
              strokeWidth="4.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              style={fontStyle}
            >
              0
            </text>

            {/* Static crisp white outline overlay for razor-sharp legibility */}
            <text
              x="22"
              y="124"
              textAnchor="middle"
              className="font-black text-[126px] select-none fill-transparent stroke-[rgba(255,255,255,0.88)]"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              style={fontStyle}
            >
              1
            </text>
            <text
              x="74"
              y="124"
              textAnchor="middle"
              className="font-black text-[126px] select-none fill-transparent stroke-[rgba(255,255,255,0.88)]"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              style={fontStyle}
            >
              0
            </text>
          </g>
        ) : (
          <g>
            {/* Single digits 1 through 9: Static crisp white outline with dark charcoal fill */}
            {/* Base dark charcoal solid body */}
            <text
              x={textX}
              y="124"
              textAnchor="middle"
              className="font-black text-[128px] select-none fill-[#121413] stroke-[#383838]"
              strokeWidth="4.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              letterSpacing="-2px"
              style={fontStyle}
            >
              {rank}
            </text>

            {/* Static crisp white outline overlay */}
            <text
              x={textX}
              y="124"
              textAnchor="middle"
              className="font-black text-[128px] select-none fill-transparent stroke-[rgba(255,255,255,0.88)]"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              letterSpacing="-2px"
              style={fontStyle}
            >
              {rank}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
};
