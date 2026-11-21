import {
  getFinancialSummary,
  listContributions,
  verifyContribution,
  listExpenses,
  createExpense,
  setExpenseStatus,
  createContribution,
  updatePendingExpense,
  deletePendingExpense,
  listAllContributionsForExport,
  getExpenseById,
  listAllExpensesForExport,
  rejectContribution,
  getMemberContributionProof,
  getFinanceContributionProof,
} from "../models/financeModel.js";
import { query } from "../config/db.js";
import { auditLog } from "../services/auditService.js";
import {
  notifyExpenseApprovalRequired,
  notifyExpenseRejected,
  notifyExpenseRejectedBySuperAdmin,
} from "../services/notificationsService.js";
import { listDonationProjects } from "../models/projectModel.js";
import {
  uploadContributionProofFile,
  cleanupContributionProofFile,
  createContributionProofSignedUrl,
} from "../services/contributionProofFileService.js";

export async function showFinanceDashboard(req, res, next) {
  try {
    const [summary, pendingContribs, expenses, verifiedContribs] =
      await Promise.all([
        getFinancialSummary(),
        listContributions({ status: "pending", limit: 10 }),
        listExpenses({ limit: 50 }),
        listAllContributionsForExport(),
      ]);

    res.render("admin/finance", {
      title: "Financial Management — Admin",
      summary,
      pendingContribs,
      expenses,
      verifiedContribs,
      layout: "layouts/app",
    });
  } catch (err) {
    next(err);
  }
}

export async function actionVerifyContribution(req, res, next) {
  try {
    const { id } = req.params;
    const verified = await verifyContribution(id, req.user.id);

    if (!verified) {
      req.flash(
        "error",
        "This contribution was already verified or is no longer pending.",
      );
      return res.redirect("/admin/finance");
    }

    await auditLog({
      req,
      action: "finance.verify_contribution",
      targetType: "contribution",
      targetId: id,
    });

    req.flash("success", "Contribution verified and added to the balance.");
    res.redirect("/admin/finance");
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Reject Contribution
// ---------------------------------------------------------------------------

export async function actionRejectContribution(req, res, next) {
  try {
    const { id } = req.params;
    const reason =
      typeof req.body.reason === "string" ? req.body.reason.trim() : "";

    if (reason.length < 5 || reason.length > 500) {
      req.flash(
        "error",
        "The rejection reason must be between 5 and 500 characters.",
      );
      return res.redirect("/admin/finance");
    }

    const rejected = await rejectContribution(id, req.user.id, reason);

    if (!rejected) {
      req.flash(
        "error",
        "This contribution was already processed or is no longer pending.",
      );
      return res.redirect("/admin/finance");
    }

    await auditLog({
      req,
      action: "finance.reject_contribution",
      targetType: "contribution",
      targetId: id,
    });

    req.flash(
      "success",
      "Contribution rejected. The rejection reason has been recorded.",
    );

    return res.redirect("/admin/finance");
  } catch (err) {
    next(err);
  }
}

export async function actionCreateExpense(req, res, next) {
  try {
    const { title, amount, category, description } = req.body;
    await createExpense({
      title,
      amount,
      category,
      description,
      requestedBy: req.user.id,
    });

    await notifyExpenseApprovalRequired({ expenseTitle: title, amount });

    req.flash(
      "success",
      "Expense request submitted. Awaiting Executive Chairperson approval.",
    );
    res.redirect("/admin/finance");
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Expense Status (Approve, Reject, Pay)
// ---------------------------------------------------------------------------

export async function actionUpdateExpenseStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    // 1. Fetch expense, CURRENT status, and the chairperson who approved it (if any)
    const { rows } = await query(
      `SELECT requested_by, status, chairperson_approved_by 
       FROM expenses WHERE id = $1`,
      [id],
    );
    const expense = rows[0];

    if (!expense) {
      req.flash("error", "Expense not found.");
      return res.redirect("/admin/finance");
    }

    const previousStatus = expense.status;

    // 2. SECURITY CHECK: You cannot approve your own expense
    if (expense.requested_by === req.user.id && status !== "paid") {
      req.flash("error", "You cannot approve your own expense request.");
      return res.redirect("/admin/finance");
    }

    // 3. ROLE CHECK: First Approval requires Chairperson
    if (status === "executive_approved" || status === "rejected") {
      const { rows: chairRows } = await query(
        `SELECT id FROM leadership_roles 
         WHERE user_id = $1 AND office_title = 'Chairperson' AND status = 'active'`,
        [req.user.id],
      );
      const isChairperson = chairRows.length > 0;

      if (status === "executive_approved" && !isChairperson) {
        req.flash(
          "error",
          "Only the Executive Committee Chairperson can give the first approval.",
        );
        return res.redirect("/admin/finance");
      }

      if (
        status === "rejected" &&
        !isChairperson &&
        !req.userRoles.includes("super_admin")
      ) {
        req.flash(
          "error",
          "Only the Chairperson or a Super Admin can reject this expense.",
        );
        return res.redirect("/admin/finance");
      }
    }

    // 4. ROLE CHECK: Final Approval requires Super Admin
    if (status === "approved" && !req.userRoles.includes("super_admin")) {
      req.flash("error", "Only a Super Admin can give the final approval.");
      return res.redirect("/admin/finance");
    }

    // 5. Update the status
    await setExpenseStatus(id, status, req.user.id, reason);

    // 6. Handle Notifications on Rejection
    if (status === "rejected") {
      // A. Always notify the Treasurer (requester)
      if (expense.requested_by) {
        await notifyExpenseRejected({
          userId: expense.requested_by,
          reason: reason || "No reason provided",
        });
      }

      // B. If Super Admin rejected an expense that was previously Executive Approved, notify the Chairperson
      if (
        previousStatus === "executive_approved" &&
        expense.chairperson_approved_by
      ) {
        await notifyExpenseRejectedBySuperAdmin({
          chairpersonId: expense.chairperson_approved_by,
          reason: reason || "No reason provided",
        });
      }
    }

    await auditLog({
      req,
      action: `finance.expense_${status}`,
      targetType: "expense",
      targetId: id,
    });

    req.flash("success", `Expense status updated to ${status}.`);
    res.redirect("/admin/finance");
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Member Contributions
// ---------------------------------------------------------------------------

export async function showMyContributions(req, res, next) {
  try {
    const [{ rows: contributions }, projects] = await Promise.all([
      query(
        `SELECT
           c.id,
           c.user_id,
           c.amount,
           c.currency,
           c.purpose,
           c.payment_method,
           c.reference,
           c.project_id,
           c.status,
           c.verified_by,
           c.verified_at,
           c.rejection_reason,
           c.rejected_at,
           c.payment_proof_name,
           (c.payment_proof_path IS NOT NULL) AS has_payment_proof,
           c.created_at,
           p.title AS project_title
         FROM contributions c
         LEFT JOIN projects p ON c.project_id = p.id
         WHERE c.user_id = $1
         ORDER BY c.created_at DESC`,
        [req.user.id],
      ),
      listDonationProjects(),
    ]);

    const purposeQuery =
      typeof req.query.purpose === "string" ? req.query.purpose : "";

    const projectQuery =
      typeof req.query.project_id === "string" ? req.query.project_id : "";

    const preselectedProject = projects.find(
      (project) =>
        project.id === projectQuery || project.title === purposeQuery,
    );

    const purposes = [
      "Annual Subscription",
      "Project Donation",
      "General Fund",
      "Other",
    ];

    const preselectedPurpose = preselectedProject
      ? "Project Donation"
      : purposes.includes(purposeQuery)
        ? purposeQuery
        : "";

    res.render("dashboard/contributions", {
      title: "My Contributions",
      contributions,
      projects,
      preselectedPurpose,
      preselectedProjectId: preselectedProject?.id || "",
      layout: "layouts/app",
    });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Member: View Own Payment Proof
// ---------------------------------------------------------------------------

export async function showMyContributionProof(req, res, next) {
  try {
    const { id } = req.params;

    // The model query must match BOTH the contribution ID and member ID.
    const proof = await getMemberContributionProof(id, req.user.id);

    if (!proof) {
      req.flash(
        "error",
        "Payment proof was not found or you are not authorized to access it.",
      );
      return res.redirect("/dashboard/contributions");
    }

    const signedUrl = await createContributionProofSignedUrl(
      proof.payment_proof_path,
    );

    return res.redirect(signedUrl);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Finance: View Contribution Payment Proof
// ---------------------------------------------------------------------------

export async function showFinanceContributionProof(req, res, next) {
  try {
    const { id } = req.params;

    // This route must be protected by requireFinanceAccess in admin.js.
    const proof = await getFinanceContributionProof(id);

    if (!proof) {
      req.flash("error", "Payment proof was not found for this contribution.");
      return res.redirect("/admin/finance");
    }

    const signedUrl = await createContributionProofSignedUrl(
      proof.payment_proof_path,
    );

    return res.redirect(signedUrl);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Submit Member Contribution
// ---------------------------------------------------------------------------

export async function actionSubmitContribution(req, res, next) {
  let uploadedProof = null;

  try {
    const { amount, purpose, payment_method, reference, project_id } = req.body;

    const parsedAmount = Number(amount);

    const purposes = [
      "Annual Subscription",
      "Project Donation",
      "General Fund",
      "Other",
    ];

    const paymentMethods = ["Mobile Money", "Bank Transfer", "Cash"];

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      req.flash(
        "error",
        "Enter a valid contribution amount greater than zero.",
      );
      return res.redirect("/dashboard/contributions");
    }

    if (
      !purposes.includes(purpose) ||
      !paymentMethods.includes(payment_method)
    ) {
      req.flash(
        "error",
        "Select a valid contribution purpose and payment method.",
      );
      return res.redirect("/dashboard/contributions");
    }

    if (
      purpose === "Project Donation" &&
      (typeof project_id !== "string" ||
        !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(project_id))
    ) {
      req.flash("error", "Select an approved project to donate to.");
      return res.redirect("/dashboard/contributions");
    }

    // Every member contribution must include payment evidence.
    if (!req.file) {
      req.flash(
        "error",
        "Upload an image of your payment slip or receipt before submitting.",
      );
      return res.redirect("/dashboard/contributions");
    }

    // Validate the actual image content and upload it privately.
    uploadedProof = await uploadContributionProofFile(
      req.user.id,
      req.file.buffer,
      req.file.originalname,
    );

    const contribution = await createContribution({
      userId: req.user.id,
      amount: parsedAmount,
      purpose,
      paymentMethod: payment_method,
      reference,
      projectId: purpose === "Project Donation" ? project_id : null,
      paymentProofPath: uploadedProof.storagePath,
      paymentProofName: uploadedProof.originalName,
    });

    if (!contribution) {
      await cleanupContributionProofFile(uploadedProof.storagePath);
      uploadedProof = null;

      req.flash(
        "error",
        "That project is no longer accepting donations. Select an approved project and try again.",
      );

      return res.redirect("/dashboard/contributions");
    }

    // The database record now owns the uploaded proof.
    // Do not remove it after successful submission.
    uploadedProof = null;

    req.flash(
      "success",
      "Contribution submitted successfully! Your payment proof has been uploaded securely. The Treasurer will review it before verification.",
    );

    return res.redirect("/dashboard/contributions");
  } catch (err) {
    // If the database operation fails after the file upload,
    // remove the unreferenced storage object.
    if (uploadedProof?.storagePath) {
      await cleanupContributionProofFile(uploadedProof.storagePath);
    }

    next(err);
  }
}

// ---------------------------------------------------------------------------
// Edit & Delete Pending Expense
// ---------------------------------------------------------------------------

export async function actionUpdateExpense(req, res, next) {
  try {
    const { id } = req.params;
    const { title, amount, category, description } = req.body;

    const updated = await updatePendingExpense(id, req.user.id, {
      title,
      amount,
      category,
      description,
    });

    if (!updated) {
      req.flash(
        "error",
        "Expense not found, not pending, or you don't have permission.",
      );
      return res.redirect("/admin/finance");
    }

    await auditLog({
      req,
      action: "finance.expense_updated",
      targetType: "expense",
      targetId: id,
    });

    req.flash("success", "Expense updated.");
    res.redirect("/admin/finance");
  } catch (err) {
    next(err);
  }
}

export async function actionDeleteExpense(req, res, next) {
  try {
    const { id } = req.params;

    const deleted = await deletePendingExpense(id, req.user.id);

    if (!deleted) {
      req.flash(
        "error",
        "Expense not found, not pending, or you don't have permission.",
      );
      return res.redirect("/admin/finance");
    }

    await auditLog({
      req,
      action: "finance.expense_deleted",
      targetType: "expense",
      targetId: id,
    });

    req.flash("success", "Expense deleted.");
    res.redirect("/admin/finance");
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Exports & Reports
// ---------------------------------------------------------------------------

export async function actionExportContributions(req, res, next) {
  try {
    const contributions = await listAllContributionsForExport();

    let csv = "Date,Member,Purpose,Amount (UGX),Method,Reference,Status\n";
    contributions.forEach((c) => {
      const member = c.first_name ? `${c.first_name} ${c.last_name}` : "Guest";
      csv += `"${new Date(c.created_at).toLocaleDateString()}","${member}","${c.purpose}","${c.amount}","${c.payment_method}","${c.reference || ""}","${c.status}"\n`;
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="hosa-contributions.csv"',
    );
    res.send(csv);
  } catch (err) {
    next(err);
  }
}

export async function actionExportAllExpenses(req, res, next) {
  try {
    const expenses = await listAllExpensesForExport();

    let csv =
      "Date,Title,Amount (UGX),Category,Status,Requested By,Description\n";
    expenses.forEach((e) => {
      csv += `"${new Date(e.created_at).toLocaleDateString()}","${e.title}","${e.amount}","${e.category}","${e.status}","${e.requester_email}","${e.description || ""}"\n`;
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="hosa-expenses.csv"',
    );
    res.send(csv);
  } catch (err) {
    next(err);
  }
}

export async function actionExportSingleExpense(req, res, next) {
  try {
    const expense = await getExpenseById(req.params.id);
    if (!expense) {
      req.flash("error", "Expense not found.");
      return res.redirect("/admin/finance");
    }

    let csv = "HOSA Expense Report\n\n";
    csv += `Title,${expense.title}\n`;
    csv += `Amount,UGX ${Number(expense.amount).toLocaleString()}\n`;
    csv += `Category,${expense.category}\n`;
    csv += `Status,${expense.status}\n`;
    csv += `Requested By,${expense.requester_email}\n`;
    csv += `Date,${new Date(expense.created_at).toLocaleString()}\n`;
    csv += `Description,${expense.description || "N/A"}\n`;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="expense-${expense.id}.csv"`,
    );
    res.send(csv);
  } catch (err) {
    next(err);
  }
}
