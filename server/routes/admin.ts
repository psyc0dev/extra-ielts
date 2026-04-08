import type { Hono } from 'hono'
import type { AppEnv, Role } from '../lib/types'
import { CreateUserBodySchema, TestPublishedBodySchema, CreateAssignmentBodySchema, GroupAssignmentBodySchema, GroupNameBodySchema, GroupMemberBodySchema } from '../lib/schemas'
import { createPasswordHash, nowIso, zParse, jsonParse, requireAdmin, requireAuth, toApiUser } from '../lib/store'
import { getTestById, getDbTests } from '../lib/tests'

type UserRow = { id: string; username: string; email: string | null; role: string; password_hash: string; avatar_url: string | null }
type AssignmentRow = { id: string; type: string; test_id: string; section_kinds_json: string; assigned_to: string; assigned_by: string; due_at: string | null; created_at: string }
type AttemptRow = { id: string; assignment_id: string; test_id: string; user_id: string; status: string; score_total: number | null; band: number | null; reading_band: number | null; listening_band: number | null; started_at: string; completed_at: string | null }

export const registerAdminRoutes = (api: Hono<AppEnv>) => {
  api.get('/admin/users', requireAuth, requireAdmin, async (c) => {
    const rows = await c.env.DB.prepare('SELECT id, username, email, role, password_hash, avatar_url FROM users ORDER BY created_at').all<UserRow>()
    return c.json({ users: (rows.results ?? []).map((r) => toApiUser({ id: r.id, username: r.username, email: r.email, role: r.role as Role, passwordHash: r.password_hash, avatarUrl: r.avatar_url })) })
  })

  api.post('/admin/users', requireAuth, requireAdmin, async (c) => {
    const { data, error } = await zParse(CreateUserBodySchema, c)
    if (error) return error

    const exists = await c.env.DB.prepare('SELECT 1 FROM users WHERE LOWER(username) = ? OR (email IS NOT NULL AND LOWER(email) = ?) LIMIT 1')
      .bind(data.username.toLowerCase(), (data.email ?? '').toLowerCase()).first()
    if (exists) return c.json({ error: 'User already exists.' }, 400)

    const id = crypto.randomUUID()
    const passwordHash = await createPasswordHash(data.password)
    await c.env.DB.prepare('INSERT INTO users (id, username, email, role, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(id, data.username, data.email ?? null, data.role, passwordHash, nowIso()).run()
    return c.json({ user: { id, username: data.username, email: data.email ?? null, role: data.role, avatarUrl: null } }, 201)
  })

  api.get('/admin/tests', requireAuth, requireAdmin, async (c) => {
    const tests = await getDbTests(c.env.DB)
    return c.json({ tests: tests.map((t) => ({
      id: t.id, title: t.title, durationMinutes: t.durationMinutes, published: t.published ?? false,
      sectionsCount: t.sections.length,
      questionsCount: t.sections.reduce((n, s) => n + s.questions.length, 0),
      attempt: null,
    })) })
  })

  api.get('/admin/tests/:testId', requireAuth, requireAdmin, async (c) => {
    const test = await getTestById(c.env.DB, c.req.param('testId'))
    if (!test) return c.json({ error: 'Test not found.' }, 404)
    return c.json({ test })
  })

  api.get('/admin/tests/:testId/download', requireAuth, requireAdmin, async (c) => {
    const test = await getTestById(c.env.DB, c.req.param('testId'))
    if (!test) return c.json({ error: 'Test not found.' }, 404)
    const safeTitle = (test.title ?? test.id).replace(/[^a-z0-9]+/gi, '-').toLowerCase()
    const filename = (safeTitle ? safeTitle : test.id) + '.json'
    return c.body(JSON.stringify(test, null, 2), 200, {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    })
  })

  api.post('/admin/tests', requireAuth, requireAdmin, async (c) => {
    const body = await c.req.json<{ title: string; durationMinutes: number; sections: unknown[] }>()
    if (!body.title?.trim()) return c.json({ error: 'Title is required.' }, 400)
    const id = crypto.randomUUID()
    const testData = { id, title: body.title, durationMinutes: body.durationMinutes ?? 120, sections: body.sections ?? [] }
    await c.env.DB.prepare('INSERT INTO tests (id, published, data_json) VALUES (?, 0, ?)')
      .bind(id, JSON.stringify(testData)).run()
    return c.json({ test: { id } }, 201)
  })

  api.put('/admin/tests/:testId', requireAuth, requireAdmin, async (c) => {
    const testId = c.req.param('testId')
    const existing = await getTestById(c.env.DB, testId)
    if (!existing) return c.json({ error: 'Test not found.' }, 404)
    const body = await c.req.json<{ title?: string; durationMinutes?: number; sections?: unknown[]; published?: boolean }>()
    const updated = {
      ...existing,
      title: body.title ?? existing.title,
      durationMinutes: body.durationMinutes ?? existing.durationMinutes,
      sections: body.sections ?? existing.sections,
    }
    const published = body.published !== undefined ? (body.published ? 1 : 0) : (existing.published ? 1 : 0)
    await c.env.DB.prepare('UPDATE tests SET published = ?, data_json = ? WHERE id = ?')
      .bind(published, JSON.stringify(updated), testId).run()
    return c.json({ ok: true }, 200)
  })

  api.patch('/admin/tests/:testId', requireAuth, requireAdmin, async (c) => {
    const { data, error } = await zParse(TestPublishedBodySchema, c)
    if (error) return error
    const testId = c.req.param('testId')
    if (!await getTestById(c.env.DB, testId)) return c.json({ error: 'Test not found.' }, 404)
    await c.env.DB.prepare('UPDATE tests SET published = ? WHERE id = ?')
      .bind(data.published ? 1 : 0, testId).run()
    return c.json({ ok: true }, 200)
  })

  api.get('/admin/assignments', requireAuth, requireAdmin, async (c) => {
    const type = c.req.query('type') as 'task' | 'homework' | undefined
    if (type && type !== 'task' && type !== 'homework') return c.json({ error: 'Invalid assignment type.' }, 400)
    const rows = type
      ? await c.env.DB.prepare('SELECT * FROM assignments WHERE type = ? ORDER BY created_at DESC').bind(type).all<AssignmentRow>()
      : await c.env.DB.prepare('SELECT * FROM assignments ORDER BY created_at DESC').all<AssignmentRow>()

    const userIds = [...new Set((rows.results ?? []).flatMap((r) => [r.assigned_to, r.assigned_by]))]
    const userMap = new Map<string, string>()
    await Promise.all(userIds.map(async (uid) => {
      const u = await c.env.DB.prepare('SELECT id, username FROM users WHERE id = ?').bind(uid).first<{ id: string; username: string }>()
      if (u) userMap.set(u.id, u.username)
    }))

    return c.json({
      assignments: (rows.results ?? []).map((r) => ({
        id: r.id, type: r.type, testId: r.test_id,
        sectionKinds: jsonParse<string[]>(r.section_kinds_json, []),
        assignedTo: r.assigned_to, assignedToName: userMap.get(r.assigned_to) ?? 'Unknown',
        assignedBy: r.assigned_by, assignedByName: userMap.get(r.assigned_by) ?? 'Unknown',
        dueAt: r.due_at, createdAt: r.created_at,
      }))
    })
  })

  api.post('/admin/assignments', requireAuth, requireAdmin, async (c) => {
    const user = c.get('user')
    const { data, error } = await zParse(CreateAssignmentBodySchema, c)
    if (error) return error
    const test = await getTestById(c.env.DB, data.testId)
    if (!test) return c.json({ error: 'Test not found.' }, 404)
    const assignedUser = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(data.assignedTo).first()
    if (!assignedUser) return c.json({ error: 'Assigned user not found.' }, 404)

    const sectionKinds = data.sectionKinds?.length ? data.sectionKinds : Array.from(new Set(test.sections.map((s) => s.kind)))
    const id = crypto.randomUUID()
    await c.env.DB.prepare('INSERT INTO assignments (id, type, test_id, section_kinds_json, assigned_to, assigned_by, due_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, data.type, data.testId, JSON.stringify(sectionKinds), data.assignedTo, user.id, data.dueAt ?? null, nowIso()).run()
    return c.json({ assignment: { id } }, 201)
  })

  api.get('/admin/groups', requireAuth, requireAdmin, async (c) => {
    const groups = await c.env.DB.prepare('SELECT id, name, created_at FROM groups ORDER BY created_at').all<{ id: string; name: string; created_at: string }>()
    const result = await Promise.all((groups.results ?? []).map(async (g) => {
      const members = await c.env.DB.prepare(
        'SELECT u.id, u.username, u.email FROM group_members gm JOIN users u ON u.id = gm.user_id WHERE gm.group_id = ?'
      ).bind(g.id).all<{ id: string; username: string; email: string | null }>()
      return { id: g.id, name: g.name, createdAt: g.created_at, members: members.results ?? [] }
    }))
    return c.json({ groups: result })
  })

  api.post('/admin/groups', requireAuth, requireAdmin, async (c) => {
    const { data, error } = await zParse(GroupNameBodySchema, c)
    if (error) return error
    const id = crypto.randomUUID()
    await c.env.DB.prepare('INSERT INTO groups (id, name, created_at) VALUES (?, ?, ?)').bind(id, data.name, nowIso()).run()
    return c.json({ group: { id, name: data.name } }, 201)
  })

  api.delete('/admin/groups/:groupId', requireAuth, requireAdmin, async (c) => {
    const groupId = c.req.param('groupId')
    const exists = await c.env.DB.prepare('SELECT 1 FROM groups WHERE id = ?').bind(groupId).first()
    if (!exists) return c.json({ error: 'Group not found.' }, 404)
    await c.env.DB.prepare('DELETE FROM groups WHERE id = ?').bind(groupId).run()
    return c.json({ ok: true }, 200)
  })

  api.post('/admin/groups/:groupId/members', requireAuth, requireAdmin, async (c) => {
    const groupId = c.req.param('groupId')
    const group = await c.env.DB.prepare('SELECT 1 FROM groups WHERE id = ?').bind(groupId).first()
    if (!group) return c.json({ error: 'Group not found.' }, 404)
    const { data, error } = await zParse(GroupMemberBodySchema, c)
    if (error) return error
    const user = await c.env.DB.prepare('SELECT 1 FROM users WHERE id = ?').bind(data.userId).first()
    if (!user) return c.json({ error: 'User not found.' }, 404)
    await c.env.DB.prepare('INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)').bind(groupId, data.userId).run()
    return c.json({ ok: true }, 201)
  })

  api.delete('/admin/groups/:groupId/members/:userId', requireAuth, requireAdmin, async (c) => {
    await c.env.DB.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?')
      .bind(c.req.param('groupId'), c.req.param('userId')).run()
    return c.json({ ok: true }, 200)
  })

  api.post('/admin/groups/:groupId/assignments', requireAuth, requireAdmin, async (c) => {
    const user = c.get('user')
    const groupId = c.req.param('groupId')
    const group = await c.env.DB.prepare('SELECT 1 FROM groups WHERE id = ?').bind(groupId).first()
    if (!group) return c.json({ error: 'Group not found.' }, 404)
    const { data, error } = await zParse(GroupAssignmentBodySchema, c)
    if (error) return error
    const test = await getTestById(c.env.DB, data.testId)
    if (!test) return c.json({ error: 'Test not found.' }, 404)

    const sectionKinds = data.sectionKinds?.length ? data.sectionKinds : Array.from(new Set(test.sections.map((s) => s.kind)))
    const members = await c.env.DB.prepare('SELECT user_id FROM group_members WHERE group_id = ?').bind(groupId).all<{ user_id: string }>()
    let count = 0
    for (const { user_id } of members.results ?? []) {
      const id = crypto.randomUUID()
      await c.env.DB.prepare('INSERT INTO assignments (id, type, test_id, section_kinds_json, assigned_to, assigned_by, due_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(id, data.type, data.testId, JSON.stringify(sectionKinds), user_id, user.id, data.dueAt ?? null, nowIso()).run()
      count++
    }
    return c.json({ count }, 201)
  })

  api.get('/admin/users/:userId/stats', requireAuth, requireAdmin, async (c) => {
    const userId = c.req.param('userId')
    const assignments = await c.env.DB.prepare('SELECT id, type FROM assignments WHERE assigned_to = ?').bind(userId).all<{ id: string; type: string }>()
    const assignmentMap = new Map((assignments.results ?? []).map((a) => [a.id, a.type]))
    const attempts = await c.env.DB.prepare("SELECT * FROM attempts WHERE user_id = ? AND status = 'completed'").bind(userId).all<AttemptRow>()

    const avg = (vals: (number | null)[]) => {
      const nums = vals.filter((v): v is number => v != null)
      return nums.length ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10 : null
    }

    const byType = (type: string) => (attempts.results ?? []).filter((a) => assignmentMap.get(a.assignment_id) === type)
    const summarize = (list: AttemptRow[], total: number) => ({
      completed: list.length, total,
      avgBand: avg(list.map((a) => a.band)),
      avgReadingBand: avg(list.map((a) => a.reading_band)),
      avgListeningBand: avg(list.map((a) => a.listening_band)),
      recentAttempts: list.sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? '')).slice(0, 5)
        .map((a) => ({ testId: a.test_id, band: a.band, readingBand: a.reading_band, listeningBand: a.listening_band, completedAt: a.completed_at })),
    })

    return c.json({
      stats: {
        tests: summarize(byType('task'), (assignments.results ?? []).filter((a) => a.type === 'task').length),
        homework: summarize(byType('homework'), (assignments.results ?? []).filter((a) => a.type === 'homework').length),
      }
    })
  })
}
