import { query } from "../config/db.js";

// --- Dashboard Totals ---
export async function getFinancialSummary() {
  const incomeRes = await query(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM contributions WHERE status = 'verified'`,
  );
  const expenseRes = await query(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE status IN ('approved', 'paid')`,
  );
  const pendingContribRes = await query(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM contributions WHERE status = 'pending'`,
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
export async function listContributions({ status = "pending", limit = 50 }) {
  let where = "";
  let values = [];
  if (status) {
    where = "WHERE c.status = $1";
    values.push(status);
  }

  const { rows } = await query(
    `SELECT c.*, u.email AS user_email, mp.first_name, mp.last_name
     FROM contributions c
     LEFT JOIN users u ON c.user_id = u.id
     LEFT JOIN member_profiles mp ON u.id = mp.user_id
     ${where}
     ORDER BY c.created_at DESC LIMIT $${values.length + 1}`,
    [...values, limit],
  );
  return rows;
}

export async function verifyContribution(id, adminId) {
  await query(
    `UPDATE contributions 
     SET status = 'verified', verified_by = $1, verified_at = now() 
     WHERE id = $2`,
    [adminId, id],
  );
}

export async function createContribution({
  userId,
  amount,
  purpose,
  paymentMethod,
  reference,
}) {
  const { rows } = await query(
    `INSERT INTO contributions (user_id, amount, purpose, payment_method, reference)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [userId, amount, purpose, paymentMethod, reference],
  );
  return rows[0];
}

// --- Expenses ---
export async function listExpenses({ status = "", limit = 50 }) {
  let where = "";
  let values = [];
  if (status) {
    where = "WHERE e.status = $1";
    values.push(status);
  }

  const { rows } = await query(
    `SELECT e.*, 
            u.email AS requester_email,
            c.email AS chairperson_email,
            mp.first_name, mp.last_name
     FROM expenses e
     LEFT JOIN users u ON e.requested_by = u.id
     LEFT JOIN users c ON e.chairperson_approved_by = c.id
     LEFT JOIN member_profiles mp ON e.requested_by = mp.user_id
     ${where}
     ORDER BY e.created_at DESC LIMIT $${values.length + 1}`,
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
    `INSERT INTO expenses (title, amount, category, description, requested_by)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [title, amount, category, description, requestedBy],
  );
  return rows[0];
}

export async function setExpenseStatus(id, status, adminId, reason = null) {
  if (status === "executive_approved") {
    await query(
      `UPDATE expenses SET status = 'executive_approved', chairperson_approved_by = $1, chairperson_approved_at = now() WHERE id = $2`,
      [adminId, id],
    );
  } else if (status === "approved") {
    await query(
      `UPDATE expenses SET status = 'approved', approved_by = $1, approved_at = now() WHERE id = $2`,
      [adminId, id],
    );
  } else if (status === "paid") {
    await query(
      `UPDATE expenses SET status = 'paid', paid_by = $1, paid_at = now() WHERE id = $2`,
      [adminId, id],
    );
  } else if (status === "rejected") {
    await query(
      `UPDATE expenses SET status = 'rejected', rejection_reason = $1 WHERE id = $2`,
      [reason, id],
    );
  } else {
    await query(`UPDATE expenses SET status = $1 WHERE id = $2`, [status, id]);
  }
}

export async function updatePendingExpense(id, userId, data) {
  const { title, amount, category, description } = data;
  // Only update if it's still pending and the user is the requester
  const { rows } = await query(
    `UPDATE expenses 
     SET title = $1, amount = $2, category = $3, description = $4
     WHERE id = $5 AND requested_by = $6 AND status = 'pending'
     RETURNING *`,
    [title, amount, category, description, id, userId],
  );
  return rows[0];
}

export async function deletePendingExpense(id, userId) {
  // Only delete if it's still pending and the user is the requester
  const { rows } = await query(
    `DELETE FROM expenses 
     WHERE id = $1 AND requested_by = $2 AND status = 'pending'
     RETURNING id`,
    [id, userId],
  );
  return rows[0];
}

export async function listAllContributionsForExport() {
  const { rows } = await query(
    `SELECT c.*, mp.first_name, mp.last_name
     FROM contributions c
     LEFT JOIN users u ON c.user_id = u.id
     LEFT JOIN member_profiles mp ON u.id = mp.user_id
     WHERE c.status = 'verified'
     ORDER BY c.created_at DESC`,
  );
  return rows;
}

export async function listAllExpensesForExport() {
  const { rows } = await query(
    `SELECT e.*, u.email AS requester_email
     FROM expenses e
     LEFT JOIN users u ON e.requested_by = u.id
     ORDER BY e.created_at DESC`,
  );
  return rows;
}

export async function getExpenseById(id) {
  const { rows } = await query(
    `SELECT e.*, u.email AS requester_email
     FROM expenses e
     LEFT JOIN users u ON e.requested_by = u.id
     WHERE e.id = $1`,
    [id],
  );
  return rows[0] || null;
}
