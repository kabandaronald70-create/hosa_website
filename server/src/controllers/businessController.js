import {
  listApprovedBusinesses,
  getBusinessesByUser,
  createBusiness,
  listPendingBusinesses,
  setBusinessStatus,
  hasPostedRecently,
  toggleFeaturedBusiness,
  listAllBusinessesForAdmin,
} from "../models/businessModel.js";
import { uploadBusinessLogo } from "../services/logoService.js"; // <-- ADDED

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
    const businesses = await listApprovedBusinesses({ search, category });

    res.render("public/business-directory", {
      title: "Alumni Business Directory",
      businesses,
      categories: CATEGORIES,
      filters: { search, category },
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

    // Calculate if they can submit based on their latest post
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
    // 1. Enforce the 1-month limit (Server-side check)
    const recentlyPosted = await hasPostedRecently(req.user.id);
    if (recentlyPosted) {
      req.flash(
        "error",
        "You can only submit one business per month. Please try again in 30 days.",
      );
      return res.redirect("/dashboard/businesses");
    }

    // 2. Handle the uploaded logo via Supabase Storage
    let logoUrl = null;
    if (req.file) {
      logoUrl = await uploadBusinessLogo(
        req.user.id,
        req.file.buffer, // Memory storage gives us the buffer
        req.file.mimetype,
        req.file.originalname,
      );
    }

    // 3. Create the business
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
      logoPath: logoUrl, // <-- Saves the full Supabase URL
    });

    req.flash("success", "Business submitted! It is pending admin approval.");
    res.redirect("/dashboard/businesses");
  } catch (err) {
    next(err);
  }
}

// --- Admin Moderation ---
export async function showPendingBusinesses(req, res, next) {
  try {
    // CHANGED: Fetch all businesses instead of just pending ones
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

// --- New: Feature/Unfeature Business ---
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
