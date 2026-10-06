// Centralized localStorage helpers with JSON serialization.

export default class Storage {
  // Get a value from localStorage. Returns fallback (default null) if missing.
  static get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (err) {
      console.warn(`Storage.get failed for "${key}":`, err);
      return fallback;
    }
  }

  // Save a value to localStorage as JSON.
  static set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      console.warn(`Storage.set failed for "${key}":`, err);
      return false;
    }
  }

  // Remove a single key.
  static remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (err) {
      console.warn(`Storage.remove failed for "${key}":`, err);
      return false;
    }
  }

  // Check if a key exists.
  static has(key) {
    return localStorage.getItem(key) !== null;
  }

  // ---------- Custom event helpers ----------
  // Emit a custom event so listeners (e.g. nav badge) can react to storage changes.
  static _emit(eventName) {
    window.dispatchEvent(new CustomEvent(eventName));
  }

  // ---------- Domain-specific helpers ----------

  // RSVP state — an object mapping eventId → true/false
  static getRsvps() {
    return Storage.get("hosa-rsvps", {});
  }

  static setRsvp(eventId, value) {
    const rsvps = Storage.getRsvps();
    if (value) {
      rsvps[eventId] = true;
    } else {
      delete rsvps[eventId];
    }
    Storage.set("hosa-rsvps", rsvps);
    Storage._emit("hosa:rsvps-changed");
    return rsvps;
  }

  static isRsvped(eventId) {
    return Storage.getRsvps()[eventId] === true;
  }

  // Favourites — for mentors, events, jobs
  static getFavourites() {
    return Storage.get("hosa-favourites", []);
  }

  static isFavourite(id) {
    return Storage.getFavourites().includes(id);
  }

  static toggleFavourite(id) {
    const favs = Storage.getFavourites();
    const idx = favs.indexOf(id);
    if (idx >= 0) {
      favs.splice(idx, 1);
    } else {
      favs.push(id);
    }
    Storage.set("hosa-favourites", favs);
    Storage._emit("hosa:favourites-changed");
    return favs;
  }
}
