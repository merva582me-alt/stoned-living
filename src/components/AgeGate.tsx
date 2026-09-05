import React, { useState } from 'react';
import { Cannabis, ShieldCheck, AlertTriangle } from 'lucide-react';

const AGE_GATE_KEY = 'bluntpics_age_verified';

export function isAgeVerified(): boolean {
  return localStorage.getItem(AGE_GATE_KEY) === '1';
}

interface AgeGateProps {
  onVerified: () => void;
}

export const AgeGate: React.FC<AgeGateProps> = ({ onVerified }) => {
  const [declined, setDeclined] = useState(false);

  const handleConfirm = () => {
    localStorage.setItem(AGE_GATE_KEY, '1');
    onVerified();
  };

  if (declined) {
    return (
      <div className="min-h-screen bg-[#070b08] flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto" />
          <h2 className="text-xl font-black text-white">Age Restricted</h2>
          <p className="text-zinc-400 text-sm">
            You must be 18 or older (or the legal age in your jurisdiction) to access Stoned.living.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070b08] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-[#0b100d] border border-emerald-500/30 rounded-3xl p-8 text-center space-y-6 shadow-2xl">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 via-emerald-600 to-green-800 p-0.5 shadow-[0_0_30px_rgba(16,185,129,0.4)]">
            <div className="w-full h-full bg-[#090e0b] rounded-[14px] flex items-center justify-center">
              <Cannabis className="w-7 h-7 text-emerald-400" />
            </div>
          </div>
          <div className="text-left">
            <span className="font-extrabold text-2xl tracking-wider">
              <span className="text-white">STONED</span>
              <span className="text-emerald-400">.LIVING</span>
            </span>
            <p className="text-[10px] text-emerald-500/80 tracking-widest font-mono uppercase">High Definition Streaming</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-black text-white">Age Verification</h1>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Stoned.living features cannabis-related content. You must be <strong className="text-white">18 years or older</strong> (or the legal age in your jurisdiction) to enter.
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleConfirm}
            className="w-full bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 text-black font-extrabold py-3.5 rounded-2xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:scale-105"
          >
            I am 18 or older — Enter
          </button>
          <button
            onClick={() => setDeclined(true)}
            className="w-full bg-transparent text-zinc-500 hover:text-zinc-300 font-medium py-2 rounded-2xl transition text-sm"
          >
            I am under 18 — Exit
          </button>
        </div>

        <p className="text-[10px] text-zinc-600 leading-relaxed">
          By entering you confirm you are of legal age and agree to our Terms of Service. Cannabis regulations vary by location — know your local laws.
        </p>
      </div>
    </div>
  );
};
