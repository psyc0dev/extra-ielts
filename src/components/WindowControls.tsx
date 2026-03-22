import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

const appWindow = getCurrentWindow();

export default function WindowControls({ onFullscreen }: { onFullscreen?: (v: boolean) => void }) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    appWindow.isFullscreen().then(setIsFullscreen);
    const unlisten = appWindow.onResized(async () => {
      setIsFullscreen(await appWindow.isFullscreen());
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

  return (
    <div className="flex items-center gap-2 group/controls">
      <button onClick={() => appWindow.minimize()} className="relative w-3 h-3 rounded-full bg-[#febc2e] hover:brightness-90 transition-all">
        <svg className="absolute inset-0 m-auto opacity-0 group-hover/controls:opacity-100 transition-opacity" width="6" height="6" viewBox="0 0 6 6">
          <line x1="1" y1="3" x2="5" y2="3" stroke="#7a4800" strokeWidth="1.25" strokeLinecap="round"/>
        </svg>
      </button>
      <button
        onClick={async () => { const next = !isFullscreen; await appWindow.setFullscreen(next); setIsFullscreen(next); onFullscreen?.(next); }}
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
      <button onClick={() => appWindow.close()} className="relative w-3 h-3 rounded-full bg-[#ff5f57] hover:brightness-90 transition-all">
        <svg className="absolute inset-0 m-auto opacity-0 group-hover/controls:opacity-100 transition-opacity" width="6" height="6" viewBox="0 0 6 6">
          <line x1="1" y1="1" x2="5" y2="5" stroke="#7a0000" strokeWidth="1.25" strokeLinecap="round"/>
          <line x1="5" y1="1" x2="1" y2="5" stroke="#7a0000" strokeWidth="1.25" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  );
}
