import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Slider } from "@/components/ui/slider";
import { BookOpen, CheckCircle, Play, SpeakerHigh, SpeakerLow, SpeakerNone, SpeakerSlash, TextAlignLeft, XCircle } from "@phosphor-icons/react";
import { saveAnswer, submitAttempt, forceSubmitAttempt, type TestDetail } from "@/lib/api";
import { toast } from "sonner";
import { QuestionInputWrapper } from "./question-inputs";
import { useNav } from "@/hooks/use-nav";
import en from "@/locales/en";

type ListeningPhase = "idle" | "prep" | "playing" | "done" | "error";
type ReadingPhase = "idle" | "reading";

const getKindDurationMinutes = (test: TestDetail, kind: "listening" | "reading") => {
  const byKind = (test as { durationMinutesByKind?: Partial<Record<"listening" | "reading", number>> })
    .durationMinutesByKind;
  const fromByKind = byKind?.[kind];
  if (typeof fromByKind === "number") return fromByKind;

  const section = test.sections.find((s) => s.kind === kind && typeof s.durationMinutes === "number");
  if (section && typeof section.durationMinutes === "number") return section.durationMinutes;
  return null;
};

export function ExamRunner({
  test, attemptId, initialResponses, onExit, onSubmitted, onListeningStart, onReadingStart, onSectionFinish, onTimerFinish, readOnly = false,
}: {
  test: TestDetail;
  attemptId: string;
  initialResponses: Record<string, string | null>;
  onExit: () => void;
  onSubmitted: (scoreTotal: number, band: number | null) => void;
  onListeningStart?: (durationMinutes: number) => void;
  onReadingStart?: (durationMinutes: number) => void;
  onSectionFinish?: () => void;
  onTimerFinish?: (submit: () => void) => void;
  readOnly?: boolean;
}) {
  const sections = useMemo(() => [...test.sections], [test.sections]);
  const [activeSectionId, setActiveSectionId] = useState(sections[0]?.id ?? "");
  const [listeningPhase, setListeningPhase] = useState<ListeningPhase>("idle");
  const [readingPhase, setReadingPhase] = useState<ReadingPhase>("idle");
  const audioErrorHandled = useRef(false);
  const [submittedSections, setSubmittedSections] = useState<Set<string>>(new Set());
  const [answers, setAnswers] = useState<Record<string, string | null>>(initialResponses ?? {});
  const [submitting, startSubmit] = useTransition();
  const { setActiveAttemptId } = useNav();

  useEffect(() => {
    setActiveAttemptId(attemptId);
    return () => setActiveAttemptId(null);
  }, [attemptId, setActiveAttemptId]);
  const saveTimers = useRef<Record<string, number>>({});

  const activeSection = sections.find((s) => s.id === activeSectionId) ?? sections[0];
  const questions = activeSection?.questions ?? [];

  const answeredCount = useMemo(
    () => Object.values(answers).filter((v) => v !== null && v !== "").length,
    [answers]
  );
  const totalQuestions = useMemo(
    () => test.sections.reduce((sum, s) => sum + s.questions.length, 0),
    [test.sections]
  );

  const isAttemptInProgress = !readOnly && !!activeSection;

  useEffect(() => {
    if (readOnly) return;
    if (listeningPhase !== "error") return;
    if (audioErrorHandled.current) return;
    audioErrorHandled.current = true;
    toast.error(en.examRunner.listening.audioUnavailable);
    onExit();
  }, [listeningPhase, readOnly, onExit]);

  // Fire-and-forget on unload -- do NOT call e.preventDefault() in Tauri, it blocks the window from closing
  useEffect(() => {
    if (!isAttemptInProgress) return;
    const handler = () => forceSubmitAttempt(attemptId);
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isAttemptInProgress, attemptId]);

  const onAnswerChange = useCallback((questionId: string, value: string | null) => {
    if (readOnly) return;
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    if (saveTimers.current[questionId]) window.clearTimeout(saveTimers.current[questionId]);
    saveTimers.current[questionId] = window.setTimeout(() => {
      saveAnswer(attemptId, questionId, value).catch(() => undefined);
    }, 400);
  }, [attemptId, readOnly]);

  const activeSectionQuestions = questions;
  const activeSectionAnsweredCount = activeSectionQuestions.filter(
    (q) => answers[q.id] !== null && answers[q.id] !== "" && answers[q.id] !== undefined
  ).length;
  const activeSectionFullyAnswered = activeSectionAnsweredCount === activeSectionQuestions.length && activeSectionQuestions.length > 0;
  const isLastSection = sections[sections.length - 1]?.id === activeSectionId;
  const listeningSections = sections.filter((s) => s.kind === "listening");
  const readingSections = sections.filter((s) => s.kind === "reading");
  const isLastListeningSection = listeningSections[listeningSections.length - 1]?.id === activeSectionId;
  const listeningSubmitted = listeningSections.length === 0 || listeningSections.every((s) => submittedSections.has(s.id));

  const flushPending = useCallback(async (questionIds?: string[]) => {
    const ids = questionIds ?? Object.keys(saveTimers.current);
    for (const qId of ids) {
      if (saveTimers.current[qId]) { window.clearTimeout(saveTimers.current[qId]); delete saveTimers.current[qId]; }
    }
    if (ids.length) await Promise.all(ids.map((qId) => saveAnswer(attemptId, qId, answers[qId] ?? null)));
  }, [attemptId, answers]);

  const submitSection = useCallback(() => {
    startSubmit(async () => {
      try {
        await flushPending();
        setSubmittedSections((prev) => new Set([...prev, activeSectionId]));
        const nextIdx = sections.findIndex((s) => s.id === activeSectionId) + 1;
        if (sections[nextIdx]) {
          setActiveSectionId(sections[nextIdx].id);
          onSectionFinish?.();
          return;
        }
        const res = await submitAttempt(attemptId);
        onSubmitted(res.attempt.scoreTotal, res.attempt.band);
      } finally {}
    });
  }, [activeSectionId, flushPending, sections, onSectionFinish, attemptId, onSubmitted]);

  const flushPendingAnswers = useCallback(() => flushPending(), [flushPending]);

  const submitTest = useCallback(() => {
    startSubmit(async () => {
      try {
        await flushPendingAnswers();
        const res = await submitAttempt(attemptId);
        onSubmitted(res.attempt.scoreTotal, res.attempt.band);
      } finally {}
    });
  }, [attemptId, onSubmitted, flushPendingAnswers]);

  useEffect(() => {
    if (!onTimerFinish || readOnly) return;
    // Timer should finish only the current part, not the entire section group
    if (activeSection) {
      onTimerFinish(submitSection);
    }
  }, [onTimerFinish, submitSection, activeSection, readOnly]);

  return (
    <div className="flex h-full gap-4 p-4 overflow-hidden">
      <Card className="w-64 shrink-0 border-neutral-800 bg-neutral-900">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-semibold flex items-center gap-2">
            <BookOpen weight="bold" className="size-3.5" />
            {test.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-muted-foreground">{en.examRunner.progress}</span>
            <Progress value={(answeredCount / Math.max(1, totalQuestions)) * 100} className="h-1" indicatorClassName="bg-emerald-500" />
            <span className="text-[10px] text-muted-foreground">{en.examRunner.answered(answeredCount, totalQuestions)}</span>
          </div>
          <Separator className="bg-neutral-800" />
          <Tabs value={activeSectionId} onValueChange={(id) => {
              const current = sections.find((s) => s.id === activeSectionId);
              if (!readOnly && current?.kind === "listening" && listeningPhase !== "done" && listeningPhase !== "error") return;
              if (submittedSections.has(activeSectionId) || readOnly) { setActiveSectionId(id); return; }
              return;
            }}>
            <TabsList className="flex flex-col h-auto bg-transparent p-0 gap-3">
              {listeningSections.length > 0 && (
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{en.examRunner.kinds.listening}</span>
                  {listeningSections.map((section, idx) => {
                    const isSubmitted = submittedSections.has(section.id);
                    const isActive = section.id === activeSectionId;
                    const isAccessible = readOnly || isSubmitted || isActive;
                    const listeningLocked = !readOnly && activeSection?.kind === "listening" && listeningPhase !== "done" && listeningPhase !== "error";
                    return (
                      <TabsTrigger
                        key={section.id}
                        value={section.id}
                        disabled={(!isActive && listeningLocked) || !isAccessible}
                        className="w-full justify-between text-xs data-[state=active]:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <div className="flex flex-col items-start">
                          <span className="text-left">{en.examRunner.tabs.part(idx + 1)}</span>
                          <span className="text-[10px] text-muted-foreground truncate max-w-[160px]">{section.title}</span>
                        </div>
                        {isSubmitted && <CheckCircle weight="bold" className="size-3 text-emerald-500 shrink-0" />}
                      </TabsTrigger>
                    );
                  })}
                </div>
              )}
              {readingSections.length > 0 && (
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{en.examRunner.kinds.reading}</span>
                  {readingSections.map((section, idx) => {
                    const isSubmitted = submittedSections.has(section.id);
                    const isActive = section.id === activeSectionId;
                    let isAccessible = readOnly || isSubmitted || isActive;
                    if (!readOnly && !listeningSubmitted) isAccessible = false;
                    return (
                      <TabsTrigger
                        key={section.id}
                        value={section.id}
                        disabled={!isAccessible}
                        className="w-full justify-between text-xs data-[state=active]:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <div className="flex flex-col items-start">
                          <span className="text-left">{en.examRunner.tabs.passage(idx + 1)}</span>
                          <span className="text-[10px] text-muted-foreground truncate max-w-[160px]">{section.title}</span>
                        </div>
                        {isSubmitted && <CheckCircle weight="bold" className="size-3 text-emerald-500 shrink-0" />}
                      </TabsTrigger>
                    );
                  })}
                </div>
              )}
            </TabsList>
          </Tabs>
          <Separator className="bg-neutral-800" />
          {isAttemptInProgress ? (
             <AlertDialog>
               <AlertDialogTrigger asChild>
                 <Button variant="outline" size="sm" className="border-neutral-700 hover:bg-neutral-800">
                  <XCircle weight="bold" className="size-3" /> {en.examRunner.exit}
                 </Button>
               </AlertDialogTrigger>
               <AlertDialogContent className="border-neutral-800 bg-neutral-950">
                 <AlertDialogHeader>
                  <AlertDialogTitle className="text-sm">{en.examRunner.submitExitTitle}</AlertDialogTitle>
                   <AlertDialogDescription className="text-xs">
                    {en.examRunner.submitExitDesc}
                   </AlertDialogDescription>
                 </AlertDialogHeader>
                 <AlertDialogFooter>
                  <AlertDialogCancel className="text-xs">{en.examRunner.cancel}</AlertDialogCancel>
                  <AlertDialogAction className="text-xs bg-red-600 hover:bg-red-700" onClick={async (e) => { e.preventDefault(); await flushPendingAnswers(); submitTest(); }}>
                    {en.examRunner.submitExitAction}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <Button variant="outline" size="sm" className="border-neutral-700" onClick={onExit}>
              <XCircle weight="bold" className="size-3" /> {en.examRunner.exit}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="flex-1 border-neutral-800 bg-neutral-900 overflow-hidden flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between shrink-0">
          <div>
            <CardTitle className="text-sm font-semibold">{activeSection?.title}</CardTitle>
            <p className="text-xs text-muted-foreground capitalize">{activeSection?.kind}</p>
          </div>
          <div className="flex gap-2">
            {!readOnly && !submittedSections.has(activeSectionId) && (
              isLastSection ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" disabled={submitting || !activeSectionFullyAnswered}>
                      <CheckCircle weight="bold" className="size-3" /> {en.examRunner.submitTest}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="border-neutral-800 bg-neutral-950">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-sm">{en.examRunner.submitTestTitle}</AlertDialogTitle>
                      <AlertDialogDescription className="text-xs">
                        {en.examRunner.submitTestDesc}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="border-neutral-700 text-xs">{en.examRunner.cancel}</AlertDialogCancel>
                      <AlertDialogAction className="text-xs" onClick={submitTest}>{en.examRunner.submit}</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : activeSection?.kind === "listening" ? (
                isLastListeningSection ? (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" disabled={submitting || !activeSectionFullyAnswered}>
                        <CheckCircle weight="bold" className="size-3" /> {en.examRunner.finishListening}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="border-neutral-800 bg-neutral-950">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-sm">{en.examRunner.listeningDoneTitle}</AlertDialogTitle>
                        <AlertDialogDescription className="text-xs">
                          {en.examRunner.listeningDoneDesc}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="border-neutral-700 text-xs">{en.examRunner.goBack}</AlertDialogCancel>
                        <AlertDialogAction className="text-xs" onClick={submitSection}>{en.examRunner.continue}</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : (
                  <Button size="sm" disabled={submitting || !activeSectionFullyAnswered} onClick={submitSection}>
                    <CheckCircle weight="bold" className="size-3" /> {en.examRunner.nextPart}
                  </Button>
                )
              ) : (
                <Button size="sm" disabled={submitting || !activeSectionFullyAnswered} onClick={submitSection}>
                  <CheckCircle weight="bold" className="size-3" /> {activeSection?.kind === "reading" ? en.examRunner.nextPassage : en.examRunner.nextSection}
                </Button>
              )
            )}
          </div>
        </CardHeader>
        <CardContent className="flex-1 p-0 overflow-hidden min-h-0">
          {activeSection?.kind === "listening" ? (
            <ListeningSection
              audioUrl={activeSection.audioUrl ?? null}
              questions={questions}
              answers={answers}
              onAnswerChange={onAnswerChange}
              readOnly={readOnly}
              phase={listeningPhase}
              onPhaseChange={async (p) => {
                const duration = getKindDurationMinutes(test, "listening") ?? test.durationMinutes;
                if (p === "prep") {
                  onListeningStart?.(duration); 
                }
                setListeningPhase(p);
              }}
            />
          ) : activeSection?.kind === "reading" && activeSection.passage ? (
            <ReadingSection
              passage={activeSection.passage}
              passageTitle={activeSection.passageTitle ?? undefined}
              questions={questions}
              answers={answers}
              onAnswerChange={onAnswerChange}
              readOnly={readOnly}
              phase={readingPhase}
              onPhaseChange={setReadingPhase}
              onReadingStart={() => {
                const duration = getKindDurationMinutes(test, "reading") ?? test.durationMinutes;
                onReadingStart?.(duration);
              }}
            />
          ) : (
            <ScrollArea className="h-full px-4 pb-4">
              <div className="flex flex-col gap-4">
                {questions.map((q, idx) => <QuestionCard key={q.id} question={q} idx={idx} answers={answers} onAnswerChange={onAnswerChange} readOnly={readOnly} />)}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ReadingSection({
  passage, passageTitle, questions, answers, onAnswerChange, readOnly, phase, onPhaseChange, onReadingStart,
}: {
  passage: string;
  passageTitle?: string;
  questions: TestDetail["sections"][number]["questions"];
  answers: Record<string, string | null>;
  onAnswerChange: (id: string, value: string | null) => void;
  readOnly: boolean;
  phase: ReadingPhase;
  onPhaseChange: (phase: ReadingPhase) => void;
  onReadingStart?: () => void;
}) {
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
              <span className="text-sm font-semibold">{en.examRunner.reading.title}</span>
              <span className="text-xs text-muted-foreground">{en.examRunner.reading.subtitle}</span>
            </div>
            <Button variant="outline" className="gap-2 border-neutral-700" onClick={() => { onPhaseChange("reading"); onReadingStart?.(); }}>
              <Play weight="bold" className="size-4" /> {en.examRunner.reading.start}
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
                  <p className="text-sm font-semibold text-white">{passageTitle ?? en.examRunner.reading.passageLabel}</p>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setFontSize(s => Math.max(10, s - 1))} className="size-5 flex items-center justify-center rounded text-muted-foreground hover:text-white hover:bg-neutral-800 transition-colors text-xs font-bold">{en.examRunner.reading.fontDecrease}</button>
                    <button onClick={() => setFontSize(s => Math.min(20, s + 1))} className="size-5 flex items-center justify-center rounded text-muted-foreground hover:text-white hover:bg-neutral-800 transition-colors text-sm font-bold">{en.examRunner.reading.fontIncrease}</button>
                  </div>
                </div>
                <div className="text-neutral-300 leading-relaxed whitespace-pre-wrap" style={{ fontSize }}>{passage}</div>
              </div>
            </ScrollArea>
            <ScrollArea className="w-1/2 h-full">
              <div className="flex flex-col gap-4 p-4">
                {questions.map((q, idx) => <QuestionCard key={q.id} question={q} idx={idx} answers={answers} onAnswerChange={onAnswerChange} readOnly={readOnly} />)}
              </div>
            </ScrollArea>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ListeningSection({
  audioUrl, questions, answers, onAnswerChange, readOnly, phase, onPhaseChange,
}: {
  audioUrl: string | null;
  questions: TestDetail["sections"][number]["questions"];
  answers: Record<string, string | null>;
  onAnswerChange: (id: string, value: string | null) => void;
  readOnly: boolean;
  phase: ListeningPhase;
  onPhaseChange: (phase: ListeningPhase) => void;
}) {
  const questionsVisible = readOnly || phase === "playing" || phase === "done";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {!readOnly && <ListeningPlayer audioUrl={audioUrl} phase={phase} onPhaseChange={onPhaseChange} />}
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
                {questions.map((q, idx) => <QuestionCard key={q.id} question={q} idx={idx} answers={answers} onAnswerChange={onAnswerChange} readOnly={readOnly} />)}
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
            {en.examRunner.listening.questionsWait}
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

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

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
              <span className="text-sm font-semibold">{en.examRunner.listening.title}</span>
              <span className="text-xs text-muted-foreground">{en.examRunner.listening.prep}</span>
            </div>
            <Button variant="outline" className="gap-2 border-neutral-700" onClick={handleStart}>
              <Play weight="bold" className="size-4" /> {en.examRunner.listening.start}
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
              {phase === "prep" && <><SpeakerHigh weight="bold" className="size-3" /> {en.examRunner.listening.startingIn(countdown)}</>}
              {phase === "playing" && <><SpeakerHigh weight="bold" className="size-3 animate-pulse" /> {en.examRunner.listening.playing}</>}
              {phase === "done" && <><SpeakerHigh weight="bold" className="size-3" /> {en.examRunner.listening.done}</>}
              {phase === "error" && <><XCircle weight="bold" className="size-3" /> {en.examRunner.listening.audioUnavailable}</>}
            </Button>
            <div className="flex-1 flex flex-col gap-1">
              <Progress
                value={phase === "prep" ? ((10 - countdown) / 10) * 100 : progress}
                className="h-1"
                indicatorClassName={phase === "prep" ? "bg-amber-500" : phase === "error" ? "bg-red-500" : "bg-blue-500"}
              />
              <span className="text-[10px] text-muted-foreground">
                {phase === "prep" && en.examRunner.listening.prepTime(countdown)}
                {phase === "playing" && en.examRunner.listening.inProgress}
                {phase === "done" && en.examRunner.listening.finished}
                {phase === "error" && en.examRunner.listening.loadError}
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
              <span className="text-[10px] text-muted-foreground w-6 text-right">{en.examRunner.listening.volumePercent(Math.round(effectiveVolume * 100))}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

const typeLabels: Record<string, string> = en.examRunner.typeLabels;

function QuestionCard({ question, idx, answers, onAnswerChange, readOnly }: {
  question: TestDetail["sections"][number]["questions"][number];
  idx: number;
  answers: Record<string, string | null>;
  onAnswerChange: (id: string, value: string | null) => void;
  readOnly: boolean;
}) {
  const correct = question.correctAnswer != null
    ? Array.isArray(question.correctAnswer)
      ? question.correctAnswer.map(s => s.toLowerCase())
      : [String(question.correctAnswer).toLowerCase()]
    : null;
  const rawValue = answers[question.id];
  const isMultiBlank = Array.isArray(question.correctAnswer) && typeof rawValue === "string" && (rawValue as string).startsWith("[");
  const isMultiSelect = question.type === "multiple-choice-multiple";
  let isCorrect: boolean | null = null;
  if (correct !== null) {
    if (isMultiSelect) {
      try {
        const given: string[] = JSON.parse(rawValue as string);
        const correctSet = new Set(correct);
        isCorrect = given.length === correctSet.size && given.every(g => correctSet.has(g.toLowerCase().trim()));
      } catch { isCorrect = false; }
    } else if (isMultiBlank) {
      try {
        const given: string[] = JSON.parse(rawValue as string);
        isCorrect = Array.isArray(question.correctAnswer) && question.correctAnswer.every((c, i) => c.toLowerCase() === (given[i] ?? "").toLowerCase().trim());
      } catch { isCorrect = false; }
    } else {
      const given = String(rawValue ?? "").toLowerCase().trim();
      isCorrect = correct.includes(given);
    }
  }

  return (
    <Card className="border-neutral-800 bg-neutral-950">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-xs font-semibold">{en.examRunner.question.label(idx + 1)} {question.prompt}</CardTitle>
          <span className="text-[10px] text-muted-foreground bg-neutral-800 px-1.5 py-0.5 rounded shrink-0">{typeLabels[question.type] ?? question.type}</span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <QuestionInputWrapper question={question} value={answers[question.id] ?? ""} onChange={(v) => onAnswerChange(question.id, v)} readOnly={readOnly} />
        {readOnly && isCorrect !== null && (
          <div className="flex flex-col gap-1 pt-1 border-t border-neutral-800">
            <span className={`text-[10px] font-semibold flex items-center gap-1 ${isCorrect ? "text-emerald-400" : "text-red-400"}`}>
              {isCorrect ? <><CheckCircle weight="bold" className="size-3" /> {en.examRunner.question.correct}</> : <><XCircle weight="bold" className="size-3" /> {en.examRunner.question.incorrect}</>}
            </span>
            {!isCorrect && (
              <span className="text-[10px] text-muted-foreground">
                {en.examRunner.question.correctAnswer} <span className="text-white">{Array.isArray(question.correctAnswer) && isMultiBlank ? question.correctAnswer.join(" / ") : Array.isArray(question.correctAnswer) ? question.correctAnswer.join(" or ") : question.correctAnswer}</span>
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

