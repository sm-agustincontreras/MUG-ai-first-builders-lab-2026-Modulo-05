import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import * as authService from '../services/auth.service';
import type { AuthUser } from '../services/auth.service';

interface AuthContextValue {
  user: AuthUser | null;
  /**
   * El access token vive únicamente en memoria (estado de React), nunca en
   * localStorage/sessionStorage — decisión de seguridad explícita del threat
   * model para reducir la superficie de robo vía XSS.
   */
  accessToken: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const login = useCallback(async (email: string, password: string): Promise<AuthUser> => {
    const response = await authService.login(email, password);
    setAccessToken(response.accessToken);
    setUser(response.user);
    return response.user;
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      if (accessToken) {
        await authService.logout(accessToken);
      }
    } finally {
      // El estado local se limpia siempre: el objetivo de "cerrar sesión" es
      // que este cliente deje de comportarse como autenticado, incluso si la
      // llamada de invalidación server-side falla (p. ej. red caída).
      setAccessToken(null);
      setUser(null);
    }
  }, [accessToken]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      isAuthenticated: user !== null,
      login,
      logout,
    }),
    [user, accessToken, login, logout],
  );

  // Este archivo es `.ts` (no `.tsx`), por lo que el elemento del Provider se
  // construye con `createElement` en vez de sintaxis JSX.
  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de un <AuthProvider>');
  }
  return context;
}
