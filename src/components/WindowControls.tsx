import { useState, useEffect, useRef, useContext } from "react";
import { getCurrentWindow, type Window } from "@tauri-apps/api/window";
import { NavContext } from "@/hooks/use-nav";
import { forceSubmitAttempt } from "@/lib/api";

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
    const appWindow = getCurrentWindow();
    windowRef.current = appWindow;

    appWindow.isFullscreen().then(setIsFullscreen);

    const unlistenResize = appWindow.onResized(async () => {
      setIsFullscreen(await appWindow.isFullscreen());
    });

    const unlistenClose = appWindow.onCloseRequested(async (e) => {
      const attemptId = attemptRef.current;
      if (attemptId) {
        e.preventDefault();
        forceSubmitAttempt(attemptId);
        // give the keepalive fetch a moment to fire
        await new Promise(r => setTimeout(r, 300));
        await appWindow.destroy();
      }
    });

    return () => {
      unlistenResize.then(fn => fn());
      unlistenClose.then(fn => fn());
    };
  }, []);

  const appWindow = windowRef.current;

  return (
    <div className="flex items-center gap-2 group/controls">
      <button onClick={() => appWindow?.minimize()} className="relative w-3 h-3 rounded-full bg-[#febc2e] hover:brightness-90 transition-all">
        <svg className="absolute inset-0 m-auto opacity-0 group-hover/controls:opacity-100 transition-opacity" width="6" height="6" viewBox="0 0 6 6">
          <line x1="1" y1="3" x2="5" y2="3" stroke="#7a4800" strokeWidth="1.25" strokeLinecap="round"/>
        </svg>
      </button>
      <button
        onClick={async () => { const next = !isFullscreen; await appWindow?.setFullscreen(next); setIsFullscreen(next); onFullscreen?.(next); }}
        className="relative w-3 h-3 rounded-full bg-[#28c840] hover:brightness-90 transition-all"
      >
        <svg className="absolute inset-0 m-auto opacity-0 group-hover/controls:opacity-100 transition-opacity" width="6" height="6" viewBox="0 0 6 6">
          {isFullscreen ? (
            <><line x1="1" y1="5" x2="5" y2="1" stroke="#004d00" strokeWidth="1.25" strokeLinecap="round"/><polyline points="3,5 1,5 1,3" fill="none" stroke="#004d00" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/></>
          ) : (
            <><line x1="1" y1="5" x2="5" y2="1" stroke="#004d00" strokeWidth="1.25" strokeLinecap="round"/><polyline points="3.2,1 5,1 5,2.8" fill="none" stroke="#004d00" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/></>
          )}
        </svg>
      </button>
      <button
        onClick={async () => {
          const attemptId = attemptRef.current;
          if (attemptId) {
            forceSubmitAttempt(attemptId);
            await new Promise(r => setTimeout(r, 300));
          }
          await appWindow?.destroy();
        }}
        className="relative w-3 h-3 rounded-full bg-[#ff5f57] hover:brightness-90 transition-all"
        aria-label={timerActive ? "Close (submitting test)" : "Close"}
      >
        <svg className="absolute inset-0 m-auto opacity-0 group-hover/controls:opacity-100 transition-opacity" width="6" height="6" viewBox="0 0 6 6">
          <line x1="1" y1="1" x2="5" y2="5" stroke="#7a0000" strokeWidth="1.25" strokeLinecap="round"/>
          <line x1="5" y1="1" x2="1" y2="5" stroke="#7a0000" strokeWidth="1.25" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  );
}
