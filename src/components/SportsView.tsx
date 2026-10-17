import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Trophy,
  Radio,
  Search,
  RefreshCw,
  Play,
  Calendar,
  Clock,
  Flame,
  Shield,
  Filter,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { APIMatch, SportCategory } from '../types';
import {
  fetchLiveMatches,
  fetchTodayMatches,
  fetchSportsCategories,
  getTeamBadgeUrl,
  getMatchPosterUrl,
} from '../services/sportsApi';
import { SportsWatchPlayer } from './SportsWatchPlayer';

interface SportsViewProps {
  onPlayMedia?: (item: any) => void;
  onSelectMatch?: (match: APIMatch) => void;
}

export const SportsView: React.FC<SportsViewProps> = ({ onSelectMatch }) => {
  const [liveMatches, setLiveMatches] = useState<APIMatch[]>([]);
  const [todayMatches, setTodayMatches] = useState<APIMatch[]>([]);
  const [categories, setCategories] = useState<SportCategory[]>([]);
  const [selectedSport, setSelectedSport] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeMatch, setActiveMatch] = useState<APIMatch | null>(null);

  const handleSelectMatch = (match: APIMatch) => {
    if (onSelectMatch) {
      onSelectMatch(match);
    } else {
      setActiveMatch(match);
    }
  };

  // Load all live and scheduled matches
  const loadMatches = useCallback(async () => {
    setLoading(true);
    try {
      const [liveRes, todayRes, catRes] = await Promise.all([
        fetchLiveMatches(),
        fetchTodayMatches(),
        fetchSportsCategories(),
      ]);

      setLiveMatches(liveRes);
      setTodayMatches(todayRes);
      setCategories(catRes);
    } catch (e) {
      console.error('Failed to load sports data:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMatches();
  }, [loadMatches]);

  // Filter matches based on selected category & search query
  const matchesFilter = useCallback(
    (matches: APIMatch[]) => {
      return matches.filter((match) => {
        const matchesCategory =
          selectedSport === 'all' ||
          match.category?.toLowerCase() === selectedSport.toLowerCase();

        const q = searchQuery.toLowerCase().trim();
        const matchesSearch =
          !q ||
          match.title?.toLowerCase().includes(q) ||
          match.teams?.home?.name?.toLowerCase().includes(q) ||
          match.teams?.away?.name?.toLowerCase().includes(q) ||
          match.category?.toLowerCase().includes(q);

        return matchesCategory && matchesSearch;
      });
    },
    [selectedSport, searchQuery]
  );

  const filteredLiveMatches = useMemo(
    () => matchesFilter(liveMatches),
    [liveMatches, matchesFilter]
  );

  const filteredUpcomingMatches = useMemo(() => {
    // Exclude matches that are already in liveMatches
    const upcoming = todayMatches.filter(
      (m) => !liveMatches.some((lm) => lm.id === m.id)
    );
    return matchesFilter(upcoming);
  }, [todayMatches, liveMatches, matchesFilter]);

  // Format kick-off timestamp
  const formatKickoff = (timestamp: number) => {
    if (!timestamp) return 'Today';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="w-full min-h-screen bg-[#050806] text-white pt-6 sm:pt-8 pb-28 px-4 sm:px-8 lg:px-12 xl:px-16 selection:bg-emerald-500 selection:text-black">
      <div className="w-full space-y-8 max-w-[1800px] mx-auto">
        {/* ── Page Header ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-900 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-zinc-900/90 border border-emerald-500/30 flex items-center justify-center shadow-[0_0_15px_rgba(0,223,130,0.25)]">
                <Trophy className="w-5 h-5 text-[#00df82]" />
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                Live Sports Arena
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1.5">
              Live sports broadcast schedules and crystal-clear streams.
            </p>
          </div>

          {/* Quick Stats & Refresh Button */}
          <div className="flex items-center gap-3 self-start md:self-auto flex-wrap">
            <div className="flex items-center gap-2 bg-[#0c1410] border border-emerald-500/20 px-3.5 py-1.5 rounded-xl text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              <span className="text-zinc-400">Live now:</span>
              <span className="text-[#00df82] font-bold">{liveMatches.length}</span>
            </div>

            <button
              onClick={loadMatches}
              disabled={loading}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-xs font-bold text-zinc-300 hover:text-white border border-zinc-800 transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* ── Search & Sport Filter Categories ── */}
        <div className="space-y-4">
          {/* Search bar */}
          <div className="relative max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search team, sport, or match..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0c1410] border border-emerald-500/20 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-white"
              >
                Clear
              </button>
            )}
          </div>

          {/* Sport Categories Pill Bar */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            <button
              onClick={() => setSelectedSport('all')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                selectedSport === 'all'
                  ? 'bg-emerald-500 text-black shadow-[0_0_15px_#00FF9D] font-bold'
                  : 'bg-[#0c1410] text-zinc-300 hover:text-white hover:bg-zinc-800 border border-emerald-500/15'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>All Sports</span>
            </button>

            {categories.map((cat) => {
              const isActive = selectedSport === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedSport(cat.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap capitalize transition-all cursor-pointer ${
                    isActive
                      ? 'bg-emerald-500 text-black shadow-[0_0_15px_#00FF9D] font-bold'
                      : 'bg-[#0c1410] text-zinc-300 hover:text-white hover:bg-zinc-800 border border-emerald-500/15'
                  }`}
                >
                  <span>{cat.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Content Sections ── */}
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
            <span className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-widest">
              Connecting to live sports feeds...
            </span>
          </div>
        ) : (
          <div className="space-y-12">
            {/* ── 1. LIVE MATCHES SECTION ── */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                  <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                    <span>Live Matches Now</span>
                    <span className="text-xs font-mono text-zinc-400 font-normal">
                      ({filteredLiveMatches.length})
                    </span>
                  </h2>
                </div>
              </div>

              {filteredLiveMatches.length === 0 ? (
                <div className="p-8 rounded-2xl bg-[#090e0b]/80 border border-zinc-900 text-center space-y-2">
                  <AlertCircle className="w-8 h-8 text-zinc-600 mx-auto" />
                  <p className="text-sm font-semibold text-zinc-400">
                    No live matches currently underway in this category.
                  </p>
                  <p className="text-xs text-zinc-600">
                    Check today's schedule below or select another sport.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredLiveMatches.map((match) => {
                    const homeBadge = getTeamBadgeUrl(match.teams?.home?.badge);
                    const awayBadge = getTeamBadgeUrl(match.teams?.away?.badge);
                    const posterUrl = getMatchPosterUrl(match.poster);

                    return (
                      <div
                        key={match.id}
                        onClick={() => handleSelectMatch(match)}
                        className="group relative bg-[#090e0b] hover:bg-[#0c1410] border border-emerald-500/20 hover:border-emerald-500/50 rounded-2xl p-5 transition-all duration-300 cursor-pointer shadow-lg hover:shadow-[0_0_25px_rgba(0,223,130,0.15)] flex flex-col justify-between"
                      >
                        {/* Header: Category & Live Indicator */}
                        <div className="flex items-center justify-between gap-2 mb-4">
                          <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-400/90 font-semibold">
                            {match.category}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-red-600/90 text-white text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1 animate-pulse">
                            <Radio className="w-3 h-3" />
                            <span>LIVE</span>
                          </span>
                        </div>

                        {/* Teams or Poster Display */}
                        {homeBadge && awayBadge ? (
                          <div className="flex items-center justify-between gap-3 py-3 px-2">
                            <div className="flex flex-col items-center text-center flex-1 min-w-0">
                              <div className="w-14 h-14 rounded-xl bg-zinc-900/80 p-2 flex items-center justify-center border border-zinc-800 group-hover:border-emerald-500/30 transition-colors">
                                <img
                                  src={homeBadge}
                                  alt={match.teams?.home?.name || 'Home'}
                                  className="w-full h-full object-contain"
                                  loading="lazy"
                                />
                              </div>
                              <span className="text-xs font-bold text-white mt-2 line-clamp-1 w-full">
                                {match.teams?.home?.name}
                              </span>
                            </div>

                            <span className="text-xs font-mono font-black text-zinc-500 shrink-0">
                              VS
                            </span>

                            <div className="flex flex-col items-center text-center flex-1 min-w-0">
                              <div className="w-14 h-14 rounded-xl bg-zinc-900/80 p-2 flex items-center justify-center border border-zinc-800 group-hover:border-emerald-500/30 transition-colors">
                                <img
                                  src={awayBadge}
                                  alt={match.teams?.away?.name || 'Away'}
                                  className="w-full h-full object-contain"
                                  loading="lazy"
                                />
                              </div>
                              <span className="text-xs font-bold text-white mt-2 line-clamp-1 w-full">
                                {match.teams?.away?.name}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-4 py-2">
                            {posterUrl && (
                              <div className="w-16 h-20 rounded-xl overflow-hidden shrink-0 border border-zinc-800">
                                <img
                                  src={posterUrl}
                                  alt={match.title}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                              </div>
                            )}
                            <h3 className="text-sm font-bold text-white line-clamp-2">
                              {match.title}
                            </h3>
                          </div>
                        )}

                        {/* Bottom Action Footer */}
                        <div className="mt-4 pt-3 border-t border-zinc-900 flex items-center justify-between">
                          <span className="text-[11px] font-mono text-zinc-400">
                            {match.sources?.length || 1} stream source{match.sources?.length === 1 ? '' : 's'}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectMatch(match);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 text-black text-xs font-bold group-hover:bg-[#00df82] transition-colors shadow-[0_0_12px_rgba(0,223,130,0.3)] cursor-pointer"
                          >
                            <Play className="w-3.5 h-3.5 fill-black" />
                            <span>Watch Live</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* ── 2. TODAY'S SCHEDULED MATCHES ── */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-400" />
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Today's Match Schedule
                </h2>
                <span className="text-xs font-mono text-zinc-400 font-normal">
                  ({filteredUpcomingMatches.length})
                </span>
              </div>

              {filteredUpcomingMatches.length === 0 ? (
                <div className="p-8 rounded-2xl bg-[#090e0b]/80 border border-zinc-900 text-center space-y-2">
                  <p className="text-sm font-semibold text-zinc-400">
                    No additional scheduled matches found for today.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredUpcomingMatches.map((match) => {
                    const homeBadge = getTeamBadgeUrl(match.teams?.home?.badge);
                    const awayBadge = getTeamBadgeUrl(match.teams?.away?.badge);
                    const posterUrl = getMatchPosterUrl(match.poster);

                    return (
                      <div
                        key={match.id}
                        onClick={() => handleSelectMatch(match)}
                        className="group relative bg-[#090e0b]/80 hover:bg-[#0c1410] border border-zinc-800/80 hover:border-emerald-500/40 rounded-2xl p-5 transition-all duration-300 cursor-pointer flex flex-col justify-between"
                      >
                        {/* Header: Category & Kick-off Time */}
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                            {match.category}
                          </span>
                          <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                            <Clock className="w-3 h-3" />
                            <span>{formatKickoff(match.date)}</span>
                          </span>
                        </div>

                        {/* Match Title & Teams */}
                        {homeBadge && awayBadge ? (
                          <div className="flex items-center justify-between gap-2 py-2">
                            <div className="flex items-center gap-2.5 flex-1 min-w-0">
                              <img
                                src={homeBadge}
                                alt={match.teams?.home?.name}
                                className="w-7 h-7 object-contain shrink-0"
                                loading="lazy"
                              />
                              <span className="text-xs font-bold text-white truncate">
                                {match.teams?.home?.name}
                              </span>
                            </div>
                            <span className="text-[10px] font-mono text-zinc-500 shrink-0 font-bold px-1">
                              VS
                            </span>
                            <div className="flex items-center gap-2.5 flex-1 min-w-0 justify-end text-right">
                              <span className="text-xs font-bold text-white truncate">
                                {match.teams?.away?.name}
                              </span>
                              <img
                                src={awayBadge}
                                alt={match.teams?.away?.name}
                                className="w-7 h-7 object-contain shrink-0"
                                loading="lazy"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3 py-2">
                            {posterUrl && (
                              <img
                                src={posterUrl}
                                alt={match.title}
                                className="w-12 h-14 rounded-lg object-cover shrink-0 border border-zinc-800"
                                loading="lazy"
                              />
                            )}
                            <h3 className="text-xs sm:text-sm font-bold text-white line-clamp-2">
                              {match.title}
                            </h3>
                          </div>
                        )}

                        {/* Footer */}
                        <div className="mt-3 pt-2.5 border-t border-zinc-900/80 flex items-center justify-between text-[11px] text-zinc-400">
                          <span>{match.popular ? '🔥 Popular Event' : 'Scheduled Broadcast'}</span>
                          <span className="text-emerald-400 group-hover:underline flex items-center gap-1 font-bold">
                            <span>Open Stream</span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {/* ── Fullscreen Cinema Sports Watch Player Modal ── */}
      {activeMatch && (
        <SportsWatchPlayer
          match={activeMatch}
          onClose={() => setActiveMatch(null)}
        />
      )}
    </div>
  );
};
