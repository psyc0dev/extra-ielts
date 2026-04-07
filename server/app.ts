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
import { MemoryStore } from './lib/store'

export const createApp = () => {
  const app = new Hono<AppEnv>()
  const api = new Hono<AppEnv>()

  const ALLOWED_ORIGINS = [
    'tauri://localhost',
    'https://tauri.localhost',
  ]

  api.use('*', cors({
    origin: (origin, c) => {
      const allowed = c.env?.CORS_ORIGIN ? c.env.CORS_ORIGIN.split(',').map((s: string) => s.trim()) : ALLOWED_ORIGINS
      return allowed.includes(origin) ? origin : allowed[0]
    },
    allowMethods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  }))

  api.use('*', rateLimiter({
    windowMs: 60_000,
    limit: 60,
    store: new MemoryStore(60_000),
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
  registerAdminRoutes(api)

  api.notFound((c) => c.json({ error: 'API route not found.' }, 404))

  app.route('/api', api)
  return app
}
