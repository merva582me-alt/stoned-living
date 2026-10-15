# Settings Cloud Sync, Language Expansion & Appearance Streamlining

Overhaul the application settings experience to support a full global language suite, enforce seamless real-time cloud synchronization for authenticated users, prompt guests to sign in before accessing settings, and streamline the interface by completely removing the Appearance section.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following product decisions were confirmed during the planning phase:
> - **Languages**: Support standard global languages: English, Spanish (Español), French (Français), German (Deutsch), Japanese (日本語), Italian (Italiano), and Portuguese (Português).
> - **Guest Access & Routing**: When a logged-out user clicks Settings (from the sidebar, bottom dock, or direct navigation), the Auth Modal is displayed with a contextual prompt. Upon successful sign-in, the user is navigated directly to the Settings page.
> - **Sync Resolution**: When a user logs in, their saved cloud settings from Firestore are loaded and applied immediately.
> - **Appearance Cleanup**: The Appearance section, Theme toggle, and Accent Color picker are completely removed from the Settings UI.

---

## 1. Overview & Core Concept

- **What It Does**: Upgrades user settings with a comprehensive language picker (site and subtitle preferences), automatically persists and synchronizes preferences across devices using Firestore for authenticated accounts, protects the settings view with a sign-in gate for guests, and cleans up the UI by removing unused theme/accent color selectors.
- **Target Audience**: Global streaming viewers who want their viewing preferences (playback speed, default volume, autoplay, subtitle language, audio preferences) saved and synchronized across all their devices.
- **Key Value**: Guarantees zero setting loss across devices, improves accessibility for international users, and reduces visual clutter.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Guest Settings Click**:
   - Guest clicks "Settings" in the left dock or mobile bottom nav.
   - The Auth Modal opens immediately with a clear prompt: *"Please sign in or create an account to access and sync your Settings"*.
   - If the user logs in or creates an account, the modal closes and the user is immediately taken to the Settings view.
2. **Language Selection**:
   - User clicks the Language or Subtitle Language selector in Settings.
   - An intuitive, accessible popup menu opens displaying the 7 supported languages with their native endonyms (*English, Español, Français, Deutsch, 日本語, Italiano, Português*).
   - Selecting a language updates the preference with checkmark indicator and instant visual feedback.
3. **Cloud Synchronization**:
   - Any toggle or preference changed by an authenticated user updates local state and immediately syncs to Firestore (`users/{userId}.settings`).
   - On a new device or subsequent login, the user's saved preferences are fetched in real-time and applied instantly.
4. **Cleaned Settings Layout**:
   - The Settings view contains only purposeful, working sections: **General** (Site Language), **Playback** (Autoplay, Next Episode, Default Volume), **Subtitles** (Default Language, Auto Subtitles), and **Data** (Clear Watch History).
   - No dead appearance controls or placeholder theme switches.

### Visual Identity & Theme
- **Color Discipline**: Deep Obsidian canvas (`#050806`), structural dark emerald surfaces (`#0c1410`), hairline borders (`border-emerald-500/15`), high-contrast white typography (`#FFFFFF`) with muted secondary zinc (`#A1A1AA`).
- **Typography**: Crisp display headers with clean micro-copy; tabular numbers for volume percentages (`100%`, `80%`, `50%`).
- **Anti-Slop Restraint**: Clean button selectors without candy badges; responsive toggle switches with smooth spring transitions.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Full Language Dropdown / Modal vs. Cyclic Toggle**
  - *Chosen Approach*: Replace the previous two-state cyclic button (`English <-> Spanish`) with an accessible selection menu presenting all 7 languages.
  - *Why*: Cyclic buttons become unmanageable with more than 2 options; a structured menu allows immediate direct selection.
- **Decision 2: Cloud-First Sync on Login**
  - *Chosen Approach*: Load cloud Firestore settings upon login, overriding local defaults.
  - *Why*: Ensures consistent multi-device state and preserves user preferences across sessions.
- **Decision 3: Settings Gate Routing**
  - *Chosen Approach*: Intercept navigation to Settings when `isLoggedIn === false`, save destination context in `authModalReason`, and redirect to `settings` on `handleAuthSuccess`.
  - *Why*: Matches the existing UX pattern used for "My Library", keeping the navigation model cohesive and predictable.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────┐
│                   App Navigation                       │
│  (Sidebar Dock / Mobile Nav / URL Query Parameter)     │
└──────────────────────────┬─────────────────────────────┘
                           │
                 isLoggedIn === true?
                /                    \
              YES                     NO
              /                        \
    ┌────────────────────┐    ┌──────────────────────────────────┐
    │  SettingsView.tsx  │    │         AuthModal.tsx            │
    │  - General         │    │  - Prompt to sign in for sync    │
    │  - Playback        │    │  - On success -> SettingsView    │
    │  - Subtitles       │    └──────────────────────────────────┘
    │  - Data Reset      │
    └─────────┬──────────┘
              │ onChange(key, value)
              ▼
    ┌────────────────────────────────────────────────────────┐
    │           Dual-Layer Persistence & Sync                │
    │  1. localStorage ('blunt_pics_user_profile_v2')        │
    │  2. Firestore ('users/{userId}.settings')              │
    └────────────────────────────────────────────────────────┘
```

### Supported Languages Definition
```typescript
export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'es', name: 'Spanish', native: 'Español' },
  { code: 'fr', name: 'French', native: 'Français' },
  { code: 'de', name: 'German', native: 'Deutsch' },
  { code: 'ja', name: 'Japanese', native: '日本語' },
  { code: 'it', name: 'Italian', native: 'Italiano' },
  { code: 'pt', name: 'Portuguese', native: 'Português' },
] as const;
```

### Component & File Strategy
- **`src/types.ts`**: Update `UserSettings` to support the expanded language options; clean up legacy appearance types if necessary while maintaining backward compatibility.
- **`src/components/SettingsView.tsx`**:
  - Remove Appearance section entirely (Theme and Accent Color).
  - Implement language selection dropdown / popover for both Site Language and Subtitle Language.
  - Retain General, Playback, Subtitles, and Data sections.
- **`src/App.tsx`**:
  - Gate `handleNavigateTab('settings')` when `!isLoggedIn` and set `authModalReason`.
  - Update `handleAuthSuccess` to route to `settings` when logging in from the Settings prompt.
  - Ensure unauthenticated direct URL loads (`?tab=settings`) gracefully trigger the prompt.
- **`src/services/firebase.ts` & `src/services/storage.ts`**:
  - Verify Firestore `users/{userId}` rules and ensure `settings` payload is saved and restored reliably without missing fields.
