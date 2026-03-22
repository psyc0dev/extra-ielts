import type { Hono } from 'hono'
import type { AppEnv } from '../lib/types'

export const registerHealthRoutes = (api: Hono<AppEnv>) => {
  api.get('/health', (c) => {
    return c.json({
      ok: true,
      service: 'extra-ielts',
      time: new Date().toISOString(),
    })
  })

  api.get('/db/health', async (c) => {
    const db = c.env?.DB
    if (!db) {
      return c.json({ error: 'D1 binding "DB" not configured.' }, 501)
    }

    try {
      const result = await db.prepare('SELECT 1 as ok').first?.()
      return c.json({ ok: true, result: result ?? { ok: 1 } })
    } catch (error) {
      return c.json(
        {
          ok: false,
          error: error instanceof Error ? error.message : 'DB error',
        },
        500
      )
    }
  })
}
