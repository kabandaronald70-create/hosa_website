import {
  listActiveRequests,
  getUserRequests,
  createRequest,
  closeRequest,
  hasPostedTwoRequestsThisMonth,
} from "../models/networkModel.js";

// --- Public Board ---
export async function showNetworkBoard(req, res, next) {
  try {
    const requests = await listActiveRequests();
    res.render("public/business-network", {
      title: "Business Network — HOSA",
      requests,
      layout: "layouts/public",
    });
  } catch (err) {
    next(err);
  }
}

// --- Member Dashboard ---
export async function showMyNetworkRequests(req, res, next) {
  try {
    const requests = await getUserRequests(req.user.id);
    const limitReached = await hasPostedTwoRequestsThisMonth(req.user.id);

    // Count how many they've posted this month (for display)
    const monthCount = requests.filter((r) => {
      const created = new Date(r.created_at);
      const now = new Date();
      return (
        created.getMonth() === now.getMonth() &&
        created.getFullYear() === now.getFullYear()
      );
    }).length;

    res.render("dashboard/business-network", {
      title: "My Network Requests",
      requests,
      limitReached,
      monthCount,
      layout: "layouts/app",
    });
  } catch (err) {
    next(err);
  }
}

export async function actionCreateRequest(req, res, next) {
  try {
    // 1. Enforce the 2-per-month limit
    const limitReached = await hasPostedTwoRequestsThisMonth(req.user.id);
    if (limitReached) {
      req.flash("error", "You can only submit 2 network requests per month.");
      return res.redirect("/dashboard/business-network");
    }

    const { request_type, title, description, contact_method, expires_at } =
      req.body;

    await createRequest({
      userId: req.user.id,
      requestType: request_type,
      title,
      description,
      contactMethod: contact_method,
      expiresAt: expires_at || null,
    });

    req.flash("success", "Network request posted successfully.");
    res.redirect("/dashboard/business-network");
  } catch (err) {
    next(err);
  }
}

export async function actionCloseRequest(req, res, next) {
  try {
    await closeRequest(req.params.id, req.user.id);
    req.flash("success", "Request closed.");
    res.redirect("/dashboard/business-network");
  } catch (err) {
    next(err);
  }
}
