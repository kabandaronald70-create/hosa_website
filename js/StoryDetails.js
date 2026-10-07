// Story detail view — full alumni story.

import ExternalServices from "./ExternalServices.js";

const services = new ExternalServices();

export default class StoryDetails {
  constructor(id) {
    this.id = id;
  }

  async render(container) {
    container.innerHTML = "<p>Loading story…</p>";

    try {
      const stories = await services.getStories();
      const story = stories.find((s) => s.id === this.id);

      if (!story) {
        container.innerHTML = `
          <p class="alert alert--error">Story not found.</p>
          <p><a href="#/stories" class="btn btn--ghost">Back to stories</a></p>
        `;
        return;
      }

      const date = new Date(story.date + "T00:00:00").toLocaleDateString(
        "en-GB",
        {
          day: "numeric",
          month: "long",
          year: "numeric",
        },
      );

      container.innerHTML = `
        <p><a href="#/stories" class="link-button">← Back to stories</a></p>

        <article class="card story-detail">
          <p class="story-detail__category">${escapeHtml(story.category)}</p>
          <h1>${escapeHtml(story.title)}</h1>

          <p class="story-detail__byline">
            By <strong>${escapeHtml(story.author)}</strong>
            &middot; Class of ${story.classYear}
            &middot; ${date}
          </p>

          <p class="story-detail__excerpt">${escapeHtml(story.excerpt)}</p>

          <div class="story-detail__body">
            <p>${escapeHtml(story.body)}</p>
          </div>

          <div class="story-detail__actions">
            <a href="#/member/${story.authorId}" class="btn btn--primary">
              View ${escapeHtml(story.author.split(" ")[0])}'s profile
            </a>
            <a href="#/stories" class="btn btn--ghost">More stories</a>
          </div>
        </article>
      `;
    } catch (err) {
      console.error("Failed to load story:", err);
      container.innerHTML = `<p class="alert alert--error">Could not load this story.</p>`;
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
