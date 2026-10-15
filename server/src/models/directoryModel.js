import { query } from "../config/db.js";

const PUBLIC_FIELDS = `
  mp.user_id,
  mp.seed_ref,
  mp.first_name,
  mp.last_name,
  mp.display_name,
  mp.graduation_year,
  mp.country_code,
  mp.district,
  mp.profession,
  mp.organization,
  mp.biography,
  mp.mentor_opt_in,
  mp.mentor_field,
  mp.preferred_contact,
  mp.avatar_path,
  mp.show_email,
  mp.show_phone,
  mp.verified_at,
  u.email AS account_email
`;

/**
 * Public directory listing with filters, sorting, and pagination.
 * Only returns rows where public_visibility = TRUE.
 */
export async function listPublicMembers({
  q,
  year,
  district,
  profession,
  mentorOnly,
  sort = "name-asc",
  page = 1,
  limit = 24,
}) {
  const where = ["mp.public_visibility = TRUE"];
  const values = [];
  let i = 1;

  if (q) {
    where.push(
      `(mp.first_name ILIKE $${i} OR mp.last_name ILIKE $${i} OR (mp.first_name || ' ' || mp.last_name) ILIKE $${i})`,
    );
    values.push(`%${q}%`);
    i += 1;
  }
  if (year) {
    where.push(`mp.graduation_year = $${i}`);
    values.push(year);
    i += 1;
  }
  if (district) {
    where.push(`mp.district = $${i}`);
    values.push(district);
    i += 1;
  }
  if (profession) {
    where.push(`mp.profession = $${i}`);
    values.push(profession);
    i += 1;
  }
  if (mentorOnly) {
    where.push(`mp.mentor_opt_in = TRUE`);
  }

  const orderBy = (() => {
    switch (sort) {
      case "name-desc":
        return "mp.last_name DESC, mp.first_name DESC";
      case "year-asc":
        return "mp.graduation_year ASC NULLS LAST, mp.last_name ASC";
      case "year-desc":
        return "mp.graduation_year DESC NULLS LAST, mp.last_name ASC";
      case "name-asc":
      default:
        return "mp.last_name ASC, mp.first_name ASC";
    }
  })();

  const offset = (page - 1) * limit;

  const { rows: countRows } = await query(
    `SELECT COUNT(*)::int AS total
       FROM member_profiles mp
      WHERE ${where.join(" AND ")}`,
    values,
  );
  const total = countRows[0].total;

  const { rows } = await query(
    `SELECT ${PUBLIC_FIELDS}
       FROM member_profiles mp
       JOIN users u ON u.id = mp.user_id
      WHERE ${where.join(" AND ")}
      ORDER BY ${orderBy}
      LIMIT $${i} OFFSET $${i + 1}`,
    [...values, limit, offset],
  );

  return {
    rows,
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function getPublicMemberBySeedRefOrId(idOrSeedRef) {
  const { rows } = await query(
    `SELECT ${PUBLIC_FIELDS}
       FROM member_profiles mp
       JOIN users u ON u.id = mp.user_id
      WHERE mp.public_visibility = TRUE
        AND (mp.seed_ref = $1 OR mp.user_id::text = $1)
      LIMIT 1`,
    [idOrSeedRef],
  );
  return rows[0] || null;
}
