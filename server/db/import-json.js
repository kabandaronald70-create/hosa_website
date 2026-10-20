#!/usr/bin/env node
/**
 * Import HOSA's existing JSON data files into Postgres.
 * Idempotent: uses natural keys (slug, seed_ref, email_normalized).
 *
 * Usage:
 *   node db/import-json.js                 # import everything
 *   node db/import-json.js members         # import only members
 *   node db/import-json.js events stories  # import a subset
 */
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { query, withTransaction, shutdownPool } from "../src/config/db.js";
import { logger } from "../src/utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// The Vite frontend's public/ folder lives two levels up from server/db/.
const DATA_DIR = path.resolve(__dirname, "..", "..", "public", "data");

// Passwords for imported members: none — they can't log in until they reset.
// We insert a random unusable hash so the row is valid but login always fails.
const UNUSABLE_PASSWORD_HASH =
  "$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

async function readJson(file) {
  const full = path.join(DATA_DIR, file);
  const raw = await fs.readFile(full, "utf8");
  // Strip a BOM if present.
  return JSON.parse(raw.replace(/^\uFEFF/, ""));
}

function slugify(s) {
  return String(s)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function splitName(fullName) {
  const parts = String(fullName || "")
    .trim()
    .split(/\s+/);
  if (parts.length === 0) return { first: "Unknown", last: "Unknown" };
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------
async function importMembers() {
  const members = await readJson("hosa-members.json");
  logger.info({ count: members.length }, "Importing members");

  let inserted = 0;
  let skipped = 0;

  for (const m of members) {
    const seedRef = m.id; // 'm001'
    const emailNormalized = `${seedRef}@import.hosa.local`;
    const email = emailNormalized;
    const { first, last } = splitName(m.name);

    try {
      await withTransaction(async (client) => {
        // Skip if this seed_ref already exists.
        const existing = await client.query(
          `SELECT user_id FROM member_profiles WHERE seed_ref = $1`,
          [seedRef],
        );
        if (existing.rows.length > 0) {
          skipped += 1;
          return;
        }

        const userRes = await client.query(
          `INSERT INTO users (email, email_normalized, password_hash, status, membership_approved_at)
           VALUES ($1, $2, $3, 'active', now())
           RETURNING id`,
          [email, emailNormalized, UNUSABLE_PASSWORD_HASH],
        );
        const userId = userRes.rows[0].id;

        await client.query(
          `INSERT INTO member_profiles
             (user_id, seed_ref, first_name, last_name, graduation_year,
              country_code, district, profession, biography,
              mentor_opt_in, mentor_field, preferred_contact, public_visibility)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, TRUE)`,
          [
            userId,
            seedRef,
            first,
            last,
            m.classYear ?? null,
            (m.country || "").toUpperCase() || null,
            m.district || null,
            m.profession || null,
            m.bio || null,
            Boolean(m.mentor),
            m.mentorField || null,
            (m.contactPreference || "").toLowerCase() || null,
          ],
        );

        await client.query(
          `INSERT INTO user_roles (user_id, role_id)
             SELECT $1, id FROM roles WHERE name = 'member'`,
          [userId],
        );

        if (m.mentor) {
          await client.query(
            `INSERT INTO user_roles (user_id, role_id)
               SELECT $1, id FROM roles WHERE name = 'mentor'
             ON CONFLICT DO NOTHING`,
            [userId],
          );
        }
        inserted += 1;
      });
    } catch (err) {
      logger.error({ err, seedRef }, "Failed to import member");
    }
  }

  logger.info({ inserted, skipped }, "Members import done");
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
async function importEvents() {
  const events = await readJson("events.json");
  logger.info({ count: events.length }, "Importing events");

  let inserted = 0,
    skipped = 0;

  for (const e of events) {
    const extRef = e.id;
    try {
      if (extRef) {
        const existing = await query(
          `SELECT id FROM events WHERE external_ref = $1`,
          [extRef],
        );
        if (existing.rows.length > 0) {
          skipped += 1;
          continue;
        }
      }

      const startsAt = e.date;
      if (!startsAt) {
        logger.warn({ extRef }, "Event has no date; skipping");
        continue;
      }
      const slug = slugify(`${e.title}-${extRef || startsAt}`);

      await query(
        `INSERT INTO events
           (external_ref, slug, title, description, starts_at, venue,
            district, latitude, longitude, event_type,
            status, published_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                 'published', now())`,
        [
          extRef,
          slug,
          e.title || "Untitled event",
          e.description || "",
          new Date(startsAt).toISOString(),
          e.venue || null,
          e.district || null,
          e.latitude ?? null,
          e.longitude ?? null,
          e.type || null,
        ],
      );
      inserted += 1;
    } catch (err) {
      logger.error({ err, extRef }, "Failed to import event");
    }
  }
  logger.info({ inserted, skipped }, "Events import done");
}
// ---------------------------------------------------------------------------
// Opportunities
// ---------------------------------------------------------------------------
async function importOpportunities() {
  const items = await readJson("opportunities.json");
  logger.info({ count: items.length }, "Importing opportunities");

  let inserted = 0,
    skipped = 0;

  for (const o of items) {
    const extRef = o.id;
    try {
      if (extRef) {
        const existing = await query(
          `SELECT id FROM opportunities WHERE external_ref = $1`,
          [extRef],
        );
        if (existing.rows.length > 0) {
          skipped += 1;
          continue;
        }
      }

      const slug = slugify(`${o.title}-${extRef || ""}`);

      await query(
        `INSERT INTO opportunities
           (external_ref, slug, title, description,
            employer, organization, location, type_label,
            posted_by_ref, deadline, status)
         VALUES ($1, $2, $3, $4, $5, $5, $6, $7, $8, $9, 'approved')`,
        [
          extRef,
          slug,
          o.title || "Untitled opportunity",
          o.description || "",
          o.employer || null, // duplicated into organization
          o.location || null,
          o.type || null,
          o.postedBy || null,
          o.deadline ? new Date(o.deadline).toISOString().slice(0, 10) : null,
        ],
      );
      inserted += 1;
    } catch (err) {
      logger.error({ err, extRef }, "Failed to import opportunity");
    }
  }
  logger.info({ inserted, skipped }, "Opportunities import done");
}
// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------
async function importStories() {
  const items = await readJson("stories.json");
  logger.info({ count: items.length }, "Importing stories");

  let inserted = 0,
    skipped = 0;

  for (const s of items) {
    const extRef = s.id;
    try {
      if (extRef) {
        const existing = await query(
          `SELECT id FROM stories WHERE external_ref = $1`,
          [extRef],
        );
        if (existing.rows.length > 0) {
          skipped += 1;
          continue;
        }
      }

      const slug = slugify(`${s.title}-${extRef || ""}`);
      const storyDate = s.date
        ? new Date(s.date).toISOString().slice(0, 10)
        : null;

      await query(
        `INSERT INTO stories
           (external_ref, slug, title, body, excerpt,
            author_name, author_ref, class_year, category,
            story_date, status, published_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                 'published', COALESCE($11::timestamptz, now()))`,
        [
          extRef,
          slug,
          s.title || "Untitled story",
          s.body || "",
          s.excerpt || null,
          s.author || null,
          s.authorId || null,
          s.classYear ?? null,
          s.category || null,
          storyDate,
          storyDate ? new Date(storyDate).toISOString() : null,
        ],
      );
      inserted += 1;
    } catch (err) {
      logger.error({ err, extRef }, "Failed to import story");
    }
  }
  logger.info({ inserted, skipped }, "Stories import done");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const ALL = {
  members: importMembers,
  events: importEvents,
  opportunities: importOpportunities,
  stories: importStories,
};

async function main() {
  const args = process.argv.slice(2);
  const targets =
    args.length > 0 ? args.filter((a) => ALL[a]) : Object.keys(ALL);

  if (targets.length === 0) {
    logger.error({ valid: Object.keys(ALL) }, "No valid import targets given");
    process.exitCode = 1;
    return;
  }

  for (const name of targets) {
    logger.info({ target: name }, "Starting import");
    try {
      await ALL[name]();
    } catch (err) {
      logger.error({ err, target: name }, "Import failed");
    }
  }

  logger.info("Import complete");
}

main()
  .catch((err) => {
    logger.error({ err }, "Importer crashed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await shutdownPool();
  });
