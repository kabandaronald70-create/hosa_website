// Fetch wrappers for internal API data, REST Countries, and Nominatim geocoding.
// Handles errors and validates responses before returning them.

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";

// Our Express backend. In dev, Vite proxies /api/* to :3000.
// In production, Express serves both the SPA and /api from one origin.
const API_BASE = "/api";

// Simple in-memory cache — Nominatim's usage policy requires low request rates.
const cache = new Map();

// Convert a fetch response to JSON. Preserves server error details.
async function convertToJson(res) {
  const jsonResponse = await res.json();

  if (res.ok) {
    return jsonResponse;
  } else {
    throw { name: "servicesError", message: jsonResponse };
  }
}

// Fetch a JSON endpoint from our own /api/*. Returns the whole envelope
// { data, pagination } so callers can use either.
async function fetchApi(path, query) {
  const url = new URL(`${API_BASE}${path}`, window.location.origin);
  if (query && typeof query === "object") {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== "") {
        url.searchParams.set(k, String(v));
      }
    }
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  return await convertToJson(res);
}

export default class ExternalServices {
  // ---------- Backend API (was: local JSON) ----------
  //
  // These four methods now return the *array* of items, matching the old
  // behaviour where callers did `const members = await services.getMembers()`.
  // Pagination metadata is available via the *Page variants below.

  async getMembers() {
    const envelope = await fetchApi("/directory", { limit: 100 });
    return envelope.data;
  }

  async getEvents() {
    const envelope = await fetchApi("/events", { limit: 100 });
    return envelope.data;
  }

  async getOpportunities() {
    const envelope = await fetchApi("/opportunities", { limit: 100 });
    return envelope.data;
  }

  async getStories() {
    const envelope = await fetchApi("/stories", { limit: 100 });
    return envelope.data;
  }

  // ---------- Paged variants (for future use) ----------

  async getMembersPage({
    q,
    year,
    district,
    profession,
    mentor,
    sort,
    page = 1,
    limit = 24,
  } = {}) {
    return await fetchApi("/directory", {
      q,
      year,
      district,
      profession,
      mentor,
      sort,
      page,
      limit,
    });
  }

  async getEventsPage({ from, to, page = 1, limit = 24 } = {}) {
    return await fetchApi("/events", { from, to, page, limit });
  }

  async getOpportunitiesPage({ category, page = 1, limit = 24 } = {}) {
    return await fetchApi("/opportunities", { category, page, limit });
  }

  async getStoriesPage({ page = 1, limit = 20 } = {}) {
    return await fetchApi("/stories", { page, limit });
  }

  // ---------- Single item ----------

  async getMemberById(id) {
    const envelope = await fetchApi(`/directory/${encodeURIComponent(id)}`);
    return envelope.data;
  }

  async getEventBySlug(slug) {
    const envelope = await fetchApi(`/events/${encodeURIComponent(slug)}`);
    return envelope.data;
  }

  // ---------- REST Countries API ----------
  async getCountry(code) {
    if (!code || typeof code !== "string") {
      throw { name: "servicesError", message: "Country code is required." };
    }

    const upper = code.toUpperCase();
    const cacheKey = `country:${upper}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);

    const url = `https://date.nager.at/api/v3/CountryInfo/${encodeURIComponent(upper)}`;

    try {
      const res = await fetch(url);
      const data = await convertToJson(res);

      const result = {
        code: upper,
        name: data.commonName ?? "",
        officialName: data.officialName ?? "",
        region: data.region ?? "",
        subregion: "",
        capital: "",
        population: 0,
        languages: [],
        currencies: [],
        flag: `https://flagcdn.com/${upper.toLowerCase()}.svg`,
        flagAlt: `Flag of ${data.commonName ?? upper}`,
      };

      cache.set(cacheKey, result);
      return result;
    } catch (err) {
      if (err.name === "servicesError") throw err;
      throw {
        name: "servicesError",
        message: "Could not reach the country service.",
      };
    }
  }

  // ---------- Nominatim geocoding ----------
  async geocode(placeName) {
    if (!placeName || typeof placeName !== "string") {
      throw { name: "servicesError", message: "Place name is required." };
    }

    const cacheKey = `geo:${placeName.toLowerCase().trim()}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);

    const url = `${NOMINATIM_BASE}/search?q=${encodeURIComponent(placeName)}&format=json&limit=1`;

    try {
      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "HOSA-Website-WDD330-StudentProject",
        },
      });
      const data = await convertToJson(res);

      if (!Array.isArray(data) || data.length === 0) {
        throw {
          name: "servicesError",
          message: `No location found for "${placeName}".`,
        };
      }

      const hit = data[0];
      const result = {
        displayName: hit.display_name ?? "",
        latitude: parseFloat(hit.lat),
        longitude: parseFloat(hit.lon),
        type: hit.type ?? "",
        boundingBox: hit.boundingbox?.map(Number) ?? [],
      };

      cache.set(cacheKey, result);
      return result;
    } catch (err) {
      if (err.name === "servicesError") throw err;
      throw {
        name: "servicesError",
        message: "Could not reach the location service.",
      };
    }
  }
}
