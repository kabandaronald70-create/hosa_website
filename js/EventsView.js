// Events view — renders events, handles RSVP, and shows venue locations.

import ExternalServices from "./ExternalServices.js";
import EventMap from "./EventMap.js";
import Storage from "./Storage.js";

const services = new ExternalServices();

export default class EventsView {
  constructor() {
    this.events = [];
  }

  async render(container) {
    container.innerHTML = `
      <header class="section__header">
        <h2>Upcoming Events</h2>
        <p>Reunions, AGMs, career days, and fundraising activities.</p>
      </header>
      <div class="stack" id="events-list">
        <p>Loading events…</p>
      </div>
    `;

    try {
      this.events = await services.getEvents();
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
    list.innerHTML = this.events.map(eventCardTemplate).join("");
  }

  attachListeners() {
    document.querySelectorAll("[data-rsvp-id]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const id = e.currentTarget.dataset.rsvpId;
        this.toggleRsvp(id);
      });
    });

    document.querySelectorAll("[data-map-id]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const id = e.currentTarget.dataset.mapId;
        this.showLocation(id);
      });
    });

    // Save / unsave event
    document.querySelectorAll("[data-save-event-id]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const id = e.currentTarget.dataset.saveEventId;
        Storage.toggleFavourite(id);
        const saved = Storage.isFavourite(id);
        e.currentTarget.textContent = saved ? "★ Saved" : "☆ Save";
        e.currentTarget.setAttribute("aria-pressed", String(saved));
      });
    });
  }

  toggleRsvp(eventId) {
    const currentlyRsvped = Storage.isRsvped(eventId);
    Storage.setRsvp(eventId, !currentlyRsvped);

    const btn = document.querySelector(`[data-rsvp-id="${eventId}"]`);
    if (btn) {
      const newState = !currentlyRsvped;
      btn.textContent = newState ? "✓ RSVP’d — Cancel" : "RSVP";
      btn.classList.toggle("btn--primary", newState);
      btn.classList.toggle("btn--ghost", !newState);
      btn.setAttribute("aria-pressed", String(newState));
    }
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
      <h4>${escapeHtml(event.venue)}</h4>
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

function eventCardTemplate(event) {
  const rsvped = Storage.isRsvped(event.id);
  const saved = Storage.isFavourite(event.id);
  const date = formatDate(event.date);

  return `
    <article class="card event-card" data-event-id="${event.id}">
      <header class="event-card__header">
        <div>
          <p class="event-card__type">${escapeHtml(event.type)}</p>
          <h3 class="event-card__title">${escapeHtml(event.title)}</h3>
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
          data-rsvp-id="${event.id}"
          aria-pressed="${rsvped}">
          ${rsvped ? "✓ RSVP’d — Cancel" : "RSVP"}
        </button>

        <button
          type="button"
          class="btn btn--ghost"
          data-map-id="${event.id}">
          Show location
        </button>

        <button
          type="button"
          class="btn btn--ghost"
          data-save-event-id="${event.id}"
          aria-pressed="${saved}">
          ${saved ? "★ Saved" : "☆ Save"}
        </button>
      </div>

      <div class="event-location" data-map-panel="${event.id}"></div>
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
