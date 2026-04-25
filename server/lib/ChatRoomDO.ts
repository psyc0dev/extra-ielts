import type { Bindings } from './types'

export class ChatRoomDO {
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

    const url = new URL(request.url)
    const userId = url.searchParams.get('userId')
    if (userId) {
      server.serializeAttachment({ userId })
    }

    return new Response(null, {
      status: 101,
      webSocket: client,
    })
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    // Broadcast incoming client message to all OTHER connected clients
    const clients = this.state.getWebSockets()
    for (const client of clients) {
      if (client !== ws) {
        try {
          client.send(message)
        } catch {
          // Client might be disconnected
        }
      }
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
    // Connection closed — nothing to do, hibernation handles cleanup
  }

  async webSocketError(ws: WebSocket, error: unknown) {
    // Error occurred — nothing to do
  }
}
