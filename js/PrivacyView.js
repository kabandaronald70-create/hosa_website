// Privacy Policy view.

export default class PrivacyView {
  async render(container) {
    container.innerHTML = `
      <header class="section__header">
        <h2>Privacy Policy</h2>
        <p>How the Highway Old Students' Association website handles your data.</p>
      </header>

      <article class="card legal">
        <p><em>Last updated: 2026</em></p>

        <h3>What we collect</h3>
        <p>
          This website stores the following information in your browser's
          <strong>local storage</strong> so that your preferences persist between visits:
        </p>
        <ul>
          <li><strong>Saved items</strong> — events, jobs, and mentors you mark as favourites</li>
          <li><strong>RSVP responses</strong> — your confirmation status for events</li>
          <li><strong>Mentorship requests</strong> — messages you submit through the mentorship form</li>
        </ul>

        <h3>What we do NOT collect</h3>
        <ul>
          <li>We do not use cookies for tracking.</li>
          <li>We do not collect personal information on the server — all form data stays in your browser.</li>
          <li>We do not share any data with third parties.</li>
        </ul>

        <h3>Third-party services</h3>
        <p>
          This site uses two public APIs to enrich its content:
        </p>
        <ul>
          <li><strong>Nager.Date Country Info API</strong> — to display country names and metadata</li>
          <li><strong>flagcdn.com</strong> — to display country flags</li>
          <li><strong>Nominatim (OpenStreetMap)</strong> — to look up venue locations</li>
        </ul>
        <p>
          These services may log the IP address of requests made from your browser,
          in accordance with their own privacy policies. No personal data from this
          site is sent to them.
        </p>

        <h3>Your control</h3>
        <p>
          You can clear all locally stored data at any time by opening your browser's
          Developer Tools (usually <kbd>F12</kbd>), navigating to the
          <strong>Application</strong> tab, and deleting the entries under
          <strong>Local Storage</strong>.
        </p>

        <h3>Contact</h3>
        <p>
          If you have questions about this policy, please contact the HOSA
          executive committee through the association's official channels.
        </p>

        <p>
          <a href="#/" class="btn btn--ghost">Back to home</a>
        </p>
      </article>
    `;
  }
}
