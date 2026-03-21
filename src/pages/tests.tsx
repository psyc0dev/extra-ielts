import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { BookOpen, ClockCountdown, Trophy, MicrophoneStage, Headphones, PencilLine, ArrowRight, Play, Lock } from "@phosphor-icons/react";
import en from "@/locales/en";

type Status = "not-started" | "in-progress" | "completed";
type FilterStatus = "all" | Status;

interface SectionScore {
  label: string;
  score: number | null;
}

interface Test {
  id: string;
  name: string;
  status: Status;
  band: number | null;
  sections: SectionScore[];
  duration: number;
  questions: number;
}

interface Book {
  id: string;
  label: string;
  tests: Test[];
}

const makeTest = (
  id: string,
  name: string,
  status: Status,
  scores: (number | null)[]
): Test => ({
  id,
  name,
  status,
  band: scores.every(s => s !== null) ? +(scores.reduce((a, b) => a! + b!, 0)! / 4).toFixed(2) : null,
  sections: [
    { label: "Listening", score: scores[0] },
    { label: "Reading", score: scores[1] },
    { label: "Writing", score: scores[2] },
    { label: "Speaking", score: scores[3] },
  ],
  duration: 165,
  questions: 40,
});

const books: Book[] = [
  {
    id: "cam19", label: "CAM 19",
    tests: [
      makeTest("19-1", "Test 1", "completed", [7.5, 7.0, 6.5, 7.0]),
      makeTest("19-2", "Test 2", "in-progress", [7.0, null, null, null]),
      makeTest("19-3", "Test 3", "not-started", [null, null, null, null]),
      makeTest("19-4", "Test 4", "not-started", [null, null, null, null]),
    ],
  },
  {
    id: "cam18", label: "CAM 18",
    tests: [
      makeTest("18-1", "Test 1", "completed", [8.0, 7.5, 7.0, 7.5]),
      makeTest("18-2", "Test 2", "completed", [7.5, 7.0, 6.5, 7.0]),
      makeTest("18-3", "Test 3", "completed", [7.0, 6.5, 6.5, 7.0]),
      makeTest("18-4", "Test 4", "in-progress", [6.5, null, null, null]),
    ],
  },
  {
    id: "cam17", label: "CAM 17",
    tests: [
      makeTest("17-1", "Test 1", "completed", [7.0, 6.5, 6.0, 6.5]),
      makeTest("17-2", "Test 2", "completed", [6.5, 6.5, 6.0, 6.5]),
      makeTest("17-3", "Test 3", "completed", [7.5, 7.0, 6.5, 7.0]),
      makeTest("17-4", "Test 4", "completed", [7.0, 7.0, 6.5, 7.0]),
    ],
  },
  {
    id: "cam16", label: "CAM 16",
    tests: [
      makeTest("16-1", "Test 1", "completed", [6.5, 6.0, 6.0, 6.5]),
      makeTest("16-2", "Test 2", "completed", [7.0, 6.5, 6.0, 6.5]),
      makeTest("16-3", "Test 3", "completed", [6.5, 6.5, 5.5, 6.0]),
      makeTest("16-4", "Test 4", "completed", [7.0, 6.5, 6.0, 6.5]),
    ],
  },
  {
    id: "cam15", label: "CAM 15",
    tests: [
      makeTest("15-1", "Test 1", "completed", [6.0, 6.0, 5.5, 6.0]),
      makeTest("15-2", "Test 2", "completed", [6.5, 6.0, 5.5, 6.0]),
      makeTest("15-3", "Test 3", "completed", [6.5, 6.5, 6.0, 6.5]),
      makeTest("15-4", "Test 4", "completed", [7.0, 6.5, 6.0, 6.5]),
    ],
  },
];

const sectionIcon = {
  Listening: <Headphones weight="bold" className="size-3" />,
  Reading: <BookOpen weight="bold" className="size-3" />,
  Writing: <PencilLine weight="bold" className="size-3" />,
  Speaking: <MicrophoneStage weight="bold" className="size-3" />,
};

const sectionColor: Record<string, string> = {
  Listening: "bg-blue-500",
  Reading: "bg-emerald-500",
  Writing: "bg-amber-500",
  Speaking: "bg-purple-500",
};

const statusConfig: Record<Status, { label: string; className: string }> = {
  "not-started": { label: en.tests.status.notStarted, className: "border-neutral-700 text-muted-foreground" },
  "in-progress": { label: en.tests.status.inProgress, className: "border-amber-800 text-amber-400" },
  "completed": { label: en.tests.status.completed, className: "border-emerald-800 text-emerald-400" },
};

function ScorePill({ score, section }: { score: number | null; section: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md flex items-center gap-1 ${score !== null ? "bg-neutral-800 text-white" : "bg-neutral-800/50 text-neutral-600"}`}>
          {sectionIcon[section as keyof typeof sectionIcon]}
          {score ?? "—"}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">
        <span>{section}: {score ?? en.tests.dialog.notAttempted}</span>
      </TooltipContent>
    </Tooltip>
  );
}

function TestCard({ test, onOpen }: { test: Test; onOpen: (t: Test) => void }) {
  const cfg = statusConfig[test.status];
  return (
    <Card className="rounded-xl border-neutral-800 bg-neutral-900 hover:border-neutral-700 transition-colors">
      <CardContent className="px-4 py-3 flex flex-col gap-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold">{test.name}</span>
            <div className="flex items-center gap-1.5">
              <ClockCountdown weight="bold" className="size-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">{en.tests.card.minDot(test.duration, test.questions)}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${cfg.className}`}>{cfg.label}</Badge>
            {test.band !== null && (
              <span className="flex items-center gap-1 text-xs font-bold">
                <Trophy weight="bold" className="size-3 text-amber-400" />
                {test.band}
              </span>
            )}
          </div>
        </div>

        {test.status === "completed" && test.band !== null && (
          <Progress value={(test.band / 9) * 100} className="h-1" indicatorClassName="bg-emerald-500" />
        )}

        <div className="flex items-center justify-between">
          <div className="flex gap-1.5 flex-wrap">
            {test.sections.map(s => (
              <ScorePill key={s.label} score={s.score} section={s.label} />
            ))}
          </div>
          <Button
            size="xs"
            variant={test.status === "not-started" ? "outline" : "ghost"}
            className="shrink-0 gap-1"
            onClick={() => onOpen(test)}
          >
            {test.status === "not-started" ? (
              <><Play weight="bold" className="size-3" /> {en.tests.actions.start}</>
            ) : test.status === "in-progress" ? (
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

function TestDialog({ test, open, onClose, onStartTest, timerActive }: {
  test: Test | null;
  open: boolean;
  onClose: () => void;
  onStartTest: (name: string, seconds: number) => void;
  timerActive: boolean;
}) {
  if (!test) return null;
  const cfg = statusConfig[test.status];
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm border-neutral-800 bg-neutral-950 rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <BookOpen weight="bold" className="size-4 text-muted-foreground" />
            {test.name}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2 pt-1">
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${cfg.className}`}>{cfg.label}</Badge>
            {test.band !== null && (
              <span className="flex items-center gap-1 text-xs font-semibold text-white">
                <Trophy weight="bold" className="size-3 text-amber-400" /> Band {test.band}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <Separator className="bg-neutral-800" />

        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <ClockCountdown weight="bold" className="size-3.5" />
              <span>{en.tests.dialog.minutesTotal(test.duration)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <BookOpen weight="bold" className="size-3.5" />
              <span>{en.tests.dialog.questions(test.questions)}</span>
            </div>
          </div>

          <Separator className="bg-neutral-800" />

          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{en.tests.dialog.sections}</span>
            {test.sections.map(s => (
              <div key={s.label} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    {sectionIcon[s.label as keyof typeof sectionIcon]}
                    {s.label}
                  </span>
                  <span className="font-medium">{s.score ?? <Lock weight="bold" className="size-3 inline text-neutral-600" />}</span>
                </div>
                {s.score !== null && (
                  <Progress value={(s.score / 9) * 100} className="h-1" indicatorClassName={sectionColor[s.label]} />
                )}
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" className="border-neutral-700" onClick={onClose}>{en.tests.dialog.cancel}</Button>
          <Button size="sm" className="gap-1.5" disabled={timerActive && test.status !== "completed"} onClick={() => { if (test.status !== "completed") { onStartTest(test.name, test.duration * 60); onClose(); } }}>
            {test.status === "not-started" ? <><Play weight="bold" className="size-3" /> {en.tests.dialog.startTest}</> :
             test.status === "in-progress" ? <><ArrowRight weight="bold" className="size-3" /> {en.tests.actions.continue}</> :
             <><BookOpen weight="bold" className="size-3" /> {en.tests.actions.review}</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function Tests({ onStartTest, timerActive }: { onStartTest: (name: string, seconds: number) => void; timerActive: boolean }) {
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [selected, setSelected] = useState<Test | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const open = (t: Test) => { setSelected(t); setDialogOpen(true); };

  const filterTests = (tests: Test[]) =>
    filter === "all" ? tests : tests.filter(t => t.status === filter);

  const allTests = books.flatMap(b => b.tests);
  const completed = allTests.filter(t => t.status === "completed").length;
  const completedBands = allTests.filter(t => t.band !== null).map(t => t.band!);
  const avgBand = completedBands.length
    ? +(completedBands.reduce((a, b) => a + b, 0) / completedBands.length).toFixed(2)
    : null;

  return (
    <TooltipProvider>
      <div className="p-5 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen weight="bold" className="size-4 text-muted-foreground" />
            <span className="text-sm font-semibold">{en.tests.title}</span>
          </div>
          <Select value={filter} onValueChange={v => setFilter(v as FilterStatus)}>
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
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="rounded-xl border-neutral-800 bg-neutral-900">
            <CardContent className="px-3 py-2.5 flex flex-col gap-0.5">
              <span className="text-[10px] text-muted-foreground">{en.tests.summary.completed}</span>
              <span className="text-xl font-bold">{completed}<span className="text-sm text-muted-foreground">/{allTests.length}</span></span>
            </CardContent>
          </Card>
          <Card className="rounded-xl border-neutral-800 bg-neutral-900">
            <CardContent className="px-3 py-2.5 flex flex-col gap-0.5">
              <span className="text-[10px] text-muted-foreground">{en.tests.summary.avgBand}</span>
              <span className="text-xl font-bold flex items-center gap-1">
                <Trophy weight="bold" className="size-3.5 text-amber-400" />
                {avgBand ?? "—"}
              </span>
            </CardContent>
          </Card>
          <Card className="rounded-xl border-neutral-800 bg-neutral-900">
            <CardContent className="px-3 py-2.5 flex flex-col gap-1">
              <span className="text-[10px] text-muted-foreground">{en.tests.summary.progress}</span>
              <Progress value={(completed / allTests.length) * 100} className="h-1.5 mt-1" indicatorClassName="bg-emerald-500" />
            </CardContent>
          </Card>
        </div>

        {/* Books tabs */}
        <Tabs defaultValue="cam19">
          <ScrollArea className="w-full" type="scroll">
            <TabsList className="bg-neutral-900 border border-neutral-800 h-8 p-0.5 gap-0.5 w-max">
              {books.map(b => {
                const done = b.tests.filter(t => t.status === "completed").length;
                return (
                  <TabsTrigger
                    key={b.id}
                    value={b.id}
                    className="text-xs h-7 px-3 data-[state=active]:bg-neutral-800 data-[state=active]:text-white"
                  >
                    {b.label}
                    <span className="ml-1.5 text-[10px] text-muted-foreground">{done}/{b.tests.length}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </ScrollArea>

          {books.map(b => {
            const visible = filterTests(b.tests);
            return (
              <TabsContent key={b.id} value={b.id} className="mt-3">
                <div className="flex flex-col gap-2">
                  {/* Book header */}
                  <Card className="rounded-xl border-neutral-800 bg-neutral-900/50">
                    <CardHeader className="px-4 py-3">
                      <CardTitle className="text-xs font-semibold flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <BookOpen weight="bold" className="size-3.5 text-muted-foreground" />
                          {en.tests.bookHeader(b.label.replace("CAM ", ""))}
                        </span>
                        <span className="text-[10px] font-normal text-muted-foreground">
                          {b.tests.filter(t => t.status === "completed").length} / {b.tests.length} done
                        </span>
                      </CardTitle>
                    </CardHeader>
                  </Card>

                  {visible.length === 0 ? (
                    <div className="flex items-center justify-center py-10 text-xs text-muted-foreground">
                      {en.tests.noMatch}
                    </div>
                  ) : (
                    visible.map(t => <TestCard key={t.id} test={t} onOpen={open} />)
                  )}
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      </div>

      <TestDialog test={selected} open={dialogOpen} onClose={() => setDialogOpen(false)} onStartTest={onStartTest} timerActive={timerActive} />
    </TooltipProvider>
  );
}
