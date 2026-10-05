// HOSA — Application entry point and hash router.

import HomeView from "./HomeView.js";
import DirectoryView from "./DirectoryView.js";
import placeholderView from "./PlaceholderView.js";

// ---------- Footer year ----------
const yearEl = document.querySelector("#year");
if (yearEl) yearEl.textContent = new Date().getFullYear();

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
  events: placeholderView("Events", "Events coming in Week 6."),
  mentorship: placeholderView(
    "Mentorship",
    "Mentorship matching coming in Week 6.",
  ),
  jobs: placeholderView("Job Board", "Opportunities coming in Week 6."),
  saved: placeholderView("Saved Items", "Your saved items will appear here."),
  privacy: placeholderView("Privacy Policy", "Privacy policy coming soon."),
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
    const viewClass = routes[routeKey] ?? routes[""];
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
