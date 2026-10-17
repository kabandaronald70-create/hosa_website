// POST /api/rsvp/:slug with { status: 'going'|'maybe'|'cancelled' }
// DELETE /api/rsvp/:slug to clear.

import { getMe } from "./apiAuth.js";

export async function setRsvp(slug, status) {
  const { user } = await getMe();
  if (!user) {
    const ret = encodeURIComponent(
      window.location.pathname + window.location.hash,
    );
    window.location.href = `/login?next=${ret}`;
    return { ok: false, reason: "login_required" };
  }
  const res = await fetch(`/api/rsvp/${encodeURIComponent(slug)}`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({}));
    return { ok: false, reason: error || "rsvp_failed" };
  }
  return res.json();
}

export async function clearRsvp(slug) {
  const res = await fetch(`/api/rsvp/${encodeURIComponent(slug)}`, {
    method: "DELETE",
    credentials: "same-origin",
  });
  if (!res.ok) return { ok: false };
  return res.json();
}
