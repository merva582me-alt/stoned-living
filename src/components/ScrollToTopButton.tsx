import React, { useState, useEffect } from 'react';
import { ChevronUp } from 'lucide-react';

export const ScrollToTopButton: React.FC = () => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShow(window.scrollY > 300);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    // Run once on mount in case already scrolled
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (!show) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-4 py-2 rounded-xl bg-[#181818]/90 hover:bg-[#252525] border border-zinc-700/60 text-white text-xs font-semibold shadow-2xl backdrop-blur-md transition-all cursor-pointer hover:scale-105 active:scale-95 select-none animate-fadeIn"
      aria-label="Scroll to top"
    >
      <ChevronUp className="w-3.5 h-3.5" />
      <span>Scroll to top</span>
    </button>
  );
};
