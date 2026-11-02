import { query } from "../config/db.js";
import { createProject, listProjects } from "../models/projectModel.js";
import { uploadProjectImage } from "../services/projectFileService.js";
import { auditLog } from "../services/auditService.js";

export async function showRegionalDashboard(req, res, next) {
  try {
    // 1. Get the officer's assigned region from their leadership role
    const { rows: roleRows } = await query(
      `SELECT office_title FROM leadership_roles 
       WHERE user_id = $1 AND office_title LIKE 'Outreach Officer%' AND status = 'active'`,
      [req.user.id],
    );

    if (roleRows.length === 0) {
      req.flash("error", "You are not assigned as an Outreach Officer.");
      return res.redirect("/dashboard");
    }

    // Extract region from "Outreach Officer (Central)" -> "Central"
    const roleTitle = roleRows[0].office_title;
    const region = roleTitle.replace("Outreach Officer (", "").replace(")", "");

    // 2. Fetch projects for that region
    const projects = await listProjects({ region });

    // 3. Calculate stats
    const activeProjects = projects.filter((p) =>
      ["approved", "in_progress"].includes(p.status),
    ).length;
    const completedProjects = projects.filter(
      (p) => p.status === "completed",
    ).length;
    const proposedProjects = projects.filter(
      (p) => p.status === "proposed",
    ).length;

    res.render("regional/dashboard", {
      title: `Regional Dashboard — ${region}`,
      region,
      projects,
      stats: { activeProjects, completedProjects, proposedProjects },
      layout: "layouts/app",
    });
  } catch (err) {
    next(err);
  }
}

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

    // 1. Get the officer's region
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

    // 2. Upload image if provided
    let imagePath = null;
    if (req.file) {
      imagePath = await uploadProjectImage(
        req.user.id,
        req.file.buffer,
        req.file.mimetype,
        req.file.originalname,
      );
    }

    // 3. Create the project as a proposal
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
