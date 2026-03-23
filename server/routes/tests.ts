import type { Hono } from 'hono'
import type { AppEnv } from '../lib/types'
import { getLatestAttemptForTest, requireAuth, store, toTestSummary } from '../lib/store'
import { getTests } from '../lib/tests'

export const registerTestRoutes = (api: Hono<AppEnv>) => {
  api.get('/tests', requireAuth, (c) => {
    const user = c.get('user')
    const isAdmin = user.role === 'admin'
    const tests = getTests()
      .filter((test) => isAdmin || test.published)
      .map((test) => toTestSummary(test, getLatestAttemptForTest(user.id, test.id), isAdmin))
    return c.json({ tests })
  })

  api.get('/tests/:testId', requireAuth, (c) => {
    const user = c.get('user')
    const testId = c.req.param('testId')
    const test = getTests().find((candidate) => candidate.id === testId)
    if (!test) {
      return c.json({ error: 'Test not found.' }, 404)
    }

    const hasAssignment = store.assignments.some(
      (assignment) => assignment.testId === testId && assignment.assignedTo === user.id
    )
    const hasAttempt = store.attempts.some((attempt) => attempt.testId === testId && attempt.userId === user.id)
    const isAdmin = user.role === 'admin'

    if (!isAdmin && !test.published && !hasAssignment && !hasAttempt) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    return c.json({ test })
  })
}
