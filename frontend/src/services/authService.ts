import { API_BASE } from '../utils/constants';

const TOKEN_KEY = 'musicbox.token';

export const AUTH_EXPIRED_EVENT = 'musicbox:auth-expired';

export interface AuthUser {
  userId: string;
  username: string;
}

export interface AuthResult {
  success: boolean;
  error?: string;
  user?: AuthUser;
}

const readToken = (): string | null => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

const writeToken = (token: string | null) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage can be unavailable (private mode); the session then lasts until reload.
  }
};

let memoryToken: string | null = readToken();

const errorMessage = async (res: Response, fallback: string): Promise<string> => {
  try {
    const data = await res.json();
    return data.error || fallback;
  } catch {
    return fallback;
  }
};

const credentialsRequest = async (path: string, username: string, password: string): Promise<AuthResult> => {
  try {
    const res = await fetch(`${API_BASE}/api/auth/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      return { success: false, error: await errorMessage(res, 'Request failed') };
    }
    const data = await res.json();
    memoryToken = data.token;
    writeToken(data.token);
    return { success: true, user: { userId: data.userId, username: data.username } };
  } catch {
    return { success: false, error: 'Cannot reach the server' };
  }
};

export const authService = {
  signUp(username: string, password: string): Promise<AuthResult> {
    return credentialsRequest('register', username, password);
  },

  signIn(username: string, password: string): Promise<AuthResult> {
    return credentialsRequest('login', username, password);
  },

  signOut() {
    memoryToken = null;
    writeToken(null);
  },

  getAccessToken(): string | null {
    return memoryToken;
  },

  /** Returns the signed-in user, or null when there is no valid token. */
  async getCurrentUser(): Promise<AuthUser | null> {
    if (!memoryToken) return null;
    try {
      const res = await authFetch(`${API_BASE}/api/auth/me`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },
};

/**
 * fetch with the bearer token attached. A 401 means the token expired or the
 * backend restarted with a new key, so the session is dropped.
 */
export const authFetch = async (input: string, init: RequestInit = {}): Promise<Response> => {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (memoryToken) headers.set('Authorization', `Bearer ${memoryToken}`);

  const res = await fetch(input, { ...init, headers });
  if (res.status === 401 && memoryToken) {
    authService.signOut();
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
  }
  return res;
};
