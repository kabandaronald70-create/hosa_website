import { z } from "zod";

const optionalString = (max) =>
  z.string().trim().max(max).optional().or(z.literal(""));

const toNullableString = (v) => (v === "" || v === undefined ? null : v);

export const eventSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required.").max(200),
    description: z
      .string()
      .trim()
      .max(5000, "Description is too long.")
      .optional()
      .or(z.literal("")),
    starts_at: z.string().min(1, "Start date and time are required."),
    ends_at: z.string().optional().or(z.literal("")),
    timezone: z.string().trim().min(1).max(80).default("Africa/Kampala"),
    venue: optionalString(300),
    district: optionalString(120),
    capacity: z.preprocess(
      (v) =>
        v === "" || v === undefined || v === null ? undefined : Number(v),
      z.number().int().positive().max(100000).optional(),
    ),
    registration_deadline: z.string().optional().or(z.literal("")),
    accessibility: optionalString(1000),
    internal_notes: optionalString(2000),
  })
  .superRefine((data, ctx) => {
    const start = data.starts_at ? new Date(data.starts_at) : null;
    const end = data.ends_at ? new Date(data.ends_at) : null;
    const regDeadline = data.registration_deadline
      ? new Date(data.registration_deadline)
      : null;

    if (start && isNaN(start.getTime())) {
      ctx.addIssue({
        code: "custom",
        path: ["starts_at"],
        message: "Invalid start date.",
      });
    }
    if (end && isNaN(end.getTime())) {
      ctx.addIssue({
        code: "custom",
        path: ["ends_at"],
        message: "Invalid end date.",
      });
    }
    if (start && end && end <= start) {
      ctx.addIssue({
        code: "custom",
        path: ["ends_at"],
        message: "End must be after start.",
      });
    }
    if (start && regDeadline && regDeadline > start) {
      ctx.addIssue({
        code: "custom",
        path: ["registration_deadline"],
        message: "Registration deadline must be on or before the start.",
      });
    }
  });

/** Convert "2026-03-14T09:00" (datetime-local) to an ISO string, or null. */
export function toIso(v) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export function normalizeEventFields(parsed) {
  return {
    title: parsed.title,
    description: toNullableString(parsed.description) ?? "",
    starts_at: toIso(parsed.starts_at),
    ends_at: toIso(parsed.ends_at),
    timezone: parsed.timezone || "Africa/Kampala",
    venue: toNullableString(parsed.venue),
    district: toNullableString(parsed.district),
    capacity: parsed.capacity ?? null,
    registration_deadline: toIso(parsed.registration_deadline),
    accessibility: toNullableString(parsed.accessibility),
    internal_notes: toNullableString(parsed.internal_notes),
  };
}

export { flattenZodError } from "./authValidators.js";
