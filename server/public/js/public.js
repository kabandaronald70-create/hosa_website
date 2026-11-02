document.addEventListener("DOMContentLoaded", async () => {
  const getCsrfToken = () => {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute("content") : "";
  };

  // --- 0. Password Visibility Toggles ---
  document.querySelectorAll(".password-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-target");
      const input = document.getElementById(targetId);
      if (!input) return;

      const isPassword = input.type === "password";
      input.type = isPassword ? "text" : "password";
      btn.textContent = isPassword ? "🙈" : "👁";
      btn.setAttribute(
        "aria-label",
        isPassword ? "Hide password" : "Show password",
      );
    });
  });

  // --- 0b. Topbar mobile nav toggle ---
  const btnTopnav = document.getElementById("btn-topnav");
  const topnav = document.getElementById("topbar-nav");
  if (btnTopnav && topnav) {
    btnTopnav.addEventListener("click", (e) => {
      e.preventDefault();
      const isOpen = topnav.classList.toggle("is-open");
      btnTopnav.setAttribute("aria-expanded", String(isOpen));

      if (isOpen) {
        const sidebar = document.querySelector(".sidebar");
        const sidebarToggle = document.getElementById("btn-sidebar");
        const overlay = document.getElementById("sidebar-overlay");
        if (sidebar) sidebar.classList.remove("is-open");
        if (sidebarToggle) sidebarToggle.setAttribute("aria-expanded", "false");
        if (overlay) overlay.classList.remove("is-visible");
      }
    });
  }

  // --- 0c. Leadership Auto-Fill ---
  const userSelect = document.getElementById("userId");
  if (userSelect) {
    const emailInput = document.getElementById("email");
    const phoneInput = document.getElementById("phone");
    const locationInput = document.getElementById("location");

    userSelect.addEventListener("change", () => {
      const option = userSelect.options[userSelect.selectedIndex];

      if (option.value) {
        if (emailInput)
          emailInput.value = option.getAttribute("data-email") || "";
        if (phoneInput)
          phoneInput.value = option.getAttribute("data-phone") || "";
        if (locationInput)
          locationInput.value = option.getAttribute("data-location") || "";
      } else {
        // Clear fields if "Leave Vacant" is selected
        if (emailInput) emailInput.value = "";
        if (phoneInput) phoneInput.value = "";
        if (locationInput) locationInput.value = "";
      }
    });
  }

  // --- 0d. Contribution Project Toggle ---
  const purposeSelect = document.getElementById("purpose-select");
  const projectField = document.getElementById("project-field");
  const projectSelect = document.getElementById("project-select");

  if (purposeSelect && projectField && projectSelect) {
    const updateProjectField = () => {
      const needsProject = purposeSelect.value === "Project Donation";
      projectField.style.display = needsProject ? "block" : "none";
      projectSelect.required = needsProject;
      projectSelect.disabled = !needsProject;
    };

    updateProjectField();
    purposeSelect.addEventListener("change", updateProjectField);
  }

  // --- 1. Load Saved Items to set initial button states ---
  const savedMap = new Map(); // Map of "type:id" -> savedId

  async function loadSavedItems() {
    try {
      const res = await fetch("/api/me/saved", { credentials: "same-origin" });
      if (res.ok) {
        const { data } = await res.json();
        data.forEach((item) => {
          const key = `${item.item_type}:${item.item_id}`;
          savedMap.set(key, item.id);
        });
        updateAllButtons();
      }
    } catch (err) {
      console.error("Could not load saved items", err);
    }
  }

  function updateAllButtons() {
    document.querySelectorAll("[data-save]").forEach((btn) => {
      const type = btn.dataset.save;
      const id = btn.dataset.id;
      const key = `${type}:${id}`;
      const isSaved = savedMap.has(key);

      if (isSaved) {
        btn.textContent = "★";
        btn.style.color = "#0F4C3A"; // Dark Green
        btn.style.borderColor = "#0F4C3A";
        btn.dataset.savedId = savedMap.get(key);
        btn.title = "Unsave";
      } else {
        btn.textContent = "☆";
        btn.style.color = "#D2691E"; // Chocolate
        btn.style.borderColor = "#D2691E";
        btn.dataset.savedId = "";
        btn.title = "Save";
      }
    });
  }

  // --- 2. Handle Save/Unsave Clicks ---
  document.querySelectorAll("[data-save]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      const type = btn.dataset.save;
      const id = btn.dataset.id;
      const savedId = btn.dataset.savedId;
      const isCurrentlySaved = !!savedId;
      const key = `${type}:${id}`;

      btn.disabled = true;
      const oldText = btn.textContent;

      try {
        if (isCurrentlySaved) {
          const res = await fetch(`/api/saved/${savedId}`, {
            method: "DELETE",
            credentials: "same-origin",
            headers: { "x-csrf-token": getCsrfToken() },
          });
          if (res.ok) {
            savedMap.delete(key);
            updateAllButtons();
            if (window.location.pathname === "/dashboard/saved") {
              window.location.reload();
            }
          } else {
            alert("Could not unsave item.");
            btn.textContent = oldText;
          }
        } else {
          const res = await fetch("/api/saved", {
            method: "POST",
            credentials: "same-origin",
            headers: {
              "Content-Type": "application/json",
              "x-csrf-token": getCsrfToken(),
            },
            body: JSON.stringify({ item_type: type, item_id: id }),
          });

          if (res.ok) {
            const data = await res.json();
            savedMap.set(key, data.saved.id);
            updateAllButtons();
          } else if (res.status === 401) {
            window.location.href = `/login?next=${encodeURIComponent(
              window.location.pathname,
            )}`;
          } else {
            alert(
              "Could not save item. Please make sure you are logged in and that your membership has been approved.",
            );
            btn.textContent = oldText;
          }
        }
      } catch (err) {
        console.error(err);
        alert("A network error occurred.");
        btn.textContent = oldText;
      } finally {
        btn.disabled = false;
      }
    });
  });

  // --- 3. Handle RSVP Clicks ---
  document.querySelectorAll("[data-rsvp]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      const slug = btn.dataset.rsvp;
      const isGoing = btn.dataset.rsvped === "true";

      btn.disabled = true;
      btn.textContent = "…";

      try {
        let res;
        if (isGoing) {
          res = await fetch(`/api/rsvp/${slug}`, {
            method: "DELETE",
            credentials: "same-origin",
            headers: { "x-csrf-token": getCsrfToken() },
          });
        } else {
          res = await fetch(`/api/rsvp/${slug}`, {
            method: "POST",
            credentials: "same-origin",
            headers: {
              "Content-Type": "application/json",
              "x-csrf-token": getCsrfToken(),
            },
            body: JSON.stringify({ status: "going" }),
          });
        }

        if (res.ok) {
          if (isGoing) {
            btn.dataset.rsvped = "false";
            btn.textContent = "RSVP";
            btn.style.backgroundColor = "#D2691E";
            btn.style.borderColor = "#D2691E";
            btn.style.color = "#fff";
          } else {
            btn.dataset.rsvped = "true";
            btn.textContent = "✓ RSVP'd";
            btn.style.backgroundColor = "#0F4C3A";
            btn.style.borderColor = "#0F4C3A";
            btn.style.color = "#fff";
          }
        } else {
          alert("Could not update RSVP.");
        }
      } catch (err) {
        console.error(err);
      } finally {
        btn.disabled = false;
      }
    });
  });

  // Initialize
  if (
    document.querySelector("[data-save]") ||
    document.querySelector("[data-rsvp]")
  ) {
    await loadSavedItems();

    document.querySelectorAll("[data-rsvp]").forEach((btn) => {
      if (btn.dataset.rsvped === "true") {
        btn.style.backgroundColor = "#0F4C3A";
        btn.style.borderColor = "#0F4C3A";
        btn.style.color = "#fff";
      } else {
        btn.style.backgroundColor = "#D2691E";
        btn.style.borderColor = "#D2691E";
        btn.style.color = "#fff";
      }
    });
  }
});
