import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import { authService, AuthResult } from '../services/authService';
import { GUEST_SIGN_IN_ENABLED, clearGuest, isGuestUsername } from '../utils/guest';

interface User {
  username: string;
  userId: string;
  /** A throwaway guest session, started automatically for visitors without an account */
  isGuest: boolean;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  isLoading: boolean;
  signIn: (username: string, password: string) => Promise<AuthResult & { needsConfirmation?: boolean; movedGuestData?: boolean }>;
  signInAsGuest: () => Promise<AuthResult>;
  signUp: (username: string, password: string, email: string) => Promise<AuthResult & { requiresConfirmation?: boolean }>;
  signOut: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Who is signed in. Like Spotify or Apple Music, an account is optional: a visitor without one gets
 * their own guest session automatically, with their own player, playlists and favourites. Signing in
 * or creating an account later moves what they did as a guest to that account.
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const userRef = useRef<User | null>(null);
  userRef.current = user;

  /** Reads the current session; returns whether someone is signed in */
  const loadUser = async (): Promise<User | null> => {
    const result = await authService.getCurrentUser().catch(() => ({ success: false as const, user: undefined }));
    const next = result.success && result.user
      ? { username: result.user.username, userId: result.user.userId, isGuest: isGuestUsername(result.user.username) }
      : null;
    setUser(next);
    return next;
  };

  const refreshAuth = async () => {
    try {
      await loadUser();
    } finally {
      setIsLoading(false);
    }
  };

  /** A guest session for a visitor without one (reuses this browser's guest if there is one) */
  const startGuestSession = async () => {
    if (!GUEST_SIGN_IN_ENABLED) return;
    const result = await authService.signInAsGuest();
    if (result.success) await loadUser();
  };

  // On load: the saved session if there is one, otherwise a guest session
  useEffect(() => {
    (async () => {
      try {
        const current = await loadUser();
        if (!current) await startGuestSession();
      } finally {
        setIsLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = async (username: string, password: string) => {
    const wasGuest = !!userRef.current?.isGuest;
    // Taken before switching accounts: proves to the backend which guest's data to move
    const guestToken = wasGuest ? await authService.getAccessToken() : null;
    if (wasGuest) await authService.signOut();

    const result = await authService.signIn({ username, password });
    if (!result.success) {
      // Back to the guest session, so a typo doesn't lose the visitor's playlists
      if (wasGuest) await startGuestSession();
      return result;
    }

    let movedGuestData = false;
    if (guestToken) {
      movedGuestData = await authService.claimGuestData(guestToken);
      if (movedGuestData) clearGuest(); // its data now belongs to the account
    }
    await loadUser();
    return { ...result, movedGuestData };
  };

  const signInAsGuest = async () => {
    const result = await authService.signInAsGuest();
    if (result.success) await loadUser();
    return result;
  };

  const signUp = async (username: string, password: string, email: string) => {
    return await authService.signUp({ username, password, email });
  };

  // Signing out of an account starts a fresh guest session, so the site keeps working
  const signOut = async () => {
    await authService.signOut();
    setUser(null);
    clearGuest();
    setIsLoading(true);
    try {
      await startGuestSession();
    } finally {
      setIsLoading(false);
    }
  };

  const value = {
    user,
    isAuthenticated: !!user,
    isGuest: !!user?.isGuest,
    isLoading,
    signIn,
    signInAsGuest,
    signUp,
    signOut,
    refreshAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
