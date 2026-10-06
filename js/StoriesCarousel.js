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
    container.innerHTML = `
      <header class="section__header">
        <h2>Alumni Stories</h2>
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
      container.querySelector("#carousel").innerHTML =
        '<p class="alert alert--error">Could not load stories.</p>';
      return;
    }

    if (this.stories.length === 0) {
      container.querySelector("#carousel").innerHTML =
        '<p class="empty-state">No stories yet.</p>';
      return;
    }

    this.renderCarousel();
    this.attachListeners();
    this.startAuto();
  }

  renderCarousel() {
    const c = document.querySelector("#carousel");
    const story = this.stories[this.currentIndex];

    c.innerHTML = `
      <article class="story-card card">
        <p class="story-card__author">
          ${escapeHtml(story.author)} &middot; Class of ${story.classYear}
        </p>
        <h3 class="story-card__title">${escapeHtml(story.title)}</h3>
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

    c.querySelector("#story-prev").addEventListener("click", () => {
      this.goTo(this.currentIndex - 1);
    });

    c.querySelector("#story-next").addEventListener("click", () => {
      this.goTo(this.currentIndex + 1);
    });

    c.querySelectorAll(".carousel__dot").forEach((dot) => {
      dot.addEventListener("click", (e) => {
        this.goTo(parseInt(e.currentTarget.dataset.index, 10));
      });
    });
  }

  goTo(index) {
    const n = this.stories.length;
    this.currentIndex = ((index % n) + n) % n;
    this.renderCarousel();
    this.attachListeners();
    this.restartAuto();
  }

  startAuto() {
    this.autoTimer = setInterval(() => this.goTo(this.currentIndex + 1), 8000);
  }

  restartAuto() {
    if (this.autoTimer) clearInterval(this.autoTimer);
    this.startAuto();
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
