import type { Hono } from 'hono'
import type { AppEnv } from '../lib/types'
import { parseJson, requireAuth } from '../lib/store'
import axios from 'axios'

export const registerWritingRoutes = (api: Hono<AppEnv>) => {
  api.post('/writing/generate', requireAuth, async (c) => {
    const url = c.env.GENERATOR_URL
    if (!url) return c.json({ error: 'Generator service not configured.' }, 503)

    for (let attempt = 0; attempt < 3; attempt++) {
      const { data } = await axios.post<{ topic?: string; error?: string }>(`${url}/generate`)
      if (data.error) return c.json(data, 500)
      if (data.topic && data.topic.trim().length >= 40) return c.json(data)
    }

    return c.json({ error: 'Failed to generate a valid topic. Please try again.' }, 500)
  })

  api.post('/writing/evaluate', requireAuth, async (c) => {
    const url = c.env.EVALUATOR_URL
    if (!url) return c.json({ error: 'Evaluator service not configured.' }, 503)
    const body = await parseJson<{ topic?: string; essay?: string }>(c)
    if (!body?.topic?.trim() || !body?.essay?.trim()) return c.json({ error: 'topic and essay are required.' }, 400)
    const { data, status } = await axios.post(`${url}/evaluate`, { topic: body.topic, essay: body.essay })
    return c.json(data, status as 200)
  })
}
