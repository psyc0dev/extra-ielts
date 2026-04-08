import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { BookOpen, CheckCircle, XCircle } from "@phosphor-icons/react";
import { saveAnswer, submitAttempt, forceSubmitAttempt, type TestDetail } from "@/lib/api";
import { toast } from "sonner";
import { QuestionInputWrapper } from "./QuestionInputs";
import { ListeningSection, type ListeningPhase } from "./test-runner/listening";
import { ReadingSection, type ReadingPhase } from "./test-runner/reading";
import { useNav } from "@/hooks/use-nav";
import en from "@/locales/en";

const getKindDurationMinutes = (test: TestDetail, kind: "listening" | "reading") => {
  const byKind = (test as { durationMinutesByKind?: Partial<Record<"listening" | "reading", number>> })
    .durationMinutesByKind;
  const fromByKind = byKind?.[kind];
  if (typeof fromByKind === "number") return fromByKind;

  const section = test.sections.find((s) => s.kind === kind && typeof s.durationMinutes === "number");
  if (section && typeof section.durationMinutes === "number") return section.durationMinutes;
  return null;
};

export function TestRunner({
  test, attemptId, initialResponses, correctness, onExit, onSubmitted, onListeningStart, onReadingStart, onSectionFinish, onTimerFinish, readOnly = false,
}: {
  test: TestDetail;
  attemptId: string;
  initialResponses: Record<string, string | null>;
  correctness?: Record<string, boolean>;
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

  useEffect(() => {
    setListeningPhase("idle");
  }, [activeSectionId]);

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
    toast.error(en.testRunner.listening.audioUnavailable);
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

  const renderQuestionCard = useCallback((
    question: TestDetail["sections"][number]["questions"][number],
    idx: number
  ) => (
    <QuestionCard
      key={question.id}
      question={question}
      idx={idx}
      answers={answers}
      isCorrect={correctness ? (correctness[question.id] ?? null) : null}
      onAnswerChange={onAnswerChange}
      readOnly={readOnly}
    />
  ), [answers, correctness, onAnswerChange, readOnly]);

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
            <span className="text-[10px] text-muted-foreground">{en.testRunner.progress}</span>
            <Progress value={(answeredCount / Math.max(1, totalQuestions)) * 100} className="h-1" indicatorClassName="bg-emerald-500" />
            <span className="text-[10px] text-muted-foreground">{en.testRunner.answered(answeredCount, totalQuestions)}</span>
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
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{en.testRunner.kinds.listening}</span>
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
                          <span className="text-left">{en.testRunner.tabs.part(idx + 1)}</span>
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
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{en.testRunner.kinds.reading}</span>
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
                          <span className="text-left">{en.testRunner.tabs.passage(idx + 1)}</span>
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
                  <XCircle weight="bold" className="size-3" /> {en.testRunner.exit}
                 </Button>
               </AlertDialogTrigger>
               <AlertDialogContent className="border-neutral-800 bg-neutral-950">
                 <AlertDialogHeader>
                  <AlertDialogTitle className="text-sm">{en.testRunner.submitExitTitle}</AlertDialogTitle>
                   <AlertDialogDescription className="text-xs">
                    {en.testRunner.submitExitDesc}
                   </AlertDialogDescription>
                 </AlertDialogHeader>
                 <AlertDialogFooter>
                  <AlertDialogCancel className="text-xs">{en.testRunner.cancel}</AlertDialogCancel>
                  <AlertDialogAction className="text-xs bg-red-600 hover:bg-red-700" onClick={async (e) => { e.preventDefault(); await flushPendingAnswers(); submitTest(); }}>
                    {en.testRunner.submitExitAction}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <Button variant="outline" size="sm" className="border-neutral-700" onClick={onExit}>
              <XCircle weight="bold" className="size-3" /> {en.testRunner.exit}
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
                      <CheckCircle weight="bold" className="size-3" /> {en.testRunner.submitTest}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="border-neutral-800 bg-neutral-950">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-sm">{en.testRunner.submitTestTitle}</AlertDialogTitle>
                      <AlertDialogDescription className="text-xs">
                        {en.testRunner.submitTestDesc}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="border-neutral-700 text-xs">{en.testRunner.cancel}</AlertDialogCancel>
                      <AlertDialogAction className="text-xs" onClick={submitTest}>{en.testRunner.submit}</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : activeSection?.kind === "listening" ? (
                isLastListeningSection ? (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" disabled={submitting || !activeSectionFullyAnswered}>
                        <CheckCircle weight="bold" className="size-3" /> {en.testRunner.finishListening}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="border-neutral-800 bg-neutral-950">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-sm">{en.testRunner.listeningDoneTitle}</AlertDialogTitle>
                        <AlertDialogDescription className="text-xs">
                          {en.testRunner.listeningDoneDesc}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="border-neutral-700 text-xs">{en.testRunner.goBack}</AlertDialogCancel>
                        <AlertDialogAction className="text-xs" onClick={submitSection}>{en.testRunner.continue}</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : (
                  <Button size="sm" disabled={submitting || !activeSectionFullyAnswered} onClick={submitSection}>
                    <CheckCircle weight="bold" className="size-3" /> {en.testRunner.nextPart}
                  </Button>
                )
              ) : (
                <Button size="sm" disabled={submitting || !activeSectionFullyAnswered} onClick={submitSection}>
                  <CheckCircle weight="bold" className="size-3" /> {activeSection?.kind === "reading" ? en.testRunner.nextPassage : en.testRunner.nextSection}
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
              readOnly={readOnly}
              phase={listeningPhase}
              onPhaseChange={async (p) => {
                const duration = getKindDurationMinutes(test, "listening") ?? test.durationMinutes;
                if (p === "prep") {
                  onListeningStart?.(duration); 
                }
                setListeningPhase(p);
              }}
              renderQuestion={renderQuestionCard}
            />
          ) : activeSection?.kind === "reading" && activeSection.passage ? (
            <ReadingSection
              passage={activeSection.passage}
              passageTitle={activeSection.passageTitle ?? undefined}
              questions={questions}
              readOnly={readOnly}
              phase={readingPhase}
              onPhaseChange={setReadingPhase}
              onReadingStart={() => {
                const duration = getKindDurationMinutes(test, "reading") ?? test.durationMinutes;
                onReadingStart?.(duration);
              }}
              renderQuestion={renderQuestionCard}
            />
          ) : (
            <ScrollArea className="h-full px-4 pb-4">
              <div className="flex flex-col gap-4">
                {questions.map(renderQuestionCard)}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const typeLabels: Record<string, string> = en.testRunner.typeLabels;

function QuestionCard({ question, idx, answers, isCorrect, onAnswerChange, readOnly }: {
  question: TestDetail["sections"][number]["questions"][number];
  idx: number;
  answers: Record<string, string | null>;
  isCorrect: boolean | null;
  onAnswerChange: (id: string, value: string | null) => void;
  readOnly: boolean;
}) {

  return (
    <Card className="border-neutral-800 bg-neutral-950">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-xs font-semibold">{en.testRunner.question.label(idx + 1)} {question.prompt}</CardTitle>
          <span className="text-[10px] text-muted-foreground bg-neutral-800 px-1.5 py-0.5 rounded shrink-0">{typeLabels[question.type] ?? question.type}</span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <QuestionInputWrapper question={question} value={answers[question.id] ?? ""} onChange={(v) => onAnswerChange(question.id, v)} readOnly={readOnly} />
        {readOnly && isCorrect !== null && (
          <div className="flex flex-col gap-1 pt-1 border-t border-neutral-800">
            <span className={`text-[10px] font-semibold flex items-center gap-1 ${isCorrect ? "text-emerald-400" : "text-red-400"}`}>
              {isCorrect ? <><CheckCircle weight="bold" className="size-3" /> {en.testRunner.question.correct}</> : <><XCircle weight="bold" className="size-3" /> {en.testRunner.question.incorrect}</>}
            </span>
            {!isCorrect && (
              <span className="text-[10px] text-muted-foreground">
                {en.testRunner.question.correctAnswer} <span className="text-white">{Array.isArray(question.correctAnswer) ? question.correctAnswer.join(" / ") : question.correctAnswer}</span>
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

