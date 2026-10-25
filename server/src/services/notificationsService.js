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
