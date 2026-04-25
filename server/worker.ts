import { createApp } from './app'
export { ChatWebSocket } from './lib/ChatWebSocket'

const app = createApp()

export default {
  fetch: app.fetch,
}
