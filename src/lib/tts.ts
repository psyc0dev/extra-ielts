import { invoke } from "@tauri-apps/api/core";

let currentAudio: HTMLAudioElement | null = null;

export async function speakText(text: string, volume: number = 1): Promise<void> {
  if (currentAudio) {
    currentAudio.pause();
    URL.revokeObjectURL(currentAudio.src);
    currentAudio = null;
  }

  const base64 = await invoke<string>("speak_text", { text, voiceName: "AndrewNeural" });
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const blob = new Blob([bytes], { type: "audio/mpeg" });
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.volume = Math.max(0, Math.min(1, volume));
  currentAudio = audio;

  return new Promise((resolve, reject) => {
    audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
    audio.onerror = () => { URL.revokeObjectURL(url); reject(new Error("TTS playback failed")); };
    audio.play().catch(reject);
  });
}

export function stopSpeech(): void {
  if (currentAudio) {
    currentAudio.pause();
    URL.revokeObjectURL(currentAudio.src);
    currentAudio = null;
  }
}
