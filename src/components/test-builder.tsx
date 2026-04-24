import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash, Headphones, BookOpen } from "@phosphor-icons/react";
import { adminUploadTest, type TestDetail, type TestSummary } from "@/lib/api";
import { toast } from "sonner";
import en from "@/locales/en";

type QuestionType = TestDetail["sections"][number]["questions"][number]["type"];

type SectionDraft = {
  id: string;
  kind: "listening" | "reading";
  title: string;
  durationMinutes: string;
  audioUrl: string;
  passage: string;
  passageTitle: string;
  questions: QuestionDraft[];
};

type QuestionDraft = {
  id: string;
  type: QuestionType;
  prompt: string;
  points: string;
  correctAnswer: string;
  options: string[];
  items: string[];
  headings: string[];
};

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: "mcq", label: "Multiple Choice" },
  { value: "multiple-choice-multiple", label: "Multiple Choice (Multiple)" },
  { value: "short", label: "Short Answer" },
  { value: "true-false-notgiven", label: "True / False / Not Given" },
  { value: "yes-no-notgiven", label: "Yes / No / Not Given" },
  { value: "sentence-completion", label: "Sentence Completion" },
  { value: "note-completion", label: "Note Completion" },
  { value: "table-completion", label: "Table Completion" },
  { value: "summary-completion", label: "Summary Completion" },
  { value: "diagram-labelling", label: "Diagram Labelling" },
  { value: "form-completion", label: "Form Completion" },
  { value: "flowchart-completion", label: "Flowchart Completion" },
  { value: "map-labelling", label: "Map Labelling" },
  { value: "match-headings", label: "Match Headings" },
  { value: "matching", label: "Matching" },
  { value: "matching-paragraph-information", label: "Matching Paragraph Information" },
  { value: "matching-features", label: "Matching Features" },
  { value: "matching-sentence-endings", label: "Matching Sentence Endings" },
  { value: "choose-title", label: "Choose a Title" },
];

const TF_NG_OPTIONS = ["True", "False", "Not Given"];
const YN_NG_OPTIONS = ["Yes", "No", "Not Given"];

function needsOptions(type: QuestionType) {
  return type === "mcq" || type === "multiple-choice-multiple" || type === "choose-title";
}
function needsItems(type: QuestionType) {
  return [
    "matching", "note-completion", "table-completion", "diagram-labelling",
    "form-completion", "flowchart-completion", "map-labelling",
    "matching-paragraph-information", "matching-features", "matching-sentence-endings",
  ].includes(type);
}
function needsHeadings(type: QuestionType) {
  return type === "match-headings";
}
function isTFNG(type: QuestionType) {
  return type === "true-false-notgiven";
}
function isYNNG(type: QuestionType) {
  return type === "yes-no-notgiven";
}
function isMultiAnswer(type: QuestionType) {
  return type === "multiple-choice-multiple";
}

function createSection(kind: "listening" | "reading"): SectionDraft {
  return {
    id: crypto.randomUUID(),
    kind,
    title: "",
    durationMinutes: "",
    audioUrl: "",
    passage: "",
    passageTitle: "",
    questions: [createQuestion()],
  };
}

function createQuestion(): QuestionDraft {
  return {
    id: crypto.randomUUID(),
    type: "mcq",
    prompt: "",
    points: "1",
    correctAnswer: "",
    options: ["", ""],
    items: [],
    headings: [],
  };
}

function QuestionBuilder({
  question,
  index,
  onChange,
  onRemove,
}: {
  question: QuestionDraft;
  index: number;
  onChange: (q: QuestionDraft) => void;
  onRemove: () => void;
}) {
  const update = (patch: Partial<QuestionDraft>) => onChange({ ...question, ...patch });

  const handleTypeChange = (type: QuestionType) => {
    const patch: Partial<QuestionDraft> = { type };
    if (needsOptions(type) && question.options.length < 2) {
      patch.options = question.options.length >= 2 ? question.options : ["", ""];
    }
    if (needsItems(type) && question.items.length === 0) {
      patch.items = [""];
    }
    if (needsHeadings(type) && question.headings.length === 0) {
      patch.headings = ["", ""];
    }
    if (isTFNG(type) || isYNNG(type)) {
      patch.correctAnswer = "";
    }
    onChange({ ...question, ...patch });
  };

  return (
    <Card className="border-neutral-800 bg-neutral-950/50">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-muted-foreground">Q{index + 1}</span>
          <Select value={question.type} onValueChange={(v) => handleTypeChange(v as QuestionType)}>
            <SelectTrigger className="h-7 w-48 text-xs border-neutral-700 bg-neutral-900">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-48">
              {QUESTION_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" variant="ghost" className="h-6 px-1.5 text-red-400 hover:text-red-300 hover:bg-red-950/30" onClick={onRemove}>
          <Trash weight="bold" className="size-3" />
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Field>
          <FieldLabel>{en.testBuilder.prompt}</FieldLabel>
          <Textarea
            value={question.prompt}
            onChange={(e) => update({ prompt: e.target.value })}
            placeholder={en.testBuilder.promptPlaceholder}
            className="min-h-[60px] text-xs"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel>{en.testBuilder.points}</FieldLabel>
            <Input
              type="number"
              value={question.points}
              onChange={(e) => update({ points: e.target.value })}
              min={1}
              className="h-8 text-xs"
            />
          </Field>
          {(isTFNG(question.type) || isYNNG(question.type)) ? (
            <Field>
              <FieldLabel>{en.testBuilder.correctAnswer}</FieldLabel>
              <Select value={question.correctAnswer} onValueChange={(v) => update({ correctAnswer: v })}>
                <SelectTrigger className="h-8 text-xs border-neutral-700 bg-neutral-900">
                  <SelectValue placeholder={en.testBuilder.selectAnswer} />
                </SelectTrigger>
                <SelectContent>
                  {(isTFNG(question.type) ? TF_NG_OPTIONS : YN_NG_OPTIONS).map((o) => (
                    <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : (
            <Field>
              <FieldLabel>{en.testBuilder.correctAnswer}</FieldLabel>
              <Input
                value={question.correctAnswer}
                onChange={(e) => update({ correctAnswer: e.target.value })}
                placeholder={isMultiAnswer(question.type) ? en.testBuilder.correctAnswerMultiPlaceholder : en.testBuilder.correctAnswerPlaceholder}
                className="h-8 text-xs"
              />
            </Field>
          )}
        </div>

        {needsOptions(question.type) && (
          <Field>
            <FieldLabel>{en.testBuilder.options}</FieldLabel>
            <div className="flex flex-col gap-1.5">
              {question.options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground w-4 shrink-0">{String.fromCharCode(65 + i)}</span>
                  <Input
                    value={opt}
                    onChange={(e) => {
                      const next = [...question.options];
                      next[i] = e.target.value;
                      update({ options: next });
                    }}
                    placeholder={`${en.testBuilder.optionLabel(String.fromCharCode(65 + i))}`}
                    className="h-7 text-xs"
                  />
                  {question.options.length > 2 && (
                    <Button size="sm" variant="ghost" className="h-6 px-1 text-red-400 hover:text-red-300" onClick={() => update({ options: question.options.filter((_, j) => j !== i) })}>
                      <Trash weight="bold" className="size-3" />
                    </Button>
                  )}
                </div>
              ))}
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-neutral-700 self-start" onClick={() => update({ options: [...question.options, ""] })}>
                <Plus weight="bold" className="size-3" /> {en.testBuilder.addOption}
              </Button>
            </div>
          </Field>
        )}

        {needsHeadings(question.type) && (
          <Field>
            <FieldLabel>{en.testBuilder.headings}</FieldLabel>
            <div className="flex flex-col gap-1.5">
              {question.headings.map((h, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground w-4 shrink-0">H{i + 1}</span>
                  <Input
                    value={h}
                    onChange={(e) => {
                      const next = [...question.headings];
                      next[i] = e.target.value;
                      update({ headings: next });
                    }}
                    placeholder={`${en.testBuilder.headingLabel(i + 1)}`}
                    className="h-7 text-xs"
                  />
                  {question.headings.length > 2 && (
                    <Button size="sm" variant="ghost" className="h-6 px-1 text-red-400 hover:text-red-300" onClick={() => update({ headings: question.headings.filter((_, j) => j !== i) })}>
                      <Trash weight="bold" className="size-3" />
                    </Button>
                  )}
                </div>
              ))}
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-neutral-700 self-start" onClick={() => update({ headings: [...question.headings, ""] })}>
                <Plus weight="bold" className="size-3" /> {en.testBuilder.addHeading}
              </Button>
            </div>
          </Field>
        )}

        {needsItems(question.type) && (
          <Field>
            <FieldLabel>{en.testBuilder.items}</FieldLabel>
            <div className="flex flex-col gap-1.5">
              {question.items.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground w-4 shrink-0">{i + 1}</span>
                  <Input
                    value={item}
                    onChange={(e) => {
                      const next = [...question.items];
                      next[i] = e.target.value;
                      update({ items: next });
                    }}
                    placeholder={`${en.testBuilder.itemLabel(i + 1)}`}
                    className="h-7 text-xs"
                  />
                  {question.items.length > 1 && (
                    <Button size="sm" variant="ghost" className="h-6 px-1 text-red-400 hover:text-red-300" onClick={() => update({ items: question.items.filter((_, j) => j !== i) })}>
                      <Trash weight="bold" className="size-3" />
                    </Button>
                  )}
                </div>
              ))}
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-neutral-700 self-start" onClick={() => update({ items: [...question.items, ""] })}>
                <Plus weight="bold" className="size-3" /> {en.testBuilder.addItem}
              </Button>
            </div>
          </Field>
        )}
      </CardContent>
    </Card>
  );
}

function SectionBuilder({
  section,
  index,
  onChange,
  onRemove,
}: {
  section: SectionDraft;
  index: number;
  onChange: (s: SectionDraft) => void;
  onRemove: () => void;
}) {
  const update = (patch: Partial<SectionDraft>) => onChange({ ...section, ...patch });

  return (
    <Card className="border-neutral-800 bg-neutral-900/50">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          {section.kind === "listening" ? (
            <Headphones weight="bold" className="size-3.5 text-sky-400" />
          ) : (
            <BookOpen weight="bold" className="size-3.5 text-violet-400" />
          )}
          <CardTitle className="text-xs font-semibold">
            {en.testBuilder.sectionLabel(index + 1, section.kind === "listening" ? en.testRunner.kinds.listening : en.testRunner.kinds.reading)}
          </CardTitle>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-neutral-700 text-muted-foreground">
            {section.questions.length} {en.testBuilder.questions.toLowerCase()}
          </Badge>
        </div>
        <Button size="sm" variant="ghost" className="h-6 px-1.5 text-red-400 hover:text-red-300 hover:bg-red-950/30" onClick={onRemove}>
          <Trash weight="bold" className="size-3" />
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-3">
          <Field>
            <FieldLabel>{en.testBuilder.sectionKind}</FieldLabel>
            <Select value={section.kind} onValueChange={(v) => update({ kind: v as "listening" | "reading" })}>
              <SelectTrigger className="h-8 text-xs border-neutral-700 bg-neutral-900">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="listening" className="text-xs">{en.testRunner.kinds.listening}</SelectItem>
                <SelectItem value="reading" className="text-xs">{en.testRunner.kinds.reading}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>{en.testBuilder.sectionTitle}</FieldLabel>
            <Input
              value={section.title}
              onChange={(e) => update({ title: e.target.value })}
              placeholder={en.testBuilder.sectionTitlePlaceholder}
              className="h-8 text-xs"
            />
          </Field>
          <Field>
            <FieldLabel>{en.testBuilder.sectionDuration}</FieldLabel>
            <Input
              type="number"
              value={section.durationMinutes}
              onChange={(e) => update({ durationMinutes: e.target.value })}
              placeholder={en.testBuilder.sectionDurationPlaceholder}
              className="h-8 text-xs"
            />
          </Field>
        </div>

        {section.kind === "listening" ? (
          <Field>
            <FieldLabel>{en.testBuilder.audioUrl}</FieldLabel>
            <Input
              value={section.audioUrl}
              onChange={(e) => update({ audioUrl: e.target.value })}
              placeholder={en.testBuilder.audioUrlPlaceholder}
              className="h-8 text-xs"
            />
          </Field>
        ) : (
          <>
            <Field>
              <FieldLabel>{en.testBuilder.passageTitle}</FieldLabel>
              <Input
                value={section.passageTitle}
                onChange={(e) => update({ passageTitle: e.target.value })}
                placeholder={en.testBuilder.passageTitlePlaceholder}
                className="h-8 text-xs"
              />
            </Field>
            <Field>
              <FieldLabel>{en.testBuilder.passage}</FieldLabel>
              <Textarea
                value={section.passage}
                onChange={(e) => update({ passage: e.target.value })}
                placeholder={en.testBuilder.passagePlaceholder}
                className="min-h-[120px] text-xs"
              />
            </Field>
          </>
        )}

        <Separator className="bg-neutral-800" />

        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold">{en.testBuilder.questions}</span>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-neutral-700" onClick={() => update({ questions: [...section.questions, createQuestion()] })}>
            <Plus weight="bold" className="size-3" /> {en.testBuilder.addQuestion}
          </Button>
        </div>

        <div className="flex flex-col gap-3">
          {section.questions.map((q, i) => (
            <QuestionBuilder
              key={q.id}
              question={q}
              index={i}
              onChange={(updated) => {
                const next = [...section.questions];
                next[i] = updated;
                update({ questions: next });
              }}
              onRemove={() => update({ questions: section.questions.filter((_, j) => j !== i) })}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function TestBuilderDialog({ onCreated }: { onCreated: (test: TestSummary) => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState("120");
  const [sections, setSections] = useState<SectionDraft[]>([createSection("listening"), createSection("reading")]);

  const reset = () => {
    setTitle("");
    setDuration("120");
    setSections([createSection("listening"), createSection("reading")]);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error(en.testBuilder.validation.titleRequired);
      return;
    }
    if (sections.length === 0) {
      toast.error(en.testBuilder.validation.sectionRequired);
      return;
    }
    for (const s of sections) {
      if (s.questions.length === 0) {
        toast.error(en.testBuilder.validation.questionRequired);
        return;
      }
    }

    const testData: TestDetail = {
      id: "",
      title: title.trim(),
      durationMinutes: Number(duration) || 120,
      sections: sections.map((s) => ({
        id: s.id,
        kind: s.kind,
        title: s.title || `${s.kind === "listening" ? "Listening" : "Reading"} Section`,
        ...(s.durationMinutes ? { durationMinutes: Number(s.durationMinutes) } : {}),
        ...(s.kind === "listening" ? { audioUrl: s.audioUrl || null } : {}),
        ...(s.kind === "reading" ? { passage: s.passage || null, passageTitle: s.passageTitle || null } : {}),
        questions: s.questions.map((q): TestDetail["sections"][number]["questions"][number] => {
          const base: TestDetail["sections"][number]["questions"][number] = {
            id: q.id,
            type: q.type,
            prompt: q.prompt,
            points: Number(q.points) || 1,
          };
          if (needsOptions(q.type)) {
            base.options = q.options.filter((o) => o.trim());
          }
          if (needsItems(q.type)) {
            base.items = q.items.filter((o) => o.trim());
          }
          if (needsHeadings(q.type)) {
            base.headings = q.headings.filter((o) => o.trim());
          }
          if (q.correctAnswer) {
            if (isMultiAnswer(q.type)) {
              base.correctAnswer = q.correctAnswer.split(",").map((s) => s.trim()).filter(Boolean);
            } else {
              base.correctAnswer = q.correctAnswer;
            }
          }
          return base;
        }),
      })),
    };

    setSaving(true);
    try {
      const res = await adminUploadTest(testData as TestDetail);
      onCreated({
        id: res.test.id,
        title: testData.title,
        durationMinutes: testData.durationMinutes,
        sectionsCount: testData.sections.length,
        questionsCount: testData.sections.reduce((n, s) => n + s.questions.length, 0),
        published: false,
      });
      toast.success(en.admin.toasts.testUploaded);
      setOpen(false);
      reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create test");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1">
          <Plus weight="bold" className="size-3" /> {en.testBuilder.createTest}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl h-[85vh] border-neutral-800 bg-neutral-950 flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle className="text-sm">{en.testBuilder.title}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 overflow-hidden px-6">
          <div className="flex flex-col gap-4 pb-4">
            <FieldGroup>
              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <FieldLabel>{en.testBuilder.titleLabel}</FieldLabel>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={en.testBuilder.titlePlaceholder}
                    className="h-8 text-xs"
                  />
                </Field>
                <Field>
                  <FieldLabel>{en.testBuilder.durationLabel}</FieldLabel>
                  <Input
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    min={1}
                    className="h-8 text-xs"
                  />
                </Field>
              </div>
            </FieldGroup>

            <Separator className="bg-neutral-800" />

            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold">{en.testBuilder.sections}</span>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-neutral-700" onClick={() => setSections((prev) => [...prev, createSection("listening")])}>
                  <Plus weight="bold" className="size-3" /> {en.testRunner.kinds.listening}
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-neutral-700" onClick={() => setSections((prev) => [...prev, createSection("reading")])}>
                  <Plus weight="bold" className="size-3" /> {en.testRunner.kinds.reading}
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              {sections.map((s, i) => (
                <SectionBuilder
                  key={s.id}
                  section={s}
                  index={i}
                  onChange={(updated) => setSections((prev) => prev.map((sec, j) => j === i ? updated : sec))}
                  onRemove={() => setSections((prev) => prev.filter((_, j) => j !== i))}
                />
              ))}
            </div>
          </div>
        </ScrollArea>
        <DialogFooter className="px-6 py-4 shrink-0 border-t border-neutral-800">
          <Button variant="outline" size="sm" className="border-neutral-700" onClick={() => { setOpen(false); reset(); }}>
            {en.testBuilder.cancel}
          </Button>
          <Button size="sm" disabled={saving || !title.trim()} onClick={handleSave}>
            {saving ? en.testBuilder.saving : en.testBuilder.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

