import { z } from "zod";

const trimmedOptional = (max) =>
  z.string().trim().max(max).optional().or(z.literal(""));

export const profileSchema = z.object({
  first_name: z.string().trim().min(1, "First name is required.").max(80),
  last_name: z.string().trim().min(1, "Last name is required.").max(80),
  display_name: trimmedOptional(120),
  graduation_year: z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? undefined : Number(v)),
    z.number().int().min(1950).max(2100).optional(),
  ),
  biography: trimmedOptional(2000),
  profession: trimmedOptional(120),
  organization: trimmedOptional(120),
  district: trimmedOptional(120),
  country_code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "Use a 2-letter country code (e.g. UG).")
    .optional()
    .or(z.literal("")),
  phone: trimmedOptional(40),
  preferred_contact: z
    .enum(["email", "phone", "none"])
    .optional()
    .or(z.literal("")),
  skills: trimmedOptional(500),
  interests: trimmedOptional(500),
  career_history: trimmedOptional(4000),

  // booleans come in as checkbox values ("on" or absent)
  mentor_opt_in: z
    .preprocess((v) => v === "on" || v === "true" || v === true, z.boolean())
    .optional(),
  public_visibility: z
    .preprocess((v) => v === "on" || v === "true" || v === true, z.boolean())
    .optional(),

  // --- NEW: 3-Tier Privacy Fields ---
  email_privacy: z
    .enum(["public", "members", "private"])
    .optional()
    .default("private"),
  phone_privacy: z
    .enum(["public", "members", "private"])
    .optional()
    .default("private"),
  district_privacy: z
    .enum(["public", "members", "private"])
    .optional()
    .default("public"),
});

export const passwordChangeSchema = z
  .object({
    current_password: z.string().min(1, "Current password is required."),
    new_password: z
      .string()
      .min(5, "New password must be at least 5 characters.")
      .max(200, "New password is too long."),
    confirm_new_password: z.string(),
  })
  .refine((d) => d.new_password === d.confirm_new_password, {
    path: ["confirm_new_password"],
    message: "New passwords do not match.",
  })
  .refine((d) => d.new_password !== d.current_password, {
    path: ["new_password"],
    message: "New password must be different from the current one.",
  });

// Reuse the shape from the auth validators (single source of truth).
export { flattenZodError } from "./authValidators.js";
