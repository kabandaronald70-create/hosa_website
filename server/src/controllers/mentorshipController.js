import {
  getMentorPublicById,
  createRequest,
  getRequestById,
  setRequestStatus,
  listMyRequests,
} from "../models/mentorshipModel.js";
import { logger } from "../utils/logger.js";

export function showNewRequestForm(req, res, next) {
  getMentorPublicById(req.query.mentor)
    .then((mentor) => {
      if (!mentor) {
        req.flash("error", "Mentor not found or not accepting requests.");
        return res.redirect("/directory");
      }
      res.render("mentorship/request-new", {
        title: `Request mentorship from ${mentor.display_name || mentor.first_name}`,
        mentor,
        values: {},
        fieldErrors: {},
      });
    })
    .catch(next);
}

export async function submitNewRequest(req, res, next) {
  try {
    const mentorId = req.body.mentor_id;
    const mentor = await getMentorPublicById(mentorId);
    if (!mentor) {
      req.flash("error", "Mentor not found.");
      return res.redirect("/directory");
    }

    const fieldOfInterest = (req.body.field_of_interest || "")
      .trim()
      .slice(0, 200);
    const goals = (req.body.goals || "").trim().slice(0, 2000);

    const fieldErrors = {};
    if (!fieldOfInterest)
      fieldErrors.field_of_interest =
        "Describe the area you want mentorship in.";
    if (goals.length < 20)
      fieldErrors.goals =
        "Please write at least 20 characters about your goals.";

    if (Object.keys(fieldErrors).length > 0) {
      return res.status(400).render("mentorship/request-new", {
        title: `Request mentorship from ${mentor.display_name || mentor.first_name}`,
        mentor,
        values: req.body,
        fieldErrors,
      });
    }

    await createRequest({
      requesterId: req.user.id,
      mentorId,
      fieldOfInterest,
      goals,
    });
    req.flash("success", "Mentorship request sent.");
    res.redirect("/dashboard/mentorship/requests");
  } catch (err) {
    if (err.status === 409 || err.status === 400) {
      req.flash("error", err.message);
      return res.redirect("/directory");
    }
    logger.error({ err }, "Mentorship request failed");
    next(err);
  }
}

export async function showMyRequests(req, res, next) {
  try {
    const { sent, received } = await listMyRequests(req.user.id);
    res.render("mentorship/requests-list", {
      title: "Mentorship requests",
      sent,
      received,
    });
  } catch (err) {
    next(err);
  }
}

export async function actionAccept(req, res, next) {
  return transition(
    req,
    res,
    next,
    "accepted",
    "request.mentor_user_id",
    "Accepted.",
  );
}

export async function actionDecline(req, res, next) {
  return transition(
    req,
    res,
    next,
    "declined",
    "request.mentor_user_id",
    "Declined.",
  );
}

export async function actionCancel(req, res, next) {
  return transition(
    req,
    res,
    next,
    "cancelled",
    "request.requester_user_id",
    "Cancelled.",
  );
}

async function transition(req, res, next, nextStatus, ownerField, successMsg) {
  try {
    const request = await getRequestById(req.params.id);
    if (!request) {
      req.flash("error", "Request not found.");
      return res.redirect("/dashboard/mentorship/requests");
    }
    // ownerField = 'request.mentor_user_id' etc. Parse the tail.
    const field = ownerField.split(".")[1];
    if (request[field] !== req.user.id) {
      req.flash("error", "You do not have permission to do that.");
      return res.redirect("/dashboard/mentorship/requests");
    }
    // Enforce status transitions.
    if (nextStatus === "accepted" && request.status !== "pending") {
      req.flash("error", "Only pending requests can be accepted.");
      return res.redirect("/dashboard/mentorship/requests");
    }
    if (nextStatus === "declined" && request.status !== "pending") {
      req.flash("error", "Only pending requests can be declined.");
      return res.redirect("/dashboard/mentorship/requests");
    }
    if (
      nextStatus === "cancelled" &&
      !["pending", "accepted"].includes(request.status)
    ) {
      req.flash("error", "This request can no longer be cancelled.");
      return res.redirect("/dashboard/mentorship/requests");
    }

    await setRequestStatus(request.id, nextStatus);
    req.flash("success", successMsg);
    res.redirect("/dashboard/mentorship/requests");
  } catch (err) {
    next(err);
  }
}
