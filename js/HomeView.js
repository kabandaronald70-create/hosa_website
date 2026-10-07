// Home view — full-screen image hero with an overlaid information grid.

export default class HomeView {
  async render(container) {
    container.innerHTML = `
      <section class="hero hero--image">
        <div class="hero__overlay">
          <div class="container hero__content">
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

          <div class="container hero__grid">
            <div class="grid">
              <article class="card">
                <h2>Old Students</h2>
                <p>Members from every final year since the first class of 2001.</p>
              </article>
              <article class="card">
                <h2>Mentors</h2>
                <p>Old students ready to guide current S.4 and S.6 candidates.</p>
              </article>
              <article class="card">
                <h2>Events</h2>
                <p>Reunions, AGMs, career days, and fundraising activities.</p>
              </article>
            </div>
          </div>
        </div>
      </section>
    `;
  }
}
