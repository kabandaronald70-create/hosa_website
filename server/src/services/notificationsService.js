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
// Financial Notifications — Expense Approval Workflow
// ---------------------------------------------------------------------------

const EXPENSE_STAGE_NAMES = {
  projects_manager: "Projects Manager",
  treasurer: "Treasurer",
  chairperson: "Chairperson",
  super_admin: "Super Admin",
  payment: "Treasurer",
};

const EXPENSE_STAGE_OFFICES = {
  projects_manager: "projects manager",
  treasurer: "treasurer",
  chairperson: "chairperson",
};

function expenseDashboardLink(expense) {
  const role = String(expense?.submitted_role || "")
    .trim()
    .toLowerCase();

  if (role === "regional_outreach_officer") {
    return "/regional/dashboard";
  }

  if (role === "projects_manager") {
    return "/admin/projects";
  }

  return "/admin/finance";
}

async function getExpenseApprovalRecipients(
  stage,
  excludeUserId = null,
  additionalExcludeUserId = null,
) {
  try {
    if (stage === "super_admin") {
      const { rows } = await query(
        `SELECT DISTINCT u.id
         FROM users u
         JOIN user_roles ur ON ur.user_id = u.id
         JOIN roles r ON r.id = ur.role_id
         WHERE LOWER(TRIM(r.name)) = 'super_admin'
           AND LOWER(TRIM(COALESCE(u.status, ''))) NOT IN ('suspended', 'deactivated')
           AND ($1::uuid IS NULL OR u.id <> $1::uuid)
           AND ($2::uuid IS NULL OR u.id <> $2::uuid)`,
        [excludeUserId, additionalExcludeUserId],
      );

      return rows;
    }

    const officeTitle = EXPENSE_STAGE_OFFICES[stage];

    if (!officeTitle) {
      return [];
    }

    const { rows } = await query(
      `SELECT DISTINCT lr.user_id AS id
       FROM leadership_roles lr
       JOIN users u ON u.id = lr.user_id
       WHERE LOWER(TRIM(lr.office_title)) = $1
         AND LOWER(TRIM(lr.status)) = 'active'
         AND (lr.term_start IS NULL OR lr.term_start <= CURRENT_DATE)
         AND (lr.term_end IS NULL OR lr.term_end >= CURRENT_DATE)
         AND ($2::uuid IS NULL OR lr.user_id <> $2::uuid)
         AND ($3::uuid IS NULL OR lr.user_id <> $3::uuid)`,
      [officeTitle, excludeUserId, additionalExcludeUserId],
    );

    return rows;
  } catch (err) {
    logger.error(
      { err, stage },
      "Failed to resolve expense approval recipients",
    );

    return [];
  }
}

/**
 * Notify the eligible approvers at a particular approval stage.
 */
async function notifyExpenseStageApprovers({
  expense,
  stage,
  excludeUserId = null,
  additionalExcludeUserId = null,
}) {
  try {
    const recipients = await getExpenseApprovalRecipients(
      stage,
      excludeUserId,
      additionalExcludeUserId,
    );

    const stageName = EXPENSE_STAGE_NAMES[stage] || stage;

    for (const recipient of recipients) {
      await notify(
        recipient.id,
        "finance.expense_pending",
        "Expense Approval Required",
        `Expense request "${expense.title}" for UGX ${Number(expense.amount).toLocaleString()} requires your approval as ${stageName}.`,
        stage === "projects_manager" ? "/admin/projects" : "/admin/finance",
      );
    }

    if (recipients.length === 0) {
      logger.warn(
        { expenseId: expense.id, stage },
        `No eligible ${stageName} found for expense approval`,
      );
    }
  } catch (err) {
    logger.error(
      { err, expenseId: expense.id, stage },
      "Failed to notify expense approvers",
    );
  }
}

/**
 * Notify the first approver after an expense request is submitted.
 *
 * The submitter is excluded from approver notifications.
 */
export async function notifyExpenseApprovalRequired({
  expense,
  expenseTitle,
  amount,
  stage,
}) {
  if (!expense) {
    logger.warn(
      { expenseTitle, stage },
      "Expense approval notification called without an expense record",
    );
    return;
  }

  await notifyExpenseStageApprovers({
    expense,
    stage,
    excludeUserId: expense.requested_by,
  });
}

/**
 * Notify the requester about an approval decision and notify the
 * next eligible approvers where another stage remains.
 *
 * decision: approved | rejected | paid
 */
export async function notifyExpenseApprovalDecision({
  expense,
  actorUserId,
  decision,
  nextStage,
  reason,
  approvedStage,
}) {
  try {
    if (!expense) return;

    const requesterId = expense.requested_by;
    const requesterLink = expenseDashboardLink(expense);

    // Rejection: only the requester receives the private reason.
    if (decision === "rejected") {
      if (requesterId) {
        await notify(
          requesterId,
          "finance.expense_rejected",
          "Expense Request Rejected",
          `Your expense request "${expense.title}" was rejected. Reason: ${reason || "No reason provided."}`,
          requesterLink,
        );
      }

      return;
    }

    // Payment is a separate action after final approval.
    if (decision === "paid") {
      if (requesterId) {
        await notify(
          requesterId,
          "finance.expense_paid",
          "Expense Payment Recorded",
          `Payment for your expense request "${expense.title}" of UGX ${Number(expense.amount).toLocaleString()} has been recorded by the Treasurer.`,
          requesterLink,
        );
      }

      return;
    }

    if (decision !== "approved") return;

    // Notify the requester after every successful approval stage.
    if (requesterId) {
      const approvedStageName =
        EXPENSE_STAGE_NAMES[approvedStage] || "approval";

      await notify(
        requesterId,
        "finance.expense_stage_approved",
        "Expense Request Progress Updated",
        `Your expense request "${expense.title}" has passed the ${approvedStageName} approval stage. Its next stage is ${EXPENSE_STAGE_NAMES[nextStage] || nextStage || "final processing"}.`,
        requesterLink,
      );
    }

    // Final approval means the request is awaiting payment.
    // Notify every active Treasurer, including the original requester
    // if that person also holds the Treasurer leadership role.
    if (nextStage === "payment") {
      const treasurers = await getExpenseApprovalRecipients("treasurer");

      for (const treasurer of treasurers) {
        await notify(
          treasurer.id,
          "finance.expense_payment_required",
          "Expense Awaiting Payment",
          `The Super Admin has granted final approval for "${expense.title}" amounting to UGX ${Number(expense.amount).toLocaleString()}. Please arrange and record the payment.`,
          "/admin/finance",
        );
      }

      if (treasurers.length === 0) {
        logger.warn(
          { expenseId: expense.id },
          "No active Treasurer found to receive the payment notification",
        );
      }

      return;
    }

    // Notify the next approval stage.
    if (nextStage) {
      await notifyExpenseStageApprovers({
        expense,
        stage: nextStage,
        excludeUserId: actorUserId,
        additionalExcludeUserId: requesterId,
      });
    }
  } catch (err) {
    logger.error(
      { err, expenseId: expense?.id, decision },
      "Failed to send expense approval decision notifications",
    );
  }
}

// Compatibility exports for existing controller references.
// These can be removed after the controller is updated.
export function notifyExpenseRejected({ userId, reason }) {
  return notify(
    userId,
    "finance.expense_rejected",
    "Expense Request Rejected",
    `Your expense request was rejected. Reason: ${reason}`,
    "/admin/finance",
  );
}

export function notifyExpenseRejectedBySuperAdmin({ chairpersonId, reason }) {
  return notify(
    chairpersonId,
    "finance.expense_rejected_overturned",
    "Expense Rejection Overridden",
    `An expense you previously approved was rejected by the Super Admin. Reason: ${reason}`,
    "/admin/finance",
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
    const recipients = await getProjectApprovalRecipients(stage, excludeUserId);

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
