import { Database } from 'bun:sqlite'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { StoreSnapshot, TestDetail, UserSettings } from './lib/types'

const nowIso = () => new Date().toISOString()

const migrationsDir = join(import.meta.dir, 'migrations')

const runMigrations = (db: Database) => {
  db.exec('PRAGMA foreign_keys = ON;')
  db.exec('CREATE TABLE IF NOT EXISTS migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL);')

  const applied = new Set<string>()
  const rows = db.query('SELECT id FROM migrations').all() as Array<{ id: string }>
  for (const row of rows) {
    applied.add(row.id)
  }

  const files = readdirSync(migrationsDir).filter((file) => file.endsWith('.sql')).sort()
  for (const file of files) {
    if (applied.has(file)) continue
    const sql = readFileSync(join(migrationsDir, file), 'utf8')
    db.exec('BEGIN')
    try {
      db.exec(sql)
      db.query('INSERT INTO migrations (id, applied_at) VALUES (?, ?)').run(file, nowIso())
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
  }
}

const syncTests = (db: Database, tests: TestDetail[]) => {
  const upsertTest = db.query(
    `INSERT INTO tests (id, title, duration_minutes, published, sections_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       duration_minutes = excluded.duration_minutes,
       published = excluded.published,
       sections_json = excluded.sections_json`
  )

  const tx = db.transaction(() => {
    for (const test of tests) {
      upsertTest.run(
        test.id,
        test.title,
        test.durationMinutes,
        test.published ? 1 : 0,
        JSON.stringify(test.sections ?? []),
        nowIso()
      )
    }
  })

  tx()
}

const loadSnapshot = (db: Database): StoreSnapshot => {
  const users = (db
    .query('SELECT id, username, email, role, password_hash FROM users ORDER BY created_at')
    .all() as Array<{ id: string; username: string; email: string | null; role: string; password_hash: string }>)
    .map((row) => ({
      id: row.id,
      username: row.username,
      email: row.email ?? null,
      role: row.role as 'admin' | 'student',
      passwordHash: row.password_hash,
    }))

  const assignments = (db
    .query('SELECT id, type, test_id, section_kinds_json, assigned_to, assigned_by, due_at, created_at FROM assignments ORDER BY created_at')
    .all() as Array<{
    id: string
    type: string
    test_id: string
    section_kinds_json: string
    assigned_to: string
    assigned_by: string
    due_at: string | null
    created_at: string
  }>)
    .map((row) => ({
      id: row.id,
      type: row.type as 'task' | 'homework',
      testId: row.test_id,
      sectionKinds: row.section_kinds_json ? (JSON.parse(row.section_kinds_json) as Array<'listening' | 'reading'>) : [],
      assignedTo: row.assigned_to,
      assignedBy: row.assigned_by,
      dueAt: row.due_at ?? null,
      createdAt: row.created_at,
    }))

  const attempts = (db
    .query(
      'SELECT id, assignment_id, test_id, user_id, status, score_total, band, reading_band, listening_band, started_at, completed_at, responses_json FROM attempts ORDER BY started_at'
    )
    .all() as Array<{
    id: string
    assignment_id: string
    test_id: string
    user_id: string
    status: string
    score_total: number | null
    band: number | null
    reading_band: number | null
    listening_band: number | null
    started_at: string
    completed_at: string | null
    responses_json: string
  }>)
    .map((row) => ({
      id: row.id,
      assignmentId: row.assignment_id,
      testId: row.test_id,
      userId: row.user_id,
      status: row.status as 'in-progress' | 'completed',
      scoreTotal: row.score_total ?? null,
      band: row.band ?? null,
      readingBand: row.reading_band ?? null,
      listeningBand: row.listening_band ?? null,
      startedAt: row.started_at,
      completedAt: row.completed_at ?? null,
      responses: row.responses_json ? (JSON.parse(row.responses_json) as Record<string, unknown>) : {},
    }))

  const groups = (db
    .query('SELECT id, name, created_at FROM groups ORDER BY created_at')
    .all() as Array<{ id: string; name: string; created_at: string }>)
    .map((row) => ({
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      members: [] as string[],
    }))

  const members = db
    .query('SELECT group_id, user_id FROM group_members')
    .all() as Array<{ group_id: string; user_id: string }>

  const memberMap = new Map<string, string[]>()
  for (const member of members) {
    const list = memberMap.get(member.group_id) ?? []
    list.push(member.user_id)
    memberMap.set(member.group_id, list)
  }

  for (const group of groups) {
    group.members = memberMap.get(group.id) ?? []
  }

  const settingsRows = (db
    .query('SELECT user_id, settings_json FROM user_settings')
    .all() as Array<{ user_id: string; settings_json: string }>)
  const settings: Record<string, UserSettings> = {}
  for (const row of settingsRows) {
    try {
      settings[row.user_id] = JSON.parse(row.settings_json) as UserSettings
    } catch {
      // ignore malformed settings
    }
  }

  return {
    users,
    assignments,
    attempts,
    groups,
    settings,
  }
}

const saveSnapshot = (db: Database, snapshot: StoreSnapshot) => {
  const insertUser = db.query(
    'INSERT INTO users (id, username, email, role, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  )
  const insertAssignment = db.query(
    'INSERT INTO assignments (id, type, test_id, section_kinds_json, assigned_to, assigned_by, due_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  )
  const insertAttempt = db.query(
    'INSERT INTO attempts (id, assignment_id, test_id, user_id, status, score_total, band, reading_band, listening_band, started_at, completed_at, responses_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  )
  const insertGroup = db.query('INSERT INTO groups (id, name, created_at) VALUES (?, ?, ?)')
  const insertGroupMember = db.query('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)')
  const insertSettings = db.query('INSERT INTO user_settings (user_id, settings_json, updated_at) VALUES (?, ?, ?)')

  const tx = db.transaction(() => {
    db.exec('DELETE FROM group_members;')
    db.exec('DELETE FROM groups;')
    db.exec('DELETE FROM attempts;')
    db.exec('DELETE FROM assignments;')
    db.exec('DELETE FROM user_settings;')
    db.exec('DELETE FROM users;')

    for (const user of snapshot.users) {
      insertUser.run(user.id, user.username, user.email, user.role, user.passwordHash, nowIso())
    }

    for (const [userId, settings] of Object.entries(snapshot.settings ?? {})) {
      insertSettings.run(userId, JSON.stringify(settings), nowIso())
    }

    for (const assignment of snapshot.assignments) {
      insertAssignment.run(
        assignment.id,
        assignment.type,
        assignment.testId,
        JSON.stringify(assignment.sectionKinds ?? []),
        assignment.assignedTo,
        assignment.assignedBy,
        assignment.dueAt,
        assignment.createdAt
      )
    }

    for (const attempt of snapshot.attempts) {
      insertAttempt.run(
        attempt.id,
        attempt.assignmentId,
        attempt.testId,
        attempt.userId,
        attempt.status,
        attempt.scoreTotal,
        attempt.band,
        attempt.readingBand,
        attempt.listeningBand,
        attempt.startedAt,
        attempt.completedAt,
        JSON.stringify(attempt.responses ?? {})
      )
    }

    for (const group of snapshot.groups) {
      insertGroup.run(group.id, group.name, group.createdAt)
      for (const memberId of group.members) {
        insertGroupMember.run(group.id, memberId)
      }
    }
  })

  tx()
}

export const initDevDb = (tests: TestDetail[]) => {
  const dbPath = process.env.DEV_DB_PATH ?? join(import.meta.dir, 'dev.db')
  const db = new Database(dbPath)
  runMigrations(db)
  syncTests(db, tests)
  const snapshot = loadSnapshot(db)
  return {
    db,
    snapshot,
    persist: (next: StoreSnapshot) => saveSnapshot(db, next),
  }
}

