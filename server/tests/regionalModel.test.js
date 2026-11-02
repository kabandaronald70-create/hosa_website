import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  query: vi.fn(),
}));

vi.mock("../src/config/db.js", () => db);

import {
  updateRegionalReport,
  deleteRegionalReport,
} from "../src/models/regionalModel.js";

describe("Regional report actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates only the submitting officer's pending report", async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: "report-id" }] });

    await expect(
      updateRegionalReport("report-id", "officer-id", {
        title: "Monthly report",
        reportType: "monthly",
        content: "Report content",
      }),
    ).resolves.toEqual({ id: "report-id" });

    expect(db.query.mock.calls[0][0]).toContain(
      "AND submitted_by = $5 AND status = 'pending'",
    );
    expect(db.query.mock.calls[0][1]).toEqual([
      "Monthly report",
      "monthly",
      "Report content",
      "report-id",
      "officer-id",
    ]);
  });

  it("deletes only the submitting officer's pending report", async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: "report-id" }] });

    await expect(
      deleteRegionalReport("report-id", "officer-id"),
    ).resolves.toEqual({ id: "report-id" });

    expect(db.query.mock.calls[0][0]).toContain(
      "AND submitted_by = $2 AND status = 'pending'",
    );
    expect(db.query.mock.calls[0][1]).toEqual(["report-id", "officer-id"]);
  });
});
