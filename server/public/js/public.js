document.addEventListener("DOMContentLoaded", async () => {
  const getCsrfToken = () => {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute("content") : "";
  };

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
    // Update Save Buttons
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
          // UNSAVE
          const res = await fetch(`/api/saved/${savedId}`, {
            method: "DELETE",
            credentials: "same-origin",
            headers: { "x-csrf-token": getCsrfToken() },
          });
          if (res.ok) {
            savedMap.delete(key);
            updateAllButtons();
            // If we are on the saved items page, reload it to remove the item
            if (window.location.pathname === "/dashboard/saved") {
              window.location.reload();
            }
          } else {
            alert("Could not unsave item.");
            btn.textContent = oldText;
          }
        } else {
          // SAVE
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
            // Not logged in
            window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
          } else {
            // Could be unverified (res.redirected to /verify-required) or a server error
            alert(
              "Could not save item. Please make sure you are logged in and have verified your email.",
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
          // CANCEL RSVP
          res = await fetch(`/api/rsvp/${slug}`, {
            method: "DELETE",
            credentials: "same-origin",
            headers: { "x-csrf-token": getCsrfToken() },
          });
        } else {
          // SET RSVP
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
            btn.style.backgroundColor = "#D2691E"; // Chocolate
            btn.style.borderColor = "#D2691E";
            btn.style.color = "#fff";
          } else {
            btn.dataset.rsvped = "true";
            btn.textContent = "✓ RSVP'd";
            btn.style.backgroundColor = "#0F4C3A"; // Dark Green
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

    // Set initial RSVP colors based on HTML data attributes
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
