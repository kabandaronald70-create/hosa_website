import { query } from "../config/db.js";

export async function getLeadershipRoles() {
  const { rows } = await query(
    `SELECT 
        lr.id, lr.office_title, lr.category, lr.term_start, lr.term_end, lr.status, lr.display_order,
        u.email,
        mp.first_name, mp.last_name, mp.avatar_path, mp.biography
     FROM leadership_roles lr
     LEFT JOIN users u ON lr.user_id = u.id
     LEFT JOIN member_profiles mp ON u.id = mp.user_id
     ORDER BY lr.display_order ASC, lr.office_title ASC`,
  );
  return rows;
}

export async function createLeadershipRole(data) {
  const {
    userId,
    officeTitle,
    category,
    termStart,
    termEnd,
    status,
    displayOrder,
  } = data;
  const { rows } = await query(
    `INSERT INTO leadership_roles 
       (user_id, office_title, category, term_start, term_end, status, display_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      userId || null,
      officeTitle,
      category,
      termStart || null,
      termEnd || null,
      status,
      displayOrder || 0,
    ],
  );
  return rows[0];
}

export async function updateLeadershipRole(id, data) {
  const {
    userId,
    officeTitle,
    category,
    termStart,
    termEnd,
    status,
    displayOrder,
  } = data;
  const { rows } = await query(
    `UPDATE leadership_roles SET
       user_id = $1, office_title = $2, category = $3, 
       term_start = $4, term_end = $5, status = $6, display_order = $7
     WHERE id = $8
     RETURNING *`,
    [
      userId || null,
      officeTitle,
      category,
      termStart || null,
      termEnd || null,
      status,
      displayOrder || 0,
      id,
    ],
  );
  return rows[0];
}

export async function deleteLeadershipRole(id) {
  await query(`DELETE FROM leadership_roles WHERE id = $1`, [id]);
}
