// App layout toggles — loaded on all logged-in pages
document.addEventListener("DOMContentLoaded", () => {
  const btnTopnav = document.getElementById("btn-topnav");
  const btnSidebar = document.getElementById("btn-sidebar");
  const topnav = document.getElementById("topbar-nav");
  const sidebar = document.querySelector(".sidebar");
  const overlay = document.getElementById("sidebar-overlay");

  // 1. App Top Nav Toggle
  if (btnTopnav && topnav) {
    btnTopnav.addEventListener("click", (e) => {
      e.preventDefault();
      topnav.classList.toggle("is-open");
      if (sidebar) sidebar.classList.remove("is-open");
      if (overlay) overlay.classList.remove("is-visible");
    });
  }

  // 2. App Sidebar Toggle
  if (btnSidebar && sidebar) {
    btnSidebar.addEventListener("click", (e) => {
      e.preventDefault();
      sidebar.classList.toggle("is-open");
      if (overlay) overlay.classList.toggle("is-visible");
      if (topnav) topnav.classList.remove("is-open");
    });
  }

  // 3. Close Sidebar on Overlay Click
  if (overlay && sidebar) {
    overlay.addEventListener("click", () => {
      sidebar.classList.remove("is-open");
      overlay.classList.remove("is-visible");
    });
  }
});
