import { createNotification } from "../models/notificationModel.js";
import { logger } from "../utils/logger.js";

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
