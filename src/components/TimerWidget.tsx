import { useEffect } from "react";
import { useTimer } from "@/hooks/use-timer";
import { notify } from "@/lib/notify";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import en from "@/locales/en";
import { Timer } from "@phosphor-icons/react";

interface TimerWidgetProps {
  testName: string;
  durationSeconds: number;
  timerWarning: boolean;
  onStop: () => void;
}

export function TimerWidget({ testName, durationSeconds, timerWarning, onStop }: TimerWidgetProps) {
  const timer = useTimer({
    durationSeconds,
    warningSeconds: 300,
    onWarning: () => {
      if (timerWarning) {
        toast.warning(en.timer.warning, { description: testName });
        notify(en.timer.warning, en.timer.warningBody(testName));
      }
    },
    onFinish: () => {
      toast.error(en.timer.finished, { description: testName });
      notify(en.timer.finished, en.timer.finishedBody(testName));
      onStop();
    },
  });

  useEffect(() => { timer.start(); }, []);

  const urgent = timer.remaining <= 300;

  return (
    <div className={cn(
      "fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-xl border shadow-lg backdrop-blur-sm transition-colors",
      urgent
        ? "border-amber-800 bg-neutral-950/90 text-amber-400"
        : "border-neutral-700 bg-neutral-950/90 text-white"
    )}>
      <Timer weight="bold" className="size-3.5 shrink-0" />
      <div className="flex flex-col min-w-0">
        <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{testName}</span>
        <span className="text-sm font-bold tabular-nums leading-none tracking-tight">{timer.formatted}</span>
      </div>
    </div>
  );
}
