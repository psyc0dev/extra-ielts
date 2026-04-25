import { useEffect, useRef, useState, useCallback } from 'react'

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

type WSEventHandler = (message: WSMessage) => void

export function useWebSocket(groupId: string | null) {
  const [isConnected, setIsConnected] = useState(false)
  const [memberCount, setMemberCount] = useState(0)
  const [members, setMembers] = useState<Array<{ userId: string; username: string; isOnline: boolean; avatarUrl: string | null }>>([])
  const [typingUsers, setTypingUsers] = useState<Array<{ userId: string; username: string }>>([])
  const wsRef = useRef<WebSocket | null>(null)
  const handlersRef = useRef<Set<WSEventHandler>>(new Set())
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectAttemptsRef = useRef(0)

  const connect = useCallback(() => {
    if (!groupId || wsRef.current?.readyState === WebSocket.OPEN) return

    const token = localStorage.getItem('accessToken')
    if (!token) return

    const apiBase = import.meta.env.VITE_API_BASE_URL || `${window.location.origin}/api`
    const protocol = apiBase.startsWith('https://') ? 'wss:' : 'ws:'

    let wsUrl: string
    if (apiBase.startsWith('/')) {
      wsUrl = `${protocol}//${window.location.host}${apiBase}/ws/groups/${groupId}`
    } else {
      const host = new URL(apiBase, window.location.origin).host
      wsUrl = `${protocol}//${host}/ws/groups/${groupId}`
    }

    try {
      const ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        setIsConnected(true)
        reconnectAttemptsRef.current = 0
      }

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WSMessage

          if (message.type === 'members-count') {
            setMemberCount(message.count)
            setMembers(message.members)
          } else if (message.type === 'typing-update') {
            setTypingUsers(message.typingUsers)
          }

          handlersRef.current.forEach(handler => handler(message))
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e)
        }
      }

      ws.onclose = () => {
        setIsConnected(false)
        wsRef.current = null

        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000)
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttemptsRef.current++
          connect()
        }, delay)
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        setIsConnected(false)
      }

      wsRef.current = ws
    } catch (e) {
      console.error('Failed to create WebSocket:', e)
      setIsConnected(false)
    }
  }, [groupId])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setIsConnected(false)
    setMemberCount(0)
    setMembers([])
    setTypingUsers([])
  }, [])

  const send = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
    }
  }, [])

  const on = useCallback((handler: WSEventHandler) => {
    handlersRef.current.add(handler)
    return () => {
      handlersRef.current.delete(handler)
    }
  }, [])

  useEffect(() => {
    connect()
    return () => disconnect()
  }, [groupId, connect, disconnect])

  return {
    isConnected,
    memberCount,
    members,
    typingUsers,
    send,
    on,
    disconnect,
    ws: wsRef.current,
  }
}
