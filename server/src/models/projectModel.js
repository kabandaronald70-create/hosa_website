import { query } from "../config/db.js";

// --- Projects ---
export async function listProjects({ region, status, limit = 50 } = {}) {
  let where = [];
  let values = [];
  let i = 1;

  if (region) {
    where.push(`p.region = $${i}`);
    values.push(region);
    i++;
  }
  if (status) {
    where.push(`p.status = $${i}`);
    values.push(status);
    i++;
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const { rows } = await query(
    `SELECT p.*, 
            u.email AS lead_email, 
            mp.first_name, mp.last_name,
            -- Fetch the Outreach Officer for this region
            (SELECT u2.email FROM leadership_roles lr2 
             JOIN users u2 ON lr2.user_id = u2.id 
             WHERE lr2.office_title = 'Outreach Officer (' || p.region || ')' 
             AND lr2.status = 'active' LIMIT 1) AS outreach_email,
            (SELECT mp2.phone FROM leadership_roles lr2 
             JOIN users u2 ON lr2.user_id = u2.id 
             JOIN member_profiles mp2 ON mp2.user_id = u2.id 
             WHERE lr2.office_title = 'Outreach Officer (' || p.region || ')' 
             AND lr2.status = 'active' LIMIT 1) AS outreach_phone,
            -- Fetch the Outreach Officer's name
            (SELECT mp2.first_name FROM leadership_roles lr2 
             JOIN users u2 ON lr2.user_id = u2.id 
             JOIN member_profiles mp2 ON mp2.user_id = u2.id 
             WHERE lr2.office_title = 'Outreach Officer (' || p.region || ')' 
             AND lr2.status = 'active' LIMIT 1) AS outreach_first_name,
            (SELECT mp2.last_name FROM leadership_roles lr2 
             JOIN users u2 ON lr2.user_id = u2.id 
             JOIN member_profiles mp2 ON mp2.user_id = u2.id 
             WHERE lr2.office_title = 'Outreach Officer (' || p.region || ')' 
             AND lr2.status = 'active' LIMIT 1) AS outreach_last_name
     FROM projects p
     LEFT JOIN users u ON p.lead_user_id = u.id
     LEFT JOIN member_profiles mp ON u.id = mp.user_id
     ${whereClause}
     ORDER BY p.created_at DESC LIMIT $${i}`,
    [...values, limit],
  );
  return rows;
}

export async function listDonationProjects() {
  const { rows } = await query(
    `SELECT id, title, region, budget, funds_raised
     FROM projects
     WHERE status IN ('approved', 'in_progress')
     ORDER BY created_at DESC`,
  );
  return rows;
}

export async function getProjectById(id) {
  const { rows } = await query(
    `SELECT p.*, 
            u.email AS lead_email, 
            mp.first_name, mp.last_name
     FROM projects p
     LEFT JOIN users u ON p.lead_user_id = u.id
     LEFT JOIN member_profiles mp ON u.id = mp.user_id
     WHERE p.id = $1`,
    [id],
  );
  return rows[0] || null;
}

export async function createProject(data) {
  const {
    title,
    description,
    region,
    category,
    budget,
    startDate,
    endDate,
    leadUserId,
    createdBy,
    imagePath,
    fundsRaised,
  } = data;

  const { rows } = await query(
    `INSERT INTO projects 
       (title, description, region, category, budget, start_date, end_date, lead_user_id, created_by, status, image_path, funds_raised)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'proposed', $10, $11)
     RETURNING *`,
    [
      title,
      description,
      region,
      category,
      budget,
      startDate,
      endDate,
      leadUserId,
      createdBy,
      imagePath || null,
      fundsRaised || 0,
    ],
  );
  return rows[0];
}
export async function updateProjectStatus(id, status) {
  await query(`UPDATE projects SET status = $1 WHERE id = $2`, [status, id]);
}
// --- Milestones ---
export async function listMilestones(projectId) {
  const { rows } = await query(
    `SELECT * FROM project_milestones WHERE project_id = $1 ORDER BY target_date ASC`,
    [projectId],
  );
  return rows;
}

export async function createMilestone({
  projectId,
  title,
  targetDate,
  description,
  assignedRegion,
}) {
  const { rows } = await query(
    `INSERT INTO project_milestones (project_id, title, target_date, description, assigned_region)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [
      projectId,
      title,
      targetDate || null,
      description || null,
      assignedRegion || null,
    ],
  );
  return rows[0];
}

export async function updateMilestoneStatus(id, status) {
  await query(`UPDATE project_milestones SET status = $1 WHERE id = $2`, [
    status,
    id,
  ]);
}

// ---------------------------------------------------------------------------
// Project Attachments
// ---------------------------------------------------------------------------

export async function createAttachment({
  projectId,
  title,
  description,
  filePath,
  fileName,
  uploadedBy,
}) {
  const { rows } = await query(
    `INSERT INTO project_attachments 
       (project_id, title, description, file_path, file_name, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [projectId, title, description, filePath, fileName, uploadedBy],
  );
  return rows[0];
}

export async function listAttachments(projectId) {
  const { rows } = await query(
    `SELECT pa.*, u.email AS uploader_email 
     FROM project_attachments pa
     LEFT JOIN users u ON pa.uploaded_by = u.id
     WHERE pa.project_id = $1
     ORDER BY pa.created_at DESC`,
    [projectId],
  );
  return rows;
}

export async function updateProject(id, data) {
  const {
    title,
    description,
    region,
    category,
    budget,
    startDate,
    endDate,
    fundsRaised,
  } = data;
  const { rows } = await query(
    `UPDATE projects 
     SET title = $1, description = $2, region = $3, category = $4, 
         budget = $5, start_date = $6, end_date = $7, funds_raised = $8
     WHERE id = $9
     RETURNING *`,
    [
      title,
      description,
      region,
      category,
      budget,
      startDate,
      endDate,
      fundsRaised || 0,
      id,
    ],
  );
  return rows[0];
}

export async function deleteProject(id) {
  await query(`DELETE FROM projects WHERE id = $1`, [id]);
}

export async function listOutreachOfficers() {
  const { rows } = await query(
    `SELECT lr.id, lr.office_title, lr.user_id, u.email, mp.first_name, mp.last_name
     FROM leadership_roles lr
     JOIN users u ON lr.user_id = u.id
     LEFT JOIN member_profiles mp ON u.id = mp.user_id
     WHERE lr.office_title LIKE 'Outreach Officer%'
     AND lr.status = 'active'
     ORDER BY lr.office_title ASC`,
  );
  return rows;
}

export async function updateFundsRaised(id, amount) {
  await query(`UPDATE projects SET funds_raised = $1 WHERE id = $2`, [
    amount,
    id,
  ]);
}
