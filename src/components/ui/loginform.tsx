import { useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import logo from "../../assets/extra-round.png"
import en from "@/locales/en"
import { LegalDialog } from "@/components/ui/legaldialog"

export function LoginForm({
  className,
  onLogin,
  onRegister,
  loading,
  ...props
}: React.ComponentProps<"div"> & {
  onLogin: (identifier: string, password: string) => Promise<void>
  onRegister: (username: string, email: string | undefined, password: string) => Promise<void>
  loading: boolean
}) {
  const [tab, setTab] = useState<"login" | "signup">("login")
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await onLogin(identifier, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : en.login.error)
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 6) return setError(en.login.errors.passwordTooShort)
    if (password !== confirmPassword) return setError(en.login.errors.passwordMismatch)
    try {
      await onRegister(username, email || undefined, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : en.login.error)
    }
  }

  function switchTab(next: "login" | "signup") {
    setTab(next)
    setError(null)
    setPassword("")
    setConfirmPassword("")
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <div className="flex flex-col items-center gap-2 text-center">
        <img src={logo} alt={en.login.logoAlt} className="w-10 h-10 rounded-xl mb-1" />
        <h1 className="text-xl font-bold">{en.login.title}</h1>
        <p className="text-sm text-muted-foreground">{en.login.subtitle}</p>
      </div>

      <div className="flex rounded-md border border-neutral-700 p-0.5 gap-0.5">
        <button
          type="button"
          onClick={() => switchTab("login")}
          className={cn(
            "flex-1 rounded py-1 text-sm font-medium transition-colors",
            tab === "login" ? "bg-neutral-700 text-white" : "text-muted-foreground hover:text-white"
          )}
        >
          {en.login.signInTab}
        </button>
        <button
          type="button"
          onClick={() => switchTab("signup")}
          className={cn(
            "flex-1 rounded py-1 text-sm font-medium transition-colors",
            tab === "signup" ? "bg-neutral-700 text-white" : "text-muted-foreground hover:text-white"
          )}
        >
          {en.login.signUpTab}
        </button>
      </div>

      {tab === "login" ? (
        <form onSubmit={handleLogin} autoComplete="off">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="identifier">{en.login.username}</FieldLabel>
              <Input
                id="identifier"
                type="text"
                placeholder={en.login.placeholders.username}
                autoComplete="off"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="password">{en.login.password}</FieldLabel>
              <Input
                id="password"
                type="password"
                placeholder={en.login.placeholders.password}
                autoComplete="new-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </Field>
            <Field>
              <Button type="submit" className="w-full" disabled={loading}>
                {en.login.submit}
              </Button>
            </Field>
            {error && <p className="text-xs text-destructive text-center -mt-2">{error}</p>}
          </FieldGroup>
        </form>
      ) : (
        <form onSubmit={handleSignUp} autoComplete="off">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="su-username">{en.login.username}</FieldLabel>
              <Input
                id="su-username"
                type="text"
                placeholder={en.login.placeholders.username}
                autoComplete="off"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="su-email">{en.login.emailOptional}</FieldLabel>
              <Input
                id="su-email"
                type="email"
                placeholder={en.login.placeholders.email}
                autoComplete="off"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="su-password">{en.login.password}</FieldLabel>
              <Input
                id="su-password"
                type="password"
                placeholder={en.login.placeholders.password}
                autoComplete="new-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="su-confirm">{en.login.confirmPassword}</FieldLabel>
              <Input
                id="su-confirm"
                type="password"
                placeholder={en.login.placeholders.password}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
              />
            </Field>
            <Field>
              <Button type="submit" className="w-full" disabled={loading}>
                {en.login.submitSignUp}
              </Button>
            </Field>
            {error && <p className="text-xs text-destructive text-center -mt-2">{error}</p>}
          </FieldGroup>
        </form>
      )}

      <p className="text-center text-xs text-muted-foreground">
        {en.login.terms.prefix}{" "}
        <LegalDialog
          kind="terms"
          trigger={(
            <button type="button" className="underline underline-offset-4 hover:text-primary">
              {en.login.terms.terms}
            </button>
          )}
        />
        {en.login.terms.separator}
        <LegalDialog
          kind="privacy"
          trigger={(
            <button type="button" className="underline underline-offset-4 hover:text-primary">
              {en.login.terms.privacy}
            </button>
          )}
        />
        {" "}{en.login.terms.and}{" "}
        <LegalDialog
          kind="policy"
          trigger={(
            <button type="button" className="underline underline-offset-4 hover:text-primary">
              {en.login.terms.policy}
            </button>
          )}
        />
        .
      </p>
    </div>
  )
}
