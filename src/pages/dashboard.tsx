import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, BookOpen, Notebook, Fire, ClockCountdown, ArrowRight } from "@phosphor-icons/react";
import { listAssignments, type AssignmentSummary } from "@/lib/api";
import { useDelayedLoading } from "@/hooks/use-delayed-loading";
import { useNav } from "@/hooks/use-nav";
import en from "@/locales/en";

export function Dashboard() {
  const [tasks, setTasks] = useState<AssignmentSummary[]>([]);
  const [homework, setHomework] = useState<AssignmentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const sk = useDelayedLoading(loading);
  const { setPage } = useNav();

  useEffect(() => {
    Promise.all([listAssignments("task"), listAssignments("homework")])
      .then(([t, h]) => { setTasks(t.assignments); setHomework(h.assignments); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const completedTasks = useMemo(() => tasks.filter((t) => t.attempt?.status === "completed"), [tasks]);
  const completedHomework = useMemo(() => homework.filter((h) => h.attempt?.status === "completed"), [homework]);

  const avgBand = useMemo(() => {
    const bands = completedTasks.map((t) => t.attempt?.band).filter((b): b is number => b != null);
    return bands.length ? +(bands.reduce((a, b) => a + b, 0) / bands.length).toFixed(2) : 0;
  }, [completedTasks]);

  const avgListeningBand = useMemo(() => {
    const bands = completedTasks.map((t) => t.attempt?.listeningBand).filter((b): b is number => b != null);
    return bands.length ? +(bands.reduce((a, b) => a + b, 0) / bands.length).toFixed(1) : null;
  }, [completedTasks]);

  const avgReadingBand = useMemo(() => {
    const bands = completedTasks.map((t) => t.attempt?.readingBand).filter((b): b is number => b != null);
    return bands.length ? +(bands.reduce((a, b) => a + b, 0) / bands.length).toFixed(1) : null;
  }, [completedTasks]);

  const recentTests = useMemo(() => completedTasks.slice(0, 3).map((t) => ({
    name: t.title,
    date: t.attempt?.completedAt ? new Date(t.attempt.completedAt).toLocaleDateString() : "",
    score: t.attempt?.band ?? 0,
    status: en.dashboard.recentTests.status,
  })), [completedTasks]);

  const upcomingHomework = useMemo(() => homework
    .filter((h) => h.attempt?.status !== "completed" && h.dueAt)
    .sort((a, b) => new Date(a.dueAt ?? 0).getTime() - new Date(b.dueAt ?? 0).getTime())
    .slice(0, 3)
    .map((h) => ({
      id: h.id,
      title: h.title,
      due: h.dueAt ? new Date(h.dueAt).toLocaleDateString() : "",
      urgent: h.dueAt ? new Date(h.dueAt).getTime() - Date.now() < 2 * 24 * 60 * 60 * 1000 : false,
    })), [homework]);

  const streak = useMemo(() => {
    const computeStreak = (entries: AssignmentSummary[]) => {
      const pad = (v: number) => v.toString().padStart(2, "0");
      const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const keys = new Set(entries.filter((e) => e.attempt?.completedAt).map((e) => toKey(new Date(e.attempt!.completedAt!))));
      let s = 0;
      const cur = new Date(); cur.setHours(0, 0, 0, 0);
      while (keys.has(toKey(cur))) { s++; cur.setDate(cur.getDate() - 1); }
      return s;
    };
    return Math.max(computeStreak(completedTasks), computeStreak(completedHomework));
  }, [completedTasks, completedHomework]);

  const focusBadge = useMemo(() => {
    if (!tasks.length) return en.common.na;
    const latest = tasks[0];
    return `${latest.title} • ${latest.attempt?.band ?? en.common.notAvailable}`;
  }, [tasks]);

  const statCards = [
    { icon: <Trophy weight="bold" className="size-3.5" />, label: en.dashboard.stats.overallBand, value: avgBand || "-", sub: en.dashboard.stats.target, onClick: () => setPage("Tests") },
    { icon: <BookOpen weight="bold" className="size-3.5" />, label: en.dashboard.stats.testsTaken, value: completedTasks.length, sub: en.dashboard.stats.testsTakenSub, onClick: () => setPage("Tests") },
    { icon: <Notebook weight="bold" className="size-3.5" />, label: en.dashboard.stats.homeworkDone, value: <span>{completedHomework.length}<span className="text-lg text-muted-foreground">/{homework.length}</span></span>, sub: en.dashboard.stats.homeworkPending(Math.max(0, homework.length - completedHomework.length)), onClick: () => setPage("Homework") },
    { icon: <Fire weight="bold" className="size-3.5" />, label: en.dashboard.stats.streak, value: streak, sub: en.dashboard.stats.streakSub, onClick: undefined },
  ];

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
            {sk ? <><Skeleton className="h-3 w-40 ml-auto" /><Skeleton className="h-3 w-32 ml-auto mt-1" /></> : (
              <><span>{en.dashboard.hero.latestMission(focusBadge)}</span><span>{en.dashboard.hero.summary(completedTasks.length, homework.length)}</span></>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <Card key={i} className={`rounded-xl border-neutral-800 bg-neutral-900 ${card.onClick ? "cursor-pointer hover:border-neutral-700 transition-colors" : ""}`} onClick={card.onClick}>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">{card.icon} {card.label}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {sk ? <><Skeleton className="h-8 w-12" /><Skeleton className="h-2.5 w-24 mt-2" /></> : (
                <><span className="text-3xl font-bold">{card.value}</span><p className="text-xs text-muted-foreground mt-1">{card.sub}</p></>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-4">
        <Card className="rounded-xl border-neutral-800 bg-neutral-900">
          <CardHeader className="px-4 pt-4 pb-3">
            <CardTitle className="text-sm font-semibold">{en.dashboard.skillBreakdown.title}</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 flex flex-col gap-4">
            {sk ? (
              Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-1">
                  <div className="flex justify-between"><Skeleton className="h-3 w-16" /><Skeleton className="h-3 w-8" /></div>
                  <Skeleton className="h-1.5 w-full" />
                </div>
              ))
            ) : (
              [
                { key: "listening", label: en.dashboard.skillBreakdown.skills.listening, band: avgListeningBand, color: "bg-sky-500" },
                { key: "reading", label: en.dashboard.skillBreakdown.skills.reading, band: avgReadingBand, color: "bg-emerald-500" },
              ].map((entry) => (
                <div key={entry.key} className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{entry.label}</span>
                    <span className="font-semibold">{entry.band ?? en.common.na}</span>
                  </div>
                  <Progress value={entry.band != null ? (entry.band / 9) * 100 : 0} className="h-1.5" indicatorClassName={entry.color} />
                </div>
              ))
            )}
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
            {sk ? (
              Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="rounded-lg border border-neutral-800 px-3 py-3 flex flex-col gap-1.5">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-2.5 w-1/2" />
                </div>
              ))
            ) : upcomingHomework.length === 0 ? (
              <div className="text-xs text-muted-foreground py-6">{en.dashboard.upcomingHomework.empty}</div>
            ) : (
              upcomingHomework.map((hw) => (
                <div key={hw.id} className="flex items-center justify-between gap-3 rounded-lg border border-neutral-800 px-3 py-3 text-xs transition-colors hover:border-emerald-500/50 cursor-pointer" onClick={() => setPage("Homework", hw.id)}>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-sm">{hw.title}</span>
                    <span className="text-xs text-muted-foreground">{en.dashboard.upcomingHomework.duePrefix(hw.due)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={hw.urgent ? "border-red-800 text-red-400" : "border-neutral-700 text-muted-foreground"}>
                      {hw.urgent ? en.dashboard.upcomingHomework.urgent : en.dashboard.upcomingHomework.upcoming}
                    </Badge>
                    <Button variant="ghost" size="xs" onClick={(e) => { e.stopPropagation(); setPage("Homework", hw.id); }}>{en.tests.actions.continue}</Button>
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
          {sk ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between py-3 border-b border-neutral-800 last:border-0">
                <div className="flex flex-col gap-1"><Skeleton className="h-3 w-32" /><Skeleton className="h-2.5 w-20 mt-0.5" /></div>
                <div className="flex items-center gap-3"><Skeleton className="h-4 w-8" /><Skeleton className="h-5 w-16 rounded-full" /></div>
              </div>
            ))
          ) : recentTests.length === 0 ? (
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
