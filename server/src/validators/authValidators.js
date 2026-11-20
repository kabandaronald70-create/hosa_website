import { z } from "zod";
import {
  EAST_AFRICAN_COUNTRIES,
  UGANDA_DISTRICTS,
  UGANDA_CITIES,
  NATIONALITY_OPTIONS,
} from "../constants/registrationOptions.js";

const COUNTRY_CODES = EAST_AFRICAN_COUNTRIES.map(({ code }) => code);
const CITY_OPTIONS = [...UGANDA_CITIES, "Other"];

// ---------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------

const emptyToUndefined = (value) =>
  value === "" || value === null ? undefined : value;

const optionalText = (maxLength, message) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === ""
        ? undefined
        : value,
    z.string().trim().max(maxLength, message).optional(),
  );

const requiredYear = z.preprocess(
  (value) => {
    if (value === "" || value === null || value === undefined) {
      return undefined;
    }

    return Number(value);
  },
  z.number()
    .int("Enter a valid year.")
    .min(1950, "Year cannot be earlier than 1950.")
    .max(2100, "Year cannot be later than 2100."),
);

const optionalYear = z.preprocess(
  (value) => {
    if (value === "" || value === null || value === undefined) {
      return undefined;
    }

    return Number(value);
  },
  z.number()
    .int("Enter a valid year.")
    .min(1950, "Year cannot be earlier than 1950.")
    .max(2100, "Year cannot be later than 2100.")
    .optional(),
);

const checkboxBoolean = z.preprocess(
  (value) =>
    value === true ||
    value === "true" ||
    value === "on" ||
    value === "1",
  z.boolean(),
);

const requiredCheckbox = checkboxBoolean.refine(
  (value) => value === true,
  "This acknowledgement is required.",
);

const businessOwnerBoolean = z.preprocess(
  (value) => {
    if (value === true || value === "true" || value === "yes") {
      return true;
    }

    if (value === false || value === "false" || value === "no") {
      return false;
    }

    return value;
  },
  z.boolean({
    error: "Select whether you own a business.",
  }),
);

// ---------------------------------------------------------
// Registration validation
// ---------------------------------------------------------

export const registerSchema = z
  .object({
    // =====================================================
    // 1. PERSONAL
    // =====================================================

    first_name: z.string()
      .trim()
      .min(2, "First name must have at least 2 characters.")
      .max(60, "First name must not exceed 60 characters."),

    last_name: z.string()
      .trim()
      .min(2, "Last name must have at least 2 characters.")
      .max(60, "Last name must not exceed 60 characters."),

    other_name: optionalText(
      80,
      "Other name must not exceed 80 characters.",
    ),

    // =====================================================
    // 2. SCHOOL
    // =====================================================

    school_status: z.enum(
      ["current_student", "old_student"],
      { error: "Select your school status." },
    ),

    admission_year: requiredYear,

    last_class_attended: z.enum(
      ["S1", "S2", "S3", "S4", "S5", "S6", "other", "not_sure"],
      { error: "Select the last class you attended." },
    ),

    last_class_explanation: optionalText(
      300,
      "Class explanation must not exceed 300 characters.",
    ),

    completion_year: optionalYear,

    expected_completion_year: optionalYear,

    school_house: z.preprocess(
      emptyToUndefined,
      z.enum(
        ["Nyerere", "Nkrumah", "Muteesa", "Lumumba", "Mandela", "Other"],
        { error: "Select a valid school house." },
      ).optional(),
    ),

    school_house_other: optionalText(
      100,
      "Other house name must not exceed 100 characters.",
    ),

    examination_level: z.preprocess(
      emptyToUndefined,
      z.enum(
        ["UCE", "UACE", "other", "not_applicable"],
        { error: "Select a valid examination level." },
      ).optional(),
    ),

    examination_level_other: optionalText(
      200,
      "Other examination level must not exceed 200 characters.",
    ),

    examination_year: optionalYear,

    examination_index_number: optionalText(
      60,
      "Examination index number must not exceed 60 characters.",
    ),

    former_teacher: optionalText(
      120,
      "Former teacher name must not exceed 120 characters.",
    ),

    // =====================================================
    // 3. CONTACT
    // =====================================================

    email: z.string()
      .trim()
      .email("Enter a valid email address.")
      .max(254, "Email address is too long."),

    phone: z.string()
      .trim()
      .min(1, "Primary phone number is required.")
      .max(40, "Phone number must not exceed 40 characters."),

    whatsapp_phone: optionalText(
      40,
      "WhatsApp number must not exceed 40 characters.",
    ),

    country_code: z.preprocess(
      (value) =>
        typeof value === "string" ? value.trim().toUpperCase() : value,
      z.enum(COUNTRY_CODES, {
        error: "Select a valid East African country.",
      }),
    ),

    district: z.enum(UGANDA_DISTRICTS, {
      error: "Select a valid Ugandan district.",
    }),

    town_city: z.preprocess(
      emptyToUndefined,
      z.enum(CITY_OPTIONS, {
        error: "Select a recognised Ugandan city or Other.",
      }).optional(),
    ),

    town_city_other: optionalText(
      120,
      "Town or city must not exceed 120 characters.",
    ),

    region: z.enum(
      ["Eastern", "Central", "Western", "Northern"],
      { error: "Select your HOSA region." },
    ),

    preferred_contact: z.preprocess(
      emptyToUndefined,
      z.enum(
        ["email", "phone", "whatsapp", "none"],
        { error: "Select a valid preferred contact method." },
      ).optional(),
    ),

    // Retained for compatibility with existing profile fields.
    nationality: z.preprocess(
      emptyToUndefined,
      z.enum(NATIONALITY_OPTIONS, {
        error: "Select an East African nationality or Other.",
      }).optional(),
    ),

    nationality_other: optionalText(
      100,
      "Nationality must not exceed 100 characters.",
    ),

    // =====================================================
    // 4. PROFESSIONAL
    // =====================================================

    employment_status: z.enum(
      [
        "employed",
        "self_employed",
        "unemployed",
        "student",
        "retired",
        "other",
      ],
      { error: "Select your employment status." },
    ),

    profession: z.string()
      .trim()
      .min(1, "Occupation is required.")
      .max(120, "Occupation must not exceed 120 characters."),

    highest_education: z.preprocess(
      emptyToUndefined,
      z.enum(
        [
          "primary",
          "secondary",
          "certificate",
          "diploma",
          "bachelors",
          "postgraduate_diploma",
          "masters",
          "doctorate",
          "other",
        ],
        { error: "Select a valid education level." },
      ).optional(),
    ),

    specialization: optionalText(
      160,
      "Specialization must not exceed 160 characters.",
    ),

    organization: optionalText(
      160,
      "Employer or organization must not exceed 160 characters.",
    ),
    skills: optionalText(
      500,
      "Skills must not exceed 500 characters.",
    ),

    business_owner: businessOwnerBoolean,

    business_name: optionalText(
      160,
      "Business name must not exceed 160 characters.",
    ),

    business_category: optionalText(
      100,
      "Business category must not exceed 100 characters.",
    ),

    business_description: optionalText(
      1000,
      "Business description must not exceed 1,000 characters.",
    ),

    business_website: z.preprocess(
      (value) =>
        typeof value === "string" && value.trim() === ""
          ? undefined
          : value,
      z.string()
        .trim()
        .url("Enter a valid business website URL.")
        .max(255, "Business website must not exceed 255 characters.")
        .optional(),
    ),

    // =====================================================
    // 5. INTERESTS AND PARTICIPATION
    // =====================================================

    interests: z.array(
      z.enum([
        "mentorship",
        "networking",
        "career_development",
        "business_opportunities",
        "sports_recreation",
        "community_service",
        "school_development",
        "fundraising",
        "leadership",
        "events",
      ]),
    ).min(1, "Select at least one HOSA interest."),

    mentor_opt_in: checkboxBoolean.optional(),

    seeking_mentorship: checkboxBoolean.optional(),

    volunteer_opt_in: checkboxBoolean.optional(),

    school_project_support: checkboxBoolean.optional(),

    // =====================================================
    // 6. ACCOUNT
    // =====================================================

    username: z.string()
      .trim()
      .min(3, "Username must have at least 3 characters.")
      .max(30, "Username must not exceed 30 characters.")
      .regex(
        /^[A-Za-z0-9._-]+$/,
        "Username may contain only letters, numbers, dots, underscores and hyphens.",
      ),

    password: z.string()
      .min(5, "Password must be at least 5 characters.")
      .max(200, "Password must not exceed 200 characters."),

    confirm_password: z.string()
      .min(1, "Please confirm your password."),

    // =====================================================
    // 7. REVIEW AND SUBMIT
    // =====================================================

    terms_accepted: requiredCheckbox,

    privacy_accepted: requiredCheckbox,

    declaration_accepted: requiredCheckbox,

    // Directory visibility is independent of policy consent.
    public_visibility: checkboxBoolean,
  })
  .superRefine((data, ctx) => {
    // Other town/city
    if (data.town_city === "Other" && !data.town_city_other) {
      ctx.addIssue({
        code: "custom",
        path: ["town_city_other"],
        message: "Please enter your town or city.",
      });
    }

    if (data.town_city !== "Other" && data.town_city_other) {
      ctx.addIssue({
        code: "custom",
        path: ["town_city_other"],
        message: "Only enter another town or city when Other is selected.",
      });
    }

    // Other nationality
    if (data.nationality === "Other" && !data.nationality_other) {
      ctx.addIssue({
        code: "custom",
        path: ["nationality_other"],
        message: "Please enter your nationality.",
      });
    }

    if (data.nationality !== "Other" && data.nationality_other) {
      ctx.addIssue({
        code: "custom",
        path: ["nationality_other"],
        message: "Only enter another nationality when Other is selected.",
      });
    }

    // Password confirmation
    if (
      data.password !== undefined &&
      data.confirm_password !== undefined &&
      data.password !== data.confirm_password
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["confirm_password"],
        message: "Passwords do not match.",
      });
    }

    // School class explanation
    if (
      ["other", "not_sure"].includes(data.last_class_attended) &&
      !data.last_class_explanation
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["last_class_explanation"],
        message: "Please explain the last class you attended.",
      });
    }

    if (
      !["other", "not_sure"].includes(data.last_class_attended) &&
      data.last_class_explanation
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["last_class_explanation"],
        message: "Only provide an explanation for Other or Not sure.",
      });
    }

    // Current student requirements
    if (data.school_status === "current_student") {
      if (data.expected_completion_year === undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["expected_completion_year"],
          message: "Expected completion year is required for current students.",
        });
      }

      if (data.completion_year !== undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["completion_year"],
          message: "Current students must not enter an actual completion year.",
        });
      }
    }

    // Old student requirements
    if (data.school_status === "old_student") {
      if (data.completion_year === undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["completion_year"],
          message: "Actual completion year is required for old students.",
        });
      }

      if (data.expected_completion_year !== undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["expected_completion_year"],
          message: "Old students must not enter an expected completion year.",
        });
      }
    }

    // Admission and completion year order
    const relevantCompletionYear =
      data.school_status === "current_student"
        ? data.expected_completion_year
        : data.completion_year;

    if (
      relevantCompletionYear !== undefined &&
      data.admission_year !== undefined &&
      relevantCompletionYear < data.admission_year
    ) {
      ctx.addIssue({
        code: "custom",
        path: [
          data.school_status === "current_student"
            ? "expected_completion_year"
            : "completion_year",
        ],
        message: "Completion year cannot be earlier than admission year.",
      });
    }

    // Other class explanation
    // Other school house
    if (data.school_house === "Other" && !data.school_house_other) {
      ctx.addIssue({
        code: "custom",
        path: ["school_house_other"],
        message: "Please specify your school house.",
      });
    }

    if (data.school_house !== "Other" && data.school_house_other) {
      ctx.addIssue({
        code: "custom",
        path: ["school_house_other"],
        message: "Only specify another house when Other is selected.",
      });
    }

    // Other examination level
    if (
      data.examination_level === "other" &&
      !data.examination_level_other
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["examination_level_other"],
        message: "Please specify the examination level.",
      });
    }

    if (
      data.examination_level !== "other" &&
      data.examination_level_other
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["examination_level_other"],
        message:
          "Only specify another examination level when Other is selected.",
      });
    }

    // Business ownership details
    if (data.business_owner === true) {
      if (!data.business_name) {
        ctx.addIssue({
          code: "custom",
          path: ["business_name"],
          message: "Enter your business name.",
        });
      }

      if (!data.business_category) {
        ctx.addIssue({
          code: "custom",
          path: ["business_category"],
          message: "Select or enter your business category.",
        });
      }
    }

    if (data.business_owner === false) {
      for (const field of [
        "business_name",
        "business_category",
        "business_description",
        "business_website",
      ]) {
        if (data[field]) {
          ctx.addIssue({
            code: "custom",
            path: [field],
            message: "Business details are only applicable to business owners.",
          });
        }
      }
    }

    // WhatsApp contact selection
    if (
      data.preferred_contact === "whatsapp" &&
      !data.whatsapp_phone
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["whatsapp_phone"],
        message: "Provide a WhatsApp number or select another contact method.",
      });
    }
  });

// ---------------------------------------------------------
// Login validation: email address OR username
// ---------------------------------------------------------

export const loginSchema = z.object({
  identifier: z.string()
    .trim()
    .min(1, "Enter your email address or username.")
    .max(254, "Login identifier is too long."),

  password: z.string()
    .min(1, "Password is required.")
    .max(200, "Password is too long."),
});

// ---------------------------------------------------------
// Error formatting
// ---------------------------------------------------------

export function flattenZodError(err) {
  const fieldErrors = {};

  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_form";

    if (!fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }

  return { fieldErrors, formErrors: [] };
}
