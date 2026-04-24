import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { rateLimiter } from 'hono-rate-limiter'
import type { AppEnv } from './lib/types'
import { registerAdminRoutes } from './routes/admin'
import { registerAssignmentRoutes } from './routes/assignments'
import { registerAuthRoutes } from './routes/auth'
import { registerHealthRoutes } from './routes/health'
import { registerSettingsRoutes } from './routes/settings'
import { registerTestRoutes } from './routes/tests'
import { registerWritingRoutes } from './routes/writing'
import { registerAccountRoutes } from './routes/account'
import { registerVocabularyRoutes } from './routes/vocabulary'
import { CacheStore } from './lib/store'

export const createApp = () => {
  const app = new Hono<AppEnv>()
  const api = new Hono<AppEnv>()

  const getAllowed = (c: { env?: { CORS_ORIGIN?: string } }) =>
    c.env?.CORS_ORIGIN ? c.env.CORS_ORIGIN.split(',').map((s) => s.trim()) : []

  api.use('*', cors({
    origin: (origin, c) => {
      const allowed = getAllowed(c)
      return allowed.includes(origin) ? origin : null
    },
    allowMethods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  }))

  api.use('*', rateLimiter({
    windowMs: 60_000,
    limit: 60,
    store: new CacheStore(60_000),
    keyGenerator: (c) => c.req.header('x-forwarded-for') ?? 'unknown',
    message: { error: 'Too many requests. Please try again later.' },
  }))

  registerHealthRoutes(api)
  registerAuthRoutes(api)
  registerSettingsRoutes(api)
  registerTestRoutes(api)
  registerAssignmentRoutes(api)
  registerWritingRoutes(api)
  registerAccountRoutes(api)
  registerVocabularyRoutes(api)
  registerAdminRoutes(api)

  api.notFound((c) => c.json({ error: 'API route not found.' }, 404))

  app.route('/api', api)
  return app
}
