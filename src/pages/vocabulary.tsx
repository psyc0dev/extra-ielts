import { useState } from "react";
import { motion } from "motion/react";
import { SpeakerHigh, SpeakerSlash, SpeakerLow, SpeakerNone } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { speakText, stopSpeech } from "@/lib/tts";
import { toast } from "sonner";

const WORDS = [
  { word: "Ubiquitous", phonetic: "/juːˈbɪk.wɪ.təs/", meaning: "Present everywhere at the same time" },
  { word: "Ephemeral", phonetic: "/ɪˈfem.ər.əl/", meaning: "Lasting for a very short time" },
  { word: "Conscientious", phonetic: "/ˌkɒn.ʃiˈen.ʃəs/", meaning: "Wishing to do what is right" },
  { word: "Ambiguous", phonetic: "/æmˈbɪɡ.ju.əs/", meaning: "Open to more than one interpretation" },
  { word: "Exacerbate", phonetic: "/ɪɡˈzæs.ə.beɪt/", meaning: "To make a problem worse" },
  { word: "Juxtaposition", phonetic: "/ˌdʒʌk.stə.pəˈzɪʃ.ən/", meaning: "Placing two things side by side for contrast" },
  { word: "Phenomenon", phonetic: "/fɪˈnɒm.ɪ.nən/", meaning: "A fact or event in nature or society" },
  { word: "Deteriorate", phonetic: "/dɪˈtɪə.ri.ə.reɪt/", meaning: "To become progressively worse" },
  { word: "Bureaucratic", phonetic: "/ˌbjʊə.rəˈkræt.ɪk/", meaning: "Relating to excessive official rules" },
  { word: "Unprecedented", phonetic: "/ʌnˈpres.ɪ.den.tɪd/", meaning: "Never done or known before" },
  { word: "Consequently", phonetic: "/ˈkɒn.sɪ.kwənt.li/", meaning: "As a result; therefore" },
  { word: "Infrastructure", phonetic: "/ˈɪn.frəˌstrʌk.tʃər/", meaning: "Basic physical systems of a country" },
];

export function Vocabulary() {
  const [playing, setPlaying] = useState<string | null>(null);
  const [volume, setVolume] = useState(1);

  const VolumeIcon = volume === 0 ? SpeakerNone : volume < 0.4 ? SpeakerLow : SpeakerHigh;

  const handlePlay = async (word: string) => {
    if (playing === word) {
      stopSpeech();
      setPlaying(null);
      return;
    }
    setPlaying(word);
    try {
      await speakText(word, volume);
    } catch {
      toast.error("Could not play pronunciation. Check your internet connection.");
    } finally {
      setPlaying(null);
    }
  };

  return (
    <div className="p-5 flex flex-col gap-4 font-body">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="relative overflow-hidden rounded-2xl border border-neutral-800 bg-[linear-gradient(135deg,rgba(30,58,138,0.2),rgba(15,23,42,0.9))] p-4"
      >
        <div className="absolute inset-0 opacity-50 [background:radial-gradient(circle_at_top_right,rgba(99,102,241,0.2),transparent_55%)]" />
        <div className="relative flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <Badge variant="outline" className="border-indigo-400/40 text-indigo-200 self-start -ml-1.5">Vocabulary</Badge>
            <h2 className="text-sm font-display tracking-wide">Vocabulary</h2>
            <p className="text-xs text-muted-foreground">Master difficult IELTS words — hear how they sound from a native speaker.</p>
          </div>
          <div className="flex items-center gap-2 shrink-0 bg-neutral-900/60 border border-neutral-700 rounded-lg px-3 py-2">
            <VolumeIcon weight="bold" className="size-3.5 text-muted-foreground shrink-0" />
            <Slider
              min={0} max={1} step={0.01}
              value={[volume]}
              onValueChange={([v]) => setVolume(v)}
              className="w-24 [&_.bg-secondary]:bg-neutral-700 [&_.bg-primary]:bg-blue-500 [&_[role=slider]]:h-3 [&_[role=slider]]:w-3 [&_[role=slider]]:border-blue-500"
            />
            <span className="text-[10px] text-muted-foreground w-7 text-right">{Math.round(volume * 100)}%</span>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {WORDS.map((entry, i) => (
          <motion.div
            key={entry.word}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: i * 0.04, ease: "easeOut" }}
          >
            <Card className="border-neutral-800 bg-neutral-900 hover:border-neutral-700 transition-colors">
              <CardContent className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-sm font-semibold truncate">{entry.word}</span>
                  <span className="text-[11px] text-indigo-400 font-mono">{entry.phonetic}</span>
                  <span className="text-[10px] text-muted-foreground truncate">{entry.meaning}</span>
                </div>
                <Button
                  size="icon"
                  variant="outline"
                  className={`shrink-0 size-8 border-neutral-700 transition-colors ${playing === entry.word ? "border-blue-500 text-blue-400" : ""}`}
                  onClick={() => handlePlay(entry.word)}
                >
                  {playing === entry.word
                    ? <SpeakerSlash weight="bold" className="size-4 animate-pulse" />
                    : <SpeakerHigh weight="bold" className="size-4" />
                  }
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
