import type { Hono } from 'hono'
import type { AppEnv } from '../lib/types'
import { parseJson, requireAuth } from '../lib/store'

// amazonq-ignore-next-line
const EVALUATOR_URL = process.env.EVALUATOR_URL
// amazonq-ignore-next-line
const GENERATOR_URL = process.env.GENERATOR_URL

export const registerWritingRoutes = (api: Hono<AppEnv>) => {
  api.post('/writing/generate', requireAuth, async (c) => {
    if (!GENERATOR_URL) return c.json({ error: 'Generator service not configured.' }, 503)
    const res = await fetch(`${GENERATOR_URL}/generate`, { method: 'POST' })
    const data = await res.json()
    return c.json(data, res.status as 200)
  })

  api.post('/writing/evaluate', requireAuth, async (c) => {
    if (!EVALUATOR_URL) return c.json({ error: 'Evaluator service not configured.' }, 503)
    const body = await parseJson<{ topic?: string; essay?: string }>(c)
    if (!body?.topic?.trim() || !body?.essay?.trim()) {
      return c.json({ error: 'topic and essay are required.' }, 400)
    }
    const res = await fetch(`${EVALUATOR_URL}/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: body.topic, essay: body.essay }),
    })
    const data = await res.json()
    return c.json(data, res.status as 200)
  })
}
