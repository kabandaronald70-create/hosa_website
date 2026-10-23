import {
  getActiveCampaign,
  getCampaignBusinesses,
  listAllCampaigns,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  addBusinessToCampaign,
  removeBusinessFromCampaign,
} from "../models/campaignModel.js";
import { listAllBusinessesForAdmin } from "../models/businessModel.js";

export async function showAdminCampaigns(req, res, next) {
  try {
    const [campaigns, businesses] = await Promise.all([
      listAllCampaigns(),
      listAllBusinessesForAdmin(),
    ]);

    const approvedBusinesses = businesses.filter(
      (b) => b.status === "approved",
    );

    const campaignsWithBusinesses = await Promise.all(
      campaigns.map(async (c) => {
        const participating = await getCampaignBusinesses(c.id);
        return { ...c, participating_businesses: participating };
      }),
    );

    // Separate active/upcoming from past
    const activeCampaigns = campaignsWithBusinesses.filter((c) => !c.is_past);
    const pastCampaigns = campaignsWithBusinesses.filter((c) => c.is_past);

    res.render("admin/campaigns", {
      title: "Marketing Campaigns",
      activeCampaigns,
      pastCampaigns,
      businesses: approvedBusinesses,
      layout: "layouts/app",
    });
  } catch (err) {
    next(err);
  }
}

export async function actionCreateCampaign(req, res, next) {
  try {
    const { title, description, start_date, end_date } = req.body;
    await createCampaign({
      title,
      description,
      startDate: start_date,
      endDate: end_date,
      createdBy: req.user.id,
    });
    req.flash("success", "Campaign created successfully.");
    res.redirect("/admin/campaigns");
  } catch (err) {
    next(err);
  }
}

export async function actionUpdateCampaign(req, res, next) {
  try {
    const { title, description, start_date, end_date } = req.body;
    await updateCampaign(req.params.id, {
      title,
      description,
      startDate: start_date,
      endDate: end_date,
    });
    req.flash("success", "Campaign updated successfully.");
    res.redirect("/admin/campaigns");
  } catch (err) {
    next(err);
  }
}

export async function actionDeleteCampaign(req, res, next) {
  try {
    await deleteCampaign(req.params.id);
    req.flash("success", "Campaign deleted.");
    res.redirect("/admin/campaigns");
  } catch (err) {
    next(err);
  }
}

export async function actionToggleCampaignBusiness(req, res, next) {
  try {
    const { campaignId, businessId, action } = req.body;
    if (!campaignId || !businessId) {
      req.flash("error", "Missing campaign or business ID.");
      return res.redirect("/admin/campaigns");
    }
    if (action === "add") {
      await addBusinessToCampaign(campaignId, businessId);
      req.flash("success", "Business added to campaign.");
    } else {
      await removeBusinessFromCampaign(campaignId, businessId);
      req.flash("success", "Business removed from campaign.");
    }
    res.redirect("/admin/campaigns");
  } catch (err) {
    next(err);
  }
}
