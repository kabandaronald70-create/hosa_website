import { query } from "../config/db.js";

export async function getActiveCampaign() {
  const { rows } = await query(
    `SELECT * FROM campaigns 
     WHERE status = 'active' 
       AND CURRENT_DATE BETWEEN start_date AND end_date 
     ORDER BY start_date DESC LIMIT 1`,
  );
  return rows[0] || null;
}

export async function getCampaignBusinesses(campaignId) {
  const { rows } = await query(
    `SELECT b.*, mp.first_name, mp.last_name 
     FROM businesses b
     JOIN campaign_businesses cb ON b.id = cb.business_id
     JOIN users u ON b.user_id = u.id
     LEFT JOIN member_profiles mp ON u.id = mp.user_id
     WHERE cb.campaign_id = $1 AND b.status = 'approved'`,
    [campaignId],
  );
  return rows;
}

export async function listAllCampaigns() {
  // Fetch all campaigns and add a calculated 'is_past' boolean
  const { rows } = await query(
    `SELECT c.*, u.email AS creator_email,
            (c.end_date < CURRENT_DATE) AS is_past
     FROM campaigns c 
     LEFT JOIN users u ON c.created_by = u.id
     ORDER BY c.start_date DESC`,
  );
  return rows;
}

export async function createCampaign({
  title,
  description,
  startDate,
  endDate,
  createdBy,
}) {
  const { rows } = await query(
    `INSERT INTO campaigns (title, description, start_date, end_date, created_by)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [title, description, startDate, endDate, createdBy],
  );
  return rows[0];
}

export async function updateCampaign(
  id,
  { title, description, startDate, endDate },
) {
  const { rows } = await query(
    `UPDATE campaigns 
     SET title = $1, description = $2, start_date = $3, end_date = $4
     WHERE id = $5 RETURNING *`,
    [title, description, startDate, endDate, id],
  );
  return rows[0];
}

export async function deleteCampaign(id) {
  await query(`DELETE FROM campaigns WHERE id = $1`, [id]);
}

export async function addBusinessToCampaign(campaignId, businessId) {
  await query(
    `INSERT INTO campaign_businesses (campaign_id, business_id) 
     VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [campaignId, businessId],
  );
}

export async function removeBusinessFromCampaign(campaignId, businessId) {
  await query(
    `DELETE FROM campaign_businesses WHERE campaign_id = $1 AND business_id = $2`,
    [campaignId, businessId],
  );
}
