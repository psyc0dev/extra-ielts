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
import { Dashboard, Tests, Homework, Settings, Admin } from "./pages/index";
import { LoginForm } from "@/components/login-form";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import Navbar from "./components/Navbar";
import { TimerWidget } from "./components/TimerWidget";
import en from "./locales/en";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { AuthProvider, useAuth } from "@/hooks/use-auth";

interface ActiveTest {
  name: string;
  seconds: number;
}

function PageContent({
  onSignOut,
  username,
  role,
  timerWarning,
  onTimerWarningChange,
  onStartTest,
  onStopTest,
  onFullscreen,
  timerActive,
  isAdmin,
}: {
  onSignOut: () => void;
  username: string;
  role: string;
  timerWarning: boolean;
  onTimerWarningChange: (v: boolean) => void;
  onStartTest: (name: string, seconds: number) => void;
  onStopTest: () => void;
  onFullscreen: (v: boolean) => void;
  timerActive: boolean;
  isAdmin: boolean;
}) {
  const { page } = useNav();

  const pages: Record<string, React.ReactNode> = {
    Dashboard: <Dashboard />,
    Tests: <Tests onStartTest={onStartTest} onStopTest={onStopTest} timerActive={timerActive} />,
    Homework: <Homework />,
    Settings: (
      <Settings
        onSignOut={onSignOut}
        username={username}
        role={role}
        timerWarning={timerWarning}
        onTimerWarningChange={onTimerWarningChange}
      />
    ),
    Admin: isAdmin ? <Admin /> : <Dashboard />,
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
  isAdmin,
  role,
}: {
  onSignOut: () => void;
  username: string;
  isFullscreen: boolean;
  setIsFullscreen: (v: boolean) => void;
  isAdmin: boolean;
  role: string;
}) {
  const { timerActive, setTimerActive } = useNav();
  const [timerWarning, setTimerWarning] = useState(true);
  const [activeTest, setActiveTest] = useState<ActiveTest | null>(null);

  useEffect(() => {
    if (!activeTest && timerActive) {
      setTimerActive(false);
    }
  }, [activeTest, timerActive, setTimerActive]);

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
                role={role}
                timerWarning={timerWarning}
                onTimerWarningChange={setTimerWarning}
                onStartTest={(name, seconds) => {
                  setActiveTest({ name, seconds });
                  setTimerActive(true);
                }}
                onStopTest={() => {
                  setActiveTest(null);
                  setTimerActive(false);
                }}
                onFullscreen={setIsFullscreen}
                timerActive={timerActive}
                isAdmin={isAdmin}
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

function AppBody() {
  const { user, loading, loginUser, logoutUser, bootstrap, needsBootstrap } = useAuth();
  const [isFullscreen, setIsFullscreen] = useState(false);

  if (loading) {
    return (
      <div className="dark flex h-screen items-center justify-center bg-neutral-900 text-white">
        <div className="text-xs text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div
      className="dark flex flex-col h-screen font-sans bg-neutral-900 text-white overflow-hidden"
      style={{ borderRadius: isFullscreen ? 0 : 10, transition: "border-radius 0.3s ease" }}
    >
      <Toaster />
      {!user ? (
        <div className="flex flex-col flex-1">
          <div data-tauri-drag-region className="flex h-9 items-center justify-end px-4 select-none border-b border-neutral-800">
            <WindowControls onFullscreen={setIsFullscreen} />
          </div>
          <div className="flex flex-1 items-center justify-center bg-background">
            <div className="w-full max-w-sm">
              <LoginForm
                onLogin={async (identifier, password) => {
                  await loginUser(identifier, password);
                  toast.success(en.login.successToast(identifier));
                }}
                onBootstrap={async (payload) => {
                  await bootstrap(payload);
                  toast.success(en.login.bootstrapSuccess);
                }}
                needsBootstrap={needsBootstrap}
                loading={loading}
              />
            </div>
          </div>
        </div>
      ) : (
        <NavProvider>
          <TooltipProvider>
            <AppShell
              onSignOut={logoutUser}
              username={user.username}
              isFullscreen={isFullscreen}
              setIsFullscreen={setIsFullscreen}
              isAdmin={user.role === "admin"}
              role={user.role}
            />
          </TooltipProvider>
        </NavProvider>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppBody />
    </AuthProvider>
  );
}
