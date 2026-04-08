import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getMe, login, logout, setToken, setIsAdmin, type ApiUser } from "@/lib/api";

const AuthContext = createContext<{
  user: ApiUser | null;
  loading: boolean;
  loginUser: (identifier: string, password: string) => Promise<void>;
  logoutUser: () => Promise<void>;
  refreshUser: () => Promise<void>;
} | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const res = await getMe();
      setUser(res.user);
      setIsAdmin(res.user.role === 'admin');
    } catch {
      setUser(null);
      setToken(null);
      setIsAdmin(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await refreshUser();
      setLoading(false);
    };
    init();
  }, [refreshUser]);

  const loginUser = useCallback(async (identifier: string, password: string) => {
    const res = await login({ identifier, password });
    setToken(res.token);
    setUser(res.user);
    setIsAdmin(res.user.role === 'admin');
  }, []);

  const logoutUser = useCallback(async () => {
    try {
      await logout();
    } finally {
      setToken(null);
      setUser(null);
      setIsAdmin(false);
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, loginUser, logoutUser, refreshUser }),
    [user, loading, loginUser, logoutUser, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
