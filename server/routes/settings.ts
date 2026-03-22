import type { Hono } from 'hono'
import type { AppEnv, UserSettings } from '../lib/types'
import { getSettingsForUser, parseJson, requireAuth, updateSettingsForUser } from '../lib/store'

const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean'

export const registerSettingsRoutes = (api: Hono<AppEnv>) => {
  api.get('/settings', requireAuth, (c) => {
    const user = c.get('user')
    const settings = getSettingsForUser(user.id)
    return c.json({ settings })
  })

  api.put('/settings', requireAuth, async (c) => {
    const user = c.get('user')
    const body = await parseJson<Partial<UserSettings>>(c)
    if (!body) {
      return c.json({ error: 'Invalid settings payload.' }, 400)
    }

    const patch: Partial<UserSettings> = {}
    if ('notifications' in body) {
      if (!isBoolean(body.notifications)) return c.json({ error: 'notifications must be boolean.' }, 400)
      patch.notifications = body.notifications
    }
    if ('sound' in body) {
      if (!isBoolean(body.sound)) return c.json({ error: 'sound must be boolean.' }, 400)
      patch.sound = body.sound
    }
    if ('timerWarning' in body) {
      if (!isBoolean(body.timerWarning)) return c.json({ error: 'timerWarning must be boolean.' }, 400)
      patch.timerWarning = body.timerWarning
    }

    if (Object.keys(patch).length === 0) {
      return c.json({ error: 'No valid settings provided.' }, 400)
    }

    const settings = updateSettingsForUser(user.id, patch)
    return c.json({ settings })
  })
}
