import type { Hono } from 'hono'
import type { AppEnv, Role } from '../lib/types'
import { createPasswordHash, nowIso, parseJson, requireAdmin, requireAuth, toApiUser } from '../lib/store'
import { getTestById, getTests } from '../lib/tests'

type UserRow = { id: string; username: string; email: string | null; role: string; password_hash: string; avatar_url: string | null }
type AssignmentRow = { id: string; type: string; test_id: string; section_kinds_json: string; assigned_to: string; assigned_by: string; due_at: string | null; created_at: string }
type AttemptRow = { id: string; assignment_id: string; test_id: string; user_id: string; status: string; score_total: number | null; band: number | null; reading_band: number | null; listening_band: number | null; started_at: string; completed_at: string | null }

const getPublishedOverrides = async (db: D1Database) => {
  const rows = await db.prepare('SELECT id, published FROM tests').all<{ id: string; published: number }>()
  return new Map((rows.results ?? []).map((r) => [r.id, r.published === 1]))
}

export const registerAdminRoutes = (api: Hono<AppEnv>) => {
  api.get('/admin/users', requireAuth, requireAdmin, async (c) => {
    const rows = await c.env.DB.prepare('SELECT id, username, email, role, password_hash, avatar_url FROM users ORDER BY created_at').all<UserRow>()
    return c.json({ users: (rows.results ?? []).map((r) => toApiUser({ id: r.id, username: r.username, email: r.email, role: r.role as Role, passwordHash: r.password_hash, avatarUrl: r.avatar_url })) })
  })

  api.post('/admin/users', requireAuth, requireAdmin, async (c) => {
    const body = await parseJson<{ username?: string; email?: string; password?: string; role?: Role }>(c)
    if (!body?.username || !body.password || !body.role) return c.json({ error: 'username, password, and role are required.' }, 400)
    if (body.role !== 'admin' && body.role !== 'student') return c.json({ error: 'Invalid role.' }, 400)

    const exists = await c.env.DB.prepare('SELECT 1 FROM users WHERE LOWER(username) = ? OR (email IS NOT NULL AND LOWER(email) = ?) LIMIT 1')
      .bind(body.username.toLowerCase(), (body.email ?? '').toLowerCase()).first()
    if (exists) return c.json({ error: 'User already exists.' }, 400)

    const id = crypto.randomUUID()
    const passwordHash = await createPasswordHash(body.password)
    await c.env.DB.prepare('INSERT INTO users (id, username, email, role, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(id, body.username, body.email ?? null, body.role, passwordHash, nowIso()).run()
    return c.json({ user: { id, username: body.username, email: body.email ?? null, role: body.role, avatarUrl: null } })
  })

  api.get('/admin/tests', requireAuth, requireAdmin, async (c) => {
    const overrides = await getPublishedOverrides(c.env.DB)
    const tests = getTests(overrides).map((t) => ({
      id: t.id, title: t.title, durationMinutes: t.durationMinutes, published: t.published ?? false,
      sectionsCount: t.sections.length,
      questionsCount: t.sections.reduce((n, s) => n + s.questions.length, 0),
      attempt: null,
    }))
    return c.json({ tests })
  })

  api.patch('/admin/tests/:testId/published', requireAuth, requireAdmin, async (c) => {
    const body = await parseJson<{ published?: boolean }>(c)
    if (typeof body?.published !== 'boolean') return c.json({ error: 'published flag is required.' }, 400)
    const testId = c.req.param('testId')
    if (!getTestById(testId)) return c.json({ error: 'Test not found.' }, 404)
    await c.env.DB.prepare('INSERT INTO tests (id, published) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET published = excluded.published')
      .bind(testId, body.published ? 1 : 0).run()
    return c.json({ ok: true })
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
        sectionKinds: JSON.parse(r.section_kinds_json),
        assignedTo: r.assigned_to, assignedToName: userMap.get(r.assigned_to) ?? 'Unknown',
        assignedBy: r.assigned_by, assignedByName: userMap.get(r.assigned_by) ?? 'Unknown',
        dueAt: r.due_at, createdAt: r.created_at,
      }))
    })
  })

  api.post('/admin/assignments', requireAuth, requireAdmin, async (c) => {
    const user = c.get('user')
    const body = await parseJson<{ type?: string; testId?: string; sectionKinds?: string[]; assignedTo?: string; dueAt?: string | null }>(c)
    if (!body?.type || !body.testId || !body.assignedTo) return c.json({ error: 'type, testId, and assignedTo are required.' }, 400)
    if (body.type !== 'task' && body.type !== 'homework') return c.json({ error: 'Invalid assignment type.' }, 400)
    const test = getTestById(body.testId)
    if (!test) return c.json({ error: 'Test not found.' }, 404)
    const assignedUser = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(body.assignedTo).first()
    if (!assignedUser) return c.json({ error: 'Assigned user not found.' }, 404)

    const sectionKinds = body.sectionKinds?.length ? body.sectionKinds : Array.from(new Set(test.sections.map((s) => s.kind)))
    const id = crypto.randomUUID()
    await c.env.DB.prepare('INSERT INTO assignments (id, type, test_id, section_kinds_json, assigned_to, assigned_by, due_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, body.type, body.testId, JSON.stringify(sectionKinds), body.assignedTo, user.id, body.dueAt ?? null, nowIso()).run()
    return c.json({ assignment: { id } })
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
    const body = await parseJson<{ name?: string }>(c)
    if (!body?.name) return c.json({ error: 'Group name is required.' }, 400)
    const id = crypto.randomUUID()
    await c.env.DB.prepare('INSERT INTO groups (id, name, created_at) VALUES (?, ?, ?)').bind(id, body.name, nowIso()).run()
    return c.json({ group: { id, name: body.name } })
  })

  api.delete('/admin/groups/:groupId', requireAuth, requireAdmin, async (c) => {
    const groupId = c.req.param('groupId')
    const exists = await c.env.DB.prepare('SELECT 1 FROM groups WHERE id = ?').bind(groupId).first()
    if (!exists) return c.json({ error: 'Group not found.' }, 404)
    await c.env.DB.prepare('DELETE FROM groups WHERE id = ?').bind(groupId).run()
    return c.json({ ok: true })
  })

  api.post('/admin/groups/:groupId/members', requireAuth, requireAdmin, async (c) => {
    const groupId = c.req.param('groupId')
    const group = await c.env.DB.prepare('SELECT 1 FROM groups WHERE id = ?').bind(groupId).first()
    if (!group) return c.json({ error: 'Group not found.' }, 404)
    const body = await parseJson<{ userId?: string }>(c)
    if (!body?.userId) return c.json({ error: 'userId is required.' }, 400)
    const user = await c.env.DB.prepare('SELECT 1 FROM users WHERE id = ?').bind(body.userId).first()
    if (!user) return c.json({ error: 'User not found.' }, 404)
    await c.env.DB.prepare('INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)').bind(groupId, body.userId).run()
    return c.json({ ok: true })
  })

  api.delete('/admin/groups/:groupId/members/:userId', requireAuth, requireAdmin, async (c) => {
    await c.env.DB.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?')
      .bind(c.req.param('groupId'), c.req.param('userId')).run()
    return c.json({ ok: true })
  })

  api.post('/admin/groups/:groupId/assign', requireAuth, requireAdmin, async (c) => {
    const user = c.get('user')
    const groupId = c.req.param('groupId')
    const group = await c.env.DB.prepare('SELECT 1 FROM groups WHERE id = ?').bind(groupId).first()
    if (!group) return c.json({ error: 'Group not found.' }, 404)
    const body = await parseJson<{ type?: string; testId?: string; sectionKinds?: string[]; dueAt?: string | null }>(c)
    if (!body?.type || !body.testId) return c.json({ error: 'type and testId are required.' }, 400)
    if (body.type !== 'task' && body.type !== 'homework') return c.json({ error: 'Invalid assignment type.' }, 400)
    const test = getTestById(body.testId)
    if (!test) return c.json({ error: 'Test not found.' }, 404)

    const sectionKinds = body.sectionKinds?.length ? body.sectionKinds : Array.from(new Set(test.sections.map((s) => s.kind)))
    const members = await c.env.DB.prepare('SELECT user_id FROM group_members WHERE group_id = ?').bind(groupId).all<{ user_id: string }>()
    let count = 0
    for (const { user_id } of members.results ?? []) {
      const id = crypto.randomUUID()
      await c.env.DB.prepare('INSERT INTO assignments (id, type, test_id, section_kinds_json, assigned_to, assigned_by, due_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(id, body.type, body.testId, JSON.stringify(sectionKinds), user_id, user.id, body.dueAt ?? null, nowIso()).run()
      count++
    }
    return c.json({ count })
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
