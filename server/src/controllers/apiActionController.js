import { addSavedItem, removeSavedItem } from "../models/savedItemModel.js";
import {
  getEventBySlugForRsvp,
  upsertRsvp,
  deleteRsvp,
} from "../models/rsvpModel.js";

// ------------------------------- Saved -------------------------------

export async function postSaved(req, res, next) {
  if (!req.user)
    return res.status(401).json({ error: "Authentication required." });
  try {
    const { item_type, item_id } = req.body || {};
    if (!item_type || !item_id) {
      return res
        .status(400)
        .json({ error: "item_type and item_id are required." });
    }
    const saved = await addSavedItem(
      req.user.id,
      String(item_type),
      String(item_id),
    );
    res.json({ ok: true, saved });
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ error: err.message });
    next(err);
  }
}

export async function deleteSaved(req, res, next) {
  if (!req.user)
    return res.status(401).json({ error: "Authentication required." });
  try {
    const removed = await removeSavedItem(req.user.id, req.params.id);
    res.json({ ok: true, removed });
  } catch (err) {
    next(err);
  }
}

// ------------------------------- RSVP -------------------------------

const ALLOWED_RSVP = ["going", "maybe", "cancelled"];

export async function postRsvp(req, res, next) {
  if (!req.user)
    return res.status(401).json({ error: "Authentication required." });
  try {
    const slug = req.params.slug;
    const status = String(req.body?.status || "");
    if (!ALLOWED_RSVP.includes(status)) {
      return res.status(400).json({ error: "Invalid RSVP status." });
    }
    const event = await getEventBySlugForRsvp(slug);
    if (!event) return res.status(404).json({ error: "Event not found." });
    await upsertRsvp(event.id, req.user.id, status);
    res.json({ ok: true, status });
  } catch (err) {
    if (err.code === "EVENT_FULL") {
      return res.status(409).json({ error: "Event is at capacity." });
    }
    next(err);
  }
}

export async function deleteRsvpAction(req, res, next) {
  if (!req.user)
    return res.status(401).json({ error: "Authentication required." });
  try {
    const slug = req.params.slug;
    const event = await getEventBySlugForRsvp(slug);
    if (!event) return res.status(404).json({ error: "Event not found." });
    await deleteRsvp(event.id, req.user.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
