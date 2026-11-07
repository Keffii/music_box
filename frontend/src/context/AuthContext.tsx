import React, { createContext, useState, useEffect, useContext } from 'react';
import { authService, AuthResult } from '../services/authService';

interface User {
  username: string;
  userId: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (username: string, password: string) => Promise<AuthResult & { needsConfirmation?: boolean }>;
  signUp: (username: string, password: string, email: string) => Promise<AuthResult & { requiresConfirmation?: boolean }>;
  signOut: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshAuth = async () => {
    try {
      const result = await authService.getCurrentUser();
      if (result.success && result.user) {
        setUser({
          username: result.user.username,
          userId: result.user.userId,
        });
      } else {
        setUser(null);
      }
    } catch (error) {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshAuth();
  }, []);

  const signIn = async (username: string, password: string) => {
    const result = await authService.signIn({ username, password });
    if (result.success) {
      await refreshAuth();
    }
    return result;
  };

  const signUp = async (username: string, password: string, email: string) => {
    return await authService.signUp({ username, password, email });
  };

  const signOut = async () => {
    await authService.signOut();
    setUser(null);
  };

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    signIn,
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
