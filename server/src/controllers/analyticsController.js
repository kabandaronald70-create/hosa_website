import {
  getMembershipStats,
  getFinancialStats,
  getProjectStats,
  getRegionalStats,
  getBusinessStats,
  getEngagementStats,
} from "../models/analyticsModel.js";

export async function showAnalyticsDashboard(req, res, next) {
  try {
    const [membership, financial, projects, regional, businesses, engagement] =
      await Promise.all([
        getMembershipStats(),
        getFinancialStats(),
        getProjectStats(),
        getRegionalStats(),
        getBusinessStats(),
        getEngagementStats(),
      ]);

    res.render("admin/analytics", {
      title: "Analytics & Monitoring — Admin",
      membership,
      financial,
      projects,
      regional,
      businesses,
      engagement,
      layout: "layouts/app",
    });
  } catch (err) {
    next(err);
  }
}
