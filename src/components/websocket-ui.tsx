import { useEffect, useState } from 'react'
import { Circle } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'

interface TypingIndicatorProps {
  typingUsers: Array<{ userId: string; username: string }>
}

export function TypingIndicator({ typingUsers }: TypingIndicatorProps) {
  if (typingUsers.length === 0) return null

  const names = typingUsers.map(u => u.username).join(', ')
  const isPlural = typingUsers.length > 1

  return (
    <div className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground">
      <div className="flex gap-1">
        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <span>{names} {isPlural ? 'are' : 'is'} typing...</span>
    </div>
  )
}

interface MessageReactionProps {
  reactions: Map<string, Array<{ userId: string; username: string; emoji: string }>>
  onReactionClick?: (emoji: string) => void
  onAddReaction?: () => void
}

export function MessageReactions({ reactions, onReactionClick, onAddReaction }: MessageReactionProps) {
  if (reactions.size === 0 && !onAddReaction) return null

  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {Array.from(reactions.entries()).map(([emoji, users]) => (
        <button
          key={emoji}
          onClick={() => onReactionClick?.(emoji)}
          className="flex items-center gap-1 px-2 py-1 rounded-full bg-neutral-800 hover:bg-neutral-700 text-xs transition-colors"
          title={users.map(u => u.username).join(', ')}
        >
          <span>{emoji}</span>
          <span className="text-neutral-400">{users.length}</span>
        </button>
      ))}
      {onAddReaction && (
        <button
          onClick={onAddReaction}
          className="flex items-center gap-1 px-2 py-1 rounded-full bg-neutral-800 hover:bg-neutral-700 text-xs transition-colors"
          title="Add reaction"
        >
          <span>➕</span>
        </button>
      )}
    </div>
  )
}

interface MemberListProps {
  members: Array<{ userId: string; username: string; isOnline: boolean; avatarUrl: string | null }>
}

export function MemberList({ members }: MemberListProps) {
  const onlineMembers = members.filter(m => m.isOnline)
  const offlineMembers = members.filter(m => !m.isOnline)

  return (
    <div className="space-y-4">
      {onlineMembers.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground mb-2">ONLINE ({onlineMembers.length})</h3>
          <div className="space-y-1">
            {onlineMembers.map(member => (
              <div key={member.userId} className="flex items-center gap-2 text-sm px-2 py-1 rounded hover:bg-neutral-800 transition-colors">
                <Circle weight="fill" className="size-2 text-green-500" />
                <span className="text-neutral-200">{member.username}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {offlineMembers.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground mb-2">OFFLINE ({offlineMembers.length})</h3>
          <div className="space-y-1">
            {offlineMembers.map(member => (
              <div key={member.userId} className="flex items-center gap-2 text-sm px-2 py-1 rounded hover:bg-neutral-800 transition-colors opacity-50">
                <Circle weight="fill" className="size-2 text-neutral-600" />
                <span className="text-neutral-400">{member.username}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

interface ReadReceiptsProps {
  readers: Array<{ userId: string; username: string; readAt: string }>
}

export function ReadReceipts({ readers }: ReadReceiptsProps) {
  if (readers.length === 0) return null

  return (
    <div className="text-[10px] text-neutral-500 mt-1">
      Seen by {readers.map(r => r.username).join(', ')}
    </div>
  )
}

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void
  isOpen: boolean
}

const EMOJI_LIST = ['👍', '❤️', '😂', '😮', '😢', '🔥', '✨', '🎉', '👏', '🙏', '💯', '⭐']

export function EmojiPicker({ onEmojiSelect, isOpen }: EmojiPickerProps) {
  if (!isOpen) return null

  return (
    <div className="absolute bottom-full mb-2 left-0 bg-neutral-800 rounded-lg border border-neutral-700 p-2 shadow-lg grid grid-cols-4 gap-1 w-48">
      {EMOJI_LIST.map((emoji) => (
        <button
          key={emoji}
          onClick={() => {
            onEmojiSelect(emoji)
          }}
          className="p-2 hover:bg-neutral-700 rounded text-lg transition-colors"
        >
          {emoji}
        </button>
      ))}
    </div>
  )
}
