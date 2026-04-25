import { createApp } from './app'
export { ChatRoomDO } from './lib/ChatRoomDO'

const app = createApp()

export default {
  fetch: app.fetch,
}
