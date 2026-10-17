import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { pool } from "../src/config/db.js";

// Initialize the Express app once for all tests
const app = createApp();

describe("Public API", () => {
  it("GET /api/health returns ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("GET /api/directory returns a list of members", async () => {
    const res = await request(app).get("/api/directory?limit=2");
    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data.length).toBeLessThanOrEqual(2);
    expect(res.body.data[0]).toHaveProperty("name");
    expect(res.body.data[0]).toHaveProperty("profession");
  });

  it("GET /api/events returns a list of events", async () => {
    const res = await request(app).get("/api/events");
    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
  });

  it("GET /api/me returns null for unauthenticated users", async () => {
    const res = await request(app).get("/api/me");
    expect(res.status).toBe(200);
    expect(res.body.user).toBeNull();
  });
});

describe("Protected API (Auth Guards)", () => {
  it("POST /api/saved rejects unauthenticated requests", async () => {
    const res = await request(app)
      .post("/api/saved")
      .send({ item_type: "member", item_id: "m001" });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Authentication required/i);
  });

  it("POST /api/rsvp rejects unauthenticated requests", async () => {
    const res = await request(app)
      .post("/api/rsvp/hosa-annual-general-meeting-2026-e001")
      .send({ status: "going" });

    expect(res.status).toBe(401);
  });
});
