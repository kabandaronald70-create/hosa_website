import {
  createMember,
  findUserByEmail,
  getRolesForUser,
  getProfileForUser,
  touchLastLogin,
} from "../models/userModel.js";
import {
  hashPassword,
  verifyPassword,
  getDummyHash,
} from "./passwordService.js";

/**
 * Register a new member.
 * Throws { status, code, message } shaped errors so controllers can map them.
 */
export async function registerMember({
  email,
  password,
  firstName,
  lastName,
  graduationYear,
  district,
  countryCode,
  mentorOptIn,
}) {
  const existing = await findUserByEmail(email.trim().toLowerCase());
  if (existing) {
    const err = new Error("An account with that email already exists.");
    err.status = 409;
    err.code = "EMAIL_TAKEN";
    throw err;
  }

  const passwordHash = await hashPassword(password);

  const { user, roles } = await createMember({
    email: email.trim(),
    passwordHash,
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    graduationYear,
    district,
    countryCode,
    mentorOptIn,
  });

  return { user, roles };
}

/**
 * Authenticate an email/password pair.
 * Returns { user, roles } on success, or throws a generic INVALID_CREDENTIALS error.
 * Never reveals whether the email exists.
 */
export async function loginUser({ email, password }) {
  const user = await findUserByEmail(email.trim().toLowerCase());

  // Always run a verification so timing doesn't leak whether the email exists.
  const hashToVerify = user ? user.password_hash : await getDummyHash();
  const ok = await verifyPassword(hashToVerify, password);

  if (!user || !ok) {
    const err = new Error("Invalid email or password.");
    err.status = 401;
    err.code = "INVALID_CREDENTIALS";
    throw err;
  }

  if (user.status !== "active") {
    const err = new Error(
      "This account is not active. Please contact support.",
    );
    err.status = 403;
    err.code = "ACCOUNT_INACTIVE";
    throw err;
  }

  await touchLastLogin(user.id);

  const roles = await getRolesForUser(user.id);
  return { user, roles };
}

export async function getSessionUser(userId) {
  const profile = await getProfileForUser(userId);
  const roles = await getRolesForUser(userId);
  return { profile, roles };
}
