# WebSocket Implementation Guide

## Overview

This implementation adds real-time WebSocket support for faster information handling with:
- **Real-time chat messaging** in group channels
- **Live member count & online status** tracking
- **User presence indicators** (who's online)
- **Typing indicators** (coming soon - structure in place)
- **Real-time assignment notifications** (structure for broadcasts)
- **Automatic reconnection** with exponential backoff

## Architecture

### Backend Components

#### 1. **WebSocket Manager** (`server/lib/ws-manager.ts`)
- Manages all active WebSocket connections per group
- Tracks user presence (online/offline status)
- Handles broadcasting messages to connected clients
- Provides utilities for getting member counts and member lists

**Key Methods:**
- `addConnection()` - Add a user to a group channel
- `removeConnection()` - Remove a user and update presence
- `broadcast()` - Send message to all users in a group
- `getGroupMembers()` - Get list of online/offline members
- `getMemberCount()` - Get count of online users

#### 2. **WebSocket Routes** (`server/routes/ws.ts`)
Registers the following endpoints:

**GET `/ws/groups/:groupId`**
- Upgrades HTTP to WebSocket
- Requires authentication via `requireAuth` middleware
- Verifies user is a group member
- Broadcasts user join/leave events
- Sends current member list to all clients
- Handles incoming messages and typing indicators

**POST `/ws/broadcast/assignment`**
- Broadcasts new assignment creation to group
- Called from admin routes after creating assignments

**POST `/ws/broadcast/submission`**
- Broadcasts assignment submission status to group
- Called from assignment routes after submission

**GET `/groups/:groupId/members-online`**
- HTTP fallback endpoint to get current online members
- Useful if WebSocket connection is unavailable

### Frontend Components

#### 1. **WebSocket Hook** (`src/hooks/use-websocket.ts`)

```typescript
const ws = useWebSocket(groupId)

// Returns:
{
  isConnected: boolean              // Connection status
  memberCount: number               // Online member count
  members: Array<{...}>             // List of members with online status
  send: (msg) => void               // Send message to server
  on: (handler) => unsubscribe      // Listen to messages
  disconnect: () => void            // Manually disconnect
  ws: WebSocket | null              // Raw WebSocket reference
}
```

#### 2. **Updated Groups Page** (`src/pages/groups.tsx`)

Features:
- Displays live online member count with green indicator
- Shows total member count
- Real-time message delivery via WebSocket
- Automatic reconnection on connection loss
- Typing indicators (structure in place for UI)

## Message Types

```typescript
// User events
{ type: 'user-joined', userId, username, groupId, timestamp }
{ type: 'user-left', userId, groupId, timestamp }

// Member updates
{ type: 'members-count', groupId, count, members: [{userId, username, isOnline}] }

// Chat
{ type: 'message', id, groupId, userId, username, avatarUrl, content, imageUrl, timestamp }
{ type: 'typing', userId, username, groupId, isTyping }

// Assignments
{ type: 'assignment-created', assignmentId, title, testId, dueAt }
{ type: 'assignment-submitted', userId, assignmentId, status }
```

## Setup Steps

### 1. Database Schema (Already exists)
The following tables are required:
- `group_members` - Track user membership in groups
- `groups` - Group information
- `users` - User data

### 2. Backend Integration
- ✅ Added `server/lib/ws-manager.ts` - Connection management
- ✅ Added `server/routes/ws.ts` - WebSocket routes
- ✅ Updated `server/app.ts` - Register WebSocket routes
- ✅ Uses existing Hono middleware for auth

### 3. Frontend Integration
- ✅ Created `src/hooks/use-websocket.ts` - React hook
- ✅ Updated `src/pages/groups.tsx` - Uses WebSocket for real-time updates
- ✅ Added member count display with online indicator

## Connection Flow

1. **Frontend**: User connects to `/ws/groups/:groupId`
2. **Backend**: `requireAuth` middleware verifies JWT token from Authorization header
3. **Backend**: Bun upgrades HTTP to WebSocket
4. **Backend**: User added to connection manager
5. **Backend**: Broadcasts user join event + updated member list
6. **Frontend**: Listens for member-count message, updates UI
7. **On disconnect**: Broadcasts user left event + updated member list

## Usage Examples

### Sending a Message
```typescript
const ws = useWebSocket(groupId)

ws.on((message) => {
  if (message.type === 'message') {
    console.log(`${message.username}: ${message.content}`)
  } else if (message.type === 'members-count') {
    console.log(`Online: ${message.count}/${message.members.length}`)
  }
})

ws.send({
  type: 'message',
  groupId,
  userId: 'user123',
  username: 'john',
  avatarUrl: null,
  content: 'Hello!',
  imageUrl: null,
  timestamp: new Date().toISOString(),
})
```

### Monitoring Connection Status
```typescript
const ws = useWebSocket(groupId)

useEffect(() => {
  if (ws.isConnected) {
    console.log(`Connected! ${ws.members.filter(m => m.isOnline).length} online`)
  }
}, [ws.isConnected, ws.members])
```

## Performance & Scalability

### Current Implementation
- **In-memory storage** (per process) - suitable for single instance
- **No persistence** - messages not saved (relies on database for history)
- **Per-group connection tracking** - efficient message distribution

### Scaling for Production

To scale to multiple instances, consider:

1. **Shared State Layer**
   - Redis for presence tracking across instances
   - Redis pub/sub for broadcasting between instances
   - Room/namespace management with Redis adapter

2. **Example with Redis**:
```typescript
// Broadcast to all instances of a group
redis.publish(`group:${groupId}`, JSON.stringify(message))
```

3. **Persistence**
   - Save messages to database before broadcasting
   - Archive old messages separately
   - Implement message deduplication on reconnect

## Error Handling

- **Connection failures**: Automatic reconnection with exponential backoff (1s → 2s → 4s → ... → 30s max)
- **Auth failures**: Rejected by middleware, user must re-login
- **Group membership**: Verified before upgrade, returns 403 Forbidden
- **WebSocket protocol errors**: Logged to console, connection closes gracefully

## Future Enhancements

1. **Typing Indicators**
   - Show "user is typing..." in real-time
   - Debounced updates to reduce message volume

2. **Message Read Receipts**
   - Track who has read messages
   - Show delivery status

3. **File Sharing**
   - Direct file transfer via WebSocket
   - Large file chunking support

4. **Voice/Video**
   - WebRTC signaling via WebSocket
   - Screen sharing

5. **Reactions & Emoji**
   - Real-time emoji reactions to messages
   - Message editing notifications

## Testing

### Local Testing
```bash
# Start backend
bun run dev:api

# Open frontend in two browser tabs
# Both connect to same group
# Send message from one tab
# Should appear instantly in other tab

# Check member count updates in header
# When disconnecting one tab, member count decreases
# When reconnecting, member count increases
```

### WebSocket Debugging
- Chrome DevTools: Network tab → WS filter
- Look for "ws://localhost:8787/api/ws/groups/..."
- Messages tab shows all sent/received frames
- Server output shows connections/disconnections

## Configuration

### Environment Variables
None required - uses existing `VITE_API_BASE_URL` for frontend

### Backend Constants
Edit `server/lib/ws-manager.ts` to configure:
- Connection limits per group
- Message rate limiting
- Presence timeout (when to mark as offline)

## Security Considerations

✅ **Authentication**: All WebSocket connections require valid JWT
✅ **Authorization**: Group membership verified before connection
✅ **Message validation**: Type checking on incoming messages
✅ **XSS Prevention**: Messages rendered safely in React (no innerHTML)

⚠️ **TODO**: Add message content sanitization for user-generated content
⚠️ **TODO**: Implement rate limiting per user/group
⚠️ **TODO**: Add audit logging for sensitive actions
