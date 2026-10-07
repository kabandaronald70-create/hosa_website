// Directory view — renders members, search, filter, and sort.

import ExternalServices from "./ExternalServices.js";
import Storage from "./Storage.js";

const services = new ExternalServices();

export default class DirectoryView {
  constructor() {
    this.members = [];
    this.filtered = [];
    this.state = {
      search: "",
      classDecade: "all",
      district: "all",
      profession: "all",
      mentorOnly: false,
      sort: "name-asc",
    };
  }

  async render(container) {
    container.innerHTML = `
      <header class="section__header">
        <h1>Alumni Directory</h1>
        <p>Find and connect with former students of Highway Secondary School.</p>
      </header>

      <div class="split">
        <aside class="split__aside card" id="filters">
          <h2>Filters</h2>

          <label class="field">
            <span>Search by name</span>
            <input type="search" id="filter-search" placeholder="e.g. Sarah" autocomplete="off">
          </label>

          <label class="field">
            <span>Class decade</span>
            <select id="filter-decade">
              <option value="all">All years</option>
              <option value="2000s">2000–2009</option>
              <option value="2010s">2010–2019</option>
            </select>
          </label>

          <label class="field">
            <span>District</span>
            <select id="filter-district">
              <option value="all">All districts</option>
            </select>
          </label>

          <label class="field">
            <span>Profession</span>
            <select id="filter-profession">
              <option value="all">All professions</option>
            </select>
          </label>

          <label class="checkbox">
            <input type="checkbox" id="filter-mentor">
            <span>Willing to mentor</span>
          </label>

          <label class="field">
            <span>Sort by</span>
            <select id="sort-by">
              <option value="name-asc">Name (A–Z)</option>
              <option value="name-desc">Name (Z–A)</option>
              <option value="year-asc">Class year (oldest first)</option>
              <option value="year-desc">Class year (newest first)</option>
            </select>
          </label>

          <button type="button" class="btn btn--ghost" id="filters-reset">Reset filters</button>
        </aside>

        <div>
          <p class="results-count" id="results-count" aria-live="polite"></p>
          <div class="grid grid--cards" id="members-grid"></div>
        </div>
      </div>
    `;

    // Load members
    try {
      this.members = await services.getMembers();
      // Merge with locally-registered members from this browser
      const localMembers = Storage.get("hosa-new-members", []);
      this.members = [...this.members, ...localMembers];
    } catch (err) {
      console.error("Could not load alumni directory:", err);
      container.innerHTML = `
        <p class="alert alert--error">
          Could not load the directory. Please try again later.
        </p>
      `;
      return;
    }

    // Populate dynamic filter options
    this.populateFilters();

    // Wire up filter listeners
    this.attachFilterListeners();

    // Initial render
    this.applyFilters();
  }

  populateFilters() {
    const districts = [
      ...new Set(this.members.map((m) => m.district).filter(Boolean)),
    ].sort();
    const professions = [
      ...new Set(this.members.map((m) => m.profession).filter(Boolean)),
    ].sort();

    const districtSelect = document.querySelector("#filter-district");
    const professionSelect = document.querySelector("#filter-profession");

    districts.forEach((d) => {
      const opt = document.createElement("option");
      opt.value = d;
      opt.textContent = d;
      districtSelect.appendChild(opt);
    });

    professions.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p;
      opt.textContent = p;
      professionSelect.appendChild(opt);
    });
  }

  attachFilterListeners() {
    document.querySelector("#filter-search").addEventListener("input", (e) => {
      this.state.search = e.target.value.trim().toLowerCase();
      this.applyFilters();
    });

    document.querySelector("#filter-decade").addEventListener("change", (e) => {
      this.state.classDecade = e.target.value;
      this.applyFilters();
    });

    document
      .querySelector("#filter-district")
      .addEventListener("change", (e) => {
        this.state.district = e.target.value;
        this.applyFilters();
      });

    document
      .querySelector("#filter-profession")
      .addEventListener("change", (e) => {
        this.state.profession = e.target.value;
        this.applyFilters();
      });

    document.querySelector("#filter-mentor").addEventListener("change", (e) => {
      this.state.mentorOnly = e.target.checked;
      this.applyFilters();
    });

    document.querySelector("#sort-by").addEventListener("change", (e) => {
      this.state.sort = e.target.value;
      this.applyFilters();
    });

    document.querySelector("#filters-reset").addEventListener("click", () => {
      document.querySelector("#filter-search").value = "";
      document.querySelector("#filter-decade").value = "all";
      document.querySelector("#filter-district").value = "all";
      document.querySelector("#filter-profession").value = "all";
      document.querySelector("#filter-mentor").checked = false;
      document.querySelector("#sort-by").value = "name-asc";
      this.state = {
        search: "",
        classDecade: "all",
        district: "all",
        profession: "all",
        mentorOnly: false,
        sort: "name-asc",
      };
      this.applyFilters();
    });
  }

  applyFilters() {
    let result = [...this.members];

    // Search by name
    if (this.state.search) {
      result = result.filter((m) =>
        m.name.toLowerCase().includes(this.state.search),
      );
    }

    // Filter by decade
    if (this.state.classDecade === "2000s") {
      result = result.filter((m) => m.classYear >= 2000 && m.classYear <= 2009);
    } else if (this.state.classDecade === "2010s") {
      result = result.filter((m) => m.classYear >= 2010 && m.classYear <= 2019);
    }

    // Filter by district
    if (this.state.district !== "all") {
      result = result.filter((m) => m.district === this.state.district);
    }

    // Filter by profession
    if (this.state.profession !== "all") {
      result = result.filter((m) => m.profession === this.state.profession);
    }

    // Mentor only
    if (this.state.mentorOnly) {
      result = result.filter((m) => m.mentor === true);
    }

    // Sort
    const [field, dir] = this.state.sort.split("-");
    result.sort((a, b) => {
      let cmp;
      if (field === "name") {
        cmp = a.name.localeCompare(b.name);
      } else {
        cmp = a.classYear - b.classYear;
      }
      return dir === "desc" ? -cmp : cmp;
    });

    this.filtered = result;
    this.renderGrid();
  }

  renderGrid() {
    const grid = document.querySelector("#members-grid");
    const count = document.querySelector("#results-count");

    count.textContent = `${this.filtered.length} of ${this.members.length} members`;

    if (this.filtered.length === 0) {
      grid.innerHTML = `
        <p class="empty-state">
          No members match your filters. <button type="button" class="link-button" id="empty-reset">Reset filters</button>
        </p>
      `;
      const reset = document.querySelector("#empty-reset");
      if (reset) {
        reset.addEventListener("click", () => {
          document.querySelector("#filters-reset").click();
        });
      }
      return;
    }

    grid.innerHTML = this.filtered.map(memberCardTemplate).join("");
  }
}

function memberCardTemplate(m) {
  return `
    <article class="card member-card">
      <div class="member-card__header">
        <div class="member-card__avatar" aria-hidden="true">${initials(m.name)}</div>
        <div>
          <h2 class="member-card__name">${escapeHtml(m.name)}</h2>
          <p class="member-card__meta">Class of ${m.classYear} &middot; ${escapeHtml(m.district)}</p>
        </div>
      </div>
      <p class="member-card__profession">${escapeHtml(m.profession)}</p>
      ${m.mentor ? `<p class="member-card__badge">Available as mentor &middot; ${escapeHtml(m.mentorField)}</p>` : ""}
      <a href="#/member/${m.id}" class="btn btn--ghost member-card__link">View profile</a>
    </article>
  `;
}

function initials(name) {
  return name
    .split(" ")
    .map((part) => part[0])
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
