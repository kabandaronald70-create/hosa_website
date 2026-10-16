import { slugExists } from "../models/adminModel.js";

export function slugify(text) {
  return (
    String(text)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "event"
  );
}

/**
 * Return a slug that doesn't exist yet. Appends -2, -3, ... on conflict.
 * Caps at -50 to avoid pathological loops.
 */
export async function uniqueEventSlug(baseTitle) {
  const base = slugify(baseTitle);
  if (!(await slugExists(base))) return base;
  for (let n = 2; n <= 50; n += 1) {
    const candidate = `${base}-${n}`;
    if (!(await slugExists(candidate))) return candidate;
  }
  // Fallback: add a short random suffix.
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base}-${suffix}`;
}
