import {
  listPublicMembers,
  getPublicMemberBySeedRefOrId,
  applyMemberPrivacy,
} from "../models/directoryModel.js";
import { listPublishedEvents, getEventBySlug } from "../models/eventModel.js";
import { listPublishedStories } from "../models/storyModel.js";
import { listApprovedOpportunities } from "../models/opportunityModel.js";
import {
  serializeMember,
  serializeEvent,
  serializeStory,
  serializeOpportunity,
} from "../services/apiSerializer.js";

function toInt(v, def) {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : def;
}

// Directory ------------------------------------------------------------------

export async function getDirectory(req, res, next) {
  try {
    const { q, year, district, profession, mentor, sort } = req.query;
    const page = toInt(req.query.page, 1);
    const limit = Math.min(toInt(req.query.limit, 24), 100);

    const { rows, total, pages } = await listPublicMembers({
      q: typeof q === "string" ? q.trim() : undefined,
      year: year ? Number(year) : undefined,
      district: typeof district === "string" ? district : undefined,
      profession: typeof profession === "string" ? profession : undefined,
      mentorOnly: mentor === "1" || mentor === "true",
      sort,
      page,
      limit,
    });

    res.json({
      data: rows.map((row) => serializeMember(applyMemberPrivacy(row, req.user))),
      pagination: { page, limit, total, pages },
    });
  } catch (err) {
    next(err);
  }
}

export async function getDirectoryMember(req, res, next) {
  try {
    const row = await getPublicMemberBySeedRefOrId(req.params.id);
    if (!row) return res.status(404).json({ error: "Member not found." });
    res.json({ data: serializeMember(applyMemberPrivacy(row, req.user)) });
  } catch (err) {
    next(err);
  }
}

// Events ---------------------------------------------------------------------

export async function getEvents(req, res, next) {
  try {
    const { from, to } = req.query;
    const page = toInt(req.query.page, 1);
    const limit = Math.min(toInt(req.query.limit, 24), 100);
    const { rows, total } = await listPublishedEvents({
      from,
      to,
      page,
      limit,
    });
    res.json({
      data: rows.map(serializeEvent),
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getEvent(req, res, next) {
  try {
    const row = await getEventBySlug(req.params.slug);
    if (!row) return res.status(404).json({ error: "Event not found." });
    res.json({ data: serializeEvent(row) });
  } catch (err) {
    next(err);
  }
}

// Stories --------------------------------------------------------------------

export async function getStories(req, res, next) {
  try {
    const page = toInt(req.query.page, 1);
    const limit = Math.min(toInt(req.query.limit, 20), 100);
    const { rows, total } = await listPublishedStories({ page, limit });
    res.json({
      data: rows.map(serializeStory),
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (err) {
    next(err);
  }
}

// Opportunities --------------------------------------------------------------

export async function getOpportunities(req, res, next) {
  try {
    const { category } = req.query;
    const page = toInt(req.query.page, 1);
    const limit = Math.min(toInt(req.query.limit, 24), 100);
    const { rows, total } = await listApprovedOpportunities({
      category,
      page,
      limit,
    });
    res.json({
      data: rows.map(serializeOpportunity),
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (err) {
    next(err);
  }
}
