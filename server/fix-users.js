import { query } from "./src/config/db.js";

async function run() {
  try {
    await query(`
      UPDATE users 
      SET membership_approved_at = now() 
      WHERE membership_approved_at IS NULL
    `);
    console.log("✅ Successfully approved all pending memberships!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
}
run();
