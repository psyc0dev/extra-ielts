import type { MiddlewareHandler } from 'hono'
import { getCookie } from 'hono/cookie'
import { sign, verify } from 'hono/jwt'
import type {
  ApiUser,
  AppEnv,
  Assignment,
  AssignmentSummary,
  Attempt,
  Role,
  Store,
  StoreSnapshot,
  TestDetail,
  TestSummary,
  UserSettings,
  User,
} from './types'

let store: Store = {
  users: [],
  assignments: [],
  attempts: [],
  groups: [],
  settings: {},
}

let persistStore: ((snapshot: StoreSnapshot) => void) | null = null

export const getStore = () => store
// amazonq-ignore-next-line
const JWT_SECRET = process.env.JWT_SECRET ?? (() => { throw new Error('JWT_SECRET env var is required') })()

export const setPersist = (persist?: (snapshot: StoreSnapshot) => void) => {
  persistStore = persist ?? null
}


export const defaultSettings: UserSettings = {
  notifications: true,
  sound: true,
  timerWarning: true,
}

export const getSettingsForUser = (userId: string) => {
  const existing = store.settings[userId]
  if (existing) return existing
  const next = { ...defaultSettings }
  store.settings[userId] = next
  commit()
  return next
}

export const updateSettingsForUser = (userId: string, patch: Partial<UserSettings>) => {
  const next = { ...getSettingsForUser(userId), ...patch }
  store.settings[userId] = next
  commit()
  return next
}


export const loadSnapshot = (snapshot?: StoreSnapshot) => {
  if (!snapshot) return
  store.users = snapshot.users
  store.assignments = snapshot.assignments
  store.attempts = snapshot.attempts
  store.groups = snapshot.groups
  store.settings = snapshot.settings ?? {}
}

export const getStoreSnapshot = (): StoreSnapshot => ({
  users: store.users,
  assignments: store.assignments,
  attempts: store.attempts,
  groups: store.groups,
  settings: store.settings,
})

export const commit = () => {
  if (persistStore) {
    persistStore(getStoreSnapshot())
  }
}

export const nowIso = () => new Date().toISOString()

export const toApiUser = (user: User): ApiUser => ({
  id: user.id,
  username: user.username,
  email: user.email,
  role: user.role,
})

export const createToken = async (userId: string) => {
  // amazonq-ignore-next-line
  const token = await sign({ userId, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 }, JWT_SECRET)
  return token
}

export const getUserById = (userId: string) => store.users.find((user) => user.id === userId)

const hashPassword = async (password: string, salt: string) => {
  const data = new TextEncoder().encode(`${salt}:${password}`)
  const buffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
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
  // Constant-time comparison
  let diff = candidate.length ^ hash.length
  const len = Math.min(candidate.length, hash.length)
  for (let i = 0; i < len; i++) {
    diff |= candidate.charCodeAt(i) ^ hash.charCodeAt(i)
  }
  return diff === 0
}

export const getLatestAttemptForTest = (userId: string, testId: string) => {
  const attempts = store.attempts
    .filter((attempt) => attempt.userId === userId && attempt.testId === testId)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  return attempts[0] ?? null
}

export const getAssignmentAttempt = (assignmentId: string, userId: string) => {
  const attempts = store.attempts
    .filter((attempt) => attempt.assignmentId === assignmentId && attempt.userId === userId)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  return attempts[0] ?? null
}

const toAttemptSummary = (attempt: Attempt | null) => {
  if (!attempt) return null
  return {
    id: attempt.id,
    status: attempt.status,
    scoreTotal: attempt.scoreTotal,
    band: attempt.band,
    readingBand: attempt.readingBand,
    listeningBand: attempt.listeningBand,
    startedAt: attempt.startedAt,
    completedAt: attempt.completedAt,
  }
}

export const toTestSummary = (test: TestDetail, attempt: Attempt | null, includePublished: boolean) => {
  const sectionsCount = test.sections.length
  const questionsCount = test.sections.reduce((total, section) => total + section.questions.length, 0)
  const summary: TestSummary = {
    id: test.id,
    title: test.title,
    durationMinutes: test.durationMinutes,
    sectionsCount,
    questionsCount,
    attempt: toAttemptSummary(attempt),
  }
  if (includePublished) {
    summary.published = test.published ?? false
  }
  return summary
}

export const toAssignmentSummary = (
  assignment: Assignment,
  test: TestDetail,
  attempt: Attempt | null
): AssignmentSummary => ({
  id: assignment.id,
  type: assignment.type,
  testId: assignment.testId,
  title: test.title,
  durationMinutes: getAssignmentDurationMinutes(test, assignment.sectionKinds),
  dueAt: assignment.dueAt,
  sectionKinds: assignment.sectionKinds,
  attempt: toAttemptSummary(attempt),
})

export const filterTestForAssignment = (test: TestDetail, sectionKinds: Array<'listening' | 'reading'>) => ({
  ...test,
  sections: test.sections.filter((section) => sectionKinds.includes(section.kind)),
})

const getKindDurationMinutes = (test: TestDetail, kind: 'listening' | 'reading') => {
  const byKind = (test as { durationMinutesByKind?: Partial<Record<'listening' | 'reading', number>> })
    .durationMinutesByKind
  const fromByKind = byKind?.[kind]
  if (typeof fromByKind === 'number') return fromByKind

  const section = test.sections.find((s) => s.kind === kind && typeof s.durationMinutes === 'number')
  if (section && typeof section.durationMinutes === 'number') return section.durationMinutes
  return null
}

export const getAssignmentDurationMinutes = (test: TestDetail, sectionKinds: Array<'listening' | 'reading'>) => {
  const uniqueKinds = Array.from(new Set(sectionKinds))
  const durations = uniqueKinds
    .map((kind) => getKindDurationMinutes(test, kind))
    .filter((value): value is number => typeof value === 'number')

  if (!durations.length) return test.durationMinutes
  return durations.reduce((sum, value) => sum + value, 0)
}

const isCorrect = (correct: string | string[] | null | undefined, response: unknown) => {
  if (correct == null) return null
  
  // Normalize response: if it's a string that looks like a JSON array, parse it
  let normalized = response;
  if (typeof response === 'string' && response.startsWith('[') && response.endsWith(']')) {
    try { normalized = JSON.parse(response); } catch { /* ignore */ }
  }

  if (Array.isArray(correct)) {
    if (!Array.isArray(normalized)) return false
    if (normalized.length < correct.length) return false
    // For matching-sentence-endings and list-selection: order matters for sentence endings, set match for list
    return correct.every((value, index) => {
      const answer = normalized[index]
      if (typeof answer === 'string') {
        return answer.trim().toLowerCase() === value.trim().toLowerCase()
      }
      return answer === value
    })
  }

  if (typeof correct === 'string') {
    if (Array.isArray(normalized)) {
      if (normalized.length !== 1) return false
      const answer = normalized[0]
      if (typeof answer === 'string') {
        return answer.trim().toLowerCase() === correct.trim().toLowerCase()
      }
      return answer === correct
    }
    if (typeof normalized === 'string') {
      return normalized.trim().toLowerCase() === correct.trim().toLowerCase()
    }
    return normalized === correct
  }
  return false
}

// Official IELTS raw score to band conversion tables (40 questions each)
const LISTENING_BAND: Record<number, number> = {
  39: 9, 40: 9,
  37: 8.5, 38: 8.5,
  35: 8, 36: 8,
  32: 7.5, 33: 7.5, 34: 7.5,
  30: 7, 31: 7,
  26: 6.5, 27: 6.5, 28: 6.5, 29: 6.5,
  23: 6, 24: 6, 25: 6,
  18: 5.5, 19: 5.5, 20: 5.5, 21: 5.5, 22: 5.5,
  16: 5, 17: 5,
  13: 4.5, 14: 4.5, 15: 4.5,
  10: 4, 11: 4, 12: 4,
  8: 3.5, 9: 3.5,
  6: 3, 7: 3,
  4: 2.5, 5: 2.5,
}

const READING_ACADEMIC_BAND: Record<number, number> = {
  39: 9, 40: 9,
  37: 8.5, 38: 8.5,
  35: 8, 36: 8,
  33: 7.5, 34: 7.5,
  30: 7, 31: 7, 32: 7,
  27: 6.5, 28: 6.5, 29: 6.5,
  23: 6, 24: 6, 25: 6, 26: 6,
  19: 5.5, 20: 5.5, 21: 5.5, 22: 5.5,
  15: 5, 16: 5, 17: 5, 18: 5,
  13: 4.5, 14: 4.5,
  10: 4, 11: 4, 12: 4,
  8: 3.5, 9: 3.5,
  6: 3, 7: 3,
  4: 2.5, 5: 2.5,
}

const lookupBand = (score: number, table: Record<number, number>): number | null => {
  if (score <= 0) return null
  // Find the highest threshold <= score
  const thresholds = Object.keys(table).map(Number).sort((a, b) => b - a)
  for (const t of thresholds) {
    if (score >= t) return table[t]
  }
  return 1
}

export const scoreAttempt = (attempt: Attempt, test: TestDetail) => {
  let score = 0
  let readingScore = 0
  let listeningScore = 0

  for (const section of test.sections) {
    for (const question of section.questions) {
      if (question.correctAnswer == null) continue
      const correct = isCorrect(question.correctAnswer, attempt.responses[question.id])
      if (correct) {
        score += question.points
        if (section.kind === 'reading') readingScore += question.points
        else if (section.kind === 'listening') listeningScore += question.points
      }
    }
  }

  const listeningBand = lookupBand(listeningScore, LISTENING_BAND)
  const readingBand = lookupBand(readingScore, READING_ACADEMIC_BAND)

  let band: number | null = null
  if (listeningBand != null && readingBand != null) {
    band = Math.round(((listeningBand + readingBand) / 2) * 2) / 2
  } else if (listeningBand != null) {
    band = listeningBand
  } else if (readingBand != null) {
    band = readingBand
  }

  return { scoreTotal: score, band, readingBand, listeningBand }
}

const getAuthToken = (authorization: string | null) => {
  if (!authorization) return null
  const [scheme, token] = authorization.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null
  return token.trim()
}

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  let token = getAuthToken(c.req.header('Authorization') ?? null)
  if (!token) {
    token = getCookie(c, 'accessToken') ?? null
  }
  
  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  try {
    const payload = await verify(token, JWT_SECRET, 'HS256')
    const userId = payload.userId as string

    const user = getUserById(userId)
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }
    
    c.set('user', user)
    c.set('token', token)
    await next()
  } catch (err) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
}

export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = c.get('user')
  if (user.role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403)
  }
  await next()
}

export const parseJson = async <T>(c: { req: { json: () => Promise<T> } }) => {
  try {
    return await c.req.json()
  } catch {
    return null
  }
}

export { store }
export type { Role }



