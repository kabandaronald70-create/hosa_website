import { createNotification } from "../models/notificationModel.js";
import { logger } from "../utils/logger.js";
import { query } from "../config/db.js";

/**
 * Fire-and-forget notification. Errors are logged but never thrown —
 * a notification failure should never break the moderation action itself.
 */
async function notify(userId, type, title, body, link) {
  try {
    await createNotification({ userId, type, title, body, link });
  } catch (err) {
    logger.error({ err, userId, type }, "Failed to create notification");
  }
}

export function notifyStoryApproved({ userId, storyTitle }) {
  return notify(
    userId,
    "story.approved",
    `Your story was published`,
    `"${storyTitle}" is now visible to all HOSA members.`,
    `/dashboard/submissions`,
  );
}

export function notifyStoryRejected({ userId, storyTitle, reason }) {
  return notify(
    userId,
    "story.rejected",
    `Your story was not approved`,
    `"${storyTitle}" was rejected: ${reason}`,
    `/dashboard/submissions`,
  );
}

export function notifyOpportunityApproved({ userId, oppTitle }) {
  return notify(
    userId,
    "opportunity.approved",
    `Your opportunity was approved`,
    `"${oppTitle}" is now visible on the job board.`,
    `/dashboard/submissions`,
  );
}

export function notifyOpportunityRejected({ userId, oppTitle, reason }) {
  return notify(
    userId,
    "opportunity.rejected",
    `Your opportunity was not approved`,
    `"${oppTitle}" was rejected: ${reason}`,
    `/dashboard/submissions`,
  );
}

export function notifyMentorshipAccepted({ requesterId, mentorName }) {
  return notify(
    requesterId,
    "mentorship.accepted",
    `Mentorship request accepted`,
    `${mentorName} accepted your mentorship request.`,
    `/dashboard/mentorship/requests`,
  );
}

export function notifyMentorshipDeclined({ requesterId, mentorName }) {
  return notify(
    requesterId,
    "mentorship.declined",
    `Mentorship request declined`,
    `${mentorName} is currently unable to take on new mentees.`,
    `/dashboard/mentorship/requests`,
  );
}

// ---------------------------------------------------------------------------
// Financial Notifications
// ---------------------------------------------------------------------------

export async function notifyExpenseApprovalRequired({ expenseTitle, amount }) {
  // Find all Super Admins and the current Chairperson
  const { rows: approvers } = await query(`
    SELECT DISTINCT u.id 
    FROM users u
    LEFT JOIN user_roles ur ON u.id = ur.user_id
    LEFT JOIN roles r ON ur.role_id = r.id
    LEFT JOIN leadership_roles lr ON u.id = lr.user_id
    WHERE r.name = 'super_admin' 
       OR (lr.office_title = 'Chairperson' AND lr.status = 'active')
  `);

  const message = `New expense request for UGX ${Number(amount).toLocaleString()} (${expenseTitle}) requires your approval.`;

  for (const admin of approvers) {
    await notify(
      admin.id,
      "finance.expense_pending",
      "Expense Approval Required",
      message,
      "/admin/finance",
    );
  }
}

export function notifyExpenseRejected({ userId, reason }) {
  return notify(
    userId,
    "finance.expense_rejected",
    "Expense Request Rejected",
    `Your expense request was rejected. Reason: ${reason}`,
    `/admin/finance`,
  );
}

export function notifyExpenseRejectedBySuperAdmin({ chairpersonId, reason }) {
  return notify(
    chairpersonId,
    "finance.expense_rejected_overturned",
    "Expense Rejection Overridden",
    `An expense you previously approved was rejected by the Super Admin. Reason: ${reason}`,
    `/admin/finance`,
  );
}

// ---------------------------------------------------------------------------
// Project Proposal Approval Notifications
// ---------------------------------------------------------------------------

/**
 * Resolve active leadership users for a project approval stage.
 * DISTINCT prevents duplicate leadership assignments from sending duplicates.
 */
async function getProjectApprovalRecipients(stage, excludeUserId = null) {
  let sql;

  if (stage === "projects_manager" || stage === "chairperson") {
    const officeTitle =
      stage === "projects_manager" ? "Projects Manager" : "Chairperson";

    sql = `
      SELECT DISTINCT user_id AS id
      FROM leadership_roles
      WHERE TRIM(office_title) = $1
        AND status = 'active'
        AND (term_start IS NULL OR term_start <= CURRENT_DATE)
        AND (term_end IS NULL OR term_end >= CURRENT_DATE)
        AND ($2::uuid IS NULL OR user_id <> $2::uuid)
    `;
    const { rows } = await query(sql, [officeTitle, excludeUserId]);
    return rows;
  }

  if (stage === "super_admin") {
    sql = `
      SELECT DISTINCT u.id
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id
      WHERE r.name = 'super_admin'
        AND ($1::uuid IS NULL OR u.id <> $1::uuid)
    `;
    const { rows } = await query(sql, [excludeUserId]);
    return rows;
  }

  return [];
}

/**
 * Send a notification to all eligible reviewers at the next approval stage.
 * Recipient lookup and notification failures are deliberately non-fatal.
 */
async function notifyProjectNextApprovers({
  project,
  stage,
  excludeUserId = null,
}) {
  try {
    const recipients = await getProjectApprovalRecipients(
      stage,
      excludeUserId,
    );

    const stageNames = {
      projects_manager: "Projects Manager",
      chairperson: "Chairperson",
      super_admin: "Super Admin",
    };

    for (const recipient of recipients) {
      await notify(
        recipient.id,
        "project.approval_required",
        "Project Proposal Awaiting Your Review",
        `"${project.title}" (${project.region}) has passed the previous approval stage and requires your review.`,
        "/admin/project-proposals",
      );
    }

    if (recipients.length === 0) {
      logger.warn(
        { projectId: project.id, stage },
        `No eligible ${stageNames[stage] || stage} found for project approval`,
      );
    }
  } catch (err) {
    logger.error(
      { err, projectId: project.id, stage },
      "Failed to notify project proposal approvers",
    );
  }
}

/**
 * Notify the next eligible approver when a project proposal is submitted.
 * Exclude the submitter to prevent self-review notifications.
 */
export async function notifyProjectProposalSubmitted(project) {
  await notifyProjectNextApprovers({
    project,
    stage: project.approval_stage,
    excludeUserId: project.created_by,
  });
}

/**
 * Notify the next reviewer after an approval, or the submitter after a
 * rejection or final approval.
 */
export async function notifyProjectApprovalDecision({
  project,
  actorUserId,
  decision,
  nextStage,
}) {
  try {
    if (decision === "rejected") {
      if (project.created_by) {
        await notify(
          project.created_by,
          "project.proposal_rejected",
          "Project Proposal Not Approved",
          `"${project.title}" was rejected. Reason: ${project.rejection_reason || "No reason provided."}`,
          project.proposal_source === "regional_outreach"
            ? "/regional/dashboard"
            : "/admin/projects",
        );
      }
      return;
    }

    if (nextStage === "completed") {
      if (project.created_by) {
        await notify(
          project.created_by,
          "project.proposal_approved",
          "Project Proposal Approved",
          `"${project.title}" has passed all approval stages and is now approved for publication.`,
          project.proposal_source === "regional_outreach"
            ? "/regional/dashboard"
            : "/admin/projects",
        );
      }
      return;
    }

    if (nextStage) {
      await notifyProjectNextApprovers({
        project,
        stage: nextStage,
        excludeUserId: actorUserId,
      });
    }
  } catch (err) {
    logger.error(
      { err, projectId: project.id, decision },
      "Failed to send project approval decision notifications",
    );
  }
}
