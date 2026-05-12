import type { Hono } from 'hono'
import type { AppEnv } from '../lib/types'
import { WritingEvaluationBodySchema } from '../lib/schemas'
import { zParse, requireAuth, nowIso } from '../lib/store'
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

      if (status === 200 && result && !result.error) {
        const user = c.get('user')
        const id = crypto.randomUUID()
        const wordCount = data.essay.trim().split(/\s+/).length
        await c.env.DB.prepare(
          'INSERT INTO writing_submissions (id, user_id, topic, essay, word_count, overall_score, overall_label, penalty, criteria_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(
          id, user.id, data.topic, data.essay, wordCount,
          result.overall ?? null, result.overall_label ?? null, result.penalty ?? 0,
          JSON.stringify(result.criteria ?? null), nowIso()
        ).run()
      }

      return c.json(result, status as 200)
    } catch (err) {
      console.error('[writing] evaluation error:', err)
      const message = axios.isAxiosError(err) && err.response?.status && err.response.status < 500
        ? (err.response?.data?.error ?? 'Evaluation failed.')
        : 'Evaluation service is temporarily unavailable.'
      return c.json({ error: message }, 502)
    }
  })

  api.get('/writing/history', requireAuth, async (c) => {
    const user = c.get('user')
    const rows = await c.env.DB.prepare(
      'SELECT id, topic, word_count, overall_score, overall_label, penalty, criteria_json, created_at FROM writing_submissions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
    ).bind(user.id).all<{
      id: string; topic: string; word_count: number; overall_score: number | null;
      overall_label: string | null; penalty: number; criteria_json: string | null; created_at: string
    }>()

    const submissions = (rows.results ?? []).map((r) => ({
      id: r.id,
      topic: r.topic,
      wordCount: r.word_count,
      overallScore: r.overall_score,
      overallLabel: r.overall_label,
      penalty: r.penalty,
      criteria: r.criteria_json ? JSON.parse(r.criteria_json) : null,
      createdAt: r.created_at,
    }))

    return c.json({ submissions })
  })

  api.get('/writing/history/:id', requireAuth, async (c) => {
    const user = c.get('user')
    const row = await c.env.DB.prepare(
      'SELECT * FROM writing_submissions WHERE id = ? AND user_id = ?'
    ).bind(c.req.param('id'), user.id).first<{
      id: string; topic: string; essay: string; word_count: number; overall_score: number | null;
      overall_label: string | null; penalty: number; criteria_json: string | null; created_at: string
    }>()

    if (!row) return c.json({ error: 'Submission not found.' }, 404)

    return c.json({
      submission: {
        id: row.id,
        topic: row.topic,
        essay: row.essay,
        wordCount: row.word_count,
        overallScore: row.overall_score,
        overallLabel: row.overall_label,
        penalty: row.penalty,
        criteria: row.criteria_json ? JSON.parse(row.criteria_json) : null,
        createdAt: row.created_at,
      },
    })
  })
}
