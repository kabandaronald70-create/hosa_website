// Home view — hero + stat strip.

export default class HomeView {
  async render(container) {
    container.innerHTML = `
      <div class="hero">
        <h1>The Mighty. For a Bright Future.</h1>
        <p>
          Welcome to the Highway Old Students' Association — connecting former
          students of Highway Secondary School (Kiganda, Kassanda District) with
          each other, with current students, and with the school community.
        </p>
        <div class="hero__actions">
          <a href="#/register" class="btn btn--primary">Join HOSA</a>
          <a href="#/mentorship" class="btn btn--ghost">Find a Mentor</a>
        </div>
      </div>

      <section class="section section--tight">
        <div class="grid">
          <article class="card">
            <h3>Old Students</h3>
            <p>Members from every final year since the first class of 2001.</p>
          </article>
          <article class="card">
            <h3>Mentors</h3>
            <p>Old students ready to guide current S.4 and S.6 candidates.</p>
          </article>
          <article class="card">
            <h3>Events</h3>
            <p>Reunions, AGMs, career days, and fundraising activities.</p>
          </article>
        </div>
      </section>
    `;
  }
}
