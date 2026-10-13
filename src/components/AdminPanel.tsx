import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Activity,
  Database,
  Check,
  Flame,
  ToggleLeft,
  ToggleRight,
  LogOut,
} from 'lucide-react';
import { SiteSettings } from '../types';
import { saveSiteSettings } from '../services/api';
import { saveSiteSettingsToFirestore } from '../services/firebase';
import { toast } from 'sonner';

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

  // Sync settings prop → local state
  useEffect(() => {
    if (settings) {
      if (settings.announcementText !== undefined) setAnnouncementText(settings.announcementText);
      if (settings.announcementActive !== undefined) setAnnouncementActive(Boolean(settings.announcementActive));
    }
  }, [settings]);

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

      {/* ── Summary cards ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <span className="text-xs font-semibold text-zinc-400">Firebase / Firestore</span>
            <Database className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-lg font-black text-white">Connected — Direct</p>
          <p className="text-[10px] text-zinc-500 mt-0.5 font-mono">gen-lang-client-0508880222</p>
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
