import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, SpeakerHigh, SpeakerLow, SpeakerNone, SpeakerSlash, XCircle } from "@phosphor-icons/react";
import type { TestDetail } from "@/lib/api";
import en from "@/locales/en";

export type ListeningPhase = "idle" | "prep" | "playing" | "done" | "error";

type ListeningSectionProps = {
  audioUrl: string | null;
  questions: TestDetail["sections"][number]["questions"];
  readOnly: boolean;
  phase: ListeningPhase;
  onPhaseChange: (phase: ListeningPhase) => void;
  renderQuestion: (question: TestDetail["sections"][number]["questions"][number], idx: number) => ReactNode;
};

export function ListeningSection({
  audioUrl,
  questions,
  readOnly,
  phase,
  onPhaseChange,
  renderQuestion,
}: ListeningSectionProps) {
  const questionsVisible = readOnly || phase === "playing" || phase === "done";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {!readOnly && <ListeningPlayer key={audioUrl} audioUrl={audioUrl} phase={phase} onPhaseChange={onPhaseChange} />}
      <AnimatePresence mode="wait">
        {questionsVisible ? (
          <motion.div
            key="questions"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            className="flex-1 min-h-0"
          >
            <ScrollArea className="h-full">
              <div className="flex flex-col gap-4 p-4">
                {questions.map(renderQuestion)}
              </div>
            </ScrollArea>
          </motion.div>
        ) : (
          <motion.div
            key="waiting"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            className="flex-1 flex items-center justify-center text-xs text-muted-foreground"
          >
            {en.testRunner.listening.questionsWait}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ListeningPlayer({ audioUrl, phase, onPhaseChange }: {
  audioUrl: string | null;
  phase: ListeningPhase;
  onPhaseChange: (phase: ListeningPhase) => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [countdown, setCountdown] = useState(10);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const intervalRef = useRef<number | null>(null);

  const effectiveVolume = muted ? 0 : volume;

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = effectiveVolume;
  }, [effectiveVolume]);

  const VolumeIcon = muted || volume === 0 ? SpeakerSlash : volume < 0.4 ? SpeakerNone : volume < 0.75 ? SpeakerLow : SpeakerHigh;

  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (audio) { audio.pause(); audio.src = ""; audio.load(); }
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTimeUpdate = () => setProgress(audio.duration ? (audio.currentTime / audio.duration) * 100 : 0);
    const onEnded = () => { onPhaseChange("done"); setProgress(100); };
    const onError = () => { onPhaseChange("error"); if (intervalRef.current) clearInterval(intervalRef.current); };
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [onPhaseChange]);

  const handleStart = () => {
    if (phase !== "idle") return;
    if (!audioUrl) { onPhaseChange("error"); return; }
    onPhaseChange("prep");
    let remaining = 10;
    intervalRef.current = window.setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(intervalRef.current!);
        onPhaseChange("playing");
        audioRef.current?.play().catch(() => onPhaseChange("error"));
      }
    }, 1000);
  };

  return (
    <>
      {audioUrl && <audio ref={audioRef} src={audioUrl} preload="auto" />}
      <AnimatePresence mode="wait">
        {phase === "idle" ? (
          <motion.div
            key="idle"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            className="flex flex-col items-center justify-center gap-4 py-12 border-b border-neutral-800 shrink-0"
          >
            <SpeakerHigh weight="bold" className="size-8 text-muted-foreground" />
            <div className="flex flex-col items-center gap-1">
              <span className="text-sm font-semibold">{en.testRunner.listening.title}</span>
              <span className="text-xs text-muted-foreground">{en.testRunner.listening.prep}</span>
            </div>
            <Button variant="outline" className="gap-2 border-neutral-700" onClick={handleStart}>
              <Play weight="bold" className="size-4" /> {en.testRunner.listening.start}
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="bar"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800 shrink-0"
          >
            <Button size="xs" variant="outline" className="gap-1.5 border-neutral-700 shrink-0 min-w-32" disabled>
              {phase === "prep" && <><SpeakerHigh weight="bold" className="size-3" /> {en.testRunner.listening.startingIn(countdown)}</>}
              {phase === "playing" && <><SpeakerHigh weight="bold" className="size-3 animate-pulse" /> {en.testRunner.listening.playing}</>}
              {phase === "done" && <><SpeakerHigh weight="bold" className="size-3" /> {en.testRunner.listening.done}</>}
              {phase === "error" && <><XCircle weight="bold" className="size-3" /> {en.testRunner.listening.audioUnavailable}</>}
            </Button>
            <div className="flex-1 flex flex-col gap-1">
              <Progress
                value={phase === "prep" ? ((10 - countdown) / 10) * 100 : progress}
                className="h-1"
                indicatorClassName={phase === "prep" ? "bg-amber-500" : phase === "error" ? "bg-red-500" : "bg-blue-500"}
              />
              <span className="text-[10px] text-muted-foreground">
                {phase === "prep" && en.testRunner.listening.prepTime(countdown)}
                {phase === "playing" && en.testRunner.listening.inProgress}
                {phase === "done" && en.testRunner.listening.finished}
                {phase === "error" && en.testRunner.listening.loadError}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setMuted(m => !m)}
                className="text-muted-foreground hover:text-white transition-colors"
              >
                <VolumeIcon weight="bold" className="size-3.5" />
              </button>
              <Slider
                min={0}
                max={1}
                step={0.01}
                value={[muted ? 0 : volume]}
                onValueChange={([v]) => { setVolume(v); setMuted(v === 0); }}
                className="w-20 [&_.bg-secondary]:bg-neutral-700 [&_.bg-primary]:bg-blue-500 [&_[role=slider]]:h-3 [&_[role=slider]]:w-3 [&_[role=slider]]:border-blue-500"
              />
              <span className="text-[10px] text-muted-foreground w-6 text-right">{en.testRunner.listening.volumePercent(Math.round(effectiveVolume * 100))}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
