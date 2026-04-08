import type { MiddlewareHandler } from 'hono'
import { getCookie } from 'hono/cookie'
import { sign, verify } from 'hono/jwt'
import { z } from 'zod'
import type { ApiUser, AppEnv, User } from './types'

export class MemoryStore {
  private hits = new Map<string, { count: number; resetAt: number }>()
  constructor(private windowMs: number) {}
  init(_options: { windowMs: number }) {}
  async increment(key: string) {
    const now = Date.now()
    const entry = this.hits.get(key)
    if (!entry || now >= entry.resetAt) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs })
      return { totalHits: 1, resetTime: new Date(now + this.windowMs) }
    }
    entry.count++
    return { totalHits: entry.count, resetTime: new Date(entry.resetAt) }
  }
  async decrement(key: string) { const e = this.hits.get(key); if (e && e.count > 0) e.count-- }
  async resetKey(key: string) { this.hits.delete(key) }
}

export const nowIso = () => new Date().toISOString()

export const toApiUser = (user: User): ApiUser => ({
  id: user.id,
  username: user.username,
  email: user.email,
  role: user.role,
  avatarUrl: user.avatarUrl ?? null,
})

const getJwtSecret = (c: { env: { JWT_SECRET?: string } }) => {
  const secret = c.env?.JWT_SECRET ?? process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET is required')
  return secret
}

export const createToken = async (userId: string, secret: string) => {
  return sign({ userId, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 }, secret)
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
  let diff = candidate.length ^ hash.length
  const len = Math.min(candidate.length, hash.length)
  for (let i = 0; i < len; i++) {
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
    'SELECT id, username, email, role, password_hash, avatar_url FROM users WHERE id = ?'
  ).bind(userId).first<{ id: string; username: string; email: string | null; role: string; password_hash: string; avatar_url: string | null }>()
  if (!row) return null
  return {
    id: row.id,
    username: row.username,
    email: row.email ?? null,
    role: row.role as 'admin' | 'student',
    passwordHash: row.password_hash,
    avatarUrl: row.avatar_url ?? null,
  }
}

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  let token = null as string | null
  const auth = c.req.header('Authorization')
  if (auth?.toLowerCase().startsWith('bearer ')) {
    token = auth.slice(7).trim()
  }
  if (!token) token = getCookie(c, 'accessToken') ?? null
  if (!token) token = c.req.query('token') ?? null
  if (!token) return c.json({ error: 'Unauthorized' }, 401)

  try {
    const secret = getJwtSecret(c)
    const payload = await verify(token, secret, 'HS256')
    const userId = payload.userId as string
    const user = await dbGetUser(c.env.DB, userId)
    if (!user) return c.json({ error: 'Unauthorized' }, 401)
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
