import type { Hono } from 'hono'
import type { AppEnv } from '../lib/types'
import { parseJson, requireAuth } from '../lib/store'

export const registerWritingRoutes = (api: Hono<AppEnv>) => {
  api.post('/writing/generate', requireAuth, async (c) => {
    const url = c.env.GENERATOR_URL
    if (!url) return c.json({ error: 'Generator service not configured.' }, 503)
    const res = await fetch(`${url}/generate`, { method: 'POST' })
    return c.json(await res.json(), res.status as 200)
  })

  api.post('/writing/evaluate', requireAuth, async (c) => {
    const url = c.env.EVALUATOR_URL
    if (!url) return c.json({ error: 'Evaluator service not configured.' }, 503)
    const body = await parseJson<{ topic?: string; essay?: string }>(c)
    if (!body?.topic?.trim() || !body?.essay?.trim()) return c.json({ error: 'topic and essay are required.' }, 400)
    const res = await fetch(`${url}/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: body.topic, essay: body.essay }),
    })
    return c.json(await res.json(), res.status as 200)
  })
}
