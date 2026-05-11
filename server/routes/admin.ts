import type { Hono } from 'hono'
import type { AppEnv, Role } from '../lib/types'
import { CreateUserBodySchema, TestPublishedBodySchema, CreateAssignmentBodySchema, GroupAssignmentBodySchema, GroupNameBodySchema, GroupMemberBodySchema, GroupInviteSchema, InvitationActionSchema, GroupMessageBodySchema } from '../lib/schemas'
import { createPasswordHash, nowIso, zParse, jsonParse, requireAdmin, requireTeacherOrAdmin, requireAuth, toApiUser } from '../lib/store'
import { getTestById, getDbTests } from '../lib/tests'

type UserRow = { id: string; username: string; email: string | null; role: string; password_hash: string; avatar_url: string | null }
type AssignmentRow = { id: string; type: string; test_id: string; section_kinds_json: string; assigned_to: string; assigned_by: string; due_at: string | null; created_at: string }
type AttemptRow = { id: string; assignment_id: string; test_id: string; user_id: string; status: string; score_total: number | null; band: number | null; reading_band: number | null; listening_band: number | null; started_at: string; completed_at: string | null }

export const registerAdminRoutes = (api: Hono<AppEnv>) => {
  api.get('/admin/users', requireAuth, requireAdmin, async (c) => {
    const rows = await c.env.DB.prepare('SELECT id, username, email, role, password_hash, avatar_url FROM users ORDER BY created_at').all<UserRow>()
    return c.json({ users: (rows.results ?? []).map((r) => toApiUser({ id: r.id, username: r.username, email: r.email, role: r.role as Role, passwordHash: r.password_hash, avatarUrl: r.avatar_url })) })
  })

  api.get('/admin/users/lookup', requireAuth, requireTeacherOrAdmin, async (c) => {
    const username = c.req.query('username')?.trim()
    if (!username) return c.json({ error: 'Username query is required.' }, 400)
    const row = await c.env.DB.prepare('SELECT id, username, email, role, avatar_url FROM users WHERE LOWER(username) = ?').bind(username.toLowerCase()).first<{ id: string; username: string; email: string | null; role: string; avatar_url: string | null }>()
    if (!row) return c.json({ error: 'User not found.' }, 404)
    return c.json({ user: { id: row.id, username: row.username, email: row.email, role: row.role as Role, avatarUrl: row.avatar_url ?? null } })
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

  // Tests — teachers can manage tests (except delete)
  api.get('/admin/tests', requireAuth, requireTeacherOrAdmin, async (c) => {
    const tests = await getDbTests(c.env.DB)
    return c.json({ tests: tests.map((t) => ({
      id: t.id, title: t.title, durationMinutes: t.durationMinutes, published: t.published ?? false,
      sectionsCount: t.sections.length,
      questionsCount: t.sections.reduce((n, s) => n + s.questions.length, 0),
      attempt: null,
    })) })
  })

  api.get('/admin/tests/:testId', requireAuth, requireTeacherOrAdmin, async (c) => {
    const test = await getTestById(c.env.DB, c.req.param('testId'))
    if (!test) return c.json({ error: 'Test not found.' }, 404)
    return c.json({ test })
  })

  api.get('/admin/tests/:testId/download', requireAuth, requireTeacherOrAdmin, async (c) => {
    const test = await getTestById(c.env.DB, c.req.param('testId'))
    if (!test) return c.json({ error: 'Test not found.' }, 404)
    const safeTitle = (test.title ?? test.id).replace(/[^a-z0-9]+/gi, '-').toLowerCase()
    const filename = (safeTitle ? safeTitle : test.id) + '.json'
    return c.body(JSON.stringify(test, null, 2), 200, {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename.replace(/"/g, '')}"`,
    })
  })

  // Delete test — admin only
  api.delete('/admin/tests/:testId', requireAuth, requireAdmin, async (c) => {
    const testId = c.req.param('testId')
    if (!await getTestById(c.env.DB, testId)) return c.json({ error: 'Test not found.' }, 404)
    await c.env.DB.prepare('DELETE FROM attempts WHERE test_id = ?').bind(testId).run()
    await c.env.DB.prepare('DELETE FROM assignments WHERE test_id = ?').bind(testId).run()
    await c.env.DB.prepare('DELETE FROM tests WHERE id = ?').bind(testId).run()
    return c.json({ ok: true }, 200)
  })

  api.post('/admin/tests', requireAuth, requireTeacherOrAdmin, async (c) => {
    let body: unknown
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: 'Invalid JSON body.' }, 400)
    }
    const parsed = body as { title?: string; durationMinutes?: number; sections?: unknown[] }
    if (!parsed.title?.trim()) return c.json({ error: 'Title is required.' }, 400)
    if (typeof parsed.durationMinutes !== 'number' || parsed.durationMinutes < 1 || parsed.durationMinutes > 600) return c.json({ error: 'Invalid duration.' }, 400)
    if (!Array.isArray(parsed.sections)) return c.json({ error: 'Sections must be an array.' }, 400)
    if (parsed.sections.length > 20) return c.json({ error: 'Too many sections (max 20).' }, 400)

    // Validate section structure
    for (const section of parsed.sections) {
      if (typeof section !== 'object' || section === null) return c.json({ error: 'Each section must be an object.' }, 400)
      const s = section as Record<string, unknown>
      if (typeof s.kind !== 'string' || !['listening', 'reading'].includes(s.kind)) return c.json({ error: 'Invalid section kind.' }, 400)
      if (!Array.isArray(s.questions)) return c.json({ error: 'Section questions must be an array.' }, 400)
      if ((s.questions as unknown[]).length > 100) return c.json({ error: 'Too many questions per section (max 100).' }, 400)
    }

    const id = crypto.randomUUID()
    const testData = { id, title: String(parsed.title).trim().slice(0, 200), durationMinutes: parsed.durationMinutes, sections: parsed.sections }
    await c.env.DB.prepare('INSERT INTO tests (id, published, data_json) VALUES (?, 0, ?)')
      .bind(id, JSON.stringify(testData)).run()
    return c.json({ test: { id } }, 201)
  })

  api.put('/admin/tests/:testId', requireAuth, requireTeacherOrAdmin, async (c) => {
    const testId = c.req.param('testId')
    const existing = await getTestById(c.env.DB, testId)
    if (!existing) return c.json({ error: 'Test not found.' }, 404)
    let body: unknown
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: 'Invalid JSON body.' }, 400)
    }
    const parsed = body as { title?: string; durationMinutes?: number; sections?: unknown[]; published?: boolean }

    if (parsed.sections !== undefined) {
      if (!Array.isArray(parsed.sections)) return c.json({ error: 'Sections must be an array.' }, 400)
      if (parsed.sections.length > 20) return c.json({ error: 'Too many sections (max 20).' }, 400)
      for (const section of parsed.sections) {
        if (typeof section !== 'object' || section === null) return c.json({ error: 'Each section must be an object.' }, 400)
        const s = section as Record<string, unknown>
        if (typeof s.kind !== 'string' || !['listening', 'reading'].includes(s.kind)) return c.json({ error: 'Invalid section kind.' }, 400)
        if (!Array.isArray(s.questions)) return c.json({ error: 'Section questions must be an array.' }, 400)
        if ((s.questions as unknown[]).length > 100) return c.json({ error: 'Too many questions per section (max 100).' }, 400)
      }
    }
    if (parsed.durationMinutes !== undefined && (typeof parsed.durationMinutes !== 'number' || parsed.durationMinutes < 1 || parsed.durationMinutes > 600)) {
      return c.json({ error: 'Invalid duration.' }, 400)
    }

    const updated = {
      ...existing,
      title: parsed.title ? String(parsed.title).trim().slice(0, 200) : existing.title,
      durationMinutes: parsed.durationMinutes ?? existing.durationMinutes,
      sections: parsed.sections ?? existing.sections,
    }
    const published = parsed.published !== undefined ? (parsed.published ? 1 : 0) : (existing.published ? 1 : 0)
    await c.env.DB.prepare('UPDATE tests SET published = ?, data_json = ? WHERE id = ?')
      .bind(published, JSON.stringify(updated), testId).run()
    return c.json({ ok: true }, 200)
  })

  api.patch('/admin/tests/:testId', requireAuth, requireTeacherOrAdmin, async (c) => {
    const { data, error } = await zParse(TestPublishedBodySchema, c)
    if (error) return error
    const testId = c.req.param('testId')
    if (!await getTestById(c.env.DB, testId)) return c.json({ error: 'Test not found.' }, 404)
    await c.env.DB.prepare('UPDATE tests SET published = ? WHERE id = ?')
      .bind(data.published ? 1 : 0, testId).run()
    return c.json({ ok: true }, 200)
  })

  // Assignments — teachers can manage assignments
  api.get('/admin/assignments', requireAuth, requireTeacherOrAdmin, async (c) => {
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

  api.post('/admin/assignments', requireAuth, requireTeacherOrAdmin, async (c) => {
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

  // Groups — teachers can manage
  api.get('/admin/groups', requireAuth, requireTeacherOrAdmin, async (c) => {
    const user = c.get('user')
    const groups = user.role === 'admin'
      ? await c.env.DB.prepare('SELECT id, name, created_at FROM groups ORDER BY created_at').all<{ id: string; name: string; created_at: string }>()
      : await c.env.DB.prepare('SELECT id, name, created_at FROM groups WHERE owner_user_id = ? ORDER BY created_at').bind(user.id).all<{ id: string; name: string; created_at: string }>()
    const result = await Promise.all((groups.results ?? []).map(async (g) => {
      const members = await c.env.DB.prepare(
        'SELECT u.id, u.username, u.email FROM group_members gm JOIN users u ON u.id = gm.user_id WHERE gm.group_id = ?'
      ).bind(g.id).all<{ id: string; username: string; email: string | null }>()
      return { id: g.id, name: g.name, createdAt: g.created_at, members: members.results ?? [] }
    }))
    return c.json({ groups: result })
  })

  api.post('/admin/groups', requireAuth, requireTeacherOrAdmin, async (c) => {
    const user = c.get('user')
    const { data, error } = await zParse(GroupNameBodySchema, c)
    if (error) return error
    const id = crypto.randomUUID()
    await c.env.DB.prepare('INSERT INTO groups (id, name, owner_user_id, created_at) VALUES (?, ?, ?, ?)').bind(id, data.name, user.id, nowIso()).run()
    return c.json({ group: { id, name: data.name } }, 201)
  })

  // Delete group — owner or admin
  api.delete('/admin/groups/:groupId', requireAuth, requireTeacherOrAdmin, async (c) => {
    const user = c.get('user')
    const groupId = c.req.param('groupId')
    const group = await c.env.DB.prepare('SELECT owner_user_id FROM groups WHERE id = ?').bind(groupId).first<{ owner_user_id: string | null }>()
    if (!group) return c.json({ error: 'Group not found.' }, 404)
    const canManage = user.role === 'admin' || group.owner_user_id === user.id
    if (!canManage) return c.json({ error: 'Only the group owner can manage this group.' }, 403)
    await c.env.DB.prepare('DELETE FROM groups WHERE id = ?').bind(groupId).run()
    return c.json({ ok: true }, 200)
  })

  // Direct member add is disabled — use invitation flow
  api.post('/admin/groups/:groupId/members', requireAuth, requireAdmin, async (c) => {
    return c.json({ error: 'Direct member add is disabled. Use group invitations.' }, 403)
  })

  api.delete('/admin/groups/:groupId/members/:userId', requireAuth, requireTeacherOrAdmin, async (c) => {
    const user = c.get('user')
    const groupId = c.req.param('groupId')
    const targetUserId = c.req.param('userId')
    const group = await c.env.DB.prepare('SELECT owner_user_id FROM groups WHERE id = ?').bind(groupId).first<{ owner_user_id: string | null }>()
    if (!group) return c.json({ error: 'Group not found.' }, 404)
    const canManage = user.role === 'admin' || group.owner_user_id === user.id
    if (!canManage) return c.json({ error: 'Only the group owner can manage this group.' }, 403)

    const targetUser = await c.env.DB.prepare('SELECT role FROM users WHERE id = ?').bind(targetUserId).first<{ role: string }>()
    if (!targetUser) return c.json({ error: 'User not found.' }, 404)
    if (user.role !== 'admin' && targetUser.role !== 'student') {
      return c.json({ error: 'Group owners can only remove students.' }, 403)
    }

    await c.env.DB.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?')
      .bind(groupId, targetUserId).run()
    return c.json({ ok: true }, 200)
  })

  api.post('/admin/groups/:groupId/assignments', requireAuth, requireTeacherOrAdmin, async (c) => {
    const user = c.get('user')
    const groupId = c.req.param('groupId')
    const group = await c.env.DB.prepare('SELECT owner_user_id FROM groups WHERE id = ?').bind(groupId).first<{ owner_user_id: string | null }>()
    if (!group) return c.json({ error: 'Group not found.' }, 404)
    const canManage = user.role === 'admin' || group.owner_user_id === user.id
    if (!canManage) return c.json({ error: 'Only the group owner can manage this group.' }, 403)
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

  // Student stats — teachers can view
  api.get('/admin/users/:userId/stats', requireAuth, requireTeacherOrAdmin, async (c) => {
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

  // Invitations — teachers/admins invite students, students accept/decline
  type InvitationRow = { id: string; group_id: string; user_id: string; invited_by: string; status: string; created_at: string }

  api.post('/admin/groups/:groupId/invitations', requireAuth, requireTeacherOrAdmin, async (c) => {
    const inviter = c.get('user')
    const groupId = c.req.param('groupId')
    const group = await c.env.DB.prepare('SELECT owner_user_id FROM groups WHERE id = ?').bind(groupId).first<{ owner_user_id: string | null }>()
    if (!group) return c.json({ error: 'Group not found.' }, 404)
    const canManage = inviter.role === 'admin' || group.owner_user_id === inviter.id
    if (!canManage) return c.json({ error: 'Only the group owner can manage this group.' }, 403)

    const { data, error } = await zParse(GroupInviteSchema, c)
    if (error) return error

    const targetUser = await c.env.DB.prepare('SELECT id, username, role FROM users WHERE LOWER(username) = ?').bind(data.username.toLowerCase()).first<{ id: string; username: string; role: string }>()
    if (!targetUser) return c.json({ error: 'User not found.' }, 404)

    const alreadyMember = await c.env.DB.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').bind(groupId, targetUser.id).first()
    if (alreadyMember) return c.json({ error: 'User is already a member of this group.' }, 400)

    const existing = await c.env.DB.prepare("SELECT id, status FROM group_invitations WHERE group_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1").bind(groupId, targetUser.id).first<{ id: string; status: string }>()
    if (existing) {
      if (existing.status === 'pending') return c.json({ error: 'Invitation already pending for this user.' }, 400)
      // Re-invite: update the existing declined invitation back to pending
      await c.env.DB.prepare('UPDATE group_invitations SET status = ?, invited_by = ?, created_at = ? WHERE id = ?')
        .bind('pending', inviter.id, nowIso(), existing.id).run()
      return c.json({ invitation: { id: existing.id, groupId, userId: targetUser.id, username: targetUser.username, status: 'pending' } }, 201)
    }

    const id = crypto.randomUUID()
    await c.env.DB.prepare('INSERT INTO group_invitations (id, group_id, user_id, invited_by, status, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(id, groupId, targetUser.id, inviter.id, 'pending', nowIso()).run()
    return c.json({ invitation: { id, groupId, userId: targetUser.id, username: targetUser.username, status: 'pending' } }, 201)
  })

  api.get('/admin/groups/:groupId/invitations', requireAuth, requireTeacherOrAdmin, async (c) => {
    const user = c.get('user')
    const groupId = c.req.param('groupId')
    const group = await c.env.DB.prepare('SELECT owner_user_id FROM groups WHERE id = ?').bind(groupId).first<{ owner_user_id: string | null }>()
    if (!group) return c.json({ error: 'Group not found.' }, 404)
    const canManage = user.role === 'admin' || group.owner_user_id === user.id
    if (!canManage) return c.json({ error: 'Only the group owner can manage this group.' }, 403)

    const rows = await c.env.DB.prepare("SELECT * FROM group_invitations WHERE group_id = ? ORDER BY created_at DESC").bind(groupId).all<InvitationRow>()
    const userIds = [...new Set((rows.results ?? []).flatMap((r) => [r.user_id, r.invited_by]))]
    const userMap = new Map<string, { username: string; email: string | null }>()
    await Promise.all(userIds.map(async (uid) => {
      const u = await c.env.DB.prepare('SELECT id, username, email FROM users WHERE id = ?').bind(uid).first<{ id: string; username: string; email: string | null }>()
      if (u) userMap.set(u.id, { username: u.username, email: u.email })
    }))

    return c.json({
      invitations: (rows.results ?? []).map((r) => ({
        id: r.id, groupId: r.group_id, userId: r.user_id,
        username: userMap.get(r.user_id)?.username ?? 'Unknown',
        email: userMap.get(r.user_id)?.email ?? null,
        invitedBy: r.invited_by,
        invitedByName: userMap.get(r.invited_by)?.username ?? 'Unknown',
        status: r.status, createdAt: r.created_at,
      }))
    })
  })

  // Student-facing: list own invitations
  api.get('/invitations', requireAuth, async (c) => {
    const user = c.get('user')
    const rows = await c.env.DB.prepare("SELECT * FROM group_invitations WHERE user_id = ? ORDER BY created_at DESC").bind(user.id).all<InvitationRow>()
    const groupIds = [...new Set((rows.results ?? []).map((r) => r.group_id))]
    const groupMap = new Map<string, string>()
    await Promise.all(groupIds.map(async (gid) => {
      const g = await c.env.DB.prepare('SELECT id, name FROM groups WHERE id = ?').bind(gid).first<{ id: string; name: string }>()
      if (g) groupMap.set(g.id, g.name)
    }))

    const inviterIds = [...new Set((rows.results ?? []).map((r) => r.invited_by))]
    const inviterMap = new Map<string, string>()
    await Promise.all(inviterIds.map(async (uid) => {
      const u = await c.env.DB.prepare('SELECT id, username FROM users WHERE id = ?').bind(uid).first<{ id: string; username: string }>()
      if (u) inviterMap.set(u.id, u.username)
    }))

    return c.json({
      invitations: (rows.results ?? []).map((r) => ({
        id: r.id, groupId: r.group_id, groupName: groupMap.get(r.group_id) ?? 'Unknown',
        invitedByName: inviterMap.get(r.invited_by) ?? 'Unknown',
        status: r.status, createdAt: r.created_at,
      }))
    })
  })

  // Student-facing: accept or decline invitation
  api.patch('/invitations/:invitationId', requireAuth, async (c) => {
    const user = c.get('user')
    const invitationId = c.req.param('invitationId')
    const { data, error } = await zParse(InvitationActionSchema, c)
    if (error) return error

    const inv = await c.env.DB.prepare('SELECT * FROM group_invitations WHERE id = ? AND user_id = ?').bind(invitationId, user.id).first<InvitationRow>()
    if (!inv) return c.json({ error: 'Invitation not found.' }, 404)
    if (inv.status !== 'pending') return c.json({ error: 'Invitation already processed.' }, 400)

    const newStatus = data.action === 'accept' ? 'accepted' : 'declined'
    await c.env.DB.prepare('UPDATE group_invitations SET status = ? WHERE id = ?').bind(newStatus, invitationId).run()

    if (data.action === 'accept') {
      await c.env.DB.prepare('INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)').bind(inv.group_id, user.id).run()
    }

    return c.json({ ok: true, status: newStatus })
  })

  // Student-facing: leave a group
  api.post('/groups/:groupId/leave', requireAuth, async (c) => {
    const user = c.get('user')
    if (user.role !== 'student') return c.json({ error: 'Only students can leave groups.' }, 403)

    const groupId = c.req.param('groupId')
    const isMember = await c.env.DB.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').bind(groupId, user.id).first()
    if (!isMember) return c.json({ error: 'You are not a member of this group.' }, 400)

    await c.env.DB.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?').bind(groupId, user.id).run()
    return c.json({ ok: true }, 200)
  })

  // List groups: students see member groups, teachers/admins see all groups
  api.get('/groups', requireAuth, async (c) => {
    const user = c.get('user')

    let groupIds: string[]
    if (user.role === 'teacher' || user.role === 'admin') {
      // Teachers/admins can see all groups
      const allGroups = await c.env.DB.prepare('SELECT id FROM groups').all<{ id: string }>()
      groupIds = (allGroups.results ?? []).map((r) => r.id)
    } else {
      // Students only see groups they're members of
      const memberOf = await c.env.DB.prepare('SELECT group_id FROM group_members WHERE user_id = ?').bind(user.id).all<{ group_id: string }>()
      groupIds = (memberOf.results ?? []).map((r) => r.group_id)
    }

    if (groupIds.length === 0) return c.json({ groups: [] })

    const groups = await Promise.all(groupIds.map(async (gid) => {
      const g = await c.env.DB.prepare('SELECT id, name, created_at, owner_user_id FROM groups WHERE id = ?').bind(gid).first<{ id: string; name: string; created_at: string; owner_user_id: string | null }>()
      if (!g) return null
      const count = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM group_members WHERE group_id = ?').bind(gid).first<{ cnt: number }>()
      const members = await c.env.DB.prepare('SELECT user_id FROM group_members WHERE group_id = ?').bind(gid).all<{ user_id: string }>()
      // Owner is not in group_members but is a member — include them
      const ownerInMembers = g.owner_user_id ? await c.env.DB.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').bind(gid, g.owner_user_id).first() : null
      const memberCount = (count?.cnt ?? 0) + (ownerInMembers ? 0 : 1)
      const memberIds = new Set((members.results ?? []).map((m) => m.user_id))
      if (g.owner_user_id) memberIds.add(g.owner_user_id)
      return { id: g.id, name: g.name, createdAt: g.created_at, memberCount, memberIds: Array.from(memberIds) }
    }))
    return c.json({ groups: groups.filter(Boolean) })
  })

  // Group Chat — list messages (members, teachers, and admins)
  type MessageRow = { id: string; group_id: string; user_id: string; content: string; image_url: string | null; reply_to_id: string | null; created_at: string }
  type ReplyRow = { id: string; user_id: string; content: string; image_url: string | null; username: string | null }
  type SeenRow = { user_id: string; seen_at: string; username: string | null }

  api.get('/groups/:groupId/messages', requireAuth, async (c) => {
    const user = c.get('user')
    const groupId = c.req.param('groupId')

    // Verify user is a member of the group OR is a teacher/admin
    const isMember = await c.env.DB.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').bind(groupId, user.id).first()
    const canAccess = isMember || user.role === 'teacher' || user.role === 'admin'
    if (!canAccess) return c.json({ error: 'Not authorized to view this group.' }, 403)

    const rows = await c.env.DB.prepare('SELECT * FROM group_messages WHERE group_id = ? ORDER BY created_at ASC').bind(groupId).all<MessageRow>()
    const messageRows = rows.results ?? []

    const userIds = [...new Set(messageRows.map((r) => r.user_id))]
    const userMap = new Map<string, { username: string; avatarUrl: string | null }>()
    await Promise.all(userIds.map(async (uid) => {
      const u = await c.env.DB.prepare('SELECT id, username, avatar_url FROM users WHERE id = ?').bind(uid).first<{ id: string; username: string; avatar_url: string | null }>()
      if (u) userMap.set(u.id, { username: u.username, avatarUrl: u.avatar_url })
    }))

    const replyIds = [...new Set(messageRows.map((r) => r.reply_to_id).filter((v): v is string => Boolean(v)))]
    const replyMap = new Map<string, { id: string; userId: string; username: string; content: string; imageUrl: string | null }>()
    await Promise.all(replyIds.map(async (rid) => {
      const reply = await c.env.DB
        .prepare('SELECT gm.id, gm.user_id, gm.content, gm.image_url, u.username FROM group_messages gm LEFT JOIN users u ON u.id = gm.user_id WHERE gm.id = ? AND gm.group_id = ?')
        .bind(rid, groupId)
        .first<ReplyRow>()
      if (reply) {
        replyMap.set(rid, {
          id: reply.id,
          userId: reply.user_id,
          username: reply.username ?? 'Unknown',
          content: reply.content,
          imageUrl: reply.image_url,
        })
      }
    }))

    const seenMap = new Map<string, { userId: string; username: string; seenAt: string }[]>()
    await Promise.all(messageRows.map(async (row) => {
      const seenRows = await c.env.DB
        .prepare('SELECT s.user_id, s.seen_at, u.username FROM group_message_seen s LEFT JOIN users u ON u.id = s.user_id WHERE s.message_id = ? ORDER BY s.seen_at ASC')
        .bind(row.id)
        .all<SeenRow>()

      seenMap.set(
        row.id,
        (seenRows.results ?? []).map((s) => ({
          userId: s.user_id,
          username: s.username ?? 'Unknown',
          seenAt: s.seen_at,
        })),
      )
    }))

    return c.json({
      messages: messageRows.map((r) => ({
        id: r.id,
        groupId: r.group_id,
        userId: r.user_id,
        username: userMap.get(r.user_id)?.username ?? 'Unknown',
        avatarUrl: userMap.get(r.user_id)?.avatarUrl ?? null,
        content: r.content,
        imageUrl: r.image_url ?? null,
        replyTo: r.reply_to_id ? (replyMap.get(r.reply_to_id) ?? null) : null,
        seenBy: seenMap.get(r.id) ?? [],
        createdAt: r.created_at,
        isMe: r.user_id === user.id,
      }))
    })
  })

  // Group Chat — send message (members, teachers, and admins)
  api.post('/groups/:groupId/messages', requireAuth, async (c) => {
    const user = c.get('user')
    const groupId = c.req.param('groupId')

    // Verify user is a member of the group OR is a teacher/admin
    const isMember = await c.env.DB.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').bind(groupId, user.id).first()
    const canAccess = isMember || user.role === 'teacher' || user.role === 'admin'
    if (!canAccess) return c.json({ error: 'Not authorized to post in this group.' }, 403)

    const { data, error } = await zParse(GroupMessageBodySchema, c)
    if (error) return error

    const id = crypto.randomUUID()
    const createdAt = nowIso()
    const imageUrl = data.imageUrl ?? null
    const replyToId = data.replyToId ?? null

    let replyTo: { id: string; userId: string; username: string; content: string; imageUrl: string | null } | null = null
    if (replyToId) {
      const reply = await c.env.DB
        .prepare('SELECT gm.id, gm.user_id, gm.content, gm.image_url, u.username FROM group_messages gm LEFT JOIN users u ON u.id = gm.user_id WHERE gm.id = ? AND gm.group_id = ?')
        .bind(replyToId, groupId)
        .first<ReplyRow>()
      if (!reply) return c.json({ error: 'Reply target not found.' }, 400)

      replyTo = {
        id: reply.id,
        userId: reply.user_id,
        username: reply.username ?? 'Unknown',
        content: reply.content,
        imageUrl: reply.image_url,
      }
    }

    await c.env.DB.prepare('INSERT INTO group_messages (id, group_id, user_id, content, image_url, reply_to_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(id, groupId, user.id, data.content, imageUrl, replyToId, createdAt).run()

    const messageObj = {
      id,
      groupId,
      userId: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl,
      content: data.content,
      imageUrl,
      replyTo,
      seenBy: [],
      createdAt,
      isMe: false
    }

    // Broadcast to Durable Object
    try {
      const doId = c.env.CHAT_ROOM.idFromName(groupId)
      const obj = c.env.CHAT_ROOM.get(doId)
      // Send a POST to the DO with the message to broadcast
      await obj.fetch(new Request(`http://internal/broadcast`, {
        method: 'POST',
        body: JSON.stringify(messageObj)
      }))
    } catch (e) {
      console.error("Failed to broadcast message", e)
    }

    return c.json({
      message: { ...messageObj, isMe: true }
    }, 201)
  })

  api.post('/groups/:groupId/messages/:messageId/seen', requireAuth, async (c) => {
    const user = c.get('user')
    const groupId = c.req.param('groupId')
    const messageId = c.req.param('messageId')

    const isMember = await c.env.DB.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').bind(groupId, user.id).first()
    const canAccess = isMember || user.role === 'teacher' || user.role === 'admin'
    if (!canAccess) return c.json({ error: 'Not authorized to view this group.' }, 403)

    const msg = await c.env.DB.prepare('SELECT id, user_id FROM group_messages WHERE id = ? AND group_id = ?').bind(messageId, groupId).first<{ id: string; user_id: string }>()
    if (!msg) return c.json({ error: 'Message not found.' }, 404)

    if (msg.user_id === user.id) {
      return c.json({ ok: true, seenAt: null })
    }

    const existing = await c.env.DB
      .prepare('SELECT seen_at FROM group_message_seen WHERE message_id = ? AND user_id = ?')
      .bind(messageId, user.id)
      .first<{ seen_at: string }>()

    if (existing?.seen_at) {
      return c.json({ ok: true, seenAt: existing.seen_at })
    }

    const seenAt = nowIso()
    await c.env.DB
      .prepare('INSERT INTO group_message_seen (message_id, user_id, seen_at) VALUES (?, ?, ?)')
      .bind(messageId, user.id, seenAt)
      .run()

    try {
      const doId = c.env.CHAT_ROOM.idFromName(groupId)
      const obj = c.env.CHAT_ROOM.get(doId)
      await obj.fetch(new Request('http://internal/broadcast-seen', {
        method: 'POST',
        body: JSON.stringify({
          type: 'message_seen',
          groupId,
          messageId,
          userId: user.id,
          username: user.username,
          seenAt,
        }),
      }))
    } catch (e) {
      console.error('Failed to broadcast seen receipt', e)
    }

    return c.json({ ok: true, seenAt })
  })
}
