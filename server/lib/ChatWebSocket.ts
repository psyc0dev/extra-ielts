import type { Bindings } from './types'

type WsAttachment = { userId: string; username: string }

export class ChatWebSocket {
  state: DurableObjectState
  env: Bindings

  constructor(state: DurableObjectState, env: Bindings) {
    this.state = state
    this.env = env
  }

  async fetch(request: Request) {
    // Internal broadcast endpoint — called by the API when a new message is posted
    if (request.method === 'POST' && new URL(request.url).pathname === '/broadcast') {
      const payload = await request.text()
      // Wrap in message envelope so client can distinguish from control events
      const wrapped = JSON.stringify({ type: 'message', ...JSON.parse(payload) })
      const clients = this.state.getWebSockets()
      for (const client of clients) {
        try {
          client.send(wrapped)
        } catch {
          // Client might be disconnected
        }
      }
      return new Response('OK')
    }

    // WebSocket upgrade
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

    // Gather current online users (excluding the new one)
    const onlineUsers = this.getOnlineUsers()

    // Send the online list to the newly connected client
    try {
      server.send(JSON.stringify({ type: 'online_list', users: onlineUsers }))
    } catch {
      // Client might have disconnected immediately
    }

    // Broadcast user_online to all OTHER clients
    this.broadcast(server, { type: 'user_online', userId, username })

    return new Response(null, {
      status: 101,
      webSocket: client,
    })
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    let data: Record<string, unknown>
    try {
      data = JSON.parse(message as string)
    } catch {
      return
    }

    const attachment = ws.deserializeAttachment() as WsAttachment | null
    const userId = attachment?.userId ?? ''
    const username = attachment?.username ?? ''

    if (data.type === 'typing') {
      this.broadcast(ws, { type: 'typing', userId, username })
    } else if (data.type === 'typing_stop') {
      this.broadcast(ws, { type: 'typing_stop', userId, username })
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
    const attachment = ws.deserializeAttachment() as WsAttachment | null
    if (attachment?.userId) {
      this.broadcast(null, { type: 'user_offline', userId: attachment.userId, username: attachment.username })
    }
  }

  async webSocketError(ws: WebSocket, error: unknown) {
    const attachment = ws.deserializeAttachment() as WsAttachment | null
    if (attachment?.userId) {
      this.broadcast(null, { type: 'user_offline', userId: attachment.userId, username: attachment.username })
    }
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
