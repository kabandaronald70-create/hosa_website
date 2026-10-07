// Stories view — filterable grid of alumni stories.

import ExternalServices from "./ExternalServices.js";

const services = new ExternalServices();

export default class StoriesView {
  constructor() {
    this.stories = [];
    this.filtered = [];
    this.state = {
      search: "",
      category: "all",
      decade: "all",
    };
  }

  async render(container) {
    container.innerHTML = `
      <header class="section__header">
        <h1>Alumni Stories</h1>
        <p>Success stories from old students of Highway Secondary School.</p>
      </header>

      <div class="split">
        <aside class="split__aside card">
          <h2>Filters</h2>

          <label class="field">
            <span>Search</span>
            <input type="search" id="story-search" placeholder="e.g. nurse, Moses" autocomplete="off">
          </label>

          <label class="field">
            <span>Category</span>
            <select id="story-category">
              <option value="all">All categories</option>
            </select>
          </label>

          <label class="field">
            <span>Class decade</span>
            <select id="story-decade">
              <option value="all">All years</option>
              <option value="2000s">2000–2009</option>
              <option value="2010s">2010–2019</option>
            </select>
          </label>

          <button type="button" class="btn btn--ghost" id="story-reset">Reset filters</button>
        </aside>

        <div>
          <p class="results-count" id="story-count" aria-live="polite"></p>
          <div class="grid grid--cards" id="stories-grid"></div>
        </div>
      </div>
    `;

    try {
      this.stories = await services.getStories();
    } catch (err) {
      console.error("Failed to load stories:", err);
      container.querySelector("#stories-grid").innerHTML =
        '<p class="alert alert--error">Could not load stories. Please try again later.</p>';
      return;
    }

    this.populateCategories();
    this.attachListeners();
    this.applyFilters();
  }

  populateCategories() {
    const categories = [
      ...new Set(this.stories.map((s) => s.category).filter(Boolean)),
    ].sort();

    const select = document.querySelector("#story-category");
    categories.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      select.appendChild(opt);
    });
  }

  attachListeners() {
    document.querySelector("#story-search").addEventListener("input", (e) => {
      this.state.search = e.target.value.trim().toLowerCase();
      this.applyFilters();
    });

    document
      .querySelector("#story-category")
      .addEventListener("change", (e) => {
        this.state.category = e.target.value;
        this.applyFilters();
      });

    document.querySelector("#story-decade").addEventListener("change", (e) => {
      this.state.decade = e.target.value;
      this.applyFilters();
    });

    document.querySelector("#story-reset").addEventListener("click", () => {
      document.querySelector("#story-search").value = "";
      document.querySelector("#story-category").value = "all";
      document.querySelector("#story-decade").value = "all";
      this.state = { search: "", category: "all", decade: "all" };
      this.applyFilters();
    });
  }

  applyFilters() {
    let result = [...this.stories];

    // Search by title or author
    if (this.state.search) {
      result = result.filter(
        (s) =>
          s.title.toLowerCase().includes(this.state.search) ||
          s.author.toLowerCase().includes(this.state.search),
      );
    }

    // Filter by category
    if (this.state.category !== "all") {
      result = result.filter((s) => s.category === this.state.category);
    }

    // Filter by decade
    if (this.state.decade === "2000s") {
      result = result.filter((s) => s.classYear >= 2000 && s.classYear <= 2009);
    } else if (this.state.decade === "2010s") {
      result = result.filter((s) => s.classYear >= 2010 && s.classYear <= 2019);
    }

    // Sort by date desc (newest first)
    result.sort((a, b) => new Date(b.date) - new Date(a.date));

    this.filtered = result;
    this.renderGrid();
  }

  renderGrid() {
    const grid = document.querySelector("#stories-grid");
    const count = document.querySelector("#story-count");

    count.textContent = `${this.filtered.length} of ${this.stories.length} stories`;

    if (this.filtered.length === 0) {
      grid.innerHTML = `
        <p class="empty-state">
          No stories match your filters. <button type="button" class="link-button" id="empty-story-reset">Reset filters</button>
        </p>
      `;
      const reset = document.querySelector("#empty-story-reset");
      if (reset) {
        reset.addEventListener("click", () => {
          document.querySelector("#story-reset").click();
        });
      }
      return;
    }

    grid.innerHTML = this.filtered.map(storyCardTemplate).join("");
  }
}

function storyCardTemplate(s) {
  return `
    <article class="card story-hub-card">
      <p class="story-hub-card__category">${escapeHtml(s.category)}</p>
      <h2 class="story-hub-card__title">${escapeHtml(s.title)}</h2>
      <p class="story-hub-card__author">
        ${escapeHtml(s.author)} &middot; Class of ${s.classYear}
      </p>
      <p class="story-hub-card__excerpt">${escapeHtml(s.excerpt)}</p>
      <a href="#/story/${s.id}" class="btn btn--ghost story-hub-card__link">Read full story</a>
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
