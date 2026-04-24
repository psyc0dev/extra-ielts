import { useState, useCallback, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  SpeakerHigh,
  SpeakerSlash,
  SpeakerLow,
  SpeakerNone,
  ArrowCounterClockwise,
  ArrowRight,
  BookOpen,
  CircleNotch,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { speakText } from "@/lib/tts";
import { toast } from "sonner";
import { getVocabularyTest, getDictionaryEntry, getSimilarWords, type VocabularyWord, type DictionaryEntry, type DictDefinition } from "@/lib/vocabulary-api";
import { en } from "@/lib/en";




function Tags({ items, color }: { items: string[]; color: "emerald" | "amber" | "blue" }) {
  if (!items.length) return null;
  const colors = {
    emerald: "border-emerald-500/30 text-emerald-400/80",
    amber: "border-amber-500/30 text-amber-400/80",
    blue: "border-blue-500/30 text-blue-400/80",
  };
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((s) => (
        <span key={s} className={`text-[10px] px-1.5 py-0.5 rounded border ${colors[color]}`}>
          {s}
        </span>
      ))}
    </div>
  );
}

export function Vocabulary() {
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
  const [similarLoading, setSimilarLoading] = useState(false);

  const current = words[index];
  const total = words.length;

  const options = useMemo(
    () => current ? current.options : [],
    [current],
  );

  // Fetch vocabulary test from server on component mount
  useEffect(() => {
    const loadTest = async () => {
      try {
        setLoading(true);
        const response = await getVocabularyTest();
        if (response.success) {
          setWords(response.data.words);
        } else {
          toast.error(en.vocabulary.failedToLoad);
        }
      } catch (error) {
        console.error('Failed to load vocabulary test:', error);
        toast.error(en.vocabulary.failedToLoad);
      } finally {
        setLoading(false);
      }
    };
    
    loadTest();
  }, []);

  const VolumeIcon = volume === 0 ? SpeakerNone : volume < 0.4 ? SpeakerLow : SpeakerHigh;

  const handleSpeak = async () => {
    if (playing || !current) return;
    setPlaying(true);
    try {
      await speakText(current.word, volume);
    } catch {
      toast.error(en.vocabulary.pronunciationError);
    } finally {
      setPlaying(false);
    }
  };

  const handleSelect = useCallback(
    async (option: string) => {
      if (!current || answered) return;
      setSelected(option);
      setAnswered(true);

      const isCorrect = option === current.meaning;
      if (isCorrect) setCorrect((c) => c + 1);
      else setIncorrect((i) => i + 1);

      setDictLoading(true);
      setSimilarLoading(true);
      
      // Fetch both dictionary entry and similar words
      Promise.all([
        getDictionaryEntry(current.word),
        getSimilarWords(current.word)
      ]).then(([dictResponse, similarResponse]) => {
        setDictEntry(dictResponse.data);
        if (similarResponse.success && similarResponse.data) {
          setSimilarWords(similarResponse.data.similarWords);
        }
        setDictLoading(false);
        setSimilarLoading(false);
      }).catch((error) => {
        console.error('Error fetching word data:', error);
        setDictLoading(false);
        setSimilarLoading(false);
      });
    },
    [answered, current?.meaning, current?.word],
  );

  const handleReset = useCallback(async () => {
    try {
      setLoading(true);
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
        toast.error(en.vocabulary.failedToReset);
      }
    } catch (error) {
      console.error('Failed to reset vocabulary test:', error);
      toast.error(en.vocabulary.failedToReset);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleContinue = useCallback(() => {
    if (index < words.length - 1) {
      setIndex((i) => i + 1);
    } else {
      toast.success(en.vocabulary.testCompleted);
      handleReset();
      return;
    }
    setSelected(null);
    setAnswered(false);
    setDictEntry(null);
    setSimilarWords([]);
  }, [index, words, handleReset]);

  const optionStyle = (option: string) => {
    if (!answered) {
      return "border-neutral-800 bg-neutral-900 hover:border-neutral-600 hover:bg-neutral-800/60 cursor-pointer";
    }
    if (!current) return "border-neutral-800 bg-neutral-900 opacity-50";
    if (option === current.meaning) {
      return "border-emerald-500/60 bg-emerald-500/10 text-emerald-300";
    }
    if (option === selected && option !== current.meaning) {
      return "border-red-500/60 bg-red-500/10 text-red-300";
    }
    return "border-neutral-800 bg-neutral-900 opacity-50";
  };

  const allSynonyms = (def: DictDefinition) => {
    return []; // New API doesn't include synonyms
  };

  const allAntonyms = (def: DictDefinition) => {
    return []; // New API doesn't include antonyms
  };

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
              Vocabulary
            </Badge>
            <h2 className="text-sm font-display tracking-wide">{en.vocabulary.title}</h2>
            <p className="text-xs text-muted-foreground">
              {en.vocabulary.subtitle}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 bg-neutral-900/60 border border-neutral-700 rounded-lg px-3 py-2">
            <VolumeIcon weight="bold" className="size-3.5 text-muted-foreground shrink-0" />
            <Slider
              min={0}
              max={1}
              step={0.01}
              value={[volume]}
              onValueChange={([v]) => setVolume(v)}
              className="w-24 [&_.bg-secondary]:bg-neutral-700 [&_.bg-primary]:bg-blue-500 [&_[role=slider]]:h-3 [&_[role=slider]]:w-3 [&_[role=slider]]:border-blue-500"
            />
            <span className="text-[10px] text-muted-foreground w-7 text-right">
              {Math.round(volume * 100)}%
            </span>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="flex items-center justify-end text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="text-emerald-400">{correct} {en.vocabulary.correct}</span>
          <span className="text-red-400">{incorrect} {en.vocabulary.wrong}</span>
          <button onClick={handleReset} className="hover:text-foreground transition-colors" title={en.vocabulary.reset}>
            <ArrowCounterClockwise weight="bold" className="size-3.5" />
          </button>
        </div>
      </div>


      {/* Quiz card */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <CircleNotch weight="bold" className="size-8 text-indigo-400 animate-spin" />
          <p className="text-muted-foreground">{en.vocabulary.loading}</p>
        </div>
      ) : current && (
        <AnimatePresence mode="wait">
          <motion.div
            key={`${index}`}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="flex flex-col gap-4"
          >
            {/* Word + speak */}
            <div className="flex items-center justify-between">
              <span className="text-2xl font-semibold tracking-wide">{current.word}</span>
            <Button
              size="sm"
              variant="outline"
              className={`border-neutral-700 gap-1.5 ${playing ? "text-blue-400 border-blue-500" : ""}`}
              onClick={handleSpeak}
              disabled={playing}
            >
              {playing ? (
                <SpeakerSlash weight="bold" className="size-3.5 animate-pulse" />
              ) : (
                <SpeakerHigh weight="bold" className="size-3.5" />
              )}
              {en.vocabulary.speak}
            </Button>
          </div>

          {/* Options */}
          <div className="flex flex-col gap-2">
            {options.map((option) => (
              <button
                key={option}
                onClick={() => handleSelect(option)}
                disabled={answered}
                className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all duration-200 ${optionStyle(option)}`}
              >
                {option}
              </button>
            ))}
          </div>

          {/* Dictionary panel after answering */}
          <AnimatePresence>
            {answered && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="rounded-xl border border-neutral-800 bg-neutral-900/80 overflow-hidden"
              >
                {dictLoading ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground px-4 py-4">
                    <CircleNotch weight="bold" className="size-4 animate-spin" />
                    Loading dictionary…
                  </div>
                ) : dictEntry ? (
                  <div className="flex flex-col divide-y divide-neutral-800">
                    {/* Word header: pronunciation */}
                    <div className="px-4 py-3 flex items-center gap-3">
                      <BookOpen weight="bold" className="size-4 text-indigo-400 shrink-0" />
                      <span className="text-sm font-semibold">{dictEntry.word}</span>
                      {dictEntry.pronunciation.length > 0 && (
                        <span className="text-xs text-indigo-400 font-mono">
                          {dictEntry.pronunciation[0].pron}
                        </span>
                      )}
                    </div>

                    {/* Part of Speech */}
                    {dictEntry.pos.length > 0 && (
                      <div className="px-4 py-2">
                        <p className="text-[11px] text-muted-foreground">
                          <span className="text-amber-400/80 font-medium">{en.vocabulary.partsOfSpeech}</span>{" "}
                          {dictEntry.pos.join(", ")}
                        </p>
                      </div>
                    )}

                    {/* Verb forms */}
                    {dictEntry.verbs && dictEntry.verbs.length > 0 && (
                      <div className="px-4 py-2">
                        <p className="text-[11px] text-muted-foreground">
                          <span className="text-blue-400/80 font-medium">{en.vocabulary.verbForms}</span>{" "}
                          {dictEntry.verbs.map(v => v.text).join(", ")}
                        </p>
                      </div>
                    )}

                    {/* Definitions */}
                    {dictEntry.definition.map((def, di) => (
                      <div key={di} className="px-4 py-3 flex flex-col gap-2">
                        <span className="text-[11px] font-medium text-indigo-400 italic">
                          {def.pos} ({def.source})
                        </span>

                        <div className="flex flex-col gap-1 pl-2 border-l-2 border-neutral-700">
                          <p className="text-sm text-foreground">{def.text}</p>
                          {def.example && def.example.length > 0 && (
                            <div className="flex flex-col gap-1">
                              {def.example.slice(0, 2).map((ex, ei) => (
                                <p key={ei} className="text-xs text-muted-foreground italic">
                                  &ldquo;{ex.text}&rdquo;
                                </p>
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

                {/* Similar Words */}
                {similarWords.length > 0 && (
                  <div className="border-t border-neutral-800">
                    <div className="px-4 py-3">
                      <div className="flex items-center gap-2 mb-2">
                        <BookOpen className="size-3.5 text-amber-400" />
                        <span className="text-xs font-medium text-amber-400">Similar words:</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {similarWords.map((word, index) => (
                          <Badge
                            key={index}
                            variant="outline"
                            className="text-xs px-2 py-0.5 border-amber-500/30 text-amber-400/80 bg-amber-500/5 hover:bg-amber-500/10 transition-colors cursor-pointer"
                            onClick={() => {
                              try {
                                if (navigator.clipboard) {
                                  navigator.clipboard.writeText(word);
                                  toast.success(`Copied "${word}" to clipboard`);
                                } else {
                                  // Fallback for older browsers
                                  const textArea = document.createElement('textarea');
                                  textArea.value = word;
                                  document.body.appendChild(textArea);
                                  textArea.select();
                                  document.execCommand('copy');
                                  document.body.removeChild(textArea);
                                  toast.success(`Copied "${word}" to clipboard`);
                                }
                              } catch (error) {
                                console.error('Failed to copy text:', error);
                                toast.error('Failed to copy to clipboard');
                              }
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

          {/* Continue button */}
          <AnimatePresence>
            {answered && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-center pt-1"
              >
                <Button
                  size="sm"
                  className="gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white"
                  onClick={handleContinue}
                >
                  {en.vocabulary.continue}
                  <ArrowRight weight="bold" className="size-3.5" />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>
      )}
    </div>
  );
}
