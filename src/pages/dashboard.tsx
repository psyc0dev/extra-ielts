import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, BookOpen, Notebook, Fire, ClockCountdown, ArrowRight, Users, Check as CheckIcon, X } from "@phosphor-icons/react";
import { listAssignments, listMyInvitations, respondToInvitation, type AssignmentSummary, type StudentInvitation } from "@/lib/api";
import { useDelayedLoading } from "@/hooks/use-delayed-loading";
import { useNav } from "@/hooks/use-nav";
import en from "@/locales/en";

export function Dashboard() {
  const [tasks, setTasks] = useState<AssignmentSummary[]>([]);
  const [homework, setHomework] = useState<AssignmentSummary[]>([]);
  const [invitations, setInvitations] = useState<StudentInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const sk = useDelayedLoading(loading);
  const { setPage } = useNav();

  useEffect(() => {
    Promise.all([listAssignments("task"), listAssignments("homework"), listMyInvitations()])
      .then(([t, h, inv]) => { setTasks(t.assignments); setHomework(h.assignments); setInvitations(inv.invitations); })
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

  const fade = (i: number) => ({
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.25, delay: i * 0.06, ease: 'easeOut' as const },
  });

  return (
    <div className="p-5 flex flex-col gap-4 font-body">
      <motion.div {...fade(0)} className="relative overflow-hidden rounded-2xl border border-neutral-800 bg-[linear-gradient(135deg,rgba(22,22,22,0.9),rgba(5,30,52,0.95))] p-5">
        <div className="absolute inset-0 opacity-40 [background:radial-gradient(circle_at_top_right,rgba(59,130,246,0.25),transparent_55%)]" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <Badge variant="outline" className="border-emerald-400/40 text-emerald-200 -ml-1">{en.dashboard.hero.badge}</Badge>
            <h1 className="text-xl font-display tracking-wide">{en.dashboard.title}</h1>
            <p className="text-xs text-muted-foreground max-w-lg">{en.dashboard.hero.subtitle}</p>
          </div>
          <div className="flex flex-col gap-1 text-right text-xs text-muted-foreground">
            <AnimatePresence mode="wait" initial={false}>
              {sk ? (
                <motion.div key="sk" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="flex flex-col gap-1 items-end">
                  <Skeleton className="h-3 w-40" /><Skeleton className="h-3 w-32 mt-1" />
                </motion.div>
              ) : (
                <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
                  <span>{en.dashboard.hero.latestMission(focusBadge)}</span><br /><span>{en.dashboard.hero.summary(completedTasks.length, homework.length)}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      <motion.div {...fade(1)} className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <Card key={i} className={`rounded-xl border-neutral-800 bg-neutral-900 ${card.onClick ? "cursor-pointer hover:border-neutral-700 transition-colors" : ""}`} onClick={card.onClick}>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">{card.icon} {card.label}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <AnimatePresence mode="wait" initial={false}>
                {sk ? (
                  <motion.div key="sk" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="flex flex-col gap-1">
                    <Skeleton className="h-8 w-10" /><Skeleton className="h-2.5 w-16" />
                  </motion.div>
                ) : (
                  <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
                    <span className="text-3xl font-bold">{card.value}</span><p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      <motion.div {...fade(2)} className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-4">
        <Card className="rounded-xl border-neutral-800 bg-neutral-900">
          <CardHeader className="px-4 pt-4 pb-3">
            <CardTitle className="text-sm font-semibold">{en.dashboard.skillBreakdown.title}</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 flex flex-col gap-3">
            <AnimatePresence mode="wait" initial={false}>
              {sk ? (
                <motion.div key="sk" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="flex flex-col gap-3">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="rounded-lg border border-neutral-800 bg-neutral-950/50 p-3 flex items-center gap-4">
                      <Skeleton className="size-12 rounded-lg shrink-0" />
                      <div className="flex-1 flex flex-col gap-1.5">
                        <div className="flex justify-between"><Skeleton className="h-3 w-16" /><Skeleton className="h-3 w-8" /></div>
                        <Skeleton className="h-1.5 w-full rounded-full" />
                      </div>
                    </div>
                  ))}
                </motion.div>
              ) : (
                <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className="flex flex-col gap-3">
                  {[
                    { key: "listening", label: en.dashboard.skillBreakdown.skills.listening, band: avgListeningBand, color: "bg-sky-500", trackColor: "bg-sky-500/15", textColor: "text-sky-400" },
                    { key: "reading", label: en.dashboard.skillBreakdown.skills.reading, band: avgReadingBand, color: "bg-emerald-500", trackColor: "bg-emerald-500/15", textColor: "text-emerald-400" },
                  ].map((entry) => (
                    <div key={entry.key} className="rounded-lg border border-neutral-800 bg-neutral-950/50 p-3 flex items-center gap-4">
                      <div className={`flex items-center justify-center rounded-lg size-12 shrink-0 ${entry.trackColor}`}>
                        <span className={`text-xl font-bold ${entry.textColor}`}>{entry.band ?? "—"}</span>
                      </div>
                      <div className="flex-1 flex flex-col gap-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium">{entry.label}</span>
                          <span className="text-muted-foreground">{entry.band != null ? `${Math.round((entry.band / 9) * 100)}%` : en.common.na}</span>
                        </div>
                        <Progress value={entry.band != null ? (entry.band / 9) * 100 : 0} className="h-1.5" indicatorClassName={entry.color} />
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
            <p className="ml-2 text-[12px] text-muted-foreground">{en.dashboard.skillBreakdown.note}</p>
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
            <AnimatePresence mode="wait" initial={false}>
              {sk ? (
                <motion.div key="sk" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="flex flex-col gap-3">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="rounded-lg border border-neutral-800 px-3 py-3 flex items-center justify-between gap-3">
                      <div className="flex flex-col gap-1 flex-1"><Skeleton className="h-3.5 w-3/4" /><Skeleton className="h-2.5 w-1/4" /></div>
                      <div className="flex items-center gap-2"><Skeleton className="h-5 w-16 rounded-full" /><Skeleton className="h-6 w-16 rounded-md" /></div>
                    </div>
                  ))}
                </motion.div>
              ) : upcomingHomework.length === 0 ? (
              <div className="mt-4 flex flex-col items-center justify-center gap-2 py-8 text-center">
                <ClockCountdown weight="duotone" className="size-8 text-muted-foreground/40" />
                <p className="text-xs text-muted-foreground">{en.dashboard.upcomingHomework.empty}</p>
              </div>
              ) : (
                <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className="flex flex-col gap-3">
                  {upcomingHomework.length === 0 ? (
                    <div className="mt-4 flex flex-col items-center justify-center gap-2 py-8 text-center">
                      <ClockCountdown weight="duotone" className="size-8 text-muted-foreground/40" />
                      <p className="text-xs text-muted-foreground">{en.dashboard.upcomingHomework.empty}</p>
                    </div>
                  ) : upcomingHomework.map((hw) => (
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
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>

      {invitations.filter((inv) => inv.status === "pending").length > 0 && (
        <motion.div {...fade(3)}>
          <Card className="rounded-xl border-neutral-800 bg-neutral-900">
            <CardHeader className="px-4 pt-4 pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Users weight="bold" className="size-4" /> {en.dashboard.invitations.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 flex flex-col gap-3">
              {invitations.filter((inv) => inv.status === "pending").map((inv) => (
                <div key={inv.id} className="flex items-center justify-between gap-3 rounded-lg border border-neutral-800 px-3 py-3 text-xs">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-sm">{inv.groupName}</span>
                    <span className="text-xs text-muted-foreground">{en.dashboard.invitations.invitedBy(inv.invitedByName)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" className="h-7 text-xs gap-1" onClick={async () => {
                      await respondToInvitation(inv.id, "accept");
                      setInvitations((prev) => prev.map((i) => i.id === inv.id ? { ...i, status: "accepted" as const } : i));
                    }}>
                      <CheckIcon weight="bold" className="size-3" /> {en.dashboard.invitations.accept}
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs border-red-700 text-red-400 hover:text-red-300" onClick={async () => {
                      await respondToInvitation(inv.id, "decline");
                      setInvitations((prev) => prev.map((i) => i.id === inv.id ? { ...i, status: "declined" as const } : i));
                    }}>
                      <X weight="bold" className="size-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}

      <motion.div {...fade(4)}>
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
          <AnimatePresence mode="wait" initial={false}>
            {sk ? (
              <motion.div key="sk" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between py-3 border-b border-neutral-800 last:border-0">
                    <div className="flex flex-col gap-0.5"><Skeleton className="h-3 w-36" /><Skeleton className="h-2.5 w-20 mt-0.5" /></div>
                    <div className="flex items-center gap-3"><Skeleton className="h-4 w-6" /><Skeleton className="h-5 w-20 rounded-full" /></div>
                  </div>
                ))}
              </motion.div>
            ) : (
              <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
                {recentTests.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                    <Trophy weight="duotone" className="size-8 text-muted-foreground/40" />
                    <p className="text-xs text-muted-foreground">{en.dashboard.recentTests.empty}</p>
                  </div>
                ) : recentTests.map((test, i) => (
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
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
      </motion.div>
    </div>
  );
}
