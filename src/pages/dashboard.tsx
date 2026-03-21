import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, BookOpen, Notebook, Fire, ClockCountdown, ArrowRight } from "@phosphor-icons/react";
import en from "@/locales/en";

const skills = [
  { label: en.dashboard.skillBreakdown.skills.listening, score: 7.5, color: "bg-blue-500" },
  { label: en.dashboard.skillBreakdown.skills.reading, score: 6.5, color: "bg-emerald-500" },
  { label: en.dashboard.skillBreakdown.skills.writing, score: 6.0, color: "bg-amber-500" },
  { label: en.dashboard.skillBreakdown.skills.speaking, score: 7.0, color: "bg-purple-500" },
];

const recentTests = [
  { name: "Listening Practice Test 3", date: "2 days ago", score: 7.5, status: en.dashboard.recentTests.status },
  { name: "Reading Mock Exam", date: "5 days ago", score: 6.5, status: en.dashboard.recentTests.status },
  { name: "Writing Task 2", date: "1 week ago", score: 6.0, status: en.dashboard.recentTests.status },
];

const upcomingHomework = [
  { title: "Writing Task 1 — Bar Chart", due: "Tomorrow", urgent: true },
  { title: "Reading Practice Set 4", due: "In 3 days", urgent: false },
  { title: "Speaking Part 2 Recording", due: "In 5 days", urgent: false },
];

export function Dashboard() {
  return (
    <div className="p-5 flex flex-col gap-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="rounded-xl border-neutral-800 bg-neutral-900">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <Trophy weight="bold" className="size-3.5" /> {en.dashboard.stats.overallBand}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <span className="text-3xl font-bold">6.75</span>
            <p className="text-xs text-muted-foreground mt-1">{en.dashboard.stats.target}</p>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-neutral-800 bg-neutral-900">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <BookOpen weight="bold" className="size-3.5" /> {en.dashboard.stats.testsTaken}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <span className="text-3xl font-bold">12</span>
            <p className="text-xs text-muted-foreground mt-1">{en.dashboard.stats.testsTakenSub}</p>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-neutral-800 bg-neutral-900">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <Notebook weight="bold" className="size-3.5" /> {en.dashboard.stats.homeworkDone}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <span className="text-3xl font-bold">8<span className="text-lg text-muted-foreground">/10</span></span>
            <p className="text-xs text-muted-foreground mt-1">{en.dashboard.stats.homeworkPending(2)}</p>
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
            {upcomingHomework.map((hw, i) => (
              <div key={i} className="flex items-center justify-between py-2.5 border-b border-neutral-800 last:border-0">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-medium">{hw.title}</span>
                  <span className="text-xs text-muted-foreground">{hw.due}</span>
                </div>
                <Badge variant="outline" className={hw.urgent ? "border-red-800 text-red-400" : "border-neutral-700 text-muted-foreground"}>
                  {hw.urgent ? en.dashboard.upcomingHomework.urgent : en.dashboard.upcomingHomework.upcoming}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-xl border-neutral-800 bg-neutral-900">
        <CardHeader className="px-4 pt-4 pb-3">
          <CardTitle className="text-sm font-semibold flex items-center justify-between">
            {en.dashboard.recentTests.title}
            <button className="text-xs text-muted-foreground hover:text-white transition-colors flex items-center gap-1">
              {en.dashboard.recentTests.viewAll} <ArrowRight weight="bold" className="size-3" />
            </button>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 flex flex-col">
          {recentTests.map((test, i) => (
            <div key={i} className="flex items-center justify-between py-3 border-b border-neutral-800 last:border-0">
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
        </CardContent>
      </Card>
    </div>
  );
}
