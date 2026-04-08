import { serveStatic } from 'hono/bun'
import { join, resolve, normalize } from 'node:path'
import { Database } from 'bun:sqlite'
import { readdirSync, readFileSync } from 'node:fs'
import { createApp } from './app'

// Run D1 migrations on local SQLite
const dbPath = process.env.DEV_DB_PATH ?? join(import.meta.dir, 'dev.db')
const sqlite = new Database(dbPath)
sqlite.exec('PRAGMA foreign_keys = ON;')
sqlite.exec('CREATE TABLE IF NOT EXISTS _migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL);')

const migrationsDir = join(import.meta.dir, 'migrations')
const applied = new Set((sqlite.query('SELECT id FROM _migrations').all() as { id: string }[]).map((r) => r.id))
for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
  if (applied.has(file)) continue
  sqlite.exec('BEGIN')
  try {
    sqlite.exec(readFileSync(join(migrationsDir, file), 'utf8'))
    sqlite.query('INSERT INTO _migrations (id, applied_at) VALUES (?, ?)').run(file, new Date().toISOString())
    sqlite.exec('COMMIT')
  } catch (e) {
    sqlite.exec('ROLLBACK')
    throw e
  }
}

// Minimal D1Database shim over bun:sqlite
const makeD1 = (db: Database): D1Database => ({
  prepare: (sql: string) => {
    let boundValues: import('bun:sqlite').SQLQueryBindings[] = []
    const stmt = () => db.prepare(sql)
    const api = {
      bind: (...values: import('bun:sqlite').SQLQueryBindings[]) => { boundValues = values; return api },
      first: async <T>() => stmt().get(...boundValues) as T | null,
      all: async <T>() => ({ results: stmt().all(...boundValues) as T[], success: true, meta: {} }),
      run: async () => { stmt().run(...boundValues); return { success: true, meta: {} } },
    }
    return api as unknown as D1PreparedStatement
  },
  batch: async () => [],
  dump: async () => new ArrayBuffer(0),
  exec: async () => ({ count: 0, duration: 0 }),
} as unknown as D1Database)

const app = createApp()
const staticRoot = join(import.meta.dir, '..', 'dist')
const staticMiddleware = serveStatic({ root: staticRoot })

app.use('*', async (c, next) => {
  if (c.req.path.startsWith('/api/') || c.req.path === '/api') return next()
  if (c.req.method !== 'GET' && c.req.method !== 'HEAD') return next()
  const safePath = normalize(c.req.path).replace(/^(\.\.[/\\])+/, '')
  // amazonq-ignore-next-line
  const resolvedPath = resolve(staticRoot, safePath.replace(/^\//, ''))
  if (!resolvedPath.startsWith(staticRoot)) return c.text('Forbidden', 403)
  return staticMiddleware(c, async () => {
    const indexFile = Bun.file(join(staticRoot, 'index.html'))
    c.res = (await indexFile.exists()) ? c.html(await indexFile.text()) : c.text('Not Found', 404)
  })
})

const port = Number(process.env.PORT ?? 8787)
const env = {
  DB: makeD1(sqlite),
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? '*',
  JWT_SECRET: process.env.JWT_SECRET ?? (() => { throw new Error('JWT_SECRET required') })(),
  EVALUATOR_URL: process.env.EVALUATOR_URL,
  GENERATOR_URL: process.env.GENERATOR_URL,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  RESEND_FROM: process.env.RESEND_FROM,
}

Bun.serve({ port, fetch: (req) => app.fetch(req, env) })
console.log(`Server running at http://localhost:${port}`)
