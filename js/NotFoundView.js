// 404 view — shown for unknown hash routes.

export default class NotFoundView {
  async render(container) {
    container.innerHTML = `
      <section class="not-found">
        <p class="not-found__code" aria-hidden="true">404</p>
        <h1>Page not found</h1>
        <p class="not-found__message">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div class="not-found__actions">
          <a href="#/" class="btn btn--primary">Back to home</a>
          <a href="#/directory" class="btn btn--ghost">Browse directory</a>
        </div>
      </section>
    `;
  }
}
