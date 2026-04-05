import { DotLottieReact, type DotLottie } from "@lottiefiles/dotlottie-react";
import hello from "@/assets/hello.lottie";

type LoadingScreenProps = {
  onComplete?: () => void;
};

export default function LoadingScreen({ onComplete }: LoadingScreenProps) {
  return (
    <div className="dark flex h-screen items-center justify-center bg-neutral-950 text-white">
      <DotLottieReact
        src={hello}
        autoplay
        dotLottieRefCallback={(ref: DotLottie | null) => {
          ref?.addEventListener("complete", () => onComplete?.());
        }}
        style={{ width: 320, height: 320, filter: "invert(1)" }}
      />
    </div>
  );
}
