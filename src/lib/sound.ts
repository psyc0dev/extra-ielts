import sfx from "@/sounds/sfx.wav";

export const playSound = () => {
  try {
    const audio = new Audio(sfx);
    audio.play().catch(() => undefined);
  } catch {
    // ignore - audio not supported in this context
  }
};
