import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getMe, login, logout, register, setIsAdmin, setIsTeacher, type ApiUser } from "@/lib/api";

const AuthContext = createContext<{
  user: ApiUser | null;
  loading: boolean;
  loginUser: (identifier: string, password: string) => Promise<void>;
  registerUser: (username: string, email: string | undefined, password: string) => Promise<void>;
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
      setIsTeacher(res.user.role === 'teacher');
    } catch {
      setUser(null);
      setIsAdmin(false);
      setIsTeacher(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await refreshUser();
      setLoading(false);
    };
    init();
  }, [refreshUser]);

  const registerUser = useCallback(async (username: string, email: string | undefined, password: string) => {
    const res = await register({ username, email, password });
    setUser(res.user);
    setIsAdmin(res.user.role === 'admin');
    setIsTeacher(res.user.role === 'teacher');
  }, []);

  const loginUser = useCallback(async (identifier: string, password: string) => {
    const res = await login({ identifier, password });
    setUser(res.user);
    setIsAdmin(res.user.role === 'admin');
    setIsTeacher(res.user.role === 'teacher');
  }, []);

  const logoutUser = useCallback(async () => {
    try {
      await logout();
    } finally {
      setUser(null);
      setIsAdmin(false);
      setIsTeacher(false);
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, loginUser, registerUser, logoutUser, refreshUser }),
    [user, loading, loginUser, registerUser, logoutUser, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
