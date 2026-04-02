import type { Hono } from 'hono'
import type { AppEnv } from '../lib/types'
import { getTestById } from '../lib/tests'
import {
  commit,
  filterTestForAssignment,
  getAssignmentAttempt,
  nowIso,
  parseJson,
  requireAuth,
  scoreAttempt,
  store,
  getAssignmentDurationMinutes,
  toAssignmentSummary,
} from '../lib/store'

export const registerAssignmentRoutes = (api: Hono<AppEnv>) => {
  api.get('/assignments', requireAuth, (c) => {
    const user = c.get('user')
    const type = c.req.query('type') as 'task' | 'homework' | undefined
    if (type && type !== 'task' && type !== 'homework') {
      return c.json({ error: 'Invalid assignment type.' }, 400)
    }

    const assignments = store.assignments
      .filter((assignment) => assignment.assignedTo === user.id)
      .filter((assignment) => !type || assignment.type === type)
      .map((assignment) => {
        const test = getTestById(assignment.testId)
        if (!test) return null
        const attempt = getAssignmentAttempt(assignment.id, user.id)
        return toAssignmentSummary(assignment, test, attempt)
      })
      .filter((assignment): assignment is NonNullable<typeof assignment> => Boolean(assignment))

    return c.json({ assignments })
  })

  api.post('/assignments/:assignmentId/start', requireAuth, (c) => {
    const user = c.get('user')
    const assignmentId = c.req.param('assignmentId')
    const assignment = store.assignments.find((candidate) => candidate.id === assignmentId)
    if (!assignment || assignment.assignedTo !== user.id) {
      return c.json({ error: 'Assignment not found.' }, 404)
    }

    const existing = store.attempts.find(
      (attempt) => attempt.assignmentId === assignmentId && attempt.userId === user.id && attempt.status === 'in-progress'
    )
    if (existing) {
      return c.json({ attempt: { id: existing.id, status: existing.status } })
    }

    const attempt = {
      id: crypto.randomUUID(),
      assignmentId,
      testId: assignment.testId,
      userId: user.id,
      status: 'in-progress' as const,
      scoreTotal: null,
      band: null,
      readingBand: null,
      listeningBand: null,
      startedAt: nowIso(),
      completedAt: null,
      responses: {},
    }
    store.attempts.push(attempt)
    commit()

    return c.json({ attempt: { id: attempt.id, status: attempt.status } })
  })

  api.get('/assignments/attempts/:attemptId', requireAuth, (c) => {
    const user = c.get('user')
    const attemptId = c.req.param('attemptId')
    const attempt = store.attempts.find((candidate) => candidate.id === attemptId)
    if (!attempt) {
      return c.json({ error: 'Attempt not found.' }, 404)
    }
    if (user.role !== 'admin' && attempt.userId !== user.id) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    const assignment = store.assignments.find((candidate) => candidate.id === attempt.assignmentId)
    const test = getTestById(attempt.testId)
    if (!assignment || !test) {
      return c.json({ error: 'Attempt data is missing.' }, 404)
    }

    const filteredTest = filterTestForAssignment(test, assignment.sectionKinds)

    let correctness: Record<string, boolean> | undefined
    if (attempt.status === 'completed') {
      correctness = {}
      for (const section of filteredTest.sections) {
        for (const question of section.questions) {
          if (question.correctAnswer == null) continue
          const correct = question.correctAnswer
          const response = attempt.responses[question.id]
          let normalized: unknown = response
          if (typeof response === 'string' && response.startsWith('[') && response.endsWith(']')) {
            try { normalized = JSON.parse(response) } catch { /* ignore */ }
          }
          let isCorrect = false
          if (Array.isArray(correct)) {
            if (Array.isArray(normalized) && normalized.length >= correct.length) {
              isCorrect = correct.every((v, i) => {
                const a = (normalized as unknown[])[i]
                return typeof a === 'string' ? a.trim().toLowerCase() === v.trim().toLowerCase() : a === v
              })
            }
          } else if (typeof correct === 'string') {
            if (Array.isArray(normalized)) {
              isCorrect = normalized.length === 1 && String(normalized[0]).trim().toLowerCase() === correct.trim().toLowerCase()
            } else if (typeof normalized === 'string') {
              isCorrect = normalized.trim().toLowerCase() === correct.trim().toLowerCase()
            }
          }
          correctness[question.id] = isCorrect
        }
      }
    }

    return c.json({
      assignment: {
        id: assignment.id,
        type: assignment.type,
        testId: assignment.testId,
        title: test.title,
        durationMinutes: getAssignmentDurationMinutes(test, assignment.sectionKinds),
        sectionKinds: assignment.sectionKinds,
      },
      attempt: {
        id: attempt.id,
        status: attempt.status,
        scoreTotal: attempt.scoreTotal,
        band: attempt.band,
        readingBand: attempt.readingBand,
        listeningBand: attempt.listeningBand,
        startedAt: attempt.startedAt,
        completedAt: attempt.completedAt,
      },
      test: filteredTest,
      responses: attempt.responses,
      correctness,
    })
  })

  api.post('/assignments/attempts/:attemptId/answers', requireAuth, async (c) => {
    const user = c.get('user')
    const attemptId = c.req.param('attemptId')
    const attempt = store.attempts.find((candidate) => candidate.id === attemptId)
    if (!attempt) {
      return c.json({ error: 'Attempt not found.' }, 404)
    }
    if (attempt.userId !== user.id && user.role !== 'admin') {
      return c.json({ error: 'Forbidden' }, 403)
    }
    if (attempt.status !== 'in-progress') {
      return c.json({ error: 'Attempt already completed.' }, 400)
    }

    const body = await parseJson<{ questionId?: string; response?: unknown }>(c)
    if (!body?.questionId) {
      return c.json({ error: 'questionId is required.' }, 400)
    }

    attempt.responses[body.questionId] = body.response
    commit()
    return c.json({ ok: true })
  })

  api.post('/assignments/attempts/:attemptId/submit', requireAuth, (c) => {
    const user = c.get('user')
    const attemptId = c.req.param('attemptId')
    const attempt = store.attempts.find((candidate) => candidate.id === attemptId)
    if (!attempt) {
      return c.json({ error: 'Attempt not found.' }, 404)
    }
    if (attempt.userId !== user.id && user.role !== 'admin') {
      return c.json({ error: 'Forbidden' }, 403)
    }

    if (attempt.status === 'completed') {
      return c.json({
        attempt: {
          id: attempt.id,
          status: attempt.status,
          scoreTotal: attempt.scoreTotal ?? 0,
          band: attempt.band,
        },
      })
    }

    const test = getTestById(attempt.testId)
    if (!test) {
      return c.json({ error: 'Test not found.' }, 404)
    }

    const scored = scoreAttempt(attempt, test)
    attempt.status = 'completed'
    attempt.scoreTotal = scored.scoreTotal
    attempt.band = scored.band
    attempt.readingBand = scored.readingBand
    attempt.listeningBand = scored.listeningBand
    attempt.completedAt = nowIso()
    commit()

    return c.json({
      attempt: {
        id: attempt.id,
        status: attempt.status,
        scoreTotal: attempt.scoreTotal,
        band: attempt.band,
      },
    })
  })

  api.post('/assignments/tests/:testId/start', requireAuth, (c) => {
    const user = c.get('user')
    const testId = c.req.param('testId')
    const test = getTestById(testId)
    if (!test) {
      return c.json({ error: 'Test not found.' }, 404)
    }

    const existingAttempt = store.attempts.find(
      (a) => a.userId === user.id && a.testId === testId && a.status === 'in-progress'
    )
    if (existingAttempt) {
      return c.json({ 
        attempt: { id: existingAttempt.id, status: existingAttempt.status }, 
        assignmentId: existingAttempt.assignmentId 
      })
    }

    const assignment = {
      id: crypto.randomUUID(),
      type: 'task' as const,
      testId: test.id,
      sectionKinds: Array.from(new Set(test.sections.map((section) => section.kind))),
      assignedTo: user.id,
      assignedBy: user.id,
      dueAt: null,
      createdAt: nowIso(),
    }
    store.assignments.push(assignment)

    const attempt = {
      id: crypto.randomUUID(),
      assignmentId: assignment.id,
      testId: test.id,
      userId: user.id,
      status: 'in-progress' as const,
      scoreTotal: null,
      band: null,
      readingBand: null,
      listeningBand: null,
      startedAt: nowIso(),
      completedAt: null,
      responses: {},
    }
    store.attempts.push(attempt)
    commit()

    return c.json({ attempt: { id: attempt.id, status: attempt.status }, assignmentId: assignment.id })
  })
}
