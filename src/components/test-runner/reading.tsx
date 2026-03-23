import { useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Play, TextAlignLeft } from "@phosphor-icons/react";
import type { TestDetail } from "@/lib/api";
import en from "@/locales/en";

export type ReadingPhase = "idle" | "reading";

type ReadingSectionProps = {
  passage: string;
  passageTitle?: string;
  questions: TestDetail["sections"][number]["questions"];
  readOnly: boolean;
  phase: ReadingPhase;
  onPhaseChange: (phase: ReadingPhase) => void;
  onReadingStart?: () => void;
  renderQuestion: (question: TestDetail["sections"][number]["questions"][number], idx: number) => ReactNode;
};

export function ReadingSection({
  passage,
  passageTitle,
  questions,
  readOnly,
  phase,
  onPhaseChange,
  onReadingStart,
  renderQuestion,
}: ReadingSectionProps) {
  const [fontSize, setFontSize] = useState(12);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <AnimatePresence mode="wait">
        {phase === "idle" && !readOnly ? (
          <motion.div
            key="idle"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            className="flex-1 flex flex-col items-center justify-center gap-4"
          >
            <TextAlignLeft weight="bold" className="size-8 text-muted-foreground" />
            <div className="flex flex-col items-center gap-1">
              <span className="text-sm font-semibold">{en.testRunner.reading.title}</span>
              <span className="text-xs text-muted-foreground">{en.testRunner.reading.subtitle}</span>
            </div>
            <Button variant="outline" className="gap-2 border-neutral-700" onClick={() => { onPhaseChange("reading"); onReadingStart?.(); }}>
              <Play weight="bold" className="size-4" /> {en.testRunner.reading.start}
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="reading"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            className="flex flex-1 min-h-0 overflow-hidden"
          >
            <ScrollArea className="w-1/2 h-full border-r border-neutral-800">
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-white">{passageTitle ?? en.testRunner.reading.passageLabel}</p>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setFontSize(s => Math.max(10, s - 1))} className="size-5 flex items-center justify-center rounded text-muted-foreground hover:text-white hover:bg-neutral-800 transition-colors text-xs font-bold">{en.testRunner.reading.fontDecrease}</button>
                    <button onClick={() => setFontSize(s => Math.min(20, s + 1))} className="size-5 flex items-center justify-center rounded text-muted-foreground hover:text-white hover:bg-neutral-800 transition-colors text-sm font-bold">{en.testRunner.reading.fontIncrease}</button>
                  </div>
                </div>
                <div className="text-neutral-300 leading-relaxed whitespace-pre-wrap" style={{ fontSize }}>{passage}</div>
              </div>
            </ScrollArea>
            <ScrollArea className="w-1/2 h-full">
              <div className="flex flex-col gap-4 p-4">
                {questions.map(renderQuestion)}
              </div>
            </ScrollArea>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
