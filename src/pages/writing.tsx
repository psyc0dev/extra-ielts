import { useState } from "react";
import { Client } from "@gradio/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Sparkle, ArrowClockwise, PaperPlaneTilt } from "@phosphor-icons/react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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

type EvalResult = {
  summary: string;
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
      const client = await Client.connect("https://75ab3dcb50778d916b.gradio.live/");
      const res = await client.predict("/evaluate", { topic, essay });
      const [summary] = res.data as [string, ...unknown[]];
      setResult({ summary });
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
          <CardHeader className="px-4 pt-4 pb-3">
            <CardTitle className="text-sm font-semibold">Evaluation Results</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-sm leading-relaxed prose prose-invert prose-sm max-w-none
              [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs
              [&_th]:border [&_th]:border-neutral-700 [&_th]:px-3 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-semibold [&_th]:bg-neutral-800
              [&_td]:border [&_td]:border-neutral-700 [&_td]:px-3 [&_td]:py-1.5
              [&_strong]:text-white [&_em]:text-neutral-300
              [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-4 [&_li]:mb-0.5
              [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1
              [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1
              [&_hr]:border-neutral-700 [&_hr]:my-2">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.summary}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
