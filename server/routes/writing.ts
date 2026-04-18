import type { Hono } from 'hono'
import type { AppEnv } from '../lib/types'
import { WritingEvaluationBodySchema } from '../lib/schemas'
import { zParse, requireAuth } from '../lib/store'
import axios from 'axios'

export const registerWritingRoutes = (api: Hono<AppEnv>) => {
  api.get('/writing/topic', requireAuth, async (c) => {
    const url = c.env.GENERATOR_URL
    if (!url) return c.json({ error: 'Generator service not configured.' }, 503)

    for (let attempt = 0; attempt < 3; attempt++) {
      const { data } = await axios.post<{ topic?: string; error?: string }>(`${url}/generate`, {}, { timeout: 15_000 })
      if (data.error) return c.json(data, 500)
      if (data.topic && data.topic.trim().length >= 40) return c.json(data)
    }

    return c.json({ error: 'Failed to generate a valid topic. Please try again.' }, 500)
  })

  api.post('/writing/evaluations', requireAuth, async (c) => {
    const url = c.env.EVALUATOR_URL
    if (!url) return c.json({ error: 'Evaluator service not configured.' }, 503)
    const { data, error } = await zParse(WritingEvaluationBodySchema, c)
    if (error) return error
    try {
      const { data: result, status } = await axios.post(`${url}/evaluate`, { topic: data.topic, essay: data.essay }, { timeout: 60_000 })
      return c.json(result, status as 200)
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? (err.response?.data?.error ?? err.message)
        : 'Evaluation service error.'
      return c.json({ error: message }, 502)
    }
  })
}
