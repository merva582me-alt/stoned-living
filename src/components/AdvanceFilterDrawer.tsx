import React, { useEffect } from 'react';
import { X, RotateCcw, SlidersHorizontal, Check } from 'lucide-react';
import { AdvanceFilters, DEFAULT_ADVANCE_FILTERS } from '../types';

interface AdvanceFilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'movie' | 'tv';
  filters: AdvanceFilters;
  onChangeFilters: (filters: AdvanceFilters) => void;
  onResetFilters: () => void;
  totalResults?: number;
}

const YEAR_OPTIONS = [
  { label: 'All', value: '' },
  { label: '2026', value: '2026' },
  { label: '2025', value: '2025' },
  { label: '2024', value: '2024' },
  { label: '2023', value: '2023' },
  { label: '2022', value: '2022' },
  { label: '2021', value: '2021' },
  { label: '2020', value: '2020' },
  { label: '2010s', value: '2010s' },
];

const MOVIE_COMPANIES = [
  { id: '', name: 'All Studios' },
  { id: '420', name: 'Marvel Studios' },
  { id: '174', name: 'Warner Bros.' },
  { id: '41077', name: 'A24' },
  { id: '33', name: 'Universal Pictures' },
  { id: '4', name: 'Paramount' },
  { id: '34', name: 'Sony Pictures' },
  { id: '127928', name: '20th Century Studios' },
  { id: '3172', name: 'Blumhouse' },
  { id: '1632', name: 'Lionsgate' },
];

const TV_NETWORKS = [
  { id: '', name: 'All Networks' },
  { id: '49', name: 'HBO' },
  { id: '213', name: 'Netflix' },
  { id: '2552', name: 'Apple TV+' },
  { id: '1024', name: 'Amazon Prime' },
  { id: '174', name: 'AMC' },
  { id: '88', name: 'FX' },
  { id: '2739', name: 'Disney+' },
  { id: '4330', name: 'Paramount+' },
  { id: '453', name: 'Hulu' },
  { id: '4', name: 'BBC One' },
];

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'all', name: 'All Languages' },
];

export const AdvanceFilterDrawer: React.FC<AdvanceFilterDrawerProps> = ({
  isOpen,
  onClose,
  type,
  filters,
  onChangeFilters,
  onResetFilters,
  totalResults,
}) => {
  // Listen for Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const isCustomized =
    filters.sortBy !== DEFAULT_ADVANCE_FILTERS.sortBy ||
    filters.year !== DEFAULT_ADVANCE_FILTERS.year ||
    filters.minRating !== DEFAULT_ADVANCE_FILTERS.minRating ||
    filters.maxRating !== DEFAULT_ADVANCE_FILTERS.maxRating ||
    filters.companyId !== DEFAULT_ADVANCE_FILTERS.companyId ||
    filters.language !== DEFAULT_ADVANCE_FILTERS.language;

  const sortDateDesc = type === 'movie' ? 'primary_release_date.desc' : 'first_air_date.desc';
  const sortDateAsc = type === 'movie' ? 'primary_release_date.asc' : 'first_air_date.asc';

  const SORT_OPTIONS = [
    { label: 'Most Popular', value: 'popularity.desc' },
    { label: 'Least Popular', value: 'popularity.asc' },
    { label: 'Top Rated', value: 'vote_average.desc' },
    { label: 'Lowest Rated', value: 'vote_average.asc' },
    { label: 'Newest Release', value: sortDateDesc },
    { label: 'Oldest Release', value: sortDateAsc },
  ];

  const companiesList = type === 'movie' ? MOVIE_COMPANIES : TV_NETWORKS;

  return (
    <div className="fixed inset-0 z-[80] flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Surface */}
      <div className="relative w-full max-w-md bg-[#080d0a] border-l border-emerald-500/20 shadow-[0_0_50px_rgba(0,0,0,0.9)] flex flex-col h-full z-10 transition-transform duration-300">
        {/* Header */}
        <div className="p-5 border-b border-zinc-800/80 flex items-center justify-between shrink-0 bg-[#060a08]/90 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Advance Filter</h2>
              <p className="text-[11px] text-zinc-400">Customize your exploration</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close filters"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Filter Form */}
        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6 text-sm no-scrollbar">
          {/* 1. Sort Metric */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Sort By
            </label>
            <div className="grid grid-cols-2 gap-2">
              {SORT_OPTIONS.map((opt) => {
                const isSelected = filters.sortBy === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => onChangeFilters({ ...filters, sortBy: opt.value })}
                    className={`px-3 py-2 rounded-xl text-xs font-medium text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-500 text-black font-bold shadow-[0_0_12px_#00FF9D]'
                        : 'bg-[#0f1712] text-zinc-300 hover:bg-zinc-800 border border-emerald-500/10'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Release Year */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Released Year
            </label>
            <div className="flex flex-wrap gap-2">
              {YEAR_OPTIONS.map((opt) => {
                const isSelected = filters.year === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => onChangeFilters({ ...filters, year: opt.value })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-500 text-black font-bold shadow-[0_0_10px_#00FF9D]'
                        : 'bg-[#0f1712] text-zinc-300 hover:bg-zinc-800 border border-emerald-500/10'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Rating Range */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Minimum Rating Score
              </label>
              <span className="text-xs font-mono font-bold text-emerald-400">
                {filters.minRating > 0 ? `${filters.minRating}.0+` : 'Any rating'}
              </span>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {[0, 6, 7, 8, 9].map((score) => {
                const isSelected = filters.minRating === score;
                return (
                  <button
                    key={score}
                    onClick={() => onChangeFilters({ ...filters, minRating: score })}
                    className={`py-2 rounded-lg text-xs font-semibold text-center transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-500 text-black shadow-[0_0_10px_#00FF9D]'
                        : 'bg-[#0f1712] text-zinc-300 hover:bg-zinc-800 border border-emerald-500/10'
                    }`}
                  >
                    {score === 0 ? 'All' : `${score}+ ★`}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Production Studio / Network */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              {type === 'movie' ? 'Studios & Production' : 'Networks & Channels'}
            </label>
            <div className="flex flex-wrap gap-2">
              {companiesList.map((comp) => {
                const isSelected = filters.companyId === comp.id;
                return (
                  <button
                    key={comp.id || 'all'}
                    onClick={() => onChangeFilters({ ...filters, companyId: comp.id })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-500 text-black font-bold shadow-[0_0_10px_#00FF9D]'
                        : 'bg-[#0f1712] text-zinc-300 hover:bg-zinc-800 border border-emerald-500/10'
                    }`}
                  >
                    {comp.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5. Language */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Language
            </label>
            <div className="grid grid-cols-3 gap-2">
              {LANGUAGES.map((lang) => {
                const isSelected = filters.language === lang.code;
                return (
                  <button
                    key={lang.code}
                    onClick={() => onChangeFilters({ ...filters, language: lang.code })}
                    className={`px-3 py-2 rounded-xl text-xs font-medium text-center transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-500 text-black font-bold shadow-[0_0_10px_#00FF9D]'
                        : 'bg-[#0f1712] text-zinc-300 hover:bg-zinc-800 border border-emerald-500/10'
                    }`}
                  >
                    {lang.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sticky Action Footer */}
        <div className="p-4 pb-6 sm:pb-4 border-t border-zinc-800/80 bg-[#060a08]/95 flex items-center gap-3 shrink-0">
          <button
            onClick={onResetFilters}
            disabled={!isCustomized}
            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              isCustomized
                ? 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700'
                : 'bg-zinc-950 text-zinc-600 border border-zinc-900 cursor-not-allowed opacity-50'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>

          <button
            onClick={onClose}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs shadow-[0_0_20px_#00FF9D] transition-all cursor-pointer"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>
              Apply & Close
              {totalResults !== undefined && totalResults > 0 ? ` (${totalResults.toLocaleString()}+)` : ''}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
