// Member profile view.

import ExternalServices from "./ExternalServices.js";
import { saveItem, unsaveByLookup } from "./apiSaved.js";
import { getMySaved, getMe } from "./apiAuth.js";

const services = new ExternalServices();

export default class MemberDetails {
  constructor(id) {
    this.id = id;
  }

  async render(container) {
    container.innerHTML = "<p>Loading profile…</p>";

    try {
      const [members, saved] = await Promise.all([
        services.getMembers(),
        getMySaved().catch(() => []),
      ]);
      const member = members.find((m) => String(m.id) === String(this.id));

      if (!member) {
        container.innerHTML = `
          <p class="alert alert--error">Member not found.</p>
          <p><a href="#/directory" class="btn btn--ghost">Back to directory</a></p>
        `;
        return;
      }

      const isSaved = saved.some(
        (s) =>
          s.item_type === "member" && String(s.item_id) === String(member.id),
      );
      const { user } = await getMe();
      const mentorshipUrl = `/dashboard/mentorship/requests/new?mentor=${encodeURIComponent(member.userId)}`;
      container.innerHTML = `
        <p><a href="#/directory" class="link-button">← Back to directory</a></p>

        <article class="card profile">
          <header class="profile__header">
            <div class="profile__avatar" aria-hidden="true">${initials(member.name)}</div>
            <div>
              <h1>${escapeHtml(member.name)}</h1>
              <p class="profile__meta">Class of ${member.classYear} &middot; ${escapeHtml(member.district)}, ${escapeHtml(member.country)}</p>
              <p class="profile__profession">${escapeHtml(member.profession)}</p>
            </div>
          </header>

          <section class="profile__body">
            <h2>About</h2>
            <p>${escapeHtml(member.bio)}</p>
          </section>

          <section class="profile__body">
            <h2>Details</h2>
            <dl class="profile__details">
              <dt>Contact preference</dt><dd>${escapeHtml(member.contactPreference)}</dd>
              <dt>Mentor</dt><dd>${member.mentor ? `Yes — ${escapeHtml(member.mentorField)}` : "Not currently"}</dd>
            </dl>
          </section>

          <div class="profile__actions">
            <button type="button"
                    class="btn ${isSaved ? "btn--primary" : "btn--ghost"}"
                    id="save-member"
                    data-saved="${isSaved}"
                    aria-pressed="${isSaved}">
              ${isSaved ? "★ Saved" : "Save to favourites"}
            </button>
            ${
              member.mentor
                ? `<a href="${mentorshipUrl}" class="btn btn--ghost">Request mentorship</a>`
                : ""
            }
          </div>
        </article>
      `;

      const saveBtn = document.querySelector("#save-member");
      saveBtn.addEventListener("click", async () => {
        const currentlySaved = saveBtn.dataset.saved === "true";
        saveBtn.disabled = true;
        const original = saveBtn.textContent;
        saveBtn.textContent = "…";

        if (currentlySaved) {
          const list = await getMySaved().catch(() => []);
          const r = await unsaveByLookup(list, "member", member.userId);
          if (r.ok) {
            saveBtn.dataset.saved = "false";
            saveBtn.setAttribute("aria-pressed", "false");
            saveBtn.textContent = "Save to favourites";
            saveBtn.classList.remove("btn--primary");
            saveBtn.classList.add("btn--ghost");
          } else {
            saveBtn.textContent = original;
          }
        } else {
          const r = await saveItem("member", member.userId);
          if (r.ok) {
            saveBtn.dataset.saved = "true";
            saveBtn.setAttribute("aria-pressed", "true");
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
      console.error("Failed to load member profile:", err);
      container.innerHTML = `<p class="alert alert--error">Could not load this profile.</p>`;
    }
  }
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
