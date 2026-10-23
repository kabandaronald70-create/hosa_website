import {
  listPublicMembers,
  getPublicMemberBySeedRefOrId,
  applyMemberPrivacy,
  getDistinctDistricts,
  getDistinctProfessions,
} from "../models/directoryModel.js";
import { listPublishedEvents, getEventBySlug } from "../models/eventModel.js";
import { listPublishedStories } from "../models/storyModel.js";
import { listApprovedOpportunities } from "../models/opportunityModel.js";
import { query } from "../config/db.js";
import { listDocuments } from "../models/documentModel.js";
import {
  getActiveCampaign,
  getCampaignBusinesses,
} from "../models/campaignModel.js"; // <-- ADDED

// ---------- Directory ----------

export async function showDirectory(req, res, next) {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const district =
      typeof req.query.district === "string" ? req.query.district : "";
    const profession =
      typeof req.query.profession === "string" ? req.query.profession : "";
    const mentorOnly = req.query.mentor === "1";
    const page = Math.max(1, Number(req.query.page) || 1);

    const [result, districts, professions] = await Promise.all([
      listPublicMembers({
        q,
        district,
        profession,
        mentorOnly,
        page,
        limit: 24,
      }),
      getDistinctDistricts(),
      getDistinctProfessions(),
    ]);

    const sanitizedMembers = result.rows.map((m) =>
      applyMemberPrivacy(m, req.user),
    );

    res.render("public/directory", {
      title: "Directory — HOSA",
      layout: "layouts/public",
      members: sanitizedMembers,
      pagination: result,
      filters: { q, district, profession, mentorOnly },
      districts,
      professions,
    });
  } catch (err) {
    next(err);
  }
}

export async function showMemberDetail(req, res, next) {
  try {
    const member = await getPublicMemberBySeedRefOrId(req.params.id);
    if (!member) {
      return res.status(404).render("public/404", {
        title: "Member not found",
        layout: "layouts/public",
      });
    }

    const sanitizedMember = applyMemberPrivacy(member, req.user);

    res.render("public/member-detail", {
      title: `${member.display_name || member.first_name} — HOSA`,
      layout: "layouts/public",
      member: sanitizedMember,
    });
  } catch (err) {
    next(err);
  }
}

// ---------- Events ----------

export async function showEvents(req, res, next) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const result = await listPublishedEvents({ page, limit: 20 });
    res.render("public/events", {
      title: "Events — HOSA",
      layout: "layouts/public",
      events: result.rows,
      pagination: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function showEventDetail(req, res, next) {
  try {
    const event = await getEventBySlug(req.params.slug);
    if (!event) {
      return res.status(404).render("public/404", {
        title: "Event not found",
        layout: "layouts/public",
      });
    }
    res.render("public/event-detail", {
      title: `${event.title} — HOSA`,
      layout: "layouts/public",
      event,
    });
  } catch (err) {
    next(err);
  }
}

// ---------- Stories ----------

export async function showStories(req, res, next) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const result = await listPublishedStories({ page, limit: 20 });
    res.render("public/stories", {
      title: "Alumni Stories — HOSA",
      layout: "layouts/public",
      stories: result.rows,
      pagination: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function showStoryDetail(req, res, next) {
  try {
    const result = await listPublishedStories({ limit: 500 });
    const story = result.rows.find((s) => s.slug === req.params.slug);
    if (!story) {
      return res.status(404).render("public/404", {
        title: "Story not found",
        layout: "layouts/public",
      });
    }
    res.render("public/story-detail", {
      title: `${story.title} — HOSA`,
      layout: "layouts/public",
      story,
    });
  } catch (err) {
    next(err);
  }
}

// ---------- Jobs ----------

export async function showJobs(req, res, next) {
  try {
    const category =
      typeof req.query.category === "string" ? req.query.category : "";
    const page = Math.max(1, Number(req.query.page) || 1);
    const result = await listApprovedOpportunities({
      category,
      page,
      limit: 24,
    });
    res.render("public/jobs", {
      title: "Jobs & Internships — HOSA",
      layout: "layouts/public",
      opportunities: result.rows,
      pagination: result,
      filters: { category },
    });
  } catch (err) {
    next(err);
  }
}

// ---------- Archive (Past Events, Stories, Documents) ----------

export async function showArchive(req, res, next) {
  try {
    const eventsResult = await query(
      `SELECT slug, title, starts_at, venue, description
         FROM events
        WHERE status = 'published' AND starts_at < now()
        ORDER BY starts_at DESC LIMIT 20`,
    );

    const storiesResult = await query(
      `SELECT slug, title, excerpt, published_at, category
         FROM stories
        WHERE status = 'published'
        ORDER BY published_at ASC LIMIT 20`,
    );

    const documents = await listDocuments();

    res.render("public/archive", {
      title: "Archive — HOSA",
      layout: "layouts/public",
      pastEvents: eventsResult.rows,
      stories: storiesResult.rows,
      documents: documents,
    });
  } catch (err) {
    next(err);
  }
}

// ---------- Business Directory ----------

export async function showBusinessDirectory(req, res, next) {
  try {
    const search = req.query.q || "";
    const category = req.query.category || "";

    // 1. Fetch businesses, categories, and active campaign in parallel
    const [businesses, activeCampaign] = await Promise.all([
      listApprovedBusinesses({ search, category }),
      getActiveCampaign(),
    ]);

    // 2. If there's a campaign, fetch its participating businesses
    let campaignBusinesses = [];
    if (activeCampaign) {
      campaignBusinesses = await getCampaignBusinesses(activeCampaign.id);
    }

    res.render("public/business-directory", {
      title: "Alumni Business Directory",
      businesses,
      categories: [
        "Agriculture",
        "Retail & Wholesale",
        "Technology",
        "Professional Services",
        "Education",
        "Construction",
        "Transport & Logistics",
        "Food & Hospitality",
        "Health & Wellness",
        "Manufacturing",
        "Finance & Business Support",
        "Other",
      ], // Added categories here
      filters: { search, category },
      activeCampaign, // <-- Passed to view
      campaignBusinesses, // <-- Passed to view
      layout: "layouts/public",
    });
  } catch (err) {
    next(err);
  }
}
