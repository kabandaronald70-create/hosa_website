// Story detail view — full alumni story.

import ExternalServices from "./ExternalServices.js";
import { saveItem, unsaveByLookup } from "./apiSaved.js";
import { getMySaved } from "./apiAuth.js";

const services = new ExternalServices();

export default class StoryDetails {
  constructor(id) {
    this.id = id;
  }

  async render(container) {
    container.innerHTML = "<p>Loading story…</p>";

    try {
      const [stories, saved] = await Promise.all([
        services.getStories(),
        getMySaved().catch(() => []),
      ]);

      const story = stories.find((s) => String(s.id) === String(this.id));

      if (!story) {
        container.innerHTML = `
          <p class="alert alert--error">Story not found.</p>
          <p><a href="#/stories" class="btn btn--ghost">Back to stories</a></p>
        `;
        return;
      }

      const isSaved = saved.some(
        (s) =>
          s.item_type === "story" && String(s.item_id) === String(story.id),
      );

      const date = new Date(story.date + "T00:00:00").toLocaleDateString(
        "en-GB",
        { day: "numeric", month: "long", year: "numeric" },
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
            
            <button type="button"
                    class="btn ${isSaved ? "btn--primary" : "btn--ghost"}"
                    id="save-story"
                    data-saved="${isSaved}">
              ${isSaved ? "★ Saved" : "☆ Save story"}
            </button>

            <a href="#/stories" class="btn btn--ghost">More stories</a>
          </div>
        </article>
      `;

      const saveBtn = document.querySelector("#save-story");
      saveBtn.addEventListener("click", async () => {
        const currentlySaved = saveBtn.dataset.saved === "true";
        saveBtn.disabled = true;
        const original = saveBtn.textContent;
        saveBtn.textContent = "…";

        if (currentlySaved) {
          const list = await getMySaved().catch(() => []);
          const r = await unsaveByLookup(list, "story", story.id);
          if (r.ok) {
            saveBtn.dataset.saved = "false";
            saveBtn.textContent = "☆ Save story";
            saveBtn.classList.remove("btn--primary");
            saveBtn.classList.add("btn--ghost");
          } else {
            saveBtn.textContent = original;
          }
        } else {
          const r = await saveItem("story", story.id);
          if (r.ok) {
            saveBtn.dataset.saved = "true";
            saveBtn.textContent = "★ Saved";
            saveBtn.classList.remove("btn--ghost");
            saveBtn.classList.add("btn--primary");
          } else {
            saveBtn.textContent = original;
          }
        }
        saveBtn.disabled = false;
      });
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
