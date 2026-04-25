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
import { registerWSRoutes } from './routes/ws'
import { CacheStore, dbGetUser, getJwtSecret } from './lib/store'
import { verify } from 'hono/jwt'

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
  registerWSRoutes(api)
  registerAdminRoutes(api)

  api.notFound((c) => c.json({ error: 'API route not found.' }, 404))

  app.route('/api', api)

  // WebSocket upgrade — registered at top level to bypass CORS & rate limiter
  app.get('/api/groups/:groupId/ws', async (c) => {
    if (c.req.header('Upgrade') !== 'websocket') {
      return c.json({ error: 'Expected Upgrade: websocket' }, 426)
    }

    const token = c.req.query('token')
    if (!token) return c.json({ error: 'Unauthorized' }, 401)

    try {
      const secret = getJwtSecret(c)
      const payload = await verify(token, secret, 'HS256')
      const userId = payload.userId as string
      const user = await dbGetUser(c.env.DB, userId)
      if (!user) return c.json({ error: 'Unauthorized' }, 401)

      const groupId = c.req.param('groupId')
      const isMember = await c.env.DB.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').bind(groupId, user.id).first()
      const canAccess = isMember || user.role === 'teacher' || user.role === 'admin'
      if (!canAccess) return c.json({ error: 'Not authorized to view this group.' }, 403)

      const id = c.env.CHAT_ROOM.idFromName(groupId)
      const obj = c.env.CHAT_ROOM.get(id)

      // Create a new request with user info in headers
      const wsRequest = new Request(c.req.raw, {
        headers: new Headers(c.req.raw.headers),
      })
      wsRequest.headers.set('x-user-id', user.id)
      wsRequest.headers.set('x-username', user.username)
      wsRequest.headers.set('x-avatar-url', user.avatar_url || '')

      return obj.fetch(wsRequest)
    } catch {
      return c.json({ error: 'Unauthorized' }, 401)
    }
  })

  return app
}
