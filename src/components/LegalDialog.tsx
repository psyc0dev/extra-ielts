import type { ReactElement } from "react";
import { cn } from "@/lib/utils";
import en from "@/locales/en";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type LegalKind = "terms" | "privacy" | "policy";

export function LegalDialog({
  kind,
  trigger,
  contentClassName,
}: {
  kind: LegalKind;
  trigger: ReactElement;
  contentClassName?: string;
}) {
  const legal = en.legal[kind];

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className={cn("max-w-2xl", contentClassName)}>
        <DialogHeader>
          <DialogTitle>{legal.title}</DialogTitle>
          <DialogDescription>
            {en.legal.updatedLabel} {legal.updated}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-auto pr-2 space-y-3 text-sm text-muted-foreground leading-relaxed">
          {legal.body.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
