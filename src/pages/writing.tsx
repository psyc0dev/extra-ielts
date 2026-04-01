import { useState } from "react";
import axios from "axios";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Sparkle, ArrowClockwise, PaperPlaneTilt } from "@phosphor-icons/react";
import { toast } from "sonner";

const TOPICS = [
  "Some people think that universities should provide graduates with the knowledge and skills needed in the workplace. Others think that the true function of a university is to give access to knowledge for its own sake. Discuss both views and give your opinion.",
  "In many countries, the proportion of older people is steadily increasing. Does this trend have more positive or negative effects on society?",
  "The best way to solve the world's environmental problems is to increase the price of fuel. To what extent do you agree or disagree?",
  "Some people believe that it is best to accept a bad situation, such as an unsatisfactory job or shortage of money. Others argue that it is better to try and improve such situations. Discuss both views and give your opinion.",
  "Governments should spend money on railways rather than roads. To what extent do you agree or disagree?",
  "Many people believe that social networking sites have had a huge negative impact on both individuals and society. To what extent do you agree?",
  "In some countries, owning a home rather than renting one is very important for people. Why might this be the case? Do you think this is a positive or negative situation?",
  "Some people think that a sense of competition in children should be encouraged. Others believe that children who are taught to co-operate rather than compete become more useful adults. Discuss both views and give your opinion.",
];

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
  const [result, setResult] = useState<EvalResult | null>(null);

  const generateTopic = () => {
    const next = TOPICS[Math.floor(Math.random() * TOPICS.length)];
    setTopic(next);
    setResult(null);
    setEssay("");
  };

  const evaluate = async () => {
    if (!topic.trim() || !essay.trim()) {
      toast.error("Please enter a topic and write your essay.");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const { data } = await axios.post(
        "https://82c6-35-197-62-23.ngrok-free.app/evaluate",
        { topic, essay },
        { headers: { "ngrok-skip-browser-warning": "1" } }
      );
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
          <Button variant="outline" size="sm" onClick={generateTopic} className="gap-1.5 text-xs h-7">
            <Sparkle weight="bold" className="size-3.5" /> Generate Topic
          </Button>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {topic ? (
            <p className="text-sm leading-relaxed text-neutral-200">{topic}</p>
          ) : (
            <p className="text-sm text-muted-foreground italic">Click "Generate Topic" to get a writing prompt.</p>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-xl border-neutral-800 bg-neutral-900">
        <CardHeader className="px-4 pt-4 pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold">Your Essay</CardTitle>
          <span className="text-xs text-muted-foreground">{wordCount} words</span>
        </CardHeader>
        <CardContent className="px-4 pb-4 flex flex-col gap-3">
          <Textarea
            placeholder="Write your essay here..."
            className="min-h-52 resize-none bg-neutral-950 border-neutral-700 text-sm leading-relaxed"
            value={essay}
            onChange={(e) => setEssay(e.target.value)}
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
