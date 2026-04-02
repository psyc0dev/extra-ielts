import type { Hono } from 'hono'
import type { AppEnv } from '../lib/types'
import { requireAuth } from '../lib/store'
import { getTestById, getTests } from '../lib/tests'

const getPublishedOverrides = async (db: D1Database): Promise<Map<string, boolean>> => {
  const rows = await db.prepare('SELECT id, published FROM tests').all<{ id: string; published: number }>()
  return new Map((rows.results ?? []).map((r) => [r.id, r.published === 1]))
}

const getLatestAttempt = async (db: D1Database, userId: string, testId: string) => {
  return db.prepare(
    'SELECT id, status, score_total, band, reading_band, listening_band, started_at, completed_at FROM attempts WHERE user_id = ? AND test_id = ? ORDER BY started_at DESC LIMIT 1'
  ).bind(userId, testId).first<{ id: string; status: string; score_total: number | null; band: number | null; reading_band: number | null; listening_band: number | null; started_at: string; completed_at: string | null }>()
}

export const registerTestRoutes = (api: Hono<AppEnv>) => {
  api.get('/tests', requireAuth, async (c) => {
    const user = c.get('user')
    const isAdmin = user.role === 'admin'
    const overrides = await getPublishedOverrides(c.env.DB)
    const tests = await Promise.all(
      getTests(overrides)
        .filter((t) => isAdmin || t.published)
        .map(async (t) => {
          const attempt = await getLatestAttempt(c.env.DB, user.id, t.id)
          return {
            id: t.id, title: t.title, durationMinutes: t.durationMinutes,
            sectionsCount: t.sections.length,
            questionsCount: t.sections.reduce((n, s) => n + s.questions.length, 0),
            ...(isAdmin ? { published: t.published ?? false } : {}),
            attempt: attempt ? {
              id: attempt.id, status: attempt.status, scoreTotal: attempt.score_total,
              band: attempt.band, readingBand: attempt.reading_band, listeningBand: attempt.listening_band,
              startedAt: attempt.started_at, completedAt: attempt.completed_at,
            } : null,
          }
        })
    )
    return c.json({ tests })
  })

  api.get('/tests/:testId', requireAuth, async (c) => {
    const user = c.get('user')
    const overrides = await getPublishedOverrides(c.env.DB)
    const test = getTestById(c.req.param('testId'), overrides)
    if (!test) return c.json({ error: 'Test not found.' }, 404)

    const isAdmin = user.role === 'admin'
    if (!isAdmin && !test.published) {
      const hasAssignment = await c.env.DB.prepare(
        'SELECT 1 FROM assignments WHERE test_id = ? AND assigned_to = ? LIMIT 1'
      ).bind(test.id, user.id).first()
      const hasAttempt = await c.env.DB.prepare(
        'SELECT 1 FROM attempts WHERE test_id = ? AND user_id = ? LIMIT 1'
      ).bind(test.id, user.id).first()
      if (!hasAssignment && !hasAttempt) return c.json({ error: 'Forbidden' }, 403)
    }
    return c.json({ test })
  })
}
