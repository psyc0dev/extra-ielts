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

class MemoryStore {
  private hits = new Map<string, { count: number; resetAt: number }>()

  constructor(private windowMs: number) {}

  init(_options: { windowMs: number }) {}

  async increment(key: string) {
    const now = Date.now()
    const entry = this.hits.get(key)

    if (!entry || now >= entry.resetAt) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs })
      return { totalHits: 1, resetTime: new Date(now + this.windowMs) }
    }

    entry.count++
    return { totalHits: entry.count, resetTime: new Date(entry.resetAt) }
  }

  async decrement(key: string) {
    const entry = this.hits.get(key)
    if (entry && entry.count > 0) entry.count--
  }

  async resetKey(key: string) {
    this.hits.delete(key)
  }
}

export const createApp = () => {
  const app = new Hono<AppEnv>()
  const api = new Hono<AppEnv>()

  api.use('*', cors({
    origin: (_origin, c) => c.env?.CORS_ORIGIN ?? '*',
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
