import { query } from "../config/db.js";
import { supabase } from "../config/supabase.js";
import { createProject, listProjects } from "../models/projectModel.js";
import {
  uploadProjectImage,
  uploadProjectFile,
} from "../services/projectFileService.js";
import { auditLog } from "../services/auditService.js";
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
      `SELECT office_title FROM leadership_roles 
       WHERE user_id = $1 AND office_title LIKE 'Outreach Officer%' AND status = 'active'`,
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
      `SELECT office_title FROM leadership_roles 
       WHERE user_id = $1 AND office_title LIKE 'Outreach Officer%' AND status = 'active'`,
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
      `SELECT office_title FROM leadership_roles 
       WHERE user_id = $1 AND office_title LIKE 'Outreach Officer%' AND status = 'active'`,
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
      `SELECT office_title FROM leadership_roles 
       WHERE user_id = $1 AND office_title LIKE 'Outreach Officer%' AND status = 'active'`,
      [req.user.id],
    );

    if (rows.length === 0) {
      req.flash("error", "You are not assigned as an Outreach Officer.");
      return res.redirect("/dashboard");
    }

    const region = rows[0].office_title
      .replace("Outreach Officer (", "")
      .replace(")", "");

    const reports = await listRegionalReports({ region });

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

export async function showNewReportForm(req, res, next) {
  try {
    const { rows } = await query(
      `SELECT office_title FROM leadership_roles 
       WHERE user_id = $1 AND office_title LIKE 'Outreach Officer%' AND status = 'active'`,
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

    // Get the officer's region
    const { rows } = await query(
      `SELECT office_title FROM leadership_roles 
       WHERE user_id = $1 AND office_title LIKE 'Outreach Officer%' AND status = 'active'`,
      [req.user.id],
    );

    if (rows.length === 0) {
      req.flash("error", "You are not assigned as an Outreach Officer.");
      return res.redirect("/dashboard");
    }

    const region = rows[0].office_title
      .replace("Outreach Officer (", "")
      .replace(")", "");

    let filePath = null;
    let fileName = null;
    if (req.file) {
      const uploadResult = await uploadProjectFile(
        req.user.id,
        req.file.buffer,
        req.file.mimetype,
        req.file.originalname,
      );
      filePath = uploadResult.storagePath;
      fileName = uploadResult.originalName;
    }

    await createRegionalReport({
      region,
      title,
      reportType: report_type,
      content,
      filePath,
      fileName,
      submittedBy: req.user.id,
    });

    await auditLog({
      req,
      action: "regional_report.submitted",
      targetType: "regional_report",
      targetId: null,
      metadata: { title, region },
    });

    req.flash("success", "Report submitted successfully.");
    res.redirect("/regional/reports");
  } catch (err) {
    next(err);
  }
}

// --- Edit Report ---
export async function showEditReportForm(req, res, next) {
  try {
    const { id } = req.params;

    // Verify the user is an outreach officer and get their region
    const { rows: roles } = await query(
      `SELECT office_title FROM leadership_roles 
       WHERE user_id = $1 AND office_title LIKE 'Outreach Officer%' AND status = 'active'`,
      [req.user.id],
    );
    if (roles.length === 0) {
      req.flash("error", "You are not assigned as an Outreach Officer.");
      return res.redirect("/dashboard");
    }

    // Fetch the specific report to ensure it belongs to this officer
    const { rows: reportRows } = await query(
      `SELECT * FROM regional_reports
       WHERE id = $1 AND submitted_by = $2 AND status = 'pending'`,
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

    if (!["monthly", "quarterly", "annual", "incident"].includes(report_type)) {
      req.flash("error", "Select a valid report type.");
      return res.redirect(`/regional/reports/${id}/edit`);
    }

    const updated = await updateRegionalReport(id, req.user.id, {
      title,
      reportType: report_type,
      content,
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
      metadata: { title },
    });

    req.flash("success", "Report updated successfully.");
    res.redirect("/regional/reports");
  } catch (err) {
    next(err);
  }
}

// --- Delete Report ---
export async function actionDeleteReport(req, res, next) {
  try {
    const { id } = req.params;

    // 1. Fetch the report first to get the file path
    const { rows } = await query(
      `SELECT * FROM regional_reports WHERE id = $1 AND submitted_by = $2`,
      [id, req.user.id],
    );

    if (rows.length === 0) {
      req.flash("error", "Report not found or you don't have permission.");
      return res.redirect("/regional/reports");
    }

    const report = rows[0];

    // 2. If it has a file, delete it from Supabase Storage
    if (report.file_path) {
      // Extract just the filename from the full URL
      const fileName = report.file_path.split("/").pop();
      await supabase.storage.from("project-files").remove([fileName]);
    }

    // 3. Delete the database row
    await deleteRegionalReport(id, req.user.id);

    req.flash("success", "Report and attachment deleted successfully.");
    res.redirect("/regional/reports");
  } catch (err) {
    next(err);
  }
}
