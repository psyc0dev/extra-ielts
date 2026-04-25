import type { Hono } from 'hono'
import type { AppEnv } from '../lib/types'
import { verify } from 'hono/jwt'
import { requireAuth } from '../lib/store'
import { sanitizeUsername } from '../lib/sanitize'

export const registerWSRoutes = (api: Hono<AppEnv>) => {
  // WebSocket connection endpoint - use Durable Objects for Cloudflare Workers compatibility
  api.get('/ws/groups/:groupId', async (c) => {
    const groupId = c.req.param('groupId')

    // Extract JWT from Authorization header or cookies
    let token = null
    const authHeader = c.req.header('Authorization')
    if (authHeader?.toLowerCase().startsWith('bearer ')) {
      token = authHeader.slice(7).trim()
    }
    if (!token) {
      // Try to get from cookie
      const cookieHeader = c.req.header('Cookie')
      if (cookieHeader) {
        const cookies = cookieHeader.split(';').map(c => c.trim())
        for (const cookie of cookies) {
          if (cookie.startsWith('accessToken=')) {
            token = cookie.slice('accessToken='.length)
            break
          }
        }
      }
    }

    if (!token) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    // Verify token
    let user
    try {
      const secret = (c.env as any).JWT_SECRET || 'default_secret_for_development'
      const payload = await verify(token, secret, 'HS256')
      const userId = payload.userId as string

      // Get user from database
      const userRow = await c.env.DB.prepare(
        'SELECT id, username, email, role, avatar_url FROM users WHERE id = ? LIMIT 1'
      ).bind(userId).first<any>()

      if (!userRow) {
        return c.json({ error: 'Unauthorized' }, 401)
      }

      user = {
        id: userRow.id,
        username: userRow.username,
        avatarUrl: userRow.avatar_url
      }
    } catch (e) {
      console.error('Auth error:', e)
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const userId = user.id
    const username = sanitizeUsername(user.username)
    const avatarUrl = user.avatarUrl ?? null

    // Verify user is member of group
    const groupMember = await c.env.DB.prepare(
      'SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ? LIMIT 1'
    ).bind(groupId, userId).first()

    if (!groupMember) {
      return c.json({ error: 'Not a group member' }, 403)
    }

    // Proxy to Durable Object with authentication info
    const doId = (c.env as any).CHAT_ROOM.idFromName(groupId)
    const stub = (c.env as any).CHAT_ROOM.get(doId)

    const url = new URL(c.req.url)
    url.searchParams.set('userId', userId)
    url.searchParams.set('username', username)
    url.searchParams.set('avatarUrl', avatarUrl)

    return stub.fetch(new Request(url, {
      method: c.req.method,
      headers: c.req.raw.headers,
    }))
  })

  // Endpoint to broadcast assignment creation (called from admin routes)
  api.post('/ws/broadcast/assignment', requireAuth, async (c) => {
    const body = await c.req.json<{ groupId: string; assignmentId: string; title: string; testId: string; dueAt: string | null }>()

    const msg = {
      type: 'assignment-created',
      assignmentId: body.assignmentId,
      title: body.title,
      testId: body.testId,
      dueAt: body.dueAt,
    }

    const doId = (c.env as any).CHAT_ROOM.idFromName(body.groupId)
    const stub = (c.env as any).CHAT_ROOM.get(doId)
    await stub.fetch(new Request(`${c.req.url}api/ws/broadcast`, {
      method: 'POST',
      body: JSON.stringify(msg),
    }))

    return c.json({ ok: true })
  })

  // Endpoint to broadcast assignment submission (called from assignment routes)
  api.post('/ws/broadcast/submission', requireAuth, async (c) => {
    const body = await c.req.json<{ groupId: string; userId: string; assignmentId: string; status: string }>()

    const msg = {
      type: 'assignment-submitted',
      userId: body.userId,
      assignmentId: body.assignmentId,
      status: body.status,
    }

    const doId = (c.env as any).CHAT_ROOM.idFromName(body.groupId)
    const stub = (c.env as any).CHAT_ROOM.get(doId)
    await stub.fetch(new Request(`${c.req.url}api/ws/broadcast`, {
      method: 'POST',
      body: JSON.stringify(msg),
    }))

    return c.json({ ok: true })
  })

  // WebSocket connection test endpoint
  api.get('/ws/test', requireAuth, async (c) => {
    const user = c.get('user')
    console.log('[WS] Test endpoint called by user:', user.id)
    return c.json({
      ok: true,
      message: 'WebSocket test endpoint working',
      userId: user.id,
      username: user.username,
      timestamp: new Date().toISOString()
    })
  })
}
