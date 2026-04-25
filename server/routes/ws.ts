import type { Hono } from 'hono'
import type { AppEnv } from '../lib/types'
import { requireAuth } from '../lib/store'
import { globalWSManager, type WSMessage } from '../lib/ws-manager'
import { sanitizeMessage, sanitizeUsername, sanitizeEmoji } from '../lib/sanitize'
import { messageLimiter, typingLimiter, reactionLimiter, readReceiptLimiter } from '../lib/rate-limiter'

export const registerWSRoutes = (api: Hono<AppEnv>) => {
  // WebSocket connection endpoint
  api.get('/ws/groups/:groupId', requireAuth, async (c) => {
    const groupId = c.req.param('groupId')
    const user = c.get('user')
    const userId = user.id
    const username = sanitizeUsername(user.username)
    const avatarUrl = user.avatarUrl ?? null

    const upgrade = c.req.header('upgrade')
    if (!upgrade?.toLowerCase().includes('websocket')) {
      return c.text('Expected Upgrade: websocket', 426)
    }

    // Verify user is member of group
    const groupMember = await c.env.DB.prepare(
      'SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ? LIMIT 1'
    ).bind(groupId, userId).first()

    if (!groupMember) {
      return c.text('Not a group member', 403)
    }

    // Upgrade to WebSocket using Bun's upgrade
    const { socket, response } = (Bun as any).upgrade(c.req.raw, { data: { groupId, userId, username, avatarUrl } })

    globalWSManager.addConnection(groupId, userId, username, avatarUrl, socket)

    // Notify others of user joining
    const joinMsg: WSMessage = {
      type: 'user-joined',
      userId,
      username,
      groupId,
      timestamp: new Date().toISOString(),
    }
    globalWSManager.broadcast(groupId, joinMsg, socket)

    // Send current member count to all clients
    const members = globalWSManager.getGroupMembers(groupId)
    const countMsg: WSMessage = {
      type: 'members-count',
      groupId,
      count: members.length,
      members,
    }
    globalWSManager.broadcast(groupId, countMsg)

    // Connection handlers
    socket.onMessage((message: any) => {
      try {
        const data = JSON.parse(message.toString())

        if (data.type === 'message') {
          // Rate limit messages
          if (!messageLimiter.check(userId, groupId, 'message')) {
            socket.send(JSON.stringify({ type: 'error', message: 'Message rate limit exceeded' }))
            return
          }

          // Sanitize content
          const sanitized = sanitizeMessage(data.content)
          if (!sanitized) return

          // Relay message to all clients
          const msg: WSMessage = {
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
          globalWSManager.broadcast(groupId, msg)
        } else if (data.type === 'typing') {
          // Rate limit typing events
          if (!typingLimiter.check(userId, groupId, 'typing')) {
            return
          }

          const isTyping = data.isTyping ?? false
          if (isTyping) {
            globalWSManager.setTyping(groupId, userId)
          } else {
            globalWSManager.clearTyping(groupId, userId)
          }

          // Broadcast current typing users
          const typingUsers = globalWSManager.getTypingUsers(groupId)
          const typingMsg: WSMessage = {
            type: 'typing-update',
            groupId,
            typingUsers,
          }
          globalWSManager.broadcast(groupId, typingMsg)
        } else if (data.type === 'reaction') {
          // Rate limit reactions
          if (!reactionLimiter.check(userId, groupId, 'reaction')) {
            socket.send(JSON.stringify({ type: 'error', message: 'Reaction rate limit exceeded' }))
            return
          }

          const messageId = data.messageId
          const emoji = sanitizeEmoji(data.emoji)
          const action = data.action // 'add' or 'remove'

          if (!messageId || !emoji) return

          if (action === 'add') {
            globalWSManager.addReaction(messageId, userId, username, emoji)
          } else if (action === 'remove') {
            globalWSManager.removeReaction(messageId, userId, emoji)
          }

          // Broadcast reaction update
          const reactionMsg: WSMessage = {
            type: 'reaction',
            messageId,
            userId,
            username,
            emoji,
            action,
            timestamp: new Date().toISOString(),
          }
          globalWSManager.broadcast(groupId, reactionMsg)
        } else if (data.type === 'read-receipt') {
          // Rate limit read receipts
          if (!readReceiptLimiter.check(userId, groupId, 'read-receipt')) {
            return
          }

          const messageId = data.messageId
          if (!messageId) return

          globalWSManager.markAsRead(messageId, userId)

          // Broadcast read receipt
          const readMsg: WSMessage = {
            type: 'read-receipt',
            messageId,
            userId,
            username,
            timestamp: new Date().toISOString(),
          }
          globalWSManager.broadcast(groupId, readMsg)
        }
      } catch (e) {
        // Invalid message format - ignore
      }
    })

    socket.onClose(() => {
      const removed = globalWSManager.removeConnection(groupId, socket)
      if (removed) {
        // Notify others of user leaving
        const leftMsg: WSMessage = {
          type: 'user-left',
          userId: removed.userId,
          groupId,
          timestamp: new Date().toISOString(),
        }
        globalWSManager.broadcast(groupId, leftMsg)

        // Send updated member count
        const members = globalWSManager.getGroupMembers(groupId)
        const countMsg: WSMessage = {
          type: 'members-count',
          groupId,
          count: members.length,
          members,
        }
        globalWSManager.broadcast(groupId, countMsg)
      }
    })

    socket.onError((error: any) => {
      console.error('WebSocket error:', error)
      globalWSManager.removeConnection(groupId, socket)
    })

    return response
  })

  // Endpoint to broadcast assignment creation (called from admin routes)
  api.post('/ws/broadcast/assignment', requireAuth, async (c) => {
    const body = await c.req.json<{ groupId: string; assignmentId: string; title: string; testId: string; dueAt: string | null }>()

    const msg: WSMessage = {
      type: 'assignment-created',
      assignmentId: body.assignmentId,
      title: body.title,
      testId: body.testId,
      dueAt: body.dueAt,
    }

    globalWSManager.broadcast(body.groupId, msg)
    return c.json({ ok: true })
  })

  // Endpoint to broadcast assignment submission (called from assignment routes)
  api.post('/ws/broadcast/submission', requireAuth, async (c) => {
    const body = await c.req.json<{ groupId: string; userId: string; assignmentId: string; status: string }>()

    const msg: WSMessage = {
      type: 'assignment-submitted',
      userId: body.userId,
      assignmentId: body.assignmentId,
      status: body.status,
    }

    globalWSManager.broadcast(body.groupId, msg)
    return c.json({ ok: true })
  })

  // Get current online member count for a group (HTTP fallback)
  api.get('/groups/:groupId/members-online', requireAuth, async (c) => {
    const groupId = c.req.param('groupId')
    const user = c.get('user')

    // Verify user is member of group
    const member = await c.env.DB.prepare(
      'SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ? LIMIT 1'
    ).bind(groupId, user.id).first()

    if (!member) {
      return c.json({ error: 'Not a group member' }, 403)
    }

    const count = globalWSManager.getMemberCount(groupId)
    const members = globalWSManager.getGroupMembers(groupId)

    return c.json({ count, members })
  })
}
