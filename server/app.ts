import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { AppEnv } from './lib/types'
import { registerAdminRoutes } from './routes/admin'
import { registerAssignmentRoutes } from './routes/assignments'
import { registerAuthRoutes } from './routes/auth'
import { registerHealthRoutes } from './routes/health'
import { registerSettingsRoutes } from './routes/settings'
import { registerTestRoutes } from './routes/tests'
import { registerWritingRoutes } from './routes/writing'
import { registerAccountRoutes } from './routes/account'

export const createApp = () => {
  const app = new Hono<AppEnv>()
  const api = new Hono<AppEnv>()

  api.use('*', cors({
    origin: (_origin, c) => c.env?.CORS_ORIGIN ?? '*',
    allowMethods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
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
