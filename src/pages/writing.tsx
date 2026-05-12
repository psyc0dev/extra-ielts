import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import loadingLottie from "@/assets/loading.lottie";
import { generateWritingTopic, evaluateWritingEssay, getWritingHistory, getWritingSubmission, type WritingSubmissionSummary } from "@/lib/api";
import { open } from "@tauri-apps/plugin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkle, ArrowClockwise, PaperPlaneTilt, ClockCounterClockwise, Eye, ArrowLeft } from "@phosphor-icons/react";
import { toast } from "sonner";
import en from "@/locales/en";

type CriterionScore = { score: number; label: string; comment: string; sub_scores: Record<string, number> };
type EvalResult = {
  word_count: number;
  penalty: number;
  overall: number;
  overall_label: string;
  criteria: {
    task_response: CriterionScore;
    coherence_and_cohesion: CriterionScore;
    grammatical_range_and_accuracy: CriterionScore;
    lexical_resource: CriterionScore;
  };
};

type CriteriaItem = typeof en.writing.criteriaCard.criteria[number];

function CriteriaAccordion({ c }: { c: CriteriaItem }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-950 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-3 py-2.5 cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-violet-400 bg-violet-400/10 px-1.5 py-0.5 rounded shrink-0">{c.key}</span>
          <span className="text-xs font-semibold text-neutral-200">{c.label}</span>
        </div>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-neutral-500 text-xs shrink-0"
        >▾</motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 flex flex-col gap-2">
              <p className="text-[11px] text-neutral-400 leading-relaxed">{c.summary}</p>
              <ul className="flex flex-col gap-1">
                {c.points.map((point, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04, duration: 0.2 }}
                    className="flex items-start gap-1.5 text-[11px] text-neutral-500"
                  >
                    <span className="text-violet-500 mt-0.5 shrink-0">▸</span>{point}
                  </motion.li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Writing() {
  const [topic, setTopic] = useState("");
  const [essay, setEssay] = useState("");
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<EvalResult | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const generateTopic = async () => {
    setGenerating(true);
    setResult(null);
    setEssay("");
    try {
      const data = await generateWritingTopic();
      if (data.error) throw new Error(data.error);
      setTopic(data.topic);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : en.writing.errors.generateFailed);
    } finally {
      setGenerating(false);
    }
  };

  const evaluate = async () => {
    if (!topic.trim() || !essay.trim()) {
      toast.error(en.writing.errors.missingInput);
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const data = await evaluateWritingEssay({ topic, essay });
      if (data.error) throw new Error(data.error);
      setResult(data);
      toast.success(en.writing.toasts.evaluationFinished);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : en.writing.errors.evaluationFailed);
    } finally {
      setLoading(false);
    }
  };

  const wordCount = essay.trim() ? essay.trim().split(/\s+/).length : 0;

  return (
    <div className="p-5 flex flex-col gap-4 font-body">
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0, ease: 'easeOut' }}
        className="relative overflow-hidden rounded-2xl border border-neutral-800 bg-[linear-gradient(135deg,rgba(22,22,22,0.9),rgba(30,20,50,0.95))] p-5">
        <div className="absolute inset-0 opacity-40 [background:radial-gradient(circle_at_top_right,rgba(139,92,246,0.25),transparent_55%)]" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <Badge variant="outline" className="border-violet-400/40 text-violet-200 -ml-1">{en.writing.hero.badge}</Badge>
            <h1 className="text-xl font-display tracking-wide">{en.writing.hero.title}</h1>
            <p className="text-xs text-muted-foreground max-w-lg">{en.writing.hero.subtitle}</p>
          </div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: 0.06, ease: 'easeOut' }}>
      <Card className="rounded-xl border-neutral-800 bg-neutral-900">
        <CardHeader className="px-4 pt-4 pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold">{en.writing.criteriaCard.title}</CardTitle>
          <button
            onClick={() => open("https://ielts.org/cdn/Guides/ielts-writing-key-assessment-criteria.pdf")}
            className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
          >
            {en.writing.criteriaCard.viewPDF}
          </button>
        </CardHeader>
        <CardContent className="px-4 pb-4 flex flex-col gap-2">
          {en.writing.criteriaCard.criteria.map((c) => (
            <CriteriaAccordion key={c.key} c={c} />
          ))}
        </CardContent>
      </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: 0.12, ease: 'easeOut' }}>
      <Card className="rounded-xl border-neutral-800 bg-neutral-900">
        <CardHeader className="px-4 pt-4 pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold">{en.writing.topicCard.title}</CardTitle>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={generateTopic} disabled={generating} className="gap-1.5 text-xs h-7">
              <Sparkle weight="bold" className="size-3.5" /> {generating ? en.writing.topicCard.generating : en.writing.topicCard.generateButton}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {generating ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-5/6" />
            </div>
          ) : (
            <Textarea
              placeholder={en.writing.topicCard.placeholder}
              className="min-h-20 resize-none overflow-hidden bg-neutral-950 border-neutral-700 text-sm leading-relaxed"
              value={topic}
              onChange={(e) => {
                setTopic(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = e.target.scrollHeight + "px";
              }}
            />
          )}
        </CardContent>
      </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: 0.18, ease: 'easeOut' }}>
      <Card className="relative rounded-xl border-neutral-800 bg-neutral-900">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-neutral-900/80 backdrop-blur-sm">
            <DotLottieReact src={loadingLottie} autoplay loop style={{ width: 120, height: 120, filter: "invert(1)" }} />
          </div>
        )}
        <CardHeader className="px-4 pt-4 pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold">{en.writing.essayCard.title}</CardTitle>
          <span className="text-xs text-muted-foreground">{wordCount} {en.writing.essayCard.wordsSuffix}</span>
        </CardHeader>
        <CardContent className="px-4 pb-4 flex flex-col gap-3">
          <Textarea
            placeholder={en.writing.essayCard.placeholder}
            className="min-h-52 resize-none overflow-hidden bg-neutral-950 border-neutral-700 text-sm leading-relaxed"
            value={essay}
            onChange={(e) => {
              setEssay(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = e.target.scrollHeight + "px";
            }}
          />
          <div className="flex justify-end gap-2">
            {result && (
              <Button variant="ghost" size="sm" onClick={() => { setEssay(""); setResult(null); }} className="gap-1.5 text-xs">
                <ArrowClockwise weight="bold" className="size-3.5" /> {en.writing.essayCard.reset}
              </Button>
            )}
            <Button size="sm" onClick={evaluate} disabled={loading} className="gap-1.5 text-xs">
              <PaperPlaneTilt weight="bold" className="size-3.5" />
              {loading ? en.writing.essayCard.evaluating : en.writing.essayCard.evaluate}
            </Button>
          </div>
        </CardContent>
      </Card>
      </motion.div>

      <div ref={resultsRef}>
        {result && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: 'easeOut' }}>
          <Card className="rounded-xl border-neutral-800 bg-neutral-900">
          <CardHeader className="px-4 pt-4 pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">{en.writing.resultsCard.title}</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{en.writing.resultsCard.wordCount(result.word_count)}</span>
              {result.penalty > 0 && (
                <span className="text-xs text-amber-400">{en.writing.resultsCard.penalty(result.penalty)}</span>
              )}
              <Badge variant="outline" className="border-violet-400/40 text-violet-200 text-xs">
                {en.writing.resultsCard.overall(result.overall, result.overall_label)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 flex flex-col gap-2">
            {(Object.entries(result.criteria) as [string, CriterionScore][]).map(([key, val]) => (
              <div key={key} className="rounded-lg border border-neutral-800 bg-neutral-950 p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold capitalize text-neutral-300">{key.replace(/_/g, " ")}</span>
                  <span className="text-xs text-violet-300">{val.score} · {val.label}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(val.sub_scores).map(([sk, sv]) => (
                    <span key={sk} className="flex items-center gap-1 text-[10px] bg-neutral-900 border border-neutral-700 rounded px-1.5 py-0.5">
                      <span className="text-neutral-400 capitalize">{sk.replace(/_/g, " ")}</span>
                      <span className="text-violet-400 font-semibold">{sv}</span>
                    </span>
                  ))}
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed">{val.comment}</p>
              </div>
            ))}
          </CardContent>
          </Card>
          </motion.div>
        )}
      </div>

      {/* Writing History */}
      <WritingHistory />
    </div>
  );
}

function WritingHistory() {
  const [submissions, setSubmissions] = useState<WritingSubmissionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<(WritingSubmissionSummary & { essay: string }) | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  useEffect(() => {
    getWritingHistory()
      .then((res) => setSubmissions(res.submissions))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const viewSubmission = async (id: string) => {
    setViewLoading(true);
    try {
      const res = await getWritingSubmission(id);
      setViewing(res.submission);
    } catch {
      toast.error(en.writing.history.loadFailed);
    } finally {
      setViewLoading(false);
    }
  };

  if (viewing) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <Card className="rounded-xl border-neutral-800 bg-neutral-900">
          <CardHeader className="px-4 pt-4 pb-3 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setViewing(null)}>
                <ArrowLeft weight="bold" className="size-4" />
              </Button>
              <CardTitle className="text-sm font-semibold">{en.writing.history.pastSubmission}</CardTitle>
            </div>
            <Badge variant="outline" className="border-violet-400/40 text-violet-200 text-xs">
              {viewing.overallScore ?? "—"} · {viewing.overallLabel ?? "N/A"}
            </Badge>
          </CardHeader>
          <CardContent className="px-4 pb-4 flex flex-col gap-3">
            <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-3">
              <p className="text-[11px] text-muted-foreground mb-1 font-medium">{en.writing.history.topic}</p>
              <p className="text-sm text-neutral-200 leading-relaxed">{viewing.topic}</p>
            </div>
            <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[11px] text-muted-foreground font-medium">{en.writing.history.essay}</p>
                <span className="text-[10px] text-muted-foreground">{viewing.wordCount} {en.writing.history.words}</span>
              </div>
              <ScrollArea className="max-h-48">
                <p className="text-sm text-neutral-300 leading-relaxed whitespace-pre-wrap">{viewing.essay}</p>
              </ScrollArea>
            </div>
            {viewing.criteria && (
              <div className="flex flex-col gap-2">
                {Object.entries(viewing.criteria).map(([key, val]) => (
                  <div key={key} className="rounded-lg border border-neutral-800 bg-neutral-950 p-3 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold capitalize text-neutral-300">{key.replace(/_/g, " ")}</span>
                      <span className="text-xs text-violet-300">{val.score} · {val.label}</span>
                    </div>
                    <p className="text-xs text-neutral-400 leading-relaxed">{val.comment}</p>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[10px] text-muted-foreground text-right">
              {new Date(viewing.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </p>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: 0.24, ease: "easeOut" }}
    >
      <Card className="rounded-xl border-neutral-800 bg-neutral-900">
        <CardHeader className="px-4 pt-4 pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ClockCounterClockwise weight="bold" className="size-4 text-violet-400" />
            {en.writing.history.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {loading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-lg" />
              ))}
            </div>
          ) : submissions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <ClockCounterClockwise weight="duotone" className="size-8 text-muted-foreground/30 mb-2" />
              <p className="text-xs text-muted-foreground">{en.writing.history.empty}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {submissions.map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => viewSubmission(sub.id)}
                  className="w-full text-left rounded-lg border border-neutral-800 bg-neutral-950 p-3 hover:border-neutral-700 transition-colors flex items-center justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-neutral-200 truncate">{sub.topic}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-muted-foreground">{sub.wordCount} {en.writing.history.words}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(sub.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {sub.overallScore != null && (
                      <Badge variant="outline" className="border-violet-400/40 text-violet-200 text-[10px] px-1.5 py-0">
                        {sub.overallScore}
                      </Badge>
                    )}
                    <Eye weight="bold" className="size-3.5 text-muted-foreground" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
