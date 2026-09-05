import React, { useState, useEffect } from 'react';
import { Search, X, Play, Film, Tv, Star, Cannabis, TrendingUp } from 'lucide-react';
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
  const [filter, setFilter] = useState<'all' | 'movie' | 'tv' | 'anime'>('all');

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
    const anime = isAnimeItem(item);
    if (filter === 'movie') return type === 'movie' && !anime;
    if (filter === 'tv') return type === 'tv' && !anime;
    if (filter === 'anime') return anime;
    return true;
  });

  const filterOptions: { id: 'all' | 'movie' | 'tv' | 'anime'; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'movie', label: 'Movies' },
    { id: 'tv', label: 'TV Shows' },
    { id: 'anime', label: 'Anime' },
  ];

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-3 sm:pt-16 px-3 sm:px-4 bg-black/90 backdrop-blur-xl animate-in fade-in duration-150"
      onClick={onClose}
      aria-hidden="true"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="relative w-full max-w-2xl bg-[#0b100d] border border-emerald-500/40 rounded-3xl overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.95)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Bar Header */}
        <div className="p-4 border-b border-emerald-900/50 flex items-center gap-3 bg-[#0d1410]">
          <Search className="w-5 h-5 text-emerald-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Movies, TV Shows, Cast, Directors..."
            className="w-full bg-transparent text-white text-base placeholder-zinc-500 focus:outline-none font-medium"
            autoFocus
          />
          <button
            onClick={onClose}
            aria-label="Close search"
            className="p-2 rounded-xl bg-black/50 hover:bg-emerald-950 text-zinc-400 hover:text-white border border-emerald-500/20"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filters */}
        <div className="px-4 py-2.5 bg-black/40 border-b border-emerald-950 flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-none">
          {filterOptions.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider transition whitespace-nowrap shrink-0 ${
                filter === f.id
                  ? 'bg-emerald-500 text-black shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Results List */}
        <div className="max-h-[68vh] sm:max-h-[60vh] overflow-y-auto p-3 sm:p-4 space-y-2">
          {loading ? (
            <div className="py-12 text-center text-xs text-emerald-400 font-mono animate-pulse">
              Searching Stoned.living 4K index...
            </div>
          ) : !query.trim() ? (
            <div className="p-2 space-y-3">
              <p className="text-xs font-extrabold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" /> Popular Searches
              </p>
              <div className="flex flex-wrap gap-2">
                {['Interstellar', 'The Office', 'Demon Slayer', 'Inception', 'Breaking Bad', 'Spirited Away'].map((s) => (
                  <button
                    key={s}
                    onClick={() => setQuery(s)}
                    className="bg-[#0e1411] border border-emerald-900/60 hover:border-emerald-500/50 text-zinc-300 hover:text-emerald-300 text-xs font-medium px-3.5 py-1.5 rounded-full transition"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : filteredResults.length > 0 ? (
            filteredResults.map((item) => {
              const title = item.title || item.name || 'Untitled';
              const year = (item.release_date || item.first_air_date || '').slice(0, 4);
              const poster = item.poster_path
                ? `https://image.tmdb.org/t/p/w185${item.poster_path}`
                : 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=185&auto=format&fit=crop&q=80';

              return (
                <div
                  key={`${item.id}_${item.media_type}`}
                  onClick={() => {
                    onClose();
                    onOpenDetails(item);
                  }}
                  className="flex items-center justify-between p-2.5 rounded-2xl bg-[#101713] hover:bg-emerald-950/40 border border-emerald-900/40 hover:border-emerald-500/40 transition cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <img src={poster} alt={title} className="w-12 h-16 rounded-xl object-cover" />
                    <div>
                      <h4 className="font-bold text-sm text-white group-hover:text-emerald-400 transition-colors">
                        {title}
                      </h4>
                      <div className="flex items-center gap-2 text-xs text-zinc-400 mt-0.5">
                        <span className="text-emerald-400 font-mono uppercase text-[10px]">
                          {getMediaBadgeLabel(item)}
                        </span>
                        {year && <span>• {year}</span>}
                        {item.vote_average && (
                          <span className="text-amber-400 font-bold flex items-center gap-0.5 text-[10px]">
                            <Star className="w-3 h-3 fill-amber-400" /> {item.vote_average.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onClose();
                      onPlay(item);
                    }}
                    className="p-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-black border border-emerald-500/30 transition-all"
                  >
                    <Play className="w-4 h-4 fill-current" />
                  </button>
                </div>
              );
            })
          ) : query.trim() ? (
            <div className="py-12 text-center text-xs text-zinc-500">No media titles found matching "{query}"</div>
          ) : (
            <div className="py-12 text-center text-xs text-zinc-500">
              Type a movie or TV show name to instantly search...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
