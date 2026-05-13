import type { Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { sign } from 'hono/jwt'
import { rateLimiter } from 'hono-rate-limiter'
import type { AppEnv } from '../lib/types'
import { LoginBodySchema, RegisterBodySchema } from '../lib/schemas'
import {
  createPasswordHash,
  createAccessToken,
  generateRefreshToken,
  storeRefreshToken,
  validateRefreshToken,
  deleteRefreshTokenByValue,
  deleteAllRefreshTokens,
  nowIso,
  zParse,
  requireAuth,
  toApiUser,
  verifyPassword,
  CacheStore,
  dbGetUser,
  getJwtSecret,
} from '../lib/store'

const getSecret = (c: { env: { JWT_SECRET: string } }) => {
  const s = c.env.JWT_SECRET
  if (!s) throw new Error('JWT_SECRET is required')
  return s
}

const authLimiter = rateLimiter({
  windowMs: 15 * 60_000,
  limit: 20,
  store: new CacheStore(15 * 60_000),
  keyGenerator: (c) => c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? 'unknown',
  message: { error: 'Too many attempts. Please try again later.' },
})

/** Whether we're running in production (HTTPS) */
const isSecure = (c: { env?: { CORS_ORIGIN?: string } }) => {
  const origin = (c as any).env?.CORS_ORIGIN ?? ''
  return origin.startsWith('https://') || (!origin.includes('localhost') && !origin.includes('127.0.0.1') && origin !== '*')
}

/** Set short-lived access token cookie (15 min) */
const setAccessCookie = (c: Parameters<typeof setCookie>[0], token: string) =>
  setCookie(c, 'accessToken', token, { path: '/', secure: isSecure(c), httpOnly: true, maxAge: 60 * 15, sameSite: 'Lax' })

/** Set long-lived refresh token cookie (30 days) */
const setRefreshCookie = (c: Parameters<typeof setCookie>[0], token: string) =>
  setCookie(c, 'refreshToken', token, { path: '/api/auth', secure: isSecure(c), httpOnly: true, maxAge: 60 * 60 * 24 * 30, sameSite: 'Lax' })

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
    const accessToken = await createAccessToken(id, secret)
    const refreshToken = generateRefreshToken()
    await storeRefreshToken(c.env.DB, id, refreshToken)

    setAccessCookie(c, accessToken)
    setRefreshCookie(c, refreshToken)
    return c.json({ user: { id, username, email, role: 'student', avatarUrl: null } }, 201)
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
    const accessToken = await createAccessToken(row.id, secret)
    const refreshToken = generateRefreshToken()
    await storeRefreshToken(c.env.DB, row.id, refreshToken)

    setAccessCookie(c, accessToken)
    setRefreshCookie(c, refreshToken)
    return c.json({ user: { id: row.id, username: row.username, email: row.email, role: row.role, avatarUrl: row.avatar_url ?? null } }, 200)
  })

  api.post('/auth/refresh', async (c) => {
    const refreshToken = getCookie(c, 'refreshToken')
    if (!refreshToken) return c.json({ error: 'No refresh token.' }, 401)

    const result = await validateRefreshToken(c.env.DB, refreshToken)
    if (!result) {
      deleteCookie(c, 'refreshToken', { path: '/api/auth' })
      deleteCookie(c, 'accessToken', { path: '/' })
      return c.json({ error: 'Invalid or expired refresh token.' }, 401)
    }

    // Verify user still exists and check passwordChangedAt
    const user = await dbGetUser(c.env.DB, result.userId)
    if (!user) {
      deleteCookie(c, 'refreshToken', { path: '/api/auth' })
      deleteCookie(c, 'accessToken', { path: '/' })
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const secret = getJwtSecret(c)
    const newAccessToken = await createAccessToken(user.id, secret)
    const newRefreshToken = generateRefreshToken()
    await storeRefreshToken(c.env.DB, user.id, newRefreshToken)

    setAccessCookie(c, newAccessToken)
    setRefreshCookie(c, newRefreshToken)
    return c.json({ user: toApiUser(user) }, 200)
  })

  /** Get a short-lived token for WebSocket/download use (requires valid session) */
  api.get('/auth/ws-token', requireAuth, async (c) => {
    const user = c.get('user')
    const secret = getJwtSecret(c)
    // Issue a very short-lived token (2 min) for WS connection initiation
    const wsToken = await sign(
      { userId: user.id, exp: Math.floor(Date.now() / 1000) + 120 },
      secret
    )
    return c.json({ token: wsToken })
  })

  api.post('/auth/logout', requireAuth, async (c) => {
    // Delete the refresh token from DB
    const refreshToken = getCookie(c, 'refreshToken')
    if (refreshToken) {
      await deleteRefreshTokenByValue(c.env.DB, refreshToken)
    }
    deleteCookie(c, 'accessToken', { path: '/' })
    deleteCookie(c, 'refreshToken', { path: '/api/auth' })
    return c.json({ ok: true }, 200)
  })

  /** Logout from all devices — deletes all refresh tokens */
  api.post('/auth/logout-all', requireAuth, async (c) => {
    const user = c.get('user')
    await deleteAllRefreshTokens(c.env.DB, user.id)
    deleteCookie(c, 'accessToken', { path: '/' })
    deleteCookie(c, 'refreshToken', { path: '/api/auth' })
    return c.json({ ok: true }, 200)
  })

  api.get('/auth/me', requireAuth, (c) => {
    return c.json({ user: toApiUser(c.get('user')) })
  })
}
