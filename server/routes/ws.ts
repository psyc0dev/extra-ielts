import type { Hono } from 'hono'
import type { AppEnv } from '../lib/types'
import { requireAuth } from '../lib/store'

export const registerWSRoutes = (api: Hono<AppEnv>) => {
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
    await stub.fetch(new Request('https://placeholder.local/broadcast', {
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
    await stub.fetch(new Request('https://placeholder.local/broadcast', {
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
