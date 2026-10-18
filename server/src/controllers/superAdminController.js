import { query } from "../config/db.js";
import { auditLog } from "../services/auditService.js";
import { logger } from "../utils/logger.js";

// ---------------------------------------------------------------------------
// Role Management
// ---------------------------------------------------------------------------

export async function showRoleManagement(req, res, next) {
  try {
    // Fetch all users who have admin or super_admin, plus all normal members
    const { rows: admins } = await query(
      `SELECT u.id, u.email, mp.first_name, mp.last_name, r.name AS role
         FROM users u
         JOIN member_profiles mp ON mp.user_id = u.id
         JOIN user_roles ur ON ur.user_id = u.id
         JOIN roles r ON r.id = ur.role_id
        WHERE r.name IN ('admin', 'super_admin')
        ORDER BY r.name DESC, mp.first_name ASC`,
    );

    const { rows: members } = await query(
      `SELECT u.id, u.email, mp.first_name, mp.last_name
         FROM users u
         JOIN member_profiles mp ON mp.user_id = u.id
        WHERE u.status = 'active'
          AND NOT EXISTS (
            SELECT 1 FROM user_roles ur
              JOIN roles r ON r.id = ur.role_id
             WHERE ur.user_id = u.id AND r.name IN ('admin', 'super_admin')
          )
        ORDER BY mp.first_name ASC
        LIMIT 100`,
    );

    res.render("super/roles", {
      title: "Role Management — Super Admin",
      layout: "layouts/app",
      admins,
      members,
    });
  } catch (err) {
    next(err);
  }
}

export async function actionChangeRole(req, res, next) {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!["admin", "member"].includes(role)) {
      req.flash("error", "Invalid role.");
      return res.redirect("/super/roles");
    }

    // Don't let a super admin demote themselves
    if (id === req.user.id && role === "member") {
      req.flash("error", "You cannot remove your own super_admin privileges.");
      return res.redirect("/super/roles");
    }

    // Remove existing admin/super_admin roles (but keep 'member')
    await query(
      `DELETE FROM user_roles
        WHERE user_id = $1
          AND role_id IN (SELECT id FROM roles WHERE name IN ('admin', 'super_admin'))`,
      [id],
    );

    // Add the new role if it's admin (members don't need an explicit role row if they just have 'member')
    if (role === "admin") {
      await query(
        `INSERT INTO user_roles (user_id, role_id)
         SELECT $1, id FROM roles WHERE name = 'admin'
         ON CONFLICT DO NOTHING`,
        [id],
      );
    }

    await auditLog({
      req,
      action: "role.change",
      targetType: "user",
      targetId: id,
      metadata: { newRole: role },
    });

    req.flash("success", `User role updated to ${role}.`);
    res.redirect("/super/roles");
  } catch (err) {
    logger.error({ err }, "Failed to change role");
    next(err);
  }
}

// ---------------------------------------------------------------------------
// System Health
// ---------------------------------------------------------------------------

export async function showSystemHealth(req, res, next) {
  try {
    const dbStatus = await query("SELECT NOW() AS now");
    const dbTime = dbStatus.rows[0].now;

    const userCount = await query("SELECT COUNT(*)::int AS n FROM users");
    const storyCount = await query("SELECT COUNT(*)::int AS n FROM stories");
    const eventCount = await query("SELECT COUNT(*)::int AS n FROM events");

    const stats = {
      dbTime,
      users: userCount.rows[0].n,
      stories: storyCount.rows[0].n,
      events: eventCount.rows[0].n,
      nodeVersion: process.version,
      uptime: Math.round(process.uptime()),
      memory: Math.round(process.memoryUsage().rss / 1024 / 1024) + " MB",
    };

    res.render("super/health", {
      title: "System Health — Super Admin",
      layout: "layouts/app",
      stats,
    });
  } catch (err) {
    next(err);
  }
}
