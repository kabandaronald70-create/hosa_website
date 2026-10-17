// POST /api/saved to save an item; DELETE /api/saved/:id to remove one.

import { getMe } from "./apiAuth.js";

export async function saveItem(itemType, itemId) {
  const { user } = await getMe();
  if (!user) {
    // Guest: send them to the login page with a return URL.
    const ret = encodeURIComponent(
      window.location.pathname + window.location.hash,
    );
    window.location.href = `/login?next=${ret}`;
    return { ok: false, reason: "login_required" };
  }
  const res = await fetch("/api/saved", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ item_type: itemType, item_id: itemId }),
  });
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({}));
    return { ok: false, reason: error || "save_failed" };
  }
  return res.json();
}

export async function unsaveItem(savedId) {
  const res = await fetch(`/api/saved/${encodeURIComponent(savedId)}`, {
    method: "DELETE",
    credentials: "same-origin",
  });
  if (!res.ok) return { ok: false };
  return res.json();
}

export function unsaveByLookup(savedList, itemType, itemId) {
  const found = savedList.find(
    (s) => s.item_type === itemType && String(s.item_id) === String(itemId),
  );
  return found ? unsaveItem(found.id) : Promise.resolve({ ok: false });
}
