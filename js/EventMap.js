// EventMap — wraps the Nominatim geocoding service via ExternalServices.
// (No actual map library is used — this returns coordinates for display.)

import ExternalServices from "./ExternalServices.js";

export default class EventMap {
  constructor() {
    this.services = new ExternalServices();
    this.lastResult = null;
  }

  async locate(placeName) {
    if (!placeName) {
      throw { name: "servicesError", message: "No venue name provided." };
    }

    // Try progressively broader queries.
    // E.g. "Highway Secondary School, Kiganda" → "Kiganda, Kassanda, Uganda"
    const queries = this.buildQueryChain(placeName);

    let lastError = null;
    for (const q of queries) {
      try {
        const result = await this.services.geocode(q);
        this.lastResult = result;
        return result;
      } catch (err) {
        lastError = err;
        // Continue to next fallback query
      }
    }

    // All fallbacks failed
    throw (
      lastError || {
        name: "servicesError",
        message: `No location found for "${placeName}".`,
      }
    );
  }

  buildQueryChain(placeName) {
    const queries = [placeName];

    // If the place name has commas, add progressively broader parts.
    const parts = placeName
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);

    // Add broader versions: drop the first part, keep the rest
    for (let i = 1; i < parts.length; i++) {
      queries.push(parts.slice(i).join(", "));
    }

    // Always try the general school location as a final fallback
    if (!queries.includes("Kiganda, Kassanda, Uganda")) {
      queries.push("Kiganda, Kassanda, Uganda");
    }
    if (!queries.includes("Kassanda, Uganda")) {
      queries.push("Kassanda, Uganda");
    }
    if (!queries.includes("Uganda")) {
      queries.push("Uganda");
    }

    return queries;
  }

  // Build a link to OpenStreetMap for the last located place.
  buildMapLink() {
    if (!this.lastResult) return "";
    const { latitude, longitude } = this.lastResult;
    return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=15/${latitude}/${longitude}`;
  }
}
