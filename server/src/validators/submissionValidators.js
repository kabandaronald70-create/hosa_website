import { z } from "zod";

export const storySubmissionSchema = z.object({
  title: z
    .string()
    .trim()
    .min(5, "Title must be at least 5 characters.")
    .max(200),
  category: z.string().trim().max(80).optional().or(z.literal("")),
  excerpt: z.string().trim().max(500).optional().or(z.literal("")),
  body: z
    .string()
    .trim()
    .min(50, "Story body must be at least 50 characters.")
    .max(8000, "Story is too long."),
});

export const opportunitySubmissionSchema = z.object({
  title: z
    .string()
    .trim()
    .min(5, "Title must be at least 5 characters.")
    .max(200),
  type_label: z.string().trim().max(80).optional().or(z.literal("")),
  employer: z.string().trim().max(200).optional().or(z.literal("")),
  location: z.string().trim().max(200).optional().or(z.literal("")),
  description: z
    .string()
    .trim()
    .min(30, "Description must be at least 30 characters.")
    .max(5000, "Description is too long."),
  application_url: z
    .string()
    .trim()
    .url("Application link must be a valid URL (https://…).")
    .optional()
    .or(z.literal("")),
  deadline: z.string().optional().or(z.literal("")),
});

export function normalizeStoryFields(parsed) {
  return {
    title: parsed.title,
    category: parsed.category || null,
    excerpt: parsed.excerpt || null,
    body: parsed.body,
  };
}

export function normalizeOpportunityFields(parsed) {
  return {
    title: parsed.title,
    type_label: parsed.type_label || null,
    employer: parsed.employer || null,
    location: parsed.location || null,
    description: parsed.description,
    application_url: parsed.application_url || null,
    deadline: parsed.deadline
      ? new Date(parsed.deadline).toISOString().slice(0, 10)
      : null,
  };
}

export { flattenZodError } from "./authValidators.js";
