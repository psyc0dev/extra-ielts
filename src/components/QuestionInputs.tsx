import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { TestDetail } from "@/lib/api";
import en from "@/locales/en";

type Question = TestDetail["sections"][number]["questions"][number];

export function QuestionInputWrapper({
  question,
  value,
  onChange,
  readOnly,
}: {
  question: Question;
  value: string | null;
  onChange: (value: string | null) => void;
  readOnly: boolean;
}) {
  const isChoice =
    question.type === "mcq" ||
    question.type === "true-false-notgiven" ||
    question.type === "yes-no-notgiven" ||
    question.type === "match-headings" ||
    question.type === "matching" ||
    question.type === "matching-paragraph-information" ||
    question.type === "matching-features" ||
    question.type === "choose-title";

  if (isChoice) {
    return <ChoiceQuestion question={question} value={value} onChange={onChange} readOnly={readOnly} />;
  }
  if (question.type === "multiple-choice-multiple") {
    return <MultiSelectQuestion question={question} value={value} onChange={onChange} readOnly={readOnly} />;
  }
  if (question.type === "matching-sentence-endings") {
    return <MatchingQuestion question={question} value={value} onChange={onChange} readOnly={readOnly} />;
  }
  if (
    question.type === "short" ||
    question.type === "sentence-completion" ||
    question.type === "diagram-labelling" ||
    question.type === "map-labelling" ||
    question.type === "summary-completion"
  ) {
    return <ShortAnswerQuestion question={question} value={value} onChange={onChange} readOnly={readOnly} />;
  }
  if (
    question.type === "note-completion" ||
    question.type === "table-completion" ||
    question.type === "form-completion" ||
    question.type === "flowchart-completion"
  ) {
    return <CompletionQuestion question={question} value={value} onChange={onChange} readOnly={readOnly} />;
  }

  // Fallback
  return <LongAnswerQuestion question={question} value={value} onChange={onChange} readOnly={readOnly} />;
}

function LongAnswerQuestion({ question, value, onChange, readOnly }: { question: Question; value: string | null; onChange: (v: string | null) => void; readOnly: boolean }) {
  return (
    <Textarea
      value={String(value ?? "")}
      onChange={(e) => onChange(e.target.value)}
      rows={4}
      className="text-xs bg-neutral-900/40 border-neutral-800/60 focus-visible:ring-1 focus-visible:ring-blue-500/30 focus-visible:border-blue-500/50 rounded-md p-2 resize-y min-h-[80px] font-medium shadow-sm transition-all"
      placeholder={en.questionInputs.writeResponse}
      readOnly={readOnly}
    />
  );
}

function ChoiceQuestion({ question, value, onChange, readOnly }: { question: Question; value: string | null; onChange: (v: string | null) => void; readOnly: boolean }) {
  return (
    <ScrollArea className="max-h-[160px] pr-3 -mr-3">
      <RadioGroup value={String(value ?? "")} onValueChange={onChange} className="flex flex-col gap-0.5" disabled={readOnly}>
        {(question.options ?? []).map((option) => (
          <label
          key={option}
          className={`flex items-center gap-2 px-2 py-1 rounded-md border transition-all cursor-[inherit] ${
            value === option
              ? "border-blue-500/30 bg-blue-500/10 text-blue-50 shadow-sm"
              : "border-neutral-800/60 bg-neutral-900/30 hover:bg-neutral-800/80 hover:border-neutral-700/80 text-neutral-300"
          } ${readOnly && value !== option ? "opacity-40" : "cursor-pointer"}`}
        >
          <div className="pt-0.5 shrink-0">
            <RadioGroupItem value={option} id={`${question.id}-${option}`} className={value === option ? "border-blue-500 text-blue-500" : ""} />
          </div>
          <span className="text-xs font-medium flex-1 select-none">{option}</span>
        </label>
      ))}
      </RadioGroup>
    </ScrollArea>
  );
}

function MultiSelectQuestion({ question, value, onChange, readOnly }: { question: Question; value: string | null; onChange: (v: string | null) => void; readOnly: boolean }) {
  const max = Array.isArray(question.correctAnswer) ? question.correctAnswer.length : 2;
  const selected: string[] = (() => {
    try {
      return JSON.parse(value ?? "[]");
    } catch {
      return [];
    }
  })();

  const toggle = (option: string) => {
    if (selected.includes(option)) {
      onChange(JSON.stringify(selected.filter((o) => o !== option)));
    } else if (selected.length < max) {
      onChange(JSON.stringify([...selected, option]));
    }
  };

  return (
    <div className="flex flex-col gap-0.5">
      <ScrollArea className="max-h-[160px] pr-3 -mr-3 mt-0.5">
        <div className="flex flex-col gap-0.5">
          {(question.options ?? []).map((option) => {
            const isChecked = selected.includes(option);
        const isDisabled = readOnly || (!isChecked && selected.length >= max);
        return (
          <label
            key={option}
            className={`flex items-center gap-2 px-2 py-1 rounded-md border transition-all cursor-[inherit] ${
              isChecked
                ? "border-blue-500/30 bg-blue-500/10 text-blue-50 shadow-sm"
                : "border-neutral-800/60 bg-neutral-900/30 hover:bg-neutral-800/80 hover:border-neutral-700/80 text-neutral-300"
            } ${isDisabled ? (isChecked ? "opacity-80" : "opacity-40 cursor-not-allowed") : "cursor-pointer"}`}
          >
            <div className="pt-0.5 shrink-0">
              <Checkbox checked={isChecked} onCheckedChange={() => !readOnly && toggle(option)} disabled={isDisabled} className={isChecked ? "border-blue-500 data-[state=checked]:bg-blue-500" : ""} />
            </div>
            <span className="text-xs font-medium flex-1 select-none">{option}</span>
          </label>
        );
      })}
        </div>
      </ScrollArea>
    </div>
  );
}

function MatchingQuestion({ question, value, onChange, readOnly }: { question: Question; value: string | null; onChange: (v: string | null) => void; readOnly: boolean }) {
  const stems = question.items ?? [];
  const endings = question.options ?? [];
  const stored: string[] = (() => {
    try {
      return JSON.parse(value ?? "[]");
    } catch {
      return [];
    }
  })();

  return (
    <div className="flex flex-col gap-1.5 p-2 rounded-lg border border-neutral-800/50 bg-neutral-900/20 shadow-sm">
      {stems.map((stem, i) => (
        <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-1.5 p-1.5 rounded-md bg-neutral-900/60 border border-neutral-800/80">
          <span className="text-xs text-neutral-300 font-medium flex-1">{stem}</span>
          <Select
            value={stored[i] ?? ""}
            onValueChange={(v) => {
              const next = [...stored];
              for (let j = 0; j < i; j++) if (!next[j]) next[j] = "";
              next[i] = v;
              onChange(JSON.stringify(next));
            }}
            disabled={readOnly}
          >
            <SelectTrigger className="w-full sm:w-48 h-7 text-xs bg-neutral-950 border-neutral-700/80 hover:border-blue-500/50 transition-colors focus:ring-1 focus:ring-blue-500/50">
              <SelectValue placeholder={en.questionInputs.selectPlaceholder} />
            </SelectTrigger>
            <SelectContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
              {endings.map((e) => (
                <SelectItem key={e} value={e} className="text-xs py-1 focus:bg-blue-500/10 focus:text-blue-500">
                  {e}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}
    </div>
  );
}

function ShortAnswerQuestion({ question, value, onChange, readOnly }: { question: Question; value: string | null; onChange: (v: string | null) => void; readOnly: boolean }) {
  return (
    <div className="relative group max-w-sm">
      <Input
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
        placeholder={en.questionInputs.yourAnswer}
        className="h-7 px-2 text-xs bg-neutral-900/40 border border-neutral-800/80 focus-visible:ring-1 focus-visible:ring-blue-500/40 focus-visible:border-blue-500/60 rounded-md transition-all shadow-sm placeholder:text-neutral-600 font-medium"
        readOnly={readOnly}
      />
    </div>
  );
}

function CompletionQuestion({ question, value, onChange, readOnly }: { question: Question; value: string | null; onChange: (v: string | null) => void; readOnly: boolean }) {
  const expected = Array.isArray(question.correctAnswer) ? question.correctAnswer : [question.correctAnswer ?? ""];
  const stored = (() => {
    const s = String(value ?? "");
    if (!s || s === "null" || s === "") return [];
    try {
      const parsed = JSON.parse(s);
      return Array.isArray(parsed) ? parsed : [String(parsed)];
    } catch {
      return [s];
    }
  })();
  const parts = stored;

  return (
    <div className="p-2 bg-neutral-900/30 rounded-lg border border-neutral-800/60 shadow-sm max-w-2xl">
      <div className="grid gap-2 sm:grid-cols-2">
        {expected.map((_, i) => (
          <div key={i} className="flex flex-col gap-0.5 focus-within:text-blue-400 text-neutral-500 transition-colors">
            <label className="text-[9px] font-bold uppercase tracking-widest pl-0.5">{en.questionInputs.part(i + 1)}</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-2 pointer-events-none">
                <span className="text-[11px] font-semibold">{i + 1}.</span>
              </div>
              <Input
                value={String(parts[i] ?? "")}
                onChange={(e) => {
                  const next = [...parts];
                  for (let j = 0; j < i; j++) if (next[j] === undefined) next[j] = "";
                  next[i] = e.target.value;
                  onChange(JSON.stringify(next));
                }}
                placeholder={en.questionInputs.answer(i + 1)}
                className="pl-6 h-7 text-xs bg-neutral-950/80 border-neutral-800 focus-visible:border-blue-500/60 focus-visible:ring-1 focus-visible:ring-blue-500/40 text-neutral-200 rounded-md shadow-sm"
                readOnly={readOnly}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
