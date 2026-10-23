import {
  listApprovedBusinesses,
  getBusinessesByUser,
  createBusiness,
  listPendingBusinesses,
  setBusinessStatus,
  hasPostedRecently,
  toggleFeaturedBusiness,
  listAllBusinessesForAdmin,
  getBusinessById,
  updateBusiness,
} from "../models/businessModel.js";
import { uploadBusinessLogo } from "../services/logoService.js";
import {
  getActiveCampaign,
  getCampaignBusinesses,
} from "../models/campaignModel.js";

const CATEGORIES = [
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
];

// --- Public Directory ---
export async function showBusinessDirectory(req, res, next) {
  try {
    const search = req.query.q || "";
    const category = req.query.category || "";

    const [businesses, activeCampaign] = await Promise.all([
      listApprovedBusinesses({ search, category }),
      getActiveCampaign(),
    ]);

    let campaignBusinesses = [];
    if (activeCampaign) {
      campaignBusinesses = await getCampaignBusinesses(activeCampaign.id);
    }

    res.render("public/business-directory", {
      title: "Alumni Business Directory",
      businesses,
      categories: CATEGORIES,
      filters: { search, category },
      activeCampaign,
      campaignBusinesses,
      layout: "layouts/public",
    });
  } catch (err) {
    next(err);
  }
}

// --- Member Dashboard (My Businesses) ---
export async function showMyBusinesses(req, res, next) {
  try {
    const businesses = await getBusinessesByUser(req.user.id);

    let canSubmit = true;
    let waitDays = 0;

    if (businesses.length > 0) {
      const lastPost = new Date(businesses[0].created_at);
      const now = new Date();
      const diffInDays = Math.floor((now - lastPost) / (1000 * 60 * 60 * 24));

      if (diffInDays < 30) {
        canSubmit = false;
        waitDays = 30 - diffInDays;
      }
    }

    res.render("dashboard/businesses", {
      title: "My Businesses",
      businesses,
      categories: CATEGORIES,
      canSubmit,
      waitDays,
      layout: "layouts/app",
    });
  } catch (err) {
    next(err);
  }
}

export async function actionCreateBusiness(req, res, next) {
  try {
    const recentlyPosted = await hasPostedRecently(req.user.id);
    if (recentlyPosted) {
      req.flash(
        "error",
        "You can only submit one business per month. Please try again in 30 days.",
      );
      return res.redirect("/dashboard/businesses");
    }

    let logoUrl = null;
    if (req.file) {
      logoUrl = await uploadBusinessLogo(
        req.user.id,
        req.file.buffer,
        req.file.mimetype,
        req.file.originalname,
      );
    }

    const { name, category, description, location, website, phone, email } =
      req.body;

    await createBusiness({
      userId: req.user.id,
      name,
      category,
      description,
      location,
      website,
      phone,
      email,
      logoPath: logoUrl,
    });

    req.flash("success", "Business submitted! It is pending admin approval.");
    res.redirect("/dashboard/businesses");
  } catch (err) {
    next(err);
  }
}

// --- Edit Business ---
export async function showEditBusinessForm(req, res, next) {
  try {
    const business = await getBusinessById(req.params.id);
    if (!business || business.user_id !== req.user.id) {
      req.flash("error", "Business not found or you don't have permission.");
      return res.redirect("/dashboard/businesses");
    }

    res.render("dashboard/business-edit", {
      title: "Edit Business",
      business,
      categories: CATEGORIES,
      layout: "layouts/app",
    });
  } catch (err) {
    next(err);
  }
}

export async function actionUpdateBusiness(req, res, next) {
  try {
    const business = await getBusinessById(req.params.id);
    if (!business || business.user_id !== req.user.id) {
      req.flash("error", "Permission denied.");
      return res.redirect("/dashboard/businesses");
    }

    let logoPath = business.logo_path;
    if (req.file) {
      logoPath = await uploadBusinessLogo(
        req.user.id,
        req.file.buffer,
        req.file.mimetype,
        req.file.originalname,
      );
    }

    const { name, category, description, location, website, phone, email } =
      req.body;

    await updateBusiness(req.params.id, req.user.id, {
      name,
      category,
      description,
      location,
      website,
      phone,
      email,
      logoPath,
    });

    req.flash("success", "Business updated! It is pending admin re-approval.");
    res.redirect("/dashboard/businesses");
  } catch (err) {
    next(err);
  }
}

// --- Admin Moderation ---
export async function showPendingBusinesses(req, res, next) {
  try {
    const businesses = await listAllBusinessesForAdmin();

    res.render("admin/businesses-pending", {
      title: "Business Approvals",
      businesses,
      layout: "layouts/app",
    });
  } catch (err) {
    next(err);
  }
}

export async function actionApproveBusiness(req, res, next) {
  try {
    await setBusinessStatus(req.params.id, "approved");
    req.flash("success", "Business approved.");
    res.redirect("/admin/businesses");
  } catch (err) {
    next(err);
  }
}

export async function actionRejectBusiness(req, res, next) {
  try {
    await setBusinessStatus(req.params.id, "rejected");
    req.flash("success", "Business rejected.");
    res.redirect("/admin/businesses");
  } catch (err) {
    next(err);
  }
}

export async function actionToggleFeatured(req, res, next) {
  try {
    const { days } = req.body;
    await toggleFeaturedBusiness(req.params.id, parseInt(days) || 0);
    req.flash("success", "Business feature status updated.");
    res.redirect("/admin/businesses");
  } catch (err) {
    next(err);
  }
}
