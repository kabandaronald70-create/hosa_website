// Register view — collect new member details and store locally.

import Storage from "./Storage.js";

export default class RegisterView {
  async render(container) {
    container.innerHTML = `
      <header class="section__header">
        <h1>Join HOSA</h1>
        <p>Add yourself to the Highway Old Students' Association directory.</p>
      </header>

      <form class="card" id="register-form" novalidate>
        <fieldset>
          <legend>Your Details</legend>

          <label class="field">
            <span>Full name *</span>
            <input type="text" name="name" id="reg-name" required minlength="2">
          </label>

          <label class="field">
            <span>Class year (final year at Highway) *</span>
            <input type="number" name="classYear" id="reg-year" required min="2001" max="2030">
          </label>

          <label class="field">
            <span>District / Country *</span>
            <input type="text" name="district" id="reg-district" required>
          </label>

          <label class="field">
            <span>Profession / Occupation *</span>
            <input type="text" name="profession" id="reg-profession" required>
          </label>
        </fieldset>

        <fieldset>
          <legend>Contact</legend>

          <label class="field">
            <span>Email *</span>
            <input type="email" name="email" id="reg-email" required>
          </label>

          <label class="field">
            <span>Country code (2 letters, e.g. UG)</span>
            <input type="text" name="country" id="reg-country" maxlength="2" value="UG">
          </label>
        </fieldset>

        <fieldset>
          <legend>Mentorship</legend>

          <label class="checkbox">
            <input type="checkbox" name="mentor" id="reg-mentor">
            <span>I am willing to mentor current students</span>
          </label>

          <label class="field">
            <span>Mentorship field (if applicable)</span>
            <input type="text" name="mentorField" id="reg-mentor-field" placeholder="e.g. ICT, Medicine, Law">
          </label>
        </fieldset>

        <div class="form-actions">
          <button type="submit" class="btn btn--primary">Submit registration</button>
          <a href="#/directory" class="btn btn--ghost">View directory</a>
        </div>
      </form>
    `;

    const form = container.querySelector("#register-form");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      this.handleSubmit(form);
    });

    // Conditional mentor field visibility
    const mentorCheckbox = container.querySelector("#reg-mentor");
    const mentorFieldLabel = container
      .querySelector("#reg-mentor-field")
      .closest(".field");
    mentorFieldLabel.style.display = "none";

    mentorCheckbox.addEventListener("change", () => {
      mentorFieldLabel.style.display = mentorCheckbox.checked ? "flex" : "none";
    });
  }

  handleSubmit(form) {
    const valid = form.checkValidity();
    form.reportValidity();
    if (!valid) return;

    const data = Object.fromEntries(new FormData(form).entries());

    // Normalize
    const member = {
      id: "m" + Date.now().toString(36),
      name: data.name.trim(),
      classYear: parseInt(data.classYear, 10),
      district: data.district.trim(),
      profession: data.profession.trim(),
      country: (data.country || "UG").toUpperCase().slice(0, 2),
      email: data.email.trim(),
      mentor: form.querySelector("#reg-mentor").checked,
      mentorField: form.querySelector("#reg-mentor").checked
        ? (data.mentorField || "").trim()
        : "",
      contactPreference: "Email",
      bio: `New HOSA member registered in ${new Date().getFullYear()}.`,
      avatar: "",
      submittedAt: new Date().toISOString(),
    };

    // Save to localStorage
    const newMembers = Storage.get("hosa-new-members", []);
    newMembers.push(member);
    Storage.set("hosa-new-members", newMembers);

    // Show confirmation
    const container = form.parentElement;
    container.innerHTML = `
      <div class="alert" role="status">
        <p><strong>Thank you, ${escapeHtml(member.name)}!</strong></p>
        <p>Your registration has been saved. It will be reviewed by the HOSA committee.</p>
        <p>You can view the <a href="#/directory">current directory</a> or go back <a href="#/">home</a>.</p>
      </div>
    `;
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
