import { query, withTransaction } from "../config/db.js";

// --- Dashboard Totals ---
export async function getFinancialSummary() {
  const [incomeRes, expenseRes, commitmentsRes, pendingContribRes] =
    await Promise.all([
      query(
        `SELECT COALESCE(SUM(amount), 0) AS total
         FROM contributions
         WHERE status = 'verified'`,
      ),
      // Only money actually paid is counted as a cash expense.
      query(
        `SELECT COALESCE(SUM(amount), 0) AS total
         FROM expenses
         WHERE status = 'paid'`,
      ),
      // Approved expenses awaiting payment are commitments, not cash outflow.
      query(
        `SELECT COALESCE(SUM(amount), 0) AS total
         FROM expenses
         WHERE status = 'approved'
           AND approval_stage = 'payment'`,
      ),
      query(
        `SELECT COALESCE(SUM(amount), 0) AS total
         FROM contributions
         WHERE status = 'pending'`,
      ),
    ]);

  const totalIncome = Number(incomeRes.rows[0]?.total || 0);
  const totalExpenses = Number(expenseRes.rows[0]?.total || 0);
  const approvedUnpaidCommitments = Number(commitmentsRes.rows[0]?.total || 0);
  const pendingIncome = Number(pendingContribRes.rows[0]?.total || 0);

  return {
    totalIncome,
    totalExpenses,
    netBalance: totalIncome - totalExpenses,
    pendingIncome,
    approvedUnpaidCommitments,
  };
}

// --- Contributions ---

/**
 * Lists contributions for the finance dashboard.
 *
 * The private payment_proof_path is deliberately excluded.
 * Finance users only receive the proof filename and an indicator
 * showing whether proof has been uploaded.
 */
export async function listContributions({ status = "pending", limit = 50 }) {
  let where = "";
  const values = [];

  if (status) {
    where = "WHERE c.status = $1";
    values.push(status);
  }

  const { rows } = await query(
    `SELECT
        c.id,
        c.user_id,
        c.amount,
        c.currency,
        c.purpose,
        c.payment_method,
        c.reference,
        c.status,
        c.verified_by,
        c.verified_at,
        c.created_at,
        c.project_id,
        c.payment_proof_name,
        c.rejection_reason,
        c.rejected_by,
        c.rejected_at,
        (c.payment_proof_path IS NOT NULL) AS has_payment_proof,
        u.email AS user_email,
        mp.first_name,
        mp.last_name,
        p.title AS project_title
     FROM contributions c
     LEFT JOIN users u ON c.user_id = u.id
     LEFT JOIN member_profiles mp ON u.id = mp.user_id
     LEFT JOIN projects p ON c.project_id = p.id
     ${where}
     ORDER BY c.created_at DESC
     LIMIT $${values.length + 1}`,
    [...values, limit],
  );

  return rows;
}

/**
 * Verifies a pending contribution.
 *
 * Project funds are increased only when the contribution
 * successfully changes from pending to verified.
 */
export async function verifyContribution(id, adminId) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE contributions
       SET status = 'verified',
           verified_by = $1,
           verified_at = now()
       WHERE id = $2
         AND status = 'pending'
         AND (
           user_id IS NULL
           OR payment_proof_path IS NOT NULL
         )
       RETURNING amount, project_id`,
      [adminId, id],
    );

    const contribution = rows[0];

    if (!contribution) {
      return false;
    }

    if (contribution.project_id) {
      await client.query(
        `UPDATE projects
         SET funds_raised = COALESCE(funds_raised, 0) + $1
         WHERE id = $2`,
        [contribution.amount, contribution.project_id],
      );
    }

    return true;
  });
}

/**
 * Rejects a pending contribution and records the administrator,
 * rejection reason, and rejection timestamp.
 *
 * A contribution that is no longer pending cannot be rejected.
 */
export async function rejectContribution(id, adminId, reason) {
  const { rows } = await query(
    `UPDATE contributions
     SET status = 'rejected',
         rejection_reason = $1,
         rejected_by = $2,
         rejected_at = now()
     WHERE id = $3
       AND status = 'pending'
     RETURNING id`,
    [reason, adminId, id],
  );

  return rows.length > 0;
}

/**
 * Creates a member contribution.
 *
 * Payment proof is mandatory for member-submitted contributions.
 * The storage path is saved privately in the database.
 */
export async function createContribution({
  userId,
  amount,
  purpose,
  paymentMethod,
  reference,
  projectId,
  paymentProofPath,
  paymentProofName,
}) {
  if (!paymentProofPath || !paymentProofName) {
    throw new Error("Contribution payment proof is required.");
  }

  return withTransaction(async (client) => {
    if (projectId) {
      const { rows: projects } = await client.query(
        `SELECT id
         FROM projects
         WHERE id = $1
           AND status IN ('approved', 'in_progress')
         FOR SHARE`,
        [projectId],
      );

      if (projects.length === 0) {
        return null;
      }
    }

    const { rows } = await client.query(
      `INSERT INTO contributions (
         user_id,
         amount,
         purpose,
         payment_method,
         reference,
         project_id,
         payment_proof_path,
         payment_proof_name
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING
         id,
         user_id,
         amount,
         currency,
         purpose,
         payment_method,
         reference,
         project_id,
         payment_proof_name,
         status,
         created_at`,
      [
        userId,
        amount,
        purpose,
        paymentMethod,
        reference,
        projectId || null,
        paymentProofPath,
        paymentProofName,
      ],
    );

    return rows[0];
  });
}

/**
 * Retrieves proof belonging to a specific member.
 *
 * The user ID condition prevents members from retrieving
 * another member's payment proof.
 *
 * This function returns the private storage path for internal
 * server-side use only. Do not expose it in a rendered page or API.
 */
export async function getMemberContributionProof(id, userId) {
  const { rows } = await query(
    `SELECT
       payment_proof_path,
       payment_proof_name
     FROM contributions
     WHERE id = $1
       AND user_id = $2
       AND payment_proof_path IS NOT NULL`,
    [id, userId],
  );

  return rows[0] || null;
}

/**
 * Retrieves proof for an authorized finance administrator.
 *
 * Authorization must be enforced by the route/controller
 * before this function is called.
 */
export async function getFinanceContributionProof(id) {
  const { rows } = await query(
    `SELECT
       payment_proof_path,
       payment_proof_name
     FROM contributions
     WHERE id = $1
       AND payment_proof_path IS NOT NULL`,
    [id],
  );

  return rows[0] || null;
}
// --- Expenses ---

const EXPENSE_INITIAL_STAGES = Object.freeze({
  projects_manager: "treasurer",
  regional_outreach_officer: "projects_manager",
  general_secretary: "treasurer",
  publicity: "treasurer",
  treasurer: "chairperson",
});

const EXPENSE_NEXT_STAGES = Object.freeze({
  projects_manager: "treasurer",
  treasurer: "chairperson",
  chairperson: "super_admin",
  super_admin: "payment",
});

const EXPENSE_SUBMITTING_OFFICES = Object.freeze({
  projects_manager: "Projects Management",
  regional_outreach_officer: "Regional Outreach",
  general_secretary: "General Secretary",
  publicity: "Publicity",
  treasurer: "Finance",
});

const EXPENSE_APPROVAL_ACTIONS = Object.freeze({
  projects_manager: "projects_manager_approved",
  treasurer: "treasurer_approved",
  chairperson: "chairperson_approved",
  super_admin: "super_admin_approved",
});

function normalizeExpenseRole(role) {
  return String(role || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export async function listExpenses({ status = "", limit = 50 } = {}) {
  let where = "";
  const values = [];

  if (status) {
    where = "WHERE e.status = $1";
    values.push(status);
  }

  const { rows } = await query(
    `SELECT
        e.*,
        u.email AS requester_email,
        c.email AS chairperson_email,
        mp.first_name,
        mp.last_name
     FROM expenses e
     LEFT JOIN users u ON e.requested_by = u.id
     LEFT JOIN users c ON e.chairperson_approved_by = c.id
     LEFT JOIN member_profiles mp ON e.requested_by = mp.user_id
     ${where}
     ORDER BY e.created_at DESC
     LIMIT $${values.length + 1}`,
    [...values, limit],
  );

  return rows;
}

/**
 * Returns only expense requests awaiting Chairperson review.
 * Deliberately excludes payment-proof and unrelated finance data.
 */
export async function listExpensesForChairpersonReview({ limit = 50 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);

  const { rows } = await query(
    `SELECT
        e.id,
        e.title,
        e.amount,
        e.category,
        e.description,
        e.status,
        e.approval_stage,
        e.submitted_office,
        e.submitted_role,
        e.created_at,
        mp.first_name,
        mp.last_name
     FROM expenses e
     LEFT JOIN member_profiles mp
       ON mp.user_id = e.requested_by
     WHERE e.approval_stage = 'chairperson'
       AND e.status = 'pending'
     ORDER BY e.created_at ASC
     LIMIT $1`,
    [safeLimit],
  );

  return rows;
}

/**
 * Lists Regional Outreach Officer requests awaiting Projects Manager review.
 * Only fields required for the review decision are returned.
 */
export async function listRegionalExpensesForProjectsManagerReview({
  limit = 50,
} = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);

  const { rows } = await query(
    `SELECT
        e.id,
        e.title,
        e.amount,
        e.category,
        e.description,
        e.status,
        e.approval_stage,
        e.submitted_office,
        e.submitted_role,
        e.created_at,
        mp.first_name,
        mp.last_name
     FROM expenses e
     LEFT JOIN member_profiles mp
       ON mp.user_id = e.requested_by
     WHERE e.approval_stage = 'projects_manager'
       AND e.status = 'pending'
       AND e.submitted_role = 'regional_outreach_officer'
     ORDER BY e.created_at ASC
     LIMIT $1`,
    [safeLimit],
  );

  return rows;
}

/**
 * Lists expense requests belonging to one specific member.
 * Private rejection metadata is available only through this
 * ownership-scoped query.
 */
export async function listExpensesSubmittedByUser({
  requestedBy,
  limit = 50,
} = {}) {
  if (!requestedBy) {
    return [];
  }

  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);

  const { rows } = await query(
    `SELECT
        e.id,
        e.title,
        e.amount,
        e.category,
        e.description,
        e.status,
        e.approval_stage,
        e.submitted_office,
        e.submitted_role,
        e.rejection_reason,
        e.rejected_at,
        e.created_at,
        e.updated_at
     FROM expenses e
     WHERE e.requested_by = $1
     ORDER BY e.created_at DESC
     LIMIT $2`,
    [requestedBy, safeLimit],
  );

  return rows;
}

/**
 * Returns approval history only for an expense owned by the requesting user.
 * Internal comments and rejection details are never exposed through public queries.
 */
export async function listExpenseApprovalHistoryForUser({
  expenseId,
  requestedBy,
} = {}) {
  if (!expenseId || !requestedBy) {
    return [];
  }

  const { rows } = await query(
    `SELECT
        h.id,
        h.expense_id,
        h.actor_role,
        h.action,
        h.comments,
        h.created_at,
        mp.first_name AS actor_first_name,
        mp.last_name AS actor_last_name
     FROM expense_approval_history h
     INNER JOIN expenses e
       ON e.id = h.expense_id
     LEFT JOIN member_profiles mp
       ON mp.user_id = h.actor_user_id
     WHERE h.expense_id = $1
       AND e.requested_by = $2
     ORDER BY h.created_at ASC, h.id ASC`,
    [expenseId, requestedBy],
  );

  return rows;
}

/**
 * Updates a Regional Outreach Officer expense request only before
 * Projects Manager approval.
 */
export async function updateRegionalExpenseRequest(id, userId, data = {}) {
  const title = String(data.title || "").trim();
  const category = String(data.category || "").trim();
  const description = String(data.description || "").trim();
  const amount = Number(data.amount);

  const allowedCategories = ["Administration", "Events", "Projects", "Other"];

  if (
    !id ||
    !userId ||
    !title ||
    title.length > 150 ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    !allowedCategories.includes(category) ||
    description.length > 2000
  ) {
    return null;
  }

  const { rows } = await query(
    `UPDATE expenses
     SET title = $1,
         amount = $2,
         category = $3,
         description = $4,
         updated_at = NOW()
     WHERE id = $5
       AND requested_by = $6
       AND submitted_role = 'regional_outreach_officer'
       AND status = 'pending'
       AND approval_stage = 'projects_manager'
     RETURNING
       id,
       title,
       amount,
       category,
       description,
       status,
       approval_stage,
       updated_at`,
    [title, amount, category, description || null, id, userId],
  );

  return rows[0] || null;
}

/**
 * Deletes a Regional Outreach Officer expense request only before
 * Projects Manager approval.
 *
 * Associated approval-history rows are removed by the existing
 * ON DELETE CASCADE constraint. The deletion and its audit record
 * are committed together in a single transaction.
 */
export async function deleteRegionalExpenseRequest(
  id,
  userId,
  { actorEmail = null, ipAddress = null, userAgent = null } = {},
) {
  if (!id || !userId) {
    return null;
  }

  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `DELETE FROM expenses
       WHERE id = $1
         AND requested_by = $2
         AND submitted_role = 'regional_outreach_officer'
         AND status = 'pending'
         AND approval_stage = 'projects_manager'
       RETURNING id, title, amount, category`,
      [id, userId],
    );

    const deleted = rows[0] || null;

    if (!deleted) {
      return null;
    }

    await client.query(
      `INSERT INTO audit_logs
         (actor_user_id, actor_email, action, target_type, target_id,
          metadata, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)`,
      [
        userId,
        actorEmail,
        "finance.regional_expense_deleted",
        "expense",
        String(deleted.id),
        JSON.stringify({
          title: deleted.title,
          submittedRole: "regional_outreach_officer",
        }),
        ipAddress,
        userAgent ? String(userAgent).slice(0, 300) : null,
      ],
    );

    return deleted;
  });
}
/**
 * Lists public expense summaries.
 * Never expose private rejection details, internal comments,
 * payment-proof information, requester IDs or email addresses.
 */
/**
 * Lists public expense summaries, excluding paid-and-closed requests.
 * Never expose private rejection details, internal comments,
 * payment-proof information, requester IDs or email addresses.
 */
export async function listPublicExpenseSummaries({ limit = 100 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 200);

  const { rows } = await query(
    `SELECT
        e.id,
        e.title,
        e.amount,
        e.category,
        e.description,
        e.status,
        e.approval_stage,
        e.submitted_office,
        e.created_at
     FROM expenses e
     WHERE NOT (
       e.status = 'paid'
       AND e.approval_stage = 'completed'
     )
     ORDER BY e.created_at DESC
     LIMIT $1`,
    [safeLimit],
  );

  return rows;
}

/**
 * Lists publicly visible paid-and-closed expenses.
 * Payment date is public; payment proofs and internal details are not.
 */
export async function listPublicCompletedExpenseSummaries({
  limit = 100,
} = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 200);

  const { rows } = await query(
    `SELECT
        e.id,
        e.title,
        e.amount,
        e.category,
        e.description,
        e.submitted_office,
        e.created_at,
        e.paid_at
     FROM expenses e
     WHERE e.status = 'paid'
       AND e.approval_stage = 'completed'
     ORDER BY e.paid_at DESC NULLS LAST, e.created_at DESC
     LIMIT $1`,
    [safeLimit],
  );

  return rows;
}

export async function createExpense({
  title,
  amount,
  category,
  description,
  requestedBy,
  actorRole,
  submittedOffice,
}) {
  const normalizedRole = normalizeExpenseRole(actorRole);

  if (
    !Object.hasOwn(EXPENSE_INITIAL_STAGES, normalizedRole) ||
    !requestedBy ||
    !String(title || "").trim() ||
    !Number.isFinite(Number(amount)) ||
    Number(amount) <= 0 ||
    !String(category || "").trim()
  ) {
    return null;
  }

  const office =
    String(submittedOffice || "").trim() ||
    EXPENSE_SUBMITTING_OFFICES[normalizedRole];

  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO expenses (
         title,
         amount,
         category,
         description,
         requested_by,
         submitted_office,
         submitted_role,
         approval_stage
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        String(title).trim(),
        amount,
        String(category).trim(),
        description || null,
        requestedBy,
        office,
        normalizedRole,
        EXPENSE_INITIAL_STAGES[normalizedRole],
      ],
    );

    const expense = rows[0];
    if (!expense) return null;

    await client.query(
      `INSERT INTO expense_approval_history (
         expense_id,
         actor_user_id,
         actor_role,
         action,
         comments
       )
       VALUES ($1, $2, $3, 'submitted', $4)`,
      [
        expense.id,
        requestedBy,
        normalizedRole,
        "Expense request submitted for approval.",
      ],
    );

    return expense;
  });
}

/**
 * Advances an expense through its configured approval stages.
 *
 * status must be "approved", "rejected", or "paid".
 * Approval is permitted only for the role named in approval_stage.
 * Final Super Admin approval moves the expense to payment; only the
 * Treasurer can then record payment.
 */
export async function setExpenseStatus(
  id,
  status,
  actorId,
  { actorRole, reason = null } = {},
) {
  if (!id || !actorId) return null;

  const normalizedRole = normalizeExpenseRole(actorRole);
  const normalizedReason = typeof reason === "string" ? reason.trim() : "";

  if (status !== "approved" && status !== "rejected" && status !== "paid") {
    return null;
  }

  if (
    status === "rejected" &&
    (normalizedReason.length < 5 || normalizedReason.length > 500)
  ) {
    return null;
  }

  if (
    !Object.hasOwn(EXPENSE_APPROVAL_ACTIONS, normalizedRole) &&
    !(status === "paid" && normalizedRole === "treasurer")
  ) {
    return null;
  }

  return withTransaction(async (client) => {
    const { rows: lockedRows } = await client.query(
      `SELECT
         id,
         requested_by,
         status,
         approval_stage,
         submitted_role,
         chairperson_approved_by
       FROM expenses
       WHERE id = $1
       FOR UPDATE`,
      [id],
    );

    const currentExpense = lockedRows[0];
    if (!currentExpense) return null;

    const previousStatus = currentExpense.status;
    const currentStage = String(currentExpense.approval_stage || "legacy")
      .trim()
      .toLowerCase();

    // Payment is a separate action after final approval. A Treasurer may
    // pay an expense they submitted; requester self-approval is still barred.
    if (status === "paid") {
      if (
        normalizedRole !== "treasurer" ||
        previousStatus !== "approved" ||
        currentStage !== "payment"
      ) {
        return null;
      }

      const { rows: paidRows } = await client.query(
        `UPDATE expenses
         SET status = 'paid',
             approval_stage = 'completed',
             paid_by = $1,
             paid_at = now()
         WHERE id = $2
           AND status = 'approved'
           AND approval_stage = 'payment'
         RETURNING *`,
        [actorId, id],
      );

      const paidExpense = paidRows[0];
      if (!paidExpense) return null;

      await client.query(
        `INSERT INTO expense_approval_history (
           expense_id,
           actor_user_id,
           actor_role,
           action,
           comments
         )
         VALUES ($1, $2, 'treasurer', 'paid', $3)`,
        [id, actorId, "Payment recorded by Treasurer."],
      );

      return {
        expense: paidExpense,
        previousStatus,
        status: "paid",
      };
    }

    // The submitter cannot approve or reject their own request.
    if (currentExpense.requested_by === actorId) return null;

    if (
      currentStage === "legacy" ||
      currentStage === "completed" ||
      currentStage === "rejected"
    ) {
      return null;
    }

    if (normalizedRole !== currentStage) return null;

    if (status === "rejected") {
      const { rows: rejectedRows } = await client.query(
        `UPDATE expenses
         SET status = 'rejected',
             approval_stage = 'rejected',
             rejection_reason = $1,
             rejected_by = $2,
             rejected_at = now()
         WHERE id = $3
           AND approval_stage = $4
           AND status = 'pending'
         RETURNING *`,
        [normalizedReason, actorId, id, currentStage],
      );

      const rejectedExpense = rejectedRows[0];
      if (!rejectedExpense) return null;

      await client.query(
        `INSERT INTO expense_approval_history (
           expense_id,
           actor_user_id,
           actor_role,
           action,
           comments
         )
         VALUES ($1, $2, $3, 'rejected', $4)`,
        [id, actorId, normalizedRole, normalizedReason],
      );

      return {
        expense: rejectedExpense,
        previousStatus,
        status: "rejected",
      };
    }

    const nextStage = EXPENSE_NEXT_STAGES[currentStage];
    if (!nextStage) return null;

    const isFinalApproval = normalizedRole === "super_admin";
    const nextStatus = isFinalApproval ? "approved" : "pending";

    let updateSql = `
      UPDATE expenses
      SET status = $1,
          approval_stage = $2
    `;
    const updateValues = [nextStatus, nextStage];

    if (normalizedRole === "chairperson") {
      updateSql += `,
          chairperson_approved_by = $3,
          chairperson_approved_at = now()
        WHERE id = $4
          AND approval_stage = $5
          AND status = 'pending'
        RETURNING *`;
      updateValues.push(actorId, id, currentStage);
    } else if (normalizedRole === "super_admin") {
      updateSql += `,
          approved_by = $3,
          approved_at = now()
        WHERE id = $4
          AND approval_stage = $5
          AND status = 'pending'
        RETURNING *`;
      updateValues.push(actorId, id, currentStage);
    } else {
      updateSql += `
        WHERE id = $3
          AND approval_stage = $4
          AND status = 'pending'
        RETURNING *`;
      updateValues.push(id, currentStage);
    }

    const { rows: updatedRows } = await client.query(updateSql, updateValues);

    const updatedExpense = updatedRows[0];
    if (!updatedExpense) return null;

    await client.query(
      `INSERT INTO expense_approval_history (
         expense_id,
         actor_user_id,
         actor_role,
         action,
         comments
       )
       VALUES ($1, $2, $3, $4, $5)`,
      [
        id,
        actorId,
        normalizedRole,
        EXPENSE_APPROVAL_ACTIONS[normalizedRole],
        `Approved at ${normalizedRole.replace(/_/g, " ")} stage.`,
      ],
    );

    return {
      expense: updatedExpense,
      previousStatus,
      status: nextStatus,
      approvalStage: nextStage,
    };
  });
}
/**
 * Legacy edit/delete helpers are retained for compatibility with old
 * callers, but cannot modify new workflow requests or historical records.
 */
export async function updatePendingExpense(id, userId, data) {
  const { title, amount, category, description } = data;

  const { rows } = await query(
    `UPDATE expenses
     SET title = $1,
         amount = $2,
         category = $3,
         description = $4
     WHERE id = $5
       AND requested_by = $6
       AND status = 'pending'
       AND approval_stage = 'legacy'
     RETURNING *`,
    [title, amount, category, description, id, userId],
  );

  return rows[0];
}

export async function deletePendingExpense(id, userId) {
  const { rows } = await query(
    `DELETE FROM expenses
     WHERE id = $1
       AND requested_by = $2
       AND status = 'pending'
       AND approval_stage = 'legacy'
     RETURNING id`,
    [id, userId],
  );

  return rows[0];
}

// --- Financial Exports ---

/**
 * Lists verified contributions for financial exports.
 *
 * Private payment-proof storage paths and filenames are excluded.
 */
export async function listAllContributionsForExport() {
  const { rows } = await query(
    `SELECT
        c.id,
        c.user_id,
        c.amount,
        c.currency,
        c.purpose,
        c.payment_method,
        c.reference,
        c.status,
        c.verified_by,
        c.verified_at,
        c.created_at,
        c.project_id,
        mp.first_name,
        mp.last_name,
        p.title AS project_title
     FROM contributions c
     LEFT JOIN users u ON c.user_id = u.id
     LEFT JOIN member_profiles mp ON u.id = mp.user_id
     LEFT JOIN projects p ON c.project_id = p.id
     WHERE c.status = 'verified'
     ORDER BY c.created_at DESC`,
  );

  return rows;
}

export async function listAllExpensesForExport() {
  const { rows } = await query(
    `SELECT
        e.id,
        e.title,
        e.amount,
        e.category,
        e.status,
        e.created_at,
        e.description,
        u.email AS requester_email
     FROM expenses e
     LEFT JOIN users u ON e.requested_by = u.id
     ORDER BY e.created_at DESC`,
  );

  return rows;
}

export async function getExpenseById(id) {
  const { rows } = await query(
    `SELECT
        e.id,
        e.title,
        e.amount,
        e.category,
        e.status,
        e.created_at,
        e.description,
        u.email AS requester_email
     FROM expenses e
     LEFT JOIN users u ON e.requested_by = u.id
     WHERE e.id = $1`,
    [id],
  );

  return rows[0] || null;
}
