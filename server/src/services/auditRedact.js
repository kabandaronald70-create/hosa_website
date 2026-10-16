// Keys we never display in audit metadata, even if somehow stored.
const SECRET_KEY_PATTERNS = [
  /password/i,
  /passwd/i,
  /secret/i,
  /token/i,
  /api[_-]?key/i,
  /service[_-]?role/i,
  /session/i,
  /cookie/i,
];

/**
 * Return a shallow-copied object with secret-ish values replaced.
 * Nested objects are redacted one level deep; deeper nesting is stringified.
 */
export function redactMetadata(metadata) {
  if (!metadata || typeof metadata !== "object") return {};
  const out = {};
  for (const [k, v] of Object.entries(metadata)) {
    if (SECRET_KEY_PATTERNS.some((re) => re.test(k))) {
      out[k] = "[REDACTED]";
    } else if (v && typeof v === "object" && !Array.isArray(v)) {
      const nested = {};
      for (const [nk, nv] of Object.entries(v)) {
        nested[nk] = SECRET_KEY_PATTERNS.some((re) => re.test(nk))
          ? "[REDACTED]"
          : nv;
      }
      out[k] = nested;
    } else {
      out[k] = v;
    }
  }
  return out;
}

/** CSV cell: stringify, escape quotes, wrap in quotes, strip newlines. */
export function toCsvCell(value) {
  if (value == null) return "";
  const s = typeof value === "string" ? value : JSON.stringify(value);
  return `"${s.replace(/\r?\n/g, " ").replace(/"/g, '""')}"`;
}
