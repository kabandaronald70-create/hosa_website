import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const { ping } = vi.hoisted(() => ({
  ping: vi.fn(),
}));

vi.mock("../src/config/db.js", async (importOriginal) => {
  const actual = await importOriginal();

  return {
    ...actual,
    ping,
  };
});

import { createApp } from "../src/app.js";

const app = createApp();

describe("Health Check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 when the database is available", async () => {
    ping.mockResolvedValue(true);

    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(response.body.db).toBe("ok");
    expect(response.body).toHaveProperty("uptime_s");
    expect(response.body).toHaveProperty("db_check_ms");
    expect(response.body).toHaveProperty("timestamp");
    expect(ping).toHaveBeenCalledOnce();
  });

  it("returns 503 when the database check returns false", async () => {
    ping.mockResolvedValue(false);

    const response = await request(app).get("/health");

    expect(response.status).toBe(503);
    expect(response.body.status).toBe("degraded");
    expect(response.body.db).toBe("down");
    expect(response.body).not.toHaveProperty("db_error");
    expect(ping).toHaveBeenCalledOnce();
  });

  it("returns 503 without exposing database errors", async () => {
    ping.mockRejectedValue(
      new Error("Sensitive database connection information"),
    );

    const response = await request(app).get("/health");

    expect(response.status).toBe(503);
    expect(response.body.status).toBe("degraded");
    expect(response.body.db).toBe("down");
    expect(response.body).not.toHaveProperty("db_error");
    expect(JSON.stringify(response.body)).not.toContain(
      "Sensitive database connection information",
    );
    expect(ping).toHaveBeenCalledOnce();
  });

  it("does not create a session cookie", async () => {
    ping.mockResolvedValue(true);

    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.headers["set-cookie"]).toBeUndefined();
  });
});
