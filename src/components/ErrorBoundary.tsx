import React from 'react';
import { Cannabis } from 'lucide-react';

interface EBState { hasError: boolean; }
interface EBProps { children: React.ReactNode; }

export class ErrorBoundary extends React.Component {
  declare state: EBState;
  declare props: EBProps;

  constructor(p: EBProps) {
    super(p);
    // eslint-disable-next-line react/no-direct-mutation-state
    (this as unknown as { state: EBState }).state = { hasError: false };
  }

  static getDerivedStateFromError(): EBState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[Stoned.living] Uncaught error:', error, info);
  }

  render(): React.ReactNode {
    const s = this.state as unknown as EBState;
    const p = this.props as unknown as EBProps;

    if (s.hasError) {
      return (
        <div className="min-h-screen bg-[#070b08] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[#0b100d] border border-emerald-500/30 rounded-3xl p-8 text-center space-y-6 shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto">
              <Cannabis className="w-8 h-8 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white mb-2">Something went wrong.</h1>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Stoned.living hit an unexpected error. Refresh the page to reload your session.
              </p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold py-3 rounded-2xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.4)]"
            >
              Reload Stoned.living
            </button>
          </div>
        </div>
      );
    }

    return p.children as React.ReactNode;
  }
}
