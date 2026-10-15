# Vidstuck Ad-Blocking Sandbox & GitHub Repository Sync Plan

Implement browser-enforced popup and redirect suppression on the Vidstuck iframe player, and provide step-by-step local Git terminal workflows to sync and overwrite a remote GitHub repository.

### User Review & Critical Decisions

> [!IMPORTANT]
> - **Ad Suppression Choice**: Confirmed by user — apply a strict HTML5 `sandbox` on the Vidstuck player iframe (`allow-scripts allow-same-origin allow-forms`) while intentionally omitting `allow-popups`, `allow-popups-to-escape-sandbox`, and `allow-top-navigation`. This completely prevents popup windows, background tab spawns, and parent frame hijack redirects without breaking video streaming playback.
> - **GitHub Push Workflow**: Confirmed by user — provide clear, production-tested local Git terminal commands to initialize, add remote, and force-push the current state to overwrite all existing files in the remote GitHub repository.

---

## 1. Overview & Core Concept

- **What It Does**:
  1. Hardens the Vidstuck cinema embed player with HTML5 iframe sandbox attributes that neuter ad-network popup triggers, tab-under spam, and redirect hijacks while maintaining fluid video stream playback, fullscreen, and audio playback.
  2. Outlines the exact sequence of Git commands needed to push the complete codebase to GitHub and overwrite existing remote files.
- **Target Audience**: Users streaming movies, TV shows, and anime on Stoned.living who want an uninterrupted, clean cinema experience free of intrusive popups and unexpected browser tabs.

---

## 2. User Experience & Visual Design

- **Player Experience**:
  - The cinema player remains responsive in full 16:9 aspect ratio with glowing emerald accents and cannabis pairing sommelier metadata.
  - Clicking play, seek bar, audio, or subtitle options within the player will not trigger rogue popup windows or redirect the viewer off-site.
  - Fullscreen, picture-in-picture, and native Vidstuck episode navigation remain fully operational.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: HTML5 Sandbox Policy Selection**:
  - *Chosen Approach*: `sandbox="allow-scripts allow-same-origin allow-forms"` combined with `allow="autoplay; encrypted-media; picture-in-picture; fullscreen; web-share"`.
  - *Why*: Free video hosting embeds rely on `window.open` or synthesized anchor clicks with `target="_blank"` to spawn ad tabs. By omitting `allow-popups` and `allow-popups-to-escape-sandbox`, the browser's sandbox engine suppresses these calls at the browser level.
  - *Trade-off*: Certain third-party ad scripts may log harmless console warnings when denied permission to open windows; video stream playback remains unaffected.

- **Decision 2: Safe Git Overwrite Instructions**:
  - *Chosen Approach*: Standard `git init`, clean staging, and `git push --force -u origin main` instructions with token/SSH authentication guidance.
  - *Why*: Gives the user direct local control to overwrite their GitHub repository without risk of cloud credential leakage.

---

## 4. Technical Architecture & Component Flow

```
┌────────────────────────────────────────────────────────┐
│                   Stoned.living UI                     │
│  ┌──────────────────────────────────────────────────┐  │
│  │ WatchPlayer Component                            │  │
│  │  ┌────────────────────────────────────────────┐  │  │
│  │  │ <iframe src="https://vidstuck.xyz/embed/.. │  │  │
│  │  │   sandbox="allow-scripts allow-same-origin"│  │  │
│  │  │   allow="fullscreen; autoplay; ..."        │  │  │
│  │  └──────────────────┬─────────────────────────┘  │  │
│  │                     │                            │  │
│  │                     ▼                            │  │
│  │       [Browser Security Boundary]                │  │
│  │       - window.open() ──> BLOCKED                │  │
│  │       - target="_blank" ─> BLOCKED               │  │
│  │       - top redirect ───> BLOCKED                │  │
│  │       - video / HLS / audio ──> ALLOWED          │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

### Git Overwrite Sequence (Reference)
```bash
git init
git branch -M main
git add .
git commit -m "feat: complete Stoned.living streaming platform with Vidstuck cinema embed"
git remote add origin https://github.com/<USERNAME>/<REPO_NAME>.git
git push -u origin main --force
```

---

## 5. Verification Plan

- Verify `WatchPlayer.tsx` sandbox configuration compiles cleanly with TypeScript.
- Verify dev server build completes without runtime errors.
- Test that iframe renders correctly and player controls remain accessible.
