import type { Hono } from 'hono'
import { deleteCookie, setCookie } from 'hono/cookie'
import type { AppEnv } from '../lib/types'
import {
  commit,
  createPasswordHash,
  createToken,
  parseJson,
  requireAuth,
  store,
  toApiUser,
  verifyPassword,
} from '../lib/store'

export const registerAuthRoutes = (api: Hono<AppEnv>) => {
  api.get('/auth/bootstrap', (c) => {
    return c.json({ needsBootstrap: store.users.length === 0 })
  })

  api.post('/auth/bootstrap', async (c) => {
    if (store.users.length > 0) {
      return c.json({ error: 'Bootstrap already completed.' }, 400)
    }
    const body = await parseJson<{ username?: string; email?: string; password?: string }>(c)
    if (!body?.username || !body.password) {
      return c.json({ error: 'Username and password are required.' }, 400)
    }

    const passwordHash = await createPasswordHash(body.password)
    const user = {
      id: crypto.randomUUID(),
      username: body.username,
      email: body.email ?? null,
      role: 'admin' as const,
      passwordHash,
    }
    store.users.push(user)
    commit()

    const token = await createToken(user.id)
    setCookie(c, 'accessToken', token, {
      path: '/',
      secure: true,
      httpOnly: false, // js-cookie needs to read it
      maxAge: 60 * 60 * 24 * 7,
      sameSite: 'Lax',
    })
    return c.json({ token, user: toApiUser(user) })
  })

  api.post('/auth/login', async (c) => {
    const body = await parseJson<{ identifier?: string; password?: string }>(c)
    if (!body?.identifier || !body.password) {
      return c.json({ error: 'Identifier and password are required.' }, 400)
    }
    const identifier = body.identifier.trim().toLowerCase()
    const user = store.users.find(
      (candidate) =>
        candidate.username.toLowerCase() === identifier ||
        (candidate.email ? candidate.email.toLowerCase() === identifier : false)
    )
    if (!user) {
      return c.json({ error: 'Invalid credentials.' }, 401)
    }

    const ok = await verifyPassword(body.password, user.passwordHash)
    if (!ok) {
      return c.json({ error: 'Invalid credentials.' }, 401)
    }

    const token = await createToken(user.id)
    setCookie(c, 'accessToken', token, {
      path: '/',
      secure: true,
      httpOnly: false,
      maxAge: 60 * 60 * 24 * 7,
      sameSite: 'Lax',
    })
    return c.json({ token, user: toApiUser(user) })
  })

  api.post('/auth/logout', requireAuth, (c) => {
    deleteCookie(c, 'accessToken', { path: '/' })
    return c.json({ ok: true })
  })

  api.get('/auth/me', requireAuth, (c) => {
    const user = c.get('user')
    return c.json({ user: toApiUser(user) })
  })
}
