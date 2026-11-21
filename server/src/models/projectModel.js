import { query, withTransaction } from "../config/db.js";

// --- Projects ---

export async function listProjects({
  region,
  status,
  limit = 50,
  approvedOnly = false,
} = {}) {
  const where = [];
  const values = [];
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

  if (approvedOnly) {
    where.push(`
      p.approval_status = 'approved'
      AND p.status IN ('approved', 'in_progress', 'completed')
    `);
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const { rows } = await query(
    `SELECT p.*,
            u.email AS lead_email,
            mp.first_name,
            mp.last_name,

            (
              SELECT u2.email
              FROM leadership_roles lr2
              JOIN users u2 ON lr2.user_id = u2.id
              WHERE TRIM(lr2.office_title) =
                    'Outreach Officer (' || p.region || ')'
                AND lr2.status = 'active'
              LIMIT 1
            ) AS outreach_email,

            (
              SELECT mp2.phone
              FROM leadership_roles lr2
              JOIN users u2 ON lr2.user_id = u2.id
              JOIN member_profiles mp2 ON mp2.user_id = u2.id
              WHERE TRIM(lr2.office_title) =
                    'Outreach Officer (' || p.region || ')'
                AND lr2.status = 'active'
              LIMIT 1
            ) AS outreach_phone,

            (
              SELECT mp2.first_name
              FROM leadership_roles lr2
              JOIN users u2 ON lr2.user_id = u2.id
              JOIN member_profiles mp2 ON mp2.user_id = u2.id
              WHERE TRIM(lr2.office_title) =
                    'Outreach Officer (' || p.region || ')'
                AND lr2.status = 'active'
              LIMIT 1
            ) AS outreach_first_name,

            (
              SELECT mp2.last_name
              FROM leadership_roles lr2
              JOIN users u2 ON lr2.user_id = u2.id
              JOIN member_profiles mp2 ON mp2.user_id = u2.id
              WHERE TRIM(lr2.office_title) =
                    'Outreach Officer (' || p.region || ')'
                AND lr2.status = 'active'
              LIMIT 1
            ) AS outreach_last_name

     FROM projects p
     LEFT JOIN users u ON p.lead_user_id = u.id
     LEFT JOIN member_profiles mp ON u.id = mp.user_id

     ${whereClause}

     ORDER BY p.created_at DESC
     LIMIT $${i}`,
    [...values, limit],
  );

  return rows;
}

export async function listDonationProjects() {
  const { rows } = await query(
    `SELECT id, title, region, budget, funds_raised
     FROM projects
     WHERE approval_status = 'approved'
       AND status IN ('approved', 'in_progress')
     ORDER BY created_at DESC`,
  );

  return rows;
}

export async function getProjectById(id, { approvedOnly = false } = {}) {
  const approvedCondition = approvedOnly
    ? `AND p.approval_status = 'approved'
       AND p.status IN ('approved', 'in_progress', 'completed')`
    : "";

  const { rows } = await query(
    `SELECT p.*,
            u.email AS lead_email,
            mp.first_name,
            mp.last_name
     FROM projects p
     LEFT JOIN users u ON p.lead_user_id = u.id
     LEFT JOIN member_profiles mp ON u.id = mp.user_id
     WHERE p.id = $1
     ${approvedCondition}`,
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
    proposalSource = "projects_manager",
  } = data;

  const approvalStage =
    proposalSource === "regional_outreach"
      ? "projects_manager"
      : proposalSource === "projects_manager"
        ? "chairperson"
        : null;

  if (!approvalStage) {
    throw new Error("Invalid project proposal source.");
  }

  const { rows } = await query(
    `INSERT INTO projects
       (
         title,
         description,
         region,
         category,
         budget,
         start_date,
         end_date,
         lead_user_id,
         created_by,
         status,
         image_path,
         funds_raised,
         proposal_source,
         approval_status,
         approval_stage
       )
     VALUES (
       $1, $2, $3, $4, $5,
       $6, $7, $8, $9,
       'proposed', $10, $11,
       $12, 'pending', $13
     )
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
      proposalSource,
      approvalStage,
    ],
  );

  return rows[0];
}

/**
 * Updates a project's operational status.
 *
 * This function cannot independently approve a proposal.
 * Final proposal approval must go through decideProjectApproval().
 */
export async function updateProjectStatus(id, status) {
  const allowedTransitions = {
    in_progress: "approved",
    completed: "in_progress",
  };

  const requiredCurrentStatus = allowedTransitions[status];

  if (!requiredCurrentStatus) {
    return null;
  }

  const { rows } = await query(
    `UPDATE projects
     SET status = $1,
         updated_at = NOW()
     WHERE id = $2
       AND approval_status = 'approved'
       AND status = $3
     RETURNING *`,
    [status, id, requiredCurrentStatus],
  );

  return rows[0] || null;
}

/**
 * Records one project proposal approval decision.
 *
 * Approval stages:
 *
 * Regional Outreach:
 * Projects Manager -> Chairperson -> Super Admin
 *
 * Projects Manager:
 * Chairperson -> Super Admin
 *
 * Legacy:
 * Chairperson -> Super Admin
 *
 * The project update and approval-history entry are committed
 * together inside one database transaction.
 */
export async function decideProjectApproval({
  projectId,
  actorId,
  actorRole,
  decision,
  comments = null,
}) {
  const allowedRoles = ["projects_manager", "chairperson", "super_admin"];

  if (!allowedRoles.includes(actorRole)) {
    throw new Error("Invalid project approval role.");
  }

  if (!["approved", "rejected"].includes(decision)) {
    throw new Error("Invalid project approval decision.");
  }

  const reason = typeof comments === "string" ? comments.trim() : "";

  if (decision === "rejected" && !reason) {
    throw new Error("A rejection reason is required.");
  }

  return withTransaction(async (client) => {
    // Lock the proposal to prevent concurrent approval decisions.
    const { rows: projectRows } = await client.query(
      `SELECT *
       FROM projects
       WHERE id = $1
       FOR UPDATE`,
      [projectId],
    );

    const project = projectRows[0];

    if (!project) {
      return {
        ok: false,
        reason: "not_found",
      };
    }

    if (project.approval_status !== "pending") {
      return {
        ok: false,
        reason: "not_pending",
      };
    }

    // A proposal creator must never approve their own submission.
    if (
      project.created_by &&
      actorId &&
      String(project.created_by) === String(actorId)
    ) {
      return {
        ok: false,
        reason: "submitter_cannot_approve",
      };
    }

    // Verify that the actor currently holds the role being exercised.
    let roleResult;

    if (actorRole === "super_admin") {
      roleResult = await client.query(
        `SELECT 1
         FROM user_roles ur
         JOIN roles r ON r.id = ur.role_id
         WHERE ur.user_id = $1
           AND r.name = 'super_admin'
         LIMIT 1`,
        [actorId],
      );
    } else {
      const officeTitle =
        actorRole === "projects_manager" ? "Projects Manager" : "Chairperson";

      roleResult = await client.query(
        `SELECT 1
         FROM leadership_roles
         WHERE user_id = $1
           AND TRIM(office_title) = $2
           AND status = 'active'
           AND (term_start IS NULL OR term_start <= CURRENT_DATE)
           AND (term_end IS NULL OR term_end >= CURRENT_DATE)
         LIMIT 1`,
        [actorId, officeTitle],
      );
    }

    if (roleResult.rows.length === 0) {
      return {
        ok: false,
        reason: "unauthorized",
      };
    }

    // Define the complete approval sequence for each proposal source.
    const approvalSequences = {
      regional_outreach: ["projects_manager", "chairperson", "super_admin"],

      projects_manager: ["chairperson", "super_admin"],

      legacy: ["chairperson", "super_admin"],
    };

    const approvalSequence = approvalSequences[project.proposal_source];

    if (!approvalSequence) {
      return {
        ok: false,
        reason: "invalid_proposal_source",
      };
    }

    // The proposal must begin at the correct initial stage.
    if (!approvalSequence.includes(project.approval_stage)) {
      return {
        ok: false,
        reason: "invalid_approval_sequence",
      };
    }

    // Find the position of the current stage in the required sequence.
    const currentStageIndex = approvalSequence.indexOf(project.approval_stage);

    // Read all earlier decisions in chronological order.
    const { rows: approvalHistory } = await client.query(
      `SELECT
         actor_user_id,
         actor_role,
         decision,
         created_at
       FROM project_approval_history
       WHERE project_id = $1
       ORDER BY created_at ASC, id ASC`,
      [projectId],
    );

    // Every earlier stage must have been approved in the correct order.
    const requiredPreviousStages = approvalSequence.slice(0, currentStageIndex);

    if (approvalHistory.length !== requiredPreviousStages.length) {
      return {
        ok: false,
        reason: "incomplete_approval_history",
      };
    }

    for (let i = 0; i < requiredPreviousStages.length; i++) {
      const previousDecision = approvalHistory[i];

      if (
        previousDecision.actor_role !== requiredPreviousStages[i] ||
        previousDecision.decision !== "approved"
      ) {
        return {
          ok: false,
          reason: "invalid_approval_sequence",
        };
      }
    }

    // Prevent the same person from approving under another appointment.
    const alreadyParticipated = approvalHistory.some(
      (entry) => entry.actor_user_id === actorId,
    );

    if (alreadyParticipated) {
      return {
        ok: false,
        reason: "already_participated",
      };
    }

    // The actor must match the current approval stage.
    const expectedStage = project.approval_stage;

    if (expectedStage !== actorRole) {
      return {
        ok: false,
        reason: "wrong_stage",
      };
    }

    let nextStage;
    let approvalStatus = "pending";
    let lifecycleStatus = project.status;

    let rejectionReason = null;
    let rejectedBy = null;
    let rejectedAt = null;

    if (decision === "rejected") {
      nextStage = "rejected";
      approvalStatus = "rejected";

      rejectionReason = reason;
      rejectedBy = actorId;
      rejectedAt = new Date();
    } else {
      const nextStageIndex = currentStageIndex + 1;

      if (nextStageIndex < approvalSequence.length) {
        nextStage = approvalSequence[nextStageIndex];
      } else {
        // The final required approval has been granted.
        nextStage = "completed";
        approvalStatus = "approved";

        if (lifecycleStatus === "proposed") {
          lifecycleStatus = "approved";
        }
      }
    }

    // Record the decision inside the same transaction.
    await client.query(
      `INSERT INTO project_approval_history
         (
           project_id,
           actor_user_id,
           actor_role,
           decision,
           comments
         )
       VALUES ($1, $2, $3, $4, $5)`,
      [projectId, actorId, actorRole, decision, reason || null],
    );

    // Update the proposal only after recording its decision.
    const { rows: updatedRows } = await client.query(
      `UPDATE projects
       SET approval_status = $1,
           approval_stage = $2,
           rejection_reason = $3,
           rejected_by = $4,
           rejected_at = $5,
           status = $6,
           updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [
        approvalStatus,
        nextStage,
        rejectionReason,
        rejectedBy,
        rejectedAt,
        lifecycleStatus,
        projectId,
      ],
    );

    return {
      ok: true,
      project: updatedRows[0],
      decision,
      nextStage,
      completed: approvalStatus === "approved",
      rejected: approvalStatus === "rejected",
    };
  });
}

/**
 * Lists only regional proposals submitted by the specified officer.
 * Does not expose other Outreach Officers' contact information.
 */
export async function listProjectApprovalQueue(stage, userId) {
  const allowedStages = [
    "projects_manager",
    "chairperson",
    "super_admin",
  ];

  if (!allowedStages.includes(stage) || !userId) {
    return [];
  }

  const { rows } = await query(
    `SELECT p.*
     FROM projects p
     WHERE p.approval_status = 'pending'
       AND p.approval_stage = $1
       AND (p.created_by IS NULL OR p.created_by <> $2)
       AND NOT EXISTS (
         SELECT 1
         FROM project_approval_history h
         WHERE h.project_id = p.id
           AND h.actor_user_id = $2
       )
     ORDER BY p.created_at ASC`,
    [stage, userId],
  );

  return rows;
}

export async function getProjectApprovalHistory(projectId) {
  const { rows } = await query(
    `SELECT
       h.id,
       h.project_id,
       h.actor_user_id,
       h.actor_role,
       h.decision,
       h.comments,
       h.created_at,
       COALESCE(
         NULLIF(
           TRIM(CONCAT_WS(' ', mp.first_name, mp.last_name)),
           ''
         ),
         u.email,
         'Former user'
       ) AS actor_name
     FROM project_approval_history h
     LEFT JOIN users u ON u.id = h.actor_user_id
     LEFT JOIN member_profiles mp ON mp.user_id = h.actor_user_id
     WHERE h.project_id = $1
     ORDER BY h.created_at ASC, h.id ASC`,
    [projectId],
  );

  return rows;
}
export async function listRegionalOfficerProjects(userId, region) {
  const { rows } = await query(
    `SELECT *
     FROM projects
     WHERE created_by = $1
       AND region = $2
       AND proposal_source = 'regional_outreach'
     ORDER BY created_at DESC`,
    [userId, region],
  );

  return rows;
}
// --- Milestones ---

export async function listMilestones(projectId) {
  const { rows } = await query(
    `SELECT *
     FROM project_milestones
     WHERE project_id = $1
     ORDER BY target_date ASC`,
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
    `INSERT INTO project_milestones
       (
         project_id,
         title,
         target_date,
         description,
         assigned_region
       )
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
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
  await query(
    `UPDATE project_milestones
     SET status = $1
     WHERE id = $2`,
    [status, id],
  );
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
       (
         project_id,
         title,
         description,
         file_path,
         file_name,
         uploaded_by
       )
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [projectId, title, description, filePath, fileName, uploadedBy],
  );

  return rows[0];
}

export async function listAttachments(projectId) {
  const { rows } = await query(
    `SELECT
       pa.*,
       u.email AS uploader_email
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
     SET title = $1,
         description = $2,
         region = $3,
         category = $4,
         budget = $5,
         start_date = $6,
         end_date = $7,
         funds_raised = $8
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
  await query(
    `DELETE FROM projects
     WHERE id = $1`,
    [id],
  );
}

export async function listOutreachOfficers() {
  const { rows } = await query(
    `SELECT
       lr.id,
       lr.office_title,
       lr.user_id,
       u.email,
       mp.first_name,
       mp.last_name
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
  await query(
    `UPDATE projects
     SET funds_raised = $1
     WHERE id = $2`,
    [amount, id],
  );
}
