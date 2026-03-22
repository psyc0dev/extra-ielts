import { createContext, useContext, useState } from "react";
import { toast } from "sonner";

type Page = "Dashboard" | "Tests" | "Homework" | "Settings" | "Admin";

export const NavContext = createContext<{
  page: Page;
  setPage: (p: Page, pendingId?: string) => void;
  pendingId: string | null;
  clearPendingId: () => void;
  timerActive: boolean;
  setTimerActive: (v: boolean) => void;
  activeAttemptId: string | null;
  setActiveAttemptId: (id: string | null) => void;
} | null>(null);

export function NavProvider({ children }: { children: React.ReactNode }) {
  const [page, setPageRaw] = useState<Page>("Dashboard");
  const [timerActive, setTimerActive] = useState(false);
  const [activeAttemptId, setActiveAttemptId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const setPage = (p: Page, id?: string) => {
    if (timerActive) {
      toast.warning("Test in progress", { description: "Finish or wait for the timer to end before switching pages." });
      return;
    }
    setPendingId(id ?? null);
    setPageRaw(p);
  };

  return (
    <NavContext.Provider value={{ page, setPage, pendingId, clearPendingId: () => setPendingId(null), timerActive, setTimerActive, activeAttemptId, setActiveAttemptId }}>
      {children}
    </NavContext.Provider>
  );
}

export function useNav() {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error("useNav must be used within NavProvider");
  return ctx;
}
