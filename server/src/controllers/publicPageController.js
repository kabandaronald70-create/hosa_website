export function showAbout(req, res) {
  res.render("public/about", { title: "About HOSA", layout: "layouts/public" });
}

export function showPrivacy(req, res) {
  res.render("public/privacy", {
    title: "Privacy Policy",
    layout: "layouts/public",
  });
}

export function showTerms(req, res) {
  res.render("public/terms", {
    title: "Terms of Service",
    layout: "layouts/public",
  });
}

export function showHelp(req, res) {
  res.render("public/help", { title: "Help & FAQ", layout: "layouts/public" });
}

export function showContact(req, res) {
  res.render("public/contact", {
    title: "Contact Us",
    layout: "layouts/public",
  });
}

export function showMentorshipInfo(req, res) {
  res.render("public/mentorship", {
    title: "Mentorship Programme",
    layout: "layouts/public",
  });
}

export function show404(req, res) {
  res.status(404).render("public/404", {
    title: "Page Not Found",
    layout: "layouts/public",
  });
}

export function show500(req, res, error) {
  res
    .status(500)
    .render("public/500", { title: "Server Error", layout: "layouts/public" });
}

import { query } from "../config/db.js";

export async function showArchive(req, res, next) {
  try {
    // Fetch past events (ended before today)
    const eventsResult = await query(
      `SELECT slug, title, starts_at, venue, description 
         FROM events 
        WHERE status = 'published' 
          AND starts_at < now() 
        ORDER BY starts_at DESC 
        LIMIT 20`,
    );

    // Fetch published stories
    const storiesResult = await query(
      `SELECT slug, title, excerpt, published_at, category
         FROM stories 
        WHERE status = 'published' 
        ORDER BY published_at ASC 
        LIMIT 20`,
    );

    res.render("public/archive", {
      title: "Archive — HOSA",
      layout: "layouts/public",
      pastEvents: eventsResult.rows,
      stories: storiesResult.rows,
    });
  } catch (err) {
    next(err);
  }
}
