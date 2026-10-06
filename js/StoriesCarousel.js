// Stories view — renders alumni stories with an animated carousel.

import ExternalServices from "./ExternalServices.js";

const services = new ExternalServices();

export default class StoriesCarousel {
  constructor() {
    this.stories = [];
    this.currentIndex = 0;
    this.autoTimer = null;
  }

  async render(container) {
    // Clear any lingering timer from a previous render.
    this.stopAuto();

    container.innerHTML = `
      <header class="section__header">
        <h1>Alumni Stories</h1>
        <p>Success stories from old students of Highway Secondary School.</p>
      </header>

      <div class="carousel" id="carousel">
        <p>Loading stories…</p>
      </div>
    `;

    try {
      this.stories = await services.getStories();
    } catch (err) {
      console.error("Failed to load stories:", err);
      const c = container.querySelector("#carousel");
      if (c)
        c.innerHTML =
          '<p class="alert alert--error">Could not load stories.</p>';
      return;
    }

    if (this.stories.length === 0) {
      const c = container.querySelector("#carousel");
      if (c) c.innerHTML = '<p class="empty-state">No stories yet.</p>';
      return;
    }

    this.currentIndex = 0;
    this.renderCarousel();
    this.attachListeners();
    this.startAuto();
  }

  renderCarousel() {
    const c = document.querySelector("#carousel");
    if (!c) {
      // User navigated away — clean up and stop.
      this.stopAuto();
      return;
    }

    const story = this.stories[this.currentIndex];

    c.innerHTML = `
      <article class="story-card card">
        <p class="story-card__author">
          ${escapeHtml(story.author)} &middot; Class of ${story.classYear}
        </p>
        <h2 class="story-card__title">${escapeHtml(story.title)}</h2>
        <p class="story-card__excerpt">${escapeHtml(story.excerpt)}</p>
        <p class="story-card__body">${escapeHtml(story.body)}</p>
      </article>

      <div class="carousel__controls">
        <button type="button" class="btn btn--ghost" id="story-prev" aria-label="Previous story">←</button>

        <div class="carousel__dots" role="tablist">
          ${this.stories
            .map(
              (_, i) => `
            <button type="button"
                    class="carousel__dot ${i === this.currentIndex ? "is-active" : ""}"
                    role="tab"
                    aria-selected="${i === this.currentIndex}"
                    aria-label="Story ${i + 1}"
                    data-index="${i}"></button>
          `,
            )
            .join("")}
        </div>

        <button type="button" class="btn btn--ghost" id="story-next" aria-label="Next story">→</button>
      </div>
    `;
  }

  attachListeners() {
    const c = document.querySelector("#carousel");
    if (!c) return;

    const prev = c.querySelector("#story-prev");
    const next = c.querySelector("#story-next");

    if (prev)
      prev.addEventListener("click", () => this.goTo(this.currentIndex - 1));
    if (next)
      next.addEventListener("click", () => this.goTo(this.currentIndex + 1));

    c.querySelectorAll(".carousel__dot").forEach((dot) => {
      dot.addEventListener("click", (e) => {
        this.goTo(parseInt(e.currentTarget.dataset.index, 10));
      });
    });
  }

  goTo(index) {
    if (this.stories.length === 0) return;
    const n = this.stories.length;
    this.currentIndex = ((index % n) + n) % n;
    this.renderCarousel();
    this.attachListeners();
    this.restartAuto();
  }

  startAuto() {
    this.stopAuto();
    this.autoTimer = setInterval(() => this.goTo(this.currentIndex + 1), 8000);
  }

  restartAuto() {
    this.stopAuto();
    this.startAuto();
  }

  stopAuto() {
    if (this.autoTimer) {
      clearInterval(this.autoTimer);
      this.autoTimer = null;
    }
  }
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
