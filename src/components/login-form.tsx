import { useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import logo from "../../src-tauri/icons/icon.ico"
import en from "@/locales/en"

export function LoginForm({
  className,
  onLogin,
  onBootstrap,
  needsBootstrap,
  loading,
  ...props
}: React.ComponentProps<"div"> & {
  onLogin: (identifier: string, password: string) => Promise<void>
  onBootstrap: (payload: { username: string; email?: string; password: string }) => Promise<void>
  needsBootstrap: boolean
  loading: boolean
}) {
  const [identifier, setIdentifier] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState(needsBootstrap ? "bootstrap" : "login")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      if (mode === "bootstrap") {
        await onBootstrap({ username: identifier, email: email || undefined, password })
      } else {
        await onLogin(identifier, password)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : en.login.error)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <div className="flex flex-col items-center gap-2 text-center">
        <img src={logo} alt="logo" className="w-10 h-10 rounded-xl mb-1" />
        <h1 className="text-xl font-bold">{mode === "bootstrap" ? en.login.bootstrapTitle : en.login.title}</h1>
        <p className="text-sm text-muted-foreground">
          {mode === "bootstrap" ? en.login.bootstrapSubtitle : en.login.subtitle}
        </p>
      </div>

      <Tabs value={mode} onValueChange={setMode}>
        <TabsList className="grid grid-cols-2">
          <TabsTrigger value="login" disabled={needsBootstrap}>{en.login.signInTab}</TabsTrigger>
          <TabsTrigger value="bootstrap">{en.login.bootstrapTab}</TabsTrigger>
        </TabsList>
      </Tabs>

      <form onSubmit={handleSubmit} autoComplete="off">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="identifier">{en.login.username}</FieldLabel>
            <Input
              id="identifier"
              type="text"
              placeholder="username"
              autoComplete="off"
              value={identifier}
              onChange={e => setIdentifier(e.target.value)}
              required
            />
          </Field>
          {mode === "bootstrap" && (
            <Field>
              <FieldLabel htmlFor="email">{en.login.email}</FieldLabel>
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                autoComplete="off"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </Field>
          )}
          <Field>
            <FieldLabel htmlFor="password">{en.login.password}</FieldLabel>
            <Input
              id="password"
              type="password"
              placeholder="********"
              autoComplete="new-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </Field>
          <Field>
            <Button type="submit" className="w-full" disabled={loading}>
              {mode === "bootstrap" ? en.login.bootstrapAction : en.login.submit}
            </Button>
          </Field>
          {error && (
            <p className="text-xs text-destructive text-center -mt-2">{error}</p>
          )}
        </FieldGroup>
      </form>
      <p className="text-center text-xs text-muted-foreground">
        By clicking continue, you agree to our{" "}
        <a href="#" className="underline underline-offset-4 hover:text-primary">Terms of Service</a><br />
        and <a href="#" className="underline underline-offset-4 hover:text-primary">Privacy Policy</a>.
      </p>
    </div>
  )
}
