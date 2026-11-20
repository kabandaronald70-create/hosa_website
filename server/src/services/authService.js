import {
  createMember,
  findUserByEmail,
  findUserByUsername,
  findUserByIdentifier,
  getRolesForUser,
  getProfileForUser,
  touchLastLogin,
} from "../models/userModel.js";

import {
  hashPassword,
  verifyPassword,
  getDummyHash,
} from "./passwordService.js";

const REGISTRATION_POLICY_VERSIONS = Object.freeze({
  terms: "2026-11",
  privacy: "2026-11",
  declaration: "1.0",
});

function createRegistrationError(message, code, status = 400) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

/**
 * Register a new HOSA member.
 *
 * Registration is atomic through createMember().
 * New accounts remain pending approval until authorized administrators
 * approve their membership.
 *
 * Email verification is intentionally not required.
 */
export async function registerMember({
  email,
  username,
  password,

  firstName,
  lastName,
  otherName,

  schoolStatus,
  admissionYear,
  completionYear,
  expectedCompletionYear,
  lastClassAttended,
  lastClassExplanation,
  schoolHouse,
  schoolHouseOther,
  examinationLevel,
  examinationLevelOther,
  examinationYear,
  examinationIndexNumber,
  formerTeacher,

  district,
  countryCode,
  townCity,
  nationality,
  phone,
  whatsappPhone,
  preferredContact,
  region,

  employmentStatus,
  profession,
  highestEducation,
  specialization,
  organization,
  skills,

  businessOwner,
  businessName,
  businessCategory,
  businessDescription,
  businessWebsite,

  mentorOptIn,
  seekingMentorship,
  volunteerOptIn,
  schoolProjectSupport,

  interests,
  publicVisibility,
}) {
  // Basic service-level checks. Full validation happens in authValidators.js.
  if (
    !email ||
    !username ||
    !password ||
    !firstName ||
    !lastName ||
    !schoolStatus ||
    !admissionYear ||
    !lastClassAttended ||
    !district ||
    !countryCode ||
    !region ||
    !employmentStatus ||
    !profession ||
    typeof businessOwner !== "boolean" ||
    !Array.isArray(interests) ||
    interests.length === 0
  ) {
    throw createRegistrationError(
      "Registration payload is incomplete.",
      "INCOMPLETE_PAYLOAD",
    );
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedUsername = username.trim();

  // Check email and username availability.
  const [existingEmail, existingUsername] = await Promise.all([
    findUserByEmail(normalizedEmail),
    findUserByUsername(normalizedUsername),
  ]);

  if (existingEmail) {
    throw createRegistrationError(
      "An account with that email already exists.",
      "EMAIL_TAKEN",
      409,
    );
  }

  if (existingUsername) {
    throw createRegistrationError(
      "That username is already taken. Please choose another.",
      "USERNAME_TAKEN",
      409,
    );
  }

  // Hash the password before creating the account.
  const passwordHash = await hashPassword(password);

  try {
    const { user, roles } = await createMember({
      email: normalizedEmail,
      username: normalizedUsername,
      passwordHash,

      firstName: firstName.trim(),
      lastName: lastName.trim(),
      otherName,

      // Only actual completion year is mirrored to member_profiles.
      graduationYear: schoolStatus === "old_student" ? completionYear : null,

      admissionYear,

      completionYear: schoolStatus === "old_student" ? completionYear : null,

      expectedCompletionYear:
        schoolStatus === "current_student" ? expectedCompletionYear : null,

      lastClassAttended,
      lastClassExplanation,
      schoolHouse,
      schoolHouseOther,
      examinationLevel,
      examinationLevelOther,
      examinationYear,
      examinationIndexNumber,
      formerTeacher,
      schoolStatus,

      district,
      countryCode,
      townCity,
      nationality,
      phone,
      whatsappPhone,
      preferredContact,
      region,

      employmentStatus,
      profession,
      highestEducation,
      specialization,
      organization,
      skills,

      businessOwner,
      businessName,
      businessCategory,
      businessDescription,
      businessWebsite,

      mentorOptIn,
      seekingMentorship,
      volunteerOptIn,
      schoolProjectSupport,

      interests,

      publicVisibility: Boolean(publicVisibility),

      termsVersion: REGISTRATION_POLICY_VERSIONS.terms,
      privacyVersion: REGISTRATION_POLICY_VERSIONS.privacy,
      declarationVersion: REGISTRATION_POLICY_VERSIONS.declaration,
    });

    return { user, roles };
  } catch (error) {
    // Handle simultaneous registrations using the same email.
    if (
      error.code === "23505" &&
      error.constraint === "users_email_normalized_key"
    ) {
      throw createRegistrationError(
        "That email address is already registered. Please use another email address or log in.",
        "EMAIL_TAKEN",
        409,
      );
    }

    // Handle simultaneous registrations choosing the same username.
    if (
      error.code === "23505" &&
      error.constraint === "users_username_lower_key"
    ) {
      throw createRegistrationError(
        "That username is already taken. Please choose another.",
        "USERNAME_TAKEN",
        409,
      );
    }

    throw error;
  }
}

/**
 * Authenticate using either an email address or username.
 *
 * Active and pending-approval accounts may log in.
 * Suspended and deactivated accounts are blocked.
 */
export async function loginUser({ identifier, password }) {
  const normalizedIdentifier = String(identifier ?? "").trim();

  if (!normalizedIdentifier || !password) {
    throw createRegistrationError(
      "Username/email and password are required.",
      "INCOMPLETE_LOGIN",
    );
  }

  const user = await findUserByIdentifier(normalizedIdentifier);

  // Use a dummy hash when the account does not exist to reduce
  // account-enumeration through response timing.
  const hashToVerify = user ? user.password_hash : await getDummyHash();

  const ok = await verifyPassword(hashToVerify, password);

  if (!user || !ok) {
    throw createRegistrationError(
      "Invalid username/email or password.",
      "INVALID_CREDENTIALS",
      401,
    );
  }

  if (user.status === "suspended" || user.status === "deactivated") {
    throw createRegistrationError(
      "This account is not active. Please contact support.",
      "ACCOUNT_INACTIVE",
      403,
    );
  }

  await touchLastLogin(user.id);

  const roles = await getRolesForUser(user.id);

  return { user, roles };
}

/**
 * Retrieve the authenticated user's profile and roles.
 */
export async function getSessionUser(userId) {
  const profile = await getProfileForUser(userId);
  const roles = await getRolesForUser(userId);

  return { profile, roles };
}
