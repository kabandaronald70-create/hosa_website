import {
  getEventBySlugForRsvp,
  upsertRsvp,
  deleteRsvp,
  getMyRsvp,
  getRsvpCounts,
} from "../models/rsvpModel.js";

const ALLOWED = ["going", "maybe", "cancelled"];

export async function setRsvp(req, res, next) {
  try {
    const slug = req.params.slug;
    const status = (req.body.status || "").trim();
    if (!ALLOWED.includes(status)) {
      req.flash("error", "Invalid RSVP status.");
      return res.redirect(`/events/${slug}`);
    }
    const event = await getEventBySlugForRsvp(slug);
    if (!event) {
      req.flash("error", "Event not found.");
      return res.redirect("/events");
    }

    await upsertRsvp(event.id, req.user.id, status);
    req.flash("success", `Your RSVP is now: ${status}.`);
    res.redirect("/dashboard");
  } catch (err) {
    if (err.code === "EVENT_FULL") {
      req.flash("error", "Sorry — this event is at capacity.");
      return res.redirect("/dashboard");
    }
    next(err);
  }
}

export async function cancelRsvp(req, res, next) {
  try {
    const slug = req.params.slug;
    const event = await getEventBySlugForRsvp(slug);
    if (!event) {
      req.flash("error", "Event not found.");
      return res.redirect("/events");
    }
    await deleteRsvp(event.id, req.user.id);
    req.flash("success", "RSVP removed.");
    res.redirect("/dashboard");
  } catch (err) {
    next(err);
  }
}

/** Used by /api/events when the caller is authenticated. */
export async function annotateEventWithUserRsvp(eventRow, userId) {
  if (!userId) return { ...eventRow, userRsvp: null };
  const rsvp = await getMyRsvp(eventRow.id, userId);
  return { ...eventRow, userRsvp: rsvp ? rsvp.status : null };
}

export async function getEventRsvpSummary(req, res, next) {
  try {
    const slug = req.params.slug;
    const event = await getEventBySlugForRsvp(slug);
    if (!event) return res.status(404).json({ error: "Event not found." });
    const counts = await getRsvpCounts(event.id);
    const mine = req.user ? await getMyRsvp(event.id, req.user.id) : null;
    res.json({ counts, userRsvp: mine ? mine.status : null });
  } catch (err) {
    next(err);
  }
}
