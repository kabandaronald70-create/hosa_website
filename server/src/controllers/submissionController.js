import { createPendingStory, listMyStories } from "../models/storyModel.js";
import {
  createPendingOpportunity,
  listMyOpportunities,
} from "../models/opportunityModel.js";
import {
  storySubmissionSchema,
  opportunitySubmissionSchema,
  normalizeStoryFields,
  normalizeOpportunityFields,
  flattenZodError,
} from "../validators/submissionValidators.js";
import { uniqueSlug } from "../services/slugService.js";
import { logger } from "../utils/logger.js";

export function showNewStoryForm(req, res) {
  res.render("submissions/story-new", {
    title: "Submit a story — HOSA",
    values: {},
    fieldErrors: {},
  });
}

export async function submitNewStory(req, res, next) {
  const parsed = storySubmissionSchema.safeParse(req.body);
  if (!parsed.success) {
    const { fieldErrors } = flattenZodError(parsed.error);
    return res.status(400).render("submissions/story-new", {
      title: "Submit a story — HOSA",
      values: req.body,
      fieldErrors,
    });
  }

  try {
    const fields = normalizeStoryFields(parsed.data);
    const slug = await uniqueSlug("stories", fields.title);
    const created = await createPendingStory({
      slug,
      title: fields.title,
      body: fields.body,
      excerpt: fields.excerpt,
      category: fields.category,
      authorUserId: req.user.id,
    });
    req.flash(
      "success",
      `Story submitted for review. A moderator will look at "${created.title}" soon.`,
    );
    res.redirect("/dashboard/submissions");
  } catch (err) {
    logger.error({ err }, "Story submission failed");
    next(err);
  }
}

export function showNewOpportunityForm(req, res) {
  res.render("submissions/opportunity-new", {
    title: "Submit an opportunity — HOSA",
    values: {},
    fieldErrors: {},
  });
}

export async function submitNewOpportunity(req, res, next) {
  const parsed = opportunitySubmissionSchema.safeParse(req.body);
  if (!parsed.success) {
    const { fieldErrors } = flattenZodError(parsed.error);
    return res.status(400).render("submissions/opportunity-new", {
      title: "Submit an opportunity — HOSA",
      values: req.body,
      fieldErrors,
    });
  }

  try {
    const fields = normalizeOpportunityFields(parsed.data);
    const slug = await uniqueSlug("opportunities", fields.title);
    const created = await createPendingOpportunity({
      slug,
      title: fields.title,
      typeLabel: fields.type_label,
      employer: fields.employer,
      location: fields.location,
      description: fields.description,
      applicationUrl: fields.application_url,
      deadline: fields.deadline,
      authorUserId: req.user.id,
    });
    req.flash(
      "success",
      `Opportunity submitted for review. A moderator will look at "${created.title}" soon.`,
    );
    res.redirect("/dashboard/submissions");
  } catch (err) {
    logger.error({ err }, "Opportunity submission failed");
    next(err);
  }
}

export async function showMySubmissions(req, res, next) {
  try {
    const [stories, opportunities] = await Promise.all([
      listMyStories(req.user.id),
      listMyOpportunities(req.user.id),
    ]);
    res.render("submissions/my-submissions", {
      title: "My submissions — HOSA",
      stories,
      opportunities,
    });
  } catch (err) {
    next(err);
  }
}
