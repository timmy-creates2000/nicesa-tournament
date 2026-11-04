import { db } from '../db/client.js'
import { uuid } from './id.js'

export async function audit(action, { actorId, actorEmail, targetId, targetType, payload = {}, ipHash } = {}) {
  try {
    await db.execute({
      sql: `INSERT INTO audit_log (id, action, actor_id, actor_email, target_id, target_type, payload, ip_hash)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        uuid(), action,
        actorId    ?? null,
        actorEmail ?? null,
        targetId   ?? null,
        targetType ?? null,
        JSON.stringify(payload),
        ipHash     ?? null,
      ],
    })
  } catch (err) {
    // Audit failures should never break the main operation
    console.error('Audit log write failed:', err.message)
  }
}
