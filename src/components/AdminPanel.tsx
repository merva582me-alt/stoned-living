import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  Activity,
  Database,
  RefreshCw,
  Check,
  Flame,
  Server,
  ToggleLeft,
  ToggleRight,
  LogOut,
  Wifi,
  WifiOff,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Zap
} from 'lucide-react';
import { SiteSettings } from '../types';
import { saveSiteSettings } from '../services/api';
import { saveSiteSettingsToFirestore } from '../services/firebase';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ResolverStatus {
  id: string;
  label: string;
  latencyMs: number | null;
  reachable: boolean | null;
  fallbackTriggers: number;
  lastChecked: string | null;
  checking: boolean;
}

const RESOLVER_DEFS = [
  { id: 'vidsrc',    label: 'VidSrc'    },
  { id: 'vidlink',   label: 'VidLink'   },
  { id: 'vidcore',   label: 'VidCore'   },
  { id: 'vidup',     label: 'VidUp'     },
  { id: 'streamed',  label: 'Streamed'  },
  { id: 'daddylive', label: 'DaddyLive' }
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WORKER_BASE = import.meta.env.VITE_RESOLVER_URL || 'https://stoned-resolver.workers.dev';

async function pingResolver(id: string): Promise<{ reachable: boolean; latencyMs: number }> {
  const start = performance.now();
  try {
    const res = await fetch(`${WORKER_BASE}/api/health?resolver=${id}`, { signal: AbortSignal.timeout(6000) });
    const latencyMs = Math.round(performance.now() - start);
    return { reachable: res.ok, latencyMs };
  } catch {
    return { reachable: false, latencyMs: Math.round(performance.now() - start) };
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AdminPanelProps {
  settings: SiteSettings | null;
  onRefreshSettings: () => void;
  onUpdateSettings?: (newSettings: SiteSettings) => void;
  onLogoutAdmin?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const AdminPanel: React.FC<AdminPanelProps> = ({
  settings,
  onRefreshSettings,
  onUpdateSettings,
  onLogoutAdmin
}) => {
  // ── Announcement state ──────────────────────────────────────────────────
  const [announcementText, setAnnouncementText] = useState(
    settings?.announcementText || '🌿 WELCOME TO STONED.LIVING 4K STREAMING — CHILL SESSIONS LIVE!'
  );
  const [announcementActive, setAnnouncementActive] = useState(
    settings?.announcementActive !== undefined ? settings.announcementActive : true
  );
  const [saving, setSaving] = useState(false);

  // ── Stream health state ─────────────────────────────────────────────────
  const [resolvers, setResolvers] = useState<ResolverStatus[]>(
    RESOLVER_DEFS.map((r) => ({
      id: r.id,
      label: r.label,
      latencyMs: null,
      reachable: null,
      fallbackTriggers: 0,
      lastChecked: null,
      checking: false
    }))
  );
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [disabledResolvers, setDisabledResolvers] = useState<Set<string>>(new Set());

  // Sync settings prop → local state
  useEffect(() => {
    if (settings) {
      if (settings.announcementText !== undefined) setAnnouncementText(settings.announcementText);
      if (settings.announcementActive !== undefined) setAnnouncementActive(Boolean(settings.announcementActive));
    }
  }, [settings]);

  // ── Health check ────────────────────────────────────────────────────────
  const checkAllResolvers = useCallback(async () => {
    setResolvers((prev) => prev.map((r) => ({ ...r, checking: true })));

    await Promise.allSettled(
      RESOLVER_DEFS.map(async (def) => {
        const { reachable, latencyMs } = await pingResolver(def.id);
        setResolvers((prev) =>
          prev.map((r) =>
            r.id === def.id
              ? {
                  ...r,
                  reachable,
                  latencyMs,
                  lastChecked: new Date().toLocaleTimeString(),
                  checking: false,
                  fallbackTriggers: r.fallbackTriggers + (!reachable ? 1 : 0)
                }
              : r
          )
        );
      })
    );
  }, []);

  // Run health check on mount
  useEffect(() => { checkAllResolvers(); }, [checkAllResolvers]);

  // ── Handlers ────────────────────────────────────────────────────────────
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const updatedPayload: SiteSettings = {
      announcementText: announcementText.trim(),
      announcementActive: Boolean(announcementActive),
      featuredHeroIds: settings?.featuredHeroIds || [11130, 157336, 545611, 693134, 60625],
      maintenanceMode: settings?.maintenanceMode || false
    };

    const updated = await saveSiteSettings(updatedPayload);
    await saveSiteSettingsToFirestore(updated);

    setSaving(false);
    toast.success(
      announcementActive
        ? 'Site banner enabled and updated site-wide! ⚡'
        : 'Site banner disabled site-wide! ⚡'
    );
    if (onUpdateSettings) onUpdateSettings(updated);
    onRefreshSettings();
  };

  const toggleResolverOverride = (id: string) => {
    setDisabledResolvers((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── Render helpers ───────────────────────────────────────────────────────
  const latencyColor = (ms: number | null) => {
    if (ms === null) return 'text-zinc-500';
    if (ms < 300) return 'text-emerald-400';
    if (ms < 800) return 'text-amber-400';
    return 'text-rose-400';
  };

  const reachableCount = resolvers.filter((r) => r.reachable === true).length;
  const unreachableCount = resolvers.filter((r) => r.reachable === false).length;

  return (
    <div className="w-full max-w-[1920px] mx-auto py-8 px-4 sm:px-6 lg:px-10 space-y-8">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="bg-[#0c120e] border border-emerald-500/30 p-6 md:p-8 rounded-3xl flex items-center justify-between shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
            <ShieldAlert className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Stoned.living Admin Dashboard</h1>
            <p className="text-xs text-emerald-400 font-mono mt-0.5">Control Center & System Maintenance</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-mono px-3 py-1 rounded-full font-bold hidden sm:inline-block">
            ADMIN: REEF
          </span>
          {onLogoutAdmin && (
            <button
              onClick={onLogoutAdmin}
              className="flex items-center gap-1.5 bg-rose-950/60 hover:bg-rose-900 border border-rose-500/40 text-rose-300 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400" />
              <span>Exit Admin</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Summary health cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#0e1411] border border-emerald-900/50 p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-zinc-400">TMDb API</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-lg font-black text-emerald-300">Connected — Direct</p>
          <p className="text-[10px] text-zinc-500 mt-0.5 font-mono">api.themoviedb.org</p>
        </div>

        <div className="bg-[#0e1411] border border-emerald-900/50 p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-zinc-400">Resolver Workers Online</span>
            <Server className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-lg font-black text-white">
            <span className="text-emerald-400">{reachableCount}</span>
            <span className="text-zinc-500"> / {resolvers.length}</span>
          </p>
          {unreachableCount > 0 && (
            <p className="text-[10px] text-rose-400 mt-0.5 font-mono">{unreachableCount} unreachable</p>
          )}
        </div>

        <div className="bg-[#0e1411] border border-emerald-900/50 p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-zinc-400">Edge Cache (CF Workers)</span>
            <Database className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-lg font-black text-white">Active — 5 min TTL</p>
          <p className="text-[10px] text-zinc-500 mt-0.5 font-mono">caches.default</p>
        </div>
      </div>

      {/* ── Stream Health Panel ─────────────────────────────────────────── */}
      <div className="bg-[#0e1411] border border-emerald-500/20 p-6 rounded-3xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-emerald-400" /> Stream Resolver Health
          </h2>
          <button
            onClick={checkAllResolvers}
            className="flex items-center gap-1.5 bg-emerald-950 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 font-bold text-xs px-4 py-2 rounded-xl transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
            Re-check All
          </button>
        </div>

        {/* Resolver rows */}
        <div className="space-y-2">
          {resolvers.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-3 bg-[#070b08] border border-emerald-900/40 rounded-xl px-4 py-3"
            >
              {/* Status icon */}
              <div className="shrink-0">
                {r.checking ? (
                  <RefreshCw className="w-4 h-4 text-zinc-400 animate-spin" />
                ) : r.reachable === true ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : r.reachable === false ? (
                  <WifiOff className="w-4 h-4 text-rose-400" />
                ) : (
                  <Wifi className="w-4 h-4 text-zinc-600" />
                )}
              </div>

              {/* Label */}
              <span className="text-sm font-bold text-white w-24 shrink-0">{r.label}</span>

              {/* Latency */}
              <span className={`text-xs font-mono w-16 shrink-0 ${latencyColor(r.latencyMs)}`}>
                {r.checking ? '…' : r.latencyMs !== null ? `${r.latencyMs}ms` : '—'}
              </span>

              {/* Fallback triggers */}
              <span className="text-[11px] text-zinc-500 flex items-center gap-1 w-32 shrink-0">
                <AlertTriangle className="w-3 h-3" />
                {r.fallbackTriggers} fallback{r.fallbackTriggers !== 1 ? 's' : ''}
              </span>

              {/* Last checked */}
              <span className="text-[10px] text-zinc-600 flex items-center gap-1 flex-1 min-w-0 truncate">
                <Clock className="w-3 h-3 shrink-0" />
                {r.lastChecked ?? 'Not checked'}
              </span>

              {/* Status badge */}
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                r.reachable === true
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                  : r.reachable === false
                    ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                    : 'bg-zinc-800 text-zinc-500 border-zinc-700'
              }`}>
                {r.checking ? 'CHECKING' : r.reachable === true ? 'ONLINE' : r.reachable === false ? 'OFFLINE' : 'UNKNOWN'}
              </span>
            </div>
          ))}
        </div>

        {/* ── Manual override drawer ────────────────────────────────────── */}
        <div className="border-t border-emerald-900/40 pt-3">
          <button
            onClick={() => setOverrideOpen(!overrideOpen)}
            className="flex items-center gap-2 text-xs font-bold text-zinc-400 hover:text-emerald-300 transition cursor-pointer"
          >
            {overrideOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            Manual Resolver Overrides
          </button>

          {overrideOpen && (
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
              {resolvers.map((r) => {
                const disabled = disabledResolvers.has(r.id);
                return (
                  <button
                    key={r.id}
                    onClick={() => toggleResolverOverride(r.id)}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-bold transition cursor-pointer ${
                      disabled
                        ? 'bg-rose-950/30 border-rose-500/30 text-rose-400'
                        : 'bg-emerald-950/30 border-emerald-500/30 text-emerald-400'
                    }`}
                  >
                    <span>{r.label}</span>
                    {disabled ? (
                      <ToggleLeft className="w-5 h-5 text-rose-400" />
                    ) : (
                      <ToggleRight className="w-5 h-5 text-emerald-400" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Announcement Manager ────────────────────────────────────────── */}
      <div className="bg-[#0e1411] border border-emerald-500/20 p-6 rounded-3xl space-y-4">
        <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
          <Flame className="w-5 h-5 text-emerald-400" /> Site Banner Announcement
        </h2>

        <form onSubmit={handleSaveSettings} className="space-y-4">
          <div
            onClick={() => setAnnouncementActive(!announcementActive)}
            className="flex items-center justify-between bg-[#070b08] p-4 rounded-2xl border border-emerald-900/50 hover:border-emerald-500/50 transition cursor-pointer group"
          >
            <div>
              <span className="text-xs font-extrabold text-white block">Enable Top Announcement Banner</span>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Toggle the top ticker banner site-wide for all users
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border transition ${
                announcementActive
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-zinc-800 text-zinc-500 border-zinc-700'
              }`}>
                {announcementActive ? 'ACTIVE' : 'DISABLED'}
              </span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setAnnouncementActive(!announcementActive); }}
                className="text-emerald-400 focus:outline-none cursor-pointer"
              >
                {announcementActive
                  ? <ToggleRight className="w-9 h-9 text-emerald-400" />
                  : <ToggleLeft className="w-9 h-9 text-zinc-600" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-400">Announcement Banner Text:</label>
            <input
              type="text"
              value={announcementText}
              onChange={(e) => setAnnouncementText(e.target.value)}
              placeholder="Enter announcement text to broadcast..."
              className="w-full bg-[#070b08] border border-emerald-500/30 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-emerald-400"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 text-black font-extrabold text-xs px-6 py-3 rounded-xl shadow-lg transition cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>{saving ? 'Saving…' : 'Save Banner Announcement'}</span>
          </button>
        </form>
      </div>

    </div>
  );
};
