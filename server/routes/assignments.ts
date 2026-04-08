import type { Hono } from 'hono'
import type { AppEnv } from '../lib/types'
import { AnswerBodySchema, SubmitAttemptBodySchema } from '../lib/schemas'
import { zParse, computeCorrectness, filterTestForAssignment, getAssignmentDurationMinutes, nowIso, jsonParse, requireAuth, scoreAttempt } from '../lib/store'
import { getTestById, getDbTests } from '../lib/tests'

type AttemptRow = { id: string; assignment_id: string; test_id: string; user_id: string; status: string; score_total: number | null; band: number | null; reading_band: number | null; listening_band: number | null; started_at: string; completed_at: string | null; responses_json: string }
type AssignmentRow = { id: string; type: string; test_id: string; section_kinds_json: string; assigned_to: string; assigned_by: string; due_at: string | null; created_at: string }

const toAttemptSummary = (a: AttemptRow) => ({
  id: a.id, status: a.status, scoreTotal: a.score_total, band: a.band,
  readingBand: a.reading_band, listeningBand: a.listening_band,
  startedAt: a.started_at, completedAt: a.completed_at,
})

export const registerAssignmentRoutes = (api: Hono<AppEnv>) => {
  api.get('/assignments', requireAuth, async (c) => {
    const user = c.get('user')
    const type = c.req.query('type') as 'task' | 'homework' | undefined
    if (type && type !== 'task' && type !== 'homework') return c.json({ error: 'Invalid assignment type.' }, 400)

    const query = type
      ? 'SELECT * FROM assignments WHERE assigned_to = ? AND type = ? ORDER BY created_at DESC'
      : 'SELECT * FROM assignments WHERE assigned_to = ? ORDER BY created_at DESC'
    const rows = type
      ? await c.env.DB.prepare(query).bind(user.id, type).all<AssignmentRow>()
      : await c.env.DB.prepare(query).bind(user.id).all<AssignmentRow>()

    const assignments = await Promise.all((rows.results ?? []).map(async (row) => {
      const test = await getTestById(c.env.DB, row.test_id)
      if (!test) return null
      const sectionKinds = jsonParse<Array<'listening' | 'reading'>>(row.section_kinds_json, [])
      const attempt = await c.env.DB.prepare(
        'SELECT * FROM attempts WHERE assignment_id = ? AND user_id = ? ORDER BY started_at DESC LIMIT 1'
      ).bind(row.id, user.id).first<AttemptRow>()
      return {
        id: row.id, type: row.type, testId: row.test_id, title: test.title,
        durationMinutes: getAssignmentDurationMinutes(test, sectionKinds),
        dueAt: row.due_at, sectionKinds,
        attempt: attempt ? toAttemptSummary(attempt) : null,
      }
    }))
    return c.json({ assignments: assignments.filter(Boolean) })
  })

  api.post('/assignments/:assignmentId/attempts', requireAuth, async (c) => {
    const user = c.get('user')
    const assignmentId = c.req.param('assignmentId')
    const assignment = await c.env.DB.prepare('SELECT * FROM assignments WHERE id = ? AND assigned_to = ?')
      .bind(assignmentId, user.id).first<AssignmentRow>()
    if (!assignment) return c.json({ error: 'Assignment not found.' }, 404)

    const existing = await c.env.DB.prepare(
      "SELECT id, status FROM attempts WHERE assignment_id = ? AND user_id = ? AND status = 'in-progress' LIMIT 1"
    ).bind(assignmentId, user.id).first<{ id: string; status: string }>()
    if (existing) return c.json({ attempt: { id: existing.id, status: existing.status } }, 200)

    const id = crypto.randomUUID()
    await c.env.DB.prepare(
      'INSERT INTO attempts (id, assignment_id, test_id, user_id, status, score_total, band, reading_band, listening_band, started_at, completed_at, responses_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, assignmentId, assignment.test_id, user.id, 'in-progress', null, null, null, null, nowIso(), null, '{}').run()
    return c.json({ attempt: { id, status: 'in-progress' } }, 201)
  })

  api.get('/assignments/attempts/:attemptId', requireAuth, async (c) => {
    const user = c.get('user')
    const attempt = await c.env.DB.prepare('SELECT * FROM attempts WHERE id = ?')
      .bind(c.req.param('attemptId')).first<AttemptRow>()
    if (!attempt) return c.json({ error: 'Attempt not found.' }, 404)
    if (user.role !== 'admin' && attempt.user_id !== user.id) return c.json({ error: 'Forbidden' }, 403)

    const assignment = await c.env.DB.prepare('SELECT * FROM assignments WHERE id = ?')
      .bind(attempt.assignment_id).first<AssignmentRow>()
    const dbTests = await getDbTests(c.env.DB)
    const test = dbTests.find((t) => t.id === attempt.test_id) ?? null
    if (!assignment || !test) return c.json({ error: 'Attempt data is missing.' }, 404)

    const sectionKinds = jsonParse<Array<'listening' | 'reading'>>(assignment.section_kinds_json, [])
    const filteredTest = filterTestForAssignment(test, sectionKinds)
    const responses = jsonParse<Record<string, unknown>>(attempt.responses_json, {})
    const correctness = attempt.status === 'completed' ? computeCorrectness(responses, filteredTest) : undefined

    return c.json({
      assignment: {
        id: assignment.id, type: assignment.type, testId: assignment.test_id, title: test.title,
        durationMinutes: getAssignmentDurationMinutes(test, sectionKinds), sectionKinds,
      },
      attempt: toAttemptSummary(attempt),
      test: filteredTest,
      responses,
      correctness,
    })
  })

  api.put('/assignments/attempts/:attemptId/answers', requireAuth, async (c) => {
    const user = c.get('user')
    const attempt = await c.env.DB.prepare('SELECT * FROM attempts WHERE id = ?')
      .bind(c.req.param('attemptId')).first<AttemptRow>()
    if (!attempt) return c.json({ error: 'Attempt not found.' }, 404)
    if (attempt.user_id !== user.id && user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403)
    if (attempt.status !== 'in-progress') return c.json({ error: 'Attempt already completed.' }, 400)

    const { data, error } = await zParse(AnswerBodySchema, c)
    if (error) return error

    const responses = jsonParse<Record<string, unknown>>(attempt.responses_json, {})
    responses[data.questionId] = data.response
    await c.env.DB.prepare('UPDATE attempts SET responses_json = ? WHERE id = ?')
      .bind(JSON.stringify(responses), attempt.id).run()
    return c.json({ ok: true }, 200)
  })

  api.patch('/assignments/attempts/:attemptId', requireAuth, async (c) => {
    const user = c.get('user')
    const attempt = await c.env.DB.prepare('SELECT * FROM attempts WHERE id = ?')
      .bind(c.req.param('attemptId')).first<AttemptRow>()
    if (!attempt) return c.json({ error: 'Attempt not found.' }, 404)
    if (attempt.user_id !== user.id && user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403)

    const { error } = await zParse(SubmitAttemptBodySchema, c)
    if (error) return error

    if (attempt.status === 'completed') {
      return c.json({ attempt: { id: attempt.id, status: attempt.status, scoreTotal: attempt.score_total ?? 0, band: attempt.band } }, 200)
    }

    const test = await getTestById(c.env.DB, attempt.test_id)
    if (!test) return c.json({ error: 'Test not found.' }, 404)

    const responses = jsonParse<Record<string, unknown>>(attempt.responses_json, {})
    const scored = scoreAttempt(responses, test)
    await c.env.DB.prepare(
      'UPDATE attempts SET status = ?, score_total = ?, band = ?, reading_band = ?, listening_band = ?, completed_at = ? WHERE id = ?'
    ).bind('completed', scored.scoreTotal, scored.band, scored.readingBand, scored.listeningBand, nowIso(), attempt.id).run()

    return c.json({ attempt: { id: attempt.id, status: 'completed', scoreTotal: scored.scoreTotal, band: scored.band } }, 200)
  })

  api.post('/assignments/tests/:testId/attempts', requireAuth, async (c) => {
    const user = c.get('user')
    const test = await getTestById(c.env.DB, c.req.param('testId'))
    if (!test) return c.json({ error: 'Test not found.' }, 404)

    const existing = await c.env.DB.prepare(
      "SELECT id, status, assignment_id FROM attempts WHERE user_id = ? AND test_id = ? AND status = 'in-progress' LIMIT 1"
    ).bind(user.id, test.id).first<{ id: string; status: string; assignment_id: string }>()
    if (existing) return c.json({ attempt: { id: existing.id, status: existing.status }, assignmentId: existing.assignment_id }, 200)

    const assignmentId = crypto.randomUUID()
    const sectionKinds = Array.from(new Set(test.sections.map((s) => s.kind)))
    await c.env.DB.prepare(
      'INSERT INTO assignments (id, type, test_id, section_kinds_json, assigned_to, assigned_by, due_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(assignmentId, 'task', test.id, JSON.stringify(sectionKinds), user.id, user.id, null, nowIso()).run()

    const attemptId = crypto.randomUUID()
    await c.env.DB.prepare(
      'INSERT INTO attempts (id, assignment_id, test_id, user_id, status, score_total, band, reading_band, listening_band, started_at, completed_at, responses_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(attemptId, assignmentId, test.id, user.id, 'in-progress', null, null, null, null, nowIso(), null, '{}').run()

    return c.json({ attempt: { id: attemptId, status: 'in-progress' }, assignmentId }, 201)
  })
}
