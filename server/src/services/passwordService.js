import argon2 from "argon2";

// argon2id with tuned parameters.
// OWASP minimum for argon2id: m=47104 (46 MiB), t=1, p=1.
// We use stronger: m=65536 (64 MiB), t=3, p=4.
const ARGON2_OPTIONS = Object.freeze({
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
});

const MIN_PASSWORD_LENGTH = 10;
const MAX_PASSWORD_LENGTH = 200;

export function validatePasswordStrength(password) {
  if (typeof password !== "string") return "Password must be a string.";
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Password must be at most ${MAX_PASSWORD_LENGTH} characters.`;
  }
  return null;
}

export async function hashPassword(password) {
  return argon2.hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(hash, password) {
  try {
    return await argon2.verify(hash, password);
  } catch {
    // Malformed hash → treat as verification failure, never throw.
    return false;
  }
}

// A pre-computed hash used to burn CPU when a user doesn't exist.
// This prevents user-enumeration via response timing.
let _dummyHash = null;
export async function getDummyHash() {
  if (!_dummyHash) {
    _dummyHash = await hashPassword("this-is-not-a-real-password");
  }
  return _dummyHash;
}
