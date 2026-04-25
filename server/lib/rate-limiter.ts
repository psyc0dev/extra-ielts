// Rate limiter for WebSocket events per user per group
export class RateLimiter {
  private limits = new Map<string, { count: number; resetAt: number }>()

  constructor(private maxRequests: number, private windowMs: number) {}

  private getKey(userId: string, groupId: string, type: string): string {
    return `${groupId}:${userId}:${type}`
  }

  check(userId: string, groupId: string, type: string): boolean {
    const key = this.getKey(userId, groupId, type)
    const now = Date.now()

    const existing = this.limits.get(key)
    if (!existing || now >= existing.resetAt) {
      // First request or window expired
      this.limits.set(key, { count: 1, resetAt: now + this.windowMs })
      return true
    }

    // Check if under limit
    if (existing.count < this.maxRequests) {
      existing.count++
      return true
    }

    return false
  }

  reset(userId: string, groupId: string, type?: string): void {
    if (type) {
      const key = this.getKey(userId, groupId, type)
      this.limits.delete(key)
    } else {
      // Reset all for user in group
      for (const [key] of this.limits) {
        if (key.startsWith(`${groupId}:${userId}:`)) {
          this.limits.delete(key)
        }
      }
    }
  }

  cleanup(): void {
    const now = Date.now()
    for (const [key, value] of this.limits) {
      if (now >= value.resetAt) {
        this.limits.delete(key)
      }
    }
  }
}

// Create global rate limiters for different event types
export const messageLimiter = new RateLimiter(10, 1000) // 10 messages per second
export const typingLimiter = new RateLimiter(3, 500) // 3 typing events per 500ms
export const reactionLimiter = new RateLimiter(20, 1000) // 20 reactions per second
export const readReceiptLimiter = new RateLimiter(30, 1000) // 30 read receipts per second

// Cleanup rate limiters periodically
setInterval(() => {
  messageLimiter.cleanup()
  typingLimiter.cleanup()
  reactionLimiter.cleanup()
  readReceiptLimiter.cleanup()
}, 60000) // Every minute
