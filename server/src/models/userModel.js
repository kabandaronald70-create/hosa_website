import { query, withTransaction } from "../config/db.js";

export function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

export async function findUserByEmail(emailNormalized) {
  const { rows } = await query(
    `SELECT id, email, email_normalized, password_hash, membership_approved_at,
            status, created_at, updated_at, last_login_at
       FROM users
      WHERE email_normalized = $1
      LIMIT 1`,
    [emailNormalized],
  );
  return rows[0] || null;
}

export async function findUserByUsername(username) {
  const { rows } = await query(
    `SELECT id, username, email, email_normalized, password_hash,
            membership_approved_at, status, created_at, updated_at,
            last_login_at
       FROM users
      WHERE LOWER(username) = LOWER($1)
      LIMIT 1`,
    [String(username).trim()],
  );

  return rows[0] || null;
}

export async function findUserByIdentifier(identifier) {
  const normalized = String(identifier).trim().toLowerCase();

  const { rows } = await query(
    `SELECT id, username, email, email_normalized, password_hash,
            membership_approved_at, status, created_at, updated_at,
            last_login_at
       FROM users
      WHERE email_normalized = $1
         OR LOWER(username) = $1
      ORDER BY CASE WHEN email_normalized = $1 THEN 0 ELSE 1 END
      LIMIT 1`,
    [normalized],
  );

  return rows[0] || null;
}
export async function findUserById(id) {
  const { rows } = await query(
    `SELECT id, email, email_normalized, password_hash, membership_approved_at,
            status, created_at, updated_at, last_login_at
       FROM users
      WHERE id = $1
      LIMIT 1`,
    [id],
  );
  return rows[0] || null;
}

export async function getRolesForUser(userId) {
  const { rows } = await query(
    `SELECT r.name
       FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = $1
      ORDER BY r.name`,
    [userId],
  );
  return rows.map((r) => r.name);
}

export async function getProfileForUser(userId) {
  const { rows } = await query(
    `SELECT user_id, first_name, last_name, display_name, graduation_year,
            biography, profession, organization, district, country_code,
            mentor_opt_in, public_visibility,
            avatar_path, created_at, updated_at,
            -- Phase 4A Privacy and Profile Extensions:
            phone, preferred_contact, skills, career_history,
            email_privacy, phone_privacy, district_privacy
       FROM member_profiles
      WHERE user_id = $1
      LIMIT 1`,
    [userId],
  );
  return rows[0] || null;
}

/**
 * Register a member atomically:
 *  - insert user (with pending_approval status)
 *  - insert member_profile
 *  - grant 'member' role (plus 'mentor' if mentorOptIn)
 * Runs in a single transaction; any failure rolls everything back.
 */
/**
 * Register a member atomically:
 *  - insert user (with pending_approval status)
 *  - insert member_profile
 *  - insert school_records
 *  - grant 'member' role (plus 'mentor' if mentorOptIn)
 * Runs in a single transaction; any failure rolls everything back.
 */
export async function createMember({
  email,
  username,
  passwordHash,

  firstName,
  lastName,
  otherName,

  graduationYear,

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
  publicVisibility,

  termsVersion,
  privacyVersion,
  declarationVersion,
}) {
  const emailNormalized = normalizeEmail(email);
  const normalizedUsername = String(username).trim();

  return withTransaction(async (client) => {
    // -------------------------------------------------------
    // 1. Create the account.
    // -------------------------------------------------------

    const userRes = await client.query(
      `INSERT INTO users (
         username,
         email,
         email_normalized,
         password_hash,
         status
       )
       VALUES ($1, $2, $3, $4, 'pending_approval')
       RETURNING
         id,
         username,
         email,
         email_normalized,
         status,
         created_at`,
      [normalizedUsername, email.trim(), emailNormalized, passwordHash],
    );

    const user = userRes.rows[0];

    // -------------------------------------------------------
    // 2. Create the complete member profile.
    // -------------------------------------------------------

    await client.query(
      `INSERT INTO member_profiles (
         user_id,
         first_name,
         last_name,
         other_name,
         graduation_year,

         district,
         country_code,
         town_city,
         nationality,
         phone,
         whatsapp_phone,
         preferred_contact,
         region,

         profession,
         organization,
         employment_status,
         highest_education,
         specialization,

         mentor_opt_in,
         seeking_mentorship,
         volunteer_opt_in,
         school_project_support,

         business_owner,
         business_name,
         business_category,
         business_description,
         business_website,

         public_visibility,
         skills
       )
       VALUES (
         $1, $2, $3, $4, $5,
         $6, $7, $8, $9, $10, $11, $12, $13,
         $14, $15, $16, $17, $18,
         $19, $20, $21, $22,
         $23, $24, $25, $26, $27,
         $28,
         $29
       )`,
      [
        user.id,
        firstName,
        lastName,
        otherName ?? null,
        graduationYear ?? null,

        district ?? null,
        countryCode ?? null,
        townCity ?? null,
        nationality ?? null,
        phone ?? null,
        whatsappPhone ?? null,
        preferredContact ?? null,
        region ?? null,

        profession,
        organization ?? null,
        employmentStatus,
        highestEducation ?? null,
        specialization ?? null,

        Boolean(mentorOptIn),
        Boolean(seekingMentorship),
        Boolean(volunteerOptIn),
        Boolean(schoolProjectSupport),

        businessOwner,
        businessOwner ? businessName : null,
        businessOwner ? businessCategory : null,
        businessOwner ? (businessDescription ?? null) : null,
        businessOwner ? (businessWebsite ?? null) : null,

        Boolean(publicVisibility),

        skills ?? null,
      ],
    );

    // -------------------------------------------------------
    // 3. Save school information.
    // -------------------------------------------------------

    await client.query(
      `INSERT INTO school_records (
         user_id,
         admission_year,
         completion_year,
         expected_completion_year,
         last_class_attended,
         last_class_explanation,
         school_house,
         school_house_other,
         examination_level,
         examination_level_other,
         examination_year,
         examination_index_number,
         former_teacher,
         school_status
       )
       VALUES (
         $1, $2, $3, $4, $5, $6, $7,
         $8, $9, $10, $11, $12, $13, $14
       )`,
      [
        user.id,
        admissionYear,
        completionYear ?? null,
        expectedCompletionYear ?? null,
        lastClassAttended,
        lastClassExplanation ?? null,
        schoolHouse ?? null,
        schoolHouseOther ?? null,
        examinationLevel ?? null,
        examinationLevelOther ?? null,
        examinationYear ?? null,
        examinationIndexNumber ?? null,
        formerTeacher ?? null,
        schoolStatus,
      ],
    );

    // -------------------------------------------------------
    // 4. Save selected member interests.
    // -------------------------------------------------------

    await client.query(
      `INSERT INTO member_interests (
         user_id,
         interest
       )
       SELECT $1, selected_interest
       FROM UNNEST($2::text[]) AS selected(selected_interest)`,
      [user.id, interests],
    );

    // -------------------------------------------------------
    // 5. Record registration policy acceptances.
    // -------------------------------------------------------

    await client.query(
      `INSERT INTO registration_acceptances (
         user_id,
         terms_version,
         terms_accepted_at,
         privacy_version,
         privacy_accepted_at,
         declaration_version,
         declaration_accepted_at
       )
       VALUES (
         $1, $2, NOW(), $3, NOW(), $4, NOW()
       )`,
      [user.id, termsVersion, privacyVersion, declarationVersion],
    );

    // -------------------------------------------------------
    // 6. Assign membership roles.
    // -------------------------------------------------------

    const roleNames = ["member"];

    if (mentorOptIn) {
      roleNames.push("mentor");
    }

    const roleResult = await client.query(
      `INSERT INTO user_roles (user_id, role_id)
       SELECT $1, id
       FROM roles
       WHERE name = ANY($2::text[])
       RETURNING role_id`,
      [user.id, roleNames],
    );

    if (roleResult.rowCount !== roleNames.length) {
      throw new Error(
        "One or more required registration roles could not be assigned.",
      );
    }

    return {
      user,
      roles: roleNames,
    };
  });
}

export async function touchLastLogin(userId) {
  await query(`UPDATE users SET last_login_at = now() WHERE id = $1`, [userId]);
}

export async function updateUserPassword(userId, newPasswordHash) {
  await query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [
    newPasswordHash,
    userId,
  ]);
}
