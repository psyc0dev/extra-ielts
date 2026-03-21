import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import WindowControls from "./components/WindowControls";
import { NavProvider, useNav } from "./hooks/use-nav";
import { Dashboard, Tests, Homework, Settings } from "./pages/index";
import { LoginForm } from "@/components/login-form";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import Navbar from "./components/Navbar";
import { TimerWidget } from "./components/TimerWidget";
import en from "./locales/en";
import { getCurrentWindow } from "@tauri-apps/api/window";

interface ActiveTest {
  name: string;
  seconds: number;
}

function PageContent({
  onSignOut,
  username,
  timerWarning,
  onTimerWarningChange,
  onStartTest,
  onFullscreen,
  timerActive,
}: {
  onSignOut: () => void;
  username: string;
  timerWarning: boolean;
  onTimerWarningChange: (v: boolean) => void;
  onStartTest: (name: string, seconds: number) => void;
  onFullscreen: (v: boolean) => void;
  timerActive: boolean;
}) {
  const { page } = useNav();

  const pages: Record<string, React.ReactNode> = {
    Dashboard: <Dashboard />,
    Tests: <Tests onStartTest={onStartTest} timerActive={timerActive} />,
    Homework: <Homework />,
    Settings: (
      <Settings
        onSignOut={onSignOut}
        username={username}
        timerWarning={timerWarning}
        onTimerWarningChange={onTimerWarningChange}
      />
    ),
  };

  return (
    <>
      <header className="flex h-9 shrink-0 items-center gap-2 select-none border-b border-neutral-800">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="size-8 [&_svg]:size-4" />
          <Separator orientation="vertical" className="mr-2 mt-2 data-[orientation=vertical]:h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>{page}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <div data-tauri-drag-region className="flex-1 h-full" />
        <div className="px-4">
          <WindowControls onFullscreen={onFullscreen} />
        </div>
      </header>
      <div className="relative flex flex-1 flex-col overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={page}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15, ease: "easeInOut" }}
            className="absolute inset-0 overflow-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {pages[page]}
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  );
}

function AppShell({
  onSignOut,
  username,
  isFullscreen,
  setIsFullscreen,
}: {
  onSignOut: () => void;
  username: string;
  isFullscreen: boolean;
  setIsFullscreen: (v: boolean) => void;
}) {
  const { timerActive, setTimerActive } = useNav();
  const [timerWarning, setTimerWarning] = useState(true);
  const [activeTest, setActiveTest] = useState<ActiveTest | null>(null);

  useEffect(() => {
    const win = getCurrentWindow();
    const unlisten = win.onCloseRequested(async (e) => {
      if (timerActive) {
        e.preventDefault();
        toast.warning("Test in progress", { description: "You can't close the app while a test timer is running." });
      }
    });
    return () => { unlisten.then(fn => fn()); };
  }, [timerActive]);

  return (
    <>
      <SidebarProvider defaultOpen={false}>
        <div className="flex flex-col w-full min-h-0 h-full">
          <div className="flex flex-1 min-h-0">
            <Navbar />
            <SidebarInset>
              <PageContent
                onSignOut={onSignOut}
                username={username}
                timerWarning={timerWarning}
                onTimerWarningChange={setTimerWarning}
                onStartTest={(name, seconds) => {
                  setActiveTest({ name, seconds });
                  setTimerActive(true);
                }}
                onFullscreen={setIsFullscreen}
                timerActive={timerActive}
              />
            </SidebarInset>
          </div>
        </div>
      </SidebarProvider>
      {activeTest && (
        <TimerWidget
          testName={activeTest.name}
          durationSeconds={activeTest.seconds}
          timerWarning={timerWarning}
          onStop={() => { setActiveTest(null); setTimerActive(false); }}
        />
      )}
    </>
  );
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);

  return (
    <div
      className="dark flex flex-col h-screen font-sans bg-neutral-900 text-white overflow-hidden"
      style={{ borderRadius: isFullscreen ? 0 : 10, transition: "border-radius 0.3s ease" }}
    >
      <Toaster />
      {!loggedIn ? (
        <div className="flex flex-col flex-1">
          <div data-tauri-drag-region className="flex h-9 items-center justify-end px-4 select-none border-b border-neutral-800">
            <WindowControls onFullscreen={setIsFullscreen} />
          </div>
          <div className="flex flex-1 items-center justify-center bg-background">
            <div className="w-full max-w-sm">
              <LoginForm onLogin={(u) => { setUsername(u); setLoggedIn(true); toast.success(en.login.successToast(u)); }} />
            </div>
          </div>
        </div>
      ) : (
        <NavProvider>
          <TooltipProvider>
            <AppShell
              onSignOut={() => setLoggedIn(false)}
              username={username}
              isFullscreen={isFullscreen}
              setIsFullscreen={setIsFullscreen}
            />
          </TooltipProvider>
        </NavProvider>
      )}
    </div>
  );
}
