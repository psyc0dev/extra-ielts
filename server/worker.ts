import { createApp } from './app'
import type { Bindings } from './lib/types'

const app = createApp()

export default {
  fetch: (req: Request, env: Bindings) => app.fetch(req, env),
}
