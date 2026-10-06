// HOSA — Application entry point and hash router.

import HomeView from "./HomeView.js";
import DirectoryView from "./DirectoryView.js";
import EventsView from "./EventsView.js";
import MentorshipForm from "./MentorshipForm.js";
import JobBoard from "./JobBoard.js";
import StoriesCarousel from "./StoriesCarousel.js";
import NotFoundView from "./NotFoundView.js";
import { updateSavedBadge } from "./updateSavedBadge.js";
import SavedView from "./SavedView.js";
import PrivacyView from "./PrivacyView.js";

// ---------- Footer year ----------
const yearEl = document.querySelector("#year");
if (yearEl) yearEl.textContent = new Date().getFullYear();

// ---------- Saved items badge ----------
updateSavedBadge();
window.addEventListener("hosa:favourites-changed", updateSavedBadge);
window.addEventListener("hosa:rsvps-changed", updateSavedBadge);

// ---------- Mobile menu toggle ----------
const menuToggle = document.querySelector(".menu-toggle");
const primaryNav = document.querySelector("#primary-nav");

if (menuToggle && primaryNav) {
  menuToggle.addEventListener("click", () => {
    const isOpen = primaryNav.classList.toggle("open");
    menuToggle.setAttribute("aria-expanded", String(isOpen));
  });

  primaryNav.addEventListener("click", (e) => {
    if (e.target.matches("a")) {
      primaryNav.classList.remove("open");
      menuToggle.setAttribute("aria-expanded", "false");
    }
  });
}

// ---------- Routes ----------
const routes = {
  "": HomeView,
  directory: DirectoryView,
  events: EventsView,
  mentorship: MentorshipForm,
  jobs: JobBoard,
  stories: StoriesCarousel,
  saved: SavedView,
  privacy: PrivacyView,
};

// ---------- Page titles per route ----------
const titles = {
  "": "HOSA | Highway Old Students' Association",
  directory: "Alumni Directory | HOSA",
  events: "Events | HOSA",
  mentorship: "Mentorship | HOSA",
  jobs: "Job Board | HOSA",
  stories: "Alumni Stories | HOSA",
  saved: "Saved Items | HOSA",
  privacy: "Privacy Policy | HOSA",
  member: "Member Profile | HOSA",
};

// ---------- Router ----------
async function router() {
  const hash = window.location.hash.replace(/^#\/?/, "");
  const [routeKey, param] = hash.split("/");

  let view;

  if (routeKey === "member" && param) {
    const { default: MemberDetails } = await import("./MemberDetails.js");
    view = new MemberDetails(param);
  } else {
    const viewClass =
      routeKey === "" ? routes[""] : (routes[routeKey] ?? NotFoundView);

    view = typeof viewClass === "function" ? new viewClass() : viewClass;
  }

  const container = document.querySelector("#view-root");
  if (!container) return;
  container.innerHTML = "<p>Loading…</p>";

  try {
    await view.render(container);
  } catch (err) {
    console.error("View failed:", err);
    container.innerHTML = `
      <p class="alert alert--error">
        Something went wrong loading this page.
      </p>
    `;
  }

  // ---------- Set page title ----------
  document.title =
    titles[routeKey] || "HOSA | Highway Old Students' Association";

  // ---------- Highlight the active nav link ----------
  document.querySelectorAll(".primary-nav a[data-route]").forEach((link) => {
    const isActive = link.dataset.route === (routeKey || "home");
    link.classList.toggle("active", isActive);
    if (isActive) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

// ---------- Boot ----------
window.addEventListener("hashchange", router);
window.addEventListener("DOMContentLoaded", router);
