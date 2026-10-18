import {
  addSavedItem,
  removeSavedItem,
  listMySavedEnriched,
} from "../models/savedItemModel.js";

const VALID_TYPES = ["event", "story", "opportunity", "member"];

export async function addSaved(req, res, next) {
  try {
    const itemType = req.body.item_type;
    const itemId = req.body.item_id;
    if (!VALID_TYPES.includes(itemType) || !itemId) {
      req.flash("error", "Invalid saved item.");
      return res.redirect("back");
    }
    await addSavedItem(req.user.id, itemType, String(itemId));
    req.flash("success", "Saved.");
    res.redirect("back");
  } catch (err) {
    next(err);
  }
}

export async function removeSaved(req, res, next) {
  try {
    await removeSavedItem(req.user.id, req.params.id);

    // Always return JSON for the AJAX request from public.js
    if (req.headers.accept?.includes("application/json") || req.xhr) {
      return res.json({ ok: true });
    }

    req.flash("success", "Removed from saved items.");
    res.redirect("/dashboard/saved");
  } catch (err) {
    next(err);
  }
}

export async function showMySaved(req, res, next) {
  try {
    const grouped = await listMySavedEnriched(req.user.id);
    res.render("saved/list", {
      title: "Saved items",
      grouped,
      layout: "layouts/app", // ← Added
    });
  } catch (err) {
    next(err);
  }
}
