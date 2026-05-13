import type { MiddlewareHandler } from 'hono'
import { getCookie } from 'hono/cookie'
import { sign, verify } from 'hono/jwt'
import { z } from 'zod'
import type { ApiUser, AppEnv, User } from './types'

/**
 * Distributed rate limit store using Cloudflare Cache API.
 * Works across multiple Worker instances (unlike in-memory Map).
 */
export class CacheStore {
  private windowMs: number
  constructor(windowMs: number) {
    this.windowMs = windowMs
  }

  private getCacheKey(key: string): string {
    return `https://rate-limit.internal/${key}`
  }

  async increment(key: string) {
    const cacheKey = this.getCacheKey(key)
    const cache = (caches as unknown as { default: Cache }).default
    const now = Date.now()
    const resetAt = now + this.windowMs

    const cached = await cache.match(cacheKey)
    if (!cached) {
      const data = { count: 1, resetAt }
      const response = new Response(JSON.stringify(data), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': `max-age=${Math.ceil(this.windowMs / 1000)}`,
        },
      })
      await cache.put(cacheKey, response)
      return { totalHits: 1, resetTime: new Date(resetAt) }
    }

    const data = await cached.json<{ count: number; resetAt: number }>()
    if (now >= data.resetAt) {
      const newData = { count: 1, resetAt }
      const response = new Response(JSON.stringify(newData), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': `max-age=${Math.ceil(this.windowMs / 1000)}`,
        },
      })
      await cache.put(cacheKey, response)
      return { totalHits: 1, resetTime: new Date(resetAt) }
    }

    data.count++
    const response = new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `max-age=${Math.ceil((data.resetAt - now) / 1000)}`,
      },
    })
    await cache.put(cacheKey, response)
    return { totalHits: data.count, resetTime: new Date(data.resetAt) }
  }

  async decrement(key: string) {
    const cacheKey = this.getCacheKey(key)
    const cache = (caches as unknown as { default: Cache }).default
    const cached = await cache.match(cacheKey)
    if (!cached) return
    const data = await cached.json<{ count: number; resetAt: number }>()
    if (data.count > 0) {
      data.count--
      const response = new Response(JSON.stringify(data), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': `max-age=${Math.ceil((data.resetAt - Date.now()) / 1000)}`,
        },
      })
      await cache.put(cacheKey, response)
    }
  }

  async resetKey(key: string) {
    const cacheKey = this.getCacheKey(key)
    const cache = (caches as unknown as { default: Cache }).default
    await cache.delete(cacheKey)
  }
}

export const nowIso = () => new Date().toISOString()

export const toApiUser = (user: User): ApiUser => ({
  id: user.id,
  username: user.username,
  email: user.email,
  role: user.role,
  avatarUrl: user.avatarUrl ?? null,
})

export const getJwtSecret = (c: { env?: { JWT_SECRET?: string } }) => {
  const secret = c.env?.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET environment variable is required')
  return secret
}

/** Access token: short-lived (15 minutes) */
export const createAccessToken = async (userId: string, secret: string) => {
  return sign({ userId, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 60 * 15 }, secret)
}

/** @deprecated Use createAccessToken instead */
export const createToken = createAccessToken

/** Generate a random refresh token string */
export const generateRefreshToken = () => {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Hash a refresh token for storage (SHA-256) */
export const hashRefreshToken = async (token: string): Promise<string> => {
  const encoded = new TextEncoder().encode(token)
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Refresh token expiry: 30 days */
const REFRESH_TOKEN_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000

/** Store a refresh token in D1 */
export const storeRefreshToken = async (db: D1Database, userId: string, token: string) => {
  const id = crypto.randomUUID()
  const tokenHash = await hashRefreshToken(token)
  const expiresAt = Date.now() + REFRESH_TOKEN_EXPIRY_MS
  await db.prepare(
    'INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, userId, tokenHash, expiresAt, nowIso()).run()
  return { id, expiresAt }
}

/** Validate and consume a refresh token (rotate) */
export const validateRefreshToken = async (db: D1Database, token: string): Promise<{ userId: string } | null> => {
  const tokenHash = await hashRefreshToken(token)
  const row = await db.prepare(
    'SELECT id, user_id, expires_at FROM refresh_tokens WHERE token_hash = ?'
  ).bind(tokenHash).first<{ id: string; user_id: string; expires_at: number }>()
  if (!row || row.expires_at < Date.now()) {
    // If expired, clean it up
    if (row) await db.prepare('DELETE FROM refresh_tokens WHERE id = ?').bind(row.id).run()
    return null
  }
  // Delete the used token (rotation: old token is consumed)
  await db.prepare('DELETE FROM refresh_tokens WHERE id = ?').bind(row.id).run()
  return { userId: row.user_id }
}

/** Delete all refresh tokens for a user (logout from all devices) */
export const deleteAllRefreshTokens = async (db: D1Database, userId: string) => {
  await db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').bind(userId).run()
}

/** Delete a specific refresh token by its hash */
export const deleteRefreshTokenByValue = async (db: D1Database, token: string) => {
  const tokenHash = await hashRefreshToken(token)
  await db.prepare('DELETE FROM refresh_tokens WHERE token_hash = ?').bind(tokenHash).run()
}

const hashPassword = async (password: string, salt: string) => {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    256
  )
  return Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export const createPasswordHash = async (password: string) => {
  const salt = crypto.randomUUID()
  const hash = await hashPassword(password, salt)
  return `${salt}:${hash}`
}

export const verifyPassword = async (password: string, stored: string) => {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const candidate = await hashPassword(password, salt)
  if (candidate.length !== hash.length) return false
  let diff = 0
  for (let i = 0; i < candidate.length; i++) {
    diff |= candidate.charCodeAt(i) ^ hash.charCodeAt(i)
  }
  return diff === 0
}

export const parseJson = async <T>(c: { req: { json: () => Promise<T> } }) => {
  try {
    return await c.req.json()
  } catch {
    return null
  }
}

export const zParse = async <T extends z.ZodTypeAny>(
  schema: T,
  c: { req: { json: () => Promise<unknown> }; json: (data: unknown, status: number) => Response }
): Promise<{ data: z.infer<T>; error: null } | { data: null; error: Response }> => {
  try {
    const body = await c.req.json()
    const result = schema.safeParse(body)
    if (!result.success) {
      const message = result.error.issues.map((i) => i.message).join(', ')
      return { data: null, error: c.json({ error: message }, 400) as unknown as Response }
    }
    return { data: result.data, error: null }
  } catch {
    return { data: null, error: c.json({ error: 'Invalid JSON body.' }, 400) as unknown as Response }
  }
}

export const jsonParse = <T>(str: string, fallback: T): T => {
  try {
    const parsed = JSON.parse(str)
    return parsed as T
  } catch {
    return fallback
  }
}

// D1 helpers
export const dbGetUser = async (db: D1Database, userId: string): Promise<User | null> => {
  const row = await db.prepare(
    'SELECT id, username, email, role, password_hash, avatar_url, password_changed_at FROM users WHERE id = ?'
  ).bind(userId).first<{ id: string; username: string; email: string | null; role: string; password_hash: string; avatar_url: string | null; password_changed_at: string | null }>()
  if (!row) return null
  return {
    id: row.id,
    username: row.username,
    email: row.email ?? null,
    role: row.role as 'admin' | 'teacher' | 'student',
    passwordHash: row.password_hash,
    avatarUrl: row.avatar_url ?? null,
    passwordChangedAt: row.password_changed_at ?? null,
  }
}

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  let token = null as string | null
  const auth = c.req.header('Authorization')
  if (auth?.toLowerCase().startsWith('bearer ')) {
    token = auth.slice(7).trim()
  }
  if (!token) token = getCookie(c, 'accessToken') ?? null
  if (!token) return c.json({ error: 'Unauthorized' }, 401)

  try {
    const secret = getJwtSecret(c)
    const payload = await verify(token, secret, 'HS256')
    const userId = payload.userId as string
    const user = await dbGetUser(c.env.DB, userId)
    if (!user) return c.json({ error: 'Unauthorized' }, 401)

    // Check if token was issued before password change
    if (user.passwordChangedAt && payload.iat) {
      const changedAtSec = Math.floor(new Date(user.passwordChangedAt).getTime() / 1000)
      if ((payload.iat as number) < changedAtSec) {
        return c.json({ error: 'Unauthorized' }, 401)
      }
    }

    c.set('user', user)
    c.set('token', token)
    await next()
  } catch {
    return c.json({ error: 'Unauthorized' }, 401)
  }
}

export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = c.get('user')
  if (user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403)
  await next()
}

export const requireTeacherOrAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = c.get('user')
  if (user.role !== 'admin' && user.role !== 'teacher') return c.json({ error: 'Forbidden' }, 403)
  await next()
}

// Score helpers (pure, no DB needed)
const isCorrect = (correct: string | string[] | null | undefined, response: unknown) => {
  if (correct == null) return null
  let normalized = response
  if (typeof response === 'string' && response.startsWith('[') && response.endsWith(']')) {
    try { normalized = JSON.parse(response) } catch { /* ignore */ }
  }
  if (Array.isArray(correct)) {
    if (!Array.isArray(normalized) || normalized.length < correct.length) return false
    return correct.every((value, index) => {
      const answer = (normalized as unknown[])[index]
      return typeof answer === 'string'
        ? answer.trim().toLowerCase() === value.trim().toLowerCase()
        : answer === value
    })
  }
  if (typeof correct === 'string') {
    if (Array.isArray(normalized)) {
      if (normalized.length !== 1) return false
      const answer = normalized[0]
      return typeof answer === 'string'
        ? answer.trim().toLowerCase() === correct.trim().toLowerCase()
        : answer === correct
    }
    if (typeof normalized === 'string') return normalized.trim().toLowerCase() === correct.trim().toLowerCase()
    return normalized === correct
  }
  return false
}

const LISTENING_BAND: Record<number, number> = {
  39: 9, 40: 9, 37: 8.5, 38: 8.5, 35: 8, 36: 8,
  32: 7.5, 33: 7.5, 34: 7.5, 30: 7, 31: 7,
  26: 6.5, 27: 6.5, 28: 6.5, 29: 6.5, 23: 6, 24: 6, 25: 6,
  18: 5.5, 19: 5.5, 20: 5.5, 21: 5.5, 22: 5.5, 16: 5, 17: 5,
  13: 4.5, 14: 4.5, 15: 4.5, 10: 4, 11: 4, 12: 4,
  8: 3.5, 9: 3.5, 6: 3, 7: 3, 4: 2.5, 5: 2.5,
}

const READING_ACADEMIC_BAND: Record<number, number> = {
  39: 9, 40: 9, 37: 8.5, 38: 8.5, 35: 8, 36: 8,
  33: 7.5, 34: 7.5, 30: 7, 31: 7, 32: 7,
  27: 6.5, 28: 6.5, 29: 6.5, 23: 6, 24: 6, 25: 6, 26: 6,
  19: 5.5, 20: 5.5, 21: 5.5, 22: 5.5, 15: 5, 16: 5, 17: 5, 18: 5,
  13: 4.5, 14: 4.5, 10: 4, 11: 4, 12: 4,
  8: 3.5, 9: 3.5, 6: 3, 7: 3, 4: 2.5, 5: 2.5,
}

const lookupBand = (score: number, table: Record<number, number>): number | null => {
  if (score <= 0) return null
  const thresholds = Object.keys(table).map(Number).sort((a, b) => b - a)
  for (const t of thresholds) {
    if (score >= t) return table[t]
  }
  return 1
}

export const scoreAttempt = (responses: Record<string, unknown>, test: import('./types').TestDetail) => {
  let score = 0, readingScore = 0, listeningScore = 0
  for (const section of test.sections) {
    for (const question of section.questions) {
      if (question.correctAnswer == null) continue
      if (isCorrect(question.correctAnswer, responses[question.id])) {
        score += question.points
        if (section.kind === 'reading') readingScore += question.points
        else if (section.kind === 'listening') listeningScore += question.points
      }
    }
  }
  const listeningBand = lookupBand(listeningScore, LISTENING_BAND)
  const readingBand = lookupBand(readingScore, READING_ACADEMIC_BAND)
  let band: number | null = null
  if (listeningBand != null && readingBand != null) band = Math.round(((listeningBand + readingBand) / 2) * 2) / 2
  else if (listeningBand != null) band = listeningBand
  else if (readingBand != null) band = readingBand
  return { scoreTotal: score, band, readingBand, listeningBand }
}

export const computeCorrectness = (responses: Record<string, unknown>, test: import('./types').TestDetail) => {
  const correctness: Record<string, boolean> = {}
  for (const section of test.sections) {
    for (const question of section.questions) {
      if (question.correctAnswer == null) continue
      correctness[question.id] = !!isCorrect(question.correctAnswer, responses[question.id])
    }
  }
  return correctness
}

export const getAssignmentDurationMinutes = (test: import('./types').TestDetail, sectionKinds: Array<'listening' | 'reading'>) => {
  const byKind = (test as { durationMinutesByKind?: Partial<Record<'listening' | 'reading', number>> }).durationMinutesByKind
  const uniqueKinds = Array.from(new Set(sectionKinds))
  const durations = uniqueKinds.map((kind) => {
    const fromByKind = byKind?.[kind]
    if (typeof fromByKind === 'number') return fromByKind
    const section = test.sections.find((s) => s.kind === kind && typeof s.durationMinutes === 'number')
    return typeof section?.durationMinutes === 'number' ? section.durationMinutes : null
  }).filter((v): v is number => typeof v === 'number')
  return durations.length ? durations.reduce((a, b) => a + b, 0) : test.durationMinutes
}

export const filterTestForAssignment = (test: import('./types').TestDetail, sectionKinds: Array<'listening' | 'reading'>) => ({
  ...test,
  sections: test.sections.filter((s) => sectionKinds.includes(s.kind)),
})
