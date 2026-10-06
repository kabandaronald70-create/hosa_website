// Job Board view — renders opportunities with search, filter, and save.

import ExternalServices from "./ExternalServices.js";
import Storage from "./Storage.js";

const services = new ExternalServices();

export default class JobBoard {
  constructor() {
    this.opportunities = [];
    this.filtered = [];
    this.state = {
      search: "",
      type: "all",
      location: "all",
      savedOnly: false,
    };
  }

  async render(container) {
    container.innerHTML = `
      <header class="section__header">
        <h2>Job Board</h2>
        <p>Internships, graduate programs, scholarships, and jobs for HOSA members.</p>
      </header>

      <div class="split">
        <aside class="split__aside card">
          <h3>Filters</h3>

          <label class="field">
            <span>Search</span>
            <input type="search" id="job-search" placeholder="e.g. bank, nurse" autocomplete="off">
          </label>

          <label class="field">
            <span>Type</span>
            <select id="job-type">
              <option value="all">All types</option>
            </select>
          </label>

          <label class="field">
            <span>Location</span>
            <select id="job-location">
              <option value="all">All locations</option>
            </select>
          </label>

          <label class="checkbox">
            <input type="checkbox" id="job-saved">
            <span>Saved only</span>
          </label>

          <button type="button" class="btn btn--ghost" id="job-reset">Reset</button>
        </aside>

        <div>
          <p class="results-count" id="job-count" aria-live="polite"></p>
          <div class="stack" id="jobs-list"></div>
        </div>
      </div>
    `;

    try {
      this.opportunities = await services.getOpportunities();
    } catch (err) {
      console.error("Failed to load opportunities:", err);
      container.querySelector("#jobs-list").innerHTML =
        '<p class="alert alert--error">Could not load opportunities.</p>';
      return;
    }

    this.populateFilters();
    this.attachListeners();
    this.applyFilters();
  }

  populateFilters() {
    const types = [
      ...new Set(this.opportunities.map((o) => o.type).filter(Boolean)),
    ].sort();
    const locations = [
      ...new Set(this.opportunities.map((o) => o.location).filter(Boolean)),
    ].sort();

    const typeSelect = document.querySelector("#job-type");
    const locSelect = document.querySelector("#job-location");

    types.forEach((t) => {
      const opt = document.createElement("option");
      opt.value = t;
      opt.textContent = t;
      typeSelect.appendChild(opt);
    });

    locations.forEach((l) => {
      const opt = document.createElement("option");
      opt.value = l;
      opt.textContent = l;
      locSelect.appendChild(opt);
    });
  }

  attachListeners() {
    document.querySelector("#job-search").addEventListener("input", (e) => {
      this.state.search = e.target.value.trim().toLowerCase();
      this.applyFilters();
    });

    document.querySelector("#job-type").addEventListener("change", (e) => {
      this.state.type = e.target.value;
      this.applyFilters();
    });

    document.querySelector("#job-location").addEventListener("change", (e) => {
      this.state.location = e.target.value;
      this.applyFilters();
    });

    document.querySelector("#job-saved").addEventListener("change", (e) => {
      this.state.savedOnly = e.target.checked;
      this.applyFilters();
    });

    document.querySelector("#job-reset").addEventListener("click", () => {
      document.querySelector("#job-search").value = "";
      document.querySelector("#job-type").value = "all";
      document.querySelector("#job-location").value = "all";
      document.querySelector("#job-saved").checked = false;
      this.state = {
        search: "",
        type: "all",
        location: "all",
        savedOnly: false,
      };
      this.applyFilters();
    });
  }

  applyFilters() {
    let result = [...this.opportunities];

    if (this.state.search) {
      const q = this.state.search;
      result = result.filter(
        (o) =>
          o.title.toLowerCase().includes(q) ||
          o.employer.toLowerCase().includes(q) ||
          o.description.toLowerCase().includes(q),
      );
    }

    if (this.state.type !== "all") {
      result = result.filter((o) => o.type === this.state.type);
    }

    if (this.state.location !== "all") {
      result = result.filter((o) => o.location === this.state.location);
    }

    if (this.state.savedOnly) {
      result = result.filter((o) => Storage.isFavourite(o.id));
    }

    // Sort by deadline ascending
    result.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

    this.filtered = result;
    this.renderList();
  }

  renderList() {
    const list = document.querySelector("#jobs-list");
    const count = document.querySelector("#job-count");

    count.textContent = `${this.filtered.length} of ${this.opportunities.length} opportunities`;

    if (this.filtered.length === 0) {
      list.innerHTML = `
        <p class="empty-state">
          No opportunities match your filters.
        </p>
      `;
      return;
    }

    list.innerHTML = this.filtered.map(jobCardTemplate).join("");

    list.querySelectorAll("[data-save-id]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const id = e.currentTarget.dataset.saveId;
        Storage.toggleFavourite(id);
        this.applyFilters();
      });
    });
  }
}

function jobCardTemplate(o) {
  const saved = Storage.isFavourite(o.id);
  const deadline = new Date(o.deadline + "T00:00:00");
  const deadlineStr = isNaN(deadline.getTime())
    ? o.deadline
    : deadline.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });

  return `
    <article class="card job-card">
      <header class="job-card__header">
        <div>
          <p class="job-card__type">${escapeHtml(o.type)}</p>
          <h3 class="job-card__title">${escapeHtml(o.title)}</h3>
          <p class="job-card__employer">${escapeHtml(o.employer)}</p>
        </div>
        <p class="job-card__deadline">Deadline: ${deadlineStr}</p>
      </header>

      <p class="job-card__location">${escapeHtml(o.location)}</p>
      <p class="job-card__description">${escapeHtml(o.description)}</p>

      <div class="job-card__actions">
        <button type="button"
                class="btn btn--ghost"
                data-save-id="${o.id}"
                aria-pressed="${saved}">
          ${saved ? "★ Saved" : "☆ Save"}
        </button>
      </div>
    </article>
  `;
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
