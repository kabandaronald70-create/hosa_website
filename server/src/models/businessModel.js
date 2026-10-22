import { query } from "../config/db.js";

// --- 1. Public Directory (Only shows approved AND posted in the last 30 days) ---
export async function listApprovedBusinesses({ category, search } = {}) {
  // Added the 30-day interval check to automatically hide old businesses
  let where = [
    `b.status = 'approved'`,
    `b.created_at >= NOW() - INTERVAL '30 days'`,
  ];
  let values = [];
  let i = 1;

  if (category) {
    where.push(`b.category = $${i}`);
    values.push(category);
    i++;
  }
  if (search) {
    where.push(`(b.name ILIKE $${i} OR b.description ILIKE $${i})`);
    values.push(`%${search}%`);
    i++;
  }

  const { rows } = await query(
    `SELECT b.*, mp.first_name, mp.last_name 
     FROM businesses b
     JOIN users u ON b.user_id = u.id
     LEFT JOIN member_profiles mp ON u.id = mp.user_id
     WHERE ${where.join(" AND ")}
     ORDER BY b.featured_until DESC NULLS LAST, b.created_at DESC`, // Featured first, then latest
    values,
  );
  return rows;
}

// --- 2. Check if user has posted in the last 30 days ---
export async function hasPostedRecently(userId) {
  const { rows } = await query(
    `SELECT id FROM businesses 
     WHERE user_id = $1 
     AND created_at >= NOW() - INTERVAL '30 days'
     LIMIT 1`,
    [userId],
  );
  return rows.length > 0;
}

export async function getBusinessesByUser(userId) {
  const { rows } = await query(
    `SELECT * FROM businesses WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId],
  );
  return rows;
}

export async function createBusiness({
  userId,
  name,
  category,
  description,
  location,
  website,
  phone,
  email,
  logoPath, // <-- Added logoPath
}) {
  const { rows } = await query(
    `INSERT INTO businesses (user_id, name, category, description, location, website, phone, email, logo_path, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
     RETURNING *`,
    [
      userId,
      name,
      category,
      description,
      location,
      website,
      phone,
      email,
      logoPath || null,
    ],
  );
  return rows[0];
}

// Admin functions
export async function listPendingBusinesses() {
  const { rows } = await query(
    `SELECT b.*, u.email AS owner_email FROM businesses b JOIN users u ON b.user_id = u.id WHERE b.status = 'pending' ORDER BY b.created_at ASC`,
  );
  return rows;
}

export async function setBusinessStatus(id, status) {
  await query(`UPDATE businesses SET status = $1 WHERE id = $2`, [status, id]);
}

// Toggle Featured Status
export async function toggleFeaturedBusiness(id, days) {
  if (days > 0) {
    // Feature for X days from today
    await query(
      `UPDATE businesses 
       SET featured_until = NOW() + INTERVAL '1 day' * $1 
       WHERE id = $2`,
      [days, id],
    );
  } else {
    // Remove feature
    await query(`UPDATE businesses SET featured_until = NULL WHERE id = $1`, [
      id,
    ]);
  }
}

export async function listAllBusinessesForAdmin() {
  const { rows } = await query(
    `SELECT b.*, u.email AS owner_email 
     FROM businesses b 
     JOIN users u ON b.user_id = u.id 
     ORDER BY b.created_at DESC`,
  );
  return rows;
}
