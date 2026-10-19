import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  RotateCw,
  ExternalLink,
  Terminal,
  Server,
  Cloud,
} from 'lucide-react';
import {
  getResolverBaseUrl,
  setResolverBaseUrl,
  checkResolverHealth,
} from '../services/sportsStreamResolver';
import { toast } from 'sonner';

interface ResolverConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export const ResolverConfigModal: React.FC<ResolverConfigModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const [activeTab, setActiveTab] = useState<'container' | 'cloudflare'>('container');
  const [resolverUrl, setResolverUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [copiedDockerCmd, setCopiedDockerCmd] = useState(false);
  const [copiedTunnelCmd, setCopiedTunnelCmd] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setResolverUrl(getResolverBaseUrl());
      setTestResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    if (!resolverUrl.trim()) {
      setTestResult({ ok: false, message: 'Please enter a resolver URL to test.' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await checkResolverHealth(resolverUrl.trim());
      setTestResult(res);
      if (res.ok) {
        toast.success('Successfully connected to resolver service!');
      } else {
        toast.error('Connection notice: ' + res.message);
      }
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    setResolverBaseUrl(resolverUrl.trim());
    toast.success(
      resolverUrl.trim()
        ? 'Stream resolver saved! The player will route through your resolver.'
        : 'Resolver URL cleared.'
    );
    if (onSaved) onSaved();
    onClose();
  };

  const dockerCommand =
    'docker run -d --name streamed-pk-resolver -p 3000:3000 lunatic16/streamed-pk-resolver';

  const tunnelCommand =
    'cloudflared tunnel run --url http://localhost:3000';

  const handleCopy = (text: string, type: 'docker' | 'tunnel') => {
    navigator.clipboard.writeText(text);
    if (type === 'docker') {
      setCopiedDockerCmd(true);
      setTimeout(() => setCopiedDockerCmd(false), 2000);
    } else {
      setCopiedTunnelCmd(true);
      setTimeout(() => setCopiedTunnelCmd(false), 2000);
    }
    toast.info('Copied command to clipboard!');
  };

  return (
    <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 select-none">
      <div className="relative w-full max-w-lg bg-zinc-950 border border-emerald-500/30 rounded-2xl p-4 sm:p-6 shadow-[0_0_35px_rgba(16,185,129,0.18)] flex flex-col gap-4 text-white animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>Streamed.pk HLS Stream Resolver</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/70 text-emerald-400 border border-emerald-500/30 font-semibold">
                  Lunatic16
                </span>
              </h2>
              <p className="text-xs text-zinc-400 font-mono">
                Replays embed.st GOAT /fetch handshake, unlocks lock.wasm, and streams raw MPEG-TS
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-1.5 p-1 bg-zinc-900/90 rounded-xl border border-zinc-800 text-xs font-mono">
          <button
            onClick={() => setActiveTab('container')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg font-bold transition cursor-pointer ${
              activeTab === 'container'
                ? 'bg-emerald-500 text-black shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Cloud Container / Docker</span>
          </button>
          <button
            onClick={() => setActiveTab('cloudflare')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg font-bold transition cursor-pointer ${
              activeTab === 'cloudflare'
                ? 'bg-emerald-500 text-black shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>Cloudflare Tunnel / Proxy</span>
          </button>
        </div>

        {activeTab === 'container' ? (
          /* Container Setup Tab */
          <div className="flex flex-col gap-3">
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3 flex flex-col gap-2 text-xs font-mono">
              <div className="flex items-center justify-between text-zinc-300">
                <span className="text-emerald-400 font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5" />
                  Docker Run Command
                </span>
                <button
                  onClick={() => handleCopy(dockerCommand, 'docker')}
                  className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-emerald-400 cursor-pointer transition"
                >
                  {copiedDockerCmd ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedDockerCmd ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <code className="text-[11px] font-mono bg-black/60 p-2.5 rounded-lg text-emerald-300/90 overflow-x-auto block border border-zinc-800 select-all">
                {dockerCommand}
              </code>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Or deploy to <span className="text-white font-semibold">Railway / Render / VPS</span> from{' '}
                <a
                  href="https://github.com/Lunatic16/streamed-pk-resolver"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 hover:underline inline-flex items-center gap-0.5"
                >
                  Lunatic16/streamed-pk-resolver <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
                </a>. It includes the native Impit Chrome TLS binary and WEBP segment unwrapper.
              </p>
            </div>
          </div>
        ) : (
          /* Cloudflare Tunnel / Proxy Tab */
          <div className="flex flex-col gap-3">
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3 flex flex-col gap-2 text-xs font-mono">
              <div className="flex items-center justify-between text-zinc-300">
                <span className="text-emerald-400 font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Cloud className="w-3.5 h-3.5" />
                  Free Cloudflare Tunnel
                </span>
                <button
                  onClick={() => handleCopy(tunnelCommand, 'tunnel')}
                  className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-emerald-400 cursor-pointer transition"
                >
                  {copiedTunnelCmd ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedTunnelCmd ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <code className="text-[11px] font-mono bg-black/60 p-2.5 rounded-lg text-emerald-300/90 overflow-x-auto block border border-zinc-800 select-all">
                {tunnelCommand}
              </code>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Exposes your local or VPS container directly through Cloudflare with HTTPS and global edge caching, requiring no router port-forwarding.
              </p>
            </div>
          </div>
        )}

        {/* Resolver URL Input & Test */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-zinc-300 font-mono">
            Active Resolver Service URL
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="https://streamed-pk-resolver-production.up.railway.app"
              value={resolverUrl}
              onChange={(e) => {
                setResolverUrl(e.target.value);
                setTestResult(null);
              }}
              className="flex-1 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-emerald-500/60 focus:outline-none text-xs font-mono text-white placeholder-zinc-600 transition"
            />
            <button
              onClick={handleTestConnection}
              disabled={testing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-emerald-500/50 text-xs font-semibold text-zinc-300 hover:text-white transition cursor-pointer disabled:opacity-50 shrink-0"
            >
              <RotateCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin text-emerald-400' : ''}`} />
              <span>Test</span>
            </button>
          </div>
        </div>

        {/* Test Result Feedback */}
        {testResult && (
          <div
            className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs font-mono ${
              testResult.ok
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                : 'bg-amber-950/40 border-amber-500/40 text-amber-300'
            }`}
          >
            {testResult.ok ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 leading-relaxed">
              <span className="font-bold">{testResult.ok ? 'Connection Verified' : 'Notice'}: </span>
              <span>{testResult.message}</span>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="px-3.5 py-2 min-h-[40px] rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-medium transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs transition cursor-pointer shadow-[0_0_12px_rgba(16,185,129,0.35)]"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Save Configuration</span>
          </button>
        </div>
      </div>
    </div>
  );
};
