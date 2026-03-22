import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  BookOpen,
  ClockCountdown,
  Trophy,
  ArrowRight,
  Play,
  SpinnerGap,
  Headphones,
} from "@phosphor-icons/react";
import {
  listTests,
  startTest,
  getAttempt,
  type AssignmentAttemptDetail,
  type TestSummary,
} from "@/lib/api";
import { ExamRunner } from "@/components/exam-runner";
import { toast } from "sonner";
import en from "@/locales/en";

type Status = "not-started" | "in-progress" | "completed";

const statusConfig: Record<Status, { label: string; className: string }> = {
  "not-started": {
    label: en.tests.status.notStarted,
    className: "border-neutral-700 text-muted-foreground",
  },
  "in-progress": {
    label: en.tests.status.inProgress,
    className: "border-amber-800 text-amber-400",
  },
  completed: {
    label: en.tests.status.completed,
    className: "border-emerald-800 text-emerald-400",
  },
};

function getStatus(test: TestSummary): Status {
  return (test.attempt?.status ?? "not-started") as Status;
}

function TestCard({
  test,
  onOpen,
}: {
  test: TestSummary;
  onOpen: (test: TestSummary) => void;
}) {
  const status = getStatus(test);
  const cfg = statusConfig[status];
  return (
    <Card className="rounded-xl border-neutral-800 bg-neutral-900 hover:border-neutral-700 transition-colors">
      <CardContent className="px-4 py-3 flex flex-col gap-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold">{test.title}</span>
            <div className="flex items-center gap-1.5">
              <ClockCountdown
                weight="bold"
                className="size-3 text-muted-foreground"
              />
              <span className="text-[10px] text-muted-foreground">
                {test.durationMinutes} min
              </span>
            </div>
            <div className="text-[10px] text-muted-foreground">
              {test.sectionsCount} sections · {test.questionsCount} questions
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0 ${cfg.className}`}
            >
              {cfg.label}
            </Badge>
            {test.attempt?.band != null && (
              <span className="flex items-center gap-1 text-xs font-bold">
                <Trophy weight="bold" className="size-3 text-amber-400" />
                {test.attempt.band}
              </span>
            )}
          </div>
        </div>

        {status === "completed" && test.attempt?.band != null && (
          <Progress
            value={(test.attempt.band / 9) * 100}
            className="h-1"
            indicatorClassName="bg-emerald-500"
          />
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {status === "completed" && test.attempt?.band != null ? (
              <>
                {test.attempt.listeningBand != null && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex items-center gap-0.5 text-[10px] text-sky-400 font-semibold">
                        <Headphones weight="bold" className="size-3" />
                        {test.attempt.listeningBand}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="text-xs">
                      Listening band
                    </TooltipContent>
                  </Tooltip>
                )}
                {test.attempt.readingBand != null && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex items-center gap-0.5 text-[10px] text-violet-400 font-semibold">
                        <BookOpen weight="bold" className="size-3" />
                        {test.attempt.readingBand}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="text-xs">
                      Reading band
                    </TooltipContent>
                  </Tooltip>
                )}
              </>
            ) : (
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-neutral-800/50 text-neutral-600">
                No score yet
              </span>
            )}
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="xs"
                variant={status === "not-started" ? "outline" : "ghost"}
                className="shrink-0 gap-1"
                onClick={() => onOpen(test)}
              >
                {status === "not-started" ? (
                  <>
                    <Play weight="bold" className="size-3" />{" "}
                    {en.tests.actions.start}
                  </>
                ) : status === "in-progress" ? (
                  <>
                    <ArrowRight weight="bold" className="size-3" />{" "}
                    {en.tests.actions.continue}
                  </>
                ) : (
                  <>
                    <BookOpen weight="bold" className="size-3" />{" "}
                    {en.tests.actions.review}
                  </>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" className="text-xs">
              {status === "not-started"
                ? "Start this test"
                : status === "in-progress"
                  ? "Continue where you left off"
                  : "Review your answers and score"}
            </TooltipContent>
          </Tooltip>
        </div>
      </CardContent>
    </Card>
  );
}

function TestDialog({
  test,
  open,
  onClose,
  onStart,
  timerActive,
}: {
  test: TestSummary | null;
  open: boolean;
  onClose: () => void;
  onStart: (test: TestSummary) => void;
  timerActive: boolean;
}) {
  if (!test) return null;
  const status = getStatus(test);
  const cfg = statusConfig[status];
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm border-neutral-800 bg-neutral-950 rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <BookOpen weight="bold" className="size-4 text-muted-foreground" />
            {test.title}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2 pt-1">
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0 ${cfg.className}`}
            >
              {cfg.label}
            </Badge>
            {test.attempt?.band != null && (
              <span className="flex items-center gap-1 text-xs font-semibold text-white">
                <Trophy weight="bold" className="size-3 text-amber-400" /> Band{" "}
                {test.attempt.band}
              </span>
            )}
            {test.attempt?.listeningBand != null && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-0.5 text-xs font-semibold text-sky-400">
                    <Headphones weight="bold" className="size-3" />
                    {test.attempt.listeningBand}
                  </span>
                </TooltipTrigger>
                <TooltipContent className="text-xs">
                  Listening band
                </TooltipContent>
              </Tooltip>
            )}
            {test.attempt?.readingBand != null && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-0.5 text-xs font-semibold text-violet-400">
                    <BookOpen weight="bold" className="size-3" />
                    {test.attempt.readingBand}
                  </span>
                </TooltipTrigger>
                <TooltipContent className="text-xs">
                  Reading band
                </TooltipContent>
              </Tooltip>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <ClockCountdown weight="bold" className="size-3.5" />
            <span>{en.tests.dialog.minutesTotal(test.durationMinutes)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <BookOpen weight="bold" className="size-3.5" />
            <span>{test.sectionsCount} sections</span>
          </div>
        </div>

        {status === "completed" && (
          <p className="text-xs text-muted-foreground">
            This test is completed. You can review your answers but cannot
            retake it.
          </p>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            className="border-neutral-700"
            onClick={onClose}
          >
            {en.tests.dialog.cancel}
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                tabIndex={timerActive && status !== "completed" ? 0 : undefined}
              >
                <Button
                  size="sm"
                  className="gap-1.5"
                  disabled={timerActive && status !== "completed"}
                  onClick={() => {
                    onStart(test);
                    onClose();
                  }}
                >
                  {status === "not-started" ? (
                    <>
                      <Play weight="bold" className="size-3" />{" "}
                      {en.tests.dialog.startTest}
                    </>
                  ) : status === "in-progress" ? (
                    <>
                      <ArrowRight weight="bold" className="size-3" />{" "}
                      {en.tests.actions.continue}
                    </>
                  ) : (
                    <>
                      <BookOpen weight="bold" className="size-3" />{" "}
                      {en.tests.actions.review}
                    </>
                  )}
                </Button>
              </span>
            </TooltipTrigger>
            {timerActive && status !== "completed" && (
              <TooltipContent side="top" className="text-xs">
                A test is already in progress
              </TooltipContent>
            )}
          </Tooltip>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function Tests({
  onStartTest,
  onStopTest,
  timerActive,
}: {
  onStartTest: (name: string, seconds: number) => void;
  onStopTest: () => void;
  timerActive: boolean;
}) {
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [selected, setSelected] = useState<TestSummary | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tests, setTests] = useState<TestSummary[]>([]);
  const [activeAttempt, setActiveAttempt] =
    useState<AssignmentAttemptDetail | null>(null);
  const submitRef = useRef<(() => void) | null>(null);
  const wasTimerActive = useRef(false);
  const registerSubmit = useCallback((submit: () => void) => {
    submitRef.current = submit;
  }, []);

  useEffect(() => {
    // only auto-submit if the timer transitioned from active to inactive
    if (
      wasTimerActive.current &&
      !timerActive &&
      activeAttempt &&
      activeAttempt.attempt.status === "in-progress"
    ) {
      submitRef.current?.();
    }
    wasTimerActive.current = timerActive;
  }, [timerActive, activeAttempt]);

  const refresh = async () => {
    const res = await listTests();
    setTests(res.tests);
  };

  useEffect(() => {
    refresh()
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, []);

  const open = (test: TestSummary) => {
    setSelected(test);
    setDialogOpen(true);
  };
  const filtered =
    filter === "all" ? tests : tests.filter((t) => getStatus(t) === filter);
  const completed = tests.filter(
    (t) => t.attempt?.status === "completed",
  ).length;
  const bands = tests
    .map((t) => t.attempt?.band)
    .filter((b): b is number => b != null);
  const avgBand = bands.length
    ? +(bands.reduce((a, b) => a + b, 0) / bands.length).toFixed(2)
    : null;

  const handleStart = async (test: TestSummary) => {
    try {
      const status = getStatus(test);
      // If there's an existing attempt (in-progress or completed), just load it
      if (status !== "not-started" && test.attempt) {
        const detail = await getAttempt(test.attempt.id);
        setActiveAttempt(detail);
        return;
      }
      // Otherwise, start a new one
      const res = await startTest(test.id);
      const detail = await getAttempt(res.attempt.id);
      setActiveAttempt(detail);
      // timer starts only when user clicks Start Listening — see onListeningStart below
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to start test");
    }
  };

  return (
    <AnimatePresence>
      {activeAttempt ? (
        <motion.div
          key={activeAttempt.attempt.id}
          initial={{ opacity: 0, scale: 0.98, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: -8 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className="h-full"
        >
          <ExamRunner
            test={activeAttempt.test}
            attemptId={activeAttempt.attempt.id}
            initialResponses={activeAttempt.responses ?? {}}
            listeningStartedAt={activeAttempt.attempt.listeningStartedAt}
            readingStartedAt={activeAttempt.attempt.readingStartedAt}
            readOnly={activeAttempt.attempt.status === "completed"}
            onListeningStart={(sectionDurationMinutes) =>
              onStartTest(
                "Listening",
                sectionDurationMinutes * 60,
              )
            }
            onReadingStart={(sectionDurationMinutes) =>
              onStartTest(
                "Reading",
                sectionDurationMinutes * 60,
              )
            }
            onSectionFinish={onStopTest}
            onTimerFinish={registerSubmit}
            onExit={() => {
              setActiveAttempt(null);
              if (activeAttempt.attempt.status !== "completed") onStopTest();
            }}
            onSubmitted={async () => {
              await refresh().catch(() => undefined);
              setActiveAttempt(null);
              onStopTest();
              toast.success("Test submitted");
            }}
          />
        </motion.div>
      ) : (
        <motion.div
          key="list"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15, ease: "easeInOut" }}
        >
          <div className="p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen
                  weight="bold"
                  className="size-4 text-muted-foreground"
                />
                <span className="text-sm font-semibold">{en.tests.title}</span>
              </div>
              <Select
                value={filter}
                onValueChange={(v) => setFilter(v as "all" | Status)}
              >
                <SelectTrigger className="h-8 w-36 text-xs border-neutral-800 bg-neutral-900">
                  <SelectValue placeholder={en.tests.filter.placeholder} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">
                    {en.tests.filter.all}
                  </SelectItem>
                  <SelectItem value="not-started" className="text-xs">
                    {en.tests.filter.notStarted}
                  </SelectItem>
                  <SelectItem value="in-progress" className="text-xs">
                    {en.tests.filter.inProgress}
                  </SelectItem>
                  <SelectItem value="completed" className="text-xs">
                    {en.tests.filter.completed}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Card className="rounded-xl border-neutral-800 bg-neutral-900">
                <CardContent className="px-3 py-2.5 flex flex-col gap-0.5">
                  <span className="text-[10px] text-muted-foreground">
                    {en.tests.summary.completed}
                  </span>
                  <span className="text-xl font-bold">
                    {completed}
                    <span className="text-sm text-muted-foreground">
                      /{tests.length}
                    </span>
                  </span>
                </CardContent>
              </Card>
              <Card className="rounded-xl border-neutral-800 bg-neutral-900">
                <CardContent className="px-3 py-2.5 flex flex-col gap-0.5">
                  <span className="text-[10px] text-muted-foreground">
                    {en.tests.summary.avgBand}
                  </span>
                  <span className="text-xl font-bold flex items-center gap-1">
                    <Trophy weight="bold" className="size-3.5 text-amber-400" />
                    {avgBand ?? "-"}
                  </span>
                </CardContent>
              </Card>
              <Card className="rounded-xl border-neutral-800 bg-neutral-900">
                <CardContent className="px-3 py-2.5 flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">
                      {en.tests.summary.progress}
                    </span>
                    <span className="text-[10px] font-semibold">
                      {tests.length
                        ? Math.round((completed / tests.length) * 100)
                        : 0}
                      %
                    </span>
                  </div>
                  <Progress
                    value={tests.length ? (completed / tests.length) * 100 : 0}
                    className="h-1.5 mt-1"
                    indicatorClassName="bg-emerald-500"
                  />
                </CardContent>
              </Card>
            </div>

            <ScrollArea className="w-full" type="scroll">
              <div className="grid gap-3">
                {loading ? (
                  <Card className="rounded-xl border-neutral-800 bg-neutral-900">
                    <CardContent className="px-4 py-6 flex items-center gap-2 text-xs text-muted-foreground">
                      <SpinnerGap className="size-4 animate-spin" /> Loading
                      tests...
                    </CardContent>
                  </Card>
                ) : filtered.length === 0 ? (
                  <div className="flex items-center justify-center py-10 text-xs text-muted-foreground">
                    {en.tests.noMatch}
                  </div>
                ) : (
                  filtered.map((test) => (
                    <TestCard key={test.id} test={test} onOpen={open} />
                  ))
                )}
              </div>
            </ScrollArea>

            <TestDialog
              test={selected}
              open={dialogOpen}
              onClose={() => setDialogOpen(false)}
              onStart={handleStart}
              timerActive={timerActive}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
