import { createMiddleware } from 'hono/factory'
import { verifyToken } from '../lib/jwt.js'

/**
 * requireAdmin middleware — validates the Authorization Bearer JWT
 * and attaches the decoded admin payload to c.set('admin', …).
 */
export const requireAdmin = createMiddleware(async (c, next) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header.' }, 401)
  }

  const token = authHeader.slice(7)
  const payload = await verifyToken(token)

  if (!payload || payload.role !== 'admin') {
    return c.json({ error: 'Unauthorized — admin access required.' }, 403)
  }

  c.set('admin', payload)
  await next()
})
