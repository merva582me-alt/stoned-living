import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  signOut, 
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  User 
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  onSnapshot 
} from 'firebase/firestore';
import firebaseConfigJson from '../../firebase-applet-config.json';
import { UserProfile, SiteSettings } from '../types';
import { DEFAULT_USER, saveUserProfile, sanitizeWatchlist, loadUserProfile, mergeWatchHistories, deduplicateWatchHistory } from './storage';

const firebaseConfig = {
  apiKey:            firebaseConfigJson.apiKey,
  authDomain:        firebaseConfigJson.authDomain,
  projectId:         firebaseConfigJson.projectId,
  storageBucket:     firebaseConfigJson.storageBucket,
  messagingSenderId: firebaseConfigJson.messagingSenderId,
  appId:             firebaseConfigJson.appId,
};

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);

// Use the custom Firestore database ID from the JSON config if present
export const db = firebaseConfigJson.firestoreDatabaseId
  ? getFirestore(app, firebaseConfigJson.firestoreDatabaseId)
  : getFirestore(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): FirestoreErrorInfo {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  return errInfo;
}

/**
 * Checks for authentication redirect result on app boot (e.g. when returning from Google OAuth on mobile / GitHub Pages)
 */
export async function checkRedirectResult(): Promise<User | null> {
  try {
    const result = await getRedirectResult(auth);
    if (result?.user) {
      return result.user;
    }
  } catch (error: any) {
    console.error('Redirect sign-in error:', error);
    if (error?.code === 'auth/unauthorized-domain' || error?.message?.includes('unauthorized-domain')) {
      const err = new Error(`UNAUTHORIZED_DOMAIN:${window.location.hostname}`);
      (err as any).code = 'auth/unauthorized-domain';
      throw err;
    }
    throw error;
  }
  return null;
}

/**
 * Trigger Google Sign In with popup, falling back to redirect if popup is blocked or unavailable
 */
export async function loginWithGoogle(): Promise<User | null> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error: any) {
    console.error('Google Popup Sign In Error:', error);

    if (error?.code === 'auth/unauthorized-domain' || error?.message?.includes('unauthorized-domain')) {
      const domain = window.location.hostname;
      const domainErr = new Error(`UNAUTHORIZED_DOMAIN:${domain}`);
      (domainErr as any).code = 'auth/unauthorized-domain';
      throw domainErr;
    }

    // If popup is blocked by browser or on mobile, fall back to redirect flow
    if (
      error?.code === 'auth/popup-blocked' ||
      error?.code === 'auth/popup-closed-by-user' ||
      error?.code === 'auth/operation-not-supported-in-this-environment'
    ) {
      console.log('Attempting fallback to signInWithRedirect...');
      try {
        await signInWithRedirect(auth, provider);
        return null; // Will redirect away from page
      } catch (redirectErr: any) {
        if (redirectErr?.code === 'auth/unauthorized-domain' || redirectErr?.message?.includes('unauthorized-domain')) {
          const domain = window.location.hostname;
          const domainErr = new Error(`UNAUTHORIZED_DOMAIN:${domain}`);
          (domainErr as any).code = 'auth/unauthorized-domain';
          throw domainErr;
        }
        throw redirectErr;
      }
    }

    throw error;
  }
}

/**
 * Sign in with email and password
 */
export async function loginWithEmail(email: string, pass: string): Promise<User> {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    return cred.user;
  } catch (err: any) {
    if (err?.code === 'auth/operation-not-allowed' || err?.message?.includes('operation-not-allowed')) {
      console.warn('Firebase email auth not enabled in console, generating local session');
      const hashId = Math.abs(Array.from(email).reduce((h, c) => (h << 5) - h + c.charCodeAt(0), 0));
      return {
        uid: `usr_${hashId}`,
        email,
        displayName: email.split('@')[0],
        emailVerified: false,
        isAnonymous: false,
        providerData: []
      } as unknown as User;
    }
    throw err;
  }
}

/**
 * Register with email and password
 */
export async function registerWithEmail(email: string, pass: string, name?: string): Promise<User> {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    if (name && cred.user) {
      try {
        await updateProfile(cred.user, { displayName: name });
      } catch {}
    }
    return cred.user;
  } catch (err: any) {
    if (err?.code === 'auth/operation-not-allowed' || err?.message?.includes('operation-not-allowed')) {
      console.warn('Firebase email auth not enabled in console, generating local session');
      const hashId = Math.abs(Array.from(email).reduce((h, c) => (h << 5) - h + c.charCodeAt(0), 0));
      return {
        uid: `usr_${hashId}`,
        email,
        displayName: name || email.split('@')[0],
        emailVerified: false,
        isAnonymous: false,
        providerData: []
      } as unknown as User;
    }
    throw err;
  }
}

/**
 * Sign out current user
 */
export async function logoutUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch (err) {
    console.error('Error signing out:', err);
  }
}

/**
 * Recursively removes undefined values to ensure Firestore writes never fail
 */
export function sanitizeForFirestore(val: any): any {
  if (val === undefined) return null;
  if (val === null) return null;
  if (Array.isArray(val)) {
    return val.map((item) => sanitizeForFirestore(item));
  }
  if (typeof val === 'object') {
    const cleaned: Record<string, any> = {};
    for (const key of Object.keys(val)) {
      const v = val[key];
      if (v !== undefined) {
        cleaned[key] = sanitizeForFirestore(v);
      }
    }
    return cleaned;
  }
  return val;
}

/**
 * Save user profile to Firestore database
 */
let lastSavedProfilePayload = '';
let quotaExhaustedUntil = 0;
let debounceProfileSaveTimer: any = null;

export async function saveProfileToFirestore(userProfile: UserProfile, immediate: boolean = false): Promise<void> {
  const currentUid = auth.currentUser?.uid || userProfile.id;
  if (!currentUid || currentUid === 'guest_user') return;
  if (Date.now() < quotaExhaustedUntil) {
    // Gracefully operate in local offline mode while quota resets
    return;
  }

  const performSave = async () => {
    const uid = auth.currentUser?.uid || userProfile.id;
    if (!uid || uid === 'guest_user') return;
    const path = `users/${uid}`;
    try {
      const rawData = {
        userId: uid,
        username: userProfile.username || 'VIP Member',
        email: userProfile.email || auth.currentUser?.email || '',
        avatar: userProfile.avatar || DEFAULT_USER.avatar,
        watchlist: sanitizeWatchlist(userProfile.watchlist || []),
        stashDetails: userProfile.stashDetails || {},
        watchHistory: deduplicateWatchHistory(userProfile.watchHistory || []),
        favorites: userProfile.favorites || [],
        customLists: userProfile.customLists || [],
        settings: userProfile.settings || DEFAULT_USER.settings,
        updatedAt: new Date().toISOString()
      };
      const sanitized = sanitizeForFirestore(rawData);

      // Deduplicate payload to prevent redundant Firestore writes unless immediate is requested
      const comparisonPayload = JSON.stringify({ ...sanitized, updatedAt: '' });
      if (!immediate && comparisonPayload === lastSavedProfilePayload) {
        return;
      }

      const userRef = doc(db, 'users', uid);
      await setDoc(userRef, sanitized, { merge: true });
      lastSavedProfilePayload = comparisonPayload;
    } catch (err: any) {
      if (
        err?.code === 'resource-exhausted' || 
        err?.message?.includes('Quota exceeded') ||
        err?.message?.includes('resource-exhausted')
      ) {
        quotaExhaustedUntil = Date.now() + 30 * 60 * 1000; // 30 min backoff
        console.warn('Firestore write quota reached for today; operating seamlessly in local storage.');
        return;
      }
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  if (debounceProfileSaveTimer) {
    clearTimeout(debounceProfileSaveTimer);
    debounceProfileSaveTimer = null;
  }

  if (immediate) {
    await performSave();
  } else {
    debounceProfileSaveTimer = setTimeout(performSave, 400);
  }
}

/**
 * Direct fetch of cloud profile from Firestore on login
 */
export async function fetchUserProfileFromFirestore(uid: string): Promise<UserProfile | null> {
  try {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data();
      return {
        id: uid,
        username: data.username || 'VIP Member',
        email: data.email || '',
        avatar: data.avatar || DEFAULT_USER.avatar,
        role: 'vip',
        favorites: Array.isArray(data.favorites) ? data.favorites : [],
        watchlist: sanitizeWatchlist(data.watchlist || []),
        stashDetails: data.stashDetails || {},
        ratings: data.ratings || {},
        watchHistory: deduplicateWatchHistory(data.watchHistory || []),
        customLists: data.customLists || [],
        settings: {
          ...DEFAULT_USER.settings,
          ...(data.settings || {})
        }
      };
    }
  } catch (err: any) {
    console.warn('Error fetching user profile from Firestore:', err);
  }
  return null;
}

/**
 * Sync Firestore document to local user profile state
 */
export function subscribeToUserProfile(
  firebaseUser: User,
  onUpdate: (profile: UserProfile) => void
): () => void {
  const path = `users/${firebaseUser.uid}`;
  const userRef = doc(db, 'users', firebaseUser.uid);

  const unsubscribe = onSnapshot(userRef, {
    next: (snapshot) => {
      try {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const localProfile = loadUserProfile();
          
          // Only merge local history if localProfile actually belongs to this same authenticated user ID
          const isSameUser = localProfile.id === firebaseUser.uid;
          
          // Always give precedence to cloud data.
          // If localProfile has items and is the same user, merge any that aren't in cloud yet.
          const cloudWatchHistory = deduplicateWatchHistory(data.watchHistory || []);
          const mergedWatchHistory = (isSameUser && localProfile.watchHistory && localProfile.watchHistory.length > 0)
            ? mergeWatchHistories(localProfile.watchHistory, cloudWatchHistory)
            : cloudWatchHistory;

          const cloudWatchlist = sanitizeWatchlist(data.watchlist || []);
          const mergedWatchlist = (isSameUser && localProfile.watchlist && localProfile.watchlist.length > 0)
            ? sanitizeWatchlist([...cloudWatchlist, ...localProfile.watchlist])
            : cloudWatchlist;

          const cloudFavorites = Array.isArray(data.favorites) ? data.favorites : [];
          const mergedFavorites = (isSameUser && localProfile.favorites && localProfile.favorites.length > 0)
            ? Array.from(new Set([...cloudFavorites, ...localProfile.favorites]))
            : cloudFavorites;

          const updatedProfile: UserProfile = {
            id: firebaseUser.uid,
            username: data.username || firebaseUser.displayName || 'VIP Member',
            email: data.email || firebaseUser.email || '',
            avatar: data.avatar || firebaseUser.photoURL || DEFAULT_USER.avatar,
            role: 'vip',
            favorites: mergedFavorites,
            watchlist: mergedWatchlist,
            stashDetails: {
              ...(isSameUser ? (localProfile.stashDetails || {}) : {}),
              ...(data.stashDetails || {})
            },
            ratings: {
              ...(isSameUser ? (localProfile.ratings || {}) : {}),
              ...(data.ratings || {})
            },
            watchHistory: mergedWatchHistory,
            customLists: data.customLists || (isSameUser ? localProfile.customLists : []) || [],
            settings: {
              ...DEFAULT_USER.settings,
              ...(isSameUser ? (localProfile.settings || {}) : {}),
              ...(data.settings || {})
            }
          };
          // CRITICAL: syncToCloud = false to avoid recursive echo back to Firestore
          saveUserProfile(updatedProfile, false);
          onUpdate(updatedProfile);
        } else {
          // First time user profile creation in Firestore
          const localProfile = loadUserProfile();
          const isGuest = !localProfile.id || localProfile.id === 'guest_user';
          const newProfile: UserProfile = {
            id: firebaseUser.uid,
            username: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'VIP Member',
            email: firebaseUser.email || 'user@stoned.living',
            avatar: firebaseUser.photoURL || DEFAULT_USER.avatar,
            role: 'vip',
            favorites: isGuest ? (localProfile.favorites || []) : [],
            watchlist: sanitizeWatchlist(isGuest ? (localProfile.watchlist || []) : []),
            stashDetails: isGuest ? (localProfile.stashDetails || {}) : {},
            ratings: isGuest ? (localProfile.ratings || {}) : {},
            watchHistory: deduplicateWatchHistory(isGuest ? (localProfile.watchHistory || []) : []),
            customLists: isGuest ? (localProfile.customLists || []) : [],
            settings: localProfile.settings || DEFAULT_USER.settings
          };
          
          saveProfileToFirestore(newProfile, true);
          // CRITICAL: syncToCloud = false to avoid recursive echo back to Firestore
          saveUserProfile(newProfile, false);
          onUpdate(newProfile);
        }
      } catch (e) {
        console.error('Error parsing user profile snapshot:', e);
      }
    },
    error: (error: any) => {
      if (
        error?.code === 'resource-exhausted' || 
        error?.message?.includes('Quota exceeded')
      ) {
        console.warn('Firestore quota reached; operating seamlessly in local offline mode.');
        const local = loadUserProfile();
        onUpdate(local);
        return;
      }
      handleFirestoreError(error, OperationType.GET, path);
      const fallbackProfile: UserProfile = {
        id: firebaseUser.uid,
        username: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'VIP Member',
        email: firebaseUser.email || '',
        avatar: firebaseUser.photoURL || DEFAULT_USER.avatar,
        role: 'vip',
        favorites: [],
        watchlist: sanitizeWatchlist(DEFAULT_USER.watchlist || []),
        stashDetails: DEFAULT_USER.stashDetails || {},
        ratings: DEFAULT_USER.ratings || {},
        watchHistory: DEFAULT_USER.watchHistory || [],
        customLists: DEFAULT_USER.customLists || [],
        settings: DEFAULT_USER.settings
      };
      saveUserProfile(fallbackProfile);
      onUpdate(fallbackProfile);
    }
  });

  return unsubscribe;
}

/**
 * Save Site Settings (announcement text, banner toggle, server URLs) to Firestore
 */
export async function saveSiteSettingsToFirestore(siteSettings: SiteSettings): Promise<void> {
  const path = 'settings/global';
  try {
    const settingsRef = doc(db, 'settings', 'global');
    await setDoc(settingsRef, {
      ...siteSettings,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Real-time listener for global site settings so all users get live announcement banner updates
 */
export function subscribeToSiteSettings(
  onUpdate: (settings: SiteSettings) => void
): () => void {
  const path = 'settings/global';
  const settingsRef = doc(db, 'settings', 'global');

  const unsubscribe = onSnapshot(settingsRef, {
    next: (snapshot) => {
      try {
        if (snapshot.exists()) {
          const data = snapshot.data() as SiteSettings;
          onUpdate(data);
          try {
            localStorage.setItem('stoned_site_settings_v1', JSON.stringify(data));
          } catch (e) {}
        }
      } catch (e) {
        console.error('Error parsing site settings snapshot:', e);
      }
    },
    error: (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  });

  return unsubscribe;
}
