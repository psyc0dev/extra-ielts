import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { bootstrapAdmin, getBootstrapStatus, getMe, login, logout, setToken, type ApiUser } from "@/lib/api";

const AuthContext = createContext<{
  user: ApiUser | null;
  loading: boolean;
  needsBootstrap: boolean;
  loginUser: (identifier: string, password: string) => Promise<void>;
  bootstrap: (payload: { username: string; email?: string; password: string }) => Promise<void>;
  logoutUser: () => Promise<void>;
  refreshUser: () => Promise<void>;
} | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsBootstrap, setNeedsBootstrap] = useState(false);

  const refreshUser = useCallback(async () => {
    try {
      const res = await getMe();
      setUser(res.user);
    } catch {
      setUser(null);
      setToken(null);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const status = await getBootstrapStatus();
        setNeedsBootstrap(status.needsBootstrap);
      } catch {
        setNeedsBootstrap(false);
      }

      await refreshUser();
      setLoading(false);
    };
    init();
  }, [refreshUser]);

  const loginUser = useCallback(async (identifier: string, password: string) => {
    const res = await login({ identifier, password });
    setToken(res.token);
    setUser(res.user);
  }, []);

  const bootstrap = useCallback(async (payload: { username: string; email?: string; password: string }) => {
    const res = await bootstrapAdmin(payload);
    setToken(res.token);
    setUser(res.user);
    setNeedsBootstrap(false);
  }, []);

  const logoutUser = useCallback(async () => {
    try {
      await logout();
    } finally {
      setToken(null);
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, needsBootstrap, loginUser, bootstrap, logoutUser, refreshUser }),
    [user, loading, needsBootstrap, loginUser, bootstrap, logoutUser, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
