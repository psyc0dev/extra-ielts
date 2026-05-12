import { useState, useCallback, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  SpeakerHigh,
  SpeakerSlash,
  SpeakerLow,
  SpeakerNone,
  ArrowCounterClockwise,
  ArrowRight,
  ArrowLeft,
  BookOpen,
  CircleNotch,
  Cards,
  ListBullets,
  Check,
  X,
  Shuffle,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { speakText } from "@/lib/tts";
import { toast } from "sonner";
import { getVocabularyTest, getDictionaryEntry, getSimilarWords, type VocabularyWord, type DictionaryEntry, type DictDefinition } from "@/lib/vocabulary-api";
import en from "@/locales/en";

type VocabMode = "quiz" | "flashcards";
type CardStatus = "unseen" | "known" | "learning";

interface FlashcardWord extends VocabularyWord {
  status: CardStatus;
}

// ─── Flashcard Mode ───────────────────────────────────────────────────────────

function FlashCard({ word, flipped, onFlip, dragOffset }: {
  word: FlashcardWord; flipped: boolean; onFlip: () => void; dragOffset: number;
}) {
  const glowOpacity = Math.min(Math.abs(dragOffset) / 150, 1);
  const glowColor = dragOffset > 0
    ? `rgba(34,197,94,${glowOpacity * 0.4})`
    : dragOffset < 0
      ? `rgba(239,68,68,${glowOpacity * 0.4})`
      : "transparent";

  return (
    <div className="relative w-full cursor-pointer select-none" onClick={onFlip}>
      <motion.div
        className="absolute inset-0 rounded-2xl"
        animate={{ boxShadow: `0 0 30px ${glowColor}` }}
        transition={{ duration: 0.15 }}
      />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={flipped ? "back" : "front"}
          initial={{ rotateY: flipped ? -90 : 90, opacity: 0 }}
          animate={{ rotateY: 0, opacity: 1 }}
          exit={{ rotateY: flipped ? 90 : -90, opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className={`rounded-2xl border border-neutral-700/50 p-6 flex flex-col items-center justify-center min-h-[200px] ${
            flipped
              ? "bg-[linear-gradient(145deg,rgba(30,58,138,0.3),rgba(15,23,42,0.95))]"
              : "bg-[linear-gradient(145deg,rgba(22,22,22,0.95),rgba(30,30,40,0.95))]"
          }`}
        >
          <div className="absolute inset-0 rounded-2xl opacity-20 [background:radial-gradient(circle_at_top_right,rgba(99,102,241,0.2),transparent_60%)]" />
          {!flipped ? (
            <div className="relative flex flex-col items-center gap-3 text-center">
              <Badge variant="outline" className="border-neutral-600 text-neutral-400 text-[10px]">{en.vocabulary.flashcards.word}</Badge>
              <h2 className="text-2xl font-bold tracking-wide">{word.word}</h2>
              <p className="text-[11px] text-muted-foreground mt-2">{en.vocabulary.flashcards.tapToReveal}</p>
            </div>
          ) : (
            <div className="relative flex flex-col items-center gap-3 text-center">
              <Badge variant="outline" className="border-indigo-500/40 text-indigo-300 text-[10px]">{en.vocabulary.flashcards.meaning}</Badge>
              <p className="text-base font-medium leading-relaxed text-neutral-200 max-w-xs">{word.meaning}</p>
              <div className="mt-2 px-2.5 py-1 rounded-lg bg-neutral-800/60 border border-neutral-700/50">
                <span className="text-sm font-semibold text-neutral-300">{word.word}</span>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function FlashcardsMode({ words: initialWords, volume, onNewSet }: {
  words: VocabularyWord[]; volume: number; onNewSet: () => void;
}) {
  const [cards, setCards] = useState<FlashcardWord[]>(() =>
    initialWords.map((w) => ({ ...w, status: "unseen" as CardStatus }))
  );
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);

  useEffect(() => {
    setCards(initialWords.map((w) => ({ ...w, status: "unseen" as CardStatus })));
    setIndex(0);
    setFlipped(false);
  }, [initialWords]);

  const current = cards[index];
  const known = useMemo(() => cards.filter((w) => w.status === "known").length, [cards]);
  const learning = useMemo(() => cards.filter((w) => w.status === "learning").length, [cards]);
  const unseen = useMemo(() => cards.filter((w) => w.status === "unseen").length, [cards]);
  const progress = cards.length ? ((cards.length - unseen) / cards.length) * 100 : 0;

  const markCard = (status: "known" | "learning") => {
    setCards((prev) => prev.map((w, i) => i === index ? { ...w, status } : w));
    goNext();
  };

  const goNext = () => {
    setFlipped(false);
    setDragOffset(0);
    if (index < cards.length - 1) {
      setIndex((i) => i + 1);
    } else {
      const remaining = cards.filter((w) => w.status !== "known");
      if (remaining.length <= 1) {
        toast.success(en.vocabulary.flashcards.allReviewed);
      } else {
        setIndex(0);
      }
    }
  };

  const goPrev = () => {
    if (index > 0) {
      setFlipped(false);
      setDragOffset(0);
      setIndex((i) => i - 1);
    }
  };

  const handleSpeak = async () => {
    if (playing || !current) return;
    setPlaying(true);
    try { await speakText(current.word, volume); }
    catch { toast.error(en.vocabulary.pronunciationError); }
    finally { setPlaying(false); }
  };

  const shuffleCards = () => {
    setCards((prev) => {
      const shuffled = [...prev];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    });
    setIndex(0);
    setFlipped(false);
    toast.success(en.vocabulary.flashcards.shuffled);
  };

  if (!current) return null;

  return (
    <div className="flex flex-col gap-4 max-w-md mx-auto">
      {/* Controls row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="border-neutral-700 h-7 text-xs gap-1" onClick={shuffleCards}>
            <Shuffle weight="bold" className="size-3" /> {en.vocabulary.flashcards.shuffle}
          </Button>
          <Button size="sm" variant="outline" className="border-neutral-700 h-7 text-xs gap-1" onClick={onNewSet}>
            <ArrowCounterClockwise weight="bold" className="size-3" /> {en.vocabulary.flashcards.newSet}
          </Button>
        </div>
        <span className="text-xs text-muted-foreground">{index + 1} / {cards.length}</span>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-3">
        <Progress value={progress} className="h-1.5 flex-1" indicatorClassName="bg-purple-500" />
        <div className="flex items-center gap-2.5 text-[11px] shrink-0">
          <span className="flex items-center gap-1 text-emerald-400"><Check weight="bold" className="size-3" />{known}</span>
          <span className="flex items-center gap-1 text-amber-400"><ArrowCounterClockwise weight="bold" className="size-2.5" />{learning}</span>
          <span className="text-muted-foreground">{unseen} {en.vocabulary.flashcards.left}</span>
        </div>
      </div>

      {/* Card */}
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.6}
        onDrag={(_, info) => setDragOffset(info.offset.x)}
        onDragEnd={(_, info) => {
          if (info.offset.x > 80) markCard("known");
          else if (info.offset.x < -80) markCard("learning");
          setDragOffset(0);
        }}
        animate={{ x: 0 }}
        className="touch-none"
      >
        <FlashCard word={current} flipped={flipped} onFlip={() => setFlipped((f) => !f)} dragOffset={dragOffset} />
      </motion.div>

      {/* Swipe hints */}
      <div className="flex items-center justify-between px-2">
        <motion.span animate={{ opacity: dragOffset < -20 ? 1 : 0.35 }} className="flex items-center gap-1 text-[11px] text-red-400">
          <X weight="bold" className="size-3" /> {en.vocabulary.flashcards.learning}
        </motion.span>
        <motion.span animate={{ opacity: dragOffset > 20 ? 1 : 0.35 }} className="flex items-center gap-1 text-[11px] text-emerald-400">
          {en.vocabulary.flashcards.known} <Check weight="bold" className="size-3" />
        </motion.span>
      </div>

      {/* Button controls */}
      <div className="flex items-center justify-center gap-2">
        <Button size="sm" variant="outline" className="border-neutral-700 h-8 w-8 p-0" onClick={goPrev} disabled={index === 0}>
          <ArrowLeft weight="bold" className="size-3.5" />
        </Button>
        <Button size="sm" variant="outline" className="border-red-700/50 text-red-400 hover:bg-red-500/10 h-8 px-2.5 gap-1 text-xs" onClick={() => markCard("learning")}>
          <X weight="bold" className="size-3" /> {en.vocabulary.flashcards.learning}
        </Button>
        <Button
          size="sm" variant="outline"
          className={`border-neutral-700 h-8 w-8 p-0 ${playing ? "text-indigo-400 border-indigo-500" : ""}`}
          onClick={handleSpeak} disabled={playing}
        >
          {playing ? <SpeakerSlash weight="bold" className="size-3.5 animate-pulse" /> : <SpeakerHigh weight="bold" className="size-3.5" />}
        </Button>
        <Button size="sm" variant="outline" className="border-emerald-700/50 text-emerald-400 hover:bg-emerald-500/10 h-8 px-2.5 gap-1 text-xs" onClick={() => markCard("known")}>
          <Check weight="bold" className="size-3" /> {en.vocabulary.flashcards.knowIt}
        </Button>
        <Button size="sm" variant="outline" className="border-neutral-700 h-8 w-8 p-0" onClick={goNext} disabled={index === cards.length - 1}>
          <ArrowRight weight="bold" className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ─── Quiz Mode (original) ─────────────────────────────────────────────────────

function QuizMode({ words, index, current, options, correct, incorrect, answered, selected, playing, dictEntry, dictLoading, similarWords, onSpeak, onSelect, onContinue, onReset }: {
  words: VocabularyWord[]; index: number; current: VocabularyWord | undefined;
  options: string[]; correct: number; incorrect: number; answered: boolean;
  selected: string | null; playing: boolean;
  dictEntry: DictionaryEntry | null; dictLoading: boolean; similarWords: string[];
  onSpeak: () => void; onSelect: (o: string) => void; onContinue: () => void; onReset: () => void;
}) {
  const optionStyle = (option: string) => {
    if (!answered) return "border-neutral-800 bg-neutral-900 hover:border-neutral-600 hover:bg-neutral-800/60 cursor-pointer";
    if (!current) return "border-neutral-800 bg-neutral-900 opacity-50";
    if (option === current.meaning) return "border-emerald-500/60 bg-emerald-500/10 text-emerald-300";
    if (option === selected && option !== current.meaning) return "border-red-500/60 bg-red-500/10 text-red-300";
    return "border-neutral-800 bg-neutral-900 opacity-50";
  };

  return (
    <>
      {/* Stats */}
      <div className="flex items-center justify-end text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="text-emerald-400">{correct} {en.vocabulary.correct}</span>
          <span className="text-red-400">{incorrect} {en.vocabulary.wrong}</span>
          <button onClick={onReset} className="hover:text-foreground transition-colors" title={en.vocabulary.reset}>
            <ArrowCounterClockwise weight="bold" className="size-3.5" />
          </button>
        </div>
      </div>

      {current && (
        <AnimatePresence mode="wait">
          <motion.div
            key={`${index}`}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="flex flex-col gap-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-2xl font-semibold tracking-wide">{current.word}</span>
              <Button
                size="sm" variant="outline"
                className={`border-neutral-700 gap-1.5 ${playing ? "text-blue-400 border-blue-500" : ""}`}
                onClick={onSpeak} disabled={playing}
              >
                {playing ? <SpeakerSlash weight="bold" className="size-3.5 animate-pulse" /> : <SpeakerHigh weight="bold" className="size-3.5" />}
                {en.vocabulary.speak}
              </Button>
            </div>

            <div className="flex flex-col gap-2">
              {options.map((option) => (
                <button
                  key={option} onClick={() => onSelect(option)} disabled={answered}
                  className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all duration-200 ${optionStyle(option)}`}
                >
                  {option}
                </button>
              ))}
            </div>

            <AnimatePresence>
              {answered && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="rounded-xl border border-neutral-800 bg-neutral-900/80 overflow-hidden">
                  {dictLoading ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground px-4 py-4">
                      <CircleNotch weight="bold" className="size-4 animate-spin" />
                      {en.vocabulary.loadingDictionary}
                    </div>
                  ) : dictEntry ? (
                    <div className="flex flex-col divide-y divide-neutral-800">
                      <div className="px-4 py-3 flex items-center gap-3">
                        <BookOpen weight="bold" className="size-4 text-indigo-400 shrink-0" />
                        <span className="text-sm font-semibold">{dictEntry.word}</span>
                        {dictEntry.pronunciation.length > 0 && (
                          <span className="text-xs text-indigo-400 font-mono">{dictEntry.pronunciation[0].pron}</span>
                        )}
                      </div>
                      {dictEntry.pos.length > 0 && (
                        <div className="px-4 py-2">
                          <p className="text-[11px] text-muted-foreground">
                            <span className="text-amber-400/80 font-medium">{en.vocabulary.partsOfSpeech}</span> {dictEntry.pos.join(", ")}
                          </p>
                        </div>
                      )}
                      {dictEntry.verbs && dictEntry.verbs.length > 0 && (
                        <div className="px-4 py-2">
                          <p className="text-[11px] text-muted-foreground">
                            <span className="text-blue-400/80 font-medium">{en.vocabulary.verbForms}</span> {dictEntry.verbs.map(v => v.text).join(", ")}
                          </p>
                        </div>
                      )}
                      {dictEntry.definition.map((def, di) => (
                        <div key={di} className="px-4 py-3 flex flex-col gap-2">
                          <span className="text-[11px] font-medium text-indigo-400 italic">{def.pos} ({def.source})</span>
                          <div className="flex flex-col gap-1 pl-2 border-l-2 border-neutral-700">
                            <p className="text-sm text-foreground">{def.text}</p>
                            {def.example && def.example.length > 0 && (
                              <div className="flex flex-col gap-1">
                                {def.example.slice(0, 2).map((ex, ei) => (
                                  <p key={ei} className="text-xs text-muted-foreground italic">&ldquo;{ex.text}&rdquo;</p>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-3">
                      <p className="text-xs text-muted-foreground">{en.vocabulary.noDictionaryEntry}</p>
                    </div>
                  )}
                  {similarWords.length > 0 && (
                    <div className="border-t border-neutral-800">
                      <div className="px-4 py-3">
                        <div className="flex items-center gap-2 mb-2">
                          <BookOpen className="size-3.5 text-amber-400" />
                          <span className="text-xs font-medium text-amber-400">{en.vocabulary.similarWords}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {similarWords.map((word, idx) => (
                            <Badge
                              key={idx} variant="outline"
                              className="text-xs px-2 py-0.5 border-amber-500/30 text-amber-400/80 bg-amber-500/5 hover:bg-amber-500/10 transition-colors cursor-pointer"
                              onClick={() => {
                                try {
                                  navigator.clipboard?.writeText(word);
                                  toast.success(en.vocabulary.copied(word));
                                } catch { toast.error(en.vocabulary.copyFailed); }
                              }}
                            >
                              {word}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {answered && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center pt-1">
                  <Button size="sm" className="gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white" onClick={onContinue}>
                    {en.vocabulary.continue} <ArrowRight weight="bold" className="size-3.5" />
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>
      )}
    </>
  );
}

// ─── Main Vocabulary Component ────────────────────────────────────────────────

export function Vocabulary() {
  const [mode, setMode] = useState<VocabMode>("quiz");
  const [volume, setVolume] = useState(1);
  const [playing, setPlaying] = useState(false);

  const [words, setWords] = useState<VocabularyWord[]>([]);
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [incorrect, setIncorrect] = useState(0);
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [dictEntry, setDictEntry] = useState<DictionaryEntry | null>(null);
  const [dictLoading, setDictLoading] = useState(false);
  const [similarWords, setSimilarWords] = useState<string[]>([]);

  const current = words[index];
  const options = useMemo(() => current ? current.options : [], [current]);

  const loadWords = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getVocabularyTest();
      if (response.success) {
        setWords(response.data.words);
        setIndex(0);
        setSelected(null);
        setAnswered(false);
        setCorrect(0);
        setIncorrect(0);
        setDictEntry(null);
        setSimilarWords([]);
      } else {
        toast.error(en.vocabulary.failedToLoad);
      }
    } catch {
      toast.error(en.vocabulary.failedToLoad);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadWords(); }, [loadWords]);

  const VolumeIcon = volume === 0 ? SpeakerNone : volume < 0.4 ? SpeakerLow : SpeakerHigh;

  const handleSpeak = async () => {
    if (playing || !current) return;
    setPlaying(true);
    try { await speakText(current.word, volume); }
    catch { toast.error(en.vocabulary.pronunciationError); }
    finally { setPlaying(false); }
  };

  const handleSelect = useCallback(async (option: string) => {
    if (!current || answered) return;
    setSelected(option);
    setAnswered(true);
    const isCorrect = option === current.meaning;
    if (isCorrect) setCorrect((c) => c + 1);
    else setIncorrect((i) => i + 1);

    setDictLoading(true);
    Promise.all([getDictionaryEntry(current.word), getSimilarWords(current.word)])
      .then(([dictRes, simRes]) => {
        setDictEntry(dictRes.data);
        if (simRes.success && simRes.data) setSimilarWords(simRes.data.similarWords);
        setDictLoading(false);
      })
      .catch(() => setDictLoading(false));
  }, [answered, current?.meaning, current?.word]);

  const handleContinue = useCallback(() => {
    if (index < words.length - 1) setIndex((i) => i + 1);
    else { toast.success(en.vocabulary.testCompleted); loadWords(); return; }
    setSelected(null);
    setAnswered(false);
    setDictEntry(null);
    setSimilarWords([]);
  }, [index, words, loadWords]);

  return (
    <div className="p-5 flex flex-col gap-4 font-body">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="relative overflow-hidden rounded-2xl border border-neutral-800 bg-[linear-gradient(135deg,rgba(30,58,138,0.2),rgba(15,23,42,0.9))] p-4"
      >
        <div className="absolute inset-0 opacity-50 [background:radial-gradient(circle_at_top_right,rgba(99,102,241,0.2),transparent_55%)]" />
        <div className="relative flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <Badge variant="outline" className="border-indigo-400/40 text-indigo-200 self-start -ml-1.5">
              {en.vocabulary.badge}
            </Badge>
            <h2 className="text-sm font-display tracking-wide">{en.vocabulary.title}</h2>
            <p className="text-xs text-muted-foreground">{en.vocabulary.subtitle}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0 bg-neutral-900/60 border border-neutral-700 rounded-lg px-3 py-2">
            <VolumeIcon weight="bold" className="size-3.5 text-muted-foreground shrink-0" />
            <Slider
              min={0} max={1} step={0.01} value={[volume]}
              onValueChange={([v]) => setVolume(v)}
              className="w-24 [&_.bg-secondary]:bg-neutral-700 [&_.bg-primary]:bg-blue-500 [&_[role=slider]]:h-3 [&_[role=slider]]:w-3 [&_[role=slider]]:border-blue-500"
            />
            <span className="text-[10px] text-muted-foreground w-7 text-right">{Math.round(volume * 100)}%</span>
          </div>
        </div>
      </motion.div>

      {/* Mode switcher */}
      <div className="flex items-center gap-1 p-0.5 rounded-lg bg-neutral-900 border border-neutral-800 self-start">
        <button
          onClick={() => setMode("quiz")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            mode === "quiz" ? "bg-indigo-600 text-white shadow-sm" : "text-muted-foreground hover:text-white"
          }`}
        >
          <ListBullets weight="bold" className="size-3.5" /> {en.vocabulary.modes.quiz}
        </button>
        <button
          onClick={() => setMode("flashcards")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            mode === "flashcards" ? "bg-purple-600 text-white shadow-sm" : "text-muted-foreground hover:text-white"
          }`}
        >
          <Cards weight="bold" className="size-3.5" /> {en.vocabulary.modes.flashcards}
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <CircleNotch weight="bold" className="size-8 text-indigo-400 animate-spin" />
          <p className="text-muted-foreground">{en.vocabulary.loading}</p>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {mode === "quiz" ? (
            <motion.div key="quiz" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="flex flex-col gap-4">
              <QuizMode
                words={words} index={index} current={current} options={options}
                correct={correct} incorrect={incorrect} answered={answered}
                selected={selected} playing={playing}
                dictEntry={dictEntry} dictLoading={dictLoading} similarWords={similarWords}
                onSpeak={handleSpeak} onSelect={handleSelect} onContinue={handleContinue} onReset={loadWords}
              />
            </motion.div>
          ) : (
            <motion.div key="flashcards" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }}>
              <FlashcardsMode words={words} volume={volume} onNewSet={loadWords} />
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
