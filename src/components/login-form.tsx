import { useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import logo from "../../src-tauri/icons/icon.ico"
import en from "@/locales/en"

export function LoginForm({
  className,
  onLogin,
  ...props
}: React.ComponentProps<"div"> & { onLogin: (username: string) => void }) {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (username === "psyc0dev" && password === "admin") {
      setError(false)
      onLogin(username)
    } else {
      setError(true)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <div className="flex flex-col items-center gap-2 text-center">
        <img src={logo} alt="logo" className="w-10 h-10 rounded-xl mb-1" />
        <h1 className="text-xl font-bold">{en.login.title}</h1>
        <p className="text-sm text-muted-foreground">{en.login.subtitle}</p>
      </div>
      <form onSubmit={handleSubmit} autoComplete="off">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="username">{en.login.username}</FieldLabel>
            <Input
              id="username"
              type="text"
              placeholder="username"
              autoComplete="off"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="password">{en.login.password}</FieldLabel>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </Field>
          <Field>
            <Button type="submit" className="w-full">{en.login.submit}</Button>
          </Field>
          {error && (
            <p className="text-xs text-destructive text-center -mt-2">{en.login.error}</p>
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
