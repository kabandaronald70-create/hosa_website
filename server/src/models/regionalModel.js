import { query } from "../config/db.js";

export async function createRegionalReport({
  region,
  title,
  reportType,
  content,
  filePath,
  fileName,
  submittedBy,
}) {
  const { rows } = await query(
    `INSERT INTO regional_reports 
       (region, title, report_type, content, file_path, file_name, submitted_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [region, title, reportType, content, filePath, fileName, submittedBy],
  );
  return rows[0];
}

export async function listRegionalReports({ region, status } = {}) {
  let where = [];
  let values = [];
  let i = 1;

  if (region) {
    where.push(`rr.region = $${i}`);
    values.push(region);
    i++;
  }
  if (status) {
    where.push(`rr.status = $${i}`);
    values.push(status);
    i++;
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const { rows } = await query(
    `SELECT rr.*, 
            u.email AS submitter_email,
            mp.first_name, mp.last_name
     FROM regional_reports rr
     LEFT JOIN users u ON rr.submitted_by = u.id
     LEFT JOIN member_profiles mp ON u.id = mp.user_id
     ${whereClause}
     ORDER BY rr.created_at DESC`,
    values,
  );
  return rows;
}

export async function getRegionalReportById(id) {
  const { rows } = await query(
    `SELECT rr.*, 
            u.email AS submitter_email,
            mp.first_name, mp.last_name
     FROM regional_reports rr
     LEFT JOIN users u ON rr.submitted_by = u.id
     LEFT JOIN member_profiles mp ON u.id = mp.user_id
     WHERE rr.id = $1`,
    [id],
  );
  return rows[0] || null;
}

export async function markReportReviewed(id, adminId) {
  await query(
    `UPDATE regional_reports 
     SET status = 'reviewed', reviewed_by = $1, reviewed_at = now() 
     WHERE id = $2`,
    [adminId, id],
  );
}

export async function updateRegionalReport(
  reportId,
  userId,
  { title, reportType, content },
) {
  const { rows } = await query(
    `UPDATE regional_reports 
     SET title = $1, report_type = $2, content = $3 
     WHERE id = $4 AND submitted_by = $5 AND status = 'pending'
     RETURNING *`,
    [title, reportType, content, reportId, userId],
  );
  return rows[0];
}

export async function deleteRegionalReport(reportId, userId) {
  const { rows } = await query(
    `DELETE FROM regional_reports 
     WHERE id = $1 AND submitted_by = $2 AND status = 'pending'
     RETURNING *`,
    [reportId, userId],
  );
  return rows[0];
}
