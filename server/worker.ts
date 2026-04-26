import { createApp } from './app'
export { ChatWebSocket } from './lib/ChatWebSocket'
export { AppPresenceWebSocket } from './lib/AppPresenceWebSocket'

const app = createApp()

export default {
  fetch: app.fetch,
}
