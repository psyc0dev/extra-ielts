import type { Hono } from 'hono'
import type { AppEnv, UserSettings } from '../lib/types'
import { nowIso, parseJson, requireAuth } from '../lib/store'

const defaultSettings: UserSettings = { notifications: true, sound: true, timerWarning: true }

const getSettings = async (db: D1Database, userId: string): Promise<UserSettings> => {
  const row = await db.prepare('SELECT settings_json FROM user_settings WHERE user_id = ?')
    .bind(userId).first<{ settings_json: string }>()
  if (!row) return { ...defaultSettings }
  try { return { ...defaultSettings, ...JSON.parse(row.settings_json) } } catch { return { ...defaultSettings } }
}

const upsertSettings = async (db: D1Database, userId: string, settings: UserSettings) => {
  await db.prepare(
    'INSERT INTO user_settings (user_id, settings_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET settings_json = excluded.settings_json, updated_at = excluded.updated_at'
  ).bind(userId, JSON.stringify(settings), nowIso()).run()
}

export const registerSettingsRoutes = (api: Hono<AppEnv>) => {
  api.get('/settings', requireAuth, async (c) => {
    const settings = await getSettings(c.env.DB, c.get('user').id)
    return c.json({ settings })
  })

  api.put('/settings', requireAuth, async (c) => {
    const body = await parseJson<Partial<UserSettings>>(c)
    if (!body) return c.json({ error: 'Invalid settings payload.' }, 400)

    const current = await getSettings(c.env.DB, c.get('user').id)
    const patch: Partial<UserSettings> = {}
    if ('notifications' in body && typeof body.notifications === 'boolean') patch.notifications = body.notifications
    if ('sound' in body && typeof body.sound === 'boolean') patch.sound = body.sound
    if ('timerWarning' in body && typeof body.timerWarning === 'boolean') patch.timerWarning = body.timerWarning
    if (!Object.keys(patch).length) return c.json({ error: 'No valid settings provided.' }, 400)

    const settings = { ...current, ...patch }
    await upsertSettings(c.env.DB, c.get('user').id, settings)
    return c.json({ settings })
  })
}
