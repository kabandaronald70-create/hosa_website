import crypto from "node:crypto";
import { query } from "../config/db.js";

// Generate a random hex string (e.g., 64 chars)
export function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

// Hash the token before saving to DB
export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Save token to DB
export async function createEmailToken(userId, type) {
  const token = generateToken();
  const tokenHash = hashToken(token);

  // Expiry: 24 hours for verification, 1 hour for reset
  const hours = type === "verification" ? 24 : 1;

  await query(
    `INSERT INTO email_tokens (user_id, token_hash, type, expires_at)
     VALUES ($1, $2, $3, now() + interval '${hours} hours')`,
    [userId, tokenHash, type],
  );

  return token; // Return the raw token to be emailed
}

// Verify token from URL
export async function verifyEmailToken(token, type) {
  const tokenHash = hashToken(token);

  const { rows } = await query(
    `SELECT user_id FROM email_tokens
     WHERE token_hash = $1
       AND type = $2
       AND used_at IS NULL
       AND expires_at > now()`,
    [tokenHash, type],
  );

  return rows[0]?.user_id || null;
}

// Mark token as used
export async function markTokenUsed(token) {
  const tokenHash = hashToken(token);
  await query(`UPDATE email_tokens SET used_at = now() WHERE token_hash = $1`, [
    tokenHash,
  ]);
}
