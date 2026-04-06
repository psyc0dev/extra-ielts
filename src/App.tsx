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
import { Dashboard, Tests, Homework, Settings, Admin, Writing } from "./pages/index";
import { LoginForm } from "@/components/ui/loginform";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import Navbar from "./components/Navbar";
import { TimerWidget } from "./components/TimerWidget";
import en from "./locales/en";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { getSettings, updateSettings, type UserSettings, type ApiUser } from "@/lib/api";
import LoadingScreen from "./components/LoadingScreen";

const defaultSettings: UserSettings = {
  notifications: true,
  sound: true,
  timerWarning: true,
};

interface ActiveTest {
  name: string;
  seconds: number;
}

function PageContent({
  onSignOut,
  user,
  onUserUpdate,
  settings,
  onSettingsChange,
  onStartTest,
  onStopTest,
  onFullscreen,
  timerActive,
  isAdmin,
}: {
  onSignOut: () => void;
  user: ApiUser;
  onUserUpdate: (u: ApiUser) => void;
  settings: UserSettings;
  onSettingsChange: (patch: Partial<UserSettings>) => void;
  onStartTest: (name: string, seconds: number) => void;
  onStopTest: () => void;
  onFullscreen: (v: boolean) => void;
  timerActive: boolean;
  isAdmin: boolean;
}) {
  const { page } = useNav();
  const pageLabels: Record<string, string> = {
    Dashboard: en.nav.dashboard,
    Tests: en.nav.tests,
    Homework: en.nav.homework,
    Settings: en.nav.settings,
    Admin: en.nav.admin,
    Writing: en.nav.writing,
  };

  const pages: Record<string, React.ReactNode> = {
    Dashboard: <Dashboard />,
    Tests: <Tests onStartTest={onStartTest} onStopTest={onStopTest} timerActive={timerActive} />,
    Homework: <Homework onStartTest={onStartTest} onStopTest={onStopTest} timerActive={timerActive} />,
    Writing: <Writing />,
    Settings: (
      <Settings
        onSignOut={onSignOut}
        user={user}
        onUserUpdate={onUserUpdate}
        settings={settings}
        onSettingsChange={onSettingsChange}
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
                <BreadcrumbPage>{pageLabels[page] ?? page}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <div data-tauri-drag-region className="flex-1 h-full" />
        <WindowControls onFullscreen={onFullscreen} />
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
  user,
  onUserUpdate,
  isFullscreen,
  setIsFullscreen,
  isAdmin,
}: {
  onSignOut: () => void;
  user: ApiUser;
  onUserUpdate: (u: ApiUser) => void;
  isFullscreen: boolean;
  setIsFullscreen: (v: boolean) => void;
  isAdmin: boolean;
}) {
  const { timerActive, setTimerActive } = useNav();
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [activeTest, setActiveTest] = useState<ActiveTest | null>(null);


  useEffect(() => {
    if (!activeTest && timerActive) {
      setTimerActive(false);
    }
  }, [activeTest, timerActive, setTimerActive]);

  useEffect(() => {
    let mounted = true;
    getSettings()
      .then((res) => {
        if (mounted) setSettings({ ...defaultSettings, ...res.settings });
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  const handleSettingsChange = async (patch: Partial<UserSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
    try {
      const res = await updateSettings(patch);
      setSettings(res.settings);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : en.app.errors.saveSettingsFailed;
      toast.error(message);
    }
  };

  return (
    <>
      <SidebarProvider defaultOpen={false}>
        <div className="flex flex-col w-full min-h-0 h-full">
          <div className="flex flex-1 min-h-0">
            <Navbar />
            <SidebarInset>
              <PageContent
                onSignOut={onSignOut}
                user={user}
                onUserUpdate={onUserUpdate}
                settings={settings}
                onSettingsChange={handleSettingsChange}
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
          timerWarning={settings.timerWarning}
          sound={settings.sound}
          onFinish={() => { setActiveTest(null); setTimerActive(false); }}
        />
      )}
    </>
  );
}

function AppBody() {
  const { user, loading, loginUser, logoutUser, bootstrap, needsBootstrap, refreshUser } = useAuth();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  return (
    <>
      <Toaster />
      <AnimatePresence>
        {showSplash && (
          <motion.div
            key="splash"
            className="absolute inset-0 z-50"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <LoadingScreen onComplete={() => setShowSplash(false)} />
          </motion.div>
        )}
      </AnimatePresence>
      <div
        className="dark flex flex-col h-screen font-sans bg-neutral-900 text-white overflow-hidden"
        style={{ clipPath: isFullscreen ? "none" : "inset(0 round 6px)", transition: "clip-path 0.3s ease" }}
      >
      <AnimatePresence mode="wait">
      {!user ? (
        <motion.div
          key="login"
          className="flex flex-col flex-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div data-tauri-drag-region className="flex h-9 items-center justify-end select-none border-b border-neutral-800">
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
        </motion.div>
      ) : (
        <motion.div
          key="app"
          className="flex flex-col flex-1 min-h-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <NavProvider>
            <TooltipProvider>
              <AppShell
                onSignOut={logoutUser}
                user={user}
                onUserUpdate={(updated) => refreshUser().catch(() => undefined)}
                isFullscreen={isFullscreen}
                setIsFullscreen={setIsFullscreen}
                isAdmin={user.role === "admin"}
              />
            </TooltipProvider>
          </NavProvider>
        </motion.div>
      )}
      </AnimatePresence>
      </div>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppBody />
    </AuthProvider>
  );
}
