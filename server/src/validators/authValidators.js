import { z } from "zod";

export const registerSchema = z
  .object({
    email: z.string().trim().email("Enter a valid email address.").max(254),
    password: z
      .string()
      .min(5, "Password must be at least 5 characters.")
      .max(200, "Password is too long."),
    confirm_password: z.string(),

    // Names
    first_name: z.string().trim().min(1, "First name is required.").max(80),
    last_name: z.string().trim().min(1, "Last name is required.").max(80),
    other_name: z.string().trim().max(80).optional().or(z.literal("")), // Optional

    // Profile Info
    graduation_year: z.preprocess(
      (v) =>
        v === "" || v === undefined || v === null ? undefined : Number(v),
      z.number().int().min(1950).max(2100).optional(),
    ),
    district: z.string().trim().min(1, "District is required.").max(120),

    // New Fields
    nationality: z.string().trim().min(1, "Nationality is required."),
    profession: z.string().trim().min(1, "Profession is required.").max(120),
    phone: z.string().trim().min(1, "Phone number is required.").max(40),
    region: z.string().trim().min(1, "Region is required."),

    // Existing / Optional Fields
    country_code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/, "Use a 2-letter country code (e.g. UG).")
      .optional()
      .or(z.literal("")),
    mentor_opt_in: z
      .preprocess((v) => v === "on" || v === "true" || v === true, z.boolean())
      .optional(),
  })
  .refine((d) => d.password === d.confirm_password, {
    path: ["confirm_password"],
    message: "Passwords do not match.",
  });

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

/**
 * Turn a ZodError into { fieldErrors, formErrors }.
 * Only echoes safe, non-sensitive values back to the view.
 */
export function flattenZodError(err) {
  const fieldErrors = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_form";
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { fieldErrors, formErrors: [] };
}
