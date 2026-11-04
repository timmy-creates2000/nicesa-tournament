import { Hono } from 'hono'
import bcrypt from 'bcryptjs'
import { db } from '../db/client.js'
import { signToken, verifyToken } from '../lib/jwt.js'
import { audit } from '../lib/audit.js'
import { sha256 } from '../lib/id.js'

const router = new Hono()

// POST /auth/login
router.post('/login', async (c) => {
  const { email, password } = await c.req.json().catch(() => ({}))

  if (!email || !password) {
    return c.json({ error: 'Email and password are required.' }, 400)
  }

  const result = await db.execute({
    sql:  `SELECT id, email, password_hash FROM admin_users WHERE email = ? COLLATE NOCASE`,
    args: [email.trim()],
  })

  const admin = result.rows[0]
  if (!admin) {
    return c.json({ error: 'Invalid email or password.' }, 401)
  }

  const valid = await bcrypt.compare(password, admin.password_hash)
  if (!valid) {
    return c.json({ error: 'Invalid email or password.' }, 401)
  }

  const token = await signToken({ id: admin.id, email: admin.email, role: 'admin' })

  await audit('admin_login', {
    actorId:    admin.id,
    actorEmail: admin.email,
    ipHash:     sha256(c.req.header('x-forwarded-for') ?? 'unknown'),
  })

  return c.json({ token, admin: { id: admin.id, email: admin.email } })
})

// GET /auth/me  — validate token and return admin info
router.get('/me', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ authenticated: false }, 401)
  }
  const payload = await verifyToken(authHeader.slice(7))
  if (!payload || payload.role !== 'admin') {
    return c.json({ authenticated: false }, 401)
  }
  return c.json({ authenticated: true, admin: { id: payload.id, email: payload.email } })
})

export default router
