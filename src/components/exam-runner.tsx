import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Slider } from "@/components/ui/slider";
import { BookOpen, CheckCircle, Play, SpeakerHigh, SpeakerLow, SpeakerNone, SpeakerSlash, TextAlignLeft, XCircle } from "@phosphor-icons/react";
import { saveAnswer, submitAttempt, type TestDetail } from "@/lib/api";

type ListeningPhase = "idle" | "prep" | "playing" | "done" | "error";
type ReadingPhase = "idle" | "reading";

const kindLabels: Record<string, string> = { listening: "Listening", reading: "Reading" };
function formatLabel(kind: string, index: number) {
  return `${kindLabels[kind] ?? kind} ${index + 1}`;
}

export function ExamRunner({
  test, attemptId, initialResponses, onExit, onSubmitted, onListeningStart, readOnly = false,
}: {
  test: TestDetail;
  attemptId: string;
  initialResponses: Record<string, unknown>;
  onExit: () => void;
  onSubmitted: (scoreTotal: number, band: number | null) => void;
  onListeningStart?: () => void;
  readOnly?: boolean;
}) {
  const sections = useMemo(() => [...test.sections], [test.sections]);
  const [activeSectionId, setActiveSectionId] = useState(sections[0]?.id ?? "");
  const [listeningPhase, setListeningPhase] = useState<ListeningPhase>("idle");
  const [readingPhase, setReadingPhase] = useState<ReadingPhase>("idle");
  const [submittedSections, setSubmittedSections] = useState<Set<string>>(new Set());
  const [answers, setAnswers] = useState<Record<string, unknown>>(initialResponses ?? {});
  const [submitting, startSubmit] = useTransition();
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

  const onAnswerChange = useCallback((questionId: string, value: unknown) => {
    if (readOnly) return;
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    if (saveTimers.current[questionId]) window.clearTimeout(saveTimers.current[questionId]);
    saveTimers.current[questionId] = window.setTimeout(() => {
      saveAnswer(attemptId, questionId, value ?? null).catch(() => undefined);
    }, 400);
  }, [attemptId, readOnly]);

  const activeSectionQuestions = questions;
  const activeSectionAnsweredCount = activeSectionQuestions.filter(
    (q) => answers[q.id] !== null && answers[q.id] !== "" && answers[q.id] !== undefined
  ).length;
  const activeSectionFullyAnswered = activeSectionAnsweredCount === activeSectionQuestions.length && activeSectionQuestions.length > 0;
  const isLastSection = sections[sections.length - 1]?.id === activeSectionId;

  const submitSection = useCallback(() => {
    startSubmit(async () => {
      try {
        await Promise.all(activeSectionQuestions.map((q) => saveAnswer(attemptId, q.id, answers[q.id] ?? null)));
        setSubmittedSections((prev) => new Set([...prev, activeSectionId]));
        const nextIdx = sections.findIndex((s) => s.id === activeSectionId) + 1;
        if (sections[nextIdx]) setActiveSectionId(sections[nextIdx].id);
      } finally {}
    });
  }, [activeSectionId, activeSectionQuestions, answers, attemptId, sections]);

  const submitTest = useCallback(() => {
    startSubmit(async () => {
      try {
        const allQuestions = test.sections.flatMap((s) => s.questions);
        await Promise.all(allQuestions.map((q) => saveAnswer(attemptId, q.id, answers[q.id] ?? null)));
        const res = await submitAttempt(attemptId);
        onSubmitted(res.attempt.scoreTotal, res.attempt.band);
      } finally {}
    });
  }, [attemptId, onSubmitted, answers, test.sections]);

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
            <span className="text-[10px] text-muted-foreground">Progress</span>
            <Progress value={(answeredCount / Math.max(1, totalQuestions)) * 100} className="h-1" indicatorClassName="bg-emerald-500" />
            <span className="text-[10px] text-muted-foreground">{answeredCount}/{totalQuestions} answered</span>
          </div>
          <Separator className="bg-neutral-800" />
          <Tabs value={activeSectionId} onValueChange={(id) => {
              const current = sections.find((s) => s.id === activeSectionId);
              if (!readOnly && current?.kind === "listening" && listeningPhase !== "done" && listeningPhase !== "error") return;
              if (submittedSections.has(activeSectionId) || readOnly) { setActiveSectionId(id); return; }
              return;
            }}>
            <TabsList className="flex flex-col h-auto bg-transparent p-0 gap-2">
              {sections.map((section, idx) => {
                const listeningLocked = !readOnly && section.kind !== "listening" && listeningPhase !== "done" && listeningPhase !== "error";
                const isSubmitted = submittedSections.has(section.id);
                const isActive = section.id === activeSectionId;
                const isAccessible = readOnly || isSubmitted || isActive;
                return (
                  <TabsTrigger key={section.id} value={section.id} disabled={listeningLocked || (!isAccessible)} className="w-full justify-start text-xs data-[state=active]:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed">
                    <span className="flex-1 text-left">{formatLabel(section.kind, idx)}</span>
                    {isSubmitted && <CheckCircle weight="bold" className="size-3 text-emerald-500 shrink-0" />}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
          <Separator className="bg-neutral-800" />
          <Button variant="outline" size="sm" className="border-neutral-700" onClick={onExit}>
            <XCircle weight="bold" className="size-3" /> Exit
          </Button>
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
                      <CheckCircle weight="bold" className="size-3" /> Submit Test
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="border-neutral-800 bg-neutral-950">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-sm">Submit test?</AlertDialogTitle>
                      <AlertDialogDescription className="text-xs">
                        You cannot go back or change your answers after submitting. This action is final.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="border-neutral-700 text-xs">Cancel</AlertDialogCancel>
                      <AlertDialogAction className="text-xs" onClick={submitTest}>Submit</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : activeSection?.kind === "listening" ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" disabled={submitting || !activeSectionFullyAnswered}>
                      <CheckCircle weight="bold" className="size-3" /> Submit Section
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="border-neutral-800 bg-neutral-950">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-sm">Done with listening?</AlertDialogTitle>
                      <AlertDialogDescription className="text-xs">
                        You cannot return to the listening section once you continue. Make sure all your answers are final.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="border-neutral-700 text-xs">Go back</AlertDialogCancel>
                      <AlertDialogAction className="text-xs" onClick={submitSection}>Continue</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : (
                <Button size="sm" disabled={submitting || !activeSectionFullyAnswered} onClick={submitSection}>
                  <CheckCircle weight="bold" className="size-3" /> Submit Section
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
              onPhaseChange={(p) => {
                if (p === "prep") onListeningStart?.();
                setListeningPhase(p);
              }}
            />
          ) : activeSection?.kind === "reading" && activeSection.passage ? (
            <ReadingSection
              passage={activeSection.passage}
              questions={questions}
              answers={answers}
              onAnswerChange={onAnswerChange}
              readOnly={readOnly}
              phase={readingPhase}
              onPhaseChange={setReadingPhase}
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
  passage, questions, answers, onAnswerChange, readOnly, phase, onPhaseChange,
}: {
  passage: string;
  questions: TestDetail["sections"][number]["questions"];
  answers: Record<string, unknown>;
  onAnswerChange: (id: string, value: unknown) => void;
  readOnly: boolean;
  phase: ReadingPhase;
  onPhaseChange: (phase: ReadingPhase) => void;
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
              <span className="text-sm font-semibold">Reading Section</span>
              <span className="text-xs text-muted-foreground">Read the passage and answer the questions.</span>
            </div>
            <Button variant="outline" className="gap-2 border-neutral-700" onClick={() => onPhaseChange("reading")}>
              <Play weight="bold" className="size-4" /> Start Reading
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
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Reading Passage</p>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setFontSize(s => Math.max(10, s - 1))} className="size-5 flex items-center justify-center rounded text-muted-foreground hover:text-white hover:bg-neutral-800 transition-colors text-xs font-bold">A−</button>
                    <button onClick={() => setFontSize(s => Math.min(20, s + 1))} className="size-5 flex items-center justify-center rounded text-muted-foreground hover:text-white hover:bg-neutral-800 transition-colors text-sm font-bold">A+</button>
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
  answers: Record<string, unknown>;
  onAnswerChange: (id: string, value: unknown) => void;
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
            Questions will appear once the audio starts playing.
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
              <span className="text-sm font-semibold">Listening Section</span>
              <span className="text-xs text-muted-foreground">You will have 10 seconds to prepare before the audio begins.</span>
            </div>
            <Button variant="outline" className="gap-2 border-neutral-700" onClick={handleStart}>
              <Play weight="bold" className="size-4" /> Start Listening
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
              {phase === "prep" && <><SpeakerHigh weight="bold" className="size-3" /> Starting in {countdown}s</>}
              {phase === "playing" && <><SpeakerHigh weight="bold" className="size-3 animate-pulse" /> Playing...</>}
              {phase === "done" && <><SpeakerHigh weight="bold" className="size-3" /> Done</>}
              {phase === "error" && <><XCircle weight="bold" className="size-3" /> Audio unavailable</>}
            </Button>
            <div className="flex-1 flex flex-col gap-1">
              <Progress
                value={phase === "prep" ? ((10 - countdown) / 10) * 100 : progress}
                className="h-1"
                indicatorClassName={phase === "prep" ? "bg-amber-500" : phase === "error" ? "bg-red-500" : "bg-blue-500"}
              />
              <span className="text-[10px] text-muted-foreground">
                {phase === "prep" && `Preparation time: ${countdown}s remaining`}
                {phase === "playing" && "Listening in progress — answer the questions"}
                {phase === "done" && "Audio finished"}
                {phase === "error" && "Could not load audio file"}
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
              <span className="text-[10px] text-muted-foreground w-6 text-right">{Math.round(effectiveVolume * 100)}%</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

const typeLabels: Record<string, string> = {
  mcq: "Multiple Choice",
  short: "Short Answer",
  essay: "Essay",
  "fill-blank": "Fill in the Blank",
  "true-false-notgiven": "True / False / Not Given",
  "yes-no-notgiven": "Yes / No / Not Given",
  "match-headings": "Match Headings",
  matching: "Matching",
  "sentence-completion": "Sentence Completion",
  "note-completion": "Note Completion",
  "table-completion": "Table Completion",
  "diagram-labelling": "Diagram Labelling",
};

function QuestionCard({ question, idx, answers, onAnswerChange, readOnly }: {
  question: TestDetail["sections"][number]["questions"][number];
  idx: number;
  answers: Record<string, unknown>;
  onAnswerChange: (id: string, value: unknown) => void;
  readOnly: boolean;
}) {
  const correct = question.correctAnswer != null
    ? Array.isArray(question.correctAnswer)
      ? question.correctAnswer.map(s => s.toLowerCase())
      : [String(question.correctAnswer).toLowerCase()]
    : null;
  const rawValue = answers[question.id];
  const isMultiBlank = Array.isArray(question.correctAnswer) && typeof rawValue === "string" && (rawValue as string).startsWith("[");
  let isCorrect: boolean | null = null;
  if (correct !== null) {
    if (isMultiBlank) {
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
          <CardTitle className="text-xs font-semibold">Q{idx + 1}. {question.prompt}</CardTitle>
          <span className="text-[10px] text-muted-foreground bg-neutral-800 px-1.5 py-0.5 rounded shrink-0">{typeLabels[question.type] ?? question.type}</span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <QuestionInput question={question} value={answers[question.id] ?? ""} onChange={(v) => onAnswerChange(question.id, v)} readOnly={readOnly} />
        {readOnly && isCorrect !== null && (
          <div className="flex flex-col gap-1 pt-1 border-t border-neutral-800">
            <span className={`text-[10px] font-semibold flex items-center gap-1 ${isCorrect ? "text-emerald-400" : "text-red-400"}`}>
              {isCorrect ? <><CheckCircle weight="bold" className="size-3" /> Correct</> : <><XCircle weight="bold" className="size-3" /> Incorrect</>}
            </span>
            {!isCorrect && (
              <span className="text-[10px] text-muted-foreground">
                Correct answer: <span className="text-white">{Array.isArray(question.correctAnswer) && isMultiBlank ? question.correctAnswer.join(" / ") : Array.isArray(question.correctAnswer) ? question.correctAnswer.join(" or ") : question.correctAnswer}</span>
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function QuestionInput({ question, value, onChange, readOnly }: {
  question: TestDetail["sections"][number]["questions"][number];
  value: unknown;
  onChange: (value: unknown) => void;
  readOnly: boolean;
}) {
  const isChoice = question.type === "mcq" || question.type === "true-false-notgiven" || question.type === "yes-no-notgiven" || question.type === "match-headings" || question.type === "matching";
  if (isChoice) {
    return (
      <RadioGroup value={String(value ?? "")} onValueChange={onChange} className="flex flex-col gap-2" disabled={readOnly}>
        {(question.options ?? []).map((option) => (
          <label key={option} className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <RadioGroupItem value={option} />
            {option}
          </label>
        ))}
      </RadioGroup>
    );
  }
  if (question.type === "fill-blank" || question.type === "short" || question.type === "sentence-completion" || question.type === "diagram-labelling") {
    return <Input value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} placeholder="Type your answer" className="text-xs" readOnly={readOnly} />;
  }
  if (question.type === "note-completion" || question.type === "table-completion") {
    const expected = Array.isArray(question.correctAnswer) ? question.correctAnswer : [question.correctAnswer ?? ""];
    const stored = (() => { try { return JSON.parse(String(value ?? "[]")); } catch { return []; } })();
    const parts = Array.isArray(stored) ? stored : [];
    return (
      <div className="flex flex-col gap-2">
        {expected.map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-4 shrink-0">{i + 1}.</span>
            <Input
              value={String(parts[i] ?? "")}
              onChange={(e) => {
                const next = [...parts];
                next[i] = e.target.value;
                onChange(JSON.stringify(next));
              }}
              placeholder={`Answer ${i + 1}`}
              className="text-xs"
              readOnly={readOnly}
            />
          </div>
        ))}
      </div>
    );
  }
  return <Textarea value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} rows={6} className="text-xs" placeholder="Write your response" readOnly={readOnly} />;
}
