import {
  listProjects,
  getProjectById,
  createProject,
  updateProjectStatus,
  listMilestones,
  createMilestone,
  updateMilestoneStatus,
  createAttachment,
  listAttachments,
  updateProject,
  deleteProject,
  listOutreachOfficers,
  updateFundsRaised,
} from "../models/projectModel.js";
import {
  uploadProjectFile,
  uploadProjectImage,
} from "../services/projectFileService.js";
import { auditLog } from "../services/auditService.js";

// ---------------------------------------------------------------------------
// Public Views
// ---------------------------------------------------------------------------

export async function showPublicProjects(req, res, next) {
  try {
    const region = req.query.region || "";
    const status = req.query.status || "";
    const projects = await listProjects({ region, status });

    res.render("public/projects", {
      title: "Projects & Regional Development — HOSA",
      projects,
      filters: { region, status },
      layout: "layouts/public",
    });
  } catch (err) {
    next(err);
  }
}

export async function showProjectDetails(req, res, next) {
  try {
    const project = await getProjectById(req.params.id);
    if (!project) {
      return res.status(404).render("public/404", {
        title: "Project not found",
        layout: "layouts/public",
      });
    }

    const [milestones, attachments] = await Promise.all([
      listMilestones(project.id),
      listAttachments(project.id),
    ]);

    res.render("public/project-detail", {
      title: `${project.title} — HOSA`,
      project,
      milestones,
      attachments,
      layout: "layouts/public",
    });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Admin Dashboard
// ---------------------------------------------------------------------------

export async function showAdminProjects(req, res, next) {
  try {
    const [projects, outreachOfficers] = await Promise.all([
      listProjects({ limit: 100 }),
      listOutreachOfficers(),
    ]);

    res.render("admin/projects", {
      title: "Projects Management — Admin",
      projects,
      outreachOfficers,
      layout: "layouts/app",
    });
  } catch (err) {
    next(err);
  }
}
export async function actionCreateProject(req, res, next) {
  try {
    const {
      title,
      description,
      region,
      category,
      budget,
      start_date,
      end_date,
      lead_user_id,
    } = req.body;

    let imagePath = null;
    if (req.file) {
      imagePath = await uploadProjectImage(
        req.user.id,
        req.file.buffer,
        req.file.mimetype,
        req.file.originalname,
      );
    }

    await createProject({
      title,
      description,
      region,
      category,
      budget: parseFloat(budget),
      startDate: start_date || null,
      endDate: end_date || null,
      leadUserId: lead_user_id || null,
      createdBy: req.user.id,
      imagePath,
    });

    req.flash("success", "Project proposal submitted.");
    res.redirect("/admin/projects");
  } catch (err) {
    next(err);
  }
}

export async function actionUpdateProjectStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    await updateProjectStatus(id, status);

    await auditLog({
      req,
      action: `project.${status}`,
      targetType: "project",
      targetId: id,
    });

    req.flash("success", `Project marked as ${status}.`);
    res.redirect(`/admin/projects/${id}`);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Milestones
// ---------------------------------------------------------------------------

export async function actionCreateMilestone(req, res, next) {
  try {
    const { project_id, title, target_date, description, assigned_region } =
      req.body;

    await createMilestone({
      projectId: project_id,
      title,
      targetDate: target_date || null,
      description: description || null,
      assignedRegion: assigned_region || null,
    });

    req.flash("success", "Milestone added.");
    res.redirect(`/admin/projects/${project_id}`);
  } catch (err) {
    next(err);
  }
}

export async function actionUpdateMilestoneStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status, project_id } = req.body;

    await updateMilestoneStatus(id, status);

    req.flash("success", "Milestone status updated.");
    res.redirect(`/admin/projects/${project_id}`);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Project Files (Uploads)
// ---------------------------------------------------------------------------

export async function actionUploadProjectFile(req, res, next) {
  try {
    const { id } = req.params;
    const { title, description } = req.body;

    if (!req.file) {
      req.flash("error", "Please select a file to upload.");
      return res.redirect(`/admin/projects/${id}`);
    }

    // Upload to Supabase Storage
    const { storagePath, originalName } = await uploadProjectFile(
      req.user.id,
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname,
    );

    // Save metadata to DB
    await createAttachment({
      projectId: id,
      title,
      description,
      filePath: storagePath,
      fileName: originalName,
      uploadedBy: req.user.id,
    });

    await auditLog({
      req,
      action: "project.file_uploaded",
      targetType: "project",
      targetId: id,
      metadata: { title, file: originalName },
    });

    req.flash("success", "File uploaded successfully.");
    res.redirect(`/admin/projects/${id}`);
  } catch (err) {
    next(err);
  }
}

export async function actionUpdateProject(req, res, next) {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      region,
      category,
      budget,
      start_date,
      end_date,
      funds_raised,
    } = req.body;

    const updated = await updateProject(id, {
      title,
      description,
      region,
      category,
      budget: parseFloat(budget),
      startDate: start_date || null,
      endDate: end_date || null,
      fundsRaised: parseFloat(funds_raised) || 0,
    });

    if (!updated) {
      req.flash("error", "Project not found.");
      return res.redirect("/admin/projects");
    }

    await auditLog({
      req,
      action: "project.updated",
      targetType: "project",
      targetId: id,
      metadata: { title: updated.title },
    });

    req.flash("success", "Project updated successfully.");
    res.redirect(`/admin/projects/${id}`);
  } catch (err) {
    next(err);
  }
}

export async function actionDeleteProject(req, res, next) {
  try {
    const { id } = req.params;
    const project = await getProjectById(id);
    if (!project) {
      req.flash("error", "Project not found.");
      return res.redirect("/admin/projects");
    }

    await deleteProject(id);

    await auditLog({
      req,
      action: "project.deleted",
      targetType: "project",
      targetId: id,
      metadata: { title: project.title },
    });

    req.flash("success", "Project deleted.");
    res.redirect("/admin/projects");
  } catch (err) {
    next(err);
  }
}

export async function showAdminProjectDetail(req, res, next) {
  try {
    const project = await getProjectById(req.params.id);
    if (!project) {
      return res.status(404).render("admin/404", {
        title: "Project not found",
        layout: "layouts/app",
      });
    }
    const [milestones, attachments] = await Promise.all([
      listMilestones(project.id),
      listAttachments(project.id),
    ]);

    res.render("admin/project-detail", {
      title: `Project: ${project.title} — Admin`,
      project,
      milestones,
      attachments,
      layout: "layouts/app",
    });
  } catch (err) {
    next(err);
  }
}

export async function actionUpdateFundsRaised(req, res, next) {
  try {
    const { id } = req.params;
    const { funds_raised } = req.body;
    const amount = parseFloat(funds_raised) || 0;

    await updateFundsRaised(id, amount);

    await auditLog({
      req,
      action: "project.funds_updated",
      targetType: "project",
      targetId: id,
      metadata: { amount },
    });

    req.flash("success", "Funds raised updated.");
    res.redirect(`/admin/projects/${id}`);
  } catch (err) {
    next(err);
  }
}
