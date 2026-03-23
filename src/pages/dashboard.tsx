import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, BookOpen, Notebook, Fire, ClockCountdown, ArrowRight } from "@phosphor-icons/react";
import { listAssignments, type AssignmentSummary } from "@/lib/api";
import { useNav } from "@/hooks/use-nav";
import en from "@/locales/en";

export function Dashboard() {
  const [tasks, setTasks] = useState<AssignmentSummary[]>([]);
  const [homework, setHomework] = useState<AssignmentSummary[]>([]);
  const { setPage } = useNav();

  useEffect(() => {
    listAssignments("task")
      .then((res) => setTasks(res.assignments))
      .catch(() => setTasks([]));
    listAssignments("homework")
      .then((res) => setHomework(res.assignments))
      .catch(() => setHomework([]));
  }, []);

  const completedTasks = useMemo(
    () => tasks.filter((task) => task.attempt?.status === "completed"),
    [tasks]
  );

  const completedHomework = useMemo(
    () => homework.filter((item) => item.attempt?.status === "completed"),
    [homework]
  );

  const avgBand = useMemo(() => {
    const bands = completedTasks.map((task) => task.attempt?.band).filter((b): b is number => b != null);
    if (!bands.length) return 0;
    return +(bands.reduce((a, b) => a + b, 0) / bands.length).toFixed(2);
  }, [completedTasks]);

  const avgListeningBand = useMemo(() => {
    const bands = completedTasks
      .map((task) => task.attempt?.listeningBand)
      .filter((b): b is number => b != null);
    if (!bands.length) return null;
    return +(bands.reduce((a, b) => a + b, 0) / bands.length).toFixed(1);
  }, [completedTasks]);

  const avgReadingBand = useMemo(() => {
    const bands = completedTasks
      .map((task) => task.attempt?.readingBand)
      .filter((b): b is number => b != null);
    if (!bands.length) return null;
    return +(bands.reduce((a, b) => a + b, 0) / bands.length).toFixed(1);
  }, [completedTasks]);

  const recentTests = useMemo(
    () => completedTasks.slice(0, 3).map((task) => ({
      name: task.title,
      date: task.attempt?.completedAt ? new Date(task.attempt.completedAt).toLocaleDateString() : "",
      score: task.attempt?.band ?? 0,
      status: en.dashboard.recentTests.status,
    })),
    [completedTasks]
  );

  const upcomingHomework = useMemo(
    () => homework
      .filter((item) => item.attempt?.status !== "completed" && item.dueAt)
      .sort((a, b) => new Date(a.dueAt ?? 0).getTime() - new Date(b.dueAt ?? 0).getTime())
      .slice(0, 3)
      .map((item) => ({
        id: item.id,
        title: item.title,
        due: item.dueAt ? new Date(item.dueAt).toLocaleDateString() : "",
        urgent: item.dueAt ? new Date(item.dueAt).getTime() - Date.now() < 2 * 24 * 60 * 60 * 1000 : false,
      })),
    [homework]
  );

  const computeStreak = (entries: AssignmentSummary[]) => {
    const pad = (value: number) => value.toString().padStart(2, "0");
    const toKey = (value: Date) => `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
    const keys = new Set<string>();
    const addAttempt = (attempt?: AssignmentSummary["attempt"]) => {
      if (!attempt?.completedAt) return;
      const date = new Date(attempt.completedAt);
      keys.add(toKey(date));
    };
    entries.forEach((entry) => addAttempt(entry.attempt));
    let streak = 0;
    const today = new Date();
    const current = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    while (keys.has(toKey(current))) {
      streak += 1;
      current.setDate(current.getDate() - 1);
    }
    return streak;
  };

  const streak = useMemo(() => {
    return Math.max(computeStreak(completedTasks), computeStreak(completedHomework));
  }, [completedTasks, completedHomework]);

  const focusBadge = useMemo(() => {
    if (!tasks.length) return en.common.na;
    const latest = tasks[0];
    return `${latest.title} • ${latest.attempt?.band ?? en.common.notAvailable}`;
  }, [tasks]);

  return (
    <div className="p-5 flex flex-col gap-4 font-body">
      <div className="relative overflow-hidden rounded-2xl border border-neutral-800 bg-[linear-gradient(135deg,rgba(22,22,22,0.9),rgba(5,30,52,0.95))] p-5">
        <div className="absolute inset-0 opacity-40 [background:radial-gradient(circle_at_top_right,rgba(59,130,246,0.25),transparent_55%)]" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <Badge variant="outline" className="border-emerald-400/40 text-emerald-200 -ml-1">{en.dashboard.hero.badge}</Badge>
            <h1 className="text-xl font-display tracking-wide">{en.dashboard.title}</h1>
            <p className="text-xs text-muted-foreground max-w-lg">{en.dashboard.hero.subtitle}</p>
          </div>
          <div className="flex flex-col gap-1 text-right text-xs text-muted-foreground">
            <span>{en.dashboard.hero.latestMission(focusBadge)}</span>
            <span>{en.dashboard.hero.summary(completedTasks.length, homework.length)}</span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="rounded-xl border-neutral-800 bg-neutral-900 cursor-pointer hover:border-neutral-700 transition-colors" onClick={() => setPage("Tests")}>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <Trophy weight="bold" className="size-3.5" /> {en.dashboard.stats.overallBand}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <span className="text-3xl font-bold">{avgBand || "-"}</span>
            <p className="text-xs text-muted-foreground mt-1">{en.dashboard.stats.target}</p>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-neutral-800 bg-neutral-900 cursor-pointer hover:border-neutral-700 transition-colors" onClick={() => setPage("Tests")}>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <BookOpen weight="bold" className="size-3.5" /> {en.dashboard.stats.testsTaken}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <span className="text-3xl font-bold">{completedTasks.length}</span>
            <p className="text-xs text-muted-foreground mt-1">{en.dashboard.stats.testsTakenSub}</p>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-neutral-800 bg-neutral-900 cursor-pointer hover:border-neutral-700 transition-colors" onClick={() => setPage("Homework")}>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <Notebook weight="bold" className="size-3.5" /> {en.dashboard.stats.homeworkDone}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <span className="text-3xl font-bold">{completedHomework.length}<span className="text-lg text-muted-foreground">/{homework.length}</span></span>
            <p className="text-xs text-muted-foreground mt-1">{en.dashboard.stats.homeworkPending(Math.max(0, homework.length - completedHomework.length))}</p>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-neutral-800 bg-neutral-900">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <Fire weight="bold" className="size-3.5" /> {en.dashboard.stats.streak}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <span className="text-3xl font-bold">{streak}</span>
            <p className="text-xs text-muted-foreground mt-1">{en.dashboard.stats.streakSub}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-4">
        <Card className="rounded-xl border-neutral-800 bg-neutral-900">
          <CardHeader className="px-4 pt-4 pb-3">
            <CardTitle className="text-sm font-semibold">{en.dashboard.skillBreakdown.title}</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 flex flex-col gap-4">
            {[
              { key: "listening", label: en.dashboard.skillBreakdown.skills.listening, band: avgListeningBand },
              { key: "reading", label: en.dashboard.skillBreakdown.skills.reading, band: avgReadingBand },
            ].map((entry) => (
              <div key={entry.key} className="flex flex-col gap-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{entry.label}</span>
                  <span className="font-semibold">{entry.band ?? en.common.na}</span>
                </div>
                <Progress
                  value={entry.band != null ? (entry.band / 9) * 100 : 0}
                  className="h-1.5"
                  indicatorClassName={entry.key === "listening" ? "bg-sky-500" : "bg-emerald-500"}
                />
              </div>
            ))}
            <p className="text-[10px] text-muted-foreground">{en.dashboard.skillBreakdown.note}</p>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-neutral-800 bg-neutral-900">
          <CardHeader className="px-4 pt-4 pb-3">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              {en.dashboard.upcomingHomework.title}
              <ClockCountdown weight="bold" className="size-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 flex flex-col gap-3">
            {upcomingHomework.length === 0 ? (
              <div className="text-xs text-muted-foreground py-6">{en.dashboard.upcomingHomework.empty}</div>
            ) : (
              upcomingHomework.map((hw) => (
                <div key={hw.id} className="flex items-center justify-between gap-3 rounded-lg border border-neutral-800 px-3 py-3 text-xs transition-colors hover:border-emerald-500/50" onClick={() => setPage("Homework", hw.id)}>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-sm">{hw.title}</span>
                    <span className="text-xs text-muted-foreground">{en.dashboard.upcomingHomework.duePrefix(hw.due)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={hw.urgent ? "border-red-800 text-red-400" : "border-neutral-700 text-muted-foreground"}>
                      {hw.urgent ? en.dashboard.upcomingHomework.urgent : en.dashboard.upcomingHomework.upcoming}
                    </Badge>
                    <Button variant="ghost" size="xs" onClick={(e) => { e.stopPropagation(); setPage("Homework", hw.id); }}>
                      {en.tests.actions.continue}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-xl border-neutral-800 bg-neutral-900">
        <CardHeader className="px-4 pt-4 pb-3">
          <CardTitle className="text-sm font-semibold flex items-center justify-between">
            {en.dashboard.recentTests.title}
            <button className="text-xs text-muted-foreground hover:text-white transition-colors flex items-center gap-1" onClick={() => setPage("Tests")}>
              {en.dashboard.recentTests.viewAll} <ArrowRight weight="bold" className="size-3" />
            </button>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 flex flex-col">
          {recentTests.length === 0 ? (
            <div className="text-xs text-muted-foreground py-6">{en.dashboard.recentTests.empty}</div>
          ) : (
            recentTests.map((test, i) => (
              <div key={i} className="flex items-center justify-between py-3 border-b border-neutral-800 last:border-0 cursor-pointer hover:bg-neutral-800/40 rounded px-1 -mx-1 transition-colors" onClick={() => setPage("Tests")}>
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-medium">{test.name}</span>
                  <span className="text-xs text-muted-foreground">{test.date}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold">{test.score}</span>
                  <Badge variant="outline" className="border-emerald-800 text-emerald-400">{test.status}</Badge>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
