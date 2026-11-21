import { query, withTransaction } from "../config/db.js";

// --- Dashboard Totals ---
export async function getFinancialSummary() {
  const incomeRes = await query(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM contributions
     WHERE status = 'verified'`,
  );

  const expenseRes = await query(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM expenses
     WHERE status IN ('approved', 'paid')`,
  );

  const pendingContribRes = await query(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM contributions
     WHERE status = 'pending'`,
  );

  const totalIncome = Number(incomeRes.rows[0].total);
  const totalExpenses = Number(expenseRes.rows[0].total);
  const pendingIncome = Number(pendingContribRes.rows[0].total);

  return {
    totalIncome,
    totalExpenses,
    netBalance: totalIncome - totalExpenses,
    pendingIncome,
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

export async function listExpenses({ status = "", limit = 50 }) {
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

export async function createExpense({
  title,
  amount,
  category,
  description,
  requestedBy,
}) {
  const { rows } = await query(
    `INSERT INTO expenses (
       title,
       amount,
       category,
       description,
       requested_by
     )
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [title, amount, category, description, requestedBy],
  );

  return rows[0];
}

export async function setExpenseStatus(id, status, adminId, reason = null) {
  if (status === "executive_approved") {
    await query(
      `UPDATE expenses
       SET status = 'executive_approved',
           chairperson_approved_by = $1,
           chairperson_approved_at = now()
       WHERE id = $2`,
      [adminId, id],
    );
  } else if (status === "approved") {
    await query(
      `UPDATE expenses
       SET status = 'approved',
           approved_by = $1,
           approved_at = now()
       WHERE id = $2`,
      [adminId, id],
    );
  } else if (status === "paid") {
    await query(
      `UPDATE expenses
       SET status = 'paid',
           paid_by = $1,
           paid_at = now()
       WHERE id = $2`,
      [adminId, id],
    );
  } else if (status === "rejected") {
    await query(
      `UPDATE expenses
       SET status = 'rejected',
           rejection_reason = $1
       WHERE id = $2`,
      [reason, id],
    );
  } else {
    await query(
      `UPDATE expenses
       SET status = $1
       WHERE id = $2`,
      [status, id],
    );
  }
}

export async function updatePendingExpense(id, userId, data) {
  const { title, amount, category, description } = data;

  // Only update if the expense is still pending
  // and the user is the original requester.
  const { rows } = await query(
    `UPDATE expenses
     SET title = $1,
         amount = $2,
         category = $3,
         description = $4
     WHERE id = $5
       AND requested_by = $6
       AND status = 'pending'
     RETURNING *`,
    [title, amount, category, description, id, userId],
  );

  return rows[0];
}

export async function deletePendingExpense(id, userId) {
  // Only delete if the expense is still pending
  // and the user is the original requester.
  const { rows } = await query(
    `DELETE FROM expenses
     WHERE id = $1
       AND requested_by = $2
       AND status = 'pending'
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
        e.*,
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
        e.*,
        u.email AS requester_email
     FROM expenses e
     LEFT JOIN users u ON e.requested_by = u.id
     WHERE e.id = $1`,
    [id],
  );

  return rows[0] || null;
}
