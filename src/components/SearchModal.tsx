import React, { useState, useEffect } from 'react';
import { Search, X, Play, Film, Tv, Star, Cannabis, TrendingUp, User } from 'lucide-react';
import { MediaItem } from '../types';
import { searchMedia } from '../services/api';
import { getEffectiveMediaType, isAnimeItem, getMediaBadgeLabel } from '../utils/mediaUtils';

interface SearchModalProps {
  onClose: () => void;
  onPlay: (item: MediaItem) => void;
  onOpenDetails: (item: MediaItem) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({ onClose, onPlay, onOpenDetails }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'movie' | 'tv' | 'people'>('all');

  // Lock body scroll when search modal is open
  useEffect(() => {
    const originalBodyStyle = document.body.style.overflow;
    const originalDocStyle = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalBodyStyle || '';
      document.documentElement.style.overflow = originalDocStyle || '';
    };
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      const data = await searchMedia(query);
      setResults(data);
      setLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const filteredResults = results.filter((item) => {
    if (filter === 'all') return true;
    const type = getEffectiveMediaType(item);
    if (filter === 'movie') return type === 'movie';
    if (filter === 'tv') return type === 'tv';
    if (filter === 'people') return item.media_type === 'person' || item.name;
    return true;
  });

  const filterOptions: { id: 'all' | 'movie' | 'tv' | 'people'; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'movie', label: 'Movies' },
    { id: 'tv', label: 'TV Shows' },
    { id: 'people', label: 'People' },
  ];

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-3 sm:pt-14 px-3 sm:px-6 bg-black/90 backdrop-blur-2xl animate-in fade-in duration-150"
      onClick={onClose}
      aria-hidden="true"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="relative w-full max-w-4xl bg-[#090e0b]/95 border border-emerald-500/30 rounded-3xl overflow-hidden shadow-[0_25px_70px_rgba(0,0,0,0.95)] max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Bar Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800/80 flex items-center gap-3 bg-[#0d1410]">
          <Search className="w-5 h-5 text-emerald-400 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Movies, TV Shows, People..."
            className="w-full bg-transparent text-white text-base sm:text-lg placeholder-zinc-500 focus:outline-none font-medium"
            autoFocus
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded-lg text-zinc-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            aria-label="Close search"
            className="p-2 rounded-xl bg-black/50 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 shrink-0 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filters & Results Counter (Screen 6) */}
        <div className="px-5 py-3 bg-black/50 border-b border-zinc-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
            {filterOptions.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold tracking-wide transition whitespace-nowrap cursor-pointer ${
                  filter === f.id
                    ? 'bg-emerald-500 text-black shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                    : 'text-zinc-400 hover:text-white bg-zinc-900/60 hover:bg-zinc-800'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {query.trim() && !loading && (
            <span className="text-xs font-mono text-zinc-400">
              {filteredResults.length} results for "{query}"
            </span>
          )}
        </div>

        {/* Results Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {loading ? (
            <div className="py-20 text-center text-xs text-emerald-400 font-mono animate-pulse">
              Searching Stoned.living 4K library...
            </div>
          ) : !query.trim() ? (
            <div className="py-6 space-y-4">
              <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4" /> Popular Searches
              </p>
              <div className="flex flex-wrap gap-2.5">
                {[
                  'Dune: Part Two',
                  'Breaking Bad',
                  'Interstellar',
                  'The Office',
                  'Demon Slayer',
                  'Inception',
                  'Game of Thrones',
                  'Spirited Away',
                ].map((s) => (
                  <button
                    key={s}
                    onClick={() => setQuery(s)}
                    className="bg-[#121c16] border border-emerald-900/60 hover:border-emerald-500/50 text-zinc-300 hover:text-emerald-300 text-xs font-medium px-4 py-2 rounded-xl transition cursor-pointer"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : filteredResults.length > 0 ? (
            /* Responsive Poster Card Grid (Screen 6) */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filteredResults.map((item) => {
                const title = item.title || item.name || 'Untitled';
                const year = (item.release_date || item.first_air_date || '').slice(0, 4) || '2024';
                const poster = item.poster_path
                  ? `https://image.tmdb.org/t/p/w342${item.poster_path}`
                  : 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=342&auto=format&fit=crop&q=80';

                return (
                  <div
                    key={`${item.id}_${item.media_type}`}
                    onClick={() => {
                      onClose();
                      onOpenDetails(item);
                    }}
                    className="group flex flex-col gap-2 cursor-pointer transition-transform duration-200"
                  >
                    <div className="relative aspect-[2/3] w-full rounded-2xl overflow-hidden bg-zinc-900 border border-transparent group-hover:border-emerald-400/80 group-hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] group-hover:scale-105 transition-all duration-300">
                      <img
                        src={poster}
                        alt={title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="w-10 h-10 rounded-full bg-emerald-500 text-black flex items-center justify-center shadow-lg">
                          <Play className="w-5 h-5 fill-black ml-0.5" />
                        </div>
                      </div>
                    </div>

                    <div className="px-1">
                      <h4 className="font-bold text-xs sm:text-sm text-white group-hover:text-emerald-300 transition-colors truncate">
                        {title}
                      </h4>
                      <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 font-mono mt-0.5">
                        <span>{year}</span>
                        <span>·</span>
                        <span className="flex items-center gap-0.5 text-amber-400 font-bold">
                          <Star className="w-3 h-3 fill-amber-400" />
                          <span>{item.vote_average?.toFixed(1) || '8.0'}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-20 text-center text-sm text-zinc-400">
              No results found for "{query}". Try searching for another movie or TV show.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
