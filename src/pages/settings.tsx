import { useRef, useState } from "react";
import type { ApiUser, UserSettings } from "@/lib/api";
import { requestPasswordReset, resetPassword, deleteAccount, uploadAvatar } from "@/lib/api";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Gear } from "@phosphor-icons/react";
import { toast } from "sonner";
import en from "@/locales/en";
import { LegalDialog } from "@/components/ui/legaldialog";

function Row({ label, description, checked, onChange }: {
  label: string; description: string; checked: boolean; onChange: (v: boolean) => void;
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
  label: string; description: string; kind: "terms" | "privacy" | "policy";
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
        <LegalDialog kind={kind} trigger={
          <div className="grid place-items-center h-12">
            <Button type="button" variant="secondary" size="sm" className="mt-3">{en.settings.legal.open}</Button>
          </div>
        } />
      </div>
    </div>
  );
}

function ChangePasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [loading, setLoading] = useState(false);

  const handleClose = () => { setStep("email"); setEmail(""); setOtp(""); setPassword(""); setConfirm(""); onClose(); };

  const handleSendOtp = async () => {
    if (!email.trim()) return;
    setLoading(true);
    try {
      await requestPasswordReset(email.trim());
      setStep("otp");
      toast.success(en.settings.changePassword.toasts.sent);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : en.settings.changePassword.toasts.sendFailed);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (password !== confirm) { toast.error(en.settings.changePassword.toasts.passwordMismatch); return; }
    if (password.length < 6) { toast.error(en.settings.changePassword.toasts.passwordTooShort); return; }
    setLoading(true);
    try {
      await resetPassword(otp.trim(), password);
      toast.success(en.settings.changePassword.toasts.success);
      handleClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : en.settings.changePassword.toasts.invalidCode);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="border-neutral-800 bg-neutral-950 max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">{en.settings.changePassword.title}</DialogTitle>
        </DialogHeader>
        {step === "email" ? (
          <>
            <p className="text-xs text-muted-foreground">{en.settings.changePassword.emailStep.description}</p>
            <Input type="email" placeholder={en.settings.changePassword.emailStep.emailPlaceholder} value={email} onChange={(e) => setEmail(e.target.value)} />
            <DialogFooter>
              <Button variant="outline" size="sm" className="border-neutral-700" onClick={handleClose}>{en.settings.changePassword.emailStep.cancel}</Button>
              <Button size="sm" disabled={loading || !email.trim()} onClick={handleSendOtp}>
                {loading ? en.settings.changePassword.emailStep.sending : en.settings.changePassword.emailStep.sendCode}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">{en.settings.changePassword.otpStep.description(email)}</p>
            <div className="flex flex-col gap-3">
              <Input placeholder={en.settings.changePassword.otpStep.codePlaceholder} value={otp} onChange={(e) => setOtp(e.target.value)} maxLength={6} />
              <Input type="password" placeholder={en.settings.changePassword.otpStep.newPasswordPlaceholder} value={password} onChange={(e) => setPassword(e.target.value)} />
              <Input type="password" placeholder={en.settings.changePassword.otpStep.confirmPasswordPlaceholder} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" className="border-neutral-700" onClick={() => setStep("email")}>{en.settings.changePassword.otpStep.back}</Button>
              <Button size="sm" disabled={loading || !otp || !password || !confirm} onClick={handleReset}>
                {loading ? en.settings.changePassword.otpStep.saving : en.settings.changePassword.otpStep.setNewPassword}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditProfileDialog({ open, onClose, user, onUserUpdate }: {
  open: boolean; onClose: () => void; user: ApiUser; onUserUpdate: (u: ApiUser) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(user.avatarUrl ?? null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      toast.error(en.settings.editProfile.toasts.invalidType);
      return;
    }
    if (file.size > 2 * 1024 * 1024) { toast.error(en.settings.editProfile.toasts.tooLarge); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setPreview(result);
      setDataUrl(result);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!dataUrl) { onClose(); return; }
    setLoading(true);
    try {
      const res = await uploadAvatar(dataUrl);
      onUserUpdate({ ...user, avatarUrl: res.avatarUrl });
      toast.success(en.settings.editProfile.toasts.updated);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : en.settings.editProfile.toasts.uploadFailed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="border-neutral-800 bg-neutral-950 max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">{en.settings.editProfile.title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-20 h-20 rounded-full bg-neutral-700 flex items-center justify-center text-2xl font-semibold overflow-hidden cursor-pointer border-2 border-neutral-600 hover:border-neutral-400 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            {preview
              ? <img src={preview} alt="avatar" className="w-full h-full object-cover" />
              : user.username[0]?.toUpperCase()
            }
          </div>
          <p className="text-xs text-muted-foreground">{en.settings.editProfile.avatarHint}</p>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleFile} />
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" className="border-neutral-700" onClick={onClose}>{en.settings.editProfile.cancel}</Button>
          <Button size="sm" disabled={loading} onClick={handleSave}>
            {loading ? en.settings.editProfile.saving : en.settings.editProfile.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function Settings({ onSignOut, user, onUserUpdate, settings, onSettingsChange }: {
  onSignOut: () => void;
  user: ApiUser;
  onUserUpdate: (u: ApiUser) => void;
  settings: UserSettings;
  onSettingsChange: (patch: Partial<UserSettings>) => void;
}) {
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const handleToggle = (key: keyof UserSettings) => (value: boolean) => {
    onSettingsChange({ [key]: value } as Partial<UserSettings>);
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      await deleteAccount();
      onSignOut();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : en.settings.danger.dialog.deleteFailed);
      setDeletingAccount(false);
    }
  };

  const s = en.settings;

  return (
    <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6 h-full content-start">
      <ChangePasswordDialog open={changePasswordOpen} onClose={() => setChangePasswordOpen(false)} />
      <EditProfileDialog open={editProfileOpen} onClose={() => setEditProfileOpen(false)} user={user} onUserUpdate={onUserUpdate} />

      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">{s.sections.account}</h2>
          <div className="rounded-xl border border-neutral-800 px-4">
            <div className="flex items-center gap-4 py-4">
              <div
                className="w-10 h-10 rounded-full bg-neutral-700 flex items-center justify-center text-sm font-semibold shrink-0 overflow-hidden cursor-pointer"
                onClick={() => setEditProfileOpen(true)}
              >
                {user.avatarUrl
                  ? <img src={user.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                  : user.username[0]?.toUpperCase()
                }
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{user.username}</span>
                <span className="text-xs text-muted-foreground">{user.role}</span>
              </div>
              <div className="ml-auto">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="size-7 flex items-center justify-center rounded-md hover:bg-neutral-800 transition-colors text-muted-foreground hover:text-white">
                      <Gear weight="bold" className="size-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setEditProfileOpen(true)}>
                      {s.account.menu.editProfile}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={(e) => e.preventDefault()}
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
              <button
                className="text-xs text-muted-foreground hover:text-white transition-colors"
                onClick={() => setChangePasswordOpen(true)}
              >
                {s.account.changePassword}
              </button>
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

        {user.role !== "admin" && (
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
                      <AlertDialogAction
                        className="bg-red-600 hover:bg-red-700"
                        disabled={deletingAccount}
                        onClick={handleDeleteAccount}
                      >
                        {deletingAccount ? en.settings.danger.deleting : s.danger.dialog.confirm}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
