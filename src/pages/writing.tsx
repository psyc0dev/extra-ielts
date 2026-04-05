import { useState } from "react";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import loadingLottie from "@/assets/loading.lottie";
import { CopyButton } from "@/components/animate-ui/components/buttons/copy";
import { generateWritingTopic, evaluateWritingEssay } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Sparkle, ArrowClockwise, PaperPlaneTilt } from "@phosphor-icons/react";
import { toast } from "sonner";

type CriterionScore = { score: number; label: string; comment: string };
type EvalResult = {
  word_count: number;
  penalty: number;
  overall: number;
  overall_label: string;
  criteria: {
    task_response: CriterionScore;
    coherence_and_cohesion: CriterionScore;
    lexical_resource: CriterionScore;
    grammatical_range_and_accuracy: CriterionScore;
  };
};

export function Writing() {
  const [topic, setTopic] = useState("");
  const [essay, setEssay] = useState("");
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<EvalResult | null>(null);

  const generateTopic = async () => {
    setGenerating(true);
    setResult(null);
    setEssay("");
    try {
      const data = await generateWritingTopic();
      if (data.error) throw new Error(data.error);
      setTopic(data.topic);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate topic.");
    } finally {
      setGenerating(false);
    }
  };

  const evaluate = async () => {
    if (!topic.trim() || !essay.trim()) {
      toast.error("Please enter a topic and write your essay.");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const data = await evaluateWritingEssay({ topic, essay });
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Evaluation failed.");
    } finally {
      setLoading(false);
    }
  };

  const wordCount = essay.trim() ? essay.trim().split(/\s+/).length : 0;

  return (
    <div className="p-5 flex flex-col gap-4 font-body">
      <div className="relative overflow-hidden rounded-2xl border border-neutral-800 bg-[linear-gradient(135deg,rgba(22,22,22,0.9),rgba(30,20,50,0.95))] p-5">
        <div className="absolute inset-0 opacity-40 [background:radial-gradient(circle_at_top_right,rgba(139,92,246,0.25),transparent_55%)]" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <Badge variant="outline" className="border-violet-400/40 text-violet-200 -ml-1">AI Evaluation</Badge>
            <h1 className="text-xl font-display tracking-wide">Writing Practice</h1>
            <p className="text-xs text-muted-foreground max-w-lg">Generate a topic, write your essay, and get instant AI feedback on your band score.</p>
          </div>
        </div>
      </div>

      <Card className="rounded-xl border-neutral-800 bg-neutral-900">
        <CardHeader className="px-4 pt-4 pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold">Topic</CardTitle>
          <div className="flex items-center gap-1">
            {topic && <CopyButton content={topic} variant="ghost" size="sm" />}
            <Button variant="outline" size="sm" onClick={generateTopic} disabled={generating} className="gap-1.5 text-xs h-7">
              <Sparkle weight="bold" className="size-3.5" /> {generating ? "Generating..." : "Generate Topic"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {generating ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-5/6" />
            </div>
          ) : topic ? (
            <p className="text-sm leading-relaxed text-neutral-200">{topic}</p>
          ) : (
            <p className="text-sm text-muted-foreground italic">Click "Generate Topic" to get a writing prompt.</p>
          )}
        </CardContent>
      </Card>

      <Card className="relative rounded-xl border-neutral-800 bg-neutral-900">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-neutral-900/80 backdrop-blur-sm">
            <DotLottieReact src={loadingLottie} autoplay loop style={{ width: 120, height: 120, filter: "invert(1)" }} />
          </div>
        )}
        <CardHeader className="px-4 pt-4 pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold">Your Essay</CardTitle>
          <span className="text-xs text-muted-foreground">{wordCount} words</span>
        </CardHeader>
        <CardContent className="px-4 pb-4 flex flex-col gap-3">
          <Textarea
            placeholder="Write your essay here..."
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
                <ArrowClockwise weight="bold" className="size-3.5" /> Reset
              </Button>
            )}
            <Button size="sm" onClick={evaluate} disabled={loading} className="gap-1.5 text-xs">
              <PaperPlaneTilt weight="bold" className="size-3.5" />
              {loading ? "Evaluating..." : "Evaluate"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card className="rounded-xl border-neutral-800 bg-neutral-900">
          <CardHeader className="px-4 pt-4 pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">Evaluation Results</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{result.word_count} words</span>
              {result.penalty > 0 && (
                <span className="text-xs text-amber-400">−{result.penalty} penalty</span>
              )}
              <Badge variant="outline" className="border-violet-400/40 text-violet-200 text-xs">
                Overall {result.overall} · {result.overall_label}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 flex flex-col gap-2">
            {(Object.entries(result.criteria) as [string, CriterionScore][]).map(([key, val]) => (
              <div key={key} className="rounded-lg border border-neutral-800 bg-neutral-950 p-3 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold capitalize text-neutral-300">
                    {key.replace(/_/g, " ")}
                  </span>
                  <span className="text-xs text-violet-300">{val.score} · {val.label}</span>
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed">{val.comment}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
