import type { Hono } from 'hono'
import type { AppEnv, Role } from '../lib/types'
import { updateTestPublished } from '../lib/tests'
import {
  commit,
  createPasswordHash,
  getUserById,
  nowIso,
  parseJson,
  requireAdmin,
  requireAuth,
  setTests,
  store,
  toApiUser,
  toTestSummary,
} from '../lib/store'

export const registerAdminRoutes = (api: Hono<AppEnv>) => {
  api.get('/admin/users', requireAuth, requireAdmin, (c) => {
    const users = store.users.map(toApiUser)
    return c.json({ users })
  })

  api.post('/admin/users', requireAuth, requireAdmin, async (c) => {
    const body = await parseJson<{
      username?: string
      email?: string
      password?: string
      role?: Role
    }>(c)
    if (!body?.username || !body.password || !body.role) {
      return c.json({ error: 'username, password, and role are required.' }, 400)
    }
    if (body.role !== 'admin' && body.role !== 'student') {
      return c.json({ error: 'Invalid role.' }, 400)
    }

    const exists = store.users.some(
      (user) =>
        user.username.toLowerCase() === body.username!.toLowerCase() ||
        (body.email && user.email?.toLowerCase() === body.email.toLowerCase())
    )
    if (exists) {
      return c.json({ error: 'User already exists.' }, 400)
    }

    const passwordHash = await createPasswordHash(body.password)
    const user = {
      id: crypto.randomUUID(),
      username: body.username,
      email: body.email ?? null,
      role: body.role,
      passwordHash,
    }
    store.users.push(user)
    commit()

    return c.json({ user: toApiUser(user) })
  })

  api.get('/admin/tests', requireAuth, requireAdmin, (c) => {
    const tests = store.tests.map((test) => toTestSummary(test, null, true))
    return c.json({ tests })
  })

  api.patch('/admin/tests/:testId/published', requireAuth, requireAdmin, async (c) => {
    const testId = c.req.param('testId')
    const body = await parseJson<{ published?: boolean }>(c)
    if (typeof body?.published !== 'boolean') {
      return c.json({ error: 'published flag is required.' }, 400)
    }

    const updated = updateTestPublished(testId, body.published)
    if (!updated) {
      return c.json({ error: 'Test not found.' }, 404)
    }

    setTests(updated)
    return c.json({ ok: true })
  })

  api.get('/admin/assignments', requireAuth, requireAdmin, (c) => {
    const type = c.req.query('type') as 'task' | 'homework' | undefined
    if (type && type !== 'task' && type !== 'homework') {
      return c.json({ error: 'Invalid assignment type.' }, 400)
    }
    const assignments = store.assignments
      .filter((assignment) => !type || assignment.type === type)
      .map((assignment) => {
        const assignedTo = getUserById(assignment.assignedTo)
        const assignedBy = getUserById(assignment.assignedBy)
        return {
          id: assignment.id,
          type: assignment.type,
          testId: assignment.testId,
          sectionKinds: assignment.sectionKinds,
          assignedTo: assignment.assignedTo,
          assignedToName: assignedTo?.username ?? 'Unknown',
          assignedBy: assignment.assignedBy,
          assignedByName: assignedBy?.username ?? 'Unknown',
          dueAt: assignment.dueAt,
          createdAt: assignment.createdAt,
        }
      })

    return c.json({ assignments })
  })

  api.post('/admin/assignments', requireAuth, requireAdmin, async (c) => {
    const user = c.get('user')
    const body = await parseJson<{
      type?: 'task' | 'homework'
      testId?: string
      sectionKinds?: Array<'listening' | 'reading'>
      assignedTo?: string
      dueAt?: string | null
    }>(c)
    if (!body?.type || !body.testId || !body.assignedTo) {
      return c.json({ error: 'type, testId, and assignedTo are required.' }, 400)
    }
    if (body.type !== 'task' && body.type !== 'homework') {
      return c.json({ error: 'Invalid assignment type.' }, 400)
    }

    const test = store.tests.find((candidate) => candidate.id === body.testId)
    if (!test) {
      return c.json({ error: 'Test not found.' }, 404)
    }
    const assignedToUser = getUserById(body.assignedTo)
    if (!assignedToUser) {
      return c.json({ error: 'Assigned user not found.' }, 404)
    }

    const sectionKinds =
      body.sectionKinds && body.sectionKinds.length > 0
        ? body.sectionKinds
        : Array.from(new Set(test.sections.map((section) => section.kind)))

    const assignment = {
      id: crypto.randomUUID(),
      type: body.type,
      testId: body.testId,
      sectionKinds,
      assignedTo: body.assignedTo,
      assignedBy: user.id,
      dueAt: body.dueAt ?? null,
      createdAt: nowIso(),
    }
    store.assignments.push(assignment)
    commit()

    return c.json({ assignment: { id: assignment.id } })
  })

  api.get('/admin/groups', requireAuth, requireAdmin, (c) => {
    const groups = store.groups.map((group) => ({
      id: group.id,
      name: group.name,
      createdAt: group.createdAt,
      members: group.members
        .map((memberId) => getUserById(memberId))
        .filter((member): member is NonNullable<typeof member> => Boolean(member))
        .map((member) => ({
          id: member.id,
          username: member.username,
          email: member.email,
        })),
    }))

    return c.json({ groups })
  })

  api.post('/admin/groups', requireAuth, requireAdmin, async (c) => {
    const body = await parseJson<{ name?: string }>(c)
    if (!body?.name) {
      return c.json({ error: 'Group name is required.' }, 400)
    }

    const group = {
      id: crypto.randomUUID(),
      name: body.name,
      createdAt: nowIso(),
      members: [] as string[],
    }
    store.groups.push(group)
    commit()

    return c.json({ group: { id: group.id, name: group.name } })
  })

  api.delete('/admin/groups/:groupId', requireAuth, requireAdmin, (c) => {
    const groupId = c.req.param('groupId')
    const index = store.groups.findIndex((group) => group.id === groupId)
    if (index === -1) {
      return c.json({ error: 'Group not found.' }, 404)
    }
    store.groups.splice(index, 1)
    commit()
    return c.json({ ok: true })
  })

  api.post('/admin/groups/:groupId/members', requireAuth, requireAdmin, async (c) => {
    const groupId = c.req.param('groupId')
    const group = store.groups.find((candidate) => candidate.id === groupId)
    if (!group) {
      return c.json({ error: 'Group not found.' }, 404)
    }

    const body = await parseJson<{ userId?: string }>(c)
    if (!body?.userId) {
      return c.json({ error: 'userId is required.' }, 400)
    }

    const member = getUserById(body.userId)
    if (!member) {
      return c.json({ error: 'User not found.' }, 404)
    }

    if (!group.members.includes(body.userId)) {
      group.members.push(body.userId)
      commit()
    }

    return c.json({ ok: true })
  })

  api.delete('/admin/groups/:groupId/members/:userId', requireAuth, requireAdmin, (c) => {
    const groupId = c.req.param('groupId')
    const userId = c.req.param('userId')
    const group = store.groups.find((candidate) => candidate.id === groupId)
    if (!group) {
      return c.json({ error: 'Group not found.' }, 404)
    }

    group.members = group.members.filter((memberId) => memberId !== userId)
    commit()
    return c.json({ ok: true })
  })

  api.post('/admin/groups/:groupId/assign', requireAuth, requireAdmin, async (c) => {
    const user = c.get('user')
    const groupId = c.req.param('groupId')
    const group = store.groups.find((candidate) => candidate.id === groupId)
    if (!group) {
      return c.json({ error: 'Group not found.' }, 404)
    }

    const body = await parseJson<{
      type?: 'task' | 'homework'
      testId?: string
      sectionKinds?: Array<'listening' | 'reading'>
      dueAt?: string | null
    }>(c)
    if (!body?.type || !body.testId) {
      return c.json({ error: 'type and testId are required.' }, 400)
    }
    if (body.type !== 'task' && body.type !== 'homework') {
      return c.json({ error: 'Invalid assignment type.' }, 400)
    }

    const test = store.tests.find((candidate) => candidate.id === body.testId)
    if (!test) {
      return c.json({ error: 'Test not found.' }, 404)
    }

    const sectionKinds =
      body.sectionKinds && body.sectionKinds.length > 0
        ? body.sectionKinds
        : Array.from(new Set(test.sections.map((section) => section.kind)))

    let count = 0
    for (const memberId of group.members) {
      const assignment = {
        id: crypto.randomUUID(),
        type: body.type,
        testId: body.testId,
        sectionKinds,
        assignedTo: memberId,
        assignedBy: user.id,
        dueAt: body.dueAt ?? null,
        createdAt: nowIso(),
      }
      store.assignments.push(assignment)
      count += 1
    }
    if (count > 0) {
      commit()
    }

    return c.json({ count })
  })

  api.get('/admin/users/:userId/stats', requireAuth, requireAdmin, (c) => {
    const userId = c.req.param('userId')
    const userAttempts = store.attempts.filter((attempt) => attempt.userId === userId)
    const completedAttempts = userAttempts.filter((attempt) => attempt.status === 'completed')
    const testsCompleted = completedAttempts.length
    const testsTotal = store.assignments.filter((assignment) => assignment.assignedTo === userId).length

    const average = (values: Array<number | null>) => {
      const filtered = values.filter((value): value is number => typeof value === 'number')
      if (filtered.length === 0) return null
      const total = filtered.reduce((sum, value) => sum + value, 0)
      return Math.round((total / filtered.length) * 10) / 10
    }

    const stats = {
      testsCompleted,
      testsTotal,
      avgBand: average(completedAttempts.map((attempt) => attempt.band)),
      avgReadingBand: average(completedAttempts.map((attempt) => attempt.readingBand)),
      avgListeningBand: average(completedAttempts.map((attempt) => attempt.listeningBand)),
      recentAttempts: completedAttempts
        .slice()
        .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
        .slice(0, 5)
        .map((attempt) => ({
          testId: attempt.testId,
          band: attempt.band,
          readingBand: attempt.readingBand,
          listeningBand: attempt.listeningBand,
          completedAt: attempt.completedAt,
        })),
    }

    return c.json({ stats })
  })
}
