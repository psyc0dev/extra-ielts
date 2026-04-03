import type { Hono } from 'hono'
import { deleteCookie } from 'hono/cookie'
import type { AppEnv } from '../lib/types'
import { createPasswordHash, nowIso, parseJson, requireAuth } from '../lib/store'
import axios from 'axios'

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
    { headers: { Authorization: `Bearer ${apiKey}` } }
  )
}

export const registerAccountRoutes = (api: Hono<AppEnv>) => {
  api.post('/account/password-reset-requests', async (c) => {
    const body = await parseJson<{ email?: string }>(c)
    if (!body?.email) return c.json({ ok: true }, 202)

    const user = await c.env.DB.prepare('SELECT id, email FROM users WHERE LOWER(email) = ?')
      .bind(body.email.toLowerCase()).first<{ id: string; email: string }>()
    if (!user) return c.json({ ok: true }, 202)

    await c.env.DB.prepare('DELETE FROM otp_tokens WHERE expires_at < ?').bind(Date.now()).run()

    const otp = String(Math.floor(100000 + Math.random() * 900000))
    const expiresAt = Date.now() + 15 * 60 * 1000
    await c.env.DB.prepare('INSERT OR REPLACE INTO otp_tokens (otp, user_id, expires_at) VALUES (?, ?, ?)')
      .bind(otp, user.id, expiresAt).run()

    try {
      await sendOtpEmail(c.env, user.email, otp)
    } catch (err) {
      console.error('[reset] failed to send OTP:', err)
      return c.json({ error: 'Failed to send reset email.' }, 500)
    }

    return c.json({ ok: true }, 202)
  })

  api.patch('/account/password', async (c) => {
    const body = await parseJson<{ otp?: string; password?: string }>(c)
    if (!body?.otp || !body.password) return c.json({ error: 'otp and password are required.' }, 400)

    const entry = await c.env.DB.prepare('SELECT user_id, expires_at FROM otp_tokens WHERE otp = ?')
      .bind(body.otp).first<{ user_id: string; expires_at: number }>()
    if (!entry || entry.expires_at < Date.now()) return c.json({ error: 'Invalid or expired code.' }, 400)

    const passwordHash = await createPasswordHash(body.password)
    await c.env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(passwordHash, entry.user_id).run()
    await c.env.DB.prepare('DELETE FROM otp_tokens WHERE otp = ?').bind(body.otp).run()

    return c.json({ ok: true }, 200)
  })

  api.put('/account/avatar', requireAuth, async (c) => {
    const body = await parseJson<{ dataUrl?: string }>(c)
    if (!body?.dataUrl) return c.json({ error: 'dataUrl is required.' }, 400)
    if (!body.dataUrl.match(/^data:image\/(png|jpeg|webp);base64,/)) {
      return c.json({ error: 'Invalid image format. Use PNG, JPEG, or WebP.' }, 400)
    }
    if (body.dataUrl.length > 700_000) return c.json({ error: 'Image too large. Max ~500KB.' }, 400)

    const user = c.get('user')
    await c.env.DB.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').bind(body.dataUrl, user.id).run()
    return c.json({ avatarUrl: body.dataUrl }, 200)
  })

  api.delete('/account', requireAuth, async (c) => {
    const user = c.get('user')
    if (user.role === 'admin') return c.json({ error: 'Admin accounts cannot be deleted.' }, 403)

    await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(user.id).run()
    deleteCookie(c, 'accessToken', { path: '/' })
    return c.json({ ok: true }, 200)
  })
}
