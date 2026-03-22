import { serveStatic } from 'hono/bun'
import { join } from 'node:path'
import { createApp } from './app'
import { initDevDb } from './dev-db'
import { loadTestsFromDisk } from './lib/tests'

const tests = loadTestsFromDisk()
const { snapshot, persist } = initDevDb(tests)
const app = createApp({ snapshot, persist, tests })

const staticRoot = join(import.meta.dir, '..', 'dist')
const staticMiddleware = serveStatic({ root: staticRoot })
const apiPrefixes = ['/api', '/auth', '/tests', '/assignments', '/admin', '/health', '/db']

const isApiPath = (path: string) =>
  apiPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))

app.use('*', async (c, next) => {
  if (isApiPath(c.req.path)) {
    return next()
  }

  if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
    return next()
  }

  return staticMiddleware(c, async () => {
    const indexFile = Bun.file(join(staticRoot, 'index.html'))
    // amazonq-ignore-next-line
    c.res = (await indexFile.exists())
      ? c.html(await indexFile.text())
      : c.text('Not Found', 404)
  })
})

const port = Number(process.env.PORT ?? 8787)
const env = {
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? '*',
}

Bun.serve({
  port,
  fetch: (req) => app.fetch(req, env),
})

console.log(`API + static server running at http://localhost:${port}`)
