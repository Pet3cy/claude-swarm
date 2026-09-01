import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);

export const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/tasks'
];

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));

// In-memory access token cache
let cachedAccessToken: string | null = null;
let isSigningIn = false;
let isDemoSession = false;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn && !isDemoSession) {
        // User logged in via Firebase session, but needs interactive sign-in popup to acquire Workspace OAuth token
        if (onAuthFailure) onAuthFailure();
      }
    } else if (!isDemoSession) {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to obtain Google Workspace access token from sign-in');
    }
    cachedAccessToken = credential.accessToken;
    isDemoSession = false;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    const errorCode = error?.code || '';
    const errorMessage = error?.message || '';

    // Handle standard popup closure without crashing
    if (errorCode === 'auth/popup-closed-by-user' || errorCode === 'auth/cancelled-popup-request') {
      return null;
    }

    // Handle network / iframe sandbox restriction
    if (errorCode === 'auth/network-request-failed' || errorMessage.includes('network-request-failed')) {
      const helpfulError = new Error(
        'Authentication popup was blocked or unable to connect due to iframe security policies. You can enable Sandbox Demo Mode or check your browser cookie settings.'
      );
      (helpfulError as any).code = 'auth/network-request-failed';
      throw helpfulError;
    }

    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Fallback mode when browser preview / iframe environment blocks popup auth network calls
 */
export const enableDemoWorkspaceSession = (): { user: any; accessToken: string } => {
  isDemoSession = true;
  cachedAccessToken = 'obessu_demo_workspace_token_' + Date.now();
  const mockUser: any = {
    uid: 'obessu-demo-user',
    displayName: 'OBESSU Demo User',
    email: 'demo@obessu.local',
    photoURL: null,
  };
  return { user: mockUser, accessToken: cachedAccessToken };
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

export const logout = async () => {
  try {
    if (!isDemoSession) {
      await auth.signOut();
    }
  } catch (e) {
    // Ignore signout error if session was local
  }
  isDemoSession = false;
  cachedAccessToken = null;
};
