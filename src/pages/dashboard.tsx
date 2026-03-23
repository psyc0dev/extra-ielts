import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, BookOpen, Notebook, Fire, ClockCountdown, ArrowRight } from "@phosphor-icons/react";
import { listAssignments, type AssignmentSummary } from "@/lib/api";
import { useNav } from "@/hooks/use-nav";
import en from "@/locales/en";

const skills = [
  { label: en.dashboard.skillBreakdown.skills.listening, score: 7.5, color: "bg-blue-500" },
  { label: en.dashboard.skillBreakdown.skills.reading, score: 6.5, color: "bg-emerald-500" },
  { label: en.dashboard.skillBreakdown.skills.writing, score: 6.0, color: "bg-amber-500" },
  { label: en.dashboard.skillBreakdown.skills.speaking, score: 7.0, color: "bg-purple-500" },
];

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

  return (
    <div className="p-5 flex flex-col gap-4">
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
            <span className="text-3xl font-bold">7</span>
            <p className="text-xs text-muted-foreground mt-1">{en.dashboard.stats.streakSub}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="rounded-xl border-neutral-800 bg-neutral-900">
          <CardHeader className="px-4 pt-4 pb-3">
            <CardTitle className="text-sm font-semibold">{en.dashboard.skillBreakdown.title}</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 flex flex-col gap-3">
            {skills.map(skill => (
              <div key={skill.label} className="flex flex-col gap-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{skill.label}</span>
                  <span className="font-medium">{skill.score}</span>
                </div>
                <Progress value={(skill.score / 9) * 100} className="h-1.5" indicatorClassName={skill.color} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-xl border-neutral-800 bg-neutral-900">
          <CardHeader className="px-4 pt-4 pb-3">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              {en.dashboard.upcomingHomework.title}
              <ClockCountdown weight="bold" className="size-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 flex flex-col">
            {upcomingHomework.length === 0 ? (
              <div className="text-xs text-muted-foreground py-6">{en.dashboard.upcomingHomework.empty}</div>
            ) : (
              upcomingHomework.map((hw, i) => (
                <div key={i} className="flex items-center justify-between py-2.5 border-b border-neutral-800 last:border-0 cursor-pointer hover:bg-neutral-800/40 rounded px-1 -mx-1 transition-colors" onClick={() => setPage("Homework", hw.id)}>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-medium">{hw.title}</span>
                    <span className="text-xs text-muted-foreground">{hw.due}</span>
                  </div>
                  <Badge variant="outline" className={hw.urgent ? "border-red-800 text-red-400" : "border-neutral-700 text-muted-foreground"}>
                    {hw.urgent ? en.dashboard.upcomingHomework.urgent : en.dashboard.upcomingHomework.upcoming}
                  </Badge>
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
