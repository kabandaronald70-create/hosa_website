// Member profile view.

import ExternalServices from "./ExternalServices.js";

const services = new ExternalServices();

export default class MemberDetails {
  constructor(id) {
    this.id = id;
  }

  async render(container) {
    container.innerHTML = "<p>Loading profile…</p>";

    try {
      const members = await services.getMembers();
      const member = members.find((m) => m.id === this.id);

      if (!member) {
        container.innerHTML = `
          <p class="alert alert--error">Member not found.</p>
          <p><a href="#/directory" class="btn btn--ghost">Back to directory</a></p>
        `;
        return;
      }

      container.innerHTML = `
        <p><a href="#/directory" class="link-button">← Back to directory</a></p>

        <article class="card profile">
          <header class="profile__header">
            <div class="profile__avatar" aria-hidden="true">${initials(member.name)}</div>
            <div>
              <h2>${escapeHtml(member.name)}</h2>
              <p class="profile__meta">Class of ${member.classYear} &middot; ${escapeHtml(member.district)}, ${escapeHtml(member.country)}</p>
              <p class="profile__profession">${escapeHtml(member.profession)}</p>
            </div>
          </header>

          <section class="profile__body">
            <h3>About</h3>
            <p>${escapeHtml(member.bio)}</p>
          </section>

          <section class="profile__body">
            <h3>Details</h3>
            <dl class="profile__details">
              <dt>Contact preference</dt><dd>${escapeHtml(member.contactPreference)}</dd>
              <dt>Mentor</dt><dd>${member.mentor ? `Yes — ${escapeHtml(member.mentorField)}` : "Not currently"}</dd>
            </dl>
          </section>

          <div class="profile__actions">
            <button type="button" class="btn btn--primary" id="save-member">Save to favourites</button>
            ${member.mentor ? '<a href="#/mentorship" class="btn btn--ghost">Request mentorship</a>' : ""}
          </div>
        </article>
      `;

      document.querySelector("#save-member").addEventListener("click", () => {
        alert("Save feature coming soon.");
      });
    } catch (err) {
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
