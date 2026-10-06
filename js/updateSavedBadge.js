// Updates the "Saved" badge in the nav based on localStorage.

import Storage from "./Storage.js";

export function updateSavedBadge() {
  const badge = document.querySelector("#saved-count");
  if (!badge) return;

  const count = Storage.getFavourites().length;
  badge.textContent = String(count);
  badge.hidden = count === 0;
}
