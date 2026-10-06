// Saved view — displays favourites (jobs, events, mentors).

import ExternalServices from "./ExternalServices.js";
import Storage from "./Storage.js";

const services = new ExternalServices();

export default class SavedView {
  constructor() {
    this.jobs = [];
    this.events = [];
    this.members = [];
  }

  async render(container) {
    container.innerHTML = `
      <header class="section__header">
        <h1>Saved Items</h1>
        <p>Your saved jobs, events, and mentors.</p>
      </header>
      <div id="saved-content">
        <p>Loading…</p>
      </div>
    `;

    try {
      const [jobs, events, members] = await Promise.all([
        services.getOpportunities(),
        services.getEvents(),
        services.getMembers(),
      ]);
      this.jobs = jobs;
      this.events = events;
      this.members = members;
    } catch (err) {
      console.error("Failed to load saved items:", err);
      container.querySelector("#saved-content").innerHTML =
        '<p class="alert alert--error">Could not load your saved items. Please try again.</p>';
      return;
    }

    this.renderContent();
  }

  renderContent() {
    const favourites = Storage.getFavourites();
    const content = document.querySelector("#saved-content");

    if (favourites.length === 0) {
      content.innerHTML = `
        <p class="empty-state">
          You haven't saved any items yet. Browse the
          <a href="#/jobs">job board</a> or
          <a href="#/events">events</a> to save items.
        </p>
      `;
      return;
    }

    // Match favourites against each data type
    const savedJobs = this.jobs.filter((j) => favourites.includes(j.id));
    const savedEvents = this.events.filter((e) => favourites.includes(e.id));
    const savedMentors = this.members.filter((m) => favourites.includes(m.id));

    let html = "";

    if (savedJobs.length > 0) {
      html += `
        <section class="section section--tight">
          <h2>Saved Jobs (${savedJobs.length})</h2>
          <div class="stack">
            ${savedJobs.map(savedJobTemplate).join("")}
          </div>
        </section>
      `;
    }

    if (savedEvents.length > 0) {
      html += `
        <section class="section section--tight">
          <h2>Saved Events (${savedEvents.length})</h2>
          <div class="stack">
            ${savedEvents.map(savedEventTemplate).join("")}
          </div>
        </section>
      `;
    }

    if (savedMentors.length > 0) {
      html += `
        <section class="section section--tight">
          <h2>Saved Mentors (${savedMentors.length})</h2>
          <div class="grid grid--cards">
            ${savedMentors.map(savedMentorTemplate).join("")}
          </div>
        </section>
      `;
    }

    content.innerHTML = html;

    // Wire up "Remove" buttons
    content.querySelectorAll("[data-remove-id]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const id = e.currentTarget.dataset.removeId;
        Storage.toggleFavourite(id);
        this.renderContent();
      });
    });
  }
}

// ---------- Templates ----------

function savedJobTemplate(job) {
  return `
    <article class="card job-card">
      <header class="job-card__header">
        <div>
          <p class="job-card__type">${escapeHtml(job.type)}</p>
          <h3 class="job-card__title">${escapeHtml(job.title)}</h3>
          <p class="job-card__employer">${escapeHtml(job.employer)}</p>
        </div>
        <p class="job-card__deadline">Deadline: ${escapeHtml(job.deadline)}</p>
      </header>
      <p class="job-card__location">${escapeHtml(job.location)}</p>
      <div class="job-card__actions">
        <button type="button" class="btn btn--ghost"
                data-remove-id="${job.id}">Remove</button>
      </div>
    </article>
  `;
}

function savedEventTemplate(event) {
  return `
    <article class="card event-card">
      <header class="event-card__header">
        <div>
          <p class="event-card__type">${escapeHtml(event.type)}</p>
          <h3 class="event-card__title">${escapeHtml(event.title)}</h3>
        </div>
        <p class="event-card__date">${escapeHtml(event.date)}</p>
      </header>
      <p class="event-card__venue">
        <strong>Venue:</strong> ${escapeHtml(event.venue)}
      </p>
      <div class="event-card__actions">
        <button type="button" class="btn btn--ghost"
                data-remove-id="${event.id}">Remove</button>
      </div>
    </article>
  `;
}

function savedMentorTemplate(m) {
  return `
    <article class="card member-card">
      <div class="member-card__header">
        <div class="member-card__avatar" aria-hidden="true">${initials(m.name)}</div>
        <div>
          <h3 class="member-card__name">${escapeHtml(m.name)}</h3>
          <p class="member-card__meta">Class of ${m.classYear}</p>
        </div>
      </div>
      <p class="member-card__profession">${escapeHtml(m.profession)}</p>
      <button type="button" class="btn btn--ghost member-card__link"
              data-remove-id="${m.id}">Remove</button>
    </article>
  `;
}

function initials(name) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
