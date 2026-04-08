import type { Hono } from 'hono'
import type { AppEnv, UserSettings } from '../lib/types'
import { SettingsPatchBodySchema } from '../lib/schemas'
import { nowIso, zParse, requireAuth } from '../lib/store'

const defaultSettings = { notifications: true, sound: true, timerWarning: true }

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
    const { data, error } = await zParse(SettingsPatchBodySchema, c)
    if (error) return error

    const current = await getSettings(c.env.DB, c.get('user').id)
    const settings = { ...current, ...data }
    await upsertSettings(c.env.DB, c.get('user').id, settings)
    return c.json({ settings })
  })
}
