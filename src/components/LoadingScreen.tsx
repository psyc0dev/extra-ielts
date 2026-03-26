import { Spinner } from "@/components/ui/spinner";
import logoRound from "@/icons/extra-round.png";

type LoadingScreenProps = {
  label: string;
};

export default function LoadingScreen({ label }: LoadingScreenProps) {
  return (
    <div className="dark flex h-screen items-center justify-center bg-neutral-950 text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_55%)]" />
      </div>
      <div className="relative z-10 flex flex-col items-center gap-4">
        <img
          src={logoRound}
          alt="extra IELTS"
          className="h-20 w-20 rounded-2xl shadow-2xl shadow-black/40"
        />
        <div className="text-xl font-medium text-white/90">
          extra IELTS
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Spinner className="size-4 text-white/70" />
          {label}
        </div>
      </div>
    </div>
  );
}
