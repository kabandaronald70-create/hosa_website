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
  listExpensesForChairpersonReview,
} from "../models/financeModel.js";
import { query } from "../config/db.js";
import { auditLog } from "../services/auditService.js";
import {
  notifyExpenseApprovalRequired,
  notifyExpenseApprovalDecision,
} from "../services/notificationsService.js";
import { listDonationProjects } from "../models/projectModel.js";
import {
  uploadContributionProofFile,
  cleanupContributionProofFile,
  createContributionProofSignedUrl,
} from "../services/contributionProofFileService.js";

function toCsvCell(value) {
  let text = value == null ? "" : String(value);

  // Neutralize spreadsheet formulas, including values preceded by whitespace.
  if (/^[\u0000-\u0020]*[=+\-@]/.test(text) || /^[\t\r]/.test(text)) {
    text = `'${text}`;
  }

  // Escape embedded quotation marks and preserve the CSV cell boundary.
  return `"${text.replace(/"/g, '""')}"`;
}

export async function showFinanceDashboard(req, res, next) {
  try {
    const systemRoles = (req.userRoles || []).map(
      normalizeExpenseControllerRole,
    );

    const leadershipRoles = (req.leadershipRoles || []).map(
      normalizeExpenseControllerRole,
    );

    const isSuperAdmin = systemRoles.includes("super_admin");
    const isTreasurer = leadershipRoles.includes("treasurer");
    const isChairperson = leadershipRoles.includes("chairperson");

    // Chairperson receives a separate, restricted expense-review page.
    // Treasurer and Super Admin retain full dashboard access.
    if (isChairperson && !isTreasurer && !isSuperAdmin) {
      const expenses = await listExpensesForChairpersonReview({
        limit: 50,
      });

      return res.render("admin/finance-chairperson", {
        title: "Expense Approval Review",
        expenses,
        layout: "layouts/app",
      });
    }

    const [summary, pendingContribs, expenses, verifiedContribs] =
      await Promise.all([
        getFinancialSummary(),
        listContributions({ status: "pending", limit: 10 }),
        listExpenses({ limit: 50 }),
        listAllContributionsForExport(),
      ]);

    return res.render("admin/finance", {
      title: "Financial Management - Admin",
      summary,
      pendingContribs,
      expenses,
      verifiedContribs,
      isSuperAdmin,
      isTreasurer,
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

// ---------------------------------------------------------------------------
// Expense Submission and Multi-Stage Approval Workflow
// ---------------------------------------------------------------------------

function normalizeExpenseControllerRole(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  if (
    /^outreach_officer_(?:\((?:eastern|central|western|northern)\)|(?:eastern|central|western|northern))$/.test(
      normalized,
    )
  ) {
    return "regional_outreach_officer";
  }

  return normalized;
}

const EXPENSE_SUBMITTING_OFFICES = {
  projects_manager: "Projects Management",
  regional_outreach_officer: "Regional Outreach",
  general_secretary: "General Secretary",
  publicity: "Publicity",
  treasurer: "Finance",
};

function getExpenseRedirect(expense, actorRole = null) {
  if (actorRole === "projects_manager") {
    return "/admin/projects";
  }

  const submittedRole = normalizeExpenseControllerRole(expense?.submitted_role);

  if (submittedRole === "regional_outreach_officer") {
    return "/regional/dashboard";
  }

  if (submittedRole === "projects_manager") {
    return "/admin/projects";
  }

  return "/admin/finance";
}

export async function actionCreateExpense(req, res, next) {
  try {
    const { title, amount, category, description } = req.body;

    const activeLeadershipRoles = [
      ...new Set(
        (req.leadershipRoles || [])
          .map(normalizeExpenseControllerRole)
          .filter((role) =>
            Object.prototype.hasOwnProperty.call(
              EXPENSE_SUBMITTING_OFFICES,
              role,
            ),
          ),
      ),
    ];

    if (activeLeadershipRoles.length === 0) {
      req.flash(
        "error",
        "You do not hold an eligible active leadership position for submitting expense requests.",
      );
      return res.redirect("/admin/finance");
    }

    const requestedRole = req.body.submitted_role
      ? normalizeExpenseControllerRole(req.body.submitted_role)
      : null;

    let actorRole;

    if (requestedRole) {
      if (!activeLeadershipRoles.includes(requestedRole)) {
        req.flash(
          "error",
          "You cannot submit an expense request on behalf of that office.",
        );
        return res.redirect("/admin/finance");
      }

      actorRole = requestedRole;
    } else if (activeLeadershipRoles.length === 1) {
      actorRole = activeLeadershipRoles[0];
    } else {
      req.flash(
        "error",
        "Select the leadership office submitting this expense request.",
      );
      return res.redirect("/admin/finance");
    }

    const expense = await createExpense({
      title,
      amount,
      category,
      description,
      requestedBy: req.user.id,
      actorRole,
      submittedOffice: EXPENSE_SUBMITTING_OFFICES[actorRole],
    });

    await notifyExpenseApprovalRequired({
      expense,
      stage: expense.approval_stage,
    });

    await auditLog({
      req,
      action: "finance.expense_submitted",
      targetType: "expense",
      targetId: expense.id,
      metadata: {
        submittedRole: actorRole,
        submittedOffice: EXPENSE_SUBMITTING_OFFICES[actorRole],
        approvalStage: expense.approval_stage,
      },
    });

    req.flash(
      "success",
      "Expense request submitted successfully. The required approval process has started.",
    );

    return res.redirect(getExpenseRedirect(expense, actorRole));
  } catch (err) {
    next(err);
  }
}

export async function actionUpdateExpenseStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    if (!["approved", "rejected", "paid"].includes(status)) {
      req.flash("error", "Invalid expense action.");
      return res.redirect("/admin/finance");
    }

    // Retrieve the current workflow stage from the database.
    // The submitted form is never trusted to determine the approver's role.
    const { rows } = await query(
      `SELECT
         id,
         title,
         amount,
         requested_by,
         status,
         approval_stage,
         submitted_role,
         submitted_office
       FROM expenses
       WHERE id = $1`,
      [id],
    );

    const expense = rows[0];

    if (!expense) {
      req.flash("error", "Expense request not found.");
      return res.redirect("/admin/finance");
    }

    const systemRoles = (req.userRoles || []).map(
      normalizeExpenseControllerRole,
    );

    const leadershipRoles = (req.leadershipRoles || []).map(
      normalizeExpenseControllerRole,
    );

    const isSuperAdmin = systemRoles.includes("super_admin");
    const isTreasurer = leadershipRoles.includes("treasurer");

    let actorRole;

    if (status === "paid") {
      // Payment is separate from approval.
      // Only the Treasurer can record actual payment.
      if (!isTreasurer) {
        req.flash(
          "error",
          "Only the active Treasurer can record expense payments.",
        );
        return res.redirect(getExpenseRedirect(expense));
      }

      actorRole = "treasurer";
    } else {
      const currentStage = normalizeExpenseControllerRole(
        expense.approval_stage,
      );

      if (currentStage === "super_admin") {
        if (!isSuperAdmin) {
          req.flash(
            "error",
            "Only a Super Admin can complete the final approval stage.",
          );
          return res.redirect(getExpenseRedirect(expense));
        }

        actorRole = "super_admin";
      } else {
        if (!leadershipRoles.includes(currentStage)) {
          req.flash(
            "error",
            "You are not authorized to act at the current approval stage.",
          );
          return res.redirect(getExpenseRedirect(expense));
        }

        actorRole = currentStage;
      }
    }

    // The model performs the authoritative transactional checks:
    // - correct approval stage
    // - no skipped approval stages
    // - requester cannot approve or reject their own request
    // - meaningful rejection reason
    // - Treasurer-only payment after final approval
    const result = await setExpenseStatus(id, status, req.user.id, {
      actorRole,
      reason,
    });

    if (!result?.expense) {
      req.flash(
        "error",
        "The expense could not be updated. It may have already changed or may no longer be eligible for this action.",
      );
      return res.redirect(getExpenseRedirect(expense, actorRole));
    }

    const updatedExpense = result.expense;

    const approvedStage = status === "approved" ? expense.approval_stage : null;

    await notifyExpenseApprovalDecision({
      expense: updatedExpense,
      actorUserId: req.user.id,
      decision: status,
      approvedStage,
      nextStage: result.approvalStage,
      reason,
    });

    await auditLog({
      req,
      action: `finance.expense_${status}`,
      targetType: "expense",
      targetId: id,
      metadata: {
        actorRole,
        previousStatus: result.previousStatus,
        newStatus: result.status,
        previousStage: expense.approval_stage,
        nextStage: result.approvalStage || updatedExpense.approval_stage,
        rejectionReason: status === "rejected" ? reason : undefined,
      },
    });

    const successMessages = {
      approved:
        result.approvalStage === "payment"
          ? "Final approval granted. The expense is now awaiting payment by the Treasurer."
          : `Expense approved successfully. It has advanced to the ${result.approvalStage} approval stage.`,
      rejected: "Expense request rejected. The submitter has been notified.",
      paid: "Expense payment recorded successfully. The request is now closed.",
    };

    req.flash("success", successMessages[status]);

    return res.redirect(getExpenseRedirect(updatedExpense, actorRole));
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Expense Status (Approve, Reject, Pay)
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

    const rows = [
      [
        "Date",
        "Title",
        "Amount (UGX)",
        "Category",
        "Status",
        "Requested By",
        "Description",
      ],
      ...expenses.map((expense) => [
        new Date(expense.created_at).toLocaleDateString(),
        expense.title,
        expense.amount,
        expense.category,
        expense.status,
        expense.requester_email,
        expense.description || "",
      ]),
    ];

    const csv = rows.map((row) => row.map(toCsvCell).join(",")).join("\r\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
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

    const rows = [
      ["HOSA Expense Report"],
      [],
      ["Title", expense.title],
      ["Amount", `UGX ${Number(expense.amount).toLocaleString()}`],
      ["Category", expense.category],
      ["Status", expense.status],
      ["Requested By", expense.requester_email],
      ["Date", new Date(expense.created_at).toLocaleString()],
      ["Description", expense.description || "N/A"],
    ];

    const csv = rows.map((row) => row.map(toCsvCell).join(",")).join("\r\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="expense-${expense.id}.csv"`,
    );
    res.send(csv);
  } catch (err) {
    next(err);
  }
}
