import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { AppEnv, StoreSnapshot, TestDetail } from './lib/types'
import { loadTestsFromDisk, setTestsCache, setPersistPublished } from './lib/tests'
import { loadSnapshot, setPersist } from './lib/store'
import { registerAdminRoutes } from './routes/admin'
import { registerAssignmentRoutes } from './routes/assignments'
import { registerAuthRoutes } from './routes/auth'
import { registerHealthRoutes } from './routes/health'
import { registerSettingsRoutes } from './routes/settings'
import { registerTestRoutes } from './routes/tests'

export const createApp = (options?: {
  snapshot?: StoreSnapshot
  persist?: (snapshot: StoreSnapshot) => void
  persistPublished?: (testId: string, published: boolean) => void
  publishedOverrides?: Map<string, boolean>
  tests?: TestDetail[]
}) => {
  const app = new Hono<AppEnv>()
  const api = new Hono<AppEnv>()

  if (options?.persistPublished) {
    setPersistPublished(options.persistPublished)
  }

  const tests = options?.tests ?? loadTestsFromDisk(options?.publishedOverrides)
  setTestsCache(tests)
  loadSnapshot(options?.snapshot)
  setPersist(options?.persist)

  api.use(
    '*',
    cors({
      origin: (_origin, c) => c.env?.CORS_ORIGIN ?? '*',
      allowMethods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      credentials: true,
    })
  )

  registerHealthRoutes(api)
  registerAuthRoutes(api)
  registerSettingsRoutes(api)
  registerTestRoutes(api)
  registerAssignmentRoutes(api)
  registerAdminRoutes(api)

  api.notFound((c) => {
    return c.json({ error: 'API route not found.' }, 404)
  })

  app.route('/api', api)
  app.route('/', api)

  return app
}
