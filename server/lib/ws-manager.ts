// WebSocket connection manager with presence tracking
export type WSMessage =
  | { type: 'user-joined'; userId: string; username: string; groupId: string; timestamp: string }
  | { type: 'user-left'; userId: string; groupId: string; timestamp: string }
  | { type: 'members-count'; groupId: string; count: number; members: Array<{ userId: string; username: string; isOnline: boolean; avatarUrl: string | null }> }
  | { type: 'message'; id: string; groupId: string; userId: string; username: string; avatarUrl: string | null; content: string; imageUrl: string | null; timestamp: string }
  | { type: 'typing'; userId: string; username: string; groupId: string; isTyping: boolean }
  | { type: 'typing-update'; groupId: string; typingUsers: Array<{ userId: string; username: string }> }
  | { type: 'reaction'; messageId: string; userId: string; username: string; emoji: string; action: 'add' | 'remove'; timestamp: string }
  | { type: 'read-receipt'; messageId: string; userId: string; username: string; timestamp: string }
  | { type: 'read-receipts'; messageId: string; readers: Array<{ userId: string; username: string; readAt: string }> }
  | { type: 'assignment-created'; assignmentId: string; title: string; testId: string; dueAt: string | null }
  | { type: 'assignment-submitted'; userId: string; assignmentId: string; status: string }
  | { type: 'error'; message: string }

type ConnectionHandler = {
  userId: string
  username: string
  avatarUrl: string | null
  groupId: string
  ws: WebSocket
  typingTimeout?: ReturnType<typeof setTimeout>
}

export class WSManager {
  private connections = new Map<string, ConnectionHandler[]>() // groupId -> connections
  private userPresence = new Map<string, Set<string>>() // groupId -> Set of userIds currently online
  private typingUsers = new Map<string, Set<string>>() // groupId -> Set of userIds currently typing
  private messageReactions = new Map<string, Map<string, Array<{ userId: string; username: string; emoji: string }>>>() // messageId -> emoji -> users
  private messageReadReceipts = new Map<string, Set<string>>() // messageId -> Set of userIds who read

  getGroupConnections(groupId: string): ConnectionHandler[] {
    return this.connections.get(groupId) ?? []
  }

  addConnection(groupId: string, userId: string, username: string, avatarUrl: string | null, ws: WebSocket) {
    if (!this.connections.has(groupId)) {
      this.connections.set(groupId, [])
      this.userPresence.set(groupId, new Set())
      this.typingUsers.set(groupId, new Set())
    }

    this.connections.get(groupId)!.push({ userId, username, avatarUrl, groupId, ws })
    this.userPresence.get(groupId)!.add(userId)

    return { success: true }
  }

  removeConnection(groupId: string, ws: WebSocket) {
    const connections = this.connections.get(groupId) ?? []
    const idx = connections.findIndex(c => c.ws === ws)
    if (idx !== -1) {
      const removed = connections.splice(idx, 1)[0]

      // Clear any typing state
      if (removed.typingTimeout) {
        clearTimeout(removed.typingTimeout)
      }
      this.typingUsers.get(groupId)?.delete(removed.userId)

      // Check if this was the user's last connection in this group
      const hasOtherConnections = connections.some(c => c.userId === removed.userId)
      if (!hasOtherConnections) {
        this.userPresence.get(groupId)?.delete(removed.userId)
      }

      return removed
    }
    return null
  }

  broadcast(groupId: string, message: WSMessage, excludeWs?: WebSocket) {
    const connections = this.connections.get(groupId) ?? []
    const payload = JSON.stringify(message)

    for (const conn of connections) {
      if (excludeWs && conn.ws === excludeWs) continue
      try {
        conn.ws.send(payload)
      } catch (e) {
        // Connection may be closed
      }
    }
  }

  broadcastToAll(message: WSMessage) {
    for (const [groupId] of this.connections) {
      this.broadcast(groupId, message)
    }
  }

  getGroupMembers(groupId: string): Array<{ userId: string; username: string; isOnline: boolean; avatarUrl: string | null }> {
    const onlineSet = this.userPresence.get(groupId) ?? new Set()
    const connections = this.connections.get(groupId) ?? []

    const uniqueUsers = new Map<string, { userId: string; username: string; avatarUrl: string | null }>()
    for (const conn of connections) {
      if (!uniqueUsers.has(conn.userId)) {
        uniqueUsers.set(conn.userId, { userId: conn.userId, username: conn.username, avatarUrl: conn.avatarUrl })
      }
    }

    return Array.from(uniqueUsers.values()).map(u => ({
      ...u,
      isOnline: onlineSet.has(u.userId)
    }))
  }

  getMemberCount(groupId: string): number {
    return this.userPresence.get(groupId)?.size ?? 0
  }

  setTyping(groupId: string, userId: string) {
    const typingSet = this.typingUsers.get(groupId)
    if (typingSet) {
      typingSet.add(userId)
    }
  }

  clearTyping(groupId: string, userId: string) {
    const typingSet = this.typingUsers.get(groupId)
    if (typingSet) {
      typingSet.delete(userId)
    }
  }

  getTypingUsers(groupId: string): Array<{ userId: string; username: string }> {
    const typingSet = this.typingUsers.get(groupId) ?? new Set()
    const connections = this.connections.get(groupId) ?? []

    const result: Array<{ userId: string; username: string }> = []
    for (const conn of connections) {
      if (typingSet.has(conn.userId) && !result.some(u => u.userId === conn.userId)) {
        result.push({ userId: conn.userId, username: conn.username })
      }
    }
    return result
  }

  addReaction(messageId: string, userId: string, username: string, emoji: string) {
    if (!this.messageReactions.has(messageId)) {
      this.messageReactions.set(messageId, new Map())
    }

    const reactions = this.messageReactions.get(messageId)!
    if (!reactions.has(emoji)) {
      reactions.set(emoji, [])
    }

    const emojiList = reactions.get(emoji)!
    if (!emojiList.some(r => r.userId === userId)) {
      emojiList.push({ userId, username, emoji })
    }
  }

  removeReaction(messageId: string, userId: string, emoji: string) {
    const reactions = this.messageReactions.get(messageId)
    if (!reactions) return

    const emojiList = reactions.get(emoji)
    if (emojiList) {
      const idx = emojiList.findIndex(r => r.userId === userId)
      if (idx !== -1) {
        emojiList.splice(idx, 1)
      }
      if (emojiList.length === 0) {
        reactions.delete(emoji)
      }
    }
    if (reactions.size === 0) {
      this.messageReactions.delete(messageId)
    }
  }

  getReactions(messageId: string): Map<string, Array<{ userId: string; username: string; emoji: string }>> {
    return this.messageReactions.get(messageId) ?? new Map()
  }

  markAsRead(messageId: string, userId: string) {
    if (!this.messageReadReceipts.has(messageId)) {
      this.messageReadReceipts.set(messageId, new Set())
    }
    this.messageReadReceipts.get(messageId)!.add(userId)
  }

  getReadReceipts(messageId: string): Set<string> {
    return this.messageReadReceipts.get(messageId) ?? new Set()
  }

  cleanupGroup(groupId: string) {
    this.connections.delete(groupId)
    this.userPresence.delete(groupId)
    this.typingUsers.delete(groupId)
  }

  cleanup() {
    this.connections.clear()
    this.userPresence.clear()
    this.typingUsers.clear()
    this.messageReactions.clear()
    this.messageReadReceipts.clear()
  }
}

export const globalWSManager = new WSManager()
