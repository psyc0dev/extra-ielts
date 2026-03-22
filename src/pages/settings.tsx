import { useState } from "react";
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

export function Settings({ onSignOut, username, role, timerWarning, onTimerWarningChange }: {
  onSignOut: () => void;
  username: string;
  role: string;
  timerWarning: boolean;
  onTimerWarningChange: (v: boolean) => void;
}) {
  const [notifications, setNotifications] = useState(true);
  const [sound, setSound] = useState(true);
  const [autoSubmit, setAutoSubmit] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);

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
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">{s.sections.tests}</h2>
          <div className="rounded-xl border border-neutral-800 px-4">
            <Row label={s.testsSection.autoSubmit} description={s.testsSection.autoSubmitSub} checked={autoSubmit} onChange={setAutoSubmit} />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">{s.sections.notifications}</h2>
          <div className="rounded-xl border border-neutral-800 px-4">
            <Row label={s.notifications.push} description={s.notifications.pushSub} checked={notifications} onChange={setNotifications} />
            <Row label={s.notifications.sound} description={s.notifications.soundSub} checked={sound} onChange={setSound} />
            <Row label={s.notifications.timerWarning} description={s.notifications.timerWarningSub} checked={timerWarning} onChange={onTimerWarningChange} />
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
