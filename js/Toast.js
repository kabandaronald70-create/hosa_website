// Toast — small, non-blocking success/error notifications.

let container = null;

function ensureContainer() {
  if (container) return container;

  container = document.createElement("div");
  container.className = "toast-container";
  container.setAttribute("role", "status");
  container.setAttribute("aria-live", "polite");
  document.body.appendChild(container);
  return container;
}

export function showToast(message, { type = "success", duration = 4000 } = {}) {
  const host = ensureContainer();

  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `
    <span class="toast__icon" aria-hidden="true">${type === "success" ? "✓" : "!"}</span>
    <span class="toast__message">${escapeHtml(message)}</span>
    <button type="button" class="toast__close" aria-label="Dismiss notification">×</button>
  `;

  host.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => toast.classList.add("toast--visible"));

  // Close handler
  const close = () => {
    toast.classList.remove("toast--visible");
    toast.addEventListener("transitionend", () => toast.remove(), {
      once: true,
    });
    // Safety: if transitionend never fires
    setTimeout(() => toast.remove(), 500);
  };

  toast.querySelector(".toast__close").addEventListener("click", close);

  // Auto-dismiss
  if (duration > 0) {
    setTimeout(close, duration);
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
