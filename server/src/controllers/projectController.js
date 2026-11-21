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
  listProjectApprovalQueue,
  getProjectApprovalHistory,
  decideProjectApproval,
} from "../models/projectModel.js";
import {
  uploadProjectFile,
  uploadProjectImage,
} from "../services/projectFileService.js";
import { auditLog } from "../services/auditService.js";
import {
  notifyProjectProposalSubmitted,
  notifyProjectApprovalDecision,
} from "../services/notificationsService.js";

// ---------------------------------------------------------------------------
// Public Views
// ---------------------------------------------------------------------------

export async function showPublicProjects(req, res, next) {
  try {
    const region = req.query.region || "";
    const status = req.query.status || "";
    const projects = await listProjects({ region, status, approvedOnly: true });

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
    const project = await getProjectById(req.params.id, { approvedOnly: true });
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

    const created = await createProject({
      title,
      description,
      region,
      category,
      budget: parseFloat(budget),
      startDate: start_date || null,
      endDate: end_date || null,
      leadUserId: lead_user_id || null,
      createdBy: req.user.id,
      proposalSource: "projects_manager",
      imagePath,
    });

    await notifyProjectProposalSubmitted(created);

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
    const updatedProject = await updateProjectStatus(id, status);

    if (!updatedProject) {
      req.flash(
        "error",
        "This status change is not allowed. The project must complete approval first, and operational stages must follow the correct order.",
      );
      return res.redirect(`/admin/projects/${id}`);
    }

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

// ---------------------------------------------------------------------------
// Project Proposal Approval Workflow
// ---------------------------------------------------------------------------

function getEligibleProjectApprovalStages(req) {
  const stages = [];

  if (req.userRoles?.includes("super_admin")) {
    stages.push("super_admin");
  }

  if (req.leadershipRoles?.includes("Chairperson")) {
    stages.push("chairperson");
  }

  if (req.leadershipRoles?.includes("Projects Manager")) {
    stages.push("projects_manager");
  }

  return stages;
}

function getProjectApprovalStageLabel(stage) {
  const labels = {
    projects_manager: "Projects Manager",
    chairperson: "Chairperson",
    super_admin: "Super Admin",
  };

  return labels[stage] || stage;
}

/**
 * Displays proposals awaiting the current user's eligible approval stages.
 */
export async function showProjectApprovalQueue(req, res, next) {
  try {
    const eligibleStages = getEligibleProjectApprovalStages(req);

    if (eligibleStages.length === 0) {
      req.flash("error", "You are not authorized to review project proposals.");
      return res.redirect("/dashboard");
    }

    const queues = await Promise.all(
      eligibleStages.map((stage) =>
        listProjectApprovalQueue(stage, req.user.id),
      ),
    );

    const projects = queues
      .flat()
      .sort(
        (a, b) =>
          new Date(a.created_at).getTime() -
          new Date(b.created_at).getTime(),
      );

    res.render("admin/project-proposals", {
      title: "Project Proposal Approvals � Admin",
      projects,
      eligibleStages,
      getProjectApprovalStageLabel,
      layout: "layouts/app",
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Displays a proposal and its approval history to an eligible reviewer.
 */
export async function showProjectProposalReview(req, res, next) {
  try {
    const { id } = req.params;
    const eligibleStages = getEligibleProjectApprovalStages(req);

    if (eligibleStages.length === 0) {
      req.flash("error", "You are not authorized to review project proposals.");
      return res.redirect("/dashboard");
    }

    const project = await getProjectById(id);

    if (!project) {
      return res.status(404).render("admin/404", {
        title: "Project proposal not found",
        layout: "layouts/app",
      });
    }

    if (
      project.approval_status !== "pending" ||
      !eligibleStages.includes(project.approval_stage)
    ) {
      req.flash(
        "error",
        "This proposal is not awaiting review at one of your approval stages.",
      );
      return res.redirect("/admin/project-proposals");
    }

    // The queue also excludes reviewers who already participated.
    const reviewerQueue = await listProjectApprovalQueue(
      project.approval_stage,
      req.user.id,
    );

    if (!reviewerQueue.some((item) => item.id === project.id)) {
      req.flash(
        "error",
        "You have already participated in this proposal's approval process or it is no longer available.",
      );
      return res.redirect("/admin/project-proposals");
    }

    const history = await getProjectApprovalHistory(project.id);

    res.render("admin/project-proposal-review", {
      title: `Review Proposal: ${project.title}`,
      project,
      history,
      currentStage: getProjectApprovalStageLabel(project.approval_stage),
      layout: "layouts/app",
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Processes an approval or rejection at the proposal's current stage.
 */
export async function actionDecideProjectProposal(req, res, next) {
  try {
    const { id } = req.params;
    const decision =
      typeof req.body.decision === "string"
        ? req.body.decision.trim().toLowerCase()
        : "";

    const comments =
      typeof req.body.comments === "string"
        ? req.body.comments.trim()
        : "";

    if (!["approved", "rejected"].includes(decision)) {
      req.flash("error", "Please select a valid approval decision.");
      return res.redirect(`/admin/project-proposals/${id}`);
    }

    if (decision === "rejected" && !comments) {
      req.flash("error", "A reason is required when rejecting a proposal.");
      return res.redirect(`/admin/project-proposals/${id}`);
    }

    const eligibleStages = getEligibleProjectApprovalStages(req);
    const project = await getProjectById(id);

    if (!project) {
      req.flash("error", "Project proposal not found.");
      return res.redirect("/admin/project-proposals");
    }

    if (
      project.approval_status !== "pending" ||
      !eligibleStages.includes(project.approval_stage)
    ) {
      req.flash(
        "error",
        "You are not authorized to make a decision at this proposal's current approval stage.",
      );
      return res.redirect("/admin/project-proposals");
    }

    // Confirm that this reviewer has not already participated.
    const reviewerQueue = await listProjectApprovalQueue(
      project.approval_stage,
      req.user.id,
    );

    if (!reviewerQueue.some((item) => item.id === project.id)) {
      req.flash(
        "error",
        "You have already participated in this proposal's approval process or it is no longer available.",
      );
      return res.redirect("/admin/project-proposals");
    }

    // The stage comes from the database, never from submitted form data.
    const actorRole = project.approval_stage;

    const result = await decideProjectApproval({
      projectId: project.id,
      actorId: req.user.id,
      actorRole,
      decision,
      comments: comments || null,
    });

    if (!result.ok) {
      const failureMessages = {
        not_found: "Project proposal not found.",
        not_pending: "This proposal has already received a final decision.",
        unauthorized: "Your required leadership appointment is not currently active.",
        invalid_proposal_source: "This proposal has an invalid approval configuration.",
        invalid_approval_sequence: "The proposal's approval sequence is invalid.",
        incomplete_approval_history: "The proposal's approval history is incomplete.",
        already_participated: "You have already participated in this proposal's approval process.",
        wrong_stage: "This proposal is awaiting a different approval stage.",
        submitter_cannot_approve: "You cannot approve a proposal that you submitted.",
      };

      req.flash(
        "error",
        failureMessages[result.reason] ||
          "The proposal decision could not be completed.",
      );

      return res.redirect("/admin/project-proposals");
    }

    await auditLog({
      req,
      action:
        decision === "rejected"
          ? "project.proposal_rejected"
          : "project.proposal_stage_approved",
      targetType: "project",
      targetId: project.id,
      metadata: {
        title: project.title,
        proposalSource: project.proposal_source,
        approvalStage: actorRole,
        decision,
        nextStage: result.nextStage,
        comments: comments || null,
      },
    });

    await notifyProjectApprovalDecision({
      project: result.project,
      actorUserId: req.user.id,
      decision,
      nextStage: result.nextStage,
    });

    if (result.rejected) {
      req.flash(
        "success",
        "Proposal rejected. The submitting officer has been notified.",
      );
    } else if (result.completed) {
      req.flash(
        "success",
        "All approval stages are complete. The proposal is now approved for publication.",
      );
    } else {
      req.flash(
        "success",
        `Approval recorded. The proposal is now awaiting ${getProjectApprovalStageLabel(result.nextStage)} review.`,
      );
    }

    res.redirect("/admin/project-proposals");
  } catch (err) {
    next(err);
  }
}
