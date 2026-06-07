import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { clearToken, loadToken, saveToken } from './authStore';
import { queryClient } from './queryClient';

type AuthState = {
  token: string | null;
  ready: boolean;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const t = await loadToken();
      setToken(t);
      setReady(true);
    })();
  }, []);

  const signIn = useCallback(async (newToken: string) => {
    await saveToken(newToken);
    // Golim cache-ul ca sa nu ramana datele user-ului anterior (me/pet/avatar
    // sunt keyed stabil si fresh 30s — altfel noul cont vede datele vechi).
    queryClient.clear();
    setToken(newToken);
  }, []);

  const signOut = useCallback(async () => {
    await clearToken();
    queryClient.clear();
    setToken(null);
  }, []);

  return (
    <AuthContext.Provider value={{ token, ready, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
