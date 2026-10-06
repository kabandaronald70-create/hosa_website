// Mentorship view — form, validation, and mentor matching.

import ExternalServices from "./ExternalServices.js";
import Storage from "./Storage.js";

const services = new ExternalServices();

export default class MentorshipForm {
  constructor() {
    this.members = [];
    this.matches = [];
  }

  async render(container) {
    container.innerHTML = `
      <header class="section__header">
        <h1>Mentorship</h1>
        <p>Connect with old students working in fields you're interested in.</p>
      </header>

      <div class="wizard">
        <div class="wizard__step">
          <h2>Step 1 — Choose a field</h2>
          <label class="field">
            <span>Field of interest</span>
            <select id="mentor-field">
              <option value="">Choose a field…</option>
            </select>
          </label>
          <button type="button" class="btn btn--primary" id="find-mentors" disabled>
            Find mentors
          </button>
        </div>

        <div class="wizard__step" id="step-matches" hidden>
          <h2>Step 2 — Matched mentors</h2>
          <div class="grid grid--cards" id="matches-grid"></div>
        </div>

        <div class="wizard__step" id="step-request" hidden>
          <h2>Step 3 — Send a request</h2>
          <form id="mentor-request-form" novalidate>
            <input type="hidden" name="mentorId" id="mentor-id">

            <label class="field">
              <span>Your full name</span>
              <input type="text" name="studentName" required minlength="2">
            </label>

            <label class="field">
              <span>Your class year</span>
              <input type="number" name="classYear" required min="2001" max="2030">
            </label>

            <label class="field">
              <span>Your email</span>
              <input type="email" name="email" required>
            </label>

            <label class="field">
              <span>Short message</span>
              <textarea name="message" rows="4" required minlength="10"></textarea>
            </label>

            <div class="form-actions">
              <button type="submit" class="btn btn--primary">Send request</button>
              <button type="button" class="btn btn--ghost" id="request-cancel">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    `;

    try {
      this.members = await services.getMembers();
    } catch (err) {
      console.error("Failed to load members for mentorship:", err);
      container.innerHTML =
        '<p class="alert alert--error">Could not load mentors. Please try again.</p>';
      return;
    }

    // Populate mentor field options
    const fields = [
      ...new Set(
        this.members
          .filter((m) => m.mentor)
          .map((m) => m.mentorField)
          .filter(Boolean),
      ),
    ].sort();

    const select = container.querySelector("#mentor-field");
    fields.forEach((f) => {
      const opt = document.createElement("option");
      opt.value = f;
      opt.textContent = f;
      select.appendChild(opt);
    });

    // Enable "Find mentors" once a field is chosen
    select.addEventListener("change", (e) => {
      container.querySelector("#find-mentors").disabled = !e.target.value;
    });

    // Find mentors button
    container.querySelector("#find-mentors").addEventListener("click", () => {
      const field = select.value;
      this.showMatches(field);
    });

    // Cancel request button
    container.querySelector("#request-cancel").addEventListener("click", () => {
      container.querySelector("#step-request").hidden = true;
    });

    // Request form submission
    container
      .querySelector("#mentor-request-form")
      .addEventListener("submit", (e) => {
        e.preventDefault();
        this.submitRequest(e.target);
      });
  }

  showMatches(field) {
    this.matches = this.members.filter(
      (m) => m.mentor && m.mentorField === field,
    );

    const stepMatches = document.querySelector("#step-matches");
    const stepRequest = document.querySelector("#step-request");
    const grid = document.querySelector("#matches-grid");

    stepRequest.hidden = true;

    if (this.matches.length === 0) {
      grid.innerHTML = `
        <p class="empty-state">
          No mentors currently listed in <strong>${escapeHtml(field)}</strong>.
          Try another field.
        </p>
      `;
      stepMatches.hidden = false;
      return;
    }

    grid.innerHTML = this.matches.map(mentorCardTemplate).join("");
    stepMatches.hidden = false;

    grid.querySelectorAll("[data-mentor-id]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const id = e.currentTarget.dataset.mentorId;
        this.startRequest(id);
      });
    });
  }

  startRequest(mentorId) {
    const mentor = this.matches.find((m) => m.id === mentorId);
    if (!mentor) return;

    document.querySelector("#mentor-id").value = mentorId;
    const stepRequest = document.querySelector("#step-request");
    stepRequest.hidden = false;
    stepRequest.querySelector("h2").textContent =
      `Step 3 — Request ${mentor.name}`;
    stepRequest.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  submitRequest(form) {
    const valid = form.checkValidity();
    form.reportValidity();
    if (!valid) return;

    const data = Object.fromEntries(new FormData(form).entries());
    const requests = Storage.get("hosa-mentorship-requests", []);
    requests.push({
      ...data,
      submittedAt: new Date().toISOString(),
    });
    Storage.set("hosa-mentorship-requests", requests);

    form.reset();
    document.querySelector("#step-request").hidden = true;
    document.querySelector("#step-matches").hidden = true;
    document.querySelector("#mentor-field").value = "";
    document.querySelector("#find-mentors").disabled = true;

    alert("Thanks! Your mentorship request has been saved.");
  }
}

function mentorCardTemplate(m) {
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
      <p class="member-card__badge">Mentors in ${escapeHtml(m.mentorField)}</p>
      <button type="button" class="btn btn--ghost member-card__link"
              data-mentor-id="${m.id}">
        Request mentorship
      </button>
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
