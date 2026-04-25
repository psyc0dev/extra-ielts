// Simple HTML sanitization - removes dangerous tags and attributes
export function sanitizeMessage(content: string): string {
  if (typeof content !== 'string') return ''

  // Remove script tags and their content
  let sanitized = content.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')

  // Remove event handlers
  sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
  sanitized = sanitized.replace(/on\w+\s*=\s*[^\s>]*/gi, '')

  // Remove dangerous tags: iframe, object, embed, form, input, etc.
  const dangerousTags = ['iframe', 'object', 'embed', 'form', 'input', 'button', 'style']
  for (const tag of dangerousTags) {
    const regex = new RegExp(`<${tag}\\b[^<]*(?:(?!<\\/${tag}>)<[^<]*)*<\\/${tag}>`, 'gi')
    sanitized = sanitized.replace(regex, '')
  }

  // Remove javascript: protocol
  sanitized = sanitized.replace(/javascript:/gi, '')

  // Limit length to prevent DoS
  const MAX_LENGTH = 5000
  if (sanitized.length > MAX_LENGTH) {
    sanitized = sanitized.substring(0, MAX_LENGTH)
  }

  return sanitized.trim()
}

export function sanitizeUsername(username: string): string {
  if (typeof username !== 'string') return 'Unknown'
  return username.substring(0, 50).trim()
}

export function sanitizeEmoji(emoji: string): string {
  // Allow only emoji characters and basic unicode
  if (typeof emoji !== 'string' || emoji.length === 0) return ''
  // Simple emoji validation - emoji are usually multiple bytes
  return emoji.substring(0, 10)
}
