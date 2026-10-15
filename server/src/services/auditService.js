import { query } from "../config/db.js";
import { logger } from "../utils/logger.js";

/**
 * Record an admin/moderator action.
 *
 * Never throws — a broken audit log should not break the action itself.
 * Never logs secrets: the caller is responsible for what goes into `metadata`.
 */
export async function auditLog({
  req,
  action,
  targetType = null,
  targetId = null,
  metadata = {},
}) {
  try {
    const actor = req.user || null;
    await query(
      `INSERT INTO audit_logs
         (actor_user_id, actor_email, action, target_type, target_id,
          metadata, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)`,
      [
        actor?.id ?? null,
        actor?.email ?? null,
        action,
        targetType,
        targetId != null ? String(targetId) : null,
        JSON.stringify(metadata),
        req.ip || null,
        (req.get("user-agent") || "").slice(0, 300) || null,
      ],
    );
  } catch (err) {
    logger.error(
      { err, action, targetType, targetId },
      "Audit log write failed",
    );
  }
}
