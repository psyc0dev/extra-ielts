import { useState, useEffect, useRef, useContext } from "react";
import { type Window } from "@tauri-apps/api/window";
import { NavContext } from "@/hooks/use-nav";
import { forceSubmitAttempt } from "@/lib/api";
import { Maximize, Minimize, Minus, X } from 'lucide-react';
import en from "@/locales/en";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export default function WindowControls({ onFullscreen }: { onFullscreen?: (v: boolean) => void }) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const nav = useContext(NavContext);
  const timerActive = nav?.timerActive ?? false;
  const activeAttemptId = nav?.activeAttemptId ?? null;
  const windowRef = useRef<Window | null>(null);
  const attemptRef = useRef(activeAttemptId);

  useEffect(() => {
    attemptRef.current = activeAttemptId;
  }, [activeAttemptId]);

  useEffect(() => {
    if (!isTauri) return;

    let appWindow: Window | null = null;
    let unlistenResize: (() => void) | null = null;
    let unlistenClose: (() => void) | null = null;

    const init = async () => {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      appWindow = getCurrentWindow();
      windowRef.current = appWindow;

      setIsFullscreen(await appWindow.isFullscreen());

      unlistenResize = await appWindow.onResized(async () => {
        setIsFullscreen(await appWindow!.isFullscreen());
      });

      unlistenClose = await appWindow.onCloseRequested(async (e) => {
        const attemptId = attemptRef.current;
        if (attemptId) {
          e.preventDefault();
          forceSubmitAttempt(attemptId);
          await new Promise(r => setTimeout(r, 300));
          await appWindow!.destroy();
        }
      });
    };

    init().catch(console.error);

    return () => {
      unlistenResize?.();
      unlistenClose?.();
    };
  }, []);

  return (
    <div className="flex self-stretch">
      <button
        onClick={() => windowRef.current?.minimize()}
        className="w-8 h-full flex items-center justify-center text-foreground/60 hover:bg-white/15 hover:text-foreground transition-all"
        aria-label={en.windowControls.minimize}
      >
        <Minus size={18} strokeWidth={1.5} />
      </button>
      <button
        onClick={async () => { const next = !isFullscreen; await windowRef.current?.setFullscreen(next); setIsFullscreen(next); onFullscreen?.(next); }}
        className="w-8 h-full flex items-center justify-center text-foreground/60 hover:bg-white/15 hover:text-foreground transition-all"
        aria-label={isFullscreen ? en.windowControls.restore : en.windowControls.maximize}
      >
        {isFullscreen ? <Minimize size={16} strokeWidth={1.5} /> : <Maximize size={16} strokeWidth={1.5} />}
      </button>
      <button
        onClick={async () => {
          const attemptId = attemptRef.current;
          if (attemptId) {
            forceSubmitAttempt(attemptId);
            await new Promise(r => setTimeout(r, 300));
          }
          await windowRef.current?.destroy();
        }}
        className={`w-8 h-full flex items-center justify-center text-foreground/60 hover:bg-red-600 hover:text-white transition-all ${isFullscreen ? 'rounded-none' : ''}`}
        aria-label={timerActive ? en.windowControls.closeSubmitting : en.windowControls.close}
      >
        <X size={18} strokeWidth={1.5} />
      </button>
    </div>
  );
}
