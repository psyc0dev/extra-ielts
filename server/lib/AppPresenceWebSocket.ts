import type { Bindings } from './types'

type WsAttachment = { userId: string; username: string }

export class AppPresenceWebSocket {
  state: DurableObjectState
  env: Bindings

  constructor(state: DurableObjectState, env: Bindings) {
    this.state = state
    this.env = env
  }

  async fetch(request: Request) {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected Upgrade: websocket', { status: 426 })
    }

    const pair = new WebSocketPair()
    const [client, server] = [pair[0], pair[1]]

    const url = new URL(request.url)
    const userId = url.searchParams.get('userId') ?? ''
    const username = url.searchParams.get('username') ?? ''

    server.serializeAttachment({ userId, username })
    this.state.acceptWebSocket(server)

    const onlineUsers = this.getOnlineUsers()

    try {
      server.send(JSON.stringify({ type: 'online_list', users: onlineUsers }))
    } catch {
      // Client might have disconnected immediately
    }

    this.broadcast(server, { type: 'user_online', userId, username })

    return new Response(null, {
      status: 101,
      webSocket: client,
    })
  }

  async webSocketClose(ws: WebSocket) {
    this.handleDisconnect(ws)
  }

  async webSocketError(ws: WebSocket) {
    this.handleDisconnect(ws)
  }

  private handleDisconnect(ws: WebSocket) {
    const attachment = ws.deserializeAttachment() as WsAttachment | null
    if (!attachment?.userId) return

    for (const client of this.state.getWebSockets()) {
      if (client === ws) continue
      const other = client.deserializeAttachment() as WsAttachment | null
      if (other?.userId === attachment.userId) return
    }

    this.broadcast(null, { type: 'user_offline', userId: attachment.userId, username: attachment.username })
  }

  private getOnlineUsers(): { userId: string; username: string }[] {
    const seen = new Set<string>()
    const users: { userId: string; username: string }[] = []

    for (const client of this.state.getWebSockets()) {
      const attachment = client.deserializeAttachment() as WsAttachment | null
      if (attachment?.userId && !seen.has(attachment.userId)) {
        seen.add(attachment.userId)
        users.push({ userId: attachment.userId, username: attachment.username })
      }
    }

    return users
  }

  private broadcast(exclude: WebSocket | null, payload: Record<string, unknown>) {
    const text = JSON.stringify(payload)
    for (const client of this.state.getWebSockets()) {
      if (client !== exclude) {
        try {
          client.send(text)
        } catch {
          // Client might be disconnected
        }
      }
    }
  }
}
