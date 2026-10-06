// Fetch wrappers for internal JSON data, REST Countries, and Nominatim geocoding.
// Handles errors and validates responses before returning them.

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";

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

// Fetch a local JSON file from /data/.
async function fetchLocalJson(path) {
  const baseUrl = import.meta.env.BASE_URL;
  const dataPath = path.replace(/^\/+/, "");
  const res = await fetch(`${baseUrl}${dataPath}`);
  return await convertToJson(res);
}

export default class ExternalServices {
  // ---------- Local JSON data ----------
  async getMembers() {
    return await fetchLocalJson("/data/hosa-members.json");
  }

  async getEvents() {
    return await fetchLocalJson("/data/events.json");
  }

  async getOpportunities() {
    return await fetchLocalJson("/data/opportunities.json");
  }

  async getStories() {
    return await fetchLocalJson("/data/stories.json");
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
