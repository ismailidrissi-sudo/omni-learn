import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_KEY = '@omnilearn_auth';

export type User = { id: string; email: string; name: string };

type AuthState = {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
};

type AuthContextType = AuthState & {
  signIn: (user: User, accessToken: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshAuth: () => Promise<void>;
};

const defaultState: AuthState = {
  user: null,
  accessToken: null,
  isLoading: true,
  isAuthenticated: false,
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(defaultState);

  const refreshAuth = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(AUTH_KEY);
      if (stored) {
        const { user, accessToken } = JSON.parse(stored);
        setState({
          user,
          accessToken,
          isLoading: false,
          isAuthenticated: !!accessToken && !!user,
        });
        return;
      }
    } catch {
      // ignore
    }
    setState((s) => ({ ...s, isLoading: false, user: null, accessToken: null, isAuthenticated: false }));
  }, []);

  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  const signIn = useCallback(async (user: User, accessToken: string) => {
    await AsyncStorage.setItem(AUTH_KEY, JSON.stringify({ user, accessToken }));
    setState({
      user,
      accessToken,
      isLoading: false,
      isAuthenticated: true,
    });
  }, []);

  const signOut = useCallback(async () => {
    await AsyncStorage.removeItem(AUTH_KEY);
    setState({
      user: null,
      accessToken: null,
      isLoading: false,
      isAuthenticated: false,
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        signIn,
        signOut,
        refreshAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
