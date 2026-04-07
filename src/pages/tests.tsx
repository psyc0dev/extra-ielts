import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BookOpen, ClockCountdown, Trophy, ArrowRight, Play, Headphones } from "@phosphor-icons/react";
import { listTests, startTest, getAttempt, type AssignmentAttemptDetail, type TestSummary } from "@/lib/api";
import { useDelayedLoading } from "@/hooks/use-delayed-loading";
import { TestRunner } from "@/components/TestRunner";
import { toast } from "sonner";
import en from "@/locales/en";

type Status = "not-started" | "in-progress" | "completed";

const statusConfig: Record<Status, { label: string; className: string }> = {
  "not-started": { label: en.tests.status.notStarted, className: "border-neutral-700 text-muted-foreground" },
  "in-progress": { label: en.tests.status.inProgress, className: "border-amber-800 text-amber-400" },
  completed: { label: en.tests.status.completed, className: "border-emerald-800 text-emerald-400" },
};

function getStatus(test: TestSummary): Status {
  return (test.attempt?.status ?? "not-started") as Status;
}

function TestCardSkeleton() {
  return (
    <Card className="rounded-xl border-neutral-800 bg-neutral-900">
      <CardContent className="px-4 py-3 flex flex-col gap-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1.5 flex-1">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-2.5 w-1/3" />
            <Skeleton className="h-2.5 w-1/2" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <div className="flex justify-between items-center">
          <Skeleton className="h-5 w-20 rounded-md" />
          <Skeleton className="h-6 w-16 rounded-md" />
        </div>
      </CardContent>
    </Card>
  );
}

function TestCard({ test, onOpen }: { test: TestSummary; onOpen: (test: TestSummary) => void }) {
  const status = getStatus(test);
  const cfg = statusConfig[status];
  return (
    <Card className="rounded-xl border-neutral-800 bg-neutral-900 hover:border-neutral-700 transition-colors">
      <CardContent className="px-4 py-3 flex flex-col gap-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold">{test.title}</span>
            <div className="flex items-center gap-1.5">
              <ClockCountdown weight="bold" className="size-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">{test.durationMinutes} {en.tests.minutesSuffix}</span>
            </div>
            <div className="text-[10px] text-muted-foreground">{en.tests.details.sectionsQuestions(test.sectionsCount, test.questionsCount)}</div>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${cfg.className}`}>{cfg.label}</Badge>
            {test.attempt?.band != null && (
              <span className="flex items-center gap-1 text-xs font-bold">
                <Trophy weight="bold" className="size-3 text-amber-400" />{test.attempt.band}
              </span>
            )}
          </div>
        </div>
        {status === "completed" && test.attempt?.band != null && (
          <Progress value={(test.attempt.band / 9) * 100} className="h-1" indicatorClassName="bg-emerald-500" />
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {status === "completed" && test.attempt?.band != null ? (
              <>
                {test.attempt.listeningBand != null && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex items-center gap-0.5 text-[10px] text-sky-400 font-semibold">
                        <Headphones weight="bold" className="size-3" />{test.attempt.listeningBand}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="text-xs">{en.tests.details.listeningBand}</TooltipContent>
                  </Tooltip>
                )}
                {test.attempt.readingBand != null && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex items-center gap-0.5 text-[10px] text-violet-400 font-semibold">
                        <BookOpen weight="bold" className="size-3" />{test.attempt.readingBand}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="text-xs">{en.tests.details.readingBand}</TooltipContent>
                  </Tooltip>
                )}
              </>
            ) : (
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-neutral-800/50 text-neutral-600">{en.tests.details.noScore}</span>
            )}
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="xs" variant={status === "not-started" ? "outline" : "ghost"} className="shrink-0 gap-1" onClick={() => onOpen(test)}>
                {status === "not-started" ? <><Play weight="bold" className="size-3" /> {en.tests.actions.start}</>
                  : status === "in-progress" ? <><ArrowRight weight="bold" className="size-3" /> {en.tests.actions.continue}</>
                  : <><BookOpen weight="bold" className="size-3" /> {en.tests.actions.review}</>}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" className="text-xs">
              {status === "not-started" ? en.tests.details.tooltip.start : status === "in-progress" ? en.tests.details.tooltip.continue : en.tests.details.tooltip.review}
            </TooltipContent>
          </Tooltip>
        </div>
      </CardContent>
    </Card>
  );
}

function TestDialog({ test, open, onClose, onStart, timerActive }: {
  test: TestSummary | null; open: boolean; onClose: () => void; onStart: (test: TestSummary) => void; timerActive: boolean;
}) {
  if (!test) return null;
  const status = getStatus(test);
  const cfg = statusConfig[status];
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm border-neutral-800 bg-neutral-950 rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <BookOpen weight="bold" className="size-4 text-muted-foreground" />{test.title}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2 pt-1">
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${cfg.className}`}>{cfg.label}</Badge>
            {test.attempt?.band != null && (
              <span className="flex items-center gap-1 text-xs font-semibold text-white">
                <Trophy weight="bold" className="size-3 text-amber-400" />{en.tests.dialog.band(test.attempt.band)}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5"><ClockCountdown weight="bold" className="size-3.5" /><span>{en.tests.dialog.minutesTotal(test.durationMinutes)}</span></div>
          <div className="flex items-center gap-1.5"><BookOpen weight="bold" className="size-3.5" /><span>{`${test.sectionsCount} ${en.tests.dialog.sections.toLowerCase()}`}</span></div>
        </div>
        {status === "completed" && <p className="text-xs text-muted-foreground">{en.tests.details.completedNotice}</p>}
        <DialogFooter>
          <Button variant="outline" size="sm" className="border-neutral-700" onClick={onClose}>{en.tests.dialog.cancel}</Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={timerActive && status !== "completed" ? 0 : undefined}>
                <Button size="sm" className="gap-1.5" disabled={timerActive && status !== "completed"} onClick={() => { onStart(test); onClose(); }}>
                  {status === "not-started" ? <><Play weight="bold" className="size-3" /> {en.tests.dialog.startTest}</>
                    : status === "in-progress" ? <><ArrowRight weight="bold" className="size-3" /> {en.tests.actions.continue}</>
                    : <><BookOpen weight="bold" className="size-3" /> {en.tests.actions.review}</>}
                </Button>
              </span>
            </TooltipTrigger>
            {timerActive && status !== "completed" && <TooltipContent side="top" className="text-xs">{en.tests.details.timerActive}</TooltipContent>}
          </Tooltip>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function Tests({ onStartTest, onStopTest, timerActive }: {
  onStartTest: (name: string, seconds: number) => void; onStopTest: () => void; timerActive: boolean;
}) {
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [selected, setSelected] = useState<TestSummary | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const sk = useDelayedLoading(loading);
  const [tests, setTests] = useState<TestSummary[]>([]);
  const [activeAttempt, setActiveAttempt] = useState<AssignmentAttemptDetail | null>(null);
  const submitRef = useRef<(() => void) | null>(null);
  const wasTimerActive = useRef(false);
  const sectionFinishRef = useRef(false);
  const registerSubmit = useCallback((submit: () => void) => { submitRef.current = submit; }, []);

  useEffect(() => {
    if (wasTimerActive.current && !timerActive && activeAttempt && activeAttempt.attempt.status === "in-progress") {
      if (!sectionFinishRef.current) submitRef.current?.();
      sectionFinishRef.current = false;
    }
    wasTimerActive.current = timerActive;
  }, [timerActive, activeAttempt]);

  const refresh = async () => {
    const res = await listTests();
    setTests(res.tests.filter((t) => t.published !== false));
  };

  useEffect(() => {
    refresh().catch((err) => toast.error(err.message)).finally(() => setLoading(false));
  }, []);

  const open = (test: TestSummary) => { setSelected(test); setDialogOpen(true); };
  const filtered = filter === "all" ? tests : tests.filter((t) => getStatus(t) === filter);
  const completed = tests.filter((t) => t.attempt?.status === "completed").length;
  const bands = tests.map((t) => t.attempt?.band).filter((b): b is number => b != null);
  const avgBand = bands.length ? +(bands.reduce((a, b) => a + b, 0) / bands.length).toFixed(2) : null;

  const handleStart = async (test: TestSummary) => {
    try {
      const status = getStatus(test);
      if (status !== "not-started" && test.attempt) {
        const detail = await getAttempt(test.attempt.id);
        setActiveAttempt(detail);
        return;
      }
      const res = await startTest(test.id);
      const detail = await getAttempt(res.attempt.id);
      setActiveAttempt(detail);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : en.tests.errors.startFailed);
    }
  };

  return (
    <AnimatePresence>
      {activeAttempt ? (
        <motion.div key={activeAttempt.attempt.id} initial={{ opacity: 0, scale: 0.98, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98, y: -8 }} transition={{ duration: 0.2, ease: "easeInOut" }} className="h-full">
          <TestRunner
            test={activeAttempt.test}
            attemptId={activeAttempt.attempt.id}
            initialResponses={activeAttempt.responses ?? {}}
            correctness={activeAttempt.correctness}
            readOnly={activeAttempt.attempt.status === "completed"}
            onListeningStart={(d) => onStartTest(en.testRunner.kinds.listening, d * 60)}
            onReadingStart={(d) => onStartTest(en.testRunner.kinds.reading, d * 60)}
            onSectionFinish={() => { sectionFinishRef.current = true; onStopTest(); }}
            onTimerFinish={registerSubmit}
            onExit={() => { setActiveAttempt(null); if (activeAttempt.attempt.status !== "completed") onStopTest(); }}
            onSubmitted={async () => { await refresh().catch(() => undefined); setActiveAttempt(null); onStopTest(); toast.success(en.tests.submitted); }}
          />
        </motion.div>
      ) : (
        <motion.div key="list" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15, ease: "easeInOut" }}>
          <div className="p-5 flex flex-col gap-4 font-body">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: 0, ease: 'easeOut' as const }} className="relative overflow-hidden rounded-2xl border border-neutral-800 bg-[linear-gradient(135deg,rgba(6,95,70,0.2),rgba(15,23,42,0.9))] p-4">
              <div className="absolute inset-0 opacity-50 [background:radial-gradient(circle_at_top_right,rgba(59,130,246,0.2),transparent_55%)]" />
              <div className="relative flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <Badge variant="outline" className="border-emerald-400/40 text-emerald-200 self-start -ml-1.5">{en.tests.hero.badge}</Badge>
                  <h2 className="text-sm font-display tracking-wide">{en.tests.title}</h2>
                  <p className="text-xs text-muted-foreground">{en.tests.hero.subtitle}</p>
                </div>
                <div className="text-xs text-muted-foreground">{en.tests.summary.progress}: {tests.length ? Math.round((completed / tests.length) * 100) : 0}%</div>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: 0.06, ease: 'easeOut' as const }} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen weight="bold" className="size-4 text-muted-foreground" />
                <span className="text-sm font-semibold">{en.tests.title}</span>
              </div>
              <Select value={filter} onValueChange={(v) => setFilter(v as "all" | Status)}>
                <SelectTrigger className="h-8 w-36 text-xs border-neutral-800 bg-neutral-900">
                  <SelectValue placeholder={en.tests.filter.placeholder} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">{en.tests.filter.all}</SelectItem>
                  <SelectItem value="not-started" className="text-xs">{en.tests.filter.notStarted}</SelectItem>
                  <SelectItem value="in-progress" className="text-xs">{en.tests.filter.inProgress}</SelectItem>
                  <SelectItem value="completed" className="text-xs">{en.tests.filter.completed}</SelectItem>
                </SelectContent>
              </Select>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: 0.12, ease: 'easeOut' as const }} className="grid grid-cols-3 gap-3">
              {["completed", "avgBand", "progress"].map((key) => (
                <Card key={key} className="rounded-xl border-neutral-800 bg-neutral-900">
                  <CardContent className="px-3 py-2.5 flex flex-col gap-0.5">
                    <span className="text-[10px] text-muted-foreground">
                      {key === "completed" ? en.tests.summary.completed : key === "avgBand" ? en.tests.summary.avgBand : en.tests.summary.progress}
                    </span>
                    {sk ? (
                      key === "progress" ? (
                        <div className="flex flex-col gap-1 mt-0.5">
                          <Skeleton className="h-3 w-8" />
                          <Skeleton className="h-1.5 w-full rounded-full" />
                        </div>
                      ) : <Skeleton className="h-7 w-12 mt-0.5" />
                    ) : key === "completed" ? (
                      <span className="text-xl font-bold">{completed}<span className="text-sm text-muted-foreground">/{tests.length}</span></span>
                    ) : key === "avgBand" ? (
                      <span className="text-xl font-bold flex items-center gap-1"><Trophy weight="bold" className="size-3.5 text-amber-400" />{avgBand ?? en.common.na}</span>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between"><span className="text-[10px] font-semibold">{tests.length ? Math.round((completed / tests.length) * 100) : 0}%</span></div>
                        <Progress value={tests.length ? (completed / tests.length) * 100 : 0} className="h-1.5" indicatorClassName="bg-emerald-500" />
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: 0.18, ease: 'easeOut' as const }}>
            <ScrollArea className="w-full" type="scroll">
              <div className="grid gap-3">
                <AnimatePresence mode="wait" initial={false}>
                  {sk ? (
                    <motion.div key="sk" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="grid gap-3">
                      {Array.from({ length: 4 }).map((_, i) => <TestCardSkeleton key={i} />)}
                    </motion.div>
                  ) : (
                    <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className="grid gap-3">
                      {filtered.length === 0 ? (
                        <Card className="rounded-xl border-neutral-800 bg-neutral-900">
                          <CardContent className="px-4 py-3 flex flex-col gap-2.5">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex flex-col gap-1.5 flex-1">
                                <span className="text-xs font-medium text-neutral-400">{en.tests.noAvailable}</span>
                                <span className="text-[10px] text-neutral-600">{en.tests.noMatch}</span>
                              </div>
                              <BookOpen weight="bold" className="size-4 text-neutral-700 shrink-0 mt-0.5" />
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-neutral-800/50 text-neutral-600">{en.tests.details.noScore}</span>
                              <span className="text-[10px] text-neutral-700">—</span>
                            </div>
                          </CardContent>
                        </Card>
                      ) : filtered.map((test) => <TestCard key={test.id} test={test} onOpen={open} />)}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </ScrollArea>
            </motion.div>

            <TestDialog test={selected} open={dialogOpen} onClose={() => setDialogOpen(false)} onStart={handleStart} timerActive={timerActive} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
