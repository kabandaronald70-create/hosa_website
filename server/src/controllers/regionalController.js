import { query } from "../config/db.js";
import { createProject, listProjects } from "../models/projectModel.js";
import { uploadProjectImage } from "../services/projectFileService.js";
import { auditLog } from "../services/auditService.js";
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
// Regional Dashboard
// ---------------------------------------------------------------------------

export async function showRegionalDashboard(req, res, next) {
  try {
    const { rows } = await query(
      `SELECT office_title
       FROM leadership_roles
       WHERE user_id = $1
         AND office_title LIKE 'Outreach Officer%'
         AND status = 'active'
         AND (term_start IS NULL OR term_start <= CURRENT_DATE)
         AND (term_end IS NULL OR term_end >= CURRENT_DATE)`,
      [req.user.id],
    );

    if (rows.length === 0) {
      req.flash("error", "You are not assigned as an Outreach Officer.");
      return res.redirect("/dashboard");
    }

    const region = rows[0].office_title
      .replace("Outreach Officer (", "")
      .replace(")", "");

    const projects = await listProjects({ region });

    const stats = {
      activeProjects: projects.filter((p) =>
        ["approved", "in_progress"].includes(p.status),
      ).length,
      completedProjects: projects.filter((p) => p.status === "completed")
        .length,
      proposedProjects: projects.filter((p) => p.status === "proposed").length,
    };

    res.render("regional/dashboard", {
      title: `Regional Dashboard — ${region}`,
      region,
      projects,
      stats,
      layout: "layouts/app",
    });
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
         AND office_title LIKE 'Outreach Officer%'
         AND status = 'active'
         AND (term_start IS NULL OR term_start <= CURRENT_DATE)
         AND (term_end IS NULL OR term_end >= CURRENT_DATE)`,
      [req.user.id],
    );

    if (rows.length === 0) {
      req.flash("error", "You are not assigned as an Outreach Officer.");
      return res.redirect("/dashboard");
    }

    const region = rows[0].office_title
      .replace("Outreach Officer (", "")
      .replace(")", "");

    res.render("regional/proposal-new", {
      title: `Submit Proposal — ${region} Region`,
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
         AND office_title LIKE 'Outreach Officer%'
         AND status = 'active'
         AND (term_start IS NULL OR term_start <= CURRENT_DATE)
         AND (term_end IS NULL OR term_end >= CURRENT_DATE)`,
      [req.user.id],
    );

    if (rows.length === 0) {
      req.flash("error", "You are not assigned as an Outreach Officer.");
      return res.redirect("/dashboard");
    }

    const region = rows[0].office_title
      .replace("Outreach Officer (", "")
      .replace(")", "");

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
      imagePath,
    });

    await auditLog({
      req,
      action: "project.proposal_submitted",
      targetType: "project",
      targetId: created.id,
      metadata: { title, region },
    });

    req.flash(
      "success",
      "Proposal submitted successfully. Awaiting admin approval.",
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
         AND office_title LIKE 'Outreach Officer%'
         AND status = 'active'
         AND (term_start IS NULL OR term_start <= CURRENT_DATE)
         AND (term_end IS NULL OR term_end >= CURRENT_DATE)`,
      [req.user.id],
    );

    if (rows.length === 0) {
      req.flash("error", "You are not assigned as an Outreach Officer.");
      return res.redirect("/dashboard");
    }

    const region = rows[0].office_title
      .replace("Outreach Officer (", "")
      .replace(")", "");

    const reports = await listRegionalReports({
      region,
      submittedBy: req.user.id,
    });

    res.render("regional/reports", {
      title: `Regional Reports — ${region}`,
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
         AND office_title LIKE 'Outreach Officer%'
         AND status = 'active'
         AND (term_start IS NULL OR term_start <= CURRENT_DATE)
         AND (term_end IS NULL OR term_end >= CURRENT_DATE)`,
      [req.user.id],
    );

    if (rows.length === 0) {
      req.flash("error", "You are not assigned as an Outreach Officer.");
      return res.redirect("/dashboard");
    }

    const region = rows[0].office_title
      .replace("Outreach Officer (", "")
      .replace(")", "");

    res.render("regional/report-new", {
      title: `Submit Report — ${region} Region`,
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
         AND office_title LIKE 'Outreach Officer%'
         AND status = 'active'
         AND (term_start IS NULL OR term_start <= CURRENT_DATE)
         AND (term_end IS NULL OR term_end >= CURRENT_DATE)`,
      [req.user.id],
    );

    if (rows.length === 0) {
      req.flash("error", "You are not assigned as an Outreach Officer.");
      return res.redirect("/dashboard");
    }

    const region = rows[0].office_title
      .replace("Outreach Officer (", "")
      .replace(")", "");

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
         AND office_title LIKE 'Outreach Officer%'
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
