import { createContext, useContext, useState } from "react";
import { toast } from "sonner";

type Page = "Dashboard" | "Tests" | "Homework" | "Settings";

const NavContext = createContext<{
  page: Page;
  setPage: (p: Page) => void;
  timerActive: boolean;
  setTimerActive: (v: boolean) => void;
} | null>(null);

export function NavProvider({ children }: { children: React.ReactNode }) {
  const [page, setPageRaw] = useState<Page>("Dashboard");
  const [timerActive, setTimerActive] = useState(false);

  const setPage = (p: Page) => {
    if (timerActive) {
      toast.warning("Test in progress", { description: "Finish or wait for the timer to end before switching pages." });
      return;
    }
    setPageRaw(p);
  };

  return (
    <NavContext.Provider value={{ page, setPage, timerActive, setTimerActive }}>
      {children}
    </NavContext.Provider>
  );
}

export function useNav() {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error("useNav must be used within NavProvider");
  return ctx;
}
