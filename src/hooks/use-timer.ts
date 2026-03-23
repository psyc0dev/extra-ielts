import { useState, useEffect, useRef, useCallback } from "react";

interface UseTimerOptions {
  durationSeconds: number;
  warningSeconds?: number;
  onWarning?: () => void;
  onFinish?: () => void;
}

export interface TimerState {
  remaining: number;
  running: boolean;
  finished: boolean;
  start: () => void;
  pause: () => void;
  reset: () => void;
  formatted: string;
}

export function useTimer({
  durationSeconds,
  warningSeconds = 300,
  onWarning,
  onFinish,
}: UseTimerOptions): TimerState {
  const initial = Math.floor(durationSeconds);
  const [remaining, setRemaining] = useState(initial);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const warnedRef = useRef(false);
  const hasStartedRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onFinishRef = useRef(onFinish);
  const onWarningRef = useRef(onWarning);

  useEffect(() => { onFinishRef.current = onFinish; }, [onFinish]);
  useEffect(() => { onWarningRef.current = onWarning; }, [onWarning]);

  const clear = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  useEffect(() => {
    if (!running) return;
    hasStartedRef.current = true;
    intervalRef.current = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) return 0;
        const next = prev - 1;
        if (!warnedRef.current && next <= warningSeconds) {
          warnedRef.current = true;
          setTimeout(() => onWarningRef.current?.(), 0);
        }
        return next;
      });
    }, 1000);
    return clear;
  }, [running, warningSeconds, clear]);

  useEffect(() => {
    if (!hasStartedRef.current || remaining !== 0 || finished) return;
    clear();
    setRunning(false);
    setFinished(true);
    onFinishRef.current?.();
  }, [remaining, finished, clear]);

  const start = useCallback(() => {
    if (finished) return;
    setRunning(true);
  }, [finished]);

  const pause = useCallback(() => setRunning(false), []);

  const reset = useCallback(() => {
    clear();
    setRunning(false);
    setFinished(false);
    setRemaining(initial);
    warnedRef.current = false;
    hasStartedRef.current = false;
  }, [initial, clear]);

  const h = Math.floor(remaining / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const s = remaining % 60;
  const formatted = h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

  return { remaining, running, finished, start, pause, reset, formatted };
}
