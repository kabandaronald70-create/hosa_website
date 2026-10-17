// Events view — renders events, handles RSVP, and shows venue locations.

import ExternalServices from "./ExternalServices.js";
import EventMap from "./EventMap.js";
import { saveItem, unsaveByLookup } from "./apiSaved.js";
import { setRsvp, clearRsvp } from "./apiRsvp.js";
import { getMySaved, getMyRsvps } from "./apiAuth.js";

const services = new ExternalServices();

export default class EventsView {
  constructor() {
    this.events = [];
    this.savedIds = new Set(); // item_ids of saved events
    this.rsvpedIds = new Set(); // slugs of RSVP'd events
  }

  async render(container) {
    container.innerHTML = `
      <header class="section__header">
        <h1>Upcoming Events</h1>
        <p>Reunions, AGMs, career days, and fundraising activities.</p>
      </header>
      <div class="stack" id="events-list">
        <p>Loading events…</p>
      </div>
    `;

    try {
      const [events, saved, rsvps] = await Promise.all([
        services.getEvents(),
        getMySaved().catch(() => []),
        getMyRsvps().catch(() => ({})),
      ]);
      this.events = events;
      this.savedIds = new Set(
        saved
          .filter((s) => s.item_type === "event")
          .map((s) => String(s.item_id)),
      );
      this.rsvpedIds = new Set(Object.keys(rsvps));
    } catch (err) {
      console.error("Failed to load events:", err);
      container.querySelector("#events-list").innerHTML = `
        <p class="alert alert--error">Could not load events. Please try again later.</p>
      `;
      return;
    }

    this.renderEvents();
    this.attachListeners();
  }

  renderEvents() {
    const list = document.querySelector("#events-list");
    list.innerHTML = this.events
      .map((e) => eventCardTemplate(e, this))
      .join("");
  }

  attachListeners() {
    document.querySelectorAll("[data-rsvp-slug]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const slug = e.currentTarget.dataset.rsvpSlug;
        this.toggleRsvp(slug);
      });
    });

    document.querySelectorAll("[data-map-id]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const id = e.currentTarget.dataset.mapId;
        this.showLocation(id);
      });
    });

    document.querySelectorAll("[data-save-event-slug]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const slug = e.currentTarget.dataset.saveEventSlug;
        this.toggleSave(slug, e.currentTarget);
      });
    });
  }

  async toggleRsvp(slug) {
    const btn = document.querySelector(`[data-rsvp-slug="${slug}"]`);
    if (!btn) return;

    const isRsvped = this.rsvpedIds.has(slug);
    btn.disabled = true;
    const original = btn.textContent;
    btn.textContent = "…";

    if (isRsvped) {
      const r = await clearRsvp(slug);
      if (r.ok) {
        this.rsvpedIds.delete(slug);
        btn.textContent = "RSVP";
        btn.classList.remove("btn--primary");
        btn.classList.add("btn--ghost");
        btn.setAttribute("aria-pressed", "false");
      } else {
        btn.textContent = original;
      }
    } else {
      const r = await setRsvp(slug, "going");
      if (r.ok) {
        this.rsvpedIds.add(slug);
        btn.textContent = "✓ RSVP’d — Cancel";
        btn.classList.remove("btn--ghost");
        btn.classList.add("btn--primary");
        btn.setAttribute("aria-pressed", "true");
      } else {
        btn.textContent = original;
      }
    }
    btn.disabled = false;
  }

  async toggleSave(slug, btn) {
    const isSaved = this.savedIds.has(slug);
    btn.disabled = true;
    const original = btn.textContent;
    btn.textContent = "…";

    if (isSaved) {
      const saved = await getMySaved().catch(() => []);
      const r = await unsaveByLookup(saved, "event", slug);
      if (r.ok) {
        this.savedIds.delete(slug);
        btn.textContent = "☆ Save";
        btn.setAttribute("aria-pressed", "false");
      } else {
        btn.textContent = original;
      }
    } else {
      const r = await saveItem("event", slug);
      if (r.ok) {
        this.savedIds.add(slug);
        btn.textContent = "★ Saved";
        btn.setAttribute("aria-pressed", "true");
      } else {
        btn.textContent = original;
      }
    }
    btn.disabled = false;
  }

  async showLocation(eventId) {
    const event = this.events.find((e) => e.id === eventId);
    if (!event) return;

    const panel = document.querySelector(`[data-map-panel="${eventId}"]`);
    if (!panel) return;

    if (panel.classList.contains("open") && panel.dataset.loaded === "true") {
      panel.classList.remove("open");
      return;
    }

    panel.classList.add("open");
    panel.innerHTML = "<p>Locating venue…</p>";

    try {
      let place;

      if (
        typeof event.latitude === "number" &&
        typeof event.longitude === "number"
      ) {
        place = {
          displayName: `${event.venue}, ${event.district}`,
          latitude: event.latitude,
          longitude: event.longitude,
        };
      } else {
        const map = new EventMap();
        place = await map.locate(event.venue);
      }

      panel.innerHTML = `
      <h3>${escapeHtml(event.venue)}</h3>
      <p class="event-location__name">${escapeHtml(place.displayName)}</p>
      <p class="event-location__coords">
        Coordinates: <strong>${place.latitude.toFixed(4)}, ${place.longitude.toFixed(4)}</strong>
      </p>
      <p>
        <a class="btn btn--ghost"
           href="https://www.openstreetmap.org/?mlat=${place.latitude}&mlon=${place.longitude}#map=15/${place.latitude}/${place.longitude}"
           target="_blank" rel="noopener">
          View on OpenStreetMap ↗
        </a>
      </p>
    `;
      panel.dataset.loaded = "true";
    } catch (err) {
      console.error("Geocoding failed:", err);
      const msg =
        err?.message?.message ||
        err?.message ||
        "Could not find this location.";
      panel.innerHTML = `<p class="alert alert--error">${escapeHtml(msg)}</p>`;
    }
  }
}

// ---------- Templates & helpers ----------

function eventCardTemplate(event, view) {
  const slug = String(event.id); // API returns slug as `id`
  const rsvped = view.rsvpedIds.has(slug);
  const saved = view.savedIds.has(slug);
  const date = formatDate(event.date);

  return `
    <article class="card event-card" data-event-id="${escapeHtml(event.id)}">
      <header class="event-card__header">
        <div>
          <p class="event-card__type">${escapeHtml(event.type)}</p>
          <h2 class="event-card__title">${escapeHtml(event.title)}</h2>
        </div>
        <p class="event-card__date">${date}</p>
      </header>

      <p class="event-card__venue">
        <strong>Venue:</strong> ${escapeHtml(event.venue)} &middot; ${escapeHtml(event.district)}
      </p>

      <p class="event-card__description">${escapeHtml(event.description)}</p>

      <div class="event-card__actions">
        <button
          type="button"
          class="btn ${rsvped ? "btn--primary" : "btn--ghost"}"
          data-rsvp-slug="${escapeHtml(event.id)}"
          aria-pressed="${rsvped}">
          ${rsvped ? "✓ RSVP’d — Cancel" : "RSVP"}
        </button>

        <button
          type="button"
          class="btn btn--ghost"
          data-map-id="${escapeHtml(event.id)}">
          Show location
        </button>

        <button
          type="button"
          class="btn btn--ghost"
          data-save-event-slug="${escapeHtml(event.id)}"
          aria-pressed="${saved}">
          ${saved ? "★ Saved" : "☆ Save"}
        </button>
      </div>

      <div class="event-location" data-map-panel="${escapeHtml(event.id)}"></div>
    </article>
  `;
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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
