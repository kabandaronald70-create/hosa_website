// Small module the SPA uses to know whether the visitor is logged in,
// and to fetch saved / RSVP state. Everything goes through the same-origin
// Express backend (in prod) or Vite proxy (in dev).

let _mePromise = null;

export async function getMe({ force = false } = {}) {
  if (_mePromise && !force) return _mePromise;
  _mePromise = fetch("/api/me", { credentials: "same-origin" })
    .then((r) => r.json())
    .catch(() => ({ user: null }));
  return _mePromise;
}

export async function isLoggedIn() {
  const { user } = await getMe();
  return user != null;
}

export async function getMySaved() {
  const res = await fetch("/api/me/saved", { credentials: "same-origin" });
  if (!res.ok) return [];
  const { data } = await res.json();
  return data || [];
}

export async function getMyRsvps() {
  const res = await fetch("/api/me/rsvps", { credentials: "same-origin" });
  if (!res.ok) return {};
  const { data } = await res.json();
  return data || {};
}

export function resetMeCache() {
  _mePromise = null;
}
