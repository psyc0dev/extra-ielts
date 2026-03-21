import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Notebook, ClockCountdown, CheckCircle, Warning } from "@phosphor-icons/react";
import en from "@/locales/en";

type Subject = "All" | "Writing" | "Reading" | "Listening" | "Speaking";

interface HomeworkItem {
  id: string;
  title: string;
  subject: Exclude<Subject, "All">;
  due: string;
  daysLeft: number;
  description: string;
  steps: string[];
  done: boolean;
}

const initial: HomeworkItem[] = [
  {
    id: "1",
    title: "Writing Task 1 — Bar Chart",
    subject: "Writing",
    due: "Tomorrow",
    daysLeft: 1,
    description: "Describe the bar chart showing internet usage across age groups. Aim for 150+ words.",
    steps: ["Analyse the chart", "Write an introduction", "Describe key trends", "Summarise"],
    done: false,
  },
  {
    id: "2",
    title: "Reading Practice Set 4",
    subject: "Reading",
    due: "In 3 days",
    daysLeft: 3,
    description: "Complete passages 1–3 from Cambridge IELTS 17, timed at 60 minutes.",
    steps: ["Skim all three passages", "Answer True/False/NG section", "Complete matching headings", "Review answers"],
    done: false,
  },
  {
    id: "3",
    title: "Speaking Part 2 Recording",
    subject: "Speaking",
    due: "In 5 days",
    daysLeft: 5,
    description: "Record a 2-minute response to the cue card: 'Describe a place you enjoy visiting.'",
    steps: ["Prepare notes (1 min)", "Record response", "Self-evaluate fluency & vocabulary", "Submit recording"],
    done: false,
  },
  {
    id: "4",
    title: "Listening Section 3 & 4",
    subject: "Listening",
    due: "In 6 days",
    daysLeft: 6,
    description: "Complete sections 3 and 4 from the practice audio. Focus on note completion questions.",
    steps: ["Listen to Section 3", "Answer questions 21–30", "Listen to Section 4", "Answer questions 31–40"],
    done: true,
  },
  {
    id: "5",
    title: "Writing Task 2 — Opinion Essay",
    subject: "Writing",
    due: "In 7 days",
    daysLeft: 7,
    description: "Write a 250-word opinion essay on: 'Technology has made people less social. Do you agree?'",
    steps: ["Plan argument structure", "Write introduction", "Write body paragraphs", "Write conclusion", "Proofread"],
    done: true,
  },
];

const subjectColor: Record<Exclude<Subject, "All">, string> = {
  Writing: "border-amber-800 text-amber-400",
  Reading: "border-emerald-800 text-emerald-400",
  Listening: "border-blue-800 text-blue-400",
  Speaking: "border-purple-800 text-purple-400",
};

export function Homework() {
  const [items, setItems] = useState(initial);
  const [subject, setSubject] = useState<Subject>("All");

  const toggle = (id: string) =>
    setItems(prev => prev.map(i => (i.id === id ? { ...i, done: !i.done } : i)));

  const filtered = (tab: "all" | "pending" | "completed") =>
    items
      .filter(i => subject === "All" || i.subject === subject)
      .filter(i => tab === "all" || (tab === "pending" ? !i.done : i.done));

  const total = items.length;
  const done = items.filter(i => i.done).length;

  return (
    <TooltipProvider>
      <div className="p-5 flex flex-col gap-4">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Notebook weight="bold" className="size-4 text-muted-foreground" />
            <span className="text-sm font-semibold">{en.homework.title}</span>
          </div>
          <Select value={subject} onValueChange={v => setSubject(v as Subject)}>
            <SelectTrigger className="h-8 w-36 text-xs border-neutral-800 bg-neutral-900">
              <SelectValue placeholder={en.homework.filter.placeholder} />
            </SelectTrigger>
            <SelectContent>
              {(["All", "Writing", "Reading", "Listening", "Speaking"] as Subject[]).map(s => (
                <SelectItem key={s} value={s} className="text-xs">{en.homework.filter[s.toLowerCase() as keyof typeof en.homework.filter]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Progress summary */}
        <Card className="rounded-xl border-neutral-800 bg-neutral-900">
          <CardContent className="px-4 py-3 flex flex-col gap-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <CheckCircle weight="bold" className="size-3.5" /> {en.homework.completion.label}
              </span>
              <span className="font-medium">{en.homework.completion.tasks(done, total)}</span>
            </div>
            <Progress value={(done / total) * 100} className="h-1.5" indicatorClassName="bg-emerald-500" />
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="all">
          <TabsList className="bg-neutral-900 border border-neutral-800 h-8 p-0.5 gap-0.5">
            {(["all", "pending", "completed"] as const).map(tab => (
              <TabsTrigger
                key={tab}
                value={tab}
                className="text-xs h-7 px-3 capitalize data-[state=active]:bg-neutral-800 data-[state=active]:text-white"
              >
                {en.homework.tabs[tab]}
                <span className="ml-1.5 text-[10px] text-muted-foreground">
                  {filtered(tab).length}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          {(["all", "pending", "completed"] as const).map(tab => (
            <TabsContent key={tab} value={tab} className="mt-3">
              {filtered(tab).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                  <CheckCircle weight="bold" className="size-8 text-emerald-500" />
                  <span className="text-sm">{en.homework.empty}</span>
                </div>
              ) : (
                <Accordion type="multiple" className="flex flex-col gap-2">
                  {filtered(tab).map(item => (
                    <Card key={item.id} className={`rounded-xl border-neutral-800 bg-neutral-900 transition-opacity ${item.done ? "opacity-60" : ""}`}>
                      <AccordionItem value={item.id} className="border-0">
                        <CardHeader className="px-4 pt-3 pb-0">
                          <AccordionTrigger className="hover:no-underline py-0 pb-3 [&>svg]:text-muted-foreground">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <Checkbox
                                checked={item.done}
                                onCheckedChange={() => toggle(item.id)}
                                onClick={e => e.stopPropagation()}
                                className="mt-0.5 shrink-0 border-neutral-600 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                              />
                              <div className="flex flex-col gap-1 min-w-0 text-left">
                                <CardTitle className={`text-xs font-medium leading-snug ${item.done ? "line-through text-muted-foreground" : ""}`}>
                                  {item.title}
                                </CardTitle>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${subjectColor[item.subject]}`}>
                                    {item.subject}
                                  </Badge>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className={`flex items-center gap-1 text-[10px] ${item.daysLeft <= 1 ? "text-red-400" : "text-muted-foreground"}`}>
                                        {item.daysLeft <= 1 && <Warning weight="bold" className="size-3" />}
                                        <ClockCountdown weight="bold" className="size-3" />
                                        {item.due}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom">
                                      <span>{item.daysLeft === 1 ? en.homework.due.tomorrow : en.homework.due.daysLeft(item.daysLeft)}</span>
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                              </div>
                            </div>
                          </AccordionTrigger>
                        </CardHeader>
                        <AccordionContent>
                          <CardContent className="px-4 pb-4 pt-0 flex flex-col gap-3">
                            <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
                            <div className="flex flex-col gap-1.5">
                              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{en.homework.steps}</span>
                              {item.steps.map((step, i) => (
                                <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <span className="size-4 rounded-full bg-neutral-800 flex items-center justify-center text-[10px] font-medium shrink-0">{i + 1}</span>
                                  {step}
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </AccordionContent>
                      </AccordionItem>
                    </Card>
                  ))}
                </Accordion>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </TooltipProvider>
  );
}
