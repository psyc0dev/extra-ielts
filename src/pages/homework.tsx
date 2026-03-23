import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { BookOpen, ClockCountdown, Trophy, ArrowRight, Play, SpinnerGap, Headphones, PencilLine, MicrophoneStage } from "@phosphor-icons/react";
import { ExamRunner } from "@/components/exam-runner";
import { getAttempt, listAssignments, startAssignment, type AssignmentAttemptDetail, type AssignmentSummary } from "@/lib/api";
import { useNav } from "@/hooks/use-nav";
import { toast } from "sonner";
import en from "@/locales/en";

type Status = "not-started" | "in-progress" | "completed";

const statusConfig: Record<Status, { label: string; className: string }> = {
  "not-started": { label: en.tests.status.notStarted, className: "border-neutral-700 text-muted-foreground" },
  "in-progress": { label: en.tests.status.inProgress, className: "border-amber-800 text-amber-400" },
  "completed": { label: en.tests.status.completed, className: "border-emerald-800 text-emerald-400" },
};

const sectionIcon: Record<string, React.ReactNode> = {
  listening: <Headphones weight="bold" className="size-3" />,
  reading: <BookOpen weight="bold" className="size-3" />,
  writing: <PencilLine weight="bold" className="size-3" />,
  speaking: <MicrophoneStage weight="bold" className="size-3" />,
};

function ScorePill({ score, label }: { score: number | null; label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md flex items-center gap-1 ${score !== null ? "bg-neutral-800 text-white" : "bg-neutral-800/50 text-neutral-600"}`}>
          {sectionIcon[label.toLowerCase()] ?? null}
          {score ?? en.homework.scoreEmpty}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">
        <span className="capitalize">{label}: {score ?? en.tests.dialog.notAttempted}</span>
      </TooltipContent>
    </Tooltip>
  );
}

function HomeworkCard({ assignment, status, onOpen }: { assignment: AssignmentSummary; status: Status; onOpen: (assignment: AssignmentSummary) => void }) {
  const cfg = statusConfig[status];
  const isPastDue = assignment.dueAt != null && new Date(assignment.dueAt) < new Date() && status !== "completed";
  
  return (
    <Card className="rounded-xl border-neutral-800 bg-neutral-900 hover:border-neutral-700 transition-colors">
      <CardContent className="px-4 py-3 flex flex-col gap-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold">{assignment.title}</span>
            <div className="flex items-center gap-1.5">
              <ClockCountdown weight="bold" className="size-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">
                {assignment.durationMinutes} {en.homework.minutesSuffix}
                {assignment.dueAt ? ` · ${en.homework.dueLabel} ${new Date(assignment.dueAt).toLocaleDateString()}` : ""}
              </span>
            </div>
            <div className="text-[10px] text-muted-foreground capitalize">
              {en.homework.sectionsLabel}: {assignment.sectionKinds.join(", ")}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${cfg.className}`}>{cfg.label}</Badge>
            {isPastDue && <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-red-800 text-red-400">{en.homework.expired}</Badge>}
            {assignment.attempt?.band != null && (
              <span className="flex items-center gap-1 text-xs font-bold">
                <Trophy weight="bold" className="size-3 text-amber-400" />
                {assignment.attempt.band}
              </span>
            )}
          </div>
        </div>

        {status === "completed" && assignment.attempt?.band != null && (
          <Progress value={(assignment.attempt.band / 9) * 100} className="h-1" indicatorClassName="bg-emerald-500" />
        )}

        <div className="flex items-center justify-between">
          <div className="flex gap-1.5 flex-wrap">
            {assignment.sectionKinds.map(kind => (
              <ScorePill key={kind} label={kind} score={assignment.attempt?.status === "completed" ? (assignment.attempt?.band ?? null) : null} />
            ))}
          </div>
          <Button
            size="xs"
            variant={status === "not-started" ? "outline" : "ghost"}
            className="shrink-0 gap-1"
            disabled={isPastDue}
            onClick={() => onOpen(assignment)}
          >
            {status === "not-started" ? (
              <><Play weight="bold" className="size-3" /> {en.tests.actions.start}</>
            ) : status === "in-progress" ? (
              <><ArrowRight weight="bold" className="size-3" /> {en.tests.actions.continue}</>
            ) : (
              <><BookOpen weight="bold" className="size-3" /> {en.tests.actions.review}</>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function HomeworkDialog({
  assignment,
  open,
  onClose,
  onStart,
  onContinue,
  timerActive,
}: {
  assignment: AssignmentSummary | null;
  open: boolean;
  onClose: () => void;
  onStart: (assignment: AssignmentSummary) => void;
  onContinue: (assignment: AssignmentSummary) => void;
  timerActive: boolean;
}) {
  if (!assignment) return null;
  const status = (assignment.attempt?.status ?? "not-started") as Status;
  const cfg = statusConfig[status];
  const isPastDue = assignment.dueAt != null && new Date(assignment.dueAt) < new Date() && status !== "completed";
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm border-neutral-800 bg-neutral-950 rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <BookOpen weight="bold" className="size-4 text-muted-foreground" />
            {assignment.title}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2 pt-1">
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${cfg.className}`}>{cfg.label}</Badge>
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <ClockCountdown weight="bold" className="size-3.5" />
            <span>{en.tests.dialog.minutesTotal(assignment.durationMinutes)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <BookOpen weight="bold" className="size-3.5" />
            <span>{assignment.sectionKinds.join(" + ")}</span>
          </div>
        </div>

        {isPastDue && (
          <p className="text-xs text-red-400">{en.homework.pastDueMessage}</p>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" className="border-neutral-700" onClick={onClose}>{en.tests.dialog.cancel}</Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={timerActive && status !== "completed" ? 0 : undefined}>
                <Button
                  size="sm"
                  className="gap-1.5"
                  disabled={isPastDue || (timerActive && status !== "completed")}
                  onClick={() => {
                    if (status === "not-started") onStart(assignment);
                    else onContinue(assignment);
                    onClose();
                  }}
                >
                  {status === "not-started" ? <><Play weight="bold" className="size-3" /> {en.tests.dialog.startTest}</> :
                   status === "in-progress" ? <><ArrowRight weight="bold" className="size-3" /> {en.tests.actions.continue}</> :
                   <><BookOpen weight="bold" className="size-3" /> {en.tests.actions.review}</>}
                </Button>
              </span>
            </TooltipTrigger>
            {timerActive && status !== "completed" && (
              <TooltipContent side="top" className="text-xs">
                {en.tests.details.timerActive}
              </TooltipContent>
            )}
          </Tooltip>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function Homework({
  onStartTest,
  onStopTest,
  timerActive,
}: {
  onStartTest: (name: string, seconds: number) => void;
  onStopTest: () => void;
  timerActive: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<AssignmentSummary[]>([]);
  const [activeAttempt, setActiveAttempt] = useState<AssignmentAttemptDetail | null>(null);
  const [selected, setSelected] = useState<AssignmentSummary | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const submitRef = useRef<(() => void) | null>(null);
  const wasTimerActive = useRef(false);
  const sectionFinishRef = useRef(false);
  const registerSubmit = useCallback((submit: () => void) => {
    submitRef.current = submit;
  }, []);

  const { pendingId, clearPendingId } = useNav();

  useEffect(() => {
    if (
      wasTimerActive.current &&
      !timerActive &&
      activeAttempt &&
      activeAttempt.attempt.status === "in-progress"
    ) {
      if (!sectionFinishRef.current) {
        submitRef.current?.();
      }
      sectionFinishRef.current = false;
    }
    wasTimerActive.current = timerActive;
  }, [timerActive, activeAttempt]);

  useEffect(() => {
    if (!pendingId || assignments.length === 0) return;
    const match = assignments.find(a => a.id === pendingId);
    if (match) { setSelected(match); setDialogOpen(true); clearPendingId(); }
  }, [pendingId, assignments]);

  useEffect(() => {
    const load = async () => {
      const res = await listAssignments("homework");
      setAssignments(res.assignments);
      setLoading(false);
    };
    load().catch((err) => {
      toast.error(err.message);
      setLoading(false);
    });
  }, []);

  const open = (assignment: AssignmentSummary) => { setSelected(assignment); setDialogOpen(true); };

  const refresh = async () => {
    const res = await listAssignments("homework");
    setAssignments(res.assignments);
  };

  if (activeAttempt) {
    return (
      <ExamRunner
        test={activeAttempt.test}
        attemptId={activeAttempt.attempt.id}
        initialResponses={activeAttempt.responses}
        readOnly={activeAttempt.attempt.status === "completed"}
        onListeningStart={(sectionDurationMinutes) =>
          onStartTest(en.examRunner.kinds.listening, sectionDurationMinutes * 60)
        }
        onReadingStart={(sectionDurationMinutes) =>
          onStartTest(en.examRunner.kinds.reading, sectionDurationMinutes * 60)
        }
        onSectionFinish={() => { sectionFinishRef.current = true; onStopTest(); }}
        onTimerFinish={registerSubmit}
        onExit={() => {
          setActiveAttempt(null);
          if (activeAttempt.attempt.status !== "completed") onStopTest();
        }}
        onSubmitted={() => {
          setActiveAttempt(null);
          refresh().catch(() => undefined);
          onStopTest();
          toast.success(en.homework.submitted);
        }}
        />
    );
  }

  return (
    <TooltipProvider>
      <div className="p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <BookOpen weight="bold" className="size-4 text-muted-foreground" />
          <span className="text-sm font-semibold">{en.homework.title}</span>
        </div>

        <ScrollArea className="w-full" type="scroll">
          <div className="grid gap-3">
            {loading ? (
              <Card className="rounded-xl border-neutral-800 bg-neutral-900">
                <CardContent className="px-4 py-6 flex items-center gap-2 text-xs text-muted-foreground">
                  <SpinnerGap className="size-4 animate-spin" /> {en.homework.loading}
                </CardContent>
              </Card>
            ) : assignments.length === 0 ? (
              <div className="flex items-center justify-center py-10 text-xs text-muted-foreground">
                {en.homework.empty}
              </div>
            ) : (
              assignments.map((assignment) => (
                <HomeworkCard
                  key={assignment.id}
                  assignment={assignment}
                  status={(assignment.attempt?.status ?? "not-started") as Status}
                  onOpen={open}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      <HomeworkDialog
        assignment={selected}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        timerActive={timerActive}
        onStart={async (assignment) => {
          const attemptRes = await startAssignment(assignment.id);
          const detail = await getAttempt(attemptRes.attempt.id);
          setActiveAttempt(detail);
        }}
        onContinue={async (assignment) => {
          if (!assignment.attempt) return;
          const detail = await getAttempt(assignment.attempt.id);
          setActiveAttempt(detail);
        }}
      />
    </TooltipProvider>
  );
}
