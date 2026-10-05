// Generic placeholder for views still being built.

export default function placeholderView(title, message) {
  return {
    async render(container) {
      container.innerHTML = `
        <header class="section__header">
          <h2>${title}</h2>
          <p>${message}</p>
        </header>
      `;
    },
  };
}
