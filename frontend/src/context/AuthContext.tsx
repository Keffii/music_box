import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { authService, AuthResult, AuthUser, AUTH_EXPIRED_EVENT } from '../services/authService';

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (username: string, password: string) => Promise<AuthResult>;
  signUp: (username: string, password: string) => Promise<AuthResult>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    authService.getCurrentUser().then((current) => {
      if (!cancelled) {
        setUser(current);
        setIsLoading(false);
      }
    });

    const onExpired = () => setUser(null);
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => {
      cancelled = true;
      window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
    };
  }, []);

  const signIn = useCallback(async (username: string, password: string) => {
    const result = await authService.signIn(username, password);
    if (result.success && result.user) setUser(result.user);
    return result;
  }, []);

  const signUp = useCallback(async (username: string, password: string) => {
    const result = await authService.signUp(username, password);
    if (result.success && result.user) setUser(result.user);
    return result;
  }, []);

  const signOut = useCallback(() => {
    authService.signOut();
    setUser(null);
  }, []);

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    signIn,
    signUp,
    signOut,
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
