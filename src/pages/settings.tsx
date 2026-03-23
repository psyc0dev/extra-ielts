import { useState } from "react";
import type { UserSettings } from "@/lib/api";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Gear } from "@phosphor-icons/react";
import en from "@/locales/en";
import { LegalDialog } from "@/components/LegalDialog";
import { Button } from "@/components/ui/button";

function Row({ label, description, checked, onChange }: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-neutral-800 last:border-0">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function LegalRow({ label, description, kind }: {
  label: string;
  description: string;
  kind: "terms" | "privacy" | "policy";
}) {
  const doc = en.legal[kind];
  return (
    <div className="py-4 border-b border-neutral-800 last:border-0">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold">{label}</span>
          <span className="text-xs text-muted-foreground">{description}</span>
          <span className="text-xs text-muted-foreground">{en.legal.updatedLabel} {doc.updated}</span>
        </div>
        <LegalDialog
          kind={kind}
          trigger={(
            <Button type="button" variant="secondary" size="sm">
              {en.settings.legal.open}
            </Button>
          )}
        />
      </div>
    </div>
  );
}

export function Settings({ onSignOut, username, role, settings, onSettingsChange }: {
  onSignOut: () => void;
  username: string;
  role: string;
  settings: UserSettings;
  onSettingsChange: (patch: Partial<UserSettings>) => void;
}) {
  const [signOutOpen, setSignOutOpen] = useState(false);
  const handleToggle = (key: keyof UserSettings) => (value: boolean) => {
    onSettingsChange({ [key]: value } as Partial<UserSettings>);
  };

  const s = en.settings;

  return (
    <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6 h-full content-start">
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">{s.sections.account}</h2>
          <div className="rounded-xl border border-neutral-800 px-4">
            <div className="flex items-center gap-4 py-4">
              <div className="w-10 h-10 rounded-full bg-neutral-700 flex items-center justify-center text-sm font-semibold shrink-0">
                {username[0]?.toUpperCase()}
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{username}</span>
                <span className="text-xs text-muted-foreground">{role}</span>
              </div>
              <div className="ml-auto">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="size-7 flex items-center justify-center rounded-md hover:bg-neutral-800 transition-colors text-muted-foreground hover:text-white">
                      <Gear weight="bold" className="size-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>{s.account.menu.editProfile}</DropdownMenuItem>
                    <DropdownMenuItem>{s.account.menu.changePassword}</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={e => e.preventDefault()}
                      className="text-red-400 focus:text-red-400"
                      onClick={() => setSignOutOpen(true)}
                    >
                      {s.account.menu.signOut}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <AlertDialog open={signOutOpen} onOpenChange={setSignOutOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{s.signOut.title}</AlertDialogTitle>
                  <AlertDialogDescription>{s.signOut.description}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{s.signOut.cancel}</AlertDialogCancel>
                  <AlertDialogAction onClick={onSignOut} className="bg-red-600 hover:bg-red-700">{s.signOut.confirm}</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <div className="flex items-center justify-between py-4 border-t border-neutral-800">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{s.account.language}</span>
                <span className="text-xs text-muted-foreground">{s.account.languageSub}</span>
              </div>
              <span className="text-xs text-muted-foreground">{s.account.languageValue}</span>
            </div>
            <div className="flex items-center justify-between py-4 border-t border-neutral-800">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{s.account.password}</span>
                <span className="text-xs text-muted-foreground">{s.account.passwordSub}</span>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button className="text-xs text-muted-foreground hover:text-white transition-colors">{s.account.changePassword}</button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{s.changePassword.title}</AlertDialogTitle>
                    <AlertDialogDescription>{s.changePassword.description}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{s.changePassword.cancel}</AlertDialogCancel>
                    <AlertDialogAction>{s.changePassword.confirm}</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">{s.sections.legal}</h2>
          <div className="rounded-xl border border-neutral-800 px-4">
            <LegalRow label={s.legal.terms} description={s.legal.termsSub} kind="terms" />
            <LegalRow label={s.legal.privacy} description={s.legal.privacySub} kind="privacy" />
            <LegalRow label={s.legal.policy} description={s.legal.policySub} kind="policy" />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">{s.sections.notifications}</h2>
          <div className="rounded-xl border border-neutral-800 px-4">
            <Row label={s.notifications.push} description={s.notifications.pushSub} checked={settings.notifications} onChange={handleToggle("notifications")} />
            <Row label={s.notifications.sound} description={s.notifications.soundSub} checked={settings.sound} onChange={handleToggle("sound")} />
            <Row label={s.notifications.timerWarning} description={s.notifications.timerWarningSub} checked={settings.timerWarning} onChange={handleToggle("timerWarning")} />
          </div>
        </div>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">{s.sections.dangerZone}</h2>
          <div className="rounded-xl border border-red-900/50 px-4">
            <div className="flex items-center justify-between py-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-red-400">{s.danger.deleteAccount}</span>
                <span className="text-xs text-muted-foreground">{s.danger.deleteAccountSub}</span>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button className="text-xs text-red-400 hover:text-red-300 transition-colors">{s.danger.deleteButton}</button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{s.danger.dialog.title}</AlertDialogTitle>
                    <AlertDialogDescription>{s.danger.dialog.description}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{s.danger.dialog.cancel}</AlertDialogCancel>
                    <AlertDialogAction className="bg-red-600 hover:bg-red-700">{s.danger.dialog.confirm}</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
