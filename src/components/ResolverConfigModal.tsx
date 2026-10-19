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
  Cloud,
} from 'lucide-react';
import {
  getResolverBaseUrl,
  setResolverBaseUrl,
  checkResolverHealth,
  CLOUDFLARE_WORKER_CODE,
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
  const [activeTab, setActiveTab] = useState<'cloudflare' | 'docker'>('cloudflare');
  const [resolverUrl, setResolverUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [copiedWorkerCode, setCopiedWorkerCode] = useState(false);
  const [copiedDockerCmd, setCopiedDockerCmd] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setResolverUrl(getResolverBaseUrl());
      setTestResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    if (!resolverUrl.trim()) {
      setTestResult({ ok: false, message: 'Please enter a worker URL to test.' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await checkResolverHealth(resolverUrl.trim());
      setTestResult(res);
      if (res.ok) {
        toast.success('Successfully connected to Cloudflare Worker!');
      } else {
        toast.error('Connection failed: ' + res.message);
      }
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    setResolverBaseUrl(resolverUrl.trim());
    toast.success(
      resolverUrl.trim()
        ? 'Stream resolver saved! Live sports will automatically stream raw HLS.'
        : 'Resolver cleared. Using default embed fallback.'
    );
    if (onSaved) onSaved();
    onClose();
  };

  const handleCopyWorker = () => {
    navigator.clipboard.writeText(CLOUDFLARE_WORKER_CODE);
    setCopiedWorkerCode(true);
    toast.success('Cloudflare Worker code copied to clipboard!');
    setTimeout(() => setCopiedWorkerCode(false), 2500);
  };

  const dockerCommand =
    'docker run -d --name streamed-resolver -p 8080:8080 -e CORS_ORIGIN="*" lunatic16/streamed-pk-resolver';

  const handleCopyDocker = () => {
    navigator.clipboard.writeText(dockerCommand);
    setCopiedDockerCmd(true);
    toast.info('Copied docker command to clipboard!');
    setTimeout(() => setCopiedDockerCmd(false), 2000);
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
                <span>Ad-Stripped HLS Resolver</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/70 text-emerald-400 border border-emerald-500/30 font-semibold">
                  Zero Ads
                </span>
              </h2>
              <p className="text-xs text-zinc-400 font-mono">
                Extracts raw .m3u8 feeds with global CORS for all devices
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
            onClick={() => setActiveTab('cloudflare')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg font-bold transition cursor-pointer ${
              activeTab === 'cloudflare'
                ? 'bg-emerald-500 text-black shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>Cloudflare Worker</span>
          </button>
          <button
            onClick={() => setActiveTab('docker')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg font-bold transition cursor-pointer ${
              activeTab === 'docker'
                ? 'bg-emerald-500 text-black shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Docker / Local</span>
          </button>
        </div>

        {activeTab === 'cloudflare' ? (
          /* Cloudflare Worker Tab */
          <div className="flex flex-col gap-3">
            {/* Quick 3-Step Guide */}
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3 flex flex-col gap-2 text-xs font-mono">
              <span className="text-emerald-400 font-bold uppercase tracking-wider text-[11px]">
                Deploy in 60 Seconds on Cloudflare (Free)
              </span>
              <ol className="list-decimal list-inside text-zinc-300 space-y-1.5 text-[11px] leading-relaxed">
                <li>Log in to <span className="text-white font-semibold">dash.cloudflare.com</span> &gt; <span className="text-white font-semibold">Workers & Pages</span></li>
                <li>Click <span className="text-white font-semibold">Create Worker</span> &gt; click <span className="text-white font-semibold">Deploy</span></li>
                <li>Click <span className="text-white font-semibold">Edit code</span>, paste the script below, and click <span className="text-white font-semibold">Save and Deploy</span>!</li>
              </ol>

              <button
                onClick={handleCopyWorker}
                className="mt-1 w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-xs font-bold transition cursor-pointer"
              >
                {copiedWorkerCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-emerald-400" />}
                <span>{copiedWorkerCode ? 'Worker Code Copied!' : 'Copy Cloudflare Worker Code'}</span>
              </button>
            </div>

            {/* Worker URL Input & Test */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-300 font-mono">
                Your Cloudflare Worker URL
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="https://your-worker-name.workers.dev"
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
          </div>
        ) : (
          /* Docker / Local Tab */
          <div className="flex flex-col gap-3">
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs font-bold text-zinc-300 font-mono">
                <span className="flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                  Docker Command
                </span>
                <button
                  onClick={handleCopyDocker}
                  className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-emerald-400 cursor-pointer transition font-mono"
                >
                  {copiedDockerCmd ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedDockerCmd ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <code className="text-[11px] font-mono bg-black/60 p-2.5 rounded-lg text-emerald-300/90 overflow-x-auto block border border-zinc-800 select-all">
                {dockerCommand}
              </code>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-300 font-mono">
                Local / VPS Resolver URL
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="http://localhost:8080"
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
          </div>
        )}

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
