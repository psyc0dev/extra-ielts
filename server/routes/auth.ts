import type { Hono } from 'hono'
import { deleteCookie, setCookie } from 'hono/cookie'
import { sign } from 'hono/jwt'
import type { AppEnv } from '../lib/types'
import { createPasswordHash, createToken, nowIso, parseJson, requireAuth, toApiUser, verifyPassword } from '../lib/store'

const getSecret = (c: { env: { JWT_SECRET?: string } }) => {
  const s = c.env?.JWT_SECRET ?? process.env.JWT_SECRET
  if (!s) throw new Error('JWT_SECRET is required')
  return s
}

const setAuthCookie = (c: Parameters<typeof setCookie>[0], token: string) =>
  setCookie(c, 'accessToken', token, { path: '/', secure: true, httpOnly: false, maxAge: 60 * 60 * 24 * 7, sameSite: 'Lax' })

export const registerAuthRoutes = (api: Hono<AppEnv>) => {
  api.get('/auth/bootstrap', async (c) => {
    const row = await c.env.DB.prepare('SELECT COUNT(*) as count FROM users').first<{ count: number }>()
    return c.json({ needsBootstrap: (row?.count ?? 0) === 0 })
  })

  api.post('/auth/bootstrap', async (c) => {
    const row = await c.env.DB.prepare('SELECT COUNT(*) as count FROM users').first<{ count: number }>()
    if ((row?.count ?? 0) > 0) return c.json({ error: 'Bootstrap already completed.' }, 400)

    const body = await parseJson<{ username?: string; email?: string; password?: string }>(c)
    if (!body?.username || !body.password) return c.json({ error: 'Username and password are required.' }, 400)

    const id = crypto.randomUUID()
    const passwordHash = await createPasswordHash(body.password)
    await c.env.DB.prepare(
      'INSERT INTO users (id, username, email, role, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(id, body.username, body.email ?? null, 'admin', passwordHash, nowIso()).run()

    const secret = getSecret(c)
    const token = await createToken(id, secret)
    setAuthCookie(c, token)
    return c.json({ token, user: { id, username: body.username, email: body.email ?? null, role: 'admin', avatarUrl: null } }, 201)
  })

  api.post('/auth/login', async (c) => {
    const body = await parseJson<{ identifier?: string; password?: string }>(c)
    if (!body?.identifier || !body.password) return c.json({ error: 'Identifier and password are required.' }, 400)

    const identifier = body.identifier.trim().toLowerCase()
    const row = await c.env.DB.prepare(
      'SELECT id, username, email, role, password_hash, avatar_url FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?'
    ).bind(identifier, identifier).first<{ id: string; username: string; email: string | null; role: string; password_hash: string; avatar_url: string | null }>()

    if (!row) return c.json({ error: 'Invalid credentials.' }, 401)
    const ok = await verifyPassword(body.password, row.password_hash)
    if (!ok) return c.json({ error: 'Invalid credentials.' }, 401)

    const secret = getSecret(c)
    const token = await createToken(row.id, secret)
    setAuthCookie(c, token)
    return c.json({ token, user: { id: row.id, username: row.username, email: row.email, role: row.role, avatarUrl: row.avatar_url ?? null } }, 200)
  })

  api.post('/auth/logout', requireAuth, (c) => {
    deleteCookie(c, 'accessToken', { path: '/' })
    return c.json({ ok: true }, 200)
  })

  api.get('/auth/me', requireAuth, (c) => {
    return c.json({ user: toApiUser(c.get('user')) })
  })
}
