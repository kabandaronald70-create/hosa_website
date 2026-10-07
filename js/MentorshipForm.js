// Mentorship view — smart form, keyword matching, ranked mentors.

import ExternalServices from "./ExternalServices.js";
import Storage from "./Storage.js";

const services = new ExternalServices();

// Common words that don't help matching
const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "if",
  "so",
  "of",
  "at",
  "by",
  "for",
  "with",
  "about",
  "against",
  "between",
  "into",
  "through",
  "during",
  "before",
  "after",
  "above",
  "below",
  "to",
  "from",
  "up",
  "down",
  "in",
  "out",
  "on",
  "off",
  "over",
  "under",
  "again",
  "further",
  "then",
  "once",
  "here",
  "there",
  "when",
  "where",
  "why",
  "how",
  "all",
  "any",
  "both",
  "each",
  "few",
  "more",
  "most",
  "other",
  "some",
  "such",
  "no",
  "nor",
  "not",
  "only",
  "own",
  "same",
  "than",
  "too",
  "very",
  "can",
  "will",
  "just",
  "should",
  "would",
  "could",
  "may",
  "might",
  "must",
  "shall",
  "i",
  "me",
  "my",
  "we",
  "our",
  "you",
  "your",
  "he",
  "him",
  "his",
  "she",
  "her",
  "it",
  "its",
  "they",
  "them",
  "their",
  "am",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "want",
  "need",
  "help",
  "like",
  "get",
  "make",
  "know",
  "learn",
  "interested",
  "interest",
  "career",
  "work",
  "working",
  "job",
  "field",
  "one",
  "day",
  "also",
  "want",
]);

export default class MentorshipForm {
  constructor() {
    this.members = [];
    this.matches = [];
  }

  async render(container) {
    container.innerHTML = `
      <header class="section__header">
        <h1>Mentorship</h1>
        <p>Tell us what you need. We'll find the best alumni mentors for you.</p>
      </header>

      <div class="wizard">
        <div class="wizard__step">
          <h2>Step 1 — Describe what you need</h2>

          <label class="field">
            <span>What field or topic do you want guidance on?</span>
            <textarea id="mentor-request" rows="4" placeholder="e.g. I want to learn about software engineering and starting a tech career in Kampala."></textarea>
          </label>

          <label class="field">
            <span>Preferred field (optional — helps narrow results)</span>
            <select id="mentor-field">
              <option value="">Any field</option>
            </select>
          </label>

          <button type="button" class="btn btn--primary" id="find-mentors" disabled>
            Find my mentors
          </button>
        </div>

        <div class="wizard__step" id="step-matches" hidden>
          <h2>Step 2 — Ranked matches</h2>
          <p class="results-count" id="matches-count"></p>
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

    this.populateFields();
    this.attachListeners();
  }

  populateFields() {
    const fields = [
      ...new Set(
        this.members
          .filter((m) => m.mentor)
          .map((m) => m.mentorField)
          .filter(Boolean),
      ),
    ].sort();

    const select = document.querySelector("#mentor-field");
    fields.forEach((f) => {
      const opt = document.createElement("option");
      opt.value = f;
      opt.textContent = f;
      select.appendChild(opt);
    });
  }

  attachListeners() {
    const requestInput = document.querySelector("#mentor-request");
    const findBtn = document.querySelector("#find-mentors");
    const fieldSelect = document.querySelector("#mentor-field");

    // Enable button when a description is typed
    requestInput.addEventListener("input", () => {
      findBtn.disabled = requestInput.value.trim().length < 5;
    });

    // Find mentors
    findBtn.addEventListener("click", () => {
      const description = requestInput.value.trim();
      const fieldFilter = fieldSelect.value;
      this.findMatches(description, fieldFilter);
    });

    // Cancel request
    document.querySelector("#request-cancel").addEventListener("click", () => {
      document.querySelector("#step-request").hidden = true;
    });

    // Request form submit
    document
      .querySelector("#mentor-request-form")
      .addEventListener("submit", (e) => {
        e.preventDefault();
        this.submitRequest(e.target);
      });
  }

  // ---------- Matching logic ----------

  // Extract meaningful keywords from a description
  extractKeywords(text) {
    return [
      ...new Set(
        text
          .toLowerCase()
          .replace(/[^\w\s]/g, " ")
          .split(/\s+/)
          .filter((w) => w.length > 2 && !STOP_WORDS.has(w)),
      ),
    ];
  }

  // Score a mentor against a set of keywords
  scoreMentor(member, keywords) {
    if (!member.mentor) return { score: 0, matchedKeywords: [] };

    // Build a searchable text blob from the mentor's profile
    const profileText = [
      member.profession,
      member.mentorField,
      member.bio,
      member.district,
      member.name,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const matchedKeywords = keywords.filter((kw) => profileText.includes(kw));

    if (keywords.length === 0) {
      return { score: 0, matchedKeywords: [] };
    }

    // Base score: % of user keywords matched
    let score = Math.round((matchedKeywords.length / keywords.length) * 100);

    // Bonus: exact mentorField match
    const mentorFieldLower = (member.mentorField || "").toLowerCase();
    if (
      mentorFieldLower &&
      keywords.some(
        (kw) => mentorFieldLower.includes(kw) || kw.includes(mentorFieldLower),
      )
    ) {
      score = Math.min(100, score + 15);
    }

    // Small bonus for having a rich bio
    if (member.bio && member.bio.length > 150) {
      score = Math.min(100, score + 5);
    }

    return { score, matchedKeywords };
  }

  findMatches(description, fieldFilter) {
    const keywords = this.extractKeywords(description);

    // Filter by optional field first
    let candidates = this.members.filter((m) => m.mentor);
    if (fieldFilter) {
      candidates = candidates.filter((m) => m.mentorField === fieldFilter);
    }

    // Score every candidate
    const scored = candidates.map((m) => {
      const { score, matchedKeywords } = this.scoreMentor(m, keywords);
      return { member: m, score, matchedKeywords };
    });

    // Sort by score (desc), then by name
    scored.sort(
      (a, b) => b.score - a.score || a.member.name.localeCompare(b.member.name),
    );

    // Keep only mentors with at least some score, or all if none scored
    this.matches = scored.filter((m) => m.score > 0);
    if (this.matches.length === 0) {
      this.matches = scored.slice(0, 5); // fallback: show top 5 anyway
    }

    this.renderMatches();
  }

  renderMatches() {
    const step = document.querySelector("#step-matches");
    const grid = document.querySelector("#matches-grid");
    const count = document.querySelector("#matches-count");

    document.querySelector("#step-request").hidden = true;

    if (this.matches.length === 0) {
      grid.innerHTML = `
        <p class="empty-state">
          No mentors are currently listed. Try a different description.
        </p>
      `;
      step.hidden = false;
      return;
    }

    count.textContent = `Showing ${this.matches.length} mentor${this.matches.length === 1 ? "" : "s"} ranked by relevance.`;

    grid.innerHTML = this.matches
      .map((m) => mentorCardTemplate(m.member, m.score, m.matchedKeywords))
      .join("");

    grid.querySelectorAll("[data-mentor-id]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const id = e.currentTarget.dataset.mentorId;
        this.startRequest(id);
      });
    });

    step.hidden = false;
    step.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  startRequest(mentorId) {
    const match = this.matches.find((m) => m.member.id === mentorId);
    if (!match) return;

    document.querySelector("#mentor-id").value = mentorId;
    const stepRequest = document.querySelector("#step-request");
    stepRequest.hidden = false;
    stepRequest.querySelector("h2").textContent =
      `Step 3 — Request ${match.member.name}`;
    stepRequest.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async submitRequest(form) {
    const valid = form.checkValidity();
    form.reportValidity();
    if (!valid) return;

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.classList.add("is-loading");

    // Simulate save delay for UX feedback
    await new Promise((resolve) => setTimeout(resolve, 400));

    const data = Object.fromEntries(new FormData(form).entries());
    const requests = Storage.get("hosa-mentorship-requests", []);
    requests.push({ ...data, submittedAt: new Date().toISOString() });
    Storage.set("hosa-mentorship-requests", requests);

    submitBtn.classList.remove("is-loading");

    form.reset();
    document.querySelector("#step-request").hidden = true;
    document.querySelector("#step-matches").hidden = true;
    document.querySelector("#mentor-request").value = "";
    document.querySelector("#find-mentors").disabled = true;

    const { showToast } = await import("./Toast.js");
    showToast("Thanks! Your mentorship request has been saved.");
  }
}

// ---------- Templates ----------

function mentorCardTemplate(m, score, matchedKeywords) {
  const reason = buildReason(m, matchedKeywords);
  const keywordPills = matchedKeywords
    .slice(0, 4)
    .map((kw) => `<span class="match-pill">${escapeHtml(kw)}</span>`)
    .join("");

  return `
    <article class="card member-card">
      <div class="member-card__header">
        <div class="member-card__avatar" aria-hidden="true">${initials(m.name)}</div>
        <div>
          <h3 class="member-card__name">${escapeHtml(m.name)}</h3>
          <p class="member-card__meta">Class of ${m.classYear} &middot; ${escapeHtml(m.district)}</p>
        </div>
      </div>

      <p class="member-card__profession">${escapeHtml(m.profession)}</p>
      <p class="member-card__badge">Mentors in ${escapeHtml(m.mentorField)}</p>

      <div class="match-score">
        <p class="match-score__value">${score}% match</p>
        ${keywordPills ? `<p class="match-score__keywords">Matched on: ${keywordPills}</p>` : ""}
        ${reason ? `<p class="match-score__reason">${escapeHtml(reason)}</p>` : ""}
      </div>

      <button type="button" class="btn btn--primary member-card__link"
              data-mentor-id="${m.id}">
        Request mentorship
      </button>
    </article>
  `;
}

function buildReason(member, matchedKeywords) {
  if (matchedKeywords.length === 0) {
    return "";
  }

  const primary = matchedKeywords[0];
  const field = member.mentorField || member.profession;

  return `Works in ${field}, relevant to your interest in ${primary}.`;
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
