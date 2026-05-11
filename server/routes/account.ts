import type { Hono } from 'hono'
import { deleteCookie } from 'hono/cookie'
import { rateLimiter } from 'hono-rate-limiter'
import type { AppEnv } from '../lib/types'
import { PasswordResetRequestBodySchema, PasswordResetBodySchema, AvatarBodySchema } from '../lib/schemas'
import { createPasswordHash, nowIso, zParse, requireAuth, CacheStore } from '../lib/store'
import axios from 'axios'

const resetLimiter = rateLimiter({
  windowMs: 15 * 60_000,
  limit: 10,
  store: new CacheStore(15 * 60_000),
  keyGenerator: (c) => c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? 'unknown',
  message: { error: 'Too many attempts. Please try again later.' },
})

async function sendOtpEmail(env: AppEnv['Bindings'], to: string, otp: string) {
  const apiKey = env.RESEND_API_KEY
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured.')
  const from = env.RESEND_FROM ?? 'Extra IELTS <onboarding@resend.dev>'
  await axios.post(
    'https://api.resend.com/emails',
    {
      from,
      to: [to],
      subject: 'Your extra IELTS password reset code',
      html: `<p>Your password reset code is:</p><h2 style="letter-spacing:8px;font-size:32px">${otp}</h2><p>This code expires in 15 minutes. If you did not request this, ignore this email.</p>`,
    },
    { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 10_000 }
  )
}

export const registerAccountRoutes = (api: Hono<AppEnv>) => {
  api.post('/account/password-reset-requests', resetLimiter, async (c) => {
    const { data, error } = await zParse(PasswordResetRequestBodySchema, c)
    if (error) return c.json({ ok: true }, 202)

    const user = await c.env.DB.prepare('SELECT id, email FROM users WHERE LOWER(email) = ?')
      .bind(data.email.toLowerCase()).first<{ id: string; email: string }>()
    if (!user) return c.json({ ok: true }, 202)

    await c.env.DB.prepare('DELETE FROM otp_tokens WHERE expires_at < ?').bind(Date.now()).run()

    const ip = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? 'unknown'
    const otp = String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000))
    const expiresAt = Date.now() + 15 * 60 * 1000
    await c.env.DB.prepare('INSERT OR REPLACE INTO otp_tokens (otp, user_id, expires_at, ip) VALUES (?, ?, ?, ?)')
      .bind(otp, user.id, expiresAt, ip).run()

    try {
      await sendOtpEmail(c.env, user.email, otp)
    } catch (err) {
      console.error('[reset] failed to send OTP:', err)
      return c.json({ error: 'Failed to send reset email.' }, 500)
    }

    return c.json({ ok: true }, 202)
  })

  api.patch('/account/password', resetLimiter, async (c) => {
    const { data, error } = await zParse(PasswordResetBodySchema, c)
    if (error) return error

    const ip = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? 'unknown'

    // Check for too many failed OTP attempts from this IP
    const failedAttempts = await c.env.DB.prepare(
      'SELECT COUNT(*) as cnt FROM otp_attempts WHERE ip = ? AND attempted_at > ?'
    ).bind(ip, Date.now() - 15 * 60 * 1000).first<{ cnt: number }>()
    if (failedAttempts && failedAttempts.cnt >= 5) {
      return c.json({ error: 'Too many failed attempts. Please request a new code.' }, 429)
    }

    const entry = await c.env.DB.prepare('SELECT user_id, expires_at, ip FROM otp_tokens WHERE otp = ?')
      .bind(data.otp).first<{ user_id: string; expires_at: number; ip: string }>()
    if (!entry || entry.expires_at < Date.now() || entry.ip !== ip) {
      // Log failed attempt
      await c.env.DB.prepare('INSERT INTO otp_attempts (ip, attempted_at) VALUES (?, ?)')
        .bind(ip, Date.now()).run()
      return c.json({ error: 'Invalid or expired code.' }, 400)
    }

    const passwordHash = await createPasswordHash(data.password)
    await c.env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(passwordHash, entry.user_id).run()
    await c.env.DB.prepare('DELETE FROM otp_tokens WHERE user_id = ?').bind(entry.user_id).run()
    // Clean up attempt records for this IP
    await c.env.DB.prepare('DELETE FROM otp_attempts WHERE ip = ?').bind(ip).run()

    return c.json({ ok: true }, 200)
  })

  api.put('/account/avatar', requireAuth, async (c) => {
    const { data, error } = await zParse(AvatarBodySchema, c)
    if (error) return error
    if (data.dataUrl.length > 700_000) return c.json({ error: 'Image too large. Max ~500KB.' }, 400)

    const user = c.get('user')
    await c.env.DB.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').bind(data.dataUrl, user.id).run()
    return c.json({ avatarUrl: data.dataUrl }, 200)
  })

  api.delete('/account', requireAuth, async (c) => {
    const user = c.get('user')
    if (user.role === 'admin') return c.json({ error: 'Admin accounts cannot be deleted.' }, 403)

    await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(user.id).run()
    deleteCookie(c, 'accessToken', { path: '/' })
    return c.json({ ok: true }, 200)
  })
}
