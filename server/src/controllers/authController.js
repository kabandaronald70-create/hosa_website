import { registerMember, loginUser } from "../services/authService.js";

import {
  registerSchema,
  loginSchema,
  flattenZodError,
} from "../validators/authValidators.js";

import { logger } from "../utils/logger.js";

import {
  EAST_AFRICAN_COUNTRIES,
  UGANDA_DISTRICTS,
  UGANDA_CITIES,
  NATIONALITY_OPTIONS,
} from "../constants/registrationOptions.js";

// ---------------------------------------------------------------------------
// Registration helpers
// ---------------------------------------------------------------------------

function normalizeRegistrationBody(body = {}) {
  const normalized = { ...body };

  // Express may represent one selected checkbox as a string and multiple
  // selected checkboxes as an array.
  if (typeof normalized.interests === "string") {
    normalized.interests = [normalized.interests];
  } else if (!Array.isArray(normalized.interests)) {
    normalized.interests = [];
  }

  return normalized;
}

function getRegistrationValues(body = {}) {
  const fields = [
    "first_name",
    "last_name",
    "other_name",

    "school_status",
    "admission_year",
    "last_class_attended",
    "last_class_explanation",
    "completion_year",
    "expected_completion_year",
    "school_house",
    "school_house_other",
    "examination_level",
    "examination_level_other",
    "examination_year",
    "examination_index_number",
    "former_teacher",

    "email",
    "phone",
    "whatsapp_phone",
    "country_code",
    "district",
    "town_city",
    "town_city_other",
    "region",
    "preferred_contact",
    "nationality",
    "nationality_other",

    "employment_status",
    "profession",
    "highest_education",
    "specialization",
    "organization",
    "skills",
    "business_owner",
    "business_name",
    "business_category",
    "business_description",
    "business_website",

    "interests",
    "mentor_opt_in",
    "seeking_mentorship",
    "volunteer_opt_in",
    "school_project_support",

    "username",
    "terms_accepted",
    "privacy_accepted",
    "declaration_accepted",
    "public_visibility",
  ];

  const values = Object.fromEntries(
    fields.map((field) => [field, body[field] ?? ""]),
  );

  // Never preserve passwords or password confirmations.
  values.password = "";
  values.confirm_password = "";

  return values;
}

// ---------------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------------

export function showRegisterForm(req, res) {
  res.render("auth/register", {
    title: "Register — HOSA",
    registrationPage: true,
    eastAfricanCountries: EAST_AFRICAN_COUNTRIES,
    ugandaDistricts: UGANDA_DISTRICTS,
    ugandaCities: UGANDA_CITIES,
    nationalityOptions: NATIONALITY_OPTIONS,
    values: getRegistrationValues(),
    fieldErrors: {},
    layout: "layouts/public",
  });
}

export async function submitRegister(req, res, next) {
  const normalizedBody = normalizeRegistrationBody(req.body);
  const values = getRegistrationValues(normalizedBody);

  const parsed = registerSchema.safeParse(normalizedBody);

  if (!parsed.success) {
    const { fieldErrors } = flattenZodError(parsed.error);

    return res.status(400).render("auth/register", {
      title: "Register — HOSA",
      registrationPage: true,
      eastAfricanCountries: EAST_AFRICAN_COUNTRIES,
      ugandaDistricts: UGANDA_DISTRICTS,
      ugandaCities: UGANDA_CITIES,
      nationalityOptions: NATIONALITY_OPTIONS,
      values,
      fieldErrors,
      layout: "layouts/public",
    });
  }

  const data = parsed.data;

  const input = {
    // Account
    email: data.email,
    username: data.username,
    password: data.password,

    // Personal
    firstName: data.first_name,
    lastName: data.last_name,
    otherName: data.other_name ?? null,

    // School
    schoolStatus: data.school_status,
    admissionYear: data.admission_year,
    completionYear: data.completion_year ?? null,
    expectedCompletionYear: data.expected_completion_year ?? null,
    lastClassAttended: data.last_class_attended,
    lastClassExplanation: data.last_class_explanation ?? null,
    schoolHouse: data.school_house ?? null,
    schoolHouseOther: data.school_house_other ?? null,
    examinationLevel: data.examination_level ?? null,
    examinationLevelOther: data.examination_level_other ?? null,
    examinationYear: data.examination_year ?? null,
    examinationIndexNumber: data.examination_index_number ?? null,
    formerTeacher: data.former_teacher ?? null,

    // Contact
    district: data.district,
    countryCode: data.country_code,
    townCity:
      data.town_city === "Other"
        ? data.town_city_other.trim()
        : data.town_city || null,

    nationality:
      data.nationality === "Other"
        ? data.nationality_other.trim()
        : data.nationality || null,
    phone: data.phone,
    whatsappPhone: data.whatsapp_phone ?? null,
    preferredContact: data.preferred_contact ?? null,
    region: data.region,

    // Professional
    employmentStatus: data.employment_status,
    profession: data.profession,
    highestEducation: data.highest_education ?? null,
    specialization: data.specialization ?? null,
    organization: data.organization ?? null,
    skills: data.skills ?? null,

    // Business ownership information.
    // This does not create or publish a business listing.
    businessOwner: data.business_owner,
    businessName: data.business_name ?? null,
    businessCategory: data.business_category ?? null,
    businessDescription: data.business_description ?? null,
    businessWebsite: data.business_website ?? null,

    // Interests and participation
    interests: data.interests,
    mentorOptIn: data.mentor_opt_in ?? false,
    seekingMentorship: data.seeking_mentorship ?? false,
    volunteerOptIn: data.volunteer_opt_in ?? false,
    schoolProjectSupport: data.school_project_support ?? false,

    // Directory visibility is independent of policy acceptance.
    publicVisibility: data.public_visibility ?? false,
  };

  try {
    const { user } = await registerMember(input);

    // No email verification. New accounts remain pending administrator
    // approval and cannot access restricted member resources yet.
    req.session.regenerate((err) => {
      if (err) return next(err);

      req.session.userId = user.id;
      req.session.flash = {
        success:
          "Your registration has been submitted successfully. An administrator will review your membership application.",
      };

      return res.redirect("/");
    });
  } catch (err) {
    if (err.code === "EMAIL_TAKEN" || err.code === "USERNAME_TAKEN") {
      const field = err.code === "EMAIL_TAKEN" ? "email" : "username";

      return res.status(409).render("auth/register", {
        title: "Register — HOSA",
        registrationPage: true,
        eastAfricanCountries: EAST_AFRICAN_COUNTRIES,
        ugandaDistricts: UGANDA_DISTRICTS,
        ugandaCities: UGANDA_CITIES,
        nationalityOptions: NATIONALITY_OPTIONS,
        values,
        fieldErrors: {
          [field]:
            field === "email"
              ? "That email address is already registered."
              : "That username is already taken. Please choose another.",
        },
        layout: "layouts/public",
      });
    }

    logger.error({ err }, "Registration failed");
    return next(err);
  }
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

export function showLoginForm(req, res) {
  const next_ = typeof req.query.next === "string" ? req.query.next : "";

  res.render("auth/login", {
    title: "Log in — HOSA",
    values: { identifier: "" },
    fieldErrors: {},
    next: next_,
    layout: "layouts/public",
  });
}

export async function submitLogin(req, res, next) {
  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    const { fieldErrors } = flattenZodError(parsed.error);

    return res.status(400).render("auth/login", {
      title: "Log in — HOSA",
      values: {
        identifier:
          typeof req.body.identifier === "string" ? req.body.identifier : "",
      },
      fieldErrors,
      next: req.body.next || "",
      layout: "layouts/public",
    });
  }

  try {
    const { user } = await loginUser(parsed.data);

    req.session.regenerate((err) => {
      if (err) return next(err);

      req.session.userId = user.id;

      // Pending members may sign in but cannot access protected membership
      // resources until an authorized administrator approves them.
      if (!user.membership_approved_at) {
        req.session.flash = {
          error: "Your account is pending administrator approval.",
        };

        return res.redirect("/pending-approval");
      }

      req.session.flash = {
        success: "Welcome back!",
      };

      const destination = sanitizeNext(req.body.next) || "/dashboard";

      return res.redirect(destination);
    });
  } catch (err) {
    if (err.code === "INVALID_CREDENTIALS" || err.code === "ACCOUNT_INACTIVE") {
      return res.status(401).render("auth/login", {
        title: "Log in — HOSA",
        values: {
          identifier: parsed.data.identifier,
        },
        fieldErrors: {
          _form: "Invalid username/email or password.",
        },
        next: req.body.next || "",
        layout: "layouts/public",
      });
    }

    logger.error({ err }, "Login failed");
    return next(err);
  }
}

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------

export function logout(req, res, next) {
  if (!req.session) return res.redirect("/");

  req.session.destroy((err) => {
    if (err) return next(err);

    res.clearCookie("hosa.sid");
    return res.redirect("/");
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sanitizeNext(value) {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;

  return value;
}
