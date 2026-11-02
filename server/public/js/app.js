// App layout toggles — loaded on all logged-in pages
document.addEventListener("DOMContentLoaded", () => {
  const btnTopnav = document.getElementById("btn-topnav");
  const btnSidebar = document.getElementById("btn-sidebar");
  const topnav = document.getElementById("topbar-nav");
  const sidebar = document.querySelector(".sidebar");
  const overlay = document.getElementById("sidebar-overlay");

  // App Sidebar Toggle
  if (btnSidebar && sidebar) {
    btnSidebar.addEventListener("click", (e) => {
      e.preventDefault();
      sidebar.classList.toggle("is-open");
      if (overlay) overlay.classList.toggle("is-visible");
      if (topnav) {
        topnav.classList.remove("is-open");
        if (btnTopnav) btnTopnav.setAttribute("aria-expanded", "false");
      }
    });
  }

  // Close Sidebar on Overlay Click
  if (overlay && sidebar) {
    overlay.addEventListener("click", () => {
      sidebar.classList.remove("is-open");
      overlay.classList.remove("is-visible");
    });
  }
});
