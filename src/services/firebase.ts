import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  signOut, 
  onAuthStateChanged,
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
import { DEFAULT_USER, saveUserProfile, sanitizeWatchlist } from './storage';

// Prefer VITE_ environment variables (Cloudflare Pages).
// Fall back to the bundled JSON config for local dev without a .env file.
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            || firebaseConfigJson.apiKey,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN        || firebaseConfigJson.authDomain,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         || firebaseConfigJson.projectId,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     || firebaseConfigJson.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigJson.messagingSenderId,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID             || firebaseConfigJson.appId
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
 * Save user profile to Firestore database
 */
export async function saveProfileToFirestore(userProfile: UserProfile): Promise<void> {
  if (!auth.currentUser) return;
  const path = `users/${auth.currentUser.uid}`;
  try {
    const userRef = doc(db, 'users', auth.currentUser.uid);
    await setDoc(userRef, {
      userId: auth.currentUser.uid,
      username: userProfile.username,
      email: userProfile.email,
      avatar: userProfile.avatar,
      watchlist: sanitizeWatchlist(userProfile.watchlist || []),
      stashDetails: userProfile.stashDetails || {},
      watchHistory: userProfile.watchHistory || [],
      settings: userProfile.settings || DEFAULT_USER.settings,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
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
          const updatedProfile: UserProfile = {
            id: firebaseUser.uid,
            username: data.username || firebaseUser.displayName || 'VIP Member',
            email: data.email || firebaseUser.email || '',
            avatar: data.avatar || firebaseUser.photoURL || DEFAULT_USER.avatar,
            role: 'vip',
            favorites: [],
            watchlist: sanitizeWatchlist(data.watchlist || []),
            stashDetails: data.stashDetails || {},
            ratings: data.ratings || {},
            watchHistory: data.watchHistory || [],
            customLists: data.customLists || [],
            settings: {
              ...DEFAULT_USER.settings,
              ...(data.settings || {})
            }
          };
          saveUserProfile(updatedProfile);
          onUpdate(updatedProfile);
        } else {
          // First time user profile creation in Firestore
          const newProfile: UserProfile = {
            id: firebaseUser.uid,
            username: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'VIP Member',
            email: firebaseUser.email || 'user@stoned.living',
            avatar: firebaseUser.photoURL || DEFAULT_USER.avatar,
            role: 'vip',
            favorites: [],
            watchlist: [],
            stashDetails: {},
            ratings: {},
            watchHistory: [],
            customLists: [],
            settings: DEFAULT_USER.settings
          };
          
          saveProfileToFirestore(newProfile);
          saveUserProfile(newProfile);
          onUpdate(newProfile);
        }
      } catch (e) {
        console.error('Error parsing user profile snapshot:', e);
      }
    },
    error: (error) => {
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
