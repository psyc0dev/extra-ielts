import { createApp } from './app'
export { ChatWebSocket } from './lib/ChatWebSocket'
export { PresenceWebSocket } from './lib/PresenceWebSocket'

const app = createApp()

export default {
  fetch: app.fetch,
}
