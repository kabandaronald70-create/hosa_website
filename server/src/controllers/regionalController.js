import { query } from "../config/db.js";
import {
  createProject,
  listRegionalOfficerProjects,
} from "../models/projectModel.js";
import { uploadProjectImage } from "../services/projectFileService.js";
import { auditLog } from "../services/auditService.js";
import { notifyProjectProposalSubmitted } from "../services/notificationsService.js";
import {
  createExpense,
  listExpensesSubmittedByUser,
  listExpenseApprovalHistoryForUser,
  updateRegionalExpenseRequest,
  deleteRegionalExpenseRequest,
} from "../models/financeModel.js";
import { notifyExpenseApprovalRequired } from "../services/notificationsService.js";
import {
  uploadRegionalReportFile,
  cleanupRegionalReportFile,
  createRegionalReportSignedUrl,
} from "../services/regionalReportFileService.js";
import {
  createRegionalReport,
  listRegionalReports,
  updateRegionalReport,
  deleteRegionalReport,
} from "../models/regionalModel.js";

// ---------------------------------------------------------------------------
// Regional Office Helpers
// ---------------------------------------------------------------------------

function getRegionalOfficeRegion(officeTitle) {
  const title = String(officeTitle || "").trim();
  const prefix = "Outreach Officer ";

  if (!title.toLowerCase().startsWith(prefix.toLowerCase())) {
    return null;
  }

  const regionText = title.slice(prefix.length).trim();

  if (
    regionText.charAt(0) !== "(" ||
    regionText.charAt(regionText.length - 1) !== ")"
  ) {
    return null;
  }

  const region = regionText.slice(1, -1).trim().toLowerCase();

  const regions = {
    eastern: "Eastern",
    central: "Central",
    western: "Western",
    northern: "Northern",
  };

  return regions[region] || null;
}
// ---------------------------------------------------------------------------
// Regional Dashboard
// ---------------------------------------------------------------------------

export async function showRegionalDashboard(req, res, next) {
  try {
    const { rows } = await query(
      `SELECT office_title
       FROM leadership_roles
       WHERE user_id = $1
         AND LOWER(BTRIM(office_title)) ~ '^(outreach officer +[(]eastern[)]|outreach officer +[(]central[)]|outreach officer +[(]western[)]|outreach officer +[(]northern[)])$'
         AND status = 'active'
         AND (term_start IS NULL OR term_start <= CURRENT_DATE)
         AND (term_end IS NULL OR term_end >= CURRENT_DATE)`,
      [req.user.id],
    );

    if (rows.length === 0) {
      req.flash("error", "You are not assigned as an Outreach Officer.");
      return res.redirect("/dashboard");
    }

    const region = getRegionalOfficeRegion(rows[0].office_title);

    if (!region) {
      req.flash("error", "Your regional leadership assignment is invalid.");
      return res.redirect("/dashboard");
    }

    const projects = await listRegionalOfficerProjects(req.user.id, region);

    const submittedExpenses = await listExpensesSubmittedByUser({
      requestedBy: req.user.id,
      limit: 50,
    });

    const expenses = await Promise.all(
      submittedExpenses.map(async (expense) => ({
        ...expense,
        approvalHistory: await listExpenseApprovalHistoryForUser({
          expenseId: expense.id,
          requestedBy: req.user.id,
        }),
      })),
    );

    const stats = {
      pendingProposals: projects.filter((p) => p.approval_status === "pending")
        .length,
      approvedProjects: projects.filter((p) => p.approval_status === "approved")
        .length,
      rejectedProposals: projects.filter(
        (p) => p.approval_status === "rejected",
      ).length,
      activeProjects: projects.filter((p) =>
        ["approved", "in_progress"].includes(p.status),
      ).length,
      completedProjects: projects.filter((p) => p.status === "completed")
        .length,
    };

    res.render("regional/dashboard", {
      title: `Regional Dashboard ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ${region}`,
      region,
      projects,
      stats,
      layout: "layouts/app",
      expenses,
    });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Regional Outreach Expense Requests
// ---------------------------------------------------------------------------

export async function actionSubmitRegionalExpense(req, res, next) {
  try {
    const { title, amount, category, description } = req.body;

    const expense = await createExpense({
      title,
      amount,
      category,
      description,
      requestedBy: req.user.id,

      // Never accept the submitting role or office from the form.
      actorRole: "regional_outreach_officer",
      submittedOffice: "Regional Outreach",
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
        submittedRole: "regional_outreach_officer",
        submittedOffice: "Regional Outreach",
        approvalStage: expense.approval_stage,
      },
    });

    req.flash(
      "success",
      "Expense request submitted successfully. It is awaiting Projects Manager review.",
    );

    return res.redirect("/regional/dashboard");
  } catch (err) {
    next(err);
  }
}

export async function showEditRegionalExpenseForm(req, res, next) {
  try {
    const expenses = await listExpensesSubmittedByUser({
      requestedBy: req.user.id,
      limit: 100,
    });

    const expense = expenses.find(
      (item) =>
        String(item.id) === String(req.params.id) &&
        item.submitted_role === "regional_outreach_officer" &&
        item.status === "pending" &&
        item.approval_stage === "projects_manager",
    );

    if (!expense) {
      req.flash(
        "error",
        "This request cannot be edited. Only your requests awaiting initial Projects Manager review can be edited.",
      );
      return res.redirect("/regional/dashboard");
    }

    return res.render("regional/expense-edit", {
      title: "Edit Expense Request",
      expense,
      layout: "layouts/app",
    });
  } catch (err) {
    next(err);
  }
}

export async function actionUpdateRegionalExpense(req, res, next) {
  try {
    const { id } = req.params;
    const { title, amount, category, description } = req.body;

    const updated = await updateRegionalExpenseRequest(id, req.user.id, {
      title,
      amount,
      category,
      description,
    });

    if (!updated) {
      req.flash(
        "error",
        "This request cannot be edited. It may no longer be awaiting initial Projects Manager review.",
      );
      return res.redirect("/regional/dashboard");
    }

    await auditLog({
      req,
      action: "finance.regional_expense_updated",
      targetType: "expense",
      targetId: id,
      metadata: {
        title: updated.title,
        submittedRole: "regional_outreach_officer",
      },
    });

    req.flash("success", "Expense request updated successfully.");
    return res.redirect("/regional/dashboard");
  } catch (err) {
    next(err);
  }
}

export async function actionDeleteRegionalExpense(req, res, next) {
  try {
    const { id } = req.params;

    const deleted = await deleteRegionalExpenseRequest(id, req.user.id);

    if (!deleted) {
      req.flash(
        "error",
        "This request cannot be deleted. Only your requests awaiting initial Projects Manager review can be deleted.",
      );
      return res.redirect("/regional/dashboard");
    }

    await auditLog({
      req,
      action: "finance.regional_expense_deleted",
      targetType: "expense",
      targetId: id,
      metadata: {
        title: deleted.title,
        submittedRole: "regional_outreach_officer",
      },
    });

    req.flash("success", "Expense request deleted successfully.");
    return res.redirect("/regional/dashboard");
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Regional Proposals
// ---------------------------------------------------------------------------

export async function showRegionalProposalForm(req, res, next) {
  try {
    const { rows } = await query(
      `SELECT office_title
       FROM leadership_roles
       WHERE user_id = $1
         AND LOWER(BTRIM(office_title)) ~ '^(outreach officer +[(]eastern[)]|outreach officer +[(]central[)]|outreach officer +[(]western[)]|outreach officer +[(]northern[)])$'
         AND status = 'active'
         AND (term_start IS NULL OR term_start <= CURRENT_DATE)
         AND (term_end IS NULL OR term_end >= CURRENT_DATE)`,
      [req.user.id],
    );

    if (rows.length === 0) {
      req.flash("error", "You are not assigned as an Outreach Officer.");
      return res.redirect("/dashboard");
    }

    const region = getRegionalOfficeRegion(rows[0].office_title);

    if (!region) {
      req.flash("error", "Your regional leadership assignment is invalid.");
      return res.redirect("/dashboard");
    }

    res.render("regional/proposal-new", {
      title: `Submit Proposal ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ${region} Region`,
      region,
      layout: "layouts/app",
    });
  } catch (err) {
    next(err);
  }
}

export async function actionSubmitRegionalProposal(req, res, next) {
  try {
    const { title, description, category, budget } = req.body;

    const { rows } = await query(
      `SELECT office_title
       FROM leadership_roles
       WHERE user_id = $1
         AND LOWER(BTRIM(office_title)) ~ '^(outreach officer +[(]eastern[)]|outreach officer +[(]central[)]|outreach officer +[(]western[)]|outreach officer +[(]northern[)])$'
         AND status = 'active'
         AND (term_start IS NULL OR term_start <= CURRENT_DATE)
         AND (term_end IS NULL OR term_end >= CURRENT_DATE)`,
      [req.user.id],
    );

    if (rows.length === 0) {
      req.flash("error", "You are not assigned as an Outreach Officer.");
      return res.redirect("/dashboard");
    }

    const region = getRegionalOfficeRegion(rows[0].office_title);

    if (!region) {
      req.flash("error", "Your regional leadership assignment is invalid.");
      return res.redirect("/dashboard");
    }

    let imagePath = null;

    if (req.file) {
      imagePath = await uploadProjectImage(
        req.user.id,
        req.file.buffer,
        req.file.mimetype,
        req.file.originalname,
      );
    }

    const created = await createProject({
      title,
      description,
      region,
      category,
      budget: parseFloat(budget),
      startDate: null,
      endDate: null,
      leadUserId: req.user.id,
      createdBy: req.user.id,
      proposalSource: "regional_outreach",
      imagePath,
    });

    await auditLog({
      req,
      action: "project.proposal_submitted",
      targetType: "project",
      targetId: created.id,
      metadata: { title, region },
    });

    await notifyProjectProposalSubmitted(created);

    req.flash(
      "success",
      "Proposal submitted successfully. Awaiting Projects Manager review.",
    );

    res.redirect("/regional/dashboard");
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Regional Reports
// ---------------------------------------------------------------------------

export async function showRegionalReports(req, res, next) {
  try {
    const { rows } = await query(
      `SELECT office_title
       FROM leadership_roles
       WHERE user_id = $1
         AND LOWER(BTRIM(office_title)) ~ '^(outreach officer +[(]eastern[)]|outreach officer +[(]central[)]|outreach officer +[(]western[)]|outreach officer +[(]northern[)])$'
         AND status = 'active'
         AND (term_start IS NULL OR term_start <= CURRENT_DATE)
         AND (term_end IS NULL OR term_end >= CURRENT_DATE)`,
      [req.user.id],
    );

    if (rows.length === 0) {
      req.flash("error", "You are not assigned as an Outreach Officer.");
      return res.redirect("/dashboard");
    }

    const region = getRegionalOfficeRegion(rows[0].office_title);

    if (!region) {
      req.flash("error", "Your regional leadership assignment is invalid.");
      return res.redirect("/dashboard");
    }

    const reports = await listRegionalReports({
      region,
      submittedBy: req.user.id,
    });

    res.render("regional/reports", {
      title: `Regional Reports ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ${region}`,
      region,
      reports,
      layout: "layouts/app",
    });
  } catch (err) {
    next(err);
  }
}

export async function actionDownloadRegionalReportAttachment(req, res, next) {
  try {
    const { id } = req.params;

    // Only the submitting officer can access this attachment.
    const { rows } = await query(
      `SELECT file_path
       FROM regional_reports
       WHERE id = $1
         AND submitted_by = $2`,
      [id, req.user.id],
    );

    if (rows.length === 0 || !rows[0].file_path) {
      return res.status(404).send("Report attachment not found.");
    }

    const signedUrl = await createRegionalReportSignedUrl(rows[0].file_path);

    res.set("Cache-Control", "private, no-store");
    return res.redirect(302, signedUrl);
  } catch (err) {
    next(err);
  }
}

export async function showNewReportForm(req, res, next) {
  try {
    const { rows } = await query(
      `SELECT office_title
       FROM leadership_roles
       WHERE user_id = $1
         AND LOWER(BTRIM(office_title)) ~ '^(outreach officer +[(]eastern[)]|outreach officer +[(]central[)]|outreach officer +[(]western[)]|outreach officer +[(]northern[)])$'
         AND status = 'active'
         AND (term_start IS NULL OR term_start <= CURRENT_DATE)
         AND (term_end IS NULL OR term_end >= CURRENT_DATE)`,
      [req.user.id],
    );

    if (rows.length === 0) {
      req.flash("error", "You are not assigned as an Outreach Officer.");
      return res.redirect("/dashboard");
    }

    const region = getRegionalOfficeRegion(rows[0].office_title);

    if (!region) {
      req.flash("error", "Your regional leadership assignment is invalid.");
      return res.redirect("/dashboard");
    }

    res.render("regional/report-new", {
      title: `Submit Report ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ${region} Region`,
      region,
      layout: "layouts/app",
    });
  } catch (err) {
    next(err);
  }
}

export async function actionSubmitReport(req, res, next) {
  try {
    const { title, report_type, content } = req.body;

    const allowedReportTypes = [
      "Monthly Report",
      "Quarterly Report",
      "Annual Report",
      "Incident Report",
    ];

    if (!allowedReportTypes.includes(report_type)) {
      req.flash("error", "Select a valid report type.");
      return res.redirect("/regional/reports/new");
    }

    if (!title?.trim() || !content?.trim()) {
      req.flash("error", "Report title and content are required.");
      return res.redirect("/regional/reports/new");
    }

    // Confirm the officer's active regional assignment and appointment dates.
    const { rows } = await query(
      `SELECT office_title
       FROM leadership_roles
       WHERE user_id = $1
         AND LOWER(BTRIM(office_title)) ~ '^(outreach officer +[(]eastern[)]|outreach officer +[(]central[)]|outreach officer +[(]western[)]|outreach officer +[(]northern[)])$'
         AND status = 'active'
         AND (term_start IS NULL OR term_start <= CURRENT_DATE)
         AND (term_end IS NULL OR term_end >= CURRENT_DATE)`,
      [req.user.id],
    );

    if (rows.length === 0) {
      req.flash("error", "You are not assigned as an Outreach Officer.");
      return res.redirect("/dashboard");
    }

    const region = getRegionalOfficeRegion(rows[0].office_title);

    if (!region) {
      req.flash("error", "Your regional leadership assignment is invalid.");
      return res.redirect("/dashboard");
    }

    // Upload the attachment to private storage, if provided.
    let uploadResult = null;

    if (req.file) {
      uploadResult = await uploadRegionalReportFile(
        req.user.id,
        req.file.buffer,
        req.file.originalname,
      );
    }

    // Create the database record.
    let report;

    try {
      report = await createRegionalReport({
        region,
        title: title.trim(),
        reportType: report_type,
        content: content.trim(),
        filePath: uploadResult?.storagePath || null,
        fileName: uploadResult?.originalName || null,
        submittedBy: req.user.id,
      });
    } catch (dbErr) {
      // Prevent orphaned storage objects if database insertion fails.
      if (uploadResult?.storagePath) {
        await cleanupRegionalReportFile(uploadResult.storagePath);
      }

      throw dbErr;
    }

    await auditLog({
      req,
      action: "regional_report.submitted",
      targetType: "regional_report",
      targetId: report.id,
      metadata: { title: title.trim(), region },
    });

    req.flash("success", "Report submitted successfully.");
    return res.redirect("/regional/reports");
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Edit Regional Report
// ---------------------------------------------------------------------------

export async function showEditReportForm(req, res, next) {
  try {
    const { id } = req.params;

    // Verify the user is an outreach officer and get their region.
    const { rows: roles } = await query(
      `SELECT office_title
       FROM leadership_roles
       WHERE user_id = $1
         AND LOWER(BTRIM(office_title)) ~ '^(outreach officer +[(]eastern[)]|outreach officer +[(]central[)]|outreach officer +[(]western[)]|outreach officer +[(]northern[)])$'
         AND status = 'active'
         AND (term_start IS NULL OR term_start <= CURRENT_DATE)
         AND (term_end IS NULL OR term_end >= CURRENT_DATE)`,
      [req.user.id],
    );

    if (roles.length === 0) {
      req.flash("error", "You are not assigned as an Outreach Officer.");
      return res.redirect("/dashboard");
    }

    // Fetch the specific report to ensure it belongs to this officer.
    const { rows: reportRows } = await query(
      `SELECT *
       FROM regional_reports
       WHERE id = $1
         AND submitted_by = $2
         AND status = 'pending'`,
      [id, req.user.id],
    );

    if (reportRows.length === 0) {
      req.flash(
        "error",
        "Report not found or you do not have permission to edit it.",
      );
      return res.redirect("/regional/reports");
    }

    res.render("regional/report-edit", {
      title: "Edit Report",
      report: reportRows[0],
      layout: "layouts/app",
    });
  } catch (err) {
    next(err);
  }
}

export async function actionUpdateReport(req, res, next) {
  try {
    const { id } = req.params;
    const { title, report_type, content } = req.body;

    const allowedReportTypes = [
      "Monthly Report",
      "Quarterly Report",
      "Annual Report",
      "Incident Report",
    ];

    if (!allowedReportTypes.includes(report_type)) {
      req.flash("error", "Select a valid report type.");
      return res.redirect(`/regional/reports/${id}/edit`);
    }

    // Validate and normalize the report title and content.
    const normalizedTitle = typeof title === "string" ? title.trim() : "";

    const normalizedContent = typeof content === "string" ? content.trim() : "";

    if (!normalizedTitle || !normalizedContent) {
      req.flash("error", "Report title and content are required.");
      return res.redirect(`/regional/reports/${id}/edit`);
    }

    // Update only a pending report belonging to the current officer.
    const updated = await updateRegionalReport(id, req.user.id, {
      title: normalizedTitle,
      reportType: report_type,
      content: normalizedContent,
    });

    if (!updated) {
      req.flash("error", "Only pending reports you submitted can be edited.");
      return res.redirect("/regional/reports");
    }

    await auditLog({
      req,
      action: "regional_report.updated",
      targetType: "regional_report",
      targetId: id,
      metadata: { title: normalizedTitle },
    });

    req.flash("success", "Report updated successfully.");
    res.redirect("/regional/reports");
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Delete Regional Report
// ---------------------------------------------------------------------------

export async function actionDeleteReport(req, res, next) {
  try {
    const { id } = req.params;

    // Delete only a pending report submitted by the current officer.
    const deletedReport = await deleteRegionalReport(id, req.user.id);

    if (!deletedReport) {
      req.flash(
        "error",
        "Report not found or cannot be deleted. Only your pending reports can be deleted.",
      );
      return res.redirect("/regional/reports");
    }

    // Clean up the private attachment after successful database deletion.
    // Cleanup failures are logged without hiding the successful deletion.
    if (deletedReport.file_path) {
      await cleanupRegionalReportFile(deletedReport.file_path);
    }

    await auditLog({
      req,
      action: "regional_report.deleted",
      targetType: "regional_report",
      targetId: id,
      metadata: {
        title: deletedReport.title,
        region: deletedReport.region,
        hadAttachment: Boolean(deletedReport.file_path),
      },
    });

    req.flash("success", "Report deleted successfully.");
    return res.redirect("/regional/reports");
  } catch (err) {
    next(err);
  }
}
