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
  loading,
  ...props
}: React.ComponentProps<"div"> & {
  onLogin: (identifier: string, password: string) => Promise<void>
  loading: boolean
}) {
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await onLogin(identifier, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : en.login.error)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <div className="flex flex-col items-center gap-2 text-center">
        <img src={logo} alt={en.login.logoAlt} className="w-10 h-10 rounded-xl mb-1" />
        <h1 className="text-xl font-bold">{en.login.title}</h1>
        <p className="text-sm text-muted-foreground">{en.login.subtitle}</p>
      </div>

      <form onSubmit={handleSubmit} autoComplete="off">
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
          {error && (
            <p className="text-xs text-destructive text-center -mt-2">{error}</p>
          )}
        </FieldGroup>
      </form>
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
