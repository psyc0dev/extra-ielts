import type { Bindings } from './types'
import { sanitizeMessage, sanitizeEmoji } from './sanitize'
import { messageLimiter, typingLimiter, reactionLimiter, readReceiptLimiter } from './rate-limiter'

interface ClientData {
  userId: string
  username: string
  avatarUrl: string | null
}

export class ChatRoomDO {
  state: DurableObjectState
  env: Bindings
  groupId: string = ''

  constructor(state: DurableObjectState, env: Bindings) {
    this.state = state
    this.env = env
  }

  async fetch(request: Request) {
    const url = new URL(request.url)

    // Internal broadcast endpoint — called by the API when assignments are created/submitted
    if (request.method === 'POST' && url.pathname === '/broadcast') {
      const payload = await request.text()
      const clients = this.state.getWebSockets()
      for (const client of clients) {
        try {
          client.send(payload)
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

    this.state.acceptWebSocket(server)

    const userId = url.searchParams.get('userId')
    const username = url.searchParams.get('username') || 'Unknown'
    const avatarUrl = url.searchParams.get('avatarUrl')
    this.groupId = this.state.id.toString()

    if (userId) {
      const data: ClientData = { userId, username, avatarUrl }
      server.serializeAttachment(data)

      // Notify others of user joining
      const joinMsg = {
        type: 'user-joined',
        userId,
        username,
        groupId: this.groupId,
        timestamp: new Date().toISOString(),
      }
      this.broadcastExcept(server, JSON.stringify(joinMsg))

      // Send current member count
      this.sendMemberCount()
    }

    return new Response(null, {
      status: 101,
      webSocket: client,
    })
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    try {
      const data = JSON.parse(message.toString())
      const attachment = ws.getAttachment() as ClientData

      if (!attachment) return

      const { userId, username, avatarUrl } = attachment
      const groupId = this.groupId

      if (data.type === 'message') {
        if (!messageLimiter.check(userId, groupId, 'message')) {
          ws.send(JSON.stringify({ type: 'error', message: 'Message rate limit exceeded' }))
          return
        }

        const sanitized = sanitizeMessage(data.content)
        if (!sanitized) return

        const msg = {
          type: 'message',
          id: crypto.randomUUID(),
          groupId,
          userId,
          username,
          avatarUrl,
          content: sanitized,
          imageUrl: data.imageUrl ?? null,
          timestamp: new Date().toISOString(),
        }
        this.broadcast(JSON.stringify(msg))
      } else if (data.type === 'typing') {
        if (!typingLimiter.check(userId, groupId, 'typing')) {
          return
        }

        const typingMsg = {
          type: 'typing-update',
          groupId,
          userId,
          username,
          isTyping: data.isTyping ?? false,
          timestamp: new Date().toISOString(),
        }
        this.broadcast(JSON.stringify(typingMsg))
      } else if (data.type === 'reaction') {
        if (!reactionLimiter.check(userId, groupId, 'reaction')) {
          ws.send(JSON.stringify({ type: 'error', message: 'Reaction rate limit exceeded' }))
          return
        }

        const messageId = data.messageId
        const emoji = sanitizeEmoji(data.emoji)
        const action = data.action

        if (!messageId || !emoji) return

        const reactionMsg = {
          type: 'reaction',
          messageId,
          userId,
          username,
          emoji,
          action,
          timestamp: new Date().toISOString(),
        }
        this.broadcast(JSON.stringify(reactionMsg))
      } else if (data.type === 'read-receipt') {
        if (!readReceiptLimiter.check(userId, groupId, 'read-receipt')) {
          return
        }

        const messageId = data.messageId
        if (!messageId) return

        const readMsg = {
          type: 'read-receipt',
          messageId,
          userId,
          username,
          timestamp: new Date().toISOString(),
        }
        this.broadcast(JSON.stringify(readMsg))
      }
    } catch (e) {
      console.error('WebSocket message error:', e)
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
    const attachment = ws.getAttachment() as ClientData
    if (attachment) {
      const leftMsg = {
        type: 'user-left',
        userId: attachment.userId,
        groupId: this.groupId,
        timestamp: new Date().toISOString(),
      }
      this.broadcast(JSON.stringify(leftMsg))
      this.sendMemberCount()
    }
  }

  async webSocketError(ws: WebSocket, error: unknown) {
    console.error('WebSocket error:', error)
  }

  private broadcast(message: string) {
    const clients = this.state.getWebSockets()
    for (const client of clients) {
      try {
        client.send(message)
      } catch {
        // Client might be disconnected
      }
    }
  }

  private broadcastExcept(exclude: WebSocket, message: string) {
    const clients = this.state.getWebSockets()
    for (const client of clients) {
      if (client !== exclude) {
        try {
          client.send(message)
        } catch {
          // Client might be disconnected
        }
      }
    }
  }

  private sendMemberCount() {
    const clients = this.state.getWebSockets()
    const members = clients.map(client => {
      const attachment = client.getAttachment() as ClientData
      return {
        userId: attachment.userId,
        username: attachment.username,
        isOnline: true,
        avatarUrl: attachment.avatarUrl,
      }
    })

    const countMsg = {
      type: 'members-count',
      groupId: this.groupId,
      count: members.length,
      members,
    }
    this.broadcast(JSON.stringify(countMsg))
  }
}
