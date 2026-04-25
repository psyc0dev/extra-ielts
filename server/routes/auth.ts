import type { Hono } from 'hono'
import { deleteCookie, setCookie } from 'hono/cookie'
import { rateLimiter } from 'hono-rate-limiter'
import type { AppEnv } from '../lib/types'
import { LoginBodySchema, RegisterBodySchema } from '../lib/schemas'
import { createPasswordHash, createToken, nowIso, zParse, requireAuth, toApiUser, verifyPassword, CacheStore } from '../lib/store'

const getSecret = (c: { env: { JWT_SECRET: string } }) => {
  const s = c.env.JWT_SECRET
  if (!s) throw new Error('JWT_SECRET is required')
  return s
}

const authLimiter = rateLimiter({
  windowMs: 15 * 60_000,
  limit: 20,
  store: new CacheStore(15 * 60_000),
  keyGenerator: (c) => c.req.header('x-forwarded-for') ?? 'unknown',
  message: { error: 'Too many attempts. Please try again later.' },
})

const setAuthCookie = (c: Parameters<typeof setCookie>[0], token: string) =>
  setCookie(c, 'accessToken', token, { path: '/', secure: true, httpOnly: true, maxAge: 60 * 60 * 24 * 7, sameSite: 'Strict' })

export const registerAuthRoutes = (api: Hono<AppEnv>) => {
  api.post('/auth/register', authLimiter, async (c) => {
    const { data, error } = await zParse(RegisterBodySchema, c)
    if (error) return error

    const username = data.username.trim()
    const email = data.email?.trim().toLowerCase() ?? null

    const existing = await c.env.DB.prepare(
      'SELECT id FROM users WHERE LOWER(username) = ?'
    ).bind(username.toLowerCase()).first()
    if (existing) return c.json({ error: 'Username already taken.' }, 409)

    if (email) {
      const emailExists = await c.env.DB.prepare(
        'SELECT id FROM users WHERE LOWER(email) = ?'
      ).bind(email).first()
      if (emailExists) return c.json({ error: 'Email already in use.' }, 409)
    }

    const id = crypto.randomUUID()
    const passwordHash = await createPasswordHash(data.password)
    await c.env.DB.prepare(
      'INSERT INTO users (id, username, email, role, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(id, username, email, 'student', passwordHash, nowIso()).run()

    const secret = getSecret(c)
    const token = await createToken(id, secret)
    setAuthCookie(c, token)
    return c.json({ token, user: { id, username, email, role: 'student', avatarUrl: null } }, 201)
  })

  api.post('/auth/login', authLimiter, async (c) => {
    const { data, error } = await zParse(LoginBodySchema, c)
    if (error) return error

    const identifier = data.identifier.trim().toLowerCase()
    const row = await c.env.DB.prepare(
      'SELECT id, username, email, role, password_hash, avatar_url FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?'
    ).bind(identifier, identifier).first<{ id: string; username: string; email: string | null; role: string; password_hash: string; avatar_url: string | null }>()

    if (!row) return c.json({ error: 'Invalid credentials.' }, 401)
    const ok = await verifyPassword(data.password, row.password_hash)
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
